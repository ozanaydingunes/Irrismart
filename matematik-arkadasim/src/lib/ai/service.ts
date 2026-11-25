import "server-only";
import type { z } from "zod";
import { DEMO_SAMPLES, findSample } from "@/lib/demo/samples";
import { solveDemo } from "@/lib/demo/solver";
import { demoCheck, demoPractice, demoTutorReply } from "@/lib/demo/tutor";
import { answersEquivalent } from "@/lib/math/answer";
import { verifySolution } from "@/lib/math/verify";
import {
  checkReplySchema,
  solveEnvelopeSchema,
  tutorReplySchema,
  type CheckReply,
  type LearningMode,
  type Solution,
  type SolveFailure,
  type SolveResult,
  type TutorAction,
  type TutorReply,
} from "@/lib/schema/solution";
import { getConfig, type ServerConfig } from "@/lib/server/config";
import type { ParsedImage } from "@/lib/server/image";
import { logError } from "@/lib/server/log";
import { recordSpend } from "@/lib/server/quota";
import { getStore } from "@/lib/server/store";
import { findTopic } from "@/lib/topics";
import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import { parseWithSchema } from "./json";
import { OpenAIProvider } from "./openai";
import { estimateCostUsd } from "./pricing";
import {
  checkSystemPrompt,
  checkUserText,
  practiceUserText,
  repairPrompt,
  solveSystemPrompt,
  solveUserText,
  tutorSystemPrompt,
  tutorUserText,
} from "./prompts";
import { AIError, userMessageFor, type AIProvider, type ChatTurn, type CompletionResult, type ContentPart } from "./provider";

/** Bir isteğin yapay zekâ için ayrılan toplam süresi (sunucu fonksiyon sınırı 120 sn'nin altında). */
const REQUEST_BUDGET_MS = 100_000;

export function getProvider(cfg: ServerConfig = getConfig()): AIProvider | null {
  if (cfg.provider === "anthropic") return new AnthropicProvider(cfg.anthropic.apiKey, cfg.anthropic.model, cfg.anthropic.lightModel, cfg.anthropic.effort);
  if (cfg.provider === "openai") return new OpenAIProvider(cfg.openai.apiKey, cfg.openai.model, cfg.openai.lightModel, cfg.openai.baseUrl);
  if (cfg.provider === "mock") return new MockProvider();
  return null;
}

/** Testlerde sahte sağlayıcı vermek için. `undefined` → ortam yapılandırması, `null` → demo. */
export interface ServiceDeps {
  provider?: AIProvider | null;
  /** Maliyet kaydı (varsayılan: kalıcı sayaç deposu) */
  onUsage?: (r: CompletionResult) => Promise<void> | void;
}

function resolve(deps: ServiceDeps) {
  const provider = deps.provider === undefined ? getProvider() : deps.provider;
  const onUsage =
    deps.onUsage ??
    (async (r: CompletionResult) => {
      try {
        await recordSpend(getStore(), estimateCostUsd(r.model, r.usage.inputTokens, r.usage.outputTokens));
      } catch (e) {
        logError("spend", e);
      }
    });
  return { provider, onUsage };
}

/** Modeli çağırır, şemayla doğrular; geçersizse (süre yetiyorsa) bir kez onarım ister. */
async function completeValidated<T>(
  provider: AIProvider,
  onUsage: (r: CompletionResult) => Promise<void> | void,
  system: string,
  messages: ChatTurn[],
  schema: z.ZodType<T>,
  maxTokens: number,
  light = false,
): Promise<T> {
  const deadline = Date.now() + REQUEST_BUDGET_MS;
  const first = await provider.complete({ system, messages, maxTokens, light, deadline });
  await onUsage(first);
  const parsed = parseWithSchema(first.text, schema);
  if (parsed.ok) return parsed.data;
  if (deadline - Date.now() < 20_000) throw new AIError(`invalid output: ${parsed.error}`, "invalid_output");
  const retry = await provider.complete({
    system,
    messages: [
      ...messages,
      { role: "assistant", parts: [{ type: "text", text: first.text.slice(0, 20000) }] },
      { role: "user", parts: [{ type: "text", text: repairPrompt(parsed.error) }] },
    ],
    maxTokens,
    light,
    deadline,
  });
  await onUsage(retry);
  const second = parseWithSchema(retry.text, schema);
  if (second.ok) return second.data;
  throw new AIError(`invalid output: ${second.error}`, "invalid_output");
}

function finalize(solution: Solution, source: "ai" | "demo", provider: string, notice?: string): SolveResult {
  const topic = findTopic(solution.topicId) ?? findTopic(solution.topic);
  const normalized = { ...solution, topicId: topic?.id ?? solution.topicId };
  const { issues } = verifySolution(normalized);
  return { ok: true, source, provider, solution: normalized, issues, notice };
}

export const DEMO_NOTICE =
  "Bu bir DEMO çözümüdür: yapay zekâ bağlı değil. Kural tabanlı çözücü yalnızca kesir/tam sayı işlemleri, birinci dereceden denklemler ve basit yüzde sorularını çözebilir.";

export interface SolveInput {
  text?: string;
  image?: ParsedImage;
  mode: LearningMode;
  selectedQuestion?: string;
}

export async function solveQuestion(input: SolveInput, deps: ServiceDeps = {}): Promise<SolveResult | SolveFailure> {
  const { provider, onUsage } = resolve(deps);

  if (!provider) {
    if (input.image) {
      return {
        ok: false,
        code: "DEMO_UNSUPPORTED",
        source: "demo",
        message: "Demo modunda fotoğraftaki soruyu okuyamıyorum; bunun için yapay zekâ bağlantısı gerekir. Soruyu klavyeyle yazabilir veya örnek sorulardan birini seçebilirsin.",
      };
    }
    const text = input.selectedQuestion ?? input.text ?? "";
    const sample = findSample(text);
    if (sample) return finalize(sample.solution, "demo", "Demo örneği", "Bu, uygulamayı tanıtmak için önceden hazırlanmış bir DEMO örneğidir; yapay zekâ çözümü değildir.");
    const solved = solveDemo(text);
    if (solved) return finalize(solved, "demo", "Kural tabanlı demo çözücü", DEMO_NOTICE);
    return {
      ok: false,
      code: "DEMO_UNSUPPORTED",
      source: "demo",
      message: `Demo modunda bu soruyu çözemiyorum. Şunları deneyebilirsin: "3/4 + 1/6", "2x + 5 = 15", "240 sayısının %25'i kaçtır?" ya da örnek sorulardan biri (${DEMO_SAMPLES.length} örnek).`,
    };
  }

  const parts: ContentPart[] = [];
  if (input.image) parts.push({ type: "image", mediaType: input.image.mediaType, base64: input.image.base64 });
  parts.push({ type: "text", text: solveUserText({ text: input.text, hasImage: !!input.image, mode: input.mode, selectedQuestion: input.selectedQuestion }) });

  try {
    const env = await completeValidated(provider, onUsage, solveSystemPrompt(), [{ role: "user", parts }], solveEnvelopeSchema, 16000);
    if (env.status === "unreadable") return { ok: false, code: "UNREADABLE", source: "ai", message: env.message };
    if (env.status === "not_math") return { ok: false, code: "NOT_MATH", source: "ai", message: env.message };
    if (env.status === "multiple") {
      if (input.selectedQuestion) return { ok: false, code: "UNREADABLE", source: "ai", message: "Seçtiğin soruyu fotoğrafta ayırt edemedim. Yalnızca o soruyu kırparak tekrar dener misin?" };
      return { ok: false, code: "MULTIPLE", source: "ai", message: env.message ?? "Fotoğrafta birkaç soru görüyorum. Hangisini çözelim?", questions: env.questions };
    }
    return finalize(env.solution, "ai", provider.name);
  } catch (e) {
    logError("solve", e);
    const invalid = e instanceof AIError && e.kind === "invalid_output";
    return { ok: false, code: invalid ? "INVALID_AI_OUTPUT" : "AI_ERROR", source: "ai", message: userMessageFor(e) };
  }
}

export interface TutorInput {
  solution: Solution;
  stepIndex: number;
  action: TutorAction;
  message?: string;
  history: { role: "student" | "teacher"; text: string }[];
}

export async function tutor(input: TutorInput, deps: ServiceDeps = {}): Promise<{ ok: true; source: "ai" | "demo"; reply: TutorReply } | { ok: false; message: string }> {
  const { provider, onUsage } = resolve(deps);
  if (!provider) return { ok: true, source: "demo", reply: demoTutorReply(input.solution, input.stepIndex, input.action) };
  try {
    const reply = await completeValidated(
      provider,
      onUsage,
      tutorSystemPrompt(),
      [{ role: "user", parts: [{ type: "text", text: tutorUserText(input) }] }],
      tutorReplySchema,
      8000,
      input.action === "hint",
    );
    return { ok: true, source: "ai", reply };
  } catch (e) {
    logError("tutor", e);
    return { ok: false, message: userMessageFor(e) };
  }
}

export interface CheckInput {
  question: string;
  prompt: string;
  expected?: string;
  studentAnswer: string;
}

/** Önce yerel (kesin) eşdeğerlik kontrolü; karar verilemezse YZ'ye (ucuz modelle) sorulur. */
export async function checkAnswer(
  input: CheckInput,
  deps: ServiceDeps = {},
): Promise<{ ok: true; source: "local" | "ai" | "demo"; reply: CheckReply } | { ok: false; message: string }> {
  if (input.expected) {
    const eq = answersEquivalent(input.studentAnswer, input.expected);
    if (eq !== null) return { ok: true, source: "local", reply: demoCheck(input.studentAnswer, input.expected) };
  }
  const { provider, onUsage } = resolve(deps);
  if (!provider) return { ok: true, source: "demo", reply: demoCheck(input.studentAnswer, input.expected) };
  try {
    const reply = await completeValidated(provider, onUsage, checkSystemPrompt(), [{ role: "user", parts: [{ type: "text", text: checkUserText(input) }] }], checkReplySchema, 2000, true);
    return { ok: true, source: "ai", reply };
  } catch (e) {
    logError("check", e);
    return { ok: false, message: userMessageFor(e) };
  }
}

export async function practice(input: { topicId: string; difficulty: string; basedOn?: string }, deps: ServiceDeps = {}): Promise<SolveResult | SolveFailure> {
  const { provider, onUsage } = resolve(deps);
  const topic = findTopic(input.topicId);
  if (!provider) {
    const sol = demoPractice(input.topicId);
    if (!sol) return { ok: false, code: "DEMO_UNSUPPORTED", source: "demo", message: "Demo modunda bu konu için alıştırma üretemiyorum. Yapay zekâ bağlantısı gerekir." };
    return finalize(sol, "demo", "Kural tabanlı demo çözücü", "Bu alıştırma DEMO modunda rastgele sayılarla üretildi; yapay zekâ çıktısı değildir.");
  }
  try {
    const env = await completeValidated(
      provider,
      onUsage,
      solveSystemPrompt(),
      [{ role: "user", parts: [{ type: "text", text: practiceUserText({ topicTitle: topic?.title ?? input.topicId, difficulty: input.difficulty, basedOn: input.basedOn }) }] }],
      solveEnvelopeSchema,
      16000,
    );
    if (env.status !== "ok") return { ok: false, code: "AI_ERROR", source: "ai", message: "message" in env && env.message ? env.message : "Alıştırma üretilemedi. Lütfen tekrar dene." };
    return finalize(env.solution, "ai", provider.name);
  } catch (e) {
    logError("practice", e);
    return { ok: false, code: "AI_ERROR", source: "ai", message: userMessageFor(e) };
  }
}

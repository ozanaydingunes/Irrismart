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
import { findTopic } from "@/lib/topics";
import { AnthropicProvider } from "./anthropic";
import { parseWithSchema } from "./json";
import { OpenAIProvider } from "./openai";
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
import { AIError, userMessageFor, type AIProvider, type ChatTurn, type ContentPart } from "./provider";

export function getProvider(cfg: ServerConfig = getConfig()): AIProvider | null {
  if (cfg.provider === "anthropic") return new AnthropicProvider(cfg.anthropic.apiKey, cfg.anthropic.model, cfg.anthropic.effort);
  if (cfg.provider === "openai") return new OpenAIProvider(cfg.openai.apiKey, cfg.openai.model, cfg.openai.baseUrl);
  return null;
}

/** Modeli çağırır, şemayla doğrular; geçersizse bir kez onarım ister. */
async function completeValidated<T>(
  provider: AIProvider,
  system: string,
  messages: ChatTurn[],
  schema: z.ZodType<T>,
  maxTokens: number,
  light = false,
): Promise<T> {
  const first = await provider.complete({ system, messages, maxTokens, light });
  const parsed = parseWithSchema(first, schema);
  if (parsed.ok) return parsed.data;
  const retry = await provider.complete({
    system,
    messages: [
      ...messages,
      { role: "assistant", parts: [{ type: "text", text: first.slice(0, 20000) }] },
      { role: "user", parts: [{ type: "text", text: repairPrompt(parsed.error) }] },
    ],
    maxTokens,
    light,
  });
  const second = parseWithSchema(retry, schema);
  if (second.ok) return second.data;
  throw new AIError(`invalid output: ${second.error}`, "unknown");
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
}

export async function solveQuestion(input: SolveInput): Promise<SolveResult | SolveFailure> {
  const cfg = getConfig();
  const provider = getProvider(cfg);

  if (!provider) {
    if (input.image) {
      return {
        ok: false,
        code: "DEMO_UNSUPPORTED",
        source: "demo",
        message: "Demo modunda fotoğraftaki soruyu okuyamıyorum; bunun için yapay zekâ bağlantısı gerekir. Soruyu klavyeyle yazabilir veya örnek sorulardan birini seçebilirsin.",
      };
    }
    const text = input.text ?? "";
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
  parts.push({ type: "text", text: solveUserText({ text: input.text, hasImage: !!input.image, mode: input.mode }) });

  try {
    const env = await completeValidated(provider, solveSystemPrompt(), [{ role: "user", parts }], solveEnvelopeSchema, 16000);
    if (env.status === "unreadable") return { ok: false, code: "UNREADABLE", source: "ai", message: env.message };
    if (env.status === "not_math") return { ok: false, code: "NOT_MATH", source: "ai", message: env.message };
    return finalize(env.solution, "ai", provider.name);
  } catch (e) {
    console.error("[solve] AI error:", e instanceof Error ? e.message : e);
    const invalid = e instanceof AIError && e.message.startsWith("invalid output");
    return { ok: false, code: invalid ? "INVALID_AI_OUTPUT" : "AI_ERROR", source: "ai", message: invalid ? "Yapay zekânın çözümü doğrulamadan geçemedi. Lütfen tekrar dene." : userMessageFor(e) };
  }
}

export interface TutorInput {
  solution: Solution;
  stepIndex: number;
  action: TutorAction;
  message?: string;
  history: { role: "student" | "teacher"; text: string }[];
}

export async function tutor(input: TutorInput): Promise<{ ok: true; source: "ai" | "demo"; reply: TutorReply } | { ok: false; message: string }> {
  const provider = getProvider();
  if (!provider) return { ok: true, source: "demo", reply: demoTutorReply(input.solution, input.stepIndex, input.action) };
  try {
    const reply = await completeValidated(
      provider,
      tutorSystemPrompt(),
      [{ role: "user", parts: [{ type: "text", text: tutorUserText(input) }] }],
      tutorReplySchema,
      8000,
      input.action === "hint",
    );
    return { ok: true, source: "ai", reply };
  } catch (e) {
    console.error("[tutor] AI error:", e instanceof Error ? e.message : e);
    return { ok: false, message: userMessageFor(e) };
  }
}

export interface CheckInput {
  question: string;
  prompt: string;
  expected?: string;
  studentAnswer: string;
}

/** Önce yerel (kesin) eşdeğerlik kontrolü; karar verilemezse YZ'ye sorulur. */
export async function checkAnswer(input: CheckInput): Promise<{ ok: true; source: "local" | "ai" | "demo"; reply: CheckReply } | { ok: false; message: string }> {
  if (input.expected) {
    const eq = answersEquivalent(input.studentAnswer, input.expected);
    if (eq !== null) return { ok: true, source: "local", reply: demoCheck(input.studentAnswer, input.expected) };
  }
  const provider = getProvider();
  if (!provider) return { ok: true, source: "demo", reply: demoCheck(input.studentAnswer, input.expected) };
  try {
    const reply = await completeValidated(
      provider,
      checkSystemPrompt(),
      [{ role: "user", parts: [{ type: "text", text: checkUserText(input) }] }],
      checkReplySchema,
      2000,
      true,
    );
    return { ok: true, source: "ai", reply };
  } catch (e) {
    return { ok: false, message: userMessageFor(e) };
  }
}

export async function practice(input: { topicId: string; difficulty: string; basedOn?: string }): Promise<SolveResult | SolveFailure> {
  const provider = getProvider();
  const topic = findTopic(input.topicId);
  if (!provider) {
    const sol = demoPractice(input.topicId);
    if (!sol) return { ok: false, code: "DEMO_UNSUPPORTED", source: "demo", message: "Demo modunda bu konu için alıştırma üretemiyorum. Yapay zekâ bağlantısı gerekir." };
    return finalize(sol, "demo", "Kural tabanlı demo çözücü", "Bu alıştırma DEMO modunda rastgele sayılarla üretildi; yapay zekâ çıktısı değildir.");
  }
  try {
    const env = await completeValidated(
      provider,
      solveSystemPrompt(),
      [{ role: "user", parts: [{ type: "text", text: practiceUserText({ topicTitle: topic?.title ?? input.topicId, difficulty: input.difficulty, basedOn: input.basedOn }) }] }],
      solveEnvelopeSchema,
      16000,
    );
    if (env.status !== "ok") return { ok: false, code: "AI_ERROR", source: "ai", message: env.message };
    return finalize(env.solution, "ai", provider.name);
  } catch (e) {
    return { ok: false, code: "AI_ERROR", source: "ai", message: userMessageFor(e) };
  }
}

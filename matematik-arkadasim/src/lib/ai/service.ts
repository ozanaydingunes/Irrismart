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
import { CloudflareProvider } from "./cloudflare";
import { FreeProviderChain, type FreeEntry, type FreeKind } from "./freeChain";
import { GroqProvider } from "./groq";
import { aiQueue, QueueFullError } from "./queue";
import { OllamaProvider } from "./ollama";
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

/** Bir isteğin yapay zekâ için ayrılan toplam süresi (sunucu fonksiyon sınırının altında). */
const REQUEST_BUDGET_MS = 100_000;

/** Ücretsiz sağlayıcı girdisi (bütçesiyle birlikte). Ücretli sağlayıcılar için ASLA kullanılmaz. */
export function freeEntry(kind: FreeKind, cfg: ServerConfig = getConfig()): FreeEntry | null {
  if (kind === "cloudflare" && cfg.cloudflare.configured) {
    const c = cfg.cloudflare;
    return { kind, provider: new CloudflareProvider(c.accountId, c.apiToken, c.model, c.lightModel, c.baseUrl), budget: { neurons: c.dailyNeuronBudget } };
  }
  if (kind === "groq" && cfg.groq.configured) {
    const g = cfg.groq;
    return { kind, provider: new GroqProvider(g.apiKey, g.model, g.baseUrl), budget: { requests: g.dailyRequestBudget, tokens: g.dailyTokenBudget } };
  }
  return null;
}

/** Birincil ücretsiz sağlayıcı + ebeveynin onayladığı ücretsiz yedekler (sırasıyla, tekrarsız). */
export function freeEntries(cfg: ServerConfig = getConfig()): FreeEntry[] {
  if (cfg.provider !== "cloudflare" && cfg.provider !== "groq") return [];
  const order = [cfg.provider, ...cfg.freeFallbacks.filter((k) => k !== cfg.provider)];
  return order.map((k) => freeEntry(k, cfg)).filter((e): e is FreeEntry => !!e);
}

export function getProvider(cfg: ServerConfig = getConfig()): AIProvider | null {
  if (cfg.provider === "cloudflare" || cfg.provider === "groq") {
    const entries = freeEntries(cfg);
    return entries.length ? new FreeProviderChain(entries, getStore()) : null;
  }
  if (cfg.provider === "ollama") return new OllamaProvider(cfg.ollama.baseUrl, cfg.ollama.model, cfg.ollama.lightModel, cfg.ollama.timeoutMs, cfg.ollama.authHeader, fetch, cfg.ollama.numCtx);
  // Ücretli sağlayıcılar yalnızca ALLOW_PAID_AI=1 ile ve yalnızca BİRİNCİL olarak (asla yedek değil)
  if (!cfg.paidAllowed && (cfg.provider === "anthropic" || cfg.provider === "openai")) return null;
  if (cfg.provider === "anthropic") return new AnthropicProvider(cfg.anthropic.apiKey, cfg.anthropic.model, cfg.anthropic.lightModel, cfg.anthropic.effort);
  if (cfg.provider === "openai") return new OpenAIProvider(cfg.openai.apiKey, cfg.openai.model, cfg.openai.lightModel, cfg.openai.baseUrl);
  if (cfg.provider === "mock") return new MockProvider();
  return null;
}

/** Model lisansı gereği gösterilecek ibare (Llama 4 Topluluk Lisansı: "Built with Llama"). */
export function modelCredit(cfg: ServerConfig = getConfig()): string | null {
  const models = freeEntries(cfg).flatMap((e) => (e.kind === "cloudflare" ? [cfg.cloudflare.model, cfg.cloudflare.lightModel] : [cfg.groq.model]));
  return models.some((m) => /llama/i.test(m)) ? "Built with Llama" : null;
}

/** Testlerde sahte sağlayıcı vermek için. `undefined` → ortam yapılandırması, `null` → demo. */
export interface ServiceDeps {
  provider?: AIProvider | null;
  /** Maliyet kaydı (varsayılan: kalıcı sayaç deposu) */
  onUsage?: (r: CompletionResult) => Promise<void> | void;
  /** Saf işlem/denklemleri yerel motorla çöz (varsayılan: yapılandırma; testlerde kapatılabilir) */
  localSolverFirst?: boolean;
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
  const budget = provider.timeBudgetMs ?? REQUEST_BUDGET_MS;
  const deadline = Date.now() + budget;
  // Ev bilgisayarındaki yerel model tek seferde tek istek işler; bulut sağlayıcılarda sıra yok
  const call = (r: Parameters<AIProvider["complete"]>[0]) =>
    !provider.serial
      ? provider.complete(r)
      : aiQueue()
          .run(() => provider.complete(r), Math.max(5_000, deadline - Date.now() - 30_000))
          .catch((e) => {
            if (e instanceof QueueFullError) throw new AIError("busy", "busy");
            throw e;
          });
  const first = await call({ system, messages, maxTokens, light, deadline });
  await onUsage(first);
  const parsed = parseWithSchema(first.text, schema);
  if (parsed.ok) return parsed.data;
  // Onarım denemesi için ilk çağrı kadar süre kalmadıysa vazgeç (yerel modelde ilk çağrı uzun sürebilir)
  if (deadline - Date.now() < Math.max(20_000, budget * 0.4)) throw new AIError(`invalid output: ${parsed.error}`, "invalid_output");
  const retry = await call({
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

function finalize(solution: Solution, source: SolveResult["source"], provider: string, notice?: string): SolveResult {
  const topic = findTopic(solution.topicId) ?? findTopic(solution.topic);
  const normalized = { ...solution, topicId: topic?.id ?? solution.topicId };
  const { issues } = verifySolution(normalized);
  return { ok: true, source, provider, solution: normalized, issues, notice };
}

export const DEMO_NOTICE =
  "Bu bir DEMO çözümüdür: yapay zekâ bağlı değil. Kural tabanlı çözücü yalnızca kesir/tam sayı işlemleri, birinci dereceden denklemler ve basit yüzde sorularını çözebilir.";

export const LOCAL_PROVIDER = "Yerel hesaplama motoru";
export const LOCAL_NOTICE =
  "Bu soru uygulamanın kendi hesaplama motoruyla çözüldü; yapay zekâ kullanılmadı. Tüm hesaplar kesin kesirli aritmetikle yapıldı ve sonuç kontrol edildi.";

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

  // Saf işlem/denklem soruları (ör. "3/4 + 1/6", "2x + 5 = 15") yapay zekâya gönderilmeden yerel, kesin
  // hesaplama motoruyla çözülür: ücretsiz kapasite harcanmaz, sonuç kesin aritmetikle doğrulanır.
  const localFirst = deps.localSolverFirst ?? getConfig().localSolverFirst;
  if (localFirst && !input.image) {
    const local = solveDemo(input.selectedQuestion ?? input.text ?? "");
    if (local) return finalize(local, "local", LOCAL_PROVIDER, LOCAL_NOTICE);
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
  // Kurallarla üretilebilen alıştırmalar (rastgele sayılarla, kesin çözümlü) yapay zekâsız üretilir.
  // "Benzer soru" (basedOn) ve "zor" seviye yapay zekâya bırakılır.
  const localFirst = deps.localSolverFirst ?? getConfig().localSolverFirst;
  if (provider && localFirst && !input.basedOn && input.difficulty !== "zor") {
    const sol = demoPractice(input.topicId);
    if (sol) return finalize(sol, "local", LOCAL_PROVIDER, "Bu alıştırma uygulamanın kendi kurallarıyla rastgele sayılarla üretildi; yapay zekâ kullanılmadı. Çözüm kesin aritmetikle hesaplandı.");
  }
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

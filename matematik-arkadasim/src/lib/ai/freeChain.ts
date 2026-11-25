import "server-only";
import { logError } from "@/lib/server/log";
import type { CounterStore } from "@/lib/server/store";
import { AIError, type AIProvider, type CompletionRequest, type CompletionResult } from "./provider";

/**
 * Ücretsiz sağlayıcı zinciri. Sırayla dener: birincil (ör. Cloudflare) → ebeveynin önceden onayladığı
 * ücretsiz yedekler (ör. Groq). Kurallar:
 *  - YALNIZCA ücretsiz sağlayıcılar zincire girer (ücretli sağlayıcılar burada hiç yoktur).
 *  - Kota doldu / geçici yoğunluk / bağlantı hatası → sıradaki ücretsiz sağlayıcı.
 *  - Güvenlik reddi, hatalı istek, geçersiz çıktı → başka sağlayıcıya GÖNDERİLMEZ (kural aşılmaz).
 *  - Her sağlayıcının günlük ücretsiz sınırının altında güvenlik payıyla durulur; tüketim kalıcı
 *    sayaç deposunda (Upstash / dosya) tutulur, sunucu yeniden başlasa da sıfırlanmaz.
 */

export type FreeKind = "cloudflare" | "groq";
export const FREE_KINDS: readonly FreeKind[] = ["cloudflare", "groq"];

export interface FreeBudget {
  /** Cloudflare: günlük nöron bütçesi (ücretsiz 10.000'in altında güvenlik payıyla) */
  neurons?: number;
  /** Groq: günlük istek ve jeton bütçesi */
  requests?: number;
  tokens?: number;
}

export interface FreeEntry {
  kind: FreeKind;
  provider: AIProvider & { modelFor?: (req: Pick<CompletionRequest, "light" | "messages">) => string; model?: string };
  budget: FreeBudget;
}

/**
 * Cloudflare Workers AI nöron oranları (nöron / 1M jeton) — resmî fiyat sayfasından (Kasım 2026).
 * Listede olmayan model için kasıtlı olarak yüksek (temkinli) oran kullanılır.
 */
export const NEURON_RATES: Record<string, readonly [number, number]> = {
  "@cf/meta/llama-4-scout-17b-16e-instruct": [24545, 77273],
  "@cf/mistralai/mistral-small-3.1-24b-instruct": [31876, 50488],
  "@cf/meta/llama-3.2-11b-vision-instruct": [4410, 61493],
  "@cf/google/gemma-3-12b-it": [31371, 50560],
};
const UNKNOWN_RATE = [130000, 450000] as const;

export function neuronsFor(model: string, inputTokens: number, outputTokens: number) {
  const [i, o] = NEURON_RATES[model] ?? UNKNOWN_RATE;
  return Math.ceil((inputTokens * i + outputTokens * o) / 1_000_000);
}

/** Cloudflare ve Groq günlük sınırları 00:00 UTC'de sıfırlanır (Cloudflare resmî belgesi). */
export function freeDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

/** İstek gönderilmeden önce kaba tahmin (gerçek tüketim yanıttaki jeton sayısıyla kaydedilir). */
export function estimateTokens(req: CompletionRequest) {
  let chars = req.system.length;
  let images = 0;
  for (const m of req.messages)
    for (const p of m.parts) {
      if (p.type === "text") chars += p.text.length;
      else images++;
    }
  return { input: Math.ceil(chars / 3) + images * 2048, output: Math.min(req.maxTokens, 3000) };
}

const key = (kind: FreeKind, what: string, day: string) => `ucretsiz:${kind}:${what}:${day}`;
const TTL = 3 * 86400;

export async function isExhausted(store: CounterStore, kind: FreeKind, now = Date.now()) {
  return (await store.get(key(kind, "dolu", freeDay(now)))) > 0;
}

/** Bütçe bu isteğe yetiyor mu? (tahmini) */
export async function budgetAllows(store: CounterStore, e: FreeEntry, req: CompletionRequest, now = Date.now()) {
  const day = freeDay(now);
  if (await isExhausted(store, e.kind, now)) return false;
  const est = estimateTokens(req);
  if (e.budget.neurons) {
    const model = e.provider.modelFor?.(req) ?? e.provider.model ?? "";
    const used = await store.get(key(e.kind, "noron", day));
    if (used + neuronsFor(model, est.input, est.output) > e.budget.neurons) return false;
  }
  if (e.budget.requests && (await store.get(key(e.kind, "istek", day))) + 1 > e.budget.requests) return false;
  if (e.budget.tokens && (await store.get(key(e.kind, "jeton", day))) + est.input + est.output > e.budget.tokens) return false;
  return true;
}

export async function recordFreeUsage(store: CounterStore, e: FreeEntry, req: CompletionRequest, r: CompletionResult, now = Date.now()) {
  const day = freeDay(now);
  const est = estimateTokens(req);
  const input = r.usage.inputTokens || est.input;
  const output = r.usage.outputTokens || est.output;
  const ops: Promise<number>[] = [];
  if (e.budget.neurons) ops.push(store.incr(key(e.kind, "noron", day), neuronsFor(e.provider.modelFor?.(req) ?? r.model, input, output), TTL));
  if (e.budget.requests) ops.push(store.incr(key(e.kind, "istek", day), 1, TTL));
  if (e.budget.tokens) ops.push(store.incr(key(e.kind, "jeton", day), input + output, TTL));
  await Promise.all(ops);
}

export async function markExhausted(store: CounterStore, kind: FreeKind, now = Date.now()) {
  await store.incr(key(kind, "dolu", freeDay(now)), 1, TTL);
}

/** Ayarlar ekranı için: kesin sayı yerine yalnızca durum (gerçek tüketim ölçülmediği için). */
export async function freeStates(store: CounterStore, entries: FreeEntry[], now = Date.now()) {
  return Promise.all(
    entries.map(async (e) => {
      let full = false;
      try {
        full = !(await budgetAllows(store, e, { system: "", messages: [], maxTokens: 1 }, now));
      } catch {
        /* sayaç okunamadı: bilinmiyor → kullanılabilir varsay */
      }
      return { kind: e.kind, name: e.provider.name, state: full ? ("full" as const) : ("ok" as const) };
    }),
  );
}

export class FreeProviderChain implements AIProvider {
  readonly timeBudgetMs = 240_000;
  private lastUsed: string;

  constructor(
    readonly entries: FreeEntry[],
    private store: CounterStore,
  ) {
    if (!entries.length) throw new Error("Ücretsiz sağlayıcı yok");
    this.lastUsed = entries[0].provider.name;
  }

  /** Son yanıtı veren sağlayıcının adı (çözüm kartında gösterilir) */
  get name() {
    return this.lastUsed;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    let sawQuota = false;
    let transient: AIError | null = null;
    for (const e of this.entries) {
      let allowed = true;
      try {
        allowed = await budgetAllows(this.store, e, req);
      } catch (err) {
        logError("free-quota", err); // sayaç okunamazsa ücretsiz plan zaten ücret çıkaramaz; denemeye devam
      }
      if (!allowed) {
        sawQuota = true;
        continue;
      }
      try {
        const r = await e.provider.complete(req);
        await recordFreeUsage(this.store, e, req, r).catch((err) => logError("free-quota", err));
        this.lastUsed = e.provider.name;
        return r;
      } catch (err) {
        const ai = err instanceof AIError ? err : new AIError("unknown", "unknown");
        if (ai.kind === "quota") {
          sawQuota = true;
          await markExhausted(this.store, e.kind).catch((x) => logError("free-quota", x));
          continue;
        }
        if (ai.kind === "rate" || ai.kind === "overloaded" || ai.kind === "network" || ai.kind === "timeout") {
          transient = ai;
          if (req.deadline && req.deadline - Date.now() < 20_000) break;
          continue;
        }
        // refusal, auth, bad_request, truncated, unknown… → başka sağlayıcıya gönderilmez
        throw ai;
      }
    }
    if (transient) throw transient;
    if (sawQuota) throw new AIError("all free providers exhausted", "quota_all");
    throw new AIError("no provider", "unavailable");
  }
}

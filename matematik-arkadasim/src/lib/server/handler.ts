import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getConfig } from "./config";
import { clientKey, DailyCounter, SlidingWindowLimiter } from "./rateLimit";

/**
 * Tüm yapay zekâ uçları için ortak koruma katmanı:
 * gövde boyutu → JSON → Zod girdi doğrulaması → dakikalık hız sınırı → günlük kullanım sınırı.
 */

interface Limiters {
  minute: SlidingWindowLimiter;
  daily: DailyCounter;
}

const g = globalThis as unknown as { __mathLimiters?: Limiters };

function limiters(): Limiters {
  if (!g.__mathLimiters) {
    const cfg = getConfig();
    g.__mathLimiters = {
      minute: new SlidingWindowLimiter(cfg.limits.perMinute, 60_000),
      daily: new DailyCounter(cfg.limits.dailyPerClient, cfg.limits.dailyGlobal),
    };
  }
  return g.__mathLimiters;
}

/** Testlerde sayaçları sıfırlamak için */
export function resetLimiters() {
  g.__mathLimiters = undefined;
}

export function jsonError(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, code, message, ...extra }, { status, headers: { "cache-control": "no-store" } });
}

export interface GuardOptions<S extends z.ZodTypeAny> {
  schema: S;
  maxBodyBytes: number;
  /** Bu istek günlük yapay zekâ kotasından düşülsün mü? (demo/yerel yanıtlar düşülmez) */
  countsTowardQuota: (input: z.infer<S>) => boolean;
  handle: (input: z.infer<S>, meta: { remainingToday?: number }) => Promise<Response | Record<string, unknown>>;
}

export async function guardedJsonRoute<S extends z.ZodTypeAny>(req: Request, opts: GuardOptions<S>): Promise<Response> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len && len > opts.maxBodyBytes) return jsonError(413, "BAD_INPUT", "Gönderilen veri çok büyük.");

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return jsonError(400, "BAD_INPUT", "İstek okunamadı.");
  }
  if (raw.length > opts.maxBodyBytes) return jsonError(413, "BAD_INPUT", "Gönderilen veri çok büyük.");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, "BAD_INPUT", "İstek biçimi hatalı.");
  }
  const parsed = opts.schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return jsonError(400, "BAD_INPUT", first?.message && /[çğıöşü]/i.test(first.message) ? first.message : "Gönderilen bilgiler eksik veya hatalı.");
  }
  const input = parsed.data as z.infer<S>;
  const key = clientKey(req.headers);
  const L = limiters();

  const counts = opts.countsTowardQuota(input);
  let remainingToday: number | undefined;
  if (counts) {
    const m = L.minute.check(key);
    if (!m.allowed) {
      return jsonError(429, "RATE_LIMITED", `Çok hızlı istek gönderdin. ${m.retryAfterSec} saniye sonra tekrar dene.`, { retryAfterSec: m.retryAfterSec });
    }
    const d = L.daily.consume(key);
    if (!d.allowed) {
      return jsonError(
        429,
        "DAILY_LIMIT",
        d.reason === "global"
          ? "Uygulamanın bugünkü yapay zekâ kullanım sınırı doldu. Yarın tekrar dene; kayıtlı çözümlerine Soru Defterim'den ulaşabilirsin."
          : "Bugünkü soru çözme hakkın doldu. Yarın tekrar görüşmek üzere! Kayıtlı sorularını Soru Defterim'den tekrar edebilirsin.",
      );
    }
    remainingToday = d.remainingToday;
  }

  try {
    const result = await opts.handle(input, { remainingToday });
    if (result instanceof Response) return result;
    return NextResponse.json({ ...result, remainingToday }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[api] unexpected:", e instanceof Error ? e.message : e);
    return jsonError(500, "AI_ERROR", "Beklenmedik bir hata oluştu. Lütfen tekrar dene.");
  }
}

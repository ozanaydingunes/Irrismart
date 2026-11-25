import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { AUTH_COOKIE, cookieHeader, isValidSessionId, newSessionId, parseCookies, requestIsHttps, SESSION_COOKIE, verifyAuthToken } from "./auth";
import { getConfig } from "./config";
import { logError } from "./log";
import { checkAndConsume } from "./quota";
import { clientKey } from "./rateLimit";
import { getStore } from "./store";

/**
 * Tüm yapay zekâ uçları için ortak koruma katmanı:
 * gövde boyutu → JSON → Zod girdi doğrulaması → (varsa) aile PIN'i → hız sınırı, günlük kota ve
 * günlük harcama sınırı (kalıcı depo) → işleyici. Hata mesajları Türkçe ve teknik ayrıntısızdır.
 */

export function jsonError(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, code, message, ...extra }, { status, headers: { "cache-control": "no-store" } });
}

export interface RequestIdentity {
  sessionId: string;
  ip: string;
  isNewSession: boolean;
  authenticated: boolean;
  https: boolean;
}

export function identify(req: Request): RequestIdentity {
  const cfg = getConfig();
  const cookies = parseCookies(req.headers.get("cookie"));
  const sid = cookies[SESSION_COOKIE];
  const valid = isValidSessionId(sid);
  return {
    sessionId: valid ? sid : newSessionId(),
    ip: clientKey(req.headers),
    isNewSession: !valid,
    https: requestIsHttps(req),
    authenticated: !cfg.access.pin || verifyAuthToken(cfg.access.sessionSecret, cookies[AUTH_COOKIE]),
  };
}

export function accessMisconfigured(): boolean {
  const { access } = getConfig();
  return !!access.pin && access.sessionSecret.length < 32;
}

/**
 * İnternette yayında (Vercel) güvenlik ayarları eksikse yapay zekâ uçları çalışmaz:
 * aile PIN'i zorunlu, sayaçlar (hız sınırı, PIN deneme sınırı, ücretsiz kota) kalıcı depoda olmalı.
 */
export function deploymentProblem(): string | null {
  const cfg = getConfig();
  if (cfg.access.pinRequired && !cfg.access.pin) return "Aile PIN'i tanımlanmamış (APP_ACCESS_PIN). Kurulum rehberindeki 'Aile PIN'i' adımını yapın.";
  if (cfg.store.persistentRequired && !(cfg.store.upstashUrl && cfg.store.upstashToken)) return "Kalıcı sayaç deposu (Upstash) bağlanmamış. Kurulum rehberindeki 'Upstash' adımını yapın.";
  return null;
}

function withSession(res: Response, id: RequestIdentity): Response {
  if (id.isNewSession) res.headers.append("set-cookie", cookieHeader(SESSION_COOKIE, id.sessionId, 365 * 86400, id.https));
  return res;
}

export interface GuardOptions<S extends z.ZodTypeAny> {
  schema: S;
  maxBodyBytes: number;
  /** Bu istek yapay zekâ kotasından düşülsün mü? (demo/yerel yanıtlar düşülmez) */
  countsTowardQuota: (input: z.infer<S>) => boolean;
  handle: (input: z.infer<S>, meta: { remainingToday?: number; identity: RequestIdentity }) => Promise<Response | Record<string, unknown>>;
}

export async function guardedJsonRoute<S extends z.ZodTypeAny>(req: Request, opts: GuardOptions<S>): Promise<Response> {
  const cfg = getConfig();
  const id = identify(req);

  if (accessMisconfigured()) {
    logError("config", new Error("APP_ACCESS_PIN tanımlı ama APP_SESSION_SECRET en az 32 karakter değil"));
    return jsonError(500, "CONFIG", "Uygulamanın erişim ayarı eksik. Lütfen uygulamayı kuran yetişkine haber ver.");
  }
  const problem = deploymentProblem();
  if (problem) {
    logError("config", new Error(problem));
    return jsonError(503, "CONFIG", `Uygulamanın kurulumu tamamlanmamış: ${problem}`);
  }
  if (!id.authenticated) return withSession(jsonError(401, "AUTH_REQUIRED", "Devam etmek için aile PIN'ini girmen gerekiyor."), id);

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len && len > opts.maxBodyBytes) return jsonError(413, "BAD_INPUT", "Gönderilen veri çok büyük. Fotoğrafı kırpıp tekrar dene.");

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return jsonError(400, "BAD_INPUT", "İstek okunamadı.");
  }
  if (raw.length > opts.maxBodyBytes) return jsonError(413, "BAD_INPUT", "Gönderilen veri çok büyük. Fotoğrafı kırpıp tekrar dene.");

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

  let remainingToday: number | undefined;
  if (opts.countsTowardQuota(input)) {
    let d;
    try {
      d = await checkAndConsume(getStore(), { session: id.sessionId, ip: id.ip }, cfg.limits);
    } catch (e) {
      // Sayaç deposuna ulaşılamıyorsa maliyet kontrolü yapılamaz: güvenli tarafta kalıp reddet
      logError("quota", e);
      return jsonError(503, "AI_ERROR", "Kullanım sınırı şu an kontrol edilemedi. Biraz sonra tekrar dene.");
    }
    if (!d.allowed) {
      const msg =
        d.reason === "rate"
          ? `Çok hızlı soru gönderdin. ${d.retryAfterSec ?? 60} saniye sonra tekrar dene.`
          : d.reason === "budget" || d.reason === "global"
            ? "Uygulamanın bugünkü yapay zekâ kullanım sınırı doldu. Yarın tekrar dene; kayıtlı çözümlerine Soru Defterim'den ulaşabilirsin."
            : "Bugün çok fazla istek gönderildi. Yarın tekrar devam edebiliriz; kayıtlı sorularını Soru Defterim'den tekrar edebilirsin.";
      return withSession(jsonError(429, d.reason === "rate" ? "RATE_LIMITED" : "DAILY_LIMIT", msg, { retryAfterSec: d.retryAfterSec }), id);
    }
    remainingToday = d.remainingToday;
  }

  try {
    const result = await opts.handle(input, { remainingToday, identity: id });
    if (result instanceof Response) return withSession(result, id);
    return withSession(NextResponse.json({ ...result, remainingToday }, { headers: { "cache-control": "no-store" } }), id);
  } catch (e) {
    logError("api", e);
    return withSession(jsonError(500, "AI_ERROR", "Beklenmedik bir hata oluştu. Lütfen tekrar dene."), id);
  }
}

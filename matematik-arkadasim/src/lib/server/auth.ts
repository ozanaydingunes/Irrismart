import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * İsteğe bağlı aile PIN'i ve anonim oturum çerezi.
 * - Oturum çerezi (ma_sid): rastgele kimlik; yalnızca kullanıcı bazlı hız sınırı için. Kişisel veri içermez.
 * - Erişim çerezi (ma_auth): APP_ACCESS_PIN doğru girilince verilen, APP_SESSION_SECRET ile imzalı,
 *   süreli (30 gün) çerez. HttpOnly + SameSite=Strict + (üretimde) Secure.
 */

export const SESSION_COOKIE = "ma_sid";
export const AUTH_COOKIE = "ma_auth";
const AUTH_TTL_SEC = 30 * 86400;

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function newSessionId() {
  return randomBytes(16).toString("hex");
}

export function isValidSessionId(v: string | undefined): v is string {
  return !!v && /^[a-f0-9]{32}$/.test(v);
}

function sign(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueAuthToken(secret: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + AUTH_TTL_SEC;
  const payload = `v1.${exp}`;
  return `${payload}.${sign(secret, payload)}`;
}

export function verifyAuthToken(secret: string, token: string | undefined, now = Date.now()): boolean {
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  const expected = Buffer.from(sign(secret, `v1.${parts[1]}`));
  const got = Buffer.from(parts[2]);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** Sabit süreli PIN karşılaştırması (zamanlama saldırısına karşı). */
export function pinMatches(expected: string, given: string): boolean {
  const a = createHmac("sha256", "pin").update(expected).digest();
  const b = createHmac("sha256", "pin").update(given).digest();
  return timingSafeEqual(a, b);
}

export function cookieHeader(name: string, value: string, maxAgeSec: number, secure: boolean): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

export const AUTH_MAX_AGE = AUTH_TTL_SEC;

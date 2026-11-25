import { NextResponse } from "next/server";
import { authRequestSchema } from "@/lib/schema/api";
import { AUTH_COOKIE, AUTH_MAX_AGE, cookieHeader, issueAuthToken, pinMatches, requestIsHttps } from "@/lib/server/auth";
import { getConfig } from "@/lib/server/config";
import { accessMisconfigured, jsonError } from "@/lib/server/handler";
import { pinAttemptAllowed, recordPinFailure } from "@/lib/server/quota";
import { clientKey } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";

export const runtime = "nodejs";

/** Aile PIN'i ile giriş (APP_ACCESS_PIN tanımlıysa). 15 dakikada en fazla 5 yanlış deneme. */
export async function POST(req: Request) {
  const cfg = getConfig();
  if (!cfg.access.pin) return NextResponse.json({ ok: true, accessRequired: false });
  if (accessMisconfigured()) return jsonError(500, "CONFIG", "Uygulamanın erişim ayarı eksik.");
  const ip = clientKey(req.headers);
  const store = getStore();
  if (!(await pinAttemptAllowed(store, ip))) return jsonError(429, "RATE_LIMITED", "Çok fazla yanlış deneme yapıldı. 15 dakika sonra tekrar dene.");
  const raw = await req.text().catch(() => "");
  if (raw.length > 1000) return jsonError(413, "BAD_INPUT", "İstek çok büyük.");
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    /* aşağıda doğrulanır */
  }
  const parsed = authRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "BAD_INPUT", "PIN'i yaz.");
  if (!pinMatches(cfg.access.pin, parsed.data.pin)) {
    await recordPinFailure(store, ip);
    return jsonError(401, "AUTH_REQUIRED", "PIN yanlış. Tekrar dene.");
  }
  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  res.headers.append("set-cookie", cookieHeader(AUTH_COOKIE, issueAuthToken(cfg.access.sessionSecret), AUTH_MAX_AGE, requestIsHttps(req)));
  return res;
}

/** Çıkış: erişim çerezini siler. */
export async function DELETE(req: Request) {
  const res = NextResponse.json({ ok: true });
  res.headers.append("set-cookie", cookieHeader(AUTH_COOKIE, "", 0, requestIsHttps(req)));
  return res;
}

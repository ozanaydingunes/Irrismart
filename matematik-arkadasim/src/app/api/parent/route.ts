import { NextResponse } from "next/server";
import { parentSettingsSchema } from "@/lib/schema/api";
import { pinMatches } from "@/lib/server/auth";
import { getConfig } from "@/lib/server/config";
import { jsonError } from "@/lib/server/handler";
import { pinAttemptAllowed, recordPinFailure, setDailyQuestionLimit } from "@/lib/server/quota";
import { clientKey } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";

export const runtime = "nodejs";

/**
 * Ebeveyn ayarı: günlük soru sınırını değiştirir. PARENT_PIN (çocuğun bildiği aile PIN'inden farklı)
 * gerekir; 15 dakikada en fazla 5 yanlış deneme.
 */
export async function POST(req: Request) {
  const cfg = getConfig();
  if (!cfg.access.parentPin) return jsonError(403, "PARENT_PIN_MISSING", "Ebeveyn PIN'i tanımlanmamış. Kurulum rehberindeki PARENT_PIN adımını yapın.");
  const ip = `${clientKey(req.headers)}:ebeveyn`;
  const store = getStore();
  if (!(await pinAttemptAllowed(store, ip))) return jsonError(429, "RATE_LIMITED", "Çok fazla yanlış deneme yapıldı. 15 dakika sonra tekrar deneyin.");
  const raw = await req.text().catch(() => "");
  if (raw.length > 1000) return jsonError(413, "BAD_INPUT", "İstek çok büyük.");
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    /* aşağıda doğrulanır */
  }
  const parsed = parentSettingsSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "BAD_INPUT", parsed.error.issues[0]?.message ?? "Bilgiler eksik.");
  if (!pinMatches(cfg.access.parentPin, parsed.data.pin)) {
    await recordPinFailure(store, ip);
    return jsonError(401, "AUTH_REQUIRED", "Ebeveyn PIN'i yanlış.");
  }
  await setDailyQuestionLimit(store, parsed.data.dailyQuestions);
  return NextResponse.json({ ok: true, dailyQuestions: parsed.data.dailyQuestions }, { headers: { "cache-control": "no-store" } });
}

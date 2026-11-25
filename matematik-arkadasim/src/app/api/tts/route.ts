import { ttsRequestSchema } from "@/lib/schema/api";
import { getConfig } from "@/lib/server/config";
import { guardedJsonRoute, jsonError } from "@/lib/server/handler";
import { hashId, recordSpend, spentToday } from "@/lib/server/quota";
import { clientKey } from "@/lib/server/rateLimit";
import { getStore } from "@/lib/server/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * İsteğe bağlı sunucu seslendirmesi (OpenAI TTS). TTS_PROVIDER=openai değilse 501 döner ve
 * istemci tarayıcı sesine (Web Speech API) geri döner. Ses dosyaları saklanmaz.
 * ElevenLabs vb. başka bir sağlayıcı eklemek için burada yeni bir dal açmak yeterlidir.
 */
export async function POST(req: Request) {
  const cfg = getConfig();
  if (cfg.tts.provider === "none") return jsonError(501, "TTS_DISABLED", "Sunucu seslendirmesi yapılandırılmamış.");
  // Seslendirme her cümle için istek attığından ayrı ve daha geniş bir dakikalık sınır (IP başına 60)
  const n = await getStore()
    .incr(`tts:${hashId(clientKey(req.headers))}:${Math.floor(Date.now() / 60_000)}`, 1, 90)
    .catch(() => 0);
  if (n > 60) return jsonError(429, "RATE_LIMITED", "Çok fazla seslendirme isteği. Biraz sonra tekrar dene.");
  return guardedJsonRoute(req, {
    schema: ttsRequestSchema,
    maxBodyBytes: 5_000,
    countsTowardQuota: () => false,
    handle: async ({ text, voice }) => {
      if (cfg.limits.dailyBudgetUsd > 0 && (await spentToday(getStore())) >= cfg.limits.dailyBudgetUsd) {
        return jsonError(429, "DAILY_LIMIT", "Bugünkü sesli anlatım sınırı doldu; anlatım tarayıcı sesiyle veya yazılı devam edebilir.");
      }
      // Yaklaşık maliyet: karakter başına ~15 USD / 1 milyon karakter (temkinli üst sınır)
      await recordSpend(getStore(), (text.length * 15) / 1_000_000).catch(() => undefined);
      const res = await fetch(`${cfg.openai.baseUrl}/audio/speech`, {
        method: "POST",
        headers: { authorization: `Bearer ${cfg.openai.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: cfg.tts.model,
          voice: voice === "male" ? cfg.tts.voiceMale : cfg.tts.voiceFemale,
          input: text,
          response_format: "mp3",
          instructions: "Türkçe konuşan, sıcak, sabırlı ve anlaşılır bir ortaokul matematik öğretmeni gibi oku.",
        }),
        signal: AbortSignal.timeout(45_000),
      }).catch(() => null);
      if (!res || !res.ok || !res.body) return jsonError(502, "TTS_ERROR", "Sunucu sesi oluşturulamadı.");
      return new Response(res.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
    },
  });
}

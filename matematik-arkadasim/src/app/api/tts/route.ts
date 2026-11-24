import { ttsRequestSchema } from "@/lib/schema/api";
import { getConfig } from "@/lib/server/config";
import { guardedJsonRoute, jsonError } from "@/lib/server/handler";
import { clientKey, SlidingWindowLimiter } from "@/lib/server/rateLimit";

// Seslendirme her cümle için istek attığından ayrı ve daha geniş bir dakikalık sınır kullanılır.
const g = globalThis as unknown as { __ttsLimiter?: SlidingWindowLimiter };
const ttsLimiter = (g.__ttsLimiter ??= new SlidingWindowLimiter(60, 60_000));

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
  const rl = ttsLimiter.check(clientKey(req.headers));
  if (!rl.allowed) return jsonError(429, "RATE_LIMITED", "Çok fazla seslendirme isteği. Biraz sonra tekrar dene.");
  return guardedJsonRoute(req, {
    schema: ttsRequestSchema,
    maxBodyBytes: 5_000,
    countsTowardQuota: () => false,
    handle: async ({ text, voice }) => {
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

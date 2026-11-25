import "server-only";
import { compatComplete, toCompatMessages, withOneRetry, type FetchLike } from "./compat";
import { AIError, type AIProvider, type CompletionRequest, type CompletionResult } from "./provider";

/**
 * Groq (ücretsiz plan; ödeme yöntemi eklenmedikçe ücret oluşmaz). Yalnızca ebeveyn AI_FALLBACK_PROVIDERS
 * ile onayladığında, birincil ücretsiz sağlayıcının kotası dolunca yedek olarak kullanılır.
 * Varsayılan model qwen/qwen3.8-27b (Apache 2.0, görsel destekli, JSON modu). Groq girdileri varsayılan
 * olarak saklamaz ve model eğitiminde kullanmaz.
 * Not: Ücretsiz planda dakikada ~8.000 jeton sınırı vardır; uzun bir fotoğraflı çözüm isteği bu sınırı
 * aşabilir (Groq 413/429 döner → geçici sınır sayılır, sıradaki sağlayıcıya geçilir).
 */
export class GroqProvider implements AIProvider {
  readonly name: string;
  readonly kind = "groq" as const;

  constructor(
    private apiKey: string,
    readonly model: string,
    private baseUrl = "https://api.groq.com/openai/v1",
    private fetchImpl: FetchLike = fetch,
  ) {
    this.name = `Groq (${model.split("/").pop()})`;
  }

  complete(req: CompletionRequest): Promise<CompletionResult> {
    return withOneRetry(req, () =>
      compatComplete(
        {
          url: `${this.baseUrl}/chat/completions`,
          apiKey: this.apiKey,
          fetchImpl: this.fetchImpl,
          timeoutCapMs: 90_000,
          body: {
            model: this.model,
            messages: toCompatMessages(req.system, req.messages),
            // Ücretsiz plandaki dakikalık jeton sınırına sığmak için çıktı üst sınırı düşük tutulur
            max_completion_tokens: Math.min(req.maxTokens, 4000),
            temperature: 0.2,
            reasoning_effort: "none",
            response_format: { type: "json_object" },
          },
          classify: (status, text) => {
            // Günlük ücretsiz sınır → "quota" (gün boyu atlanır); dakikalık sınır → "rate" (geçici)
            if (/per day|\b(RPD|TPD)\b/i.test(text)) return new AIError("groq daily free limit", "quota");
            if (status === 429 || status === 413) return new AIError("groq per-minute free limit", "rate");
            return null;
          },
        },
        req,
        this.model,
      ),
    );
  }
}

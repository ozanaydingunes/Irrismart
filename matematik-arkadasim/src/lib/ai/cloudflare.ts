import "server-only";
import { compatComplete, toCompatMessages, withOneRetry, type FetchLike } from "./compat";
import { AIError, type AIProvider, type CompletionRequest, type CompletionResult } from "./provider";

/**
 * Cloudflare Workers AI (ücretsiz plan: günde 10.000 "nöron", 00:00 UTC'de sıfırlanır).
 * OpenAI uyumlu uç nokta: /accounts/{hesap}/ai/v1/chat/completions
 *
 * Varsayılan model @cf/meta/llama-4-scout-17b-16e-instruct: Cloudflare model sayfasında "Vision: Yes",
 * JSON modu (response_format) ve görsel girdi (yalnızca data: URI) belgelenmiş tek uygun model.
 * Mistral Small 3.1 Cloudflare'de yalnızca METİN girdi şemasıyla sunuluyor (görsel alanı yok).
 * Cloudflare, Workers AI girdilerini saklamadığını ve model eğitiminde kullanmadığını belirtir.
 */
export class CloudflareProvider implements AIProvider {
  readonly name: string;
  readonly kind = "cloudflare" as const;

  constructor(
    private accountId: string,
    private apiToken: string,
    readonly model: string,
    readonly lightModel: string,
    private baseUrl = "https://api.cloudflare.com/client/v4",
    private fetchImpl: FetchLike = fetch,
  ) {
    this.name = `Cloudflare Workers AI (${shortName(model)})`;
  }

  modelFor(req: Pick<CompletionRequest, "light" | "messages">) {
    // Görsel içeren istek her zaman görsel destekli ana modele gider
    const hasImage = req.messages.some((m) => m.parts.some((p) => p.type === "image"));
    return req.light && !hasImage ? this.lightModel : this.model;
  }

  complete(req: CompletionRequest): Promise<CompletionResult> {
    const model = this.modelFor(req);
    return withOneRetry(req, () =>
      compatComplete(
        {
          url: `${this.baseUrl}/accounts/${encodeURIComponent(this.accountId)}/ai/v1/chat/completions`,
          apiKey: this.apiToken,
          fetchImpl: this.fetchImpl,
          timeoutCapMs: 150_000,
          body: {
            model,
            messages: toCompatMessages(req.system, req.messages),
            max_tokens: req.maxTokens,
            temperature: 0.2,
            response_format: { type: "json_object" },
          },
          classify: classifyCloudflare,
        },
        req,
        model,
      ),
    );
  }
}

/** Cloudflare hata gövdesi: {errors:[{code,message}]} veya OpenAI biçimi. */
export function classifyCloudflare(status: number, text: string): AIError | null {
  // 4006: "You have used up your daily free allocation of 10,000 neurons." → ücretli plana GEÇİLMEZ
  if (/\b4006\b|daily free allocation|neurons/i.test(text)) return new AIError("cloudflare daily free allocation used", "quota");
  if (status === 400 && /authentication|10000|invalid api token/i.test(text)) return new AIError("auth", "auth");
  if (status === 403 && /permission|10000/i.test(text)) return new AIError("auth", "auth");
  return null;
}

function shortName(model: string) {
  return model.split("/").pop() ?? model;
}

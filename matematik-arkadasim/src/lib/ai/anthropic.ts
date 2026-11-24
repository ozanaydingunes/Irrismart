import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AIError, type AIProvider, type ChatTurn, type CompletionRequest } from "./provider";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Anthropic Claude sağlayıcısı (resmî SDK).
 * - Akış (stream) kullanılır; uzun çözümlerde HTTP zaman aşımı yaşanmaz.
 * - Sabit sistem istemi önbelleğe alınır (prompt caching) → tekrar eden çağrılar ucuzlar.
 * - Güvenlik reddinde sunucu tarafı yedek model ("fallbacks: default") devreye girer.
 */
export class AnthropicProvider implements AIProvider {
  readonly name: string;
  private client: Anthropic;

  constructor(apiKey: string, private model: string, private effort: Effort) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
    this.name = `Anthropic Claude (${model})`;
  }

  async complete(req: CompletionRequest): Promise<string> {
    try {
      const stream = this.client.beta.messages.stream({
        model: this.model,
        max_tokens: req.maxTokens,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: req.light ? "low" : this.effort },
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: req.messages.map(toAnthropic),
      });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === "refusal") throw new AIError("refusal", "refusal");
      if (msg.stop_reason === "max_tokens") throw new AIError("truncated", "truncated");
      const text = msg.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      if (!text.trim()) throw new AIError("empty", "unknown");
      return text;
    } catch (e) {
      throw mapError(e);
    }
  }
}

function toAnthropic(turn: ChatTurn): Anthropic.Beta.BetaMessageParam {
  return {
    role: turn.role,
    content: turn.parts.map((p) =>
      p.type === "text"
        ? ({ type: "text", text: p.text } as const)
        : ({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.base64 } } as const),
    ),
  };
}

function mapError(e: unknown): AIError {
  if (e instanceof AIError) return e;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new AIError("auth", "auth");
  if (e instanceof Anthropic.RateLimitError) return new AIError("rate", "rate");
  if (e instanceof Anthropic.BadRequestError) return new AIError(e.message, "bad_request");
  if (e instanceof Anthropic.APIConnectionError) return new AIError("network", "network");
  if (e instanceof Anthropic.InternalServerError) return new AIError("overloaded", "overloaded");
  if (e instanceof Anthropic.APIError) return new AIError(e.message, e.status === 529 ? "overloaded" : "unknown");
  return new AIError(e instanceof Error ? e.message : "unknown", "unknown");
}

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AIError, remainingMs, type AIProvider, type ChatTurn, type CompletionRequest, type CompletionResult } from "./provider";

type Effort = "low" | "medium" | "high";

/**
 * Anthropic Claude sağlayıcısı (resmî SDK).
 * - Akış (stream) kullanılır; uzun çözümlerde HTTP zaman aşımı yaşanmaz.
 * - Sabit sistem istemi önbelleğe alınır (prompt caching) → tekrar eden çağrılar ucuzlar.
 * - Geçici hatalarda (429, 5xx, bağlantı) SDK en fazla 1 kez yeniden dener; toplam süre isteğin
 *   son tarihini aşmaz.
 * - Model güvenlik nedeniyle reddederse BAŞKA MODELE GEÇİLMEZ; öğrenciye nazik bir mesaj gösterilir.
 */
export class AnthropicProvider implements AIProvider {
  readonly name: string;
  private client: Anthropic;

  constructor(
    apiKey: string,
    private model: string,
    private lightModel: string,
    private effort: Effort,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 1 });
    this.name = `Anthropic Claude (${model})`;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const model = req.light ? this.lightModel : this.model;
    try {
      const timeout = remainingMs(req.deadline, 55_000);
      const stream = this.client.messages.stream(
        {
          model,
          max_tokens: req.maxTokens,
          thinking: { type: "adaptive" },
          output_config: { effort: req.light ? "low" : this.effort },
          system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
          messages: req.messages.map(toAnthropic),
        },
        { timeout },
      );
      const msg = await stream.finalMessage();
      if (msg.stop_reason === "refusal") throw new AIError("refusal", "refusal");
      if (msg.stop_reason === "max_tokens") throw new AIError("truncated", "truncated");
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      if (!text.trim()) throw new AIError("empty response", "unknown");
      const u = msg.usage;
      return {
        text,
        model,
        usage: {
          inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
          outputTokens: u.output_tokens ?? 0,
        },
      };
    } catch (e) {
      throw mapAnthropicError(e);
    }
  }
}

function toAnthropic(turn: ChatTurn): Anthropic.MessageParam {
  return {
    role: turn.role,
    content: turn.parts.map((p) =>
      p.type === "text"
        ? ({ type: "text", text: p.text } as const)
        : ({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.base64 } } as const),
    ),
  };
}

const BILLING_RE = /credit balance|billing|insufficient|quota|spend limit|usage limit/i;

export function mapAnthropicError(e: unknown): AIError {
  if (e instanceof AIError) return e;
  if (e instanceof Anthropic.APIConnectionTimeoutError) return new AIError("timeout", "timeout");
  if (e instanceof Anthropic.AuthenticationError) return new AIError("auth", "auth");
  if (e instanceof Anthropic.PermissionDeniedError) return new AIError("permission", BILLING_RE.test(e.message) ? "billing" : "auth");
  if (e instanceof Anthropic.RateLimitError) return new AIError("rate", BILLING_RE.test(e.message) ? "billing" : "rate");
  if (e instanceof Anthropic.BadRequestError) return new AIError("bad request", BILLING_RE.test(e.message) ? "billing" : "bad_request");
  if (e instanceof Anthropic.NotFoundError) return new AIError("model not found", "bad_request");
  if (e instanceof Anthropic.InternalServerError) return new AIError("overloaded", "overloaded");
  if (e instanceof Anthropic.APIConnectionError) return new AIError("network", "network");
  if (e instanceof Anthropic.APIError) {
    if (e.status === 402) return new AIError("billing", "billing");
    if (e.status === 529 || (e.status ?? 0) >= 500) return new AIError("overloaded", "overloaded");
    return new AIError(`api ${e.status}`, "unknown");
  }
  if (e instanceof Error && (e.name === "AbortError" || /timed? ?out/i.test(e.message))) return new AIError("timeout", "timeout");
  return new AIError("unknown", "unknown");
}

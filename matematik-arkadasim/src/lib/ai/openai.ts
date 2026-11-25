import "server-only";
import { AIError, remainingMs, type AIProvider, type ChatTurn, type CompletionRequest, type CompletionResult } from "./provider";

type FetchLike = typeof fetch;

/**
 * OpenAI sağlayıcısı (Chat Completions REST). OPENAI_BASE_URL ile uyumlu başka uç noktalara da yönlendirilebilir.
 * Geçici hatalarda (429 hız sınırı, 5xx, bağlantı) en fazla 1 kez yeniden dener.
 * Kota bitti (insufficient_quota) ayrı bir hata türüdür ve yeniden denenmez.
 */
export class OpenAIProvider implements AIProvider {
  readonly name: string;

  constructor(
    private apiKey: string,
    private model: string,
    private lightModel: string,
    private baseUrl: string,
    private fetchImpl: FetchLike = fetch,
    private retryDelayMs = 1500,
  ) {
    this.name = `OpenAI (${model})`;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    let lastError: AIError | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.once(req);
      } catch (e) {
        lastError = e instanceof AIError ? e : new AIError("unknown", "unknown");
        if (!lastError.retryable || attempt === 1) break;
        if (req.deadline && req.deadline - Date.now() < this.retryDelayMs + 8000) break;
        await new Promise((r) => setTimeout(r, this.retryDelayMs));
      }
    }
    throw lastError ?? new AIError("unknown", "unknown");
  }

  private async once(req: CompletionRequest): Promise<CompletionResult> {
    const model = req.light ? this.lightModel : this.model;
    const body = {
      model,
      max_completion_tokens: req.maxTokens,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: req.system }, ...req.messages.map(toOpenAI)],
    };
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(remainingMs(req.deadline, 55_000)),
      });
    } catch (e) {
      if (e instanceof AIError) throw e;
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) throw new AIError("timeout", "timeout");
      throw new AIError("network", "network");
    }
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: { code?: string; type?: string } } | null;
      const code = `${err?.error?.code ?? ""} ${err?.error?.type ?? ""}`;
      if (res.status === 401) throw new AIError("auth", "auth");
      if (res.status === 402 || /insufficient_quota|billing/.test(code)) throw new AIError("billing", "billing");
      if (res.status === 403) throw new AIError("forbidden", "auth");
      if (res.status === 429) throw new AIError("rate", "rate");
      if (res.status === 404) throw new AIError("model not found", "bad_request");
      if (res.status >= 500) throw new AIError("overloaded", "overloaded");
      throw new AIError(`HTTP ${res.status}`, "bad_request");
    }
    const json = (await res.json()) as {
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
    };
    const choice = json.choices?.[0];
    if (choice?.message?.refusal) throw new AIError("refusal", "refusal");
    if (choice?.finish_reason === "length") throw new AIError("truncated", "truncated");
    if (choice?.finish_reason === "content_filter") throw new AIError("refusal", "refusal");
    const text = choice?.message?.content ?? "";
    if (!text.trim()) throw new AIError("empty response", "unknown");
    return {
      text,
      model: json.model ?? model,
      usage: { inputTokens: json.usage?.prompt_tokens ?? 0, outputTokens: json.usage?.completion_tokens ?? 0 },
    };
  }
}

function toOpenAI(turn: ChatTurn) {
  return {
    role: turn.role,
    content: turn.parts.map((p) =>
      p.type === "text"
        ? { type: "text", text: p.text }
        : { type: "image_url", image_url: { url: `data:${p.mediaType};base64,${p.base64}`, detail: "high" } },
    ),
  };
}

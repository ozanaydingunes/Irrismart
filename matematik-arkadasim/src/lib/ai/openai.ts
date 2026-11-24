import "server-only";
import { AIError, type AIProvider, type ChatTurn, type CompletionRequest } from "./provider";

/**
 * OpenAI sağlayıcısı (Chat Completions REST). OPENAI_BASE_URL ile uyumlu başka uç noktalara da yönlendirilebilir.
 */
export class OpenAIProvider implements AIProvider {
  readonly name: string;

  constructor(private apiKey: string, private model: string, private baseUrl: string) {
    this.name = `OpenAI (${model})`;
  }

  async complete(req: CompletionRequest): Promise<string> {
    const body = {
      model: this.model,
      max_completion_tokens: req.maxTokens,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: req.system }, ...req.messages.map(toOpenAI)],
    };
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      throw new AIError("network", "network");
    }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new AIError("auth", "auth");
      if (res.status === 429) throw new AIError("rate", "rate");
      if (res.status >= 500) throw new AIError("overloaded", "overloaded");
      throw new AIError(`HTTP ${res.status}`, "bad_request");
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
    };
    const choice = json.choices?.[0];
    if (choice?.message?.refusal) throw new AIError("refusal", "refusal");
    if (choice?.finish_reason === "length") throw new AIError("truncated", "truncated");
    const text = choice?.message?.content ?? "";
    if (!text.trim()) throw new AIError("empty", "unknown");
    return text;
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

import "server-only";
import { AIError, remainingMs, type ChatTurn, type CompletionRequest, type CompletionResult } from "./provider";

/**
 * OpenAI uyumlu "chat/completions" uç noktaları için ortak çağrı (Cloudflare Workers AI, Groq).
 * Hata kodlarını sağlayıcıdan bağımsız AIError türlerine çevirir. Ücretsiz kota bittiğinde
 * "quota" döner; ücretli plana geçmek gibi bir seçenek YOKTUR.
 */

export type FetchLike = typeof fetch;

export interface CompatCall {
  url: string;
  apiKey: string;
  body: Record<string, unknown>;
  timeoutCapMs: number;
  fetchImpl: FetchLike;
  /** Sağlayıcıya özel ek hata eşlemesi (ör. Cloudflare 4006 = günlük ücretsiz kota bitti) */
  classify?: (status: number, errorText: string) => AIError | null;
}

export function toCompatMessages(system: string, messages: ChatTurn[]) {
  return [
    { role: "system", content: system },
    ...messages.map((turn) => {
      // Yalnızca metin içeren mesajlar düz metin olarak gönderilir (bazı modeller dizi biçimini sevmez)
      if (turn.parts.every((p) => p.type === "text")) return { role: turn.role, content: turn.parts.map((p) => (p.type === "text" ? p.text : "")).join("\n\n") };
      return {
        role: turn.role,
        content: turn.parts.map((p) => (p.type === "text" ? { type: "text", text: p.text } : { type: "image_url", image_url: { url: `data:${p.mediaType};base64,${p.base64}` } })),
      };
    }),
  ];
}

export async function compatComplete(call: CompatCall, req: CompletionRequest, model: string): Promise<CompletionResult> {
  let res: Response;
  try {
    res = await call.fetchImpl(call.url, {
      method: "POST",
      headers: { authorization: `Bearer ${call.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(call.body),
      signal: AbortSignal.timeout(remainingMs(req.deadline, call.timeoutCapMs)),
    });
  } catch (e) {
    if (e instanceof AIError) throw e;
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) throw new AIError("timeout", "timeout");
    throw new AIError("network", "network");
  }
  if (!res.ok) {
    const errText = (await res.text().catch(() => "")).slice(0, 2000);
    const special = call.classify?.(res.status, errText);
    if (special) throw special;
    if (res.status === 401 || res.status === 403) throw new AIError("auth", "auth");
    if (res.status === 402) throw new AIError("billing", "billing");
    if (res.status === 413) throw new AIError("request too large for free tier", "rate");
    if (res.status === 429) throw new AIError("rate", "rate");
    if (res.status === 404) throw new AIError("model not found", "bad_request");
    if (res.status >= 500) throw new AIError("overloaded", "overloaded");
    throw new AIError(`HTTP ${res.status}`, "bad_request");
  }
  const json = (await res.json().catch(() => null)) as {
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
  } | null;
  const choice = json?.choices?.[0];
  if (choice?.message?.refusal) throw new AIError("refusal", "refusal");
  if (choice?.finish_reason === "content_filter") throw new AIError("refusal", "refusal");
  if (choice?.finish_reason === "length") throw new AIError("truncated", "truncated");
  const text = choice?.message?.content ?? "";
  if (!text.trim()) throw new AIError("empty response", "unknown");
  return {
    text,
    model: json?.model ?? model,
    usage: { inputTokens: json?.usage?.prompt_tokens ?? 0, outputTokens: json?.usage?.completion_tokens ?? 0 },
  };
}

/** Geçici hatalarda (5xx, bağlantı) süre yetiyorsa bir kez yeniden dener. Kota/yetki hatalarında denemez. */
export async function withOneRetry(req: CompletionRequest, fn: () => Promise<CompletionResult>, delayMs = 1500): Promise<CompletionResult> {
  try {
    return await fn();
  } catch (e) {
    const err = e instanceof AIError ? e : new AIError("unknown", "unknown");
    const transient = err.kind === "overloaded" || err.kind === "network";
    if (!transient || (req.deadline && req.deadline - Date.now() < delayMs + 15_000)) throw err;
    await new Promise((r) => setTimeout(r, delayMs));
    return fn();
  }
}

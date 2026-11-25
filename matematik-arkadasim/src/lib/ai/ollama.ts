import "server-only";
import { AIError, remainingMs, type AIProvider, type ChatTurn, type CompletionRequest, type CompletionResult } from "./provider";

type FetchLike = typeof fetch;

/**
 * Ollama sağlayıcısı: ücretsiz, yerel (evdeki bilgisayarda çalışan) açık modeller.
 * Sorular ve fotoğraflar evden dışarı çıkmaz; kota, yaş sınırı ve ücret yoktur.
 * API: POST {OLLAMA_BASE_URL}/api/chat — görseller base64 "images" dizisiyle, JSON modu `format: "json"`.
 * Hiçbir durumda ücretli bir sağlayıcıya geçiş yapılmaz.
 */
export class OllamaProvider implements AIProvider {
  readonly name: string;
  /** Yerel model yavaş olabileceği için istek bütçesi daha uzundur */
  readonly timeBudgetMs: number;

  constructor(
    private baseUrl: string,
    private model: string,
    private lightModel: string,
    timeoutMs: number,
    private authHeader = "",
    private fetchImpl: FetchLike = fetch,
  ) {
    this.name = `Ollama — yerel ücretsiz model (${model})`;
    this.timeBudgetMs = timeoutMs;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json" };
    const i = this.authHeader.indexOf(":");
    if (i > 0) h[this.authHeader.slice(0, i).trim()] = this.authHeader.slice(i + 1).trim();
    return h;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const model = req.light ? this.lightModel : this.model;
    const body = {
      model,
      stream: false,
      format: "json",
      keep_alive: "15m",
      options: { temperature: 0.2, num_ctx: 16384, num_predict: Math.min(req.maxTokens, 8192) },
      messages: [{ role: "system", content: req.system }, ...req.messages.map(toOllama)],
    };
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(remainingMs(req.deadline, this.timeBudgetMs)),
      });
    } catch (e) {
      if (e instanceof AIError) throw e;
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) throw new AIError("timeout", "timeout");
      // Bağlantı kurulamadı: bilgisayar kapalı, Ollama çalışmıyor veya adres yanlış
      throw new AIError("local model unreachable", "unavailable");
    }
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      const msg = err?.error ?? "";
      if (res.status === 404 || /not found|pull/i.test(msg)) throw new AIError("model not installed", "model_missing");
      if (res.status === 401 || res.status === 403) throw new AIError("forbidden", "auth");
      if (res.status >= 500) throw new AIError(/memory|out of memory/i.test(msg) ? "out of memory" : "local model error", "overloaded");
      throw new AIError(`HTTP ${res.status}`, "bad_request");
    }
    const json = (await res.json()) as { message?: { content?: string }; done_reason?: string; prompt_eval_count?: number; eval_count?: number };
    if (json.done_reason === "length") throw new AIError("truncated", "truncated");
    const text = json.message?.content ?? "";
    if (!text.trim()) throw new AIError("empty response", "unknown");
    return { text, model: `ollama:${model}`, usage: { inputTokens: json.prompt_eval_count ?? 0, outputTokens: json.eval_count ?? 0 } };
  }

  /** Ollama çalışıyor mu ve model indirilmiş mi? (durum sayfası için, kısa zaman aşımı) */
  async health(): Promise<{ reachable: boolean; modelInstalled: boolean }> {
    try {
      const r = await this.fetchImpl(`${this.baseUrl}/api/tags`, { headers: this.headers(), signal: AbortSignal.timeout(2500), cache: "no-store" });
      if (!r.ok) return { reachable: false, modelInstalled: false };
      const j = (await r.json()) as { models?: { name?: string; model?: string }[] };
      const names = (j.models ?? []).flatMap((m) => [m.name, m.model]).filter(Boolean) as string[];
      const want = (n: string) => names.some((x) => x === n || x === `${n}:latest`);
      return { reachable: true, modelInstalled: want(this.model) };
    } catch {
      return { reachable: false, modelInstalled: false };
    }
  }
}

function toOllama(turn: ChatTurn) {
  const text = turn.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n\n");
  const images = turn.parts.filter((p) => p.type === "image").map((p) => (p as { base64: string }).base64);
  return { role: turn.role, content: text, ...(images.length ? { images } : {}) };
}

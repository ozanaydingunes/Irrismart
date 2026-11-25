import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OllamaProvider } from "@/lib/ai/ollama";
import { estimateCostUsd } from "@/lib/ai/pricing";
import type { CompletionRequest } from "@/lib/ai/provider";
import { getProvider, solveQuestion } from "@/lib/ai/service";
import { DEMO_SAMPLES } from "@/lib/demo/samples";
import { getConfig } from "@/lib/server/config";
import { dailyQuestionLimit, questionAllowed, questionDay, recordQuestion, setDailyQuestionLimit } from "@/lib/server/quota";
import { FileStore, MemoryStore, setStore } from "@/lib/server/store";

const req: CompletionRequest = { system: "sistem", messages: [{ role: "user", parts: [{ type: "image", mediaType: "image/jpeg", base64: "QUJD" }, { type: "text", text: "soru" }] }], maxTokens: 16000 };

function fakeFetch(responses: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit; body: Record<string, unknown> }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, body: init.body ? JSON.parse(String(init.body)) : {} });
    const r = responses.shift();
    if (!r) throw new Error("beklenmeyen çağrı");
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  return { fn, calls };
}
const okChat = (content: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ model: "gemma4:e4b", message: { role: "assistant", content }, done: true, done_reason: "stop", prompt_eval_count: 900, eval_count: 400, ...extra }), { status: 200 });

describe("Sıfır maliyet yapılandırması", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("varsayılan sağlayıcı ücretsiz yerel Ollama; günlük soru sınırı 10", () => {
    vi.stubEnv("AI_PROVIDER", "");
    const c = getConfig();
    expect(c.provider).toBe("ollama");
    expect(c.paidAllowed).toBe(false);
    expect(c.limits.dailyQuestions).toBe(10);
    expect(getProvider(c)).toBeInstanceOf(OllamaProvider);
  });

  it("ücretli anahtar tanımlı olsa bile ALLOW_PAID_AI=1 olmadan ücretli sağlayıcı KULLANILMAZ", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    for (const p of ["anthropic", "openai"]) {
      vi.stubEnv("AI_PROVIDER", p);
      const c = getConfig();
      expect(c.provider).toBe("demo");
      expect(getProvider(c)).toBeNull();
    }
    vi.stubEnv("AI_PROVIDER", "");
    expect(getConfig().provider).toBe("ollama"); // anahtar var diye ücretliye geçmez
  });

  it("ücretli seslendirme varsayılan olarak kapalı", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("TTS_PROVIDER", "openai");
    expect(getConfig().tts.provider).toBe("none");
  });

  it("yerel model ücretsiz sayılır (harcama sayacı artmaz)", () => {
    expect(estimateCostUsd("ollama:gemma4:e4b", 1_000_000, 1_000_000)).toBe(0);
  });

  it("Gemini sağlayıcısı etkin değil (şartlar 18 yaş altını yasaklıyor)", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    expect(getConfig().provider).toBe("demo");
  });
});

describe("Ollama sağlayıcısı", () => {
  it("istek biçimi: system + kullanıcı mesajı, base64 görseller, JSON modu, akış kapalı", async () => {
    const { fn, calls } = fakeFetch([okChat('{"a":1}')]);
    const p = new OllamaProvider("http://127.0.0.1:11434", "gemma4:e4b", "gemma4:e4b", 300_000, "", fn);
    const r = await p.complete(req);
    expect(calls[0].url).toBe("http://127.0.0.1:11434/api/chat");
    expect(calls[0].body).toMatchObject({ model: "gemma4:e4b", stream: false, format: "json" });
    const msgs = calls[0].body.messages as { role: string; content: string; images?: string[] }[];
    expect(msgs[0]).toEqual({ role: "system", content: "sistem" });
    expect(msgs[1]).toEqual({ role: "user", content: "soru", images: ["QUJD"] });
    expect(r).toEqual({ text: '{"a":1}', model: "ollama:gemma4:e4b", usage: { inputTokens: 900, outputTokens: 400 } });
  });
  it("hafif görevlerde hafif model; yetki başlığı iletilir", async () => {
    const { fn, calls } = fakeFetch([okChat("{}")]);
    await new OllamaProvider("http://x", "big", "small", 300_000, "X-Erisim: gizli", fn).complete({ ...req, light: true });
    expect(calls[0].body.model).toBe("small");
    expect((calls[0].init.headers as Record<string, string>)["X-Erisim"]).toBe("gizli");
  });
  it.each([
    [new TypeError("fetch failed"), "unavailable"],
    [Object.assign(new Error("t"), { name: "TimeoutError" }), "timeout"],
    [new Response(JSON.stringify({ error: 'model "gemma4:e4b" not found, try pulling it first' }), { status: 404 }), "model_missing"],
    [new Response(JSON.stringify({ error: "model requires more system memory" }), { status: 500 }), "overloaded"],
  ] as const)("hata eşlemesi → %s", async (resp, kind) => {
    const { fn } = fakeFetch([resp as Response | Error]);
    await expect(new OllamaProvider("http://x", "m", "m", 300_000, "", fn).complete(req)).rejects.toMatchObject({ kind });
  });
  it("yarıda kesilen yanıt → truncated", async () => {
    const { fn } = fakeFetch([okChat("{", { done_reason: "length" })]);
    await expect(new OllamaProvider("http://x", "m", "m", 300_000, "", fn).complete(req)).rejects.toMatchObject({ kind: "truncated" });
  });
  it("durum kontrolü: model indirilmiş mi?", async () => {
    const a = fakeFetch([new Response(JSON.stringify({ models: [{ name: "gemma4:e4b" }] }), { status: 200 })]);
    expect(await new OllamaProvider("http://x", "gemma4:e4b", "gemma4:e4b", 1, "", a.fn).health()).toEqual({ reachable: true, modelInstalled: true });
    const b = fakeFetch([new Response(JSON.stringify({ models: [{ name: "gemma3:4b" }] }), { status: 200 })]);
    expect(await new OllamaProvider("http://x", "gemma4:e4b", "gemma4:e4b", 1, "", b.fn).health()).toEqual({ reachable: true, modelInstalled: false });
    const c = fakeFetch([new TypeError("fetch failed")]);
    expect(await new OllamaProvider("http://x", "m", "m", 1, "", c.fn).health()).toEqual({ reachable: false, modelInstalled: false });
  });
  it("uzun yerel süre bütçesi kullanılır", () => {
    expect(new OllamaProvider("http://x", "m", "m", 300_000).timeBudgetMs).toBe(300_000);
  });
});

describe("Ücretsiz model başarısız olunca ücretliye GEÇİLMEZ", () => {
  it("Ollama kapalıysa tek deneme, Türkçe 'bilgisayar kapalı' mesajı", async () => {
    const { fn, calls } = fakeFetch([new TypeError("fetch failed")]);
    const p = new OllamaProvider("http://x", "m", "m", 300_000, "", fn);
    const r = await solveQuestion({ text: "2x+5=15", mode: "full" }, { provider: p, onUsage: () => {} });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/ev bilgisayarına ulaşılamadı/);
    expect(calls).toHaveLength(1);
    expect(calls.every((c) => c.url.startsWith("http://x"))).toBe(true);
  });
  it("Ollama yanıtı geçerliyse çözüm 'ai' kaynaklı ve doğrulanmış", async () => {
    const { fn } = fakeFetch([okChat(JSON.stringify({ status: "ok", solution: DEMO_SAMPLES[1].solution }))]);
    const r = await solveQuestion({ text: "soru", mode: "full" }, { provider: new OllamaProvider("http://x", "m", "m", 300_000, "", fn), onUsage: () => {} });
    expect(r.ok && r.source).toBe("ai");
    expect(r.ok && r.issues).toEqual([]);
  });
});

describe("Kalıcı dosya deposu (ev bilgisayarı)", () => {
  let dir: string;
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), "ma-"))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("sunucu yeniden başlasa da sayaç korunur; süresi dolan silinir", async () => {
    let t = 1_000_000;
    const f = join(dir, "sayaclar.json");
    const a = new FileStore(f, () => t);
    await a.incr("k", 1, 60);
    await a.incr("k", 2, 60);
    const b = new FileStore(f, () => t); // "yeniden başlatma"
    expect(await b.get("k")).toBe(3);
    t += 61_000;
    expect(await b.get("k")).toBe(0);
    expect(readFileSync(f, "utf8")).not.toMatch(/\d+\.\d+\.\d+\.\d+/); // IP gibi kişisel veri yok
  });
  it("eşzamanlı artırmalar kaybolmaz", async () => {
    const s = new FileStore(join(dir, "s.json"));
    await Promise.all(Array.from({ length: 20 }, () => s.incr("x", 1, 60)));
    expect(await s.get("x")).toBe(20);
  });
});

describe("Günlük soru sınırı", () => {
  it("varsayılan 10; ebeveyn değiştirebilir; 0 = sınırsız", async () => {
    const st = new MemoryStore();
    expect(await dailyQuestionLimit(st, 10)).toBe(10);
    await setDailyQuestionLimit(st, 3);
    expect(await dailyQuestionLimit(st, 10)).toBe(3);
    await setDailyQuestionLimit(st, 0);
    expect(await dailyQuestionLimit(st, 10)).toBe(0);
    expect((await questionAllowed(st, 0)).allowed).toBe(true);
  });
  it("sınır dolunca yeni soruya izin verilmez; ertesi gün sıfırlanır", async () => {
    const st = new MemoryStore();
    const t = Date.UTC(2026, 10, 25, 10);
    for (let i = 0; i < 3; i++) {
      expect((await questionAllowed(st, 3, t)).allowed).toBe(true);
      await recordQuestion(st, t);
    }
    expect((await questionAllowed(st, 3, t)).allowed).toBe(false);
    expect((await questionAllowed(st, 3, t + 86400_000)).allowed).toBe(true);
  });
  it("gün Türkiye saatine göre döner (UTC 21:30 = TR 00:30 ertesi gün)", () => {
    expect(questionDay(Date.UTC(2026, 10, 25, 21, 30))).toBe("2026-11-26");
    expect(questionDay(Date.UTC(2026, 10, 25, 20, 30))).toBe("2026-11-25");
  });
});

describe("API: günlük soru sınırı ve ebeveyn ayarı (sunucu tarafında)", () => {
  beforeEach(() => {
    setStore(new MemoryStore());
    vi.stubEnv("AI_PROVIDER", "mock");
    vi.stubEnv("ALLOW_MOCK_PROVIDER", "1");
    vi.stubEnv("DAILY_QUESTION_LIMIT", "2");
    vi.stubEnv("RATE_LIMIT_PER_MINUTE", "100");
    vi.stubEnv("APP_ACCESS_PIN", "");
    vi.stubEnv("PARENT_PIN", "9753");
  });
  afterEach(() => vi.unstubAllEnvs());
  const post = (url: string, body: unknown) => new Request(url, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "10.0.0.1" }, body: JSON.stringify(body) });

  it("2 başarılı sorudan sonra üçüncüsü reddedilir; başarısız çözüm hak düşürmez", async () => {
    const { POST } = await import("@/app/api/solve/route");
    const bad = await (await POST(post("http://x/api/solve", { text: "[test:unreadable] yarım", mode: "full" }))).json();
    expect(bad.code).toBe("UNREADABLE");
    const r1 = await (await POST(post("http://x/api/solve", { text: "2x+5=15", mode: "full" }))).json();
    expect(r1.ok && r1.questionsUsed).toBe(1);
    const r2 = await (await POST(post("http://x/api/solve", { text: "3x=9", mode: "full" }))).json();
    expect(r2.questionsUsed).toBe(2);
    const r3 = await POST(post("http://x/api/solve", { text: "4x=8", mode: "full" }));
    expect(r3.status).toBe(429);
    expect((await r3.json()).message).toMatch(/2 soru hakkın doldu/);
  });

  it("ebeveyn PIN'i yanlışsa ayar değişmez; doğruysa yeni sınır durum bilgisinde görünür", async () => {
    const { POST } = await import("@/app/api/parent/route");
    const { GET } = await import("@/app/api/status/route");
    expect((await POST(post("http://x/api/parent", { pin: "1111", dailyQuestions: 50 }))).status).toBe(401);
    const ok = await POST(post("http://x/api/parent", { pin: "9753", dailyQuestions: 5 }));
    expect(ok.status).toBe(200);
    const st = await (await GET(new Request("http://x/api/status"))).json();
    expect(st.dailyQuestionLimit).toBe(5);
    expect(st.parentPinSet).toBe(true);
    expect(st.paidAllowed).toBe(false);
    expect(JSON.stringify(st)).not.toContain("9753");
  });

  it("5 yanlış ebeveyn PIN denemesinden sonra kilitlenir", async () => {
    const { POST } = await import("@/app/api/parent/route");
    for (let i = 0; i < 5; i++) await POST(post("http://x/api/parent", { pin: "0000", dailyQuestions: 1 }));
    expect((await POST(post("http://x/api/parent", { pin: "9753", dailyQuestions: 1 }))).status).toBe(429);
  });

  it("ebeveyn PIN'i tanımlı değilse ayar değiştirilemez", async () => {
    vi.stubEnv("PARENT_PIN", "");
    const { POST } = await import("@/app/api/parent/route");
    expect((await POST(post("http://x/api/parent", { pin: "x", dailyQuestions: 99 }))).status).toBe(403);
  });
});

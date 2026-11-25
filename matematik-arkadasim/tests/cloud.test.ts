import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudflareProvider } from "@/lib/ai/cloudflare";
import { FreeProviderChain, freeDay, isExhausted, neuronsFor, recordFreeUsage, type FreeEntry } from "@/lib/ai/freeChain";
import { GroqProvider } from "@/lib/ai/groq";
import type { CompletionRequest } from "@/lib/ai/provider";
import { getProvider, LOCAL_PROVIDER, practice, solveQuestion, tutor } from "@/lib/ai/service";
import { DEMO_SAMPLES } from "@/lib/demo/samples";
import { getConfig } from "@/lib/server/config";
import { FileStore, MemoryStore, setStore, type CounterStore } from "@/lib/server/store";
import { textToSpeech } from "@/lib/speech/mathToSpeech";

/* ───── Yardımcılar: sahte Cloudflare / Groq uç noktaları (testlerde gerçek ağ çağrısı yok) ───── */

type Reply = Response | Error;
function fakeFetch(responses: Reply[]) {
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : {} });
    const r = responses.shift();
    if (!r) throw new Error("beklenmeyen çağrı");
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  return { fn, calls };
}
const chatOk = (content: unknown, usage = { prompt_tokens: 4000, completion_tokens: 2000 }, finish = "stop") =>
  new Response(JSON.stringify({ model: "m", choices: [{ message: { role: "assistant", content: typeof content === "string" ? content : JSON.stringify(content) }, finish_reason: finish }], usage }), { status: 200 });
const cfQuotaError = () =>
  new Response(JSON.stringify({ success: false, errors: [{ code: 4006, message: "AiError: You have used up your daily free allocation of 10,000 neurons. Please upgrade to Cloudflare's Workers Paid plan if you would like to continue usage." }] }), { status: 429 });

const SAMPLE = DEMO_SAMPLES[1].solution; // 3x + 4 = 25
const okEnvelope = { status: "ok", solution: SAMPLE };
const IMG = { mediaType: "image/jpeg" as const, base64: "QUJDRA==", bytes: 4 };
const SCOUT = "@cf/meta/llama-4-scout-17b-16e-instruct";

function cf(fetchImpl: typeof fetch, model = SCOUT) {
  return new CloudflareProvider("hesap123", "cf-token", model, model, "https://cf.test/client/v4", fetchImpl);
}
function groq(fetchImpl: typeof fetch) {
  return new GroqProvider("gsk-test", "qwen/qwen3.8-27b", "https://groq.test/openai/v1", fetchImpl);
}
function chain(store: CounterStore, cfFetch: typeof fetch, groqFetch?: typeof fetch, neurons = 9000) {
  const entries: FreeEntry[] = [{ kind: "cloudflare", provider: cf(cfFetch), budget: { neurons } }];
  if (groqFetch) entries.push({ kind: "groq", provider: groq(groqFetch), budget: { requests: 900, tokens: 180000 } });
  return new FreeProviderChain(entries, store);
}
const deps = (provider: FreeProviderChain) => ({ provider, onUsage: () => {}, localSolverFirst: false });

/* ───── Yapılandırma ───── */

describe("Yapılandırma: Cloudflare varsayılan, ücretli asla", () => {
  afterEach(() => vi.unstubAllEnvs());
  const cfEnv = () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "hesap123");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token");
  };

  it("AI_PROVIDER boşsa ve Cloudflare bilgileri varsa Cloudflare (Llama 4 Scout, görsel destekli) kullanılır", () => {
    vi.stubEnv("AI_PROVIDER", "");
    cfEnv();
    const c = getConfig();
    expect(c.provider).toBe("cloudflare");
    expect(c.cloudflare.model).toBe(SCOUT);
    expect(getProvider(c)).toBeInstanceOf(FreeProviderChain);
  });
  it("Cloudflare bilgileri eksikse demo (sessizce başka sağlayıcıya geçilmez)", () => {
    vi.stubEnv("AI_PROVIDER", "cloudflare");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant");
    vi.stubEnv("ALLOW_PAID_AI", "1");
    expect(getConfig().provider).toBe("demo");
  });
  it("nöron bütçesi ücretsiz 10.000'in altında güvenlik paylı (varsayılan 9.000, en fazla 10.000)", () => {
    expect(getConfig().cloudflare.dailyNeuronBudget).toBe(9000);
    vi.stubEnv("CLOUDFLARE_DAILY_NEURON_BUDGET", "50000");
    expect(getConfig().cloudflare.dailyNeuronBudget).toBe(10000);
  });
  it("yedek listesine ücretli sağlayıcı yazılsa bile zincire YALNIZCA ücretsiz sağlayıcılar girer", () => {
    cfEnv();
    vi.stubEnv("GROQ_API_KEY", "gsk");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant");
    vi.stubEnv("OPENAI_API_KEY", "sk");
    vi.stubEnv("ALLOW_PAID_AI", "1");
    vi.stubEnv("AI_FALLBACK_PROVIDERS", "anthropic, openai, groq");
    const c = getConfig();
    expect(c.freeFallbacks).toEqual(["groq"]);
    const p = getProvider(c) as FreeProviderChain;
    expect(p.entries.map((e) => e.kind)).toEqual(["cloudflare", "groq"]);
  });
  it("Groq anahtarı yoksa yedek yok", () => {
    cfEnv();
    vi.stubEnv("GROQ_API_KEY", "");
    expect(getConfig().freeFallbacks).toEqual([]);
  });
});

/* ───── Cloudflare sağlayıcısı ───── */

describe("Cloudflare Workers AI sağlayıcısı", () => {
  it("istek biçimi: hesap kimlikli OpenAI uyumlu uç, Bearer token, data: URI görsel, JSON modu", async () => {
    const f = fakeFetch([chatOk(okEnvelope)]);
    const req: CompletionRequest = { system: "sistem", messages: [{ role: "user", parts: [{ type: "image", mediaType: IMG.mediaType, base64: IMG.base64 }, { type: "text", text: "soru" }] }], maxTokens: 16000 };
    const r = await cf(f.fn).complete(req);
    expect(f.calls[0].url).toBe("https://cf.test/client/v4/accounts/hesap123/ai/v1/chat/completions");
    expect(f.calls[0].headers.authorization).toBe("Bearer cf-token");
    const b = f.calls[0].body as { model: string; response_format: unknown; messages: { role: string; content: unknown }[] };
    expect(b.model).toBe(SCOUT);
    expect(b.response_format).toEqual({ type: "json_object" });
    expect(b.messages[0]).toEqual({ role: "system", content: "sistem" });
    expect(b.messages[1].content).toEqual([{ type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJDRA==" } }, { type: "text", text: "soru" }]);
    expect(r.usage).toEqual({ inputTokens: 4000, outputTokens: 2000 });
  });
  it("görsel içeren istek hafif modele gitmez", () => {
    const p = new CloudflareProvider("a", "t", SCOUT, "@cf/mistralai/mistral-small-3.1-24b-instruct");
    expect(p.modelFor({ light: true, messages: [{ role: "user", parts: [{ type: "image", mediaType: IMG.mediaType, base64: IMG.base64 }] }] })).toBe(SCOUT);
    expect(p.modelFor({ light: true, messages: [{ role: "user", parts: [{ type: "text", text: "x" }] }] })).toContain("mistral");
  });
  it("API anahtarı tokenı yanıt veya hata mesajında görünmez", async () => {
    const f = fakeFetch([new Response(JSON.stringify({ errors: [{ code: 10000, message: "Authentication error" }] }), { status: 401 })]);
    const r = await solveQuestion({ text: "Bir sayının 3 katının 4 fazlası 25'tir.", mode: "full" }, deps(chain(new MemoryStore(), f.fn)));
    expect(JSON.stringify(r)).not.toContain("cf-token");
  });
});

/* ───── Çözüm akışı: doğrulama, okunamayan fotoğraf, Türkçe anlatım ───── */

describe("Cloudflare ile soru çözme", () => {
  it("fotoğraflı soru: geçerli JSON → doğrulanmış yapay zekâ çözümü", async () => {
    const f = fakeFetch([chatOk(okEnvelope)]);
    const r = await solveQuestion({ image: IMG, mode: "full" }, deps(chain(new MemoryStore(), f.fn)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.source).toBe("ai");
    expect(r.provider).toContain("Cloudflare");
    expect(r.issues).toEqual([]);
    expect(f.calls).toHaveLength(1);
  });
  it("okunamayan fotoğrafta çözüm uydurulmaz", async () => {
    const f = fakeFetch([chatOk({ status: "unreadable", message: "Fotoğraf bulanık, daha net çeker misin?" })]);
    const r = await solveQuestion({ image: IMG, mode: "full" }, deps(chain(new MemoryStore(), f.fn)));
    expect(r).toMatchObject({ ok: false, code: "UNREADABLE" });
  });
  it("şemaya uymayan JSON → bir onarım denemesi; yine bozuksa çözüm gösterilmez", async () => {
    const f = fakeFetch([chatOk({ status: "ok", solution: { question: "eksik" } }), chatOk("bu json değil")]);
    const r = await solveQuestion({ text: "Bir sayının 3 katının 4 fazlası 25'tir.", mode: "full" }, deps(chain(new MemoryStore(), f.fn)));
    expect(r).toMatchObject({ ok: false, code: "INVALID_AI_OUTPUT" });
    expect(f.calls).toHaveLength(2);
  });
  it("matematiksel doğrulama: modelin yanlış aritmetiği kesin hesapla yakalanır", async () => {
    const wrong = structuredClone(SAMPLE);
    wrong.steps = wrong.steps.map((s) => ({ ...s, latex: s.latex.replace("21 + 4 = 25", "21 + 4 = 26") }));
    const f = fakeFetch([chatOk({ status: "ok", solution: wrong })]);
    const r = await solveQuestion({ text: "Bir sayının 3 katının 4 fazlası 25'tir.", mode: "full" }, deps(chain(new MemoryStore(), f.fn)));
    expect(r.ok && r.issues.length).toBeGreaterThan(0);
  });
  it("Türkçe öğretmen anlatımı korunur; seslendirmede LaTeX okunmaz", async () => {
    const f = fakeFetch([chatOk(okEnvelope)]);
    const r = await solveQuestion({ text: "Bir sayının 3 katının 4 fazlası 25'tir.", mode: "full" }, deps(chain(new MemoryStore(), f.fn)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const s of r.solution.steps) {
      const spoken = textToSpeech(s.narration);
      expect(spoken).not.toMatch(/\\[a-z]+|[{}]/);
      expect(spoken.length).toBeGreaterThan(5);
    }
    expect(r.solution.finalAnswer.narration).toMatch(/yedi/);
  });
  it("ek açıklama (Anlamadım) ve ipucu da Cloudflare üzerinden çalışır", async () => {
    const reply = { message: "Hiç sorun değil, terazi gibi düşünelim.", narration: "Hiç sorun değil, terazi gibi düşünelim.", steps: [] };
    const f = fakeFetch([chatOk(reply), chatOk(reply)]);
    const c = chain(new MemoryStore(), f.fn);
    for (const action of ["dont_understand", "hint"] as const) {
      const r = await tutor({ solution: SAMPLE, stepIndex: 1, action, history: [] }, deps(c));
      expect(r.ok && r.source).toBe("ai");
    }
  });
  it("güvenlik reddi başka sağlayıcıya GÖNDERİLMEZ", async () => {
    const cfF = fakeFetch([chatOk("", undefined, "content_filter")]);
    const gF = fakeFetch([chatOk(okEnvelope)]);
    const r = await solveQuestion({ text: "uygunsuz istek", mode: "full" }, deps(chain(new MemoryStore(), cfF.fn, gF.fn)));
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.message).toMatch(/yardımcı olamıyorum/);
    expect(gF.calls).toHaveLength(0);
  });
  it("geçersiz API token: açık Türkçe mesaj, yedeğe veya ücretliye geçilmez", async () => {
    const cfF = fakeFetch([new Response(JSON.stringify({ errors: [{ code: 10000, message: "Authentication error" }] }), { status: 401 })]);
    const gF = fakeFetch([chatOk(okEnvelope)]);
    const r = await solveQuestion({ text: "Bir sayının 3 katının 4 fazlası 25'tir.", mode: "full" }, deps(chain(new MemoryStore(), cfF.fn, gF.fn)));
    expect(!r.ok && r.message).toMatch(/API anahtarı geçersiz/);
    expect(gF.calls).toHaveLength(0);
    expect(cfF.calls).toHaveLength(1);
  });
});

/* ───── Ücretsiz kota ve sağlayıcılar arası geçiş ───── */

describe("Ücretsiz kota dolunca", () => {
  it("Cloudflare 4006 (günlük ücretsiz kota bitti) → onaylı ücretsiz yedek Groq'a geçilir", async () => {
    const store = new MemoryStore();
    const cfF = fakeFetch([cfQuotaError()]);
    const gF = fakeFetch([chatOk(okEnvelope), chatOk(okEnvelope)]);
    const c = chain(store, cfF.fn, gF.fn);
    const r = await solveQuestion({ image: IMG, mode: "full" }, deps(c));
    expect(r.ok && r.provider).toContain("Groq");
    expect(await isExhausted(store, "cloudflare")).toBe(true);
    // Aynı gün sonraki istek Cloudflare'i hiç denemez (gereksiz istek yok)
    await solveQuestion({ image: IMG, mode: "full" }, deps(chain(store, cfF.fn, gF.fn)));
    expect(cfF.calls).toHaveLength(1);
    const gb = gF.calls[0].body as { reasoning_effort: string; max_completion_tokens: number; response_format: unknown };
    expect(gb.reasoning_effort).toBe("none");
    expect(gb.max_completion_tokens).toBeLessThanOrEqual(4000);
    expect(gb.response_format).toEqual({ type: "json_object" });
  });
  it("tüm ücretsiz sağlayıcılar dolunca anlaşılır Türkçe mesaj; ücretli sağlayıcı çağrılmaz", async () => {
    const cfF = fakeFetch([cfQuotaError()]);
    const gF = fakeFetch([new Response(JSON.stringify({ error: { message: "Rate limit reached on tokens per day (TPD): Limit 200000", code: "rate_limit_exceeded" } }), { status: 429 })]);
    const paid = vi.fn();
    vi.stubGlobal("fetch", paid);
    try {
      const r = await solveQuestion({ image: IMG, mode: "full" }, deps(chain(new MemoryStore(), cfF.fn, gF.fn)));
      expect(r).toMatchObject({ ok: false, code: "AI_ERROR" });
      expect(!r.ok && r.message).toMatch(/bugünkü ücretsiz yapay zekâ kapasitesi doldu/);
      expect(paid).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("dakikalık geçici sınır kalıcı 'doldu' sayılmaz; yoğunluk mesajı verilir", async () => {
    const store = new MemoryStore();
    const cfF = fakeFetch([new Response("{}", { status: 503 }), new Response("{}", { status: 503 })]);
    const gF = fakeFetch([new Response(JSON.stringify({ error: { message: "Rate limit reached on tokens per minute (TPM)" } }), { status: 429 })]);
    const r = await solveQuestion({ image: IMG, mode: "full" }, deps(chain(store, cfF.fn, gF.fn)));
    expect(!r.ok && r.message).toMatch(/yoğun/);
    expect(await isExhausted(store, "groq")).toBe(false);
    expect(await isExhausted(store, "cloudflare")).toBe(false);
  });
  it("güvenlik payı: bütçe bu isteğe yetmiyorsa Cloudflare'e istek gönderilmeden yedeğe geçilir", async () => {
    const store = new MemoryStore();
    await store.incr(`ucretsiz:cloudflare:noron:${freeDay()}`, 8900, 3 * 86400);
    const cfF = fakeFetch([]);
    const gF = fakeFetch([chatOk(okEnvelope)]);
    const r = await solveQuestion({ image: IMG, mode: "full" }, deps(chain(store, cfF.fn, gF.fn)));
    expect(r.ok).toBe(true);
    expect(cfF.calls).toHaveLength(0);
  });
  it("nöron tüketimi gerçek jeton sayısından resmî oranlarla hesaplanır", async () => {
    expect(neuronsFor(SCOUT, 4000, 2000)).toBe(Math.ceil((4000 * 24545 + 2000 * 77273) / 1e6));
    expect(neuronsFor("@cf/bilinmeyen/model", 1000, 1000)).toBeGreaterThan(neuronsFor(SCOUT, 1000, 1000));
    const store = new MemoryStore();
    const e: FreeEntry = { kind: "cloudflare", provider: cf(fakeFetch([]).fn), budget: { neurons: 9000 } };
    const req: CompletionRequest = { system: "s", messages: [{ role: "user", parts: [{ type: "text", text: "x" }] }], maxTokens: 100 };
    await recordFreeUsage(store, e, req, { text: "{}", model: SCOUT, usage: { inputTokens: 4000, outputTokens: 2000 } });
    expect(await store.get(`ucretsiz:cloudflare:noron:${freeDay()}`)).toBe(neuronsFor(SCOUT, 4000, 2000));
  });
  it("kalıcı: kullanım sayacı ve 'doldu' işareti sunucu yeniden başlasa da korunur; ertesi gün (00:00 UTC) sıfırlanır", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kota-"));
    try {
      const file = join(dir, "sayaclar.json");
      const now = Date.UTC(2026, 10, 25, 22, 0);
      const s1 = new FileStore(file, () => now);
      await s1.incr(`ucretsiz:cloudflare:dolu:${freeDay(now)}`, 1, 3 * 86400);
      await new Promise((r) => setTimeout(r, 50));
      const s2 = new FileStore(file, () => now);
      expect(await isExhausted(s2, "cloudflare", now)).toBe(true);
      expect(await isExhausted(s2, "cloudflare", Date.UTC(2026, 10, 26, 0, 1))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/* ───── Yerel hesaplama motoru: yapay zekâ çağrısı olmadan ───── */

describe("Yerel hesaplama motoru (yapay zekâsız, kesin aritmetik)", () => {
  it("saf işlem/denklem soruları yapay zekâya gönderilmez ve 'local' olarak etiketlenir", async () => {
    const f = fakeFetch([]);
    for (const q of ["3/4 + 1/6", "2x + 5 = 15"]) {
      const r = await solveQuestion({ text: q, mode: "full" }, { provider: chain(new MemoryStore(), f.fn), onUsage: () => {}, localSolverFirst: true });
      expect(r.ok && r.source).toBe("local");
      expect(r.ok && r.provider).toBe(LOCAL_PROVIDER);
      expect(r.ok && r.issues).toEqual([]);
    }
    expect(f.calls).toHaveLength(0);
  });
  it("sözel problemler ve fotoğraflar yapay zekâya gider", async () => {
    const f = fakeFetch([chatOk(okEnvelope), chatOk(okEnvelope)]);
    const d = { provider: chain(new MemoryStore(), f.fn), onUsage: () => {}, localSolverFirst: true };
    expect((await solveQuestion({ text: "Bir sayının 3 katının 4 fazlası 25'tir. Sayı kaçtır?", mode: "full" }, d)).ok).toBe(true);
    expect((await solveQuestion({ image: IMG, mode: "full" }, d)).ok).toBe(true);
    expect(f.calls).toHaveLength(2);
  });
  it("kurallarla üretilebilen alıştırmalar yapay zekâsız; 'benzer soru' yapay zekâyla", async () => {
    const f = fakeFetch([chatOk(okEnvelope)]);
    const d = { provider: chain(new MemoryStore(), f.fn), onUsage: () => {}, localSolverFirst: true };
    const local = await practice({ topicId: "denklemler", difficulty: "orta" }, d);
    expect(local.ok && local.source).toBe("local");
    expect(f.calls).toHaveLength(0);
    const similar = await practice({ topicId: "denklemler", difficulty: "orta", basedOn: "3x + 4 = 25" }, d);
    expect(similar.ok && similar.source).toBe("ai");
    expect(f.calls).toHaveLength(1);
  });
});

/* ───── İnternette yayın güvenliği (Vercel) ───── */

describe("Vercel yayını: aile PIN'i ve kalıcı sayaç zorunlu", () => {
  beforeEach(() => {
    setStore(new MemoryStore());
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("AI_PROVIDER", "cloudflare");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "hesap123");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token");
    vi.stubEnv("APP_ACCESS_PIN", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    setStore(undefined);
  });
  const post = (body: unknown, cookie = "") => new Request("https://pihoca.example/api/solve", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });

  it("PIN tanımlı değilse yapay zekâ ucu çalışmaz (503, Türkçe kurulum mesajı)", async () => {
    const { POST } = await import("@/app/api/solve/route");
    const r = await POST(post({ text: "Bir sayının 3 katı 12'dir.", mode: "full" }));
    expect(r.status).toBe(503);
    expect((await r.json()).message).toMatch(/Aile PIN'i tanımlanmamış/);
  });
  it("Upstash bağlı değilse çalışmaz (sayaçlar yeniden başlatmada sıfırlanmasın)", async () => {
    vi.stubEnv("APP_ACCESS_PIN", "2468");
    vi.stubEnv("APP_SESSION_SECRET", "s".repeat(40));
    const { POST } = await import("@/app/api/solve/route");
    const r = await POST(post({ text: "x", mode: "full" }));
    expect(r.status).toBe(503);
    expect((await r.json()).message).toMatch(/Upstash/);
  });
  it("PIN ve Upstash varsa: PIN'siz istek 401", async () => {
    vi.stubEnv("APP_ACCESS_PIN", "2468");
    vi.stubEnv("APP_SESSION_SECRET", "s".repeat(40));
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://upstash.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "u-token");
    const { POST } = await import("@/app/api/solve/route");
    expect((await POST(post({ text: "x", mode: "full" }))).status).toBe(401);
  });
  it("durum bilgisi: kurulum sorunu, ücretsiz sağlayıcı durumu ve 'Built with Llama'; gizli bilgi yok", async () => {
    const { GET } = await import("@/app/api/status/route");
    const st = await (await GET(new Request("https://pihoca.example/api/status"))).json();
    expect(st.providerKind).toBe("cloudflare");
    expect(st.setupProblem).toMatch(/PIN/);
    expect(st.freeAi).toEqual([{ kind: "cloudflare", name: expect.stringContaining("Cloudflare"), state: "ok" }]);
    expect(st.modelCredit).toBe("Built with Llama");
    expect(st.syncAvailable).toBe(false);
    expect(JSON.stringify(st)).not.toMatch(/cf-token|hesap123/);
  });
});

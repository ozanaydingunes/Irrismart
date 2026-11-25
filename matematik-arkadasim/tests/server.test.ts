import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractJson, parseWithSchema } from "@/lib/ai/json";
import { solutionSchema, solveEnvelopeSchema } from "@/lib/schema/solution";
import { DEMO_SAMPLES } from "@/lib/demo/samples";
import { parseImageDataUrl } from "@/lib/server/image";
import { checkAndConsume, recordSpend, spentToday } from "@/lib/server/quota";
import { MemoryStore, setStore, UpstashStore } from "@/lib/server/store";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("Kalıcı kota: hız sınırı, günlük limit, harcama sınırı", () => {
  const limits = { perMinute: 2, dailyPerClient: 3, dailyGlobal: 5, dailyBudgetUsd: 1 };
  it("oturum başına dakikalık sınır, dakika dönünce açılır", async () => {
    let t = Date.UTC(2026, 0, 1, 10, 0, 5);
    const st = new MemoryStore(() => t);
    const ids = { session: "s1", ip: "1.1.1.1" };
    expect((await checkAndConsume(st, ids, limits, t)).allowed).toBe(true);
    expect((await checkAndConsume(st, ids, limits, t)).allowed).toBe(true);
    const third = await checkAndConsume(st, ids, limits, t);
    expect(third.allowed).toBe(false);
    expect(!third.allowed && third.reason).toBe("rate");
    t += 61_000;
    expect((await checkAndConsume(st, ids, limits, t)).allowed).toBe(true);
  });
  it("çerez silinse de IP sınırı devreye girer (oturum sınırının 3 katı)", async () => {
    const t = Date.UTC(2026, 0, 1, 10);
    const st = new MemoryStore(() => t);
    const results = [];
    for (let i = 0; i < 7; i++) results.push((await checkAndConsume(st, { session: `yeni${i}`, ip: "9.9.9.9" }, { ...limits, dailyGlobal: 0, dailyPerClient: 0 }, t)).allowed);
    expect(results.filter(Boolean)).toHaveLength(6);
  });
  it("günlük istemci ve genel limit; ertesi gün sıfırlanır", async () => {
    let t = Date.UTC(2026, 0, 1, 10);
    const st = new MemoryStore(() => t);
    const L = { ...limits, perMinute: 0 };
    for (let i = 0; i < 3; i++) expect((await checkAndConsume(st, { session: "a", ip: "1" }, L, t)).allowed).toBe(true);
    const d = await checkAndConsume(st, { session: "a", ip: "1" }, L, t);
    expect(!d.allowed && d.reason).toBe("daily");
    expect((await checkAndConsume(st, { session: "b", ip: "2" }, L, t)).allowed).toBe(true); // genel sayaç: 5
    const g = await checkAndConsume(st, { session: "c", ip: "3" }, L, t);
    expect(!g.allowed && g.reason).toBe("global");
    t += 86400_000;
    expect((await checkAndConsume(st, { session: "a", ip: "1" }, L, t)).allowed).toBe(true);
  });
  it("günlük harcama sınırı aşılınca yeni istek reddedilir", async () => {
    const t = Date.UTC(2026, 0, 1, 10);
    const st = new MemoryStore(() => t);
    await recordSpend(st, 0.6, t);
    expect((await checkAndConsume(st, { session: "a", ip: "1" }, limits, t)).allowed).toBe(true);
    await recordSpend(st, 0.5, t);
    expect(await spentToday(st, t)).toBeCloseTo(1.1, 5);
    const d = await checkAndConsume(st, { session: "a", ip: "1" }, limits, t);
    expect(!d.allowed && d.reason).toBe("budget");
  });
  it("sayaç anahtarları ham IP veya oturum kimliği içermez", async () => {
    const keys: string[] = [];
    const st = { persistent: true, incr: async (k: string) => (keys.push(k), 1), get: async () => 0 };
    await checkAndConsume(st, { session: "gizli-oturum", ip: "203.0.113.7" }, limits);
    expect(keys.join(" ")).not.toMatch(/203\.0\.113\.7|gizli-oturum/);
  });
  it("Upstash REST deposu doğru komutları gönderir", async () => {
    const calls: unknown[] = [];
    const fake = (async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify([{ result: 4 }, { result: 1 }]), { status: 200 });
    }) as unknown as typeof fetch;
    const st = new UpstashStore("https://ornek.upstash.io", "tok", fake);
    expect(await st.incr("k", 1, 60)).toBe(4);
    expect(calls[0]).toEqual([["INCRBY", "k", 1], ["EXPIRE", "k", 60, "NX"]]);
  });
  it("Upstash hata verirse istisna fırlatır (koruma katmanı isteği reddeder)", async () => {
    const st = new UpstashStore("https://x", "t", (async () => new Response("", { status: 500 })) as unknown as typeof fetch);
    await expect(st.incr("k", 1, 60)).rejects.toThrow();
  });
});

describe("Görsel doğrulama", () => {
  it("geçerli PNG'yi kabul eder ve türü içerikten belirler", () => {
    const r = parseImageDataUrl(PNG, 1_000_000);
    expect(r.ok && r.image.mediaType).toBe("image/png");
  });
  it("izin verilmeyen türü reddeder", () => expect(parseImageDataUrl("data:image/gif;base64,R0lGODlhAQABAAAAACw=", 1e6).ok).toBe(false));
  it("türü uyuşmayan içeriği reddeder", () => expect(parseImageDataUrl("data:image/jpeg;base64,PHN2Zz48L3N2Zz4=", 1e6).ok).toBe(false));
  it("boyut sınırını uygular", () => expect(parseImageDataUrl(PNG, 10).ok).toBe(false));
  it("veri URL'si olmayan girdiyi reddeder", () => expect(parseImageDataUrl("https://example.com/a.png", 1e6).ok).toBe(false));
});

describe("YZ JSON ayrıştırma ve şema", () => {
  const sol = DEMO_SAMPLES[0].solution;
  it("kod çiti ve açıklama metni içinden JSON'u çıkarır", () => {
    const txt = "İşte çözüm:\n```json\n" + JSON.stringify({ status: "ok", solution: sol }) + "\n```\nKolay gelsin!";
    expect(parseWithSchema(txt, solveEnvelopeSchema).ok).toBe(true);
  });
  it("metin içindeki süslü parantezleri doğru sayar", () => {
    expect(extractJson('önce {"a":"x}y{z","b":{"c":1}} sonra')).toEqual({ a: "x}y{z", b: { c: 1 } });
  });
  it("yarıda kesilmiş JSON hata verir", () => expect(parseWithSchema('{"status":"ok","solution":{', solveEnvelopeSchema).ok).toBe(false));
  it("okunamayan görsel yanıtı", () => {
    const r = parseWithSchema('{"status":"unreadable","message":"Fotoğraf bulanık."}', solveEnvelopeSchema);
    expect(r.ok && r.data.status).toBe("unreadable");
  });
  it("bilinmeyen/zararlı görsel talimatlarını ayıklar, çözümü reddetmez", () => {
    const bad = structuredClone(sol) as Record<string, unknown> & { steps: Record<string, unknown>[] };
    bad.steps[0].visualInstructions = [{ type: "html", html: "<script>alert(1)</script>" }, { type: "percentGrid", percent: 30 }];
    const r = solutionSchema.safeParse(bad);
    expect(r.success).toBe(true);
    expect(r.success && r.data.steps[0].visualInstructions).toEqual([{ type: "percentGrid", percent: 30 }]);
  });
  it("zorunlu alan eksikse reddeder", () => {
    const bad = structuredClone(sol) as Record<string, unknown>;
    delete bad.steps;
    expect(solutionSchema.safeParse(bad).success).toBe(false);
  });
  it("bilinmeyen renk ve zorluk değerlerini güvenli varsayılana çevirir", () => {
    const x = structuredClone(sol) as Record<string, unknown> & { steps: Record<string, unknown>[] };
    x.difficulty = "Çok Zor";
    x.steps[0].highlightedElements = [{ value: "2", color: "neon" }];
    const r = solutionSchema.parse(x);
    expect(r.difficulty).toBe("orta");
    expect(r.steps[0].highlightedElements[0].color).toBe("blue");
  });
});

describe("API uçları (demo modu)", () => {
  beforeEach(async () => {
    vi.stubEnv("AI_PROVIDER", "demo");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("RATE_LIMIT_PER_MINUTE", "100");
    setStore(new MemoryStore());
  });
  afterEach(() => vi.unstubAllEnvs());

  const post = (url: string, body: unknown) => new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("status: demo modunu bildirir, anahtar sızdırmaz", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { GET } = await import("@/app/api/status/route");
    const json = await (await GET(new Request("http://x/api/status"))).json();
    expect(json.accessRequired).toBe(false);
    expect(json.mode).toBe("demo");
    expect(JSON.stringify(json)).not.toMatch(/sk-|api_key/i);
  });

  it("solve: denklem sorusu demo olarak çözülür ve etiketlenir", async () => {
    const { POST } = await import("@/app/api/solve/route");
    const json = await (await POST(post("http://x/api/solve", { text: "2x + 5 = 15", mode: "full" }))).json();
    expect(json.ok).toBe(true);
    expect(json.source).toBe("demo");
    expect(json.notice).toMatch(/DEMO/);
    expect(json.solution.finalAnswer.text).toBe("x = 5");
  });

  it("solve: demo modunda fotoğraf çözümü uydurulmaz", async () => {
    const { POST } = await import("@/app/api/solve/route");
    const json = await (await POST(post("http://x/api/solve", { image: PNG }))).json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("DEMO_UNSUPPORTED");
  });

  it("solve: boş istek ve bozuk JSON 400 döner", async () => {
    const { POST } = await import("@/app/api/solve/route");
    expect((await POST(post("http://x/api/solve", { mode: "full" }))).status).toBe(400);
    expect((await POST(new Request("http://x/api/solve", { method: "POST", body: "{bozuk" }))).status).toBe(400);
  });

  it("check: yerel eşdeğerlik kontrolü", async () => {
    const { POST } = await import("@/app/api/check/route");
    const json = await (await POST(post("http://x/api/check", { question: "q", prompt: "25 − 4?", expected: "21", studentAnswer: "21" }))).json();
    expect(json.ok && json.source).toBe("local");
    expect(json.reply.correct).toBe(true);
  });

  it("tutor: demo yanıtı döner", async () => {
    const { POST } = await import("@/app/api/tutor/route");
    const json = await (await POST(post("http://x/api/tutor", { solution: DEMO_SAMPLES[1].solution, stepIndex: 1, action: "why", history: [] }))).json();
    expect(json.ok).toBe(true);
    expect(json.source).toBe("demo");
  });

  it("tts: yapılandırılmamışsa 501", async () => {
    const { POST } = await import("@/app/api/tts/route");
    expect((await POST(post("http://x/api/tts", { text: "merhaba" }))).status).toBe(501);
  });
});

describe("Service worker önbellek güvenliği", () => {
  it("API yanıtlarını ve POST isteklerini asla önbelleğe almaz", async () => {
    const { readFileSync } = await import("node:fs");
    const sw = readFileSync("public/sw.js", "utf8");
    expect(sw).toMatch(/if \(req\.method !== "GET"\) return;/);
    expect(sw).toMatch(/if \(url\.pathname\.startsWith\("\/api\/"\)\) return;/);
    expect(sw).toMatch(/if \(url\.origin !== self\.location\.origin\) return;/);
  });
});

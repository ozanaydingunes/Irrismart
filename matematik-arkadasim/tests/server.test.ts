import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractJson, parseWithSchema } from "@/lib/ai/json";
import { solutionSchema, solveEnvelopeSchema } from "@/lib/schema/solution";
import { DEMO_SAMPLES } from "@/lib/demo/samples";
import { parseImageDataUrl } from "@/lib/server/image";
import { DailyCounter, SlidingWindowLimiter } from "@/lib/server/rateLimit";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("Hız sınırı ve günlük limit", () => {
  it("dakikalık sınırı uygular ve zamanla açar", () => {
    let t = 0;
    const l = new SlidingWindowLimiter(2, 60_000, () => t);
    expect(l.check("a").allowed).toBe(true);
    expect(l.check("a").allowed).toBe(true);
    const third = l.check("a");
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSec).toBeGreaterThan(0);
    expect(l.check("b").allowed).toBe(true); // başka istemci etkilenmez
    t = 61_000;
    expect(l.check("a").allowed).toBe(true);
  });
  it("istemci başına ve genel günlük limit; gün dönünce sıfırlanır", () => {
    let t = Date.UTC(2026, 0, 1, 10);
    const d = new DailyCounter(2, 3, () => t);
    expect(d.consume("a").allowed).toBe(true);
    expect(d.consume("a").remainingToday).toBe(0);
    expect(d.consume("a").reason).toBe("daily");
    expect(d.consume("b").allowed).toBe(true);
    expect(d.consume("c").reason).toBe("global");
    t += 24 * 3600 * 1000;
    expect(d.consume("a").allowed).toBe(true);
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
    const { resetLimiters } = await import("@/lib/server/handler");
    resetLimiters();
  });
  afterEach(() => vi.unstubAllEnvs());

  const post = (url: string, body: unknown) => new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("status: demo modunu bildirir, anahtar sızdırmaz", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { GET } = await import("@/app/api/status/route");
    const json = await (await GET()).json();
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

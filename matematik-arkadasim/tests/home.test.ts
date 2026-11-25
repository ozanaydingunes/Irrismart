import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueueFullError, SingleFlightQueue } from "@/lib/ai/queue";
import { AIError, type AIProvider, type CompletionRequest, type CompletionResult } from "@/lib/ai/provider";
import { solveQuestion } from "@/lib/ai/service";
import { DEMO_SAMPLES } from "@/lib/demo/samples";
import { getConfig } from "@/lib/server/config";
import { MemoryStore, setStore } from "@/lib/server/store";
import { setSyncStore, SyncStore } from "@/lib/server/syncStore";
import { mergeStudy } from "@/lib/storage/db";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Tek seferde tek yapay zekâ isteği", () => {
  it("istekler sırayla çalışır (aynı anda en fazla 1)", async () => {
    const q = new SingleFlightQueue(5);
    let active = 0;
    let maxActive = 0;
    const order: number[] = [];
    const job = (n: number) =>
      q.run(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await wait(15);
        order.push(n);
        active--;
        return n;
      });
    const results = await Promise.all([job(1), job(2), job(3)]);
    expect(results).toEqual([1, 2, 3]);
    expect(order).toEqual([1, 2, 3]);
    expect(maxActive).toBe(1);
  });
  it("sıra doluysa hemen 'meşgul' döner; bekleme süresi dolarsa sıradan çıkar", async () => {
    const q = new SingleFlightQueue(1);
    const long = q.run(() => wait(60));
    const waiting = q.run(() => wait(1));
    await expect(q.run(() => wait(1))).rejects.toBeInstanceOf(QueueFullError);
    await Promise.all([long, waiting]);
    const q2 = new SingleFlightQueue(2);
    const l2 = q2.run(() => wait(80));
    await expect(q2.run(() => wait(1), 20)).rejects.toBeInstanceOf(QueueFullError);
    await l2;
    expect(q2.busy).toBe(false);
  });
  it("hata veren iş sırayı kilitlemez", async () => {
    const q = new SingleFlightQueue(2);
    await expect(q.run(async () => Promise.reject(new Error("x")))).rejects.toThrow("x");
    expect(await q.run(async () => 7)).toBe(7);
  });
  it("servis: sıra dolunca Türkçe 'Pi Hoca başka bir soruyu çözüyor' mesajı", async () => {
    class Slow implements AIProvider {
      readonly name = "yavaş";
      async complete(): Promise<CompletionResult> {
        await wait(120);
        return { text: JSON.stringify({ status: "ok", solution: DEMO_SAMPLES[1].solution }), model: "mock", usage: { inputTokens: 0, outputTokens: 0 } };
      }
    }
    const p = new Slow();
    const runs = Array.from({ length: 5 }, () => solveQuestion({ text: "x", mode: "full" }, { provider: p, onUsage: () => {} }));
    const out = await Promise.all(runs);
    const busy = out.filter((r) => !r.ok && /başka bir soruyu çözüyor/.test(r.message));
    expect(out.filter((r) => r.ok).length).toBeGreaterThanOrEqual(1);
    expect(busy.length).toBeGreaterThanOrEqual(1);
    expect(new AIError("busy", "busy").kind).toBe("busy");
  });
});

describe("8 GB RAM varsayılanları", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("varsayılan model gemma3:4b, bağlam penceresi 8192; Ollama yalnızca bu bilgisayarda", () => {
    vi.stubEnv("OLLAMA_MODEL", "");
    vi.stubEnv("OLLAMA_BASE_URL", "");
    const c = getConfig();
    expect(c.ollama.model).toBe("gemma3:4b");
    expect(c.ollama.numCtx).toBe(8192);
    expect(c.ollama.baseUrl).toBe("http://127.0.0.1:11434");
  });
});

describe("Cihazlar arası eşitleme deposu (ev bilgisayarı)", () => {
  let dir: string;
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), "esit-"))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("son değiştirilen kazanır; eski güncelleme yenisinin üstüne yazılmaz", async () => {
    const s = new SyncStore(null);
    await s.push([{ kind: "notebook", id: "a", updatedAt: 200, data: { question: "yeni" } }]);
    expect(await s.push([{ kind: "notebook", id: "a", updatedAt: 100, data: { question: "eski" } }])).toBe(0);
    expect(s.pull(0).records[0].data).toEqual({ question: "yeni" });
  });
  it("silme diğer cihazlara yayılır; fotoğraf asla saklanmaz", async () => {
    const s = new SyncStore(null);
    await s.push([{ kind: "notebook", id: "a", updatedAt: 1, data: { question: "q", imageDataUrl: "data:image/jpeg;base64,AAAA" } }]);
    expect(JSON.stringify(s.pull(0))).not.toContain("base64");
    const rev = s.rev;
    await s.push([{ kind: "notebook", id: "a", updatedAt: 2, deleted: true }]);
    const p = s.pull(rev);
    expect(p.records).toHaveLength(1);
    expect(p.records[0]).toMatchObject({ id: "a", deleted: true });
    expect(p.records[0].data).toBeUndefined();
  });
  it("sürüm numarasıyla parça parça çekme", async () => {
    const s = new SyncStore(null);
    await s.push(Array.from({ length: 7 }, (_, i) => ({ kind: "answer" as const, id: `x${i}`, updatedAt: i + 1, data: { i } })));
    const a = s.pull(0, 3);
    expect(a.records).toHaveLength(3);
    expect(a.more).toBe(true);
    const b = s.pull(a.rev, 3);
    const c = s.pull(b.rev, 3);
    expect([...a.records, ...b.records, ...c.records].map((r) => r.id)).toEqual(["x0", "x1", "x2", "x3", "x4", "x5", "x6"]);
    expect(c.more).toBe(false);
  });
  it("dosyaya kalıcı yazılır; 'tümünü sil' her kaydı silme işaretine çevirir", async () => {
    const f = join(dir, "esitleme.json");
    const s = new SyncStore(f);
    await s.push([{ kind: "lesson", id: "l1", updatedAt: 5, data: { topicId: "kesirler" } }]);
    const again = new SyncStore(f);
    expect(again.pull(0).records).toHaveLength(1);
    await again.wipe();
    expect(again.pull(0).records.every((r) => r.deleted && !r.data)).toBe(true);
    expect(readFileSync(f, "utf8")).not.toContain("kesirler");
  });
  it("çalışma süreleri cihazlar arasında gün bazında toplanır", () => {
    expect(
      mergeStudy(
        [{ day: "2026-11-25", seconds: 600 }],
        [
          { id: "2026-11-25:tablet", day: "2026-11-25", deviceId: "tablet", seconds: 300 },
          { id: "2026-11-24:telefon", day: "2026-11-24", deviceId: "telefon", seconds: 120 },
        ],
      ).sort((a, b) => a.day.localeCompare(b.day)),
    ).toEqual([
      { day: "2026-11-24", seconds: 120 },
      { day: "2026-11-25", seconds: 900 },
    ]);
  });
});

describe("Eşitleme API'si", () => {
  beforeEach(() => {
    setStore(new MemoryStore());
    setSyncStore(new SyncStore(null));
    vi.stubEnv("COUNTER_STORE", "file");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("APP_ACCESS_PIN", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    setSyncStore(undefined);
  });
  const post = (body: unknown, cookie = "") =>
    new Request("http://x/api/sync", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });

  it("iki cihaz: telefonun kaydettiği tablete gelir", async () => {
    const { POST } = await import("@/app/api/sync/route");
    const phone = await (await POST(post({ sinceRev: 0, push: [{ kind: "notebook", id: "e1", updatedAt: 10, data: { id: "e1", question: "3/4+1/6" } }] }))).json();
    expect(phone.ok).toBe(true);
    const tablet = await (await POST(post({ sinceRev: 0, push: [] }))).json();
    expect(tablet.records.map((r: { id: string }) => r.id)).toEqual(["e1"]);
  });
  it("aile PIN'i tanımlıysa PIN'siz eşitleme reddedilir", async () => {
    vi.stubEnv("APP_ACCESS_PIN", "1234");
    vi.stubEnv("APP_SESSION_SECRET", "s".repeat(40));
    const { POST, DELETE } = await import("@/app/api/sync/route");
    expect((await POST(post({ sinceRev: 0, push: [] }))).status).toBe(401);
    expect((await DELETE(new Request("http://x/api/sync", { method: "DELETE" }))).status).toBe(401);
  });
  it("geçersiz kayıt türü ve çok büyük kayıt reddedilir", async () => {
    const { POST } = await import("@/app/api/sync/route");
    expect((await POST(post({ sinceRev: 0, push: [{ kind: "foto", id: "a", updatedAt: 1 }] }))).status).toBe(400);
    const big = "x".repeat(450_000);
    expect((await POST(post({ sinceRev: 0, push: [{ kind: "notebook", id: "a", updatedAt: 1, data: { s: big } }] }))).status).toBe(413);
  });
  it("sunucusuz ortamda (kalıcı disk yok) eşitleme kapalı", async () => {
    vi.stubEnv("VERCEL", "1");
    setSyncStore(undefined);
    const { POST } = await import("@/app/api/sync/route");
    expect((await POST(post({ sinceRev: 0, push: [] }))).status).toBe(501);
  });
});

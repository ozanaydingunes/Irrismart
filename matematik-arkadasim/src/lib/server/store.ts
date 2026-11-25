import "server-only";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getConfig } from "./config";

/**
 * Sayaç deposu: hız sınırı, günlük kota ve günlük harcama burada tutulur.
 * - UPSTASH_REDIS_REST_URL / TOKEN tanımlıysa kalıcı Redis (sunucu yeniden başlasa da, birden çok
 *   sunucusuz örnekte de sayaçlar ortaktır).
 * - Tanımlı değilse bellek içi depo (yalnızca yerel geliştirme / tek sunucu için uygundur).
 * Sayaç anahtarları kişisel veri içermez: IP ve oturum kimliği SHA-256 ile özetlenir.
 */
export interface CounterStore {
  readonly persistent: boolean;
  /** Anahtarı `by` kadar artırır, ilk oluşturulduğunda `ttlSec` süre sonra silinir; yeni değeri döndürür. */
  incr(key: string, by: number, ttlSec: number): Promise<number>;
  get(key: string): Promise<number>;
  /** Süresiz değer yazar (ayarlar için). */
  set?(key: string, value: number): Promise<void>;
}

export class MemoryStore implements CounterStore {
  readonly persistent = false;
  private data = new Map<string, { v: number; exp: number }>();
  constructor(private now: () => number = Date.now) {}
  async incr(key: string, by: number, ttlSec: number) {
    const t = this.now();
    const cur = this.data.get(key);
    const live = cur && cur.exp > t ? cur : { v: 0, exp: t + ttlSec * 1000 };
    live.v += by;
    this.data.set(key, live);
    if (this.data.size > 20_000) for (const [k, v] of this.data) if (v.exp <= t) this.data.delete(k);
    return live.v;
  }
  async get(key: string) {
    const cur = this.data.get(key);
    return cur && cur.exp > this.now() ? cur.v : 0;
  }
  async set(key: string, value: number) {
    this.data.set(key, { v: value, exp: Number.MAX_SAFE_INTEGER });
  }
}

/**
 * Dosya tabanlı kalıcı depo: ev bilgisayarında çalışan tek sunucu için. Sunucu yeniden başlasa da
 * günlük soru sayacı korunur. Yazım atomiktir (geçici dosya + yeniden adlandırma). İçerikte yalnızca
 * özetlenmiş anahtarlar ve sayılar vardır; kişisel veri, soru veya fotoğraf tutulmaz.
 */
export class FileStore implements CounterStore {
  readonly persistent = true;
  private data: Record<string, { v: number; exp: number }> = {};
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private file: string,
    private now: () => number = Date.now,
  ) {
    try {
      this.data = JSON.parse(readFileSync(file, "utf8")) as Record<string, { v: number; exp: number }>;
    } catch {
      this.data = {};
    }
  }

  private save() {
    const t = this.now();
    for (const [k, v] of Object.entries(this.data)) if (v.exp <= t) delete this.data[k];
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data));
    renameSync(tmp, this.file);
  }

  incr(key: string, by: number, ttlSec: number): Promise<number> {
    const run = async () => {
      const t = this.now();
      const cur = this.data[key];
      const live = cur && cur.exp > t ? cur : { v: 0, exp: t + ttlSec * 1000 };
      live.v += by;
      this.data[key] = live;
      this.save();
      return live.v;
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  async get(key: string) {
    const cur = this.data[key];
    return cur && cur.exp > this.now() ? cur.v : 0;
  }

  /** Süresiz ayar değeri (ör. ebeveynin belirlediği günlük soru sınırı) */
  async set(key: string, value: number) {
    const run = async () => {
      this.data[key] = { v: value, exp: Number.MAX_SAFE_INTEGER };
      this.save();
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    await p;
  }
}

/** Upstash Redis REST API (ek paket gerektirmez). */
export class UpstashStore implements CounterStore {
  readonly persistent = true;
  constructor(
    private url: string,
    private token: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async pipeline(commands: (string | number)[][]): Promise<{ result?: unknown; error?: string }[]> {
    const res = await this.fetchImpl(`${this.url}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`sayaç deposu HTTP ${res.status}`);
    return (await res.json()) as { result?: unknown; error?: string }[];
  }

  async incr(key: string, by: number, ttlSec: number) {
    const [r] = await this.pipeline([
      ["INCRBY", key, Math.round(by)],
      ["EXPIRE", key, ttlSec, "NX"],
    ]);
    if (r?.error) throw new Error("sayaç deposu hatası");
    return Number(r?.result ?? 0);
  }

  async get(key: string) {
    const [r] = await this.pipeline([["GET", key]]);
    return Number(r?.result ?? 0) || 0;
  }

  async set(key: string, value: number) {
    const [r] = await this.pipeline([["SET", key, value]]);
    if (r?.error) throw new Error("sayaç deposu hatası");
  }
}

const g = globalThis as unknown as { __mathStore?: CounterStore };

export function getStore(): CounterStore {
  if (!g.__mathStore) {
    const { store } = getConfig();
    const cfg = getConfig();
    g.__mathStore =
      store.upstashUrl && store.upstashToken
        ? new UpstashStore(store.upstashUrl, store.upstashToken)
        : store.useFile
          ? new FileStore(join(process.cwd(), store.dataDir, "sayaclar.json"))
          : new MemoryStore();
    if (!g.__mathStore.persistent && cfg.isProduction && cfg.provider !== "demo") {
      console.warn("[quota] UYARI: Kalıcı sayaç deposu yapılandırılmamış; kota sınırları sunucusuz ortamda güvenilir değildir.");
    }
  }
  return g.__mathStore;
}

/** Testler için */
export function setStore(s: CounterStore | undefined) {
  g.__mathStore = s;
}

import "server-only";
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
}

const g = globalThis as unknown as { __mathStore?: CounterStore };

export function getStore(): CounterStore {
  if (!g.__mathStore) {
    const { store } = getConfig();
    const cfg = getConfig();
    g.__mathStore = store.upstashUrl && store.upstashToken ? new UpstashStore(store.upstashUrl, store.upstashToken) : new MemoryStore();
    if (!g.__mathStore.persistent && cfg.isProduction && cfg.provider !== "demo") {
      console.warn("[quota] UYARI: Kalıcı sayaç deposu (Upstash) yapılandırılmamış; kota ve harcama sınırları sunucusuz ortamda güvenilir değildir.");
    }
  }
  return g.__mathStore;
}

/** Testler için */
export function setStore(s: CounterStore | undefined) {
  g.__mathStore = s;
}

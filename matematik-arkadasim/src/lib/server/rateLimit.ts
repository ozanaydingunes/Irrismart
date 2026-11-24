/**
 * Bellek içi hız sınırı ve günlük kullanım sayacı.
 * Tek sunucu örneği için uygundur; çok örnekli dağıtımda Redis gibi paylaşımlı bir depo kullanılmalıdır.
 */

export interface LimitDecision {
  allowed: boolean;
  reason?: "rate" | "daily" | "global";
  retryAfterSec?: number;
  remainingToday?: number;
}

export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();
  constructor(private limit: number, private windowMs: number, private now: () => number = Date.now) {}

  check(key: string): { allowed: boolean; retryAfterSec: number } {
    if (this.limit <= 0) return { allowed: true, retryAfterSec: 0 };
    const t = this.now();
    const arr = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (arr.length >= this.limit) {
      this.hits.set(key, arr);
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((this.windowMs - (t - arr[0])) / 1000)) };
    }
    arr.push(t);
    this.hits.set(key, arr);
    if (this.hits.size > 10_000) this.prune(t);
    return { allowed: true, retryAfterSec: 0 };
  }

  private prune(t: number) {
    for (const [k, v] of this.hits) if (!v.some((x) => t - x < this.windowMs)) this.hits.delete(k);
  }
}

export class DailyCounter {
  private day = "";
  private counts = new Map<string, number>();
  private total = 0;
  constructor(private perClient: number, private global: number, private now: () => number = Date.now) {}

  private roll() {
    const d = new Date(this.now()).toISOString().slice(0, 10);
    if (d !== this.day) {
      this.day = d;
      this.counts.clear();
      this.total = 0;
    }
  }

  /** Sayacı artırmadan kontrol eder. */
  peek(key: string): LimitDecision {
    this.roll();
    const used = this.counts.get(key) ?? 0;
    if (this.global > 0 && this.total >= this.global) return { allowed: false, reason: "global", remainingToday: 0 };
    if (this.perClient > 0 && used >= this.perClient) return { allowed: false, reason: "daily", remainingToday: 0 };
    return { allowed: true, remainingToday: this.perClient > 0 ? this.perClient - used : undefined };
  }

  consume(key: string): LimitDecision {
    const d = this.peek(key);
    if (!d.allowed) return d;
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    this.total++;
    return { allowed: true, remainingToday: this.perClient > 0 ? this.perClient - (this.counts.get(key) ?? 0) : undefined };
  }
}

/** İstemci anahtarı: IP adresi (kişisel veri olarak saklanmaz, yalnızca bellekte sayılır). */
export function clientKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || headers.get("x-real-ip")?.trim() || "local";
}

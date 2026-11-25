import "server-only";

/**
 * Tek seferde tek yapay zekâ isteği. Ev bilgisayarında (ör. 8 GB RAM) iki model çağrısı aynı anda
 * çalışırsa bellek yetmeyebilir ve ikisi de çok yavaşlar. İstekler sırayla işlenir; sırada en fazla
 * `maxWaiting` istek bekler, fazlası "meşgul" yanıtı alır. Bekleyen istek kendi son tarihini aşarsa
 * sıradan çıkar.
 */
export class SingleFlightQueue {
  private running = false;
  private waiting: { resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> | null }[] = [];

  constructor(private maxWaiting = 2) {}

  get busy() {
    return this.running;
  }
  get queued() {
    return this.waiting.length;
  }

  async run<T>(fn: () => Promise<T>, waitTimeoutMs = 120_000): Promise<T> {
    await this.acquire(waitTimeoutMs);
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(waitTimeoutMs: number): Promise<void> {
    if (!this.running) {
      this.running = true;
      return Promise.resolve();
    }
    if (this.waiting.length >= this.maxWaiting) return Promise.reject(new QueueFullError());
    return new Promise((resolve, reject) => {
      const entry = {
        resolve: () => {
          if (entry.timer) clearTimeout(entry.timer);
          resolve();
        },
        reject,
        timer: null as ReturnType<typeof setTimeout> | null,
      };
      entry.timer = setTimeout(() => {
        this.waiting = this.waiting.filter((w) => w !== entry);
        reject(new QueueFullError("bekleme süresi doldu"));
      }, waitTimeoutMs);
      this.waiting.push(entry);
    });
  }

  private release() {
    const next = this.waiting.shift();
    if (next) next.resolve(); // sıradaki istek çalışmaya başlar (running true kalır)
    else this.running = false;
  }
}

export class QueueFullError extends Error {
  constructor(msg = "kuyruk dolu") {
    super(msg);
  }
}

const g = globalThis as unknown as { __aiQueue?: SingleFlightQueue };
/** Uygulama genelinde tek kuyruk */
export function aiQueue(): SingleFlightQueue {
  return (g.__aiQueue ??= new SingleFlightQueue(Number(process.env.AI_MAX_WAITING) || 2));
}

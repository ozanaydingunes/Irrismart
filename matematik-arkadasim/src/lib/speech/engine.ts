/**
 * Ses motoru arayüzü. Web Speech API, sunucu TTS (OpenAI vb.) ve sessiz (yazılı anlatım)
 * motorları aynı olay sözleşmesini uygular; böylece anlatım denetleyicisi motordan bağımsızdır.
 */
export interface SpeakOptions {
  rate: number;
  onStart?: () => void;
  onEnd: () => void;
  onError: (error: string) => void;
}

export interface SpeechEngine {
  readonly kind: "webspeech" | "server" | "silent";
  /** Ekranda gösterilecek kısa ad (ör. "Tarayıcı sesi: Yelda") */
  readonly label: string;
  speak(text: string, options: SpeakOptions): void;
  cancel(): void;
}

export interface Scheduler {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const realScheduler: Scheduler = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};

/** Türkçe metin için yaklaşık okuma süresi (ms). Ortalama ~2,6 kelime/sn. */
export function estimateDurationMs(text: string, rate = 1): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(900, Math.round((words / 2.6) * 1000 / Math.max(0.5, rate)));
}

/** Ses yokken yazılı anlatımı aynı olay akışıyla sürdüren motor. */
export class SilentEngine implements SpeechEngine {
  readonly kind = "silent" as const;
  readonly label = "Yazılı anlatım (ses kapalı)";
  private handle: unknown = null;
  constructor(private scheduler: Scheduler = realScheduler) {}

  speak(text: string, o: SpeakOptions) {
    this.cancel();
    o.onStart?.();
    this.handle = this.scheduler.setTimeout(() => {
      this.handle = null;
      o.onEnd();
    }, estimateDurationMs(text, o.rate));
  }
  cancel() {
    if (this.handle !== null) this.scheduler.clearTimeout(this.handle);
    this.handle = null;
  }
}

/** Uzun metni cümlelere böler (Chrome'un ~15 sn sonra konuşmayı kesme hatasına karşı). */
export function splitSentences(text: string, maxLen = 220): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+(?=\S)/)
    .filter(Boolean);
  const out: string[] = [];
  for (const s of sentences) {
    if (s.length <= maxLen) {
      out.push(s);
      continue;
    }
    let buf = "";
    for (const part of s.split(/(?<=[,;:])\s+/)) {
      if ((buf + " " + part).trim().length > maxLen && buf) {
        out.push(buf.trim());
        buf = part;
      } else buf = (buf + " " + part).trim();
    }
    if (buf) out.push(buf.trim());
  }
  return out;
}

import { realScheduler, splitSentences, type Scheduler, type SpeechEngine } from "./engine";
import { textToSpeech } from "./mathToSpeech";

/**
 * Adım bazlı seslendirme kuyruğu ve tahta senkronu.
 *
 * Kurallar:
 *  - Bir adımın tüm cümleleri seslendirilmeden sonraki adıma geçilmez (onEnd olayı beklenir).
 *  - Motor iptal edildiğinde gelen geç olaylar "nesil" sayacıyla yok sayılır.
 *  - Duraklatma, motordan bağımsız çalışsın diye "iptal + aynı cümleden devam" ile yapılır.
 */

export type NarrationStatus = "idle" | "playing" | "paused" | "waiting" | "finished";

export interface NarrationSegment {
  /** Ekranda gösterilen cümleler */
  display: string[];
  /** Seslendirilecek (matematik sembolleri Türkçeye çevrilmiş) cümleler */
  spoken: string[];
}

export interface NarrationState {
  status: NarrationStatus;
  stepIndex: number;
  chunkIndex: number;
  stepCount: number;
  rate: number;
  /** Her adımın başlangıcında artar; tahta animasyonlarını yeniden tetiklemek için kullanılır. */
  playToken: number;
  engineKind: SpeechEngine["kind"];
  lastError: string | null;
}

export interface ControllerOptions {
  scheduler?: Scheduler;
  /** Adımlar arası bekleme (ms) */
  gapMs?: number;
  /** true dönerse bu adımın sonunda otomatik ilerleme durur (ör. öğrenciye soru sorulacak). */
  shouldWaitAfterStep?: (stepIndex: number) => boolean;
}

export const RATES = [0.75, 1, 1.25, 1.5] as const;

export function buildSegment(narration: string): NarrationSegment {
  const display = splitSentences(narration);
  return { display, spoken: display.map((s) => textToSpeech(s)) };
}

export class NarrationController {
  private segments: NarrationSegment[] = [];
  private generation = 0;
  private gapHandle: unknown = null;
  private listeners = new Set<() => void>();
  private scheduler: Scheduler;
  private gapMs: number;
  private shouldWaitAfterStep?: (i: number) => boolean;
  private state: NarrationState;

  constructor(private engine: SpeechEngine, opts: ControllerOptions = {}) {
    this.scheduler = opts.scheduler ?? realScheduler;
    this.gapMs = opts.gapMs ?? 650;
    this.shouldWaitAfterStep = opts.shouldWaitAfterStep;
    this.state = {
      status: "idle",
      stepIndex: 0,
      chunkIndex: 0,
      stepCount: 0,
      rate: 1,
      playToken: 0,
      engineKind: engine.kind,
      lastError: null,
    };
  }

  /* ───── abonelik (React useSyncExternalStore ile uyumlu) ───── */
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;
  private set(patch: Partial<NarrationState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  /* ───── yükleme ───── */
  load(narrations: string[], startIndex = 0) {
    this.halt();
    this.segments = narrations.map(buildSegment);
    this.set({
      status: "idle",
      stepIndex: Math.min(startIndex, Math.max(0, narrations.length - 1)),
      chunkIndex: 0,
      stepCount: narrations.length,
      lastError: null,
    });
  }

  /** Mevcut adım listesinin sonuna yeni adımlar ekler (ör. "Daha basit anlat" yanıtı). */
  append(narrations: string[]) {
    this.segments.push(...narrations.map(buildSegment));
    this.set({ stepCount: this.segments.length, status: this.state.status === "finished" ? "paused" : this.state.status });
  }

  getSegment(i: number): NarrationSegment | undefined {
    return this.segments[i];
  }

  setShouldWaitAfterStep(fn?: (i: number) => boolean) {
    this.shouldWaitAfterStep = fn;
  }

  setEngine(engine: SpeechEngine) {
    const wasPlaying = this.state.status === "playing";
    this.halt();
    this.engine = engine;
    this.set({ engineKind: engine.kind, status: wasPlaying ? "paused" : this.state.status });
    if (wasPlaying) this.play();
  }

  setRate(rate: number) {
    const wasPlaying = this.state.status === "playing";
    this.set({ rate });
    if (wasPlaying) {
      this.halt();
      this.speakCurrent();
    }
  }

  /* ───── oynatma kontrolleri ───── */
  play() {
    if (!this.segments.length) return;
    if (this.state.status === "playing") return;
    if (this.state.status === "finished") {
      this.set({ stepIndex: 0, chunkIndex: 0 });
      this.startStep(0);
      return;
    }
    if (this.state.status === "paused" || this.state.status === "waiting") {
      // duraklatılan cümleden devam
      if (this.state.status === "waiting") {
        // adım bitmişti → sonraki adıma geç
        this.advance();
        return;
      }
      this.speakCurrent();
      return;
    }
    this.startStep(this.state.stepIndex);
  }

  pause() {
    if (this.state.status !== "playing") return;
    this.halt();
    this.set({ status: "paused" });
  }

  toggle() {
    if (this.state.status === "playing") this.pause();
    else this.play();
  }

  stop() {
    this.halt();
    this.set({ status: "idle", chunkIndex: 0 });
  }

  restart() {
    this.halt();
    this.startStep(0);
  }

  repeatStep() {
    this.halt();
    this.startStep(this.state.stepIndex);
  }

  next() {
    if (this.state.stepIndex >= this.segments.length - 1) return;
    this.goTo(this.state.stepIndex + 1);
  }

  prev() {
    if (this.state.stepIndex <= 0) return;
    this.goTo(this.state.stepIndex - 1);
  }

  /** Adıma git; oynatılıyorsa o adımdan seslendirmeye devam eder, değilse yalnızca gösterir. */
  goTo(i: number) {
    if (i < 0 || i >= this.segments.length) return;
    const playing = this.state.status === "playing";
    this.halt();
    if (playing) this.startStep(i);
    else this.set({ stepIndex: i, chunkIndex: 0, status: "paused", playToken: this.state.playToken + 1 });
  }

  dispose() {
    this.halt();
    this.listeners.clear();
  }

  /* ───── iç işleyiş ───── */
  private halt() {
    this.generation++;
    if (this.gapHandle !== null) this.scheduler.clearTimeout(this.gapHandle);
    this.gapHandle = null;
    this.engine.cancel();
  }

  private startStep(i: number) {
    this.set({ stepIndex: i, chunkIndex: 0, status: "playing", playToken: this.state.playToken + 1, lastError: null });
    this.speakCurrent();
  }

  private speakCurrent() {
    const seg = this.segments[this.state.stepIndex];
    if (!seg) return;
    if (!seg.spoken.length) {
      this.onStepFinished();
      return;
    }
    const gen = ++this.generation;
    const text = seg.spoken[this.state.chunkIndex] ?? "";
    if (this.state.status !== "playing") this.set({ status: "playing" });
    this.engine.speak(text, {
      rate: this.state.rate,
      onEnd: () => {
        if (gen !== this.generation) return; // eski olay
        this.onChunkEnd();
      },
      onError: (err) => {
        if (gen !== this.generation) return;
        this.halt();
        this.set({ status: "paused", lastError: err });
      },
    });
  }

  private onChunkEnd() {
    const seg = this.segments[this.state.stepIndex];
    if (seg && this.state.chunkIndex < seg.spoken.length - 1) {
      this.set({ chunkIndex: this.state.chunkIndex + 1 });
      this.speakCurrent();
      return;
    }
    this.onStepFinished();
  }

  private onStepFinished() {
    const last = this.state.stepIndex >= this.segments.length - 1;
    if (last) {
      this.set({ status: "finished" });
      return;
    }
    if (this.shouldWaitAfterStep?.(this.state.stepIndex)) {
      this.set({ status: "waiting" });
      return;
    }
    const gen = ++this.generation;
    this.gapHandle = this.scheduler.setTimeout(() => {
      this.gapHandle = null;
      if (gen !== this.generation) return;
      this.advance();
    }, this.gapMs);
  }

  private advance() {
    if (this.state.stepIndex >= this.segments.length - 1) {
      this.set({ status: "finished" });
      return;
    }
    this.startStep(this.state.stepIndex + 1);
  }
}

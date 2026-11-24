"use client";

import { estimateDurationMs, type SpeakOptions, type SpeechEngine } from "./engine";

export type VoiceGender = "female" | "male";

const FEMALE_HINTS = ["yelda", "filiz", "seda", "emel", "female", "kadın", "kadin", "woman", "zeynep", "aylin", "elif", "ayşe", "google türkçe", "google turkish"];
const MALE_HINTS = ["tolga", "ahmet", "cem", "male", "erkek", "man", "mehmet", "emre", "kerem", "murat"];

export function guessGender(name: string): VoiceGender | null {
  const n = name.toLocaleLowerCase("tr-TR");
  // "female" içinde "male" geçtiği için önce kadın ipuçları
  if (FEMALE_HINTS.some((h) => n.includes(h))) return "female";
  if (MALE_HINTS.some((h) => new RegExp(`(^|[^a-zçğıöşü])${h}([^a-zçğıöşü]|$)`).test(n))) return "male";
  return null;
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/** Türkçe sesleri döndürür. Sesler bazı tarayıcılarda geç yüklendiği için bekler. */
export function loadTurkishVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (!speechSynthesisSupported()) return Promise.resolve([]);
  const pick = () => window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("tr"));
  const now = pick();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      resolve(pick());
    };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    setTimeout(done, timeoutMs);
  });
}

export function chooseVoice(voices: SpeechSynthesisVoice[], preferredName: string | null, gender: VoiceGender): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  if (preferredName) {
    const exact = voices.find((v) => v.name === preferredName);
    if (exact) return exact;
  }
  const byGender = voices.filter((v) => guessGender(v.name) === gender);
  const pool = byGender.length ? byGender : voices;
  return pool.find((v) => v.localService) ?? pool[0];
}

/** Tarayıcının Web Speech API motoru (ücretsiz, çevrimdışı çalışabilir). */
export class WebSpeechEngine implements SpeechEngine {
  readonly kind = "webspeech" as const;
  readonly label: string;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private current: SpeechSynthesisUtterance | null = null;

  constructor(private voice: SpeechSynthesisVoice) {
    this.label = `Tarayıcı sesi: ${voice.name}`;
  }

  speak(text: string, o: SpeakOptions) {
    this.cancel();
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.voice = this.voice;
    u.lang = this.voice.lang || "tr-TR";
    u.rate = o.rate;
    u.pitch = 1;
    let finished = false;
    const finish = (fn: () => void) => {
      if (finished) return;
      finished = true;
      this.clearWatchdog();
      fn();
    };
    u.onstart = () => o.onStart?.();
    u.onend = () => finish(o.onEnd);
    u.onerror = (e) => {
      // iptal kaynaklı "interrupted/canceled" hataları normal akıştır
      if (e.error === "interrupted" || e.error === "canceled") return finish(() => undefined);
      finish(() => o.onError(e.error === "not-allowed" ? "Tarayıcı sesi başlatmaya izin vermedi. Oynat düğmesine dokun." : "Seslendirme sırasında bir sorun oluştu."));
    };
    this.current = u; // Safari'de çöp toplayıcının olayı yutmaması için referans tut
    // Bazı tarayıcılar onend olayını hiç göndermez: güvenlik zamanlayıcısı
    this.watchdog = setTimeout(() => finish(o.onEnd), estimateDurationMs(text, o.rate) * 2.5 + 4000);
    if (synth.paused) synth.resume();
    synth.speak(u);
  }

  cancel() {
    this.clearWatchdog();
    if (this.current) {
      this.current.onend = null;
      this.current.onerror = null;
      this.current = null;
    }
    if (speechSynthesisSupported()) window.speechSynthesis.cancel();
  }

  private clearWatchdog() {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
  }
}

/** Sunucu tarafı TTS (ör. OpenAI). Ses dosyaları yalnızca bellekte tutulur, kalıcı saklanmaz. */
export class ServerTtsEngine implements SpeechEngine {
  readonly kind = "server" as const;
  readonly label: string;
  private audio: HTMLAudioElement | null = null;
  private abort: AbortController | null = null;
  private static cache = new Map<string, string>();

  constructor(private gender: VoiceGender) {
    this.label = gender === "female" ? "Doğal ses (kadın öğretmen)" : "Doğal ses (erkek öğretmen)";
  }

  speak(text: string, o: SpeakOptions) {
    this.cancel();
    const key = `${this.gender}|${text}`;
    const ac = new AbortController();
    this.abort = ac;
    const play = (url: string) => {
      if (ac.signal.aborted) return;
      const audio = new Audio(url);
      audio.playbackRate = o.rate;
      audio.onended = () => o.onEnd();
      audio.onerror = () => o.onError("Ses dosyası oynatılamadı.");
      this.audio = audio;
      audio.play().then(() => o.onStart?.(), () => o.onError("Ses oynatılamadı. Oynat düğmesine dokun."));
    };
    const cached = ServerTtsEngine.cache.get(key);
    if (cached) return play(cached);
    fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, voice: this.gender }),
      signal: ac.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.message ?? "Sunucu sesi alınamadı.");
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        if (ServerTtsEngine.cache.size > 60) {
          const first = ServerTtsEngine.cache.keys().next().value as string;
          URL.revokeObjectURL(ServerTtsEngine.cache.get(first)!);
          ServerTtsEngine.cache.delete(first);
        }
        ServerTtsEngine.cache.set(key, url);
        play(url);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        o.onError(e instanceof Error ? e.message : "Sunucu sesi alınamadı.");
      });
  }

  cancel() {
    this.abort?.abort();
    this.abort = null;
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio = null;
    }
  }
}

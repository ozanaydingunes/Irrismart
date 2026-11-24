"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Web Speech API konuşma tanıma için en küçük tür tanımları (tarayıcı türlerinde yok) */
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported() {
  return !!getCtor();
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Mikrofon izni verilmedi. Tarayıcı ayarlarından bu site için mikrofona izin verebilirsin.",
  "service-not-allowed": "Bu tarayıcıda konuşma tanıma kullanılamıyor.",
  "no-speech": "Ses algılanamadı. Mikrofona biraz daha yakın konuşup tekrar dene.",
  network: "Konuşma tanıma için internet bağlantısı gerekiyor.",
  "audio-capture": "Mikrofon bulunamadı.",
};

/**
 * Mikrofonla Türkçe konuşma tanıma. Ses kaydı uygulama tarafından saklanmaz;
 * yalnızca tanınan metin kullanılır.
 */
export function useSpeechRecognition(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError("Bu tarayıcı sesle soru sormayı desteklemiyor. Chrome, Edge veya Safari'yi deneyebilir ya da soruyu yazabilirsin.");
      return;
    }
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = "tr-TR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) onFinalRef.current(finalText.trim());
    };
    rec.onerror = (e) => {
      if (e.error !== "aborted") setError(ERRORS[e.error] ?? "Ses anlaşılamadı. Tekrar dener misin?");
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    setError(null);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Mikrofon başlatılamadı.");
    }
  }, []);

  useEffect(() => () => recRef.current?.abort(), []);

  return { listening, interim, error, start, stop, supported: speechRecognitionSupported() };
}

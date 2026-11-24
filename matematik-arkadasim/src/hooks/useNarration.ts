"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { SilentEngine, type SpeechEngine } from "@/lib/speech/engine";
import { chooseVoice, loadTurkishVoices, ServerTtsEngine, speechSynthesisSupported, WebSpeechEngine } from "@/lib/speech/browserEngines";
import { NarrationController, type NarrationState } from "@/lib/speech/narrationController";
import { useSettings } from "./useSettings";
import { useStatus } from "./useStatus";

export type VoiceAvailability = "checking" | "ok" | "no-turkish" | "unsupported" | "disabled";

/**
 * Anlatım denetleyicisini ayarlara göre uygun ses motoruyla kurar.
 * Türkçe ses yoksa yazılı anlatıma (SilentEngine) geçer ve kullanıcıya alternatif önerir.
 */
export function useNarration(narrations: string[], options: { shouldWaitAfterStep?: (i: number) => boolean } = {}) {
  const [settings] = useSettings();
  const status = useStatus();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[] | null>(null);
  const [controller] = useState(() => new NarrationController(new SilentEngine(), { gapMs: 700 }));
  // Özel ders yanıtları gibi adım dışı konuşmalar için ikinci kuyruk
  const [aside] = useState(() => new NarrationController(new SilentEngine(), { gapMs: 0 }));

  useEffect(() => {
    let alive = true;
    loadTurkishVoices().then((v) => alive && setVoices(v));
    return () => {
      alive = false;
    };
  }, []);

  const availability: VoiceAvailability = !settings.voiceEnabled
    ? "disabled"
    : !speechSynthesisSupported() && settings.ttsEngine !== "server"
      ? "unsupported"
      : voices === null
        ? "checking"
        : voices.length || settings.ttsEngine === "server"
          ? "ok"
          : "no-turkish";

  const engine: SpeechEngine = useMemo(() => {
    if (!settings.voiceEnabled) return new SilentEngine();
    if (settings.ttsEngine === "server" && status?.serverTts) return new ServerTtsEngine(settings.voiceGender);
    const v = voices ? chooseVoice(voices, settings.voiceName, settings.voiceGender) : null;
    if (v) return new WebSpeechEngine(v);
    if (status?.serverTts && voices && !voices.length) return new ServerTtsEngine(settings.voiceGender);
    return new SilentEngine();
  }, [settings.voiceEnabled, settings.ttsEngine, settings.voiceGender, settings.voiceName, voices, status?.serverTts]);

  useEffect(() => {
    controller.setEngine(engine);
    aside.setEngine(engine);
  }, [controller, aside, engine]);

  useEffect(() => {
    controller.setRate(settings.rate);
    aside.setRate(settings.rate);
  }, [controller, aside, settings.rate]);

  const key = narrations.join("\u0000");
  useEffect(() => {
    controller.load(narrations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, key]);

  useEffect(() => {
    controller.setShouldWaitAfterStep(options.shouldWaitAfterStep);
  }, [controller, options.shouldWaitAfterStep]);

  useEffect(
    () => () => {
      controller.stop();
      aside.stop();
    },
    [controller, aside],
  );

  // Sekme gizlenince sesi duraklat (Chrome arka planda konuşmayı keser)
  useEffect(() => {
    const onHide = () => {
      if (!document.hidden) return;
      controller.pause();
      aside.stop();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [controller, aside]);

  const state: NarrationState = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const asideState: NarrationState = useSyncExternalStore(aside.subscribe, aside.getState, aside.getState);

  /** Ana anlatımı duraklatıp kısa bir metni seslendirir (ör. öğretmenin özel ders yanıtı). */
  const speakAside = (text: string) => {
    if (!settings.voiceEnabled) return;
    controller.pause();
    aside.load([text]);
    aside.play();
  };
  const stopAside = () => aside.stop();

  return { controller, state, engineLabel: engine.label, availability, serverTtsAvailable: !!status?.serverTts, speakAside, stopAside, asideSpeaking: asideState.status === "playing" };
}

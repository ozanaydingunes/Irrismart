"use client";

import { useEffect } from "react";
import { addStudySeconds } from "@/lib/storage/db";

/**
 * Günlük çalışma süresi: yalnızca sayfa görünürken ve öğrenci son 90 saniyede etkileşimdeyken
 * (dokunma, yazma, kaydırma) ya da ses oynarken sayılır. Veriler yalnızca bu cihazda tutulur.
 */
export function StudyTimer() {
  useEffect(() => {
    let lastActivity = Date.now();
    let pending = 0;
    const mark = () => (lastActivity = Date.now());
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const tick = setInterval(() => {
      const speaking = typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.speaking;
      if (document.visibilityState === "visible" && (Date.now() - lastActivity < 90_000 || speaking)) pending += 5;
    }, 5000);
    const flush = () => {
      if (pending > 0) {
        const s = pending;
        pending = 0;
        addStudySeconds(s).catch(() => undefined);
      }
    };
    const flusher = setInterval(flush, 30_000);
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      clearInterval(tick);
      clearInterval(flusher);
      events.forEach((e) => window.removeEventListener(e, mark));
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, []);
  return null;
}

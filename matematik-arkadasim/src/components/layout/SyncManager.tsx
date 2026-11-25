"use client";

import { useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useStatus } from "@/hooks/useStatus";
import { DATA_EVENT } from "@/lib/storage/db";
import { syncNow } from "@/lib/storage/sync";

/** Cihazlar arası eşitlemeyi arka planda tetikler (ev sunucusu destekliyorsa ve PIN girilmişse). */
export function SyncManager() {
  const status = useStatus();
  const [settings] = useSettings();
  const enabled = !!status?.syncAvailable && status.authenticated && settings.syncEnabled;

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void syncNow(), ms);
    };
    soon(1500); // açılışta
    const onData = () => soon(4000); // değişiklikten kısa süre sonra
    const onOnline = () => soon(1000);
    const onVisible = () => document.visibilityState === "visible" && soon(1000);
    const every = setInterval(() => document.visibilityState === "visible" && void syncNow(), 3 * 60_000);
    window.addEventListener(DATA_EVENT, onData);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(every);
      window.removeEventListener(DATA_EVENT, onData);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  return null;
}

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { StatusResponse } from "@/lib/schema/api";

let cached: StatusResponse | null = null;
export const HOSTING_KEY = "matematik-arkadasim:barindirma";
let inflight: Promise<StatusResponse | null> | null = null;

function fetchStatus(): Promise<StatusResponse | null> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/api/status", { cache: "no-store", signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? (r.json() as Promise<StatusResponse>) : null))
      .then((s) => {
        cached = s;
        setReachable(s !== null);
        try {
          // Bağlantı koptuğunda doğru uyarıyı gösterebilmek için: ev bilgisayarı mı, internet sitesi mi?
          if (s) localStorage.setItem(HOSTING_KEY, s.providerKind === "ollama" ? "ev" : "bulut");
        } catch {
          /* yoksay */
        }
        return s;
      })
      .catch(() => {
        setReachable(false);
        return null;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

const listeners = new Set<(s: StatusResponse | null) => void>();

/** PIN girişi gibi durum değişikliklerinden sonra durumu yeniden yükler. */
export async function refreshStatus() {
  cached = null;
  const s = await fetchStatus();
  listeners.forEach((l) => l(s));
  return s;
}

/** Sunucunun YZ durumu (gerçek / demo, PIN). Çevrimdışıyken null. */
export function useStatus() {
  const [status, setStatus] = useState<StatusResponse | null>(cached);
  useEffect(() => {
    let alive = true;
    const l = (s: StatusResponse | null) => alive && setStatus(s);
    listeners.add(l);
    fetchStatus().then(l);
    return () => {
      alive = false;
      listeners.delete(l);
    };
  }, []);
  return status;
}


/* ───── Pi Hoca bilgisayarına (ev sunucusuna) ulaşılabiliyor mu? ───── */
let reachable: boolean | null = null; // null: henüz bilinmiyor
const reachListeners = new Set<() => void>();
function setReachable(v: boolean) {
  if (reachable === v) return;
  reachable = v;
  reachListeners.forEach((l) => l());
}

/** true: ulaşılıyor, false: ulaşılamıyor, null: henüz denenmedi */
export function useServerReachable(): boolean | null {
  return useSyncExternalStore(
    (cb) => {
      reachListeners.add(cb);
      return () => reachListeners.delete(cb);
    },
    () => reachable,
    () => null,
  );
}

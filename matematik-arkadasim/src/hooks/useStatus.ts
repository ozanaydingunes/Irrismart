"use client";

import { useEffect, useState } from "react";
import type { StatusResponse } from "@/lib/schema/api";

let cached: StatusResponse | null = null;
let inflight: Promise<StatusResponse | null> | null = null;

function fetchStatus(): Promise<StatusResponse | null> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/api/status", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<StatusResponse>) : null))
      .then((s) => {
        cached = s;
        return s;
      })
      .catch(() => null)
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

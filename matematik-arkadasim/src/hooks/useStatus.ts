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

/** Sunucunun YZ durumu (gerçek / demo). Çevrimdışıyken null. */
export function useStatus() {
  const [status, setStatus] = useState<StatusResponse | null>(cached);
  useEffect(() => {
    let alive = true;
    fetchStatus().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}

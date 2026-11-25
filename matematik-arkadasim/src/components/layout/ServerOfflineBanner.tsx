"use client";

import { Loader2, MonitorOff, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useOnline } from "@/hooks/useOnline";
import { HOSTING_KEY, refreshStatus, useServerReachable } from "@/hooks/useStatus";

function hosting() {
  try {
    return localStorage.getItem(HOSTING_KEY);
  } catch {
    return null;
  }
}

/**
 * Pi Hoca'nın sunucusuna (internet sitesi veya ev bilgisayarı) ulaşılamıyorsa anlaşılır Türkçe uyarı.
 * Uygulama önbellekten açılmış olabilir; soru defteri bu sırada kullanılabilir.
 */
export function ServerOfflineBanner() {
  const online = useOnline();
  const reachable = useServerReachable();
  const [busy, setBusy] = useState(false);

  // Ulaşılamıyorsa arada bir kendiliğinden tekrar dene
  useEffect(() => {
    if (reachable !== false) return;
    const t = setInterval(() => void refreshStatus(), 20_000);
    return () => clearInterval(t);
  }, [reachable]);

  if (!online || reachable !== false) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2.5 text-sm" role="alert">
      <MonitorOff className="size-5 shrink-0 text-warning-strong" aria-hidden />
      <span className="min-w-0 flex-1">
        <b className="text-warning-strong">Pi Hoca&apos;ya şu an ulaşılamıyor.</b>{" "}
        {hosting() === "ev"
          ? "Evdeki bilgisayar açık mı? Ev dışındaysan telefondaki Tailscale açık mı?"
          : "İnternet bağlantını kontrol et ya da biraz sonra tekrar dene."}{" "}
        Bu sırada Soru Defterim&apos;deki kayıtlı soruları çalışabilirsin.
      </span>
      <button
        type="button"
        onClick={async () => {
          setBusy(true);
          await refreshStatus();
          setBusy(false);
        }}
        className="flex min-h-11 items-center gap-1.5 rounded-xl bg-card px-3 font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Tekrar dene
      </button>
    </div>
  );
}

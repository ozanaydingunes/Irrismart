"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/useSettings";
import type { StatusResponse } from "@/lib/schema/api";
import { readMeta, SYNC_EVENT, syncNow } from "@/lib/storage/sync";

function subscribe(cb: () => void) {
  window.addEventListener(SYNC_EVENT, cb);
  return () => window.removeEventListener(SYNC_EVENT, cb);
}
const snap = () => {
  try {
    return localStorage.getItem("matematik-arkadasim:esitleme") ?? "";
  } catch {
    return "";
  }
};

function ago(t: number) {
  if (!t) return "henüz yapılmadı";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "az önce";
  if (s < 3600) return `${Math.round(s / 60)} dk önce`;
  return new Date(t).toLocaleString("tr-TR");
}

/** Cihazlar arası eşitleme durumu ve elle eşitleme. */
export function SyncSettings({ status }: { status: StatusResponse | null }) {
  const [settings, save] = useSettings();
  const raw = useSyncExternalStore(subscribe, snap, () => "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const meta = raw ? (JSON.parse(raw) as ReturnType<typeof readMeta>) : null;

  if (!status?.syncAvailable) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="size-5 text-primary" /> Cihazlar arası eşitleme
        </CardTitle>
        <CardDescription>
          Soru defteri ve gelişim bilgileri telefon, tablet ve bilgisayar arasında yalnızca evdeki Pi Hoca bilgisayarı üzerinden eşitlenir. Fotoğraflar eşitlenmez; başka bir şirketin sunucusu kullanılmaz.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">Otomatik eşitle</span>
          <Switch checked={settings.syncEnabled} onCheckedChange={(v) => save({ syncEnabled: v })} aria-label="Otomatik eşitle" />
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Son eşitleme: {ago(meta?.lastSyncAt ?? 0)}
          {meta?.lastError ? ` · ${meta.lastError}` : ""}
        </p>
        <Button
          variant="outline"
          className="self-start"
          disabled={busy || !status.authenticated}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            const r = await syncNow();
            setBusy(false);
            setMsg(r.ok ? `Eşitlendi (${r.pushed} gönderildi, ${r.pulled} alındı).` : r.message);
          }}
        >
          {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Şimdi eşitle
        </Button>
        {!status.authenticated && status.accessRequired && <p className="text-sm text-muted-foreground">Eşitleme için önce Soru Çöz ekranında aile PIN&apos;ini gir.</p>}
        {msg && (
          <p className="text-sm" role="status">
            {msg}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

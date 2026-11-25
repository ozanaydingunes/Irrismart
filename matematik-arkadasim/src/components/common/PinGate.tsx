"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { refreshStatus } from "@/hooks/useStatus";

/** Aile PIN'i: yapay zekâ kullanımını yetkisiz kişilere karşı korur. Defter ve konular PIN'siz açılır. */
export function PinGate({ onDone }: { onDone?: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (r.ok && j?.ok) {
        await refreshStatus();
        onDone?.();
      } else setError(j?.message ?? "PIN doğrulanamadı.");
    } catch {
      setError("Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.");
    }
    setBusy(false);
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <KeyRound className="size-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Aile PIN&apos;i</h2>
          <p className="text-sm text-muted-foreground">Yapay zekâ öğretmeni kullanmak için evdeki yetişkinin belirlediği PIN&apos;i gir. Bu cihaz 30 gün hatırlanır.</p>
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <Input type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" aria-label="Aile PIN'i" maxLength={32} />
          <Button type="submit" disabled={busy || !pin.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : null} Giriş
          </Button>
        </form>
        {error && (
          <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

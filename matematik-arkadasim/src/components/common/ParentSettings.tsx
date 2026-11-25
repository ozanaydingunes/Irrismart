"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { refreshStatus } from "@/hooks/useStatus";
import type { StatusResponse } from "@/lib/schema/api";

/** Ebeveyn ayarları: günlük soru sınırı (sunucuda uygulanır), ebeveyn PIN'iyle korunur. */
export function ParentSettings({ status }: { status: StatusResponse | null }) {
  const [pin, setPin] = useState("");
  const [limit, setLimit] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(limit);
    if (!pin.trim() || !Number.isInteger(n)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/parent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin, dailyQuestions: n }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (r.ok && j?.ok) {
        setMsg({ ok: true, text: n === 0 ? "Günlük soru sınırı kaldırıldı." : `Günlük soru sınırı ${n} olarak kaydedildi.` });
        setPin("");
        await refreshStatus();
      } else setMsg({ ok: false, text: j?.message ?? "Kaydedilemedi." });
    } catch {
      setMsg({ ok: false, text: "Sunucuya ulaşılamadı." });
    }
    setBusy(false);
  }

  const lim = status?.dailyQuestionLimit ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" /> Ebeveyn ayarları
        </CardTitle>
        <CardDescription>
          {status
            ? `Bugün çözülen soru: ${status.questionsUsedToday}${lim > 0 ? ` / ${lim}` : " (sınır yok)"}. Sınır sunucuda uygulanır ve her gece sıfırlanır.`
            : "Durum bilgisi alınamadı."}
          {status && !status.paidAllowed && " Ücretli yapay zekâ ve ücretli seslendirme kapalı."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status?.parentPinSet ? (
          <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Yeni günlük soru sınırı
              <Input type="number" inputMode="numeric" min={0} max={200} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder={String(lim || 10)} className="w-32" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Ebeveyn PIN&apos;i
              <Input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} className="w-40" maxLength={32} />
            </label>
            <Button type="submit" disabled={busy || !pin.trim() || limit === ""}>
              {busy && <Loader2 className="animate-spin" />} Kaydet
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Sınırı buradan değiştirmek için kurulumda bir ebeveyn PIN&apos;i (PARENT_PIN) tanımlayın. Tanımlanana kadar sınır kurulum dosyasındaki değerdir.</p>
        )}
        {msg && (
          <p className={`mt-3 rounded-xl p-3 text-sm ${msg.ok ? "bg-success/12 text-success-strong" : "bg-destructive/10 text-destructive"}`} role="status">
            {msg.text}
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">0 yazarsanız sınır kaldırılır. Ebeveyn PIN&apos;i, çocuğun bildiği aile PIN&apos;inden farklı olmalıdır.</p>
      </CardContent>
    </Card>
  );
}

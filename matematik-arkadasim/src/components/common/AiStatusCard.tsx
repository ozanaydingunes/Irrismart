"use client";

import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StatusResponse } from "@/lib/schema/api";

/**
 * Ücretsiz yapay zekâ durumu (ebeveyn için). Soru sayısı veya "kalan hak" GÖSTERİLMEZ: uygulama soru sınırı
 * koymaz. Tüketim gerçek ölçüm değil tahmin olduğu için yalnızca durum (kullanılabilir / bugün doldu) yazılır.
 */
export function AiStatusCard({ status }: { status: StatusResponse | null }) {
  if (!status || status.mode !== "ai" || !status.freeAi.length) return null;
  const allFull = status.freeAi.every((p) => p.state === "full");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" /> Ücretsiz yapay zekâ durumu
        </CardTitle>
        <CardDescription>
          Soru sınırı yok. Ücretsiz sağlayıcıların günlük kapasitesi dolarsa Pi Hoca bir sonraki onaylı ücretsiz sağlayıcıya geçer; ücretli bir hizmete asla geçilmez. Kapasiteler her gün 03:00&apos;te (00:00 UTC) yenilenir.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <ul className="flex flex-col gap-2" aria-label="Ücretsiz sağlayıcılar">
          {status.freeAi.map((p, i) => (
            <li key={p.kind} className="flex items-center justify-between gap-3 rounded-2xl border p-3">
              <span>
                <b>{i === 0 ? "Birincil" : "Yedek"}:</b> {p.name}
              </span>
              <span className={p.state === "ok" ? "font-semibold text-success-strong" : "font-semibold text-warning-strong"}>{p.state === "ok" ? "Kullanılabilir" : "Bugünkü ücretsiz kapasite doldu"}</span>
            </li>
          ))}
        </ul>
        {allFull && <p role="status">Bugünkü ücretsiz kapasitenin tamamı doldu. Yarın tekrar devam edebiliriz; basit işlem ve denklemler yine yapay zekâsız çözülür.</p>}
        <p className="text-muted-foreground">Durum, uygulamanın kendi tahminine dayanır; sağlayıcının gerçek tüketim ölçümü değildir.</p>
        {!status.syncAvailable && <p className="text-muted-foreground">Soru defteri ve gelişim bilgileri her cihazın kendi hafızasında tutulur; buluta eşitleme kapalıdır.</p>}
        {status.modelCredit && <p className="text-xs text-muted-foreground">{status.modelCredit}</p>}
      </CardContent>
    </Card>
  );
}

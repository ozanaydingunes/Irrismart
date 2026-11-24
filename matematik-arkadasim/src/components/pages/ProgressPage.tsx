"use client";

import { BarChart3, CheckCircle2, Clock, Flame, Loader2, RefreshCcw, Target, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { computeStats, formatDuration, type Stats } from "@/lib/stats/stats";
import { DATA_EVENT, loadAllStats } from "@/lib/storage/db";
import { cn } from "@/lib/utils";

export function ProgressPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = () => loadAllStats().then((d) => setStats(computeStats(d))).catch(() => setStats(computeStats({ answers: [], lessons: [], study: [], notebook: [] })));
    load();
    window.addEventListener(DATA_EVENT, load);
    return () => window.removeEventListener(DATA_EVENT, load);
  }, []);

  if (!stats) return <Loader2 className="mx-auto mt-10 size-8 animate-spin text-primary" />;

  if (!stats.hasData) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Gelişimim</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <BarChart3 className="size-12 text-primary" />
            <p className="text-lg font-bold">Henüz veri yok</p>
            <p className="max-w-md text-muted-foreground">
              Soru çözdükçe, cevap verdikçe ve çalıştıkça gerçek ilerlemen burada görünecek. Uydurma istatistik göstermiyoruz; her şey senin gerçek kullanımından hesaplanır.
            </p>
            <Button asChild>
              <Link href="/coz">İlk sorunu çöz</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const maxSec = Math.max(...stats.week.map((d) => d.seconds), 60);
  const answered = stats.correct + stats.wrong;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Gelişimim</h1>
        <p className="text-muted-foreground">Bu cihazdaki gerçek çalışma verilerinden hesaplanır.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<Target />} label="Çözülen soru" value={String(stats.solvedCount)} />
        <StatTile icon={<CheckCircle2 />} label="Doğru / Yanlış" value={answered ? `${stats.correct} / ${stats.wrong}` : "—"} hint={answered ? undefined : "Henüz cevap kontrolü yok"} />
        <StatTile icon={<Flame />} label="Başarı oranı" value={stats.successRate === null ? "—" : `%${stats.successRate}`} hint={stats.successRate === null ? "Sınav modu veya kendini değerlendirme ile oluşur" : undefined} />
        <StatTile icon={<Clock />} label="Bugünkü çalışma" value={formatDuration(stats.todaySeconds)} hint={`Bu hafta: ${formatDuration(stats.weekSeconds)}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Haftalık ilerleme</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-end gap-2" role="img" aria-label="Son 7 günün çalışma süreleri">
            {stats.week.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-semibold text-muted-foreground">{d.seconds ? formatDuration(d.seconds) : ""}</span>
                <div className="flex w-full flex-1 items-end">
                  <div className={cn("w-full rounded-t-xl bg-primary/80 transition-all", !d.seconds && "bg-muted")} style={{ height: `${Math.max(4, (d.seconds / maxSec) * 100)}%` }} />
                </div>
                <span className="text-xs font-bold">{d.label}</span>
                <span className="text-[11px] text-muted-foreground">{d.lessons} soru</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Konulara göre gelişim</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {stats.topics.length === 0 && <p className="text-muted-foreground">Henüz konu verisi yok.</p>}
            {stats.topics.map((t) => (
              <div key={t.topicId}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="font-semibold">{t.title}</span>
                  <span className="text-muted-foreground">
                    {t.lessons} ders{t.correct + t.wrong ? ` · ${t.correct} doğru, ${t.wrong} yanlış` : ""}
                  </span>
                </div>
                {t.successRate !== null ? (
                  <Progress value={t.successRate} label={`${t.title} başarı oranı`} barClassName={t.successRate < 60 ? "bg-destructive" : t.successRate < 80 ? "bg-warning" : "bg-success"} />
                ) : (
                  <p className="text-xs text-muted-foreground">Başarı oranı için bu konuda cevap ver.</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="size-5 text-destructive" /> En çok zorlandığın konular
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.struggling.length ? (
                <ul className="flex flex-col gap-2">
                  {stats.struggling.map((t) => (
                    <li key={t.topicId} className="flex items-center justify-between rounded-2xl bg-destructive/8 p-3">
                      <span className="font-semibold">{t.title}</span>
                      <span className="text-sm">%{t.successRate} başarı</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Şimdilik belirgin bir zorlandığın konu yok (en az 2 cevap gerekir).</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCcw className="size-5 text-primary" /> Tekrar edilmesi gereken konular
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {stats.reviewTopics.length ? (
                stats.reviewTopics.map((t) => (
                  <div key={t.topicId} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/60 p-3">
                    <div>
                      <div className="font-semibold">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{t.reason}</div>
                    </div>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/coz?practice=${t.topicId}`}>Alıştırma yap</Link>
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">Tekrar bekleyen konu yok. 🎉</p>
              )}
              {stats.dueReviews > 0 && (
                <Button asChild>
                  <Link href="/defter?f=review">Tekrar zamanı gelen {stats.dueReviews} soruyu aç</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground [&_svg]:size-5">{icon}</div>
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

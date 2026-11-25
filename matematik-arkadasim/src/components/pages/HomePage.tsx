"use client";

import { ArrowRight, BookMarked, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Mascot } from "@/components/home/Mascot";
import { QuickActions } from "@/components/home/QuickActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSettings } from "@/hooks/useSettings";
import { useStatus } from "@/hooks/useStatus";
import { computeStats, formatDuration, type Stats } from "@/lib/stats/stats";
import { DATA_EVENT, listEntries, loadAllStats, type NotebookEntry } from "@/lib/storage/db";

const noopSubscribe = () => () => {};

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "İyi geceler";
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

/** Sade ana ekran: önce üç temel işlem, sonra (varsa) kısa bilgi. */
export function HomePage() {
  const [settings] = useSettings();
  const status = useStatus();
  const [recent, setRecent] = useState<NotebookEntry[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  // Saat dilimine bağlı selamlama yalnızca tarayıcıda hesaplanır (hidrasyon uyumsuzluğunu önler)
  const hello = useSyncExternalStore(noopSubscribe, greeting, () => "Merhaba");

  useEffect(() => {
    const load = () => {
      listEntries().then((e) => setRecent(e.slice(0, 3))).catch(() => setRecent([]));
      loadAllStats().then((d) => setStats(computeStats(d))).catch(() => undefined);
    };
    load();
    window.addEventListener(DATA_EVENT, load);
    return () => window.removeEventListener(DATA_EVENT, load);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 md:max-w-2xl">
      {/* Kompakt karşılama kartı + maskot */}
      <section className="flex items-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-br from-accent to-secondary p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-accent-foreground">
            {hello}
            {settings.nickname ? `, ${settings.nickname}` : ""}! 👋
          </p>
          <h1 className="text-xl font-extrabold leading-tight sm:text-2xl">Hangi soruyu birlikte çözelim?</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ben Pi Hoca. Tahtada adım adım, sesli anlatırım.</p>
        </div>
        <Mascot className="size-20 shrink-0 sm:size-24" />
      </section>

      {status?.mode === "demo" && (
        <p className="rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm leading-snug">
          <b className="text-warning-strong">Demo modu:</b> Yapay zekâ bağlı değil. Hazır örnekler ve basit işlemler (kesir, denklem, yüzde) kural tabanlı çözücüyle gösterilir; fotoğraf okunmaz.
        </p>
      )}

      <QuickActions />

      {stats && stats.dueReviews > 0 && (
        <Button asChild variant="secondary" size="lg" className="justify-between">
          <Link href="/defter?f=review">
            <span className="flex items-center gap-2">
              <RefreshCcw /> Tekrar zamanı gelen {stats.dueReviews} soru var
            </span>
            <ArrowRight />
          </Link>
        </Button>
      )}

      {recent && recent.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold">
                <BookMarked className="size-5 text-primary" /> Son sorularım
              </h2>
              <Link href="/defter" className="min-h-11 content-center text-sm font-semibold text-primary hover:underline">
                Tümü
              </Link>
            </div>
            <ul className="flex flex-col gap-2">
              {recent.map((e) => (
                <li key={e.id}>
                  <Link href={`/coz?entry=${e.id}&mode=full`} className="flex min-h-12 items-center gap-3 rounded-2xl bg-muted/60 p-3 hover:bg-muted">
                    <span className="line-clamp-2 flex-1 text-sm font-medium">{e.question}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {stats?.hasData && (
        <p className="text-center text-sm text-muted-foreground">
          Bugün {stats.week.at(-1)?.lessons ?? 0} soru · {formatDuration(stats.todaySeconds)} çalıştın.{" "}
          <Link href="/gelisim" className="font-semibold text-primary underline">
            Gelişimim
          </Link>
        </p>
      )}
    </div>
  );
}

"use client";

import { ArrowRight, BarChart3, BookMarked, Camera, Keyboard, Layers, Mic, RefreshCcw, Sparkles, Volume2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Logo } from "@/components/layout/Logo";
import { Badge } from "@/components/ui/badge";
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
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-[#8b6cf0] via-[#7b7ff2] to-[#5b9bef] p-6 text-white shadow-card sm:p-10">
        <div className="relative z-10 flex max-w-xl flex-col gap-4">
          <span className="text-sm font-semibold opacity-90">
            {hello}
            {settings.nickname ? `, ${settings.nickname}` : ""}! 👋
          </span>
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">Matematik Arkadaşın burada.</h1>
          <p className="text-base opacity-95 sm:text-lg">Sorunu göster; tahtada adım adım, sesli ve resimli anlatayım. Anlamadığın yerde durdur, istediğini sor.</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg" className="bg-white text-[#4b33b5] hover:bg-white/90">
              <Link href="/coz">
                <Camera /> Soru çöz
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/15">
              <Link href="/konular">
                <Layers /> Konulara göz at
              </Link>
            </Button>
          </div>
        </div>
        <Logo className="absolute -bottom-6 -right-6 size-48 rotate-12 opacity-25 sm:size-64" />
      </section>

      {status?.mode === "demo" && (
        <Card className="border-2 border-warning/50">
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="font-bold text-warning-strong">Demo modundasın</span>
            <span className="text-sm">Yapay zekâ API anahtarı tanımlı olmadığı için uygulama demo modunda. Hazır örnekler ve basit işlemler (kesir, denklem, yüzde) kural tabanlı çözücüyle gösterilir; bunlar yapay zekâ çözümü değildir.</span>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="nasil" className="grid gap-3 sm:grid-cols-3">
        <h2 id="nasil" className="sr-only">
          Nasıl soru sorarım?
        </h2>
        {[
          { icon: Camera, title: "Fotoğrafla", text: "Kitaptaki soruyu çek, kırp, gönder." },
          { icon: Keyboard, title: "Yazarak", text: "Sembol klavyesiyle kolayca yaz." },
          { icon: Mic, title: "Sesle", text: "Sorunu söyle, ben yazıya dökerim." },
        ].map(({ icon: Icon, title, text }) => (
          <Link key={title} href="/coz" className="group rounded-3xl border border-border bg-card p-4 shadow-card transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
            <span className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <Icon className="size-6" />
            </span>
            <div className="font-bold">{title}</div>
            <div className="text-sm text-muted-foreground">{text}</div>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <BookMarked className="size-5 text-primary" /> Son sorularım
              </h2>
              <Link href="/defter" className="text-sm font-semibold text-primary hover:underline">
                Tümü
              </Link>
            </div>
            {recent === null ? null : recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz deftere kaydedilmiş soru yok. Bir soru çözünce “Deftere kaydet” diyebilirsin.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recent.map((e) => (
                  <li key={e.id}>
                    <Link href={`/coz?entry=${e.id}&mode=full`} className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3 hover:bg-muted">
                      <span className="line-clamp-2 flex-1 text-sm font-medium">{e.question}</span>
                      <Badge variant="secondary">{e.topic}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <BarChart3 className="size-5 text-primary" /> Bugün
              </h2>
              <Link href="/gelisim" className="text-sm font-semibold text-primary hover:underline">
                Gelişimim
              </Link>
            </div>
            {!stats || !stats.hasData ? (
              <p className="text-sm text-muted-foreground">Çalışmaya başladığında gerçek ilerlemen burada görünecek.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-muted/60 p-3">
                  <div className="text-2xl font-extrabold">{stats.week.at(-1)?.lessons ?? 0}</div>
                  <div className="text-xs text-muted-foreground">çözülen soru</div>
                </div>
                <div className="rounded-2xl bg-muted/60 p-3">
                  <div className="text-2xl font-extrabold">{formatDuration(stats.todaySeconds)}</div>
                  <div className="text-xs text-muted-foreground">çalışma</div>
                </div>
                <div className="rounded-2xl bg-muted/60 p-3">
                  <div className="text-2xl font-extrabold">{stats.dueReviews}</div>
                  <div className="text-xs text-muted-foreground">tekrar bekliyor</div>
                </div>
              </div>
            )}
            {stats && stats.dueReviews > 0 && (
              <Button asChild variant="secondary">
                <Link href="/defter?f=review">
                  <RefreshCcw /> Tekrar zamanı gelen soruları çöz <ArrowRight />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card className="bg-accent/40">
          <CardContent className="flex items-start gap-3 p-5">
            <Volume2 className="mt-1 size-6 shrink-0 text-primary" />
            <div>
              <div className="font-bold">Sesli öğretmen</div>
              <p className="text-sm text-muted-foreground">Anlatımı durdur, geri sar, hızını ayarla. Matematik ifadeleri doğal Türkçe okunur: “x²” → “iksin karesi”.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-secondary/60">
          <CardContent className="flex items-start gap-3 p-5">
            <Sparkles className="mt-1 size-6 shrink-0 text-primary" />
            <div>
              <div className="font-bold">Sadece cevap değil</div>
              <p className="text-sm text-muted-foreground">Verilenler, istenen, her işlemin nedeni, kontrol ve sık yapılan hatalar. Reklam yok, üyelik yok.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

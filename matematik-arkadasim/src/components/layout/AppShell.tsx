"use client";

import { Menu, Settings, WifiOff } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { stopAllSpeech } from "@/lib/speech/browserEngines";
import { useOnline } from "@/hooks/useOnline";
import { useStatus } from "@/hooks/useStatus";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { MOBILE_PRIMARY, NAV_ITEMS } from "./nav";
import { StudyTimer } from "./StudyTimer";
import { ThemeSync } from "./ThemeSync";
import { ThemeToggle } from "./ThemeToggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const online = useOnline();
  const status = useStatus();
  const [moreOpen, setMoreOpen] = useState(false);
  // Sayfa değişince seslendirmeyi durdur
  useEffect(() => {
    stopAllSpeech();
  }, [pathname]);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const moreActive = ["/konular", "/gelisim", "/ayarlar"].some((h) => pathname.startsWith(h));

  return (
    <div className="flex min-h-dvh">
      <a href="#icerik" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        İçeriğe geç
      </a>
      {/* Masaüstü / tablet yan menü */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-2 border-r border-border bg-card/70 p-4 backdrop-blur md:flex">
        <Link href="/" className="mb-4 flex items-center gap-2 rounded-2xl p-2" aria-label="Matematik Arkadaşım ana sayfa">
          <Logo className="size-10" />
          <span className="text-lg font-extrabold leading-tight">
            Matematik
            <br />
            Arkadaşım
          </span>
        </Link>
        <nav aria-label="Ana menü" className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-2xl px-3 font-semibold transition-colors",
                isActive(href) ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          {status && (
            <span className={cn("rounded-xl px-3 py-2 text-xs font-semibold", status.mode === "demo" ? "bg-warning/15 text-warning-strong" : "bg-success/12 text-success-strong")}>
              {status.mode === "demo" ? "DEMO MODU — yapay zekâ bağlı değil" : "Yapay zekâ öğretmen hazır"}
            </span>
          )}
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobil üst çubuk */}
        <header className="safe-top sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-3 pb-1.5 backdrop-blur md:hidden">
          <Link href="/" className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/50" aria-label="Matematik Arkadaşım ana sayfa">
            <Logo className="size-8 shrink-0" />
            <span className="truncate text-[15px] font-extrabold max-[359px]:hidden">Matematik Arkadaşım</span>
            <span className="hidden text-[15px] font-extrabold max-[359px]:inline">Mat. Arkadaşım</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            {status?.mode === "demo" && <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-bold text-warning-strong">DEMO</span>}
            <Link
              href="/ayarlar"
              aria-label="Ayarlar"
              aria-current={pathname.startsWith("/ayarlar") ? "page" : undefined}
              className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/50"
            >
              <Settings className="size-5" />
            </Link>
          </div>
        </header>

        {!online && (
          <div className="flex items-center gap-2 bg-warning/20 px-4 py-2 text-sm font-medium text-warning-strong" role="status">
            <WifiOff className="size-4 shrink-0" /> Çevrimdışısın. Kayıtlı sorularını Soru Defterim&apos;den açabilirsin; yeni soru çözmek için internet gerekir.
          </div>
        )}

        <main id="icerik" className="main-safe mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pt-4 sm:px-6 md:pt-8">
          {children}
        </main>
      </div>

      {/* Mobil alt navigasyon: 3 temel sayfa + "Diğer" menüsü */}
      <nav aria-label="Alt menü" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <ul className="grid grid-cols-4">
          {NAV_ITEMS.filter((n) => (MOBILE_PRIMARY as readonly string[]).includes(n.href)).map(({ href, short, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn("nav-item flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-xs font-semibold", isActive(href) ? "text-primary" : "text-muted-foreground")}
              >
                <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors", isActive(href) && "bg-accent")}>
                  <Icon className="size-6" />
                </span>
                {short}
              </Link>
            </li>
          ))}
          <li>
            <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className={cn("nav-item flex min-h-16 w-full flex-col items-center justify-center gap-0.5 px-1 text-xs font-semibold", moreActive ? "text-primary" : "text-muted-foreground")}
                  aria-label="Diğer sayfalar"
                >
                  <span className={cn("flex h-8 w-14 items-center justify-center rounded-full", moreActive && "bg-accent")}>
                    <Menu className="size-6" />
                  </span>
                  Diğer
                </button>
              </DialogTrigger>
              <DialogContent className="sheet-bottom top-auto translate-y-0 data-[state=open]:animate-fade-in">
                <DialogTitle>Diğer</DialogTitle>
                <ul className="flex flex-col gap-2">
                  {NAV_ITEMS.filter((n) => !(MOBILE_PRIMARY as readonly string[]).includes(n.href)).map(({ href, label, icon: Icon }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => setMoreOpen(false)}
                        aria-current={isActive(href) ? "page" : undefined}
                        className={cn("flex min-h-14 items-center gap-3 rounded-2xl px-4 text-base font-semibold", isActive(href) ? "bg-primary text-primary-foreground" : "bg-muted/60 hover:bg-muted")}
                      >
                        <Icon className="size-5" /> {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </DialogContent>
            </Dialog>
          </li>
        </ul>
      </nav>
      <StudyTimer />
      <ThemeSync />
    </div>
  );
}

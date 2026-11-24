"use client";

import { ChevronDown, PencilRuler, PlayCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MathTex } from "@/components/math/MathTex";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useStatus } from "@/hooks/useStatus";
import { DEMO_TOPICS_WITH_PRACTICE } from "@/lib/demo/tutor";
import { TOPICS } from "@/lib/topics";
import { cn } from "@/lib/utils";

export function TopicsPage() {
  const status = useStatus();
  const [open, setOpen] = useState<string | null>(null);
  const units = [...new Set(TOPICS.map((t) => t.unit))];
  const demo = status?.mode === "demo";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Konular</h1>
        <p className="text-muted-foreground">7. sınıf matematik konuları. Kuralları hatırla, örnek çöz, alıştırma yap.</p>
      </div>
      {units.map((unit) => (
        <section key={unit} aria-labelledby={`u-${unit}`} className="flex flex-col gap-3">
          <h2 id={`u-${unit}`} className="text-lg font-bold text-primary">
            {unit}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {TOPICS.filter((t) => t.unit === unit).map((t) => {
              const isOpen = open === t.id;
              const canPractice = !demo || DEMO_TOPICS_WITH_PRACTICE.includes(t.id);
              return (
                <Card key={t.id} className={cn("overflow-hidden transition-all", isOpen && "md:col-span-2")}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : t.id)} aria-expanded={isOpen} aria-controls={`t-${t.id}`} className="flex w-full items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/30">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-2xl" aria-hidden>
                      {t.emoji}
                    </span>
                    <span className="flex-1">
                      <span className="block font-bold">{t.title}</span>
                      <span className="block text-sm text-muted-foreground">{t.summary}</span>
                    </span>
                    <ChevronDown className={cn("size-5 shrink-0 transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div id={`t-${t.id}`} className="flex flex-col gap-4 border-t border-border p-4">
                      <ul className="flex flex-col gap-2">
                        {t.rules.map((r, i) => (
                          <li key={i} className="rounded-2xl bg-muted/60 p-3">
                            <p>{r.text}</p>
                            {r.latex && (
                              <div className="mt-1 overflow-x-auto text-center">
                                <MathTex latex={r.latex} />
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                      <div className="rounded-2xl border-2 border-dashed border-primary/40 p-3">
                        <div className="text-sm font-bold text-primary">Örnek soru</div>
                        <p>{t.example.question}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild>
                          <Link href={`/coz?q=${encodeURIComponent(t.example.question)}&mode=full`}>
                            <PlayCircle /> Örneği öğretmenle çöz
                          </Link>
                        </Button>
                        {canPractice && (
                          <Button asChild variant="secondary">
                            <Link href={`/coz?practice=${t.id}`}>
                              <PencilRuler /> Alıştırma yap
                            </Link>
                          </Button>
                        )}
                        {!demo && (
                          <Button asChild variant="outline">
                            <Link href={`/coz?q=${encodeURIComponent(`${t.title} konusunu bana kısa bir örnek soru üzerinden adım adım anlatır mısın?`)}&mode=full`}>
                              <Sparkles /> Konuyu baştan anlat
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

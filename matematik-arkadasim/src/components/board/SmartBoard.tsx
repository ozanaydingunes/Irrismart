"use client";

import { CheckCircle2, EyeOff, Volume2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { MathTex } from "@/components/math/MathTex";
import type { SolutionStep } from "@/lib/schema/solution";
import type { NarrationSegment } from "@/lib/speech/narrationController";
import { cn } from "@/lib/utils";
import { Visual } from "./visuals";

const COLOR_BG: Record<string, string> = {
  blue: "bg-math-blue/12 text-math-blue",
  purple: "bg-math-purple/12 text-math-purple",
  green: "bg-math-green/12 text-math-green",
  orange: "bg-math-orange/12 text-math-orange",
  red: "bg-math-red/12 text-math-red",
  pink: "bg-math-pink/12 text-math-pink",
  teal: "bg-math-teal/12 text-math-teal",
  gray: "bg-math-gray/12 text-math-gray",
};

interface Props {
  steps: SolutionStep[];
  currentIndex: number;
  /** Tahtada gösterilecek son adım (dahil). Tüm çözüm bir anda gösterilmez. */
  visibleUntil: number;
  playToken: number;
  speaking: boolean;
  /** Anlatım duraklatıldıysa tahta animasyonları da duraklar */
  paused?: boolean;
  chunkIndex: number;
  segment?: NarrationSegment;
  /** Gizli (henüz açılmamış) adımlar: ipucu / birlikte çözme modlarında */
  hiddenSteps?: Set<number>;
  onSelectStep?: (i: number) => void;
  renderStepExtra?: (i: number) => React.ReactNode;
}

/**
 * Akıllı matematik tahtası: adımlar sırayla, animasyonla yazılır; konuşulan adım ve cümle vurgulanır.
 */
export function SmartBoard({ steps, currentIndex, visibleUntil, playToken, speaking, paused, chunkIndex, segment, hiddenSteps, onSelectStep, renderStepExtra }: Props) {
  const currentRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentIndex, playToken]);

  return (
    <section
      aria-label="Akıllı tahta"
      data-paused={paused ? "true" : "false"}
      className={cn("board-surface relative min-w-0 overflow-hidden rounded-3xl border-2 border-border p-2 shadow-card sm:p-5", paused && "board-paused")}
    >
      <ol className="flex flex-col gap-3">
        {steps.slice(0, visibleUntil + 1).map((step, i) => {
          const current = i === currentIndex;
          const hidden = hiddenSteps?.has(i);
          return (
            <li
              key={step.stepId + i}
              ref={current ? currentRef : undefined}
              aria-current={current ? "step" : undefined}
              className={cn(
                "scroll-mt-20 scroll-mb-64 rounded-2xl border-2 p-3 transition-all duration-300 sm:p-4 md:scroll-mb-8",
                current ? "border-primary bg-card shadow-card" : "border-transparent bg-card/70 hover:bg-card",
              )}
            >
              <button
                type="button"
                onClick={() => onSelectStep?.(i)}
                className="flex w-full items-start gap-3 text-left focus-visible:outline-none"
                aria-label={`${i + 1}. adım: ${step.title}`}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
                    current ? "bg-primary text-primary-foreground" : i < currentIndex ? "bg-success/20 text-success-strong" : "bg-muted text-muted-foreground",
                    current && speaking && "ring-4 ring-primary/30",
                  )}
                >
                  {i < currentIndex ? <CheckCircle2 className="size-5" aria-hidden /> : i + 1}
                </span>
                <span className="flex-1">
                  <span className="flex items-center gap-2 text-base font-bold sm:text-lg">
                    {step.title}
                    {current && speaking && <Volume2 className="size-4 text-primary" aria-label="Seslendiriliyor" />}
                  </span>
                  {!current && !hiddenSteps?.has(i) && step.latex ? (
                    <span className="mt-1 block overflow-x-auto text-board-foreground">
                      <MathTex latex={step.latex} />
                    </span>
                  ) : !current ? (
                    <span className="line-clamp-1 text-sm text-muted-foreground">{step.explanation}</span>
                  ) : null}
                </span>
              </button>

              {current && (
                <div className="mt-3 flex flex-col gap-3 pl-0 sm:pl-11">
                  <p className="text-base leading-relaxed">{step.explanation}</p>
                  {hidden ? (
                    <div className="flex items-center gap-2 rounded-xl bg-muted/70 p-3 text-sm font-medium text-muted-foreground">
                      <EyeOff className="size-4" aria-hidden /> Bu adımın işlemi şimdilik gizli. Önce sen dene!
                    </div>
                  ) : (
                    <>
                      {step.latex && (
                        <div key={`l${playToken}`} className="flex flex-wrap items-center justify-center gap-x-2 overflow-x-auto rounded-xl px-1 py-2 text-center text-board-foreground">
                          {/* Uzun işlem zincirleri "⇒" işaretlerinden alt alta yazılır (telefonda yatay kaydırma gerekmesin) */}
                          {step.latex.split(/\\Rightarrow/).map((part, k) => (
                            <MathTex
                              key={k}
                              latex={(k > 0 ? "\\Rightarrow " : "") + part.trim()}
                              display
                              highlights={step.highlightedElements}
                              animate
                              className="katex-host-lg"
                            />
                          ))}
                        </div>
                      )}
                      {step.highlightedElements.some((h) => h.reason) && (
                        <div className="flex flex-wrap justify-center gap-2" aria-label="Vurgulanan sayılar">
                          {step.highlightedElements
                            .filter((h) => h.reason)
                            .map((h, k) => (
                              <span key={k} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", COLOR_BG[h.color])} style={{ animation: `fade-in .3s ease-out ${1 + k * 0.2}s both` }}>
                                <MathTex latex={h.value} /> {h.reason}
                              </span>
                            ))}
                        </div>
                      )}
                      {step.visualInstructions.length > 0 && (
                        <div key={`v${playToken}`} className={cn("grid gap-3", step.visualInstructions.length > 1 && "md:grid-cols-2")}>
                          {step.visualInstructions.map((v, k) => (
                            <Visual key={k} v={v} />
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Konuşulan cümle vurgusu (altyazı) */}
                  {segment?.display.length ? (
                    <div className="rounded-xl bg-accent/60 p-3" aria-live="polite">
                      <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-accent-foreground">
                        <Volume2 className="size-3.5" aria-hidden /> Öğretmen anlatıyor
                      </div>
                      <p className="text-base leading-relaxed text-foreground">
                        {segment.display.map((s, k) => (
                          <span key={k} className={cn("transition-colors", speaking && k === chunkIndex ? "rounded bg-warning/30 font-semibold" : k < chunkIndex && speaking ? "text-muted-foreground" : "")}>
                            {s}{" "}
                          </span>
                        ))}
                      </p>
                    </div>
                  ) : null}
                  {renderStepExtra?.(i)}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

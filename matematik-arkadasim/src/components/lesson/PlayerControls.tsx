"use client";

import { ChevronLeft, ChevronRight, Gauge, HelpCircle, Pause, Play, Repeat, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { VoiceAvailability } from "@/hooks/useNarration";
import { RATES, type NarrationController, type NarrationState } from "@/lib/speech/narrationController";
import { cn } from "@/lib/utils";

interface Props {
  controller: NarrationController;
  state: NarrationState;
  rate: number;
  onRate: (r: number) => void;
  voiceOn: boolean;
  onToggleVoice: () => void;
  availability: VoiceAvailability;
  engineLabel: string;
  canAdvance?: boolean;
  /** Oynatmadan hemen önce çağrılır (ör. ipucu modunda gizli adımı açmak için) */
  beforePlay?: () => void;
  /** Belirgin "Anlamadım" düğmesi: öğretmene bu adımı yeniden anlattırır */
  onDontUnderstand?: () => void;
}

export function PlayerControls({ controller, state, rate, onRate, voiceOn, onToggleVoice, availability, engineLabel, canAdvance = true, beforePlay, onDontUnderstand }: Props) {
  const [more, setMore] = useState(false);
  const playing = state.status === "playing";
  const atStart = state.stepIndex <= 0;
  const atEnd = state.stepIndex >= state.stepCount - 1;
  const label = playing ? "Duraklat" : state.status === "paused" ? "Devam et" : state.status === "finished" ? "Baştan oynat" : state.status === "waiting" ? "Devam et" : "Anlatımı başlat";

  return (
    <div className="sticky bottom-[calc(var(--bottom-nav)+env(safe-area-inset-bottom)+0.5rem)] z-20 rounded-3xl border-2 border-border bg-card/95 p-2.5 shadow-card backdrop-blur md:bottom-4 md:p-3">
      <div className="flex min-w-0 items-center justify-between gap-1">
        <Button variant="outline" size="icon" onClick={() => controller.prev()} disabled={atStart} aria-label="Önceki adım">
          <ChevronLeft />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => controller.restart()} aria-label="Baştan anlat" title="Baştan anlat">
          <RotateCcw />
        </Button>
        <Button
          size="icon-lg"
          className={cn("rounded-full", playing && "ring-4 ring-primary/25")}
          onClick={() => {
            if (!playing) beforePlay?.();
            controller.toggle();
          }}
          aria-label={label}
          title={label}
          disabled={!canAdvance && state.status === "waiting"}
        >
          {playing ? <Pause /> : <Play className="translate-x-0.5" />}
        </Button>
        <span className="min-w-[3.5rem] text-center text-sm font-bold text-muted-foreground" aria-live="polite">
          {Math.min(state.stepIndex + 1, state.stepCount)} / {state.stepCount}
          <span className="sr-only"> Adım {Math.min(state.stepIndex + 1, state.stepCount)} / {state.stepCount}</span>
        </span>
        <Button variant="outline" size="icon" onClick={() => controller.next()} disabled={atEnd || !canAdvance} aria-label="Sonraki adım">
          <ChevronRight />
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
        {onDontUnderstand && (
          <Button variant="accent" onClick={onDontUnderstand} className="h-11 min-w-0 whitespace-normal px-2 leading-tight">
            <HelpCircle /> Anlamadım
          </Button>
        )}
        <Button
          variant="secondary"
          className={cn("h-11 min-w-0 whitespace-normal px-2 leading-tight", !onDontUnderstand && "col-span-2")}
          onClick={() => {
            beforePlay?.();
            controller.repeatStep();
          }}
          aria-label="Bu adımı tekrar anlat"
        >
          <Repeat /> Tekrar dinle
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          aria-controls="oynatici-ayarlar"
          aria-label="Hız ve ses ayarları"
          title="Hız ve ses"
        >
          {voiceOn && availability !== "ok" && availability !== "checking" ? <VolumeX /> : <Gauge />}
        </Button>
      </div>

      {/* Telefonda katlanır (tahtayı kapatmasın), tablet/masaüstünde her zaman açık */}
      <div id="oynatici-ayarlar" className={cn("md:block", more ? "block" : "hidden")}>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1" role="radiogroup" aria-label="Konuşma hızı">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={rate === r}
              onClick={() => onRate(r)}
              className={cn("min-h-11 min-w-11 rounded-xl px-2 text-sm font-bold transition-colors", rate === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}
            >
              {String(r).replace(".", ",")}x
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" onClick={onToggleVoice} aria-pressed={voiceOn} aria-label={voiceOn ? "Sesi kapat" : "Sesi aç"} title={voiceOn ? "Ses açık" : "Ses kapalı"}>
          {voiceOn ? <Volume2 /> : <VolumeX />}
        </Button>
      </div>

      {voiceOn && availability === "no-turkish" && (
        <p className="mt-2 rounded-xl bg-warning/15 px-2 py-1.5 text-xs text-warning-strong" role="status">
          Cihazında Türkçe ses yok; anlatım yazılı sürüyor.{" "}
          <Link href="/ayarlar" className="font-bold underline">
            Ses ayarları
          </Link>
        </p>
      )}
      {voiceOn && availability === "unsupported" && (
        <p className="mt-2 rounded-xl bg-warning/15 px-2 py-1.5 text-xs text-warning-strong" role="status">
          Bu tarayıcı sesli okumayı desteklemiyor; anlatım yazılı sürüyor.
        </p>
      )}
      {state.lastError && (
        <p className="mt-2 rounded-xl bg-destructive/10 p-2 text-sm text-destructive" role="alert">
          {state.lastError}
        </p>
      )}
      </div>
      <p className="sr-only">{engineLabel}</p>
    </div>
  );
}

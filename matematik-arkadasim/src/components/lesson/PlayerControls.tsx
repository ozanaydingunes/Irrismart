"use client";

import { ChevronLeft, ChevronRight, Pause, Play, Repeat, RotateCcw, Volume2, VolumeX } from "lucide-react";
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
}

export function PlayerControls({ controller, state, rate, onRate, voiceOn, onToggleVoice, availability, engineLabel, canAdvance = true, beforePlay }: Props) {
  const playing = state.status === "playing";
  const atStart = state.stepIndex <= 0;
  const atEnd = state.stepIndex >= state.stepCount - 1;
  const label = playing ? "Duraklat" : state.status === "paused" ? "Devam et" : state.status === "finished" ? "Baştan oynat" : state.status === "waiting" ? "Devam et" : "Anlatımı başlat";

  return (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 rounded-3xl border-2 border-border bg-card/95 p-3 shadow-card backdrop-blur md:bottom-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" onClick={() => controller.prev()} disabled={atStart} aria-label="Önceki adım">
          <ChevronLeft />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => controller.restart()} aria-label="Baştan anlat" title="Baştan anlat">
          <RotateCcw />
        </Button>
        <Button
          size="icon-lg"
          className={cn("rounded-full", playing && "animate-pulse-ring")}
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            beforePlay?.();
            controller.repeatStep();
          }}
          aria-label="Bu adımı tekrar anlat"
          title="Bu adımı tekrar anlat"
        >
          <Repeat />
        </Button>
        <Button variant="outline" size="icon" onClick={() => controller.next()} disabled={atEnd || !canAdvance} aria-label="Sonraki adım">
          <ChevronRight />
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-muted-foreground" aria-live="polite">
          Adım {Math.min(state.stepIndex + 1, state.stepCount)} / {state.stepCount}
        </span>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Konuşma hızı">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={rate === r}
              onClick={() => onRate(r)}
              className={cn("min-h-9 rounded-xl px-2.5 text-sm font-bold transition-colors", rate === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}
            >
              {String(r).replace(".", ",")}x
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onToggleVoice} aria-pressed={voiceOn} aria-label={voiceOn ? "Sesi kapat" : "Sesi aç"}>
          {voiceOn ? <Volume2 /> : <VolumeX />}
          <span className="hidden sm:inline">{voiceOn ? "Ses açık" : "Ses kapalı"}</span>
        </Button>
      </div>

      {voiceOn && availability === "no-turkish" && (
        <p className="mt-2 rounded-xl bg-warning/15 p-2 text-sm text-warning-strong" role="status">
          Cihazında Türkçe ses bulunamadı; anlatım yazılı olarak devam ediyor. Cihaz ayarlarından Türkçe metin okuma sesi yükleyebilir veya{" "}
          <Link href="/ayarlar" className="font-bold underline">
            Ayarlar
          </Link>{" "}
          bölümünden doğal sunucu sesini seçebilirsin.
        </p>
      )}
      {voiceOn && availability === "unsupported" && (
        <p className="mt-2 rounded-xl bg-warning/15 p-2 text-sm text-warning-strong" role="status">
          Bu tarayıcı sesli okumayı desteklemiyor; anlatım yazılı olarak devam ediyor.
        </p>
      )}
      {state.lastError && (
        <p className="mt-2 rounded-xl bg-destructive/10 p-2 text-sm text-destructive" role="alert">
          {state.lastError}
        </p>
      )}
      <p className="sr-only">{engineLabel}</p>
    </div>
  );
}

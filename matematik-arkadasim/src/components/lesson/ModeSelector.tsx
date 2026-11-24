"use client";

import { BookOpenCheck, Lightbulb, PencilRuler, Users } from "lucide-react";
import type { LearningMode } from "@/lib/schema/solution";
import { cn } from "@/lib/utils";

export const MODE_INFO: Record<LearningMode, { title: string; desc: string; icon: React.ComponentType<{ className?: string }> }> = {
  full: { title: "Tam çözüm", desc: "Öğretmen tüm adımları sesli ve görsel anlatır.", icon: BookOpenCheck },
  hint: { title: "İpucu ile", desc: "Her adımda önce ipucu, istersen çözümü açarsın.", icon: Lightbulb },
  together: { title: "Birlikte çözelim", desc: "Bazı işlemleri sen yaparsın, öğretmen kontrol eder.", icon: Users },
  exam: { title: "Sınav / alıştırma", desc: "Önce sen cevaplarsın, sonra çözümü görürsün.", icon: PencilRuler },
};

export function ModeSelector({ value, onChange, compact }: { value: LearningMode; onChange: (m: LearningMode) => void; compact?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Öğrenme modu" className={cn("grid gap-2", compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-2")}>
      {(Object.keys(MODE_INFO) as LearningMode[]).map((m) => {
        const { title, desc, icon: Icon } = MODE_INFO[m];
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            className={cn(
              "flex items-start gap-3 rounded-2xl border-2 p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30",
              active ? "border-primary bg-accent/60" : "border-border bg-card hover:border-primary/50",
              compact && "items-center p-2.5",
            )}
          >
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-bold">{title}</span>
              {!compact && <span className="block text-sm text-muted-foreground">{desc}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

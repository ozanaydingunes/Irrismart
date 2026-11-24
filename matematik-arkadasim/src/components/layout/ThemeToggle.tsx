"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Açık tema", icon: Sun },
  { value: "dark", label: "Koyu tema", icon: Moon },
  { value: "system", label: "Sistem teması", icon: Monitor },
] as const;

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const [settings, save] = useSettings();
  if (compact) {
    const idx = OPTIONS.findIndex((o) => o.value === settings.theme);
    const cur = OPTIONS[idx] ?? OPTIONS[2];
    const next = OPTIONS[(idx + 1) % OPTIONS.length];
    const Icon = cur.icon;
    return (
      <button type="button" onClick={() => save({ theme: next.value })} className="flex size-11 items-center justify-center rounded-full hover:bg-muted" aria-label={`Tema: ${cur.label}. ${next.label} için dokun`}>
        <Icon className="size-5" />
      </button>
    );
  }
  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={settings.theme === value}
          aria-label={label}
          title={label}
          onClick={() => save({ theme: value })}
          className={cn("flex min-h-10 items-center justify-center rounded-xl", settings.theme === value ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}

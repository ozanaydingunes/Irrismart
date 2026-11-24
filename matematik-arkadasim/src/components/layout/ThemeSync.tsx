"use client";

import { useEffect } from "react";
import { applyTheme } from "@/lib/client/settings";
import { useSettings } from "@/hooks/useSettings";

/** Sistem teması değişince (ör. akşam koyu moda geçiş) temayı günceller. */
export function ThemeSync() {
  const [settings] = useSettings();
  useEffect(() => {
    applyTheme(settings.theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme(settings.theme);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [settings.theme]);
  return null;
}

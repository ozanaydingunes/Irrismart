"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, SETTINGS_EVENT, type Settings } from "@/lib/client/settings";

function subscribe(cb: () => void) {
  window.addEventListener(SETTINGS_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(SETTINGS_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const s = useSyncExternalStore(subscribe, loadSettings, () => DEFAULT_SETTINGS);
  return [s, saveSettings];
}

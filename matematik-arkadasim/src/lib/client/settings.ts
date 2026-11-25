"use client";

import type { LearningMode } from "@/lib/schema/solution";

/** Kullanıcı tercihleri (yalnızca bu cihazda, localStorage). Kişisel bilgi içermez. */
export interface Settings {
  theme: "light" | "dark" | "system";
  voiceEnabled: boolean;
  voiceGender: "female" | "male";
  voiceName: string | null;
  ttsEngine: "browser" | "server";
  rate: number;
  defaultMode: LearningMode;
  autoSaveToNotebook: boolean;
  savePhotos: boolean;
  /** Kamera/mikrofon açıklama penceresi bir kez onaylandı mı */
  cameraConsent: boolean;
  micConsent: boolean;
  /** İsteğe bağlı takma ad (yalnızca selamlamada; zorunlu değil) */
  nickname: string;
  /** Cihazlar arası eşitleme (ev sunucusu üzerinden) */
  syncEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  voiceEnabled: true,
  voiceGender: "female",
  voiceName: null,
  ttsEngine: "browser",
  rate: 1,
  defaultMode: "full",
  autoSaveToNotebook: false,
  savePhotos: false,
  cameraConsent: false,
  micConsent: false,
  nickname: "",
  syncEnabled: true,
};

const KEY = "matematik-arkadasim:settings";
export const SETTINGS_EVENT = "matematik:settings-changed";

let cache: Settings | null = null;

export function loadSettings(): Settings {
  if (cache) return cache;
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    cache = DEFAULT_SETTINGS;
  }
  return cache;
}

export function saveSettings(patch: Partial<Settings>) {
  const next = { ...loadSettings(), ...patch };
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* gizli sekme vb. — bellekte devam */
  }
  window.dispatchEvent(new Event(SETTINGS_EVENT));
  if (patch.theme) applyTheme(next.theme);
}

export function applyTheme(theme: Settings["theme"]) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#15131f" : "#f7f6ff");
}

export function resetSettingsCache() {
  cache = null;
}

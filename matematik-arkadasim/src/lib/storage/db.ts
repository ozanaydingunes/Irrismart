"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { LearningMode, Solution, SolutionSource, SolveResult, VerificationIssue } from "@/lib/schema/solution";

/**
 * Yerel veri (IndexedDB). Üyelik yok; veriler yalnızca bu cihazda kalır.
 * Fotoğraflar varsayılan olarak SAKLANMAZ (Ayarlar'dan açılabilir). Ses kayıtları hiç saklanmaz.
 */

export type EntryStatus = "solved" | "wrong" | "review";

export interface NotebookEntry {
  id: string;
  createdAt: number;
  updatedAt: number;
  question: string;
  topicId?: string;
  topic: string;
  difficulty: Solution["difficulty"];
  source: SolutionSource;
  provider: string;
  solution: Solution;
  issues: VerificationIssue[];
  imageDataUrl?: string;
  favorite: boolean;
  status: EntryStatus;
  mode: LearningMode;
  reviewCount: number;
  nextReviewAt?: number;
  lastResult?: "correct" | "wrong";
}

export interface AnswerEvent {
  id: string;
  at: number;
  topicId: string;
  correct: boolean;
  scope: "final" | "step";
  mode: LearningMode;
  entryId?: string;
}

export interface LessonEvent {
  id: string;
  at: number;
  topicId: string;
  source: SolutionSource;
}

export interface StudyDay {
  day: string; // YYYY-MM-DD (yerel saat)
  seconds: number;
}

interface CacheRow {
  key: string;
  createdAt: number;
  /** Çözüm (SolveResult) veya öğretmen yanıtı (anahtar "ogretmen:" ile başlar) */
  result: unknown;
}

/** Başka cihazlardan eşitlemeyle gelen çalışma süresi (cihaz başına, gün başına) */
export interface RemoteStudy {
  id: string; // `${day}:${deviceId}`
  day: string;
  deviceId: string;
  seconds: number;
}

interface MathDB extends DBSchema {
  notebook: { key: string; value: NotebookEntry; indexes: { byUpdated: number; byTopic: string } };
  answers: { key: string; value: AnswerEvent; indexes: { byAt: number } };
  lessons: { key: string; value: LessonEvent; indexes: { byAt: number } };
  study: { key: string; value: StudyDay };
  cache: { key: string; value: CacheRow; indexes: { byCreated: number } };
  studyRemote: { key: string; value: RemoteStudy };
}

let dbPromise: Promise<IDBPDatabase<MathDB>> | null = null;

export function db() {
  if (!dbPromise) {
    dbPromise = openDB<MathDB>("matematik-arkadasim", 2, {
      upgrade(d, oldVersion) {
        if (oldVersion < 1) {
          const nb = d.createObjectStore("notebook", { keyPath: "id" });
          nb.createIndex("byUpdated", "updatedAt");
          nb.createIndex("byTopic", "topicId");
          d.createObjectStore("answers", { keyPath: "id" }).createIndex("byAt", "at");
          d.createObjectStore("lessons", { keyPath: "id" }).createIndex("byAt", "at");
          d.createObjectStore("study", { keyPath: "day" });
          d.createObjectStore("cache", { keyPath: "key" }).createIndex("byCreated", "createdAt");
        }
        if (oldVersion < 2) d.createObjectStore("studyRemote", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function localDay(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ───── Soru defteri ───── */

export async function listEntries(): Promise<NotebookEntry[]> {
  const all = await (await db()).getAllFromIndex("notebook", "byUpdated");
  return all.reverse();
}

export async function getEntry(id: string) {
  return (await db()).get("notebook", id);
}

export async function saveEntry(entry: NotebookEntry) {
  await (await db()).put("notebook", entry);
  notifyDataChanged();
}

export async function updateEntry(id: string, patch: Partial<NotebookEntry>) {
  const d = await db();
  const cur = await d.get("notebook", id);
  if (!cur) return;
  await d.put("notebook", { ...cur, ...patch, updatedAt: Date.now() });
  notifyDataChanged();
}

export async function deleteEntry(id: string) {
  await (await db()).delete("notebook", id);
  // Diğer cihazlardan da silinsin diye eşitleme için işaretle
  markDeleted(id);
  notifyDataChanged();
}

const DELETED_KEY = "matematik-arkadasim:silinenler";
export function markDeleted(id: string) {
  try {
    const list = JSON.parse(localStorage.getItem(DELETED_KEY) ?? "[]") as { id: string; at: number }[];
    list.push({ id, at: Date.now() });
    localStorage.setItem(DELETED_KEY, JSON.stringify(list.slice(-500)));
  } catch {
    /* yoksay */
  }
}
export function takeDeleted(): { id: string; at: number }[] {
  try {
    return JSON.parse(localStorage.getItem(DELETED_KEY) ?? "[]") as { id: string; at: number }[];
  } catch {
    return [];
  }
}
export function clearDeleted(upTo: number) {
  try {
    const list = takeDeleted().filter((d) => d.at > upTo);
    localStorage.setItem(DELETED_KEY, JSON.stringify(list));
  } catch {
    /* yoksay */
  }
}

/** Aynı soru deftere iki kez eklenmesin diye metne göre arar. */
export async function findEntryByQuestion(question: string) {
  const all = await (await db()).getAll("notebook");
  return all.find((e) => e.question.trim() === question.trim());
}

/* ───── Olaylar (gelişim paneli için gerçek kullanım verisi) ───── */

export async function recordLesson(topicId: string, source: SolutionSource) {
  await (await db()).put("lessons", { id: newId(), at: Date.now(), topicId, source });
  notifyDataChanged();
}

export async function recordAnswer(e: Omit<AnswerEvent, "id" | "at">) {
  await (await db()).put("answers", { ...e, id: newId(), at: Date.now() });
  notifyDataChanged();
}

export async function addStudySeconds(seconds: number) {
  if (seconds <= 0) return;
  const d = await db();
  const day = localDay();
  const cur = await d.get("study", day);
  await d.put("study", { day, seconds: (cur?.seconds ?? 0) + Math.round(seconds) });
}

export async function loadAllStats() {
  const d = await db();
  const [answers, lessons, localStudy, remoteStudy, notebook] = await Promise.all([d.getAll("answers"), d.getAll("lessons"), d.getAll("study"), d.getAll("studyRemote"), d.getAll("notebook")]);
  return { answers, lessons, study: mergeStudy(localStudy, remoteStudy), notebook };
}

/** Bu cihazın ve diğer cihazların çalışma sürelerini gün bazında toplar. */
export function mergeStudy(local: StudyDay[], remote: RemoteStudy[]): StudyDay[] {
  const m = new Map<string, number>();
  for (const s of local) m.set(s.day, (m.get(s.day) ?? 0) + s.seconds);
  for (const r of remote) m.set(r.day, (m.get(r.day) ?? 0) + r.seconds);
  return [...m.entries()].map(([day, seconds]) => ({ day, seconds }));
}

/* ───── Çözüm önbelleği (gereksiz API çağrılarını önler) ───── */

// Aynı soru tekrar sorulduğunda yapay zekâ çağrılmaz (30 gün, en fazla 300 kayıt; fotoğraf saklanmaz)
const CACHE_TTL = 30 * 24 * 3600 * 1000;
const CACHE_MAX = 300;

export async function getCached<T>(key: string): Promise<T | null> {
  const row = await (await db()).get("cache", key);
  if (!row || Date.now() - row.createdAt > CACHE_TTL) return null;
  return row.result as T;
}

export async function putCached(key: string, result: unknown) {
  const d = await db();
  await d.put("cache", { key, createdAt: Date.now(), result });
  const keys = await d.getAllKeysFromIndex("cache", "byCreated");
  if (keys.length > CACHE_MAX) for (const k of keys.slice(0, keys.length - CACHE_MAX)) await d.delete("cache", k);
}

export const getCachedSolve = (key: string) => getCached<SolveResult>(key);
export const putCachedSolve = (key: string, result: SolveResult) => putCached(key, result);

/* ───── Veri yönetimi ───── */

export async function exportAll() {
  const data = await loadAllStats();
  return { app: "matematik-arkadasim", version: 1, exportedAt: new Date().toISOString(), ...data };
}

export async function clearAll() {
  const d = await db();
  await Promise.all([d.clear("notebook"), d.clear("answers"), d.clear("lessons"), d.clear("study"), d.clear("cache"), d.clear("studyRemote")]);
  notifyDataChanged();
}

/* ───── Değişiklik bildirimi ───── */
export const DATA_EVENT = "matematik:data-changed";
export function notifyDataChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DATA_EVENT));
}

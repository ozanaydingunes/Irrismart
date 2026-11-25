"use client";

import { clearDeleted, db, localDay, notifyDataChanged, takeDeleted, type AnswerEvent, type LessonEvent, type NotebookEntry } from "./db";

/**
 * Cihazlar arası eşitleme (telefon, tablet, bilgisayar). Veriler yalnızca ev bilgisayarındaki
 * uygulamaya gider; üçüncü taraf sunucu kullanılmaz. Fotoğraflar eşitlenmez.
 *
 * Akış: (1) bu cihazda son eşitlemeden beri değişenleri gönder, (2) aile kopyasında son bilinen
 * sürümden (rev) sonra değişenleri al ve yerel veriye birleştir. Çakışmada son değiştirilen kazanır.
 */

const META_KEY = "matematik-arkadasim:esitleme";
export const SYNC_EVENT = "matematik:sync-status";

interface Meta {
  deviceId: string;
  lastRev: number;
  lastPushAt: number;
  lastSyncAt: number;
  lastError?: string;
}

export function readMeta(): Meta {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? "null") as Meta | null;
    if (m?.deviceId) return m;
  } catch {
    /* yoksay */
  }
  const fresh: Meta = { deviceId: randomId(), lastRev: 0, lastPushAt: 0, lastSyncAt: 0 };
  writeMeta(fresh);
  return fresh;
}

function writeMeta(m: Meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    /* yoksay */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SYNC_EVENT));
}

function randomId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
}

interface PushRecord {
  kind: "notebook" | "answer" | "lesson" | "study";
  id: string;
  updatedAt: number;
  deleted?: boolean;
  data?: Record<string, unknown>;
}
interface PulledRecord extends PushRecord {
  rev: number;
}

let running: Promise<SyncResult> | null = null;

export type SyncResult = { ok: true; pushed: number; pulled: number } | { ok: false; code: string; message: string };

/** Aynı anda tek eşitleme; çağrılar birleştirilir. */
export function syncNow(): Promise<SyncResult> {
  if (!running) running = doSync().finally(() => (running = null));
  return running;
}

async function doSync(): Promise<SyncResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, code: "OFFLINE", message: "Çevrimdışı" };
  const meta = readMeta();
  const startedAt = Date.now();
  const d = await db();

  // 1) Gönderilecek değişiklikler
  const [notebook, answers, lessons, study] = await Promise.all([d.getAll("notebook"), d.getAll("answers"), d.getAll("lessons"), d.getAll("study")]);
  const push: PushRecord[] = [];
  for (const e of notebook) {
    if (e.updatedAt > meta.lastPushAt) {
      const { imageDataUrl: _photo, ...rest } = e; // fotoğraflar eşitlenmez
      void _photo;
      push.push({ kind: "notebook", id: e.id, updatedAt: e.updatedAt, data: rest as unknown as Record<string, unknown> });
    }
  }
  const deleted = takeDeleted();
  for (const del of deleted) push.push({ kind: "notebook", id: del.id, updatedAt: del.at, deleted: true });
  for (const a of answers) if (a.at > meta.lastPushAt) push.push({ kind: "answer", id: a.id, updatedAt: a.at, data: a as unknown as Record<string, unknown> });
  for (const l of lessons) if (l.at > meta.lastPushAt) push.push({ kind: "lesson", id: l.id, updatedAt: l.at, data: l as unknown as Record<string, unknown> });
  // Çalışma süresi: bu cihazın son iki gününü her seferinde gönder (değer yalnızca artar)
  const recentDays = new Set([localDay(), localDay(Date.now() - 86400000)]);
  for (const s of study) {
    if (recentDays.has(s.day) || meta.lastPushAt === 0) {
      push.push({ kind: "study", id: `${s.day}:${meta.deviceId}`, updatedAt: startedAt, data: { day: s.day, deviceId: meta.deviceId, seconds: s.seconds } });
    }
  }

  // 2) Gönder + al (çok kayıt varsa parça parça)
  let sinceRev = meta.lastRev;
  let pulled = 0;
  let toSend = push;
  let changedLocal = false;
  for (let round = 0; round < 50; round++) {
    const batch = toSend.slice(0, 200);
    toSend = toSend.slice(200);
    let res: Response;
    try {
      res = await fetch("/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sinceRev, push: batch }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      return fail(meta, "NETWORK", "Ev bilgisayarına ulaşılamadı; eşitleme sonra tekrar denenecek.");
    }
    const j = (await res.json().catch(() => null)) as { ok?: boolean; code?: string; message?: string; records?: PulledRecord[]; rev?: number; more?: boolean } | null;
    if (!res.ok || !j?.ok) return fail(meta, j?.code ?? "ERROR", j?.message ?? "Eşitleme başarısız.");
    if (j.records?.length) {
      changedLocal = (await applyPulled(j.records, meta.deviceId)) || changedLocal;
      pulled += j.records.length;
    }
    sinceRev = j.rev ?? sinceRev;
    if (!toSend.length && !j.more) break;
  }

  clearDeleted(startedAt);
  writeMeta({ ...meta, lastRev: sinceRev, lastPushAt: startedAt, lastSyncAt: Date.now(), lastError: undefined });
  if (changedLocal) notifyDataChanged();
  return { ok: true, pushed: push.length, pulled };
}

function fail(meta: Meta, code: string, message: string): SyncResult {
  writeMeta({ ...meta, lastError: message });
  return { ok: false, code, message };
}

/** Aile kopyasından gelenleri yerel veriye birleştirir. Yerel veri değiştiyse true. */
async function applyPulled(records: PulledRecord[], deviceId: string): Promise<boolean> {
  const d = await db();
  let changed = false;
  for (const r of records) {
    if (r.kind === "notebook") {
      const cur = await d.get("notebook", r.id);
      if (r.deleted) {
        if (cur && cur.updatedAt <= r.updatedAt) {
          await d.delete("notebook", r.id);
          changed = true;
        }
      } else if (r.data && (!cur || cur.updatedAt < r.updatedAt)) {
        // Yereldeki fotoğraf (varsa) korunur; uzaktan fotoğraf gelmez
        await d.put("notebook", { ...(r.data as unknown as NotebookEntry), imageDataUrl: cur?.imageDataUrl });
        changed = true;
      }
    } else if (r.kind === "answer" && r.data && !r.deleted) {
      if (!(await d.get("answers", r.id))) {
        await d.put("answers", r.data as unknown as AnswerEvent);
        changed = true;
      }
    } else if (r.kind === "lesson" && r.data && !r.deleted) {
      if (!(await d.get("lessons", r.id))) {
        await d.put("lessons", r.data as unknown as LessonEvent);
        changed = true;
      }
    } else if (r.kind === "study" && r.data && !r.deleted) {
      const s = r.data as { day: string; deviceId: string; seconds: number };
      if (s.deviceId === deviceId) continue; // kendi süremiz zaten yerelde
      await d.put("studyRemote", { id: r.id, day: s.day, deviceId: s.deviceId, seconds: s.seconds });
      changed = true;
    } else if (r.deleted && (r.kind === "answer" || r.kind === "lesson" || r.kind === "study")) {
      // "Tüm verilerimi sil" sonrası diğer cihazlardaki kayıtları da temizle
      if (r.kind === "answer") await d.delete("answers", r.id);
      else if (r.kind === "lesson") await d.delete("lessons", r.id);
      else await d.delete("studyRemote", r.id);
      changed = true;
    }
  }
  return changed;
}

/** "Tüm verilerimi sil": ev sunucusundaki aile kopyasını da sil. */
export async function wipeServerCopy(): Promise<boolean> {
  try {
    const r = await fetch("/api/sync", { method: "DELETE", signal: AbortSignal.timeout(15_000) });
    if (r.ok) {
      const meta = readMeta();
      writeMeta({ ...meta, lastPushAt: Date.now() });
    }
    return r.ok;
  } catch {
    return false;
  }
}

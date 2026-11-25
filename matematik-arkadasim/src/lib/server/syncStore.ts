import "server-only";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getConfig } from "./config";

/**
 * Cihazlar arası eşitleme için ev sunucusundaki aile kopyası (tek JSON dosyası).
 * - Kayıt türleri: soru defteri, cevap ve ders olayları, cihaz başına çalışma süresi.
 * - Çakışma: son değiştirilen kazanır (updatedAt). Silmeler "mezar taşı" olarak tutulur ki diğer cihazlara yayılsın.
 * - Fotoğraflar asla saklanmaz (imageDataUrl alanı silinir).
 * - Her değişiklik artan bir sürüm numarası (rev) alır; cihazlar "şu sürümden sonrakileri ver" diye sorar.
 */

export const SYNC_KINDS = ["notebook", "answer", "lesson", "study"] as const;
export type SyncKind = (typeof SYNC_KINDS)[number];

export interface SyncRecord {
  kind: SyncKind;
  id: string;
  updatedAt: number;
  deleted?: boolean;
  data?: Record<string, unknown>;
  rev: number;
}

interface FileShape {
  rev: number;
  records: Record<string, SyncRecord>;
}

const MAX_RECORDS = 20_000;

export class SyncStore {
  private state: FileShape;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private file: string | null) {
    this.state = { rev: 0, records: {} };
    if (file) {
      try {
        const parsed = JSON.parse(readFileSync(file, "utf8")) as FileShape;
        if (parsed && typeof parsed.rev === "number" && parsed.records) this.state = parsed;
      } catch {
        /* yeni dosya */
      }
    }
  }

  private persist() {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state));
    renameSync(tmp, this.file);
  }

  private serial<T>(fn: () => T): Promise<T> {
    const p = this.queue.then(fn, fn);
    this.queue = p.catch(() => undefined);
    return p;
  }

  get rev() {
    return this.state.rev;
  }

  /** Gelen kayıtları birleştirir; değişen kayıt sayısını döndürür. */
  push(items: Omit<SyncRecord, "rev">[]): Promise<number> {
    return this.serial(() => {
      let changed = 0;
      for (const it of items) {
        const key = `${it.kind}:${it.id}`;
        const cur = this.state.records[key];
        if (cur && cur.updatedAt >= it.updatedAt) continue; // son değiştirilen kazanır
        if (!cur && Object.keys(this.state.records).length >= MAX_RECORDS) continue;
        const data = it.deleted ? undefined : stripPhotos(it.data);
        this.state.rev += 1;
        this.state.records[key] = { kind: it.kind, id: it.id, updatedAt: it.updatedAt, deleted: it.deleted || undefined, data, rev: this.state.rev };
        changed++;
      }
      if (changed) this.persist();
      return changed;
    });
  }

  /** sinceRev'den sonra değişen kayıtlar (sürüm sırasıyla, en fazla limit kadar). */
  pull(sinceRev: number, limit = 300): { records: SyncRecord[]; rev: number; more: boolean } {
    const all = Object.values(this.state.records)
      .filter((r) => r.rev > sinceRev)
      .sort((a, b) => a.rev - b.rev);
    const records = all.slice(0, limit);
    const last = records.at(-1)?.rev ?? this.state.rev;
    return { records, rev: all.length > limit ? last : this.state.rev, more: all.length > limit };
  }

  /** Tüm aile verisini siler ("Tüm verilerimi sil"). Sürüm numarası artmaya devam eder. */
  wipe(): Promise<void> {
    return this.serial(() => {
      const now = Date.now();
      for (const [key, r] of Object.entries(this.state.records)) {
        this.state.rev += 1;
        this.state.records[key] = { kind: r.kind, id: r.id, updatedAt: now, deleted: true, rev: this.state.rev };
      }
      this.persist();
    });
  }
}

function stripPhotos(data: Record<string, unknown> | undefined) {
  if (!data) return data;
  const copy = { ...data };
  delete copy.imageDataUrl;
  return copy;
}

const g = globalThis as unknown as { __syncStore?: SyncStore };
export function getSyncStore(): SyncStore | null {
  const { store } = getConfig();
  if (!store.useFile) return null; // sunucusuz ortamda eşitleme yok (kalıcı yerel disk yok)
  return (g.__syncStore ??= new SyncStore(join(process.cwd(), store.dataDir, "esitleme.json")));
}
/** Testler için */
export function setSyncStore(s: SyncStore | undefined) {
  g.__syncStore = s;
}

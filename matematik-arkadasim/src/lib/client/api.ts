"use client";

import type { CheckRequest, PracticeRequest, SolveRequest, TutorRequest } from "@/lib/schema/api";
import type { CheckReply, SolveFailure, SolveResult, TutorReply } from "@/lib/schema/solution";
import { getCached, getCachedSolve, putCached, putCachedSolve } from "@/lib/storage/db";

/** Sunucu API istemcisi: ağ hatalarını Türkçe mesajlara çevirir, aynı soruyu önbellekten verir. */

export type ApiFailure = { ok: false; code: string; message: string };

async function post<T>(url: string, body: unknown, timeoutMs = 130_000): Promise<T | ApiFailure> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, code: "OFFLINE", message: "İnternet bağlantın yok. Yeni soru çözmek için internet gerekir; kayıtlı sorularına Soru Defterim'den ulaşabilirsin." };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = (await res.json().catch(() => null)) as (T & { ok?: boolean }) | ApiFailure | null;
    if (!json) return { ok: false, code: "BAD_RESPONSE", message: "Sunucudan anlaşılır bir yanıt gelmedi. Lütfen tekrar dene." };
    return json as T | ApiFailure;
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") return { ok: false, code: "TIMEOUT", message: "Yanıt çok uzun sürdü. Biraz bekleyip tekrar dener misin?" };
    return { ok: false, code: "NETWORK", message: "Pi Hoca'ya ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene." };
  }
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function solve(req: SolveRequest, opts: { useCache?: boolean } = {}): Promise<SolveResult | SolveFailure | ApiFailure> {
  const key = await sha256(JSON.stringify([req.text?.trim() ?? "", req.image ?? "", req.mode ?? "full"])).catch(() => null);
  if (key && opts.useCache !== false) {
    const hit = await getCachedSolve(key).catch(() => null);
    if (hit) return hit;
  }
  // Yerel model / ücretsiz yedek sağlayıcıya geçiş zaman alabilir: 6 dakikaya kadar bekle
  const res = await post<SolveResult | SolveFailure>("/api/solve", req, 360_000);
  if (res.ok && key) await putCachedSolve(key, res as SolveResult).catch(() => undefined);
  return res;
}

type TutorResult = { ok: true; source: "ai" | "demo"; reply: TutorReply; cached?: boolean } | ApiFailure;

/**
 * Hazır düğmelerin ("Anlamadım", "İpucu ver", "Neden?"…) yanıtı aynı soru + aynı adım için önbellekten
 * verilir; yapay zekâya tekrar istek gitmez. Serbest yazılı sorular önbelleğe alınmaz.
 */
export async function tutor(req: TutorRequest): Promise<TutorResult> {
  const cacheable = req.action !== "free_question";
  const key = cacheable ? await sha256(JSON.stringify(["ogretmen", req.solution.question, req.solution.finalAnswer, req.stepIndex, req.action])).then((h) => `ogretmen:${h}`).catch(() => null) : null;
  if (key) {
    const hit = await getCached<TutorResult>(key).catch(() => null);
    if (hit && hit.ok) return { ...hit, cached: true };
  }
  const res = await post<TutorResult>("/api/tutor", req, 360_000);
  if (res.ok && key && res.source === "ai") await putCached(key, res).catch(() => undefined);
  return res;
}

export function check(req: CheckRequest) {
  return post<{ ok: true; source: "local" | "ai" | "demo"; reply: CheckReply } | ApiFailure>("/api/check", req, 180_000);
}

export function practice(req: PracticeRequest) {
  return post<SolveResult | SolveFailure | ApiFailure>("/api/practice", req, 360_000);
}

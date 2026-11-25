import "server-only";
import { createHash } from "node:crypto";
import type { CounterStore } from "./store";

/**
 * Kota kararları: dakikalık hız sınırı (oturum + IP), günlük istek sınırı (oturum + IP + genel)
 * ve günlük yaklaşık harcama sınırı. Aynı evdeki çocuklar tek IP'yi paylaşabileceği için IP sınırları
 * oturum sınırlarının 3 katıdır; çerez silinerek oturum sınırı aşılmaya çalışılırsa IP sınırı devreye girer.
 */

export interface Limits {
  perMinute: number;
  dailyPerClient: number;
  dailyGlobal: number;
  dailyBudgetUsd: number;
}

export type QuotaDecision =
  | { allowed: true; remainingToday?: number }
  | { allowed: false; reason: "rate" | "daily" | "global" | "budget"; retryAfterSec?: number };

export function hashId(value: string): string {
  return createHash("sha256").update(`matematik-arkadasim:${value}`).digest("hex").slice(0, 24);
}

function utcDay(t: number) {
  return new Date(t).toISOString().slice(0, 10);
}

const MICRO = 1_000_000; // harcama mikro-dolar olarak tamsayı tutulur

export async function checkAndConsume(
  store: CounterStore,
  ids: { session: string; ip: string },
  limits: Limits,
  now = Date.now(),
): Promise<QuotaDecision> {
  const day = utcDay(now);
  const minute = Math.floor(now / 60_000);
  const s = hashId(ids.session);
  const ip = hashId(ids.ip);

  // Harcama sınırı (istek atılmadan önce)
  if (limits.dailyBudgetUsd > 0) {
    const spent = (await store.get(`spend:${day}`)) / MICRO;
    if (spent >= limits.dailyBudgetUsd) return { allowed: false, reason: "budget" };
  }
  if (limits.perMinute > 0) {
    const [a, b] = await Promise.all([store.incr(`rl:s:${s}:${minute}`, 1, 90), store.incr(`rl:ip:${ip}:${minute}`, 1, 90)]);
    if (a > limits.perMinute || b > limits.perMinute * 3) return { allowed: false, reason: "rate", retryAfterSec: 60 - Math.floor((now / 1000) % 60) };
  }
  if (limits.dailyGlobal > 0) {
    const all = await store.incr(`day:all:${day}`, 1, 2 * 86400);
    if (all > limits.dailyGlobal) return { allowed: false, reason: "global" };
  }
  if (limits.dailyPerClient > 0) {
    const [a, b] = await Promise.all([store.incr(`day:s:${s}:${day}`, 1, 2 * 86400), store.incr(`day:ip:${ip}:${day}`, 1, 2 * 86400)]);
    if (a > limits.dailyPerClient || b > limits.dailyPerClient * 3) return { allowed: false, reason: "daily" };
    return { allowed: true, remainingToday: Math.max(0, limits.dailyPerClient - a) };
  }
  return { allowed: true };
}

export async function recordSpend(store: CounterStore, usd: number, now = Date.now()) {
  if (!(usd > 0)) return;
  await store.incr(`spend:${utcDay(now)}`, Math.ceil(usd * MICRO), 3 * 86400);
}

export async function spentToday(store: CounterStore, now = Date.now()) {
  return (await store.get(`spend:${utcDay(now)}`)) / MICRO;
}

/** PIN deneme sınırı: 15 dakikada en fazla 5 yanlış deneme (IP başına). */
export async function pinAttemptAllowed(store: CounterStore, ip: string, now = Date.now()) {
  const win = Math.floor(now / (15 * 60_000));
  const n = await store.get(`pin:${hashId(ip)}:${win}`);
  return n < 5;
}
export async function recordPinFailure(store: CounterStore, ip: string, now = Date.now()) {
  const win = Math.floor(now / (15 * 60_000));
  await store.incr(`pin:${hashId(ip)}:${win}`, 1, 16 * 60);
}

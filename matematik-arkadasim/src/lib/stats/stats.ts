import type { AnswerEvent, LessonEvent, NotebookEntry, StudyDay } from "@/lib/storage/db";
import { findTopic } from "@/lib/topics";

/**
 * Gelişim paneli hesapları. Yalnızca gerçek kullanım verisinden üretilir;
 * veri yoksa ilgili alanlar boş/null döner — asla tahmini veya sahte değer üretilmez.
 */

export interface TopicStat {
  topicId: string;
  title: string;
  lessons: number;
  correct: number;
  wrong: number;
  /** 0-100, cevap yoksa null */
  successRate: number | null;
}

export interface DayStat {
  day: string;
  label: string;
  seconds: number;
  lessons: number;
  correct: number;
  wrong: number;
}

export interface Stats {
  hasData: boolean;
  solvedCount: number;
  correct: number;
  wrong: number;
  successRate: number | null;
  todaySeconds: number;
  weekSeconds: number;
  week: DayStat[];
  topics: TopicStat[];
  struggling: TopicStat[];
  reviewTopics: { topicId: string; title: string; reason: string }[];
  dueReviews: number;
}

const DAY_NAMES = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function dayKey(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function computeStats(
  data: { answers: AnswerEvent[]; lessons: LessonEvent[]; study: StudyDay[]; notebook: NotebookEntry[] },
  now = Date.now(),
): Stats {
  const finals = data.answers.filter((a) => a.scope === "final");
  const correct = finals.filter((a) => a.correct).length;
  const wrong = finals.length - correct;

  const topicMap = new Map<string, TopicStat>();
  const topic = (id: string) => {
    let t = topicMap.get(id);
    if (!t) {
      t = { topicId: id, title: findTopic(id)?.title ?? (id || "Diğer"), lessons: 0, correct: 0, wrong: 0, successRate: null };
      topicMap.set(id, t);
    }
    return t;
  };
  for (const l of data.lessons) topic(l.topicId || "diger").lessons++;
  for (const a of data.answers) {
    const t = topic(a.topicId || "diger");
    if (a.correct) t.correct++;
    else t.wrong++;
  }
  for (const t of topicMap.values()) {
    const n = t.correct + t.wrong;
    t.successRate = n ? Math.round((t.correct / n) * 100) : null;
  }
  const topics = [...topicMap.values()].sort((a, b) => b.lessons + b.correct + b.wrong - (a.lessons + a.correct + a.wrong));

  // Zorlanılan konular: en az 2 cevap ve başarı < %60 (en düşükten)
  const struggling = topics
    .filter((t) => t.correct + t.wrong >= 2 && (t.successRate ?? 100) < 60)
    .sort((a, b) => (a.successRate ?? 0) - (b.successRate ?? 0));

  // Son 7 gün
  const studyMap = new Map(data.study.map((s) => [s.day, s.seconds]));
  const week: DayStat[] = [];
  for (let i = 6; i >= 0; i--) {
    const t = now - i * 86400000;
    const key = dayKey(t);
    const dayLessons = data.lessons.filter((l) => dayKey(l.at) === key).length;
    const dayFinals = finals.filter((a) => dayKey(a.at) === key);
    week.push({
      day: key,
      label: i === 0 ? "Bugün" : DAY_NAMES[new Date(t).getDay()],
      seconds: studyMap.get(key) ?? 0,
      lessons: dayLessons,
      correct: dayFinals.filter((a) => a.correct).length,
      wrong: dayFinals.filter((a) => !a.correct).length,
    });
  }

  const reviewTopics = new Map<string, { topicId: string; title: string; reason: string }>();
  for (const t of struggling) reviewTopics.set(t.topicId, { topicId: t.topicId, title: t.title, reason: `Başarı oranı %${t.successRate}` });
  for (const e of data.notebook) {
    if ((e.status === "wrong" || e.status === "review") && e.topicId && !reviewTopics.has(e.topicId)) {
      reviewTopics.set(e.topicId, { topicId: e.topicId, title: findTopic(e.topicId)?.title ?? e.topic, reason: e.status === "wrong" ? "Defterde yanlış yapılan soru var" : "Tekrar listesinde soru var" });
    }
  }

  const dueReviews = data.notebook.filter((e) => (e.status === "wrong" || e.status === "review") && (!e.nextReviewAt || e.nextReviewAt <= now)).length;
  const hasData = data.lessons.length > 0 || data.answers.length > 0 || data.study.some((s) => s.seconds > 0) || data.notebook.length > 0;

  return {
    hasData,
    solvedCount: data.lessons.length,
    correct,
    wrong,
    successRate: finals.length ? Math.round((correct / finals.length) * 100) : null,
    todaySeconds: studyMap.get(dayKey(now)) ?? 0,
    weekSeconds: week.reduce((s, d) => s + d.seconds, 0),
    week,
    topics,
    struggling,
    reviewTopics: [...reviewTopics.values()],
    dueReviews,
  };
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return seconds > 0 ? "1 dk'dan az" : "0 dk";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  return `${h} sa ${m % 60} dk`;
}

/** Basit aralıklı tekrar: yanlışsa 1 gün, doğruysa tekrar sayısına göre 3 → 7 → 14 gün. */
export function nextReviewDate(correct: boolean, reviewCount: number, now = Date.now()): number {
  const days = correct ? [3, 7, 14, 30][Math.min(reviewCount, 3)] : 1;
  return now + days * 86400000;
}

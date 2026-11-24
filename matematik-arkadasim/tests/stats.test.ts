import { describe, expect, it } from "vitest";
import { computeStats, formatDuration, nextReviewDate } from "@/lib/stats/stats";
import type { AnswerEvent, LessonEvent } from "@/lib/storage/db";

const NOW = new Date(2026, 10, 24, 15, 0).getTime();
const ans = (topicId: string, correct: boolean, at = NOW): AnswerEvent => ({ id: Math.random() + "", at, topicId, correct, scope: "final", mode: "exam" });
const les = (topicId: string, at = NOW): LessonEvent => ({ id: Math.random() + "", at, topicId, source: "ai" });

describe("Gelişim paneli", () => {
  it("veri yokken sahte değer üretmez", () => {
    const s = computeStats({ answers: [], lessons: [], study: [], notebook: [] }, NOW);
    expect(s.hasData).toBe(false);
    expect(s.successRate).toBeNull();
    expect(s.solvedCount).toBe(0);
    expect(s.topics).toEqual([]);
    expect(s.struggling).toEqual([]);
    expect(s.week.every((d) => d.seconds === 0 && d.lessons === 0)).toBe(true);
  });

  it("başarı oranı ve konu bazlı istatistik", () => {
    const s = computeStats(
      {
        answers: [ans("kesirler", true), ans("kesirler", false), ans("kesirler", false), ans("denklemler", true), ans("denklemler", true)],
        lessons: [les("kesirler"), les("denklemler"), les("denklemler", NOW - 2 * 86400000)],
        study: [{ day: "2026-11-24", seconds: 600 }],
        notebook: [],
      },
      NOW,
    );
    expect(s.solvedCount).toBe(3);
    expect(s.correct).toBe(3);
    expect(s.wrong).toBe(2);
    expect(s.successRate).toBe(60);
    expect(s.todaySeconds).toBe(600);
    expect(s.struggling.map((t) => t.topicId)).toEqual(["kesirler"]);
    expect(s.reviewTopics[0].topicId).toBe("kesirler");
    expect(s.week.at(-1)!.lessons).toBe(2);
    expect(s.week[4].lessons).toBe(1);
  });

  it("adım cevapları genel başarı oranına girmez ama konuya girer", () => {
    const step: AnswerEvent = { ...ans("yuzdeler", false), scope: "step" };
    const s = computeStats({ answers: [step], lessons: [], study: [], notebook: [] }, NOW);
    expect(s.successRate).toBeNull();
    expect(s.topics[0].wrong).toBe(1);
  });

  it("süre biçimi ve tekrar takvimi", () => {
    expect(formatDuration(0)).toBe("0 dk");
    expect(formatDuration(1500)).toBe("25 dk");
    expect(formatDuration(3900)).toBe("1 sa 5 dk");
    expect(nextReviewDate(false, 0, 0)).toBe(86400000);
    expect(nextReviewDate(true, 1, 0)).toBe(7 * 86400000);
  });
});

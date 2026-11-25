import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { solveDemo } from "@/lib/demo/solver";
import { answersEquivalent } from "@/lib/math/answer";
import { evaluate, parseExpression } from "@/lib/math/expr";
import { Rational } from "@/lib/math/rational";
import { verifySolution } from "@/lib/math/verify";
import { QUESTION_BANK, type BankItem } from "./data/questionBank";

function exprMatches(item: BankItem): boolean {
  const { variable, f } = item.expr!;
  const node = parseExpression(item.answer);
  if (!node) return false;
  return [-3, 0, 2, 7, 10].every((v) => {
    const r = evaluate(node, { [variable]: Rational.of(v) });
    return r !== null && r.eq(Rational.of(f(v)));
  });
}

describe("Doğruluk test kümesi (117 soru) — beklenen cevaplar bağımsız hesapla doğrulanır", () => {
  it("en az 100 soru, her konuda en az 9 soru, üç zorluk düzeyi", () => {
    expect(QUESTION_BANK.length).toBeGreaterThanOrEqual(100);
    const byTopic = new Map<string, number>();
    for (const q of QUESTION_BANK) byTopic.set(q.topic, (byTopic.get(q.topic) ?? 0) + 1);
    expect(byTopic.size).toBe(12);
    for (const [t, c] of byTopic) expect(c, t).toBeGreaterThanOrEqual(9);
    for (const d of ["kolay", "orta", "zor"]) expect(QUESTION_BANK.filter((q) => q.difficulty === d).length, d).toBeGreaterThanOrEqual(20);
  });

  it("soru kimlikleri ve metinleri benzersiz; her soruda yöntem ve yaygın hata var", () => {
    expect(new Set(QUESTION_BANK.map((q) => q.id)).size).toBe(QUESTION_BANK.length);
    expect(new Set(QUESTION_BANK.map((q) => q.question)).size).toBe(QUESTION_BANK.length);
    for (const q of QUESTION_BANK) {
      expect(q.methods.length, q.id).toBeGreaterThan(0);
      expect(q.mistakes.length, q.id).toBeGreaterThan(0);
    }
  });

  it.each(QUESTION_BANK.map((q) => [q.id, q] as const))("%s: beklenen cevap bağımsız hesapla aynı", (_id, q) => {
    if (q.expr) {
      expect(exprMatches(q), `${q.answer} ifadesi doğru değil`).toBe(true);
      expect(q.verify().eq(Rational.of(q.expr.f(7)))).toBe(true);
    } else {
      expect(answersEquivalent(q.answer, q.verify().toString()), `${q.answer} ≠ ${q.verify().toString()}`).toBe(true);
    }
  });
});

describe("Demo (kural tabanlı) çözücünün test kümesindeki doğruluğu", () => {
  it("çözmeye çalıştığı hiçbir soruda yanlış sonuç vermez; kapsam raporlanır", () => {
    const rows: { id: string; topic: string; status: "dogru" | "yanlis" | "kapsam-disi"; got?: string; issues?: number }[] = [];
    for (const q of QUESTION_BANK) {
      const s = solveDemo(q.question);
      if (!s) {
        rows.push({ id: q.id, topic: q.topic, status: "kapsam-disi" });
        continue;
      }
      const got = s.finalAnswer.latex ?? s.finalAnswer.text;
      const ok = q.expr ? false : answersEquivalent(got, q.answer) === true || answersEquivalent(s.finalAnswer.text, q.answer) === true;
      rows.push({ id: q.id, topic: q.topic, status: ok ? "dogru" : "yanlis", got, issues: verifySolution(s).issues.length });
    }
    const attempted = rows.filter((r) => r.status !== "kapsam-disi");
    const wrong = rows.filter((r) => r.status === "yanlis");
    const summary = {
      tarih: new Date().toISOString(),
      toplam: rows.length,
      denenen: attempted.length,
      dogru: attempted.length - wrong.length,
      yanlis: wrong.length,
      kapsamDisi: rows.length - attempted.length,
      dogrulukOrani: attempted.length ? Math.round(((attempted.length - wrong.length) / attempted.length) * 1000) / 10 : null,
      yanlislar: wrong,
      adimTutarsizligi: attempted.filter((r) => (r.issues ?? 0) > 0).map((r) => r.id),
    };
    mkdirSync("reports", { recursive: true });
    writeFileSync("reports/demo-accuracy.json", JSON.stringify({ ...summary, satirlar: rows }, null, 2));
    console.log(`Demo çözücü: ${summary.denenen}/${summary.toplam} soruyu denedi, ${summary.dogru} doğru, ${summary.yanlis} yanlış.`);
    expect(wrong, JSON.stringify(wrong)).toEqual([]);
    expect(summary.adimTutarsizligi).toEqual([]);
  });
});

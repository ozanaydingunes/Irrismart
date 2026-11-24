import type { Solution, VerificationIssue } from "@/lib/schema/solution";
import { evaluate, parseExpression, variablesOf, type Env } from "./expr";
import { Rational } from "./rational";

/**
 * YZ çözümündeki sayısal eşitlikleri kesin aritmetikle denetler.
 * Yalnızca güvenle ayrıştırılabilen ifadeler kontrol edilir; anlaşılmayan ifadeler atlanır
 * (yanlış alarm vermemek, doğrulanamayanı "yanlış" saymamaktan daha önemlidir).
 */

const STATEMENT_SEPARATORS = /\\Rightarrow|\\implies|\\Longrightarrow|\\to|\\quad|\\qquad|\\\\|;|\\text\{\s*ve\s*\}|,\s|⇒|→/g;

export function splitStatements(latex: string): string[] {
  return latex
    .split(STATEMENT_SEPARATORS)
    .map((s) => s.replace(/&/g, " ").trim())
    .filter(Boolean);
}

/** "x = 5", "x=\frac{3}{2}" gibi nihai cevaplardan değişken değerini çıkarır. */
export function extractAssignment(text: string | undefined): Env {
  const env: Env = {};
  if (!text) return env;
  for (const stmt of splitStatements(text)) {
    const m = /^\s*([a-zA-Z])\s*=\s*(.+)$/.exec(stmt);
    if (!m) continue;
    const node = parseExpression(m[2]);
    if (!node || variablesOf(node).size) continue;
    const v = evaluate(node);
    if (v) env[m[1]] = v;
  }
  return env;
}

export interface ChainCheck {
  checked: number;
  mismatches: { left: string; right: string; leftValue: string; rightValue: string }[];
}

/** Bir LaTeX satırındaki eşitlik zincirlerini kontrol eder. */
export function checkEqualities(latex: string, env: Env = {}): ChainCheck {
  const result: ChainCheck = { checked: 0, mismatches: [] };
  if (!latex || /[<>≤≥≠≈]|\\(?:le|ge|leq|geq|neq|approx|lt|gt)\b/.test(latex)) return result;
  for (const stmt of splitStatements(latex)) {
    const parts = stmt.split("=").map((p) => p.trim());
    if (parts.length < 2) continue;
    const values = parts.map((p) => {
      if (!p) return null;
      const node = parseExpression(p);
      if (!node) return null;
      for (const v of variablesOf(node)) if (!env[v]) return null;
      return evaluate(node, env);
    });
    for (let i = 0; i + 1 < values.length; i++) {
      const a = values[i];
      const b = values[i + 1];
      if (!a || !b) continue;
      result.checked++;
      if (!a.eq(b)) {
        result.mismatches.push({
          left: parts[i],
          right: parts[i + 1],
          leftValue: a.toString(),
          rightValue: b.toString(),
        });
      }
    }
  }
  return result;
}

export function verifySolution(solution: Solution): { issues: VerificationIssue[]; checked: number } {
  const env = {
    ...extractAssignment(solution.finalAnswer.text),
    ...extractAssignment(solution.finalAnswer.latex),
  };
  const issues: VerificationIssue[] = [];
  let checked = 0;
  for (const step of solution.steps) {
    // Önce değişkensiz aritmetik, sonra (varsa) nihai cevabı yerine koyarak kontrol
    const plain = checkEqualities(step.latex);
    checked += plain.checked;
    for (const m of plain.mismatches) {
      issues.push({
        stepId: step.stepId,
        kind: "arithmetic",
        message: `${m.left} ile ${m.right} eşit görünmüyor (${fmt(m.leftValue)} ≠ ${fmt(m.rightValue)}).`,
      });
    }
    if (Object.keys(env).length && !plain.mismatches.length) {
      const sub = checkEqualities(step.latex, env);
      const extra = sub.checked - plain.checked;
      if (extra > 0) checked += extra;
      for (const m of sub.mismatches) {
        issues.push({
          stepId: step.stepId,
          kind: "substitution",
          message: `Nihai cevap yerine konduğunda ${m.left} = ${m.right} sağlanmıyor.`,
        });
      }
    }
  }
  return { issues, checked };
}

function fmt(v: string) {
  const [n, d] = v.split("/");
  if (!d) return n;
  const r = new Rational(BigInt(n), BigInt(d));
  return r.toDecimalString() ?? v;
}

/**
 * GERÇEK YAPAY ZEKÂ DEĞERLENDİRMESİ (ücretli). Varsayılan olarak ATLANIR.
 *
 *   npm run eval:ai                       → yalnızca tahmini maliyeti gösterir, API çağrısı yapmaz
 *   AI_EVAL_CONFIRM=1 npm run eval:ai     → soruları gerçekten gönderir
 *   AI_EVAL_LIMIT=20 …                    → ilk 20 soruyla sınırla (varsayılan: tümü)
 *
 * Anahtar .env.local dosyasından okunur. Sonuçlar reports/ai-eval-*.json ve .md dosyalarına yazılır.
 * Sınıflandırma: doğru · yanlış · doğru sonuç ama adımlarda tutarsızlık (yanlış yöntem şüphesi) · hata.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const RUN = process.env.RUN_AI_EVAL === "1";

describe.skipIf(!RUN)("Gerçek YZ doğruluk değerlendirmesi", () => {
  it(
    "test kümesini YZ'ye çözdürüp beklenen cevaplarla karşılaştırır",
    async () => {
      if (existsSync(".env.local")) process.loadEnvFile(".env.local");
      const { getConfig } = await import("@/lib/server/config");
      const { getProvider, solveQuestion } = await import("@/lib/ai/service");
      const { estimateCostUsd } = await import("@/lib/ai/pricing");
      const { answersEquivalent } = await import("@/lib/math/answer");
      const { evaluate, parseExpression } = await import("@/lib/math/expr");
      const { Rational } = await import("@/lib/math/rational");
      const { QUESTION_BANK } = await import("./data/questionBank");

      const cfg = getConfig();
      const provider = getProvider(cfg);
      if (!provider || cfg.provider === "mock") {
        console.log("Gerçek YZ sağlayıcısı yapılandırılmamış (.env.local içinde ANTHROPIC_API_KEY veya OPENAI_API_KEY yok). Değerlendirme yapılmadı.");
        return;
      }
      const limit = Math.min(QUESTION_BANK.length, Number(process.env.AI_EVAL_LIMIT) || QUESTION_BANK.length);
      const items = QUESTION_BANK.slice(0, limit);
      const model = cfg.provider === "anthropic" ? cfg.anthropic.model : cfg.openai.model;
      // Kaba tahmin: soru başına ~3.500 giriş + ~4.000 çıkış jetonu (düşünme dahil); onarım çağrısı payı %10
      const estimate = items.length * estimateCostUsd(model, 3500, 4000) * 1.1;
      console.log(`\nSağlayıcı: ${provider.name}\nSoru sayısı: ${items.length}\nTahmini maliyet: ~${estimate.toFixed(2)} USD (gerçek tutar farklı olabilir)\n`);
      if (process.env.AI_EVAL_CONFIRM !== "1") {
        console.log("Onay verilmedi: hiçbir API çağrısı yapılmadı. Çalıştırmak için AI_EVAL_CONFIRM=1 ekleyin.");
        return;
      }

      let spent = 0;
      type Row = { id: string; topic: string; difficulty: string; expected: string; got?: string; status: "dogru" | "yanlis" | "dogru-adim-tutarsiz" | "hata"; note?: string; ms: number };
      const rows: Row[] = [];
      const queue = [...items];
      const worker = async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
          const t0 = Date.now();
          const r = await solveQuestion(
            { text: item.question, mode: "full" },
            { provider, onUsage: (u) => void (spent += estimateCostUsd(u.model, u.usage.inputTokens, u.usage.outputTokens)) },
          );
          const ms = Date.now() - t0;
          if (!r.ok) {
            rows.push({ id: item.id, topic: item.topic, difficulty: item.difficulty, expected: item.answer, status: "hata", note: `${r.code}: ${r.message}`, ms });
            continue;
          }
          const fa = r.solution.finalAnswer;
          let correct: boolean;
          if (item.expr) {
            const cand = (fa.latex ?? fa.text).split("=").pop()!.trim();
            const node = parseExpression(cand);
            correct = !!node && [-3, 2, 7].every((v) => evaluate(node, { [item.expr!.variable]: Rational.of(v) })?.eq(Rational.of(item.expr!.f(v))) === true);
          } else {
            correct = [fa.choice, fa.latex, fa.text].some((c) => c && answersEquivalent(c, item.answer) === true);
          }
          const inconsistent = r.issues.length > 0 || !r.solution.verification.isVerified;
          rows.push({
            id: item.id,
            topic: item.topic,
            difficulty: item.difficulty,
            expected: item.answer,
            got: fa.latex ?? fa.text,
            status: !correct ? "yanlis" : inconsistent ? "dogru-adim-tutarsiz" : "dogru",
            note: r.issues.map((i) => i.message).join(" | ") || undefined,
            ms,
          });
        }
      };
      await Promise.all([worker(), worker()]);

      const count = (s: Row["status"]) => rows.filter((r) => r.status === s).length;
      const answered = rows.filter((r) => r.status !== "hata").length;
      const summary = {
        tarih: new Date().toISOString(),
        saglayici: provider.name,
        soru: rows.length,
        dogru: count("dogru"),
        dogruAmaAdimTutarsiz: count("dogru-adim-tutarsiz"),
        yanlis: count("yanlis"),
        hata: count("hata"),
        dogrulukOrani: answered ? Math.round(((count("dogru") + count("dogru-adim-tutarsiz")) / answered) * 1000) / 10 : null,
        ortalamaSureMs: Math.round(rows.reduce((a, r) => a + r.ms, 0) / Math.max(1, rows.length)),
        yaklasikMaliyetUsd: Math.round(spent * 1000) / 1000,
      };
      mkdirSync("reports", { recursive: true });
      const stamp = summary.tarih.replace(/[:.]/g, "-");
      writeFileSync(`reports/ai-eval-${stamp}.json`, JSON.stringify({ summary, rows }, null, 2));
      const md = [
        `# Gerçek YZ değerlendirmesi — ${summary.tarih}`,
        "",
        `Sağlayıcı: ${summary.saglayici} · Soru: ${summary.soru} · Doğruluk: %${summary.dogrulukOrani} · Yaklaşık maliyet: ${summary.yaklasikMaliyetUsd} USD`,
        "",
        "| Kimlik | Konu | Zorluk | Beklenen | YZ | Durum | Not |",
        "|---|---|---|---|---|---|---|",
        ...rows.map((r) => `| ${r.id} | ${r.topic} | ${r.difficulty} | ${r.expected} | ${(r.got ?? "").replace(/\|/g, "\\|")} | ${r.status} | ${(r.note ?? "").replace(/\|/g, "/")} |`),
      ].join("\n");
      writeFileSync(`reports/ai-eval-${stamp}.md`, md);
      console.log(JSON.stringify(summary, null, 2));
      expect(rows.length).toBe(items.length);
    },
    60 * 60 * 1000,
  );
});

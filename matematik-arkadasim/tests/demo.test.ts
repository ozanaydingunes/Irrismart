import { describe, expect, it } from "vitest";
import { DEMO_SAMPLES, findSample } from "@/lib/demo/samples";
import { solveArithmetic, solveDemo, solveLinearEquation, solvePercent } from "@/lib/demo/solver";
import { demoCheck, demoPractice, demoTutorReply } from "@/lib/demo/tutor";
import { verifySolution } from "@/lib/math/verify";
import { solutionSchema } from "@/lib/schema/solution";

function check(s: ReturnType<typeof solveDemo>) {
  expect(s).not.toBeNull();
  expect(solutionSchema.safeParse(s).success).toBe(true);
  expect(verifySolution(s!).issues).toEqual([]);
  for (const st of s!.steps) expect(st.narration).not.toMatch(/\\[a-z]+|[{}^]/); // seslendirmede LaTeX yok
  return s!;
}

describe("Demo çözücü — kesirler", () => {
  it("3/4 + 1/6 = 11/12, payda eşitleme adımı ve kesir şeridi", () => {
    const s = check(solveArithmetic("3/4 + 1/6 işleminin sonucu kaçtır?"));
    expect(s.finalAnswer.text).toContain("11/12");
    const st = s.steps.find((x) => x.title === "Paydaları eşitleyelim")!;
    expect(st.latex).toContain("\\frac{9}{12}");
    expect(st.visualInstructions[0]?.type).toBe("fractionBars");
  });
  it("bölmede ters çevirip çarpar", () => {
    const s = check(solveArithmetic("2/3 ÷ 4/9"));
    expect(s.finalAnswer.latex).toBe("\\frac{3}{2}");
    expect(s.steps.some((x) => x.latex.includes("\\frac{9}{4}"))).toBe(true);
  });
});

describe("Demo çözücü — tam sayılar / rasyonel sayılar", () => {
  it("işlem önceliğine uyar", () => {
    const s = check(solveArithmetic("5 - 3 · 2 + 2^3"));
    expect(s.finalAnswer.text).toBe("Sonuç: 7");
    expect(s.steps[1].title).toBe("Çarpma işlemini yapalım");
  });
  it("negatif çıkarmayı açıklar ve sayı doğrusu çizer", () => {
    const s = check(solveArithmetic("(-8) + 5 - (-3)"));
    expect(s.finalAnswer.text).toBe("Sonuç: 0");
    expect(s.steps.some((x) => x.visualInstructions.some((v) => v.type === "numberLine"))).toBe(true);
  });
  it("ondalık + kesir", () => expect(check(solveArithmetic("0,5 + 1/4")).finalAnswer.text).toContain("3/4"));
});

describe("Demo çözücü — denklemler", () => {
  it("2x + 5 = 15 → x = 5 ve kontrol adımı", () => {
    const s = check(solveLinearEquation("2x + 5 = 15 denklemini çözünüz."));
    expect(s.finalAnswer.text).toBe("x = 5");
    expect(s.steps.at(-1)!.title).toBe("Kontrol edelim");
  });
  it("3(x - 2) = 2x + 4 → x = 10", () => expect(check(solveLinearEquation("3(x - 2) = 2x + 4")).finalAnswer.text).toBe("x = 10"));
  it("kesirli sonuç: 4x - 1 = 2 → x = 3/4", () => expect(check(solveLinearEquation("4x - 1 = 2")).finalAnswer.text).toBe("x = 3/4"));
  it("çözümsüz/özdeşlik denklemlerinde uydurmaz", () => expect(solveLinearEquation("x + 1 = x + 2")).toBeNull());
  it("birlikte çözme için öğrenci sorusu üretir", () => {
    const s = check(solveLinearEquation("2x + 5 = 15"));
    expect(s.steps.filter((x) => x.studentQuestion).length).toBeGreaterThanOrEqual(2);
  });
});

describe("Demo çözücü — yüzdeler", () => {
  it("240 sayısının %25'i = 60, doğru ekle", () => {
    const s = check(solvePercent("240 sayısının %25'i kaçtır?"));
    expect(s.finalAnswer.text).toBe("240 sayısının %25'i 60 eder.");
  });
  it("yüzde ile yazılmış soru", () => expect(check(solvePercent("80'in yüzde 15'i kaçtır?")).finalAnswer.latex).toBe("12"));
  it("indirim problemini kural tabanlı çözücüye bırakmaz", () => expect(solvePercent("400 TL'ye %20 indirim")).toBeNull());
});

describe("Demo örnekleri (problemler ve geometri)", () => {
  it("tüm örnekler şemaya uygun ve doğrulanmış", () => {
    for (const s of DEMO_SAMPLES) {
      expect(solutionSchema.safeParse(s.solution).success, s.id).toBe(true);
      expect(verifySolution(s.solution).issues, s.id).toEqual([]);
    }
  });
  it("geometri örneği SVG çizimi ve doğru şık içerir", () => {
    const g = DEMO_SAMPLES.find((s) => s.id === "ucgen-aci")!.solution;
    expect(g.finalAnswer.choice).toBe("B");
    expect(g.steps[0].visualInstructions[0]?.type).toBe("geometry");
  });
  it("örnek soru metniyle eşleşir", () => expect(findSample(DEMO_SAMPLES[0].question)?.id).toBe(DEMO_SAMPLES[0].id));
  it("anlaşılmayan soruda null döner (uydurmaz)", () => expect(solveDemo("Bugün hava nasıl?")).toBeNull());
});

describe("Demo özel ders ve kontrol", () => {
  const sol = DEMO_SAMPLES[1].solution;
  it("ipucu adımın ipucunu verir", () => expect(demoTutorReply(sol, 1, "hint").message).toContain("25'ten 4 geri say"));
  it("doğru / yanlış cevap", () => {
    expect(demoCheck("21", "21").correct).toBe(true);
    expect(demoCheck("20", "21").correct).toBe(false);
  });
  it("konuya göre alıştırma üretir", () => {
    for (const t of ["kesirler", "denklemler", "yuzdeler", "tam-sayilar", "rasyonel-sayilar", "cokgenler"]) {
      const p = demoPractice(t);
      expect(p, t).not.toBeNull();
      expect(verifySolution(p!).issues, t).toEqual([]);
    }
  });
});

describe("Öğretmen anlatım kalitesi (demo çıktıları)", () => {
  const BANNED = /karşıya at|karşı tarafa geçir|karşıya geçir|karşıya götür/i;
  const outputs = [
    ...DEMO_SAMPLES.map((s) => s.solution),
    ...["2x + 5 = 15", "4x - 7 = 2x + 9", "3(x - 2) = 2x + 4", "3/4 + 1/6", "(-8) + 5 - (-3)", "240 sayısının %25'i kaçtır?"].map((q) => solveDemo(q)!),
  ];
  it("ezber 'karşıya at' dili kullanılmaz", () => {
    for (const s of outputs) expect(JSON.stringify(s)).not.toMatch(BANNED);
  });
  it("denklem adımları işlemin nedenini (denge) anlatır ve kontrol adımıyla biter", () => {
    const s = solveDemo("2x + 5 = 15")!;
    expect(s.steps.map((x) => x.narration).join(" ")).toMatch(/dengesini bozmamak/);
    expect(s.steps.at(-1)!.title).toMatch(/Kontrol/);
  });
  it("her çözümde verilenler, istenen, strateji, kontrol ve benzer soru var", () => {
    for (const s of outputs) {
      expect(s.givenInformation.length).toBeGreaterThan(0);
      expect(s.requestedInformation).toBeTruthy();
      expect(s.solutionStrategy).toBeTruthy();
      expect(s.verification.method).toBeTruthy();
      expect(s.similarQuestion.text).toBeTruthy();
    }
  });
  it("öğrenciyi küçümseyen ifade yok", () => {
    for (const s of outputs) expect(JSON.stringify(s)).not.toMatch(/çok kolay|bunu bilmen gerek|basit bir şey/i);
  });
});

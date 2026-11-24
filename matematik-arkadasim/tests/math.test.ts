import { describe, expect, it } from "vitest";
import { answersEquivalent } from "@/lib/math/answer";
import { evaluate, parseExpression, toLinear } from "@/lib/math/expr";
import { Rational } from "@/lib/math/rational";
import { checkEqualities, verifySolution } from "@/lib/math/verify";
import { DEMO_SAMPLES } from "@/lib/demo/samples";

const val = (s: string) => {
  const n = parseExpression(s);
  return n ? evaluate(n)?.toString() : null;
};

describe("Rasyonel aritmetik (kayan nokta hatası yok)", () => {
  it("0,1 + 0,2 tam olarak 3/10", () => {
    expect(Rational.parseDecimal("0,1")!.add(Rational.parseDecimal("0.2")!).toString()).toBe("3/10");
  });
  it("sadeleştirir ve işareti paya taşır", () => {
    expect(new Rational(6n, -8n).toString()).toBe("-3/4");
  });
  it("sonlu ondalık gösterim", () => {
    expect(Rational.of(3, 8).toDecimalString()).toBe("0,375");
    expect(Rational.of(1, 3).toDecimalString()).toBeNull();
    expect(Rational.of(-5, 4).toDecimalString()).toBe("-1,25");
  });
  it("sıfıra bölme hata verir", () => {
    expect(() => Rational.of(1).div(Rational.of(0))).toThrow();
  });
});

describe("Kesirler", () => {
  it.each([
    ["3/4 + 1/6", "11/12"],
    ["\\frac{2}{3} - \\frac{1}{4}", "5/12"],
    ["1/2 · 2/3", "1/3"],
    ["2/3 ÷ 4/9", "3/2"],
    ["\\dfrac{5}{6} \\div \\dfrac{5}{12}", "2"],
    ["1 + 1/2", "3/2"],
  ])("%s = %s", (e, r) => expect(val(e)).toBe(r));
});

describe("Tam sayılar ve işlem önceliği", () => {
  it.each([
    ["(-8) + 5 - (-3)", "0"],
    ["5 - 3 · 2 + 2^3", "7"],
    ["(-2)^3", "-8"],
    ["(-2)^2", "4"],
    ["-12 \\div 3", "-4"],
    ["2(3+4)", "14"],
    ["\\left(-3\\right) \\cdot \\left(-4\\right)", "12"],
  ])("%s = %s", (e, r) => expect(val(e)).toBe(r));
});

describe("Rasyonel sayılar ve ondalıklar", () => {
  it.each([
    ["0,5 + 1/4", "3/4"],
    ["-3/4 + 1/2", "-1/4"],
    ["2,5 · 4", "10"],
    ["\\sqrt{25}", "5"],
    ["√16 + 3²", "13"],
  ])("%s = %s", (e, r) => expect(val(e)).toBe(r));
  it("irrasyonel karekök hesaplanmaz (null)", () => expect(val("\\sqrt{2}")).toBeFalsy());
});

describe("Yüzdeler", () => {
  it.each([
    ["%25 · 240", "60"],
    ["240 · 25%", "60"],
    ["\\%20 \\cdot 400", "80"],
  ])("%s = %s", (e, r) => expect(val(e)).toBe(r));
});

describe("Denklemler (doğrusal biçim)", () => {
  it("2x + 5 → a=2, b=5", () => {
    const l = toLinear(parseExpression("2x + 5")!, "x")!;
    expect([l.a.toString(), l.b.toString()]).toEqual(["2", "5"]);
  });
  it("3(x - 2) → 3x - 6", () => {
    const l = toLinear(parseExpression("3(x - 2)")!, "x")!;
    expect([l.a.toString(), l.b.toString()]).toEqual(["3", "-6"]);
  });
  it("x² doğrusal değildir", () => expect(toLinear(parseExpression("x^2 + 1")!, "x")).toBeNull());
});

describe("Çözüm doğrulayıcı", () => {
  it("doğru eşitlik zincirinde hata yok", () => {
    expect(checkEqualities("\\frac{3}{4} + \\frac{1}{6} = \\frac{9}{12} + \\frac{2}{12} = \\frac{11}{12}").mismatches).toHaveLength(0);
  });
  it("yanlış aritmetiği yakalar", () => {
    const r = checkEqualities("\\frac{3}{4} + \\frac{1}{6} = \\frac{4}{10}");
    expect(r.mismatches).toHaveLength(1);
  });
  it("\\Rightarrow ile ayrılmış ifadeleri karıştırmaz", () => {
    expect(checkEqualities("2x = 10 \\Rightarrow x = 5", { x: Rational.of(5) }).mismatches).toHaveLength(0);
  });
  it("eşitsizlik ve birimli ifadeleri atlar (yanlış alarm yok)", () => {
    expect(checkEqualities("-\\frac{3}{4} < -\\frac{1}{3}").checked).toBe(0);
    expect(checkEqualities("A = 6 \\text{ cm} \\cdot 4 \\text{ cm}").mismatches).toHaveLength(0);
  });
  it("tüm demo örnekleri doğrulamadan geçer", () => {
    for (const s of DEMO_SAMPLES) expect(verifySolution(s.solution).issues, s.id).toEqual([]);
  });
});

describe("Cevap eşdeğerliği", () => {
  it.each([
    ["0,5", "1/2", true],
    ["%50", "1/2", true],
    ["x = 5", "5", true],
    ["150 TL", "150", true],
    ["60°", "60", true],
    ["b", "B", true],
    ["B)", "B", true],
    ["7", "8", false],
    ["11/12", "\\frac{11}{12}", true],
  ])("%s ~ %s → %s", (a, b, r) => expect(answersEquivalent(a, b)).toBe(r));
  it("anlaşılmayan cevapta karar vermez", () => expect(answersEquivalent("bilmiyorum", "5")).toBeNull());
});

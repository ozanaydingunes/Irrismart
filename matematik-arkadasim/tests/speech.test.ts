import { describe, expect, it } from "vitest";
import { latexToSpeech, textToSpeech } from "@/lib/speech/mathToSpeech";
import { decimalToWords, genitive, integerToWords, locative, numberWithSuffix, ordinal } from "@/lib/speech/turkishNumbers";

describe("Türkçe sayı okuma", () => {
  it.each([
    [0, "sıfır"],
    [7, "yedi"],
    [15, "on beş"],
    [100, "yüz"],
    [1000, "bin"],
    [1250, "bin iki yüz elli"],
    [2026, "iki bin yirmi altı"],
    [-7, "eksi yedi"],
    [1000000, "bir milyon"],
  ])("%i → %s", (n, w) => expect(integerToWords(n)).toBe(w));
  it("ondalık", () => {
    expect(decimalToWords("2,5")).toBe("iki virgül beş");
    expect(decimalToWords("0,05")).toBe("sıfır virgül sıfır beş");
  });
  it("ünlü uyumlu ekler", () => {
    expect(locative("beş")).toBe("beşte");
    expect(locative("on")).toBe("onda");
    expect(locative("dört")).toBe("dörtte");
    expect(locative("iki")).toBe("ikide");
    expect(genitive("iks")).toBe("iksin");
    expect(genitive("dört")).toBe("dördün");
    expect(genitive("iki")).toBe("ikinin");
    expect(ordinal(3)).toBe("üçüncü");
    expect(ordinal(4)).toBe("dördüncü");
    expect(numberWithSuffix("%25", "possessive")).toBe("%25'i");
    expect(numberWithSuffix(10, "possessive")).toBe("10'u");
    expect(numberWithSuffix(4, "genitive")).toBe("4'ün");
  });
});

describe("Matematik → konuşma (şartnamedeki örnekler)", () => {
  it.each([
    ["x²", "iksin karesi"],
    ["3/5", "beşte üç"],
    ["√25", "yirmi beşin karekökü"],
    ["2x + 5 = 15", "iki iks artı beş eşittir on beş"],
  ])("%s → %s", (i, o) => expect(textToSpeech(i)).toBe(o));
});

describe("LaTeX hiçbir zaman olduğu gibi okunmaz", () => {
  it.each([
    ["\\frac{3}{4}+\\frac{1}{6}=\\frac{11}{12}", "dörtte üç artı altıda bir eşittir on ikide on bir"],
    ["x^{2}", "iksin karesi"],
    ["2^3", "ikinin küpü"],
    ["\\sqrt{49}", "kırk dokuzun karekökü"],
    ["\\%25", "yüzde yirmi beş"],
    ["3 \\cdot 4 = 12", "üç çarpı dört eşittir on iki"],
    ["12 \\div 3", "on iki bölü üç"],
    ["-\\frac{3}{4} < -\\frac{1}{3}", "eksi dörtte üç küçüktür eksi üçte bir"],
    ["3\\left(x - 2\\right)", "üç çarpı parantez içinde iks eksi iki"],
    ["x^{-2}", "iksin eksi ikinci kuvveti"],
  ])("%s", (i, o) => expect(latexToSpeech(i)).toBe(o));
  it("bilinmeyen komutlarda ters bölü okunmaz", () => {
    const out = latexToSpeech("m(\\hat{A}) = 60^\\circ");
    expect(out).not.toMatch(/\\|\{|\}/);
    expect(out).toContain("A açısı");
    expect(out).toContain("derece");
  });
});

describe("Anlatım metninde yalnızca matematik çevrilir", () => {
  it("Türkçe cümleyi bozmaz", () => {
    expect(textToSpeech("Şimdi paydaları eşitleyelim.")).toBe("Şimdi paydaları eşitleyelim.");
    expect(textToSpeech("o zaman A şıkkı doğru")).toBe("o zaman A şıkkı doğru");
  });
  it("kesme işaretli ekleri korur", () => {
    expect(textToSpeech("x'in karesi")).toBe("iksin karesi");
    expect(textToSpeech("4'ün karesi 16'dır")).toBe("dördün karesi on altıdır");
    expect(textToSpeech("%25'i 60 eder")).toBe("yüzde yirmi beşi altmış eder");
  });
  it("$...$ içindeki LaTeX'i çevirir", () => {
    expect(textToSpeech("Sonuç $\\frac{1}{2}$ olur.")).toBe("Sonuç ikide bir olur.");
  });
  it("ondalık ve negatif", () => {
    expect(textToSpeech("2,5 kg")).toBe("iki virgül beş kg");
    expect(textToSpeech("-3 + 5")).toBe("eksi üç artı beş");
  });
});

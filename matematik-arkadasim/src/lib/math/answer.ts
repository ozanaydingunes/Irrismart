import { evaluate, parseExpression, variablesOf } from "./expr";
import type { Rational } from "./rational";

/**
 * Öğrenci cevabını beklenen cevapla matematiksel eşdeğerlik açısından karşılaştırır.
 * 0,5 = 1/2 = %50 ; "x = 5" = "5" ; "150 TL" = "150" ; "B" = "b)"
 * Karar verilemezse null döner (bu durumda YZ'ye sorulur veya öğrenciye kendini değerlendirmesi önerilir).
 */

// Türkçe harfler \b ile çalışmadığı için harf olmayan sınırlar kullanılır
const UNIT_WORDS =
  /(?<![A-Za-zÇĞİÖŞÜçğıöşü])(tl|lira|kuruş|cm²|cm2|cm³|cm|mm|m²|m2|m|km|kg|g|gr|derece|adet|tane|sayfa|öğrenci|kişi|saat|dakika|dk|sn|saniye|litre|lt|ml|cevap|sonuç|sonucu|eder|olur|dır|dir|dur|dür|tır|tir|tur|tür)(?![A-Za-zÇĞİÖŞÜçğıöşü])/gi;

export function choiceLetter(s: string): string | null {
  const m = /^\s*([A-Ea-e])\s*[).:\-]?\s*(?:şıkkı|seçeneği)?\s*$/.exec(s);
  return m ? m[1].toUpperCase() : null;
}

export function answerValue(raw: string): Rational | null {
  let s = raw
    .trim()
    .replace(/°|\\circ|\^\\circ|\^\{\\circ\}/g, "")
    .replace(/['’][a-zçğıöşü]+/gi, "")
    .replace(UNIT_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!]$/, "");
  // "x = 5" → "5" (son eşitliğin sağ tarafı)
  if (s.includes("=")) s = s.split("=").pop()!.trim();
  if (!s) return null;
  const node = parseExpression(s);
  if (!node || variablesOf(node).size) return null;
  return evaluate(node);
}

/** true: eşdeğer, false: farklı, null: karar verilemedi */
export function answersEquivalent(student: string, expected: string): boolean | null {
  const ce = choiceLetter(expected);
  const cs = choiceLetter(student);
  if (ce && cs) return ce === cs;
  const a = answerValue(student);
  const b = answerValue(expected);
  if (a && b) return a.eq(b);
  const ns = student.toLocaleLowerCase("tr-TR").replace(/\s+/g, "");
  const ne = expected.toLocaleLowerCase("tr-TR").replace(/\s+/g, "");
  if (ns && ns === ne) return true;
  return null;
}

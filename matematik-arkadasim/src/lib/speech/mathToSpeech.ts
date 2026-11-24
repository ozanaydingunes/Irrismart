import { parseExpression, type Node } from "@/lib/math/expr";
import { dative, decimalToWords, genitive, integerToWords, letterName, locative, ordinal } from "./turkishNumbers";

/**
 * Matematiksel ifadeleri doğal Türkçe konuşmaya çevirir.
 *   x²          → "iksin karesi"          (yazılışı: x'in karesi)
 *   3/5         → "beşte üç"
 *   √25         → "yirmi beşin karekökü"
 *   2x + 5 = 15 → "iki iks artı beş eşittir on beş"
 * LaTeX kodu asla olduğu gibi okunmaz.
 */

const RELATIONS: [RegExp, string][] = [
  [/\\leq?(?![a-zA-Z])|≤|<=/, "küçük eşittir"],
  [/\\geq?(?![a-zA-Z])|≥|>=/, "büyük eşittir"],
  [/\\neq?(?![a-zA-Z])|≠/, "eşit değildir"],
  [/\\approx|≈/, "yaklaşık olarak eşittir"],
  [/\\lt(?![a-zA-Z])|</, "küçüktür"],
  [/\\gt(?![a-zA-Z])|>/, "büyüktür"],
  [/=/, "eşittir"],
];
const RELATION_SPLIT = /(\\leq?(?![a-zA-Z])|\\geq?(?![a-zA-Z])|\\neq?(?![a-zA-Z])|\\approx|\\lt(?![a-zA-Z])|\\gt(?![a-zA-Z])|≤|≥|≠|≈|<=|>=|<|>|=)/;

function isSimple(n: Node): boolean {
  return n.kind === "num" || n.kind === "var" || (n.kind === "group" && isSimple(n.arg));
}

function speakNum(raw: string): string {
  return /[.,]/.test(raw) ? decimalToWords(raw) : integerToWords(BigInt(raw));
}

export function speakNode(n: Node): string {
  switch (n.kind) {
    case "num":
      return speakNum(n.raw);
    case "var":
      return letterName(n.name);
    case "group":
      return n.arg.kind === "bin" ? `parantez içinde ${speakNode(n.arg)}` : speakNode(n.arg);
    case "neg":
      return `eksi ${speakNode(n.arg)}`;
    case "percent":
      return `yüzde ${speakNode(n.arg)}`;
    case "sqrt":
      return `${genitive(speakNode(n.arg))} karekökü`;
    case "pow": {
      const base = speakNode(n.base);
      const exp = n.exp.kind === "group" ? n.exp.arg : n.exp;
      if (exp.kind === "num" && exp.value.isInteger()) {
        const e = Number(exp.value.n);
        if (e === 2) return `${genitive(base)} karesi`;
        if (e === 3) return `${genitive(base)} küpü`;
        if (e > 0 && e <= 100) return `${genitive(base)} ${ordinal(e)} kuvveti`;
      }
      if (exp.kind === "neg" && exp.arg.kind === "num") {
        return `${genitive(base)} eksi ${ordinal(Number(exp.arg.value.n))} kuvveti`;
      }
      return `${base} üssü ${speakNode(exp)}`;
    }
    case "bin": {
      const l = speakNode(n.left);
      const r = speakNode(n.right);
      switch (n.op) {
        case "+":
          return `${l} artı ${r}`;
        case "-":
          return `${l} eksi ${r}`;
        case "*": {
          const implicit =
            (n.left.kind === "num" && (n.right.kind === "var" || n.right.kind === "pow")) ||
            (n.left.kind === "var" && n.right.kind === "var");
          return implicit ? `${l} ${r}` : `${l} çarpı ${r}`;
        }
        case "/": {
          if (n.divSign) return `${l} bölü ${r}`;
          // Kesir okuması: payda önce, bulunma ekiyle (beşte üç)
          const properOrExplicit =
            n.explicitFrac ||
            (n.left.kind === "num" && n.right.kind === "num" && n.left.value.cmp(n.right.value) < 0) ||
            (isSimple(n.left) && n.right.kind === "num" && n.left.kind !== "num");
          if (properOrExplicit && isSimple(n.right)) return `${locative(r)} ${l}`;
          if (properOrExplicit) return `pay ${l}, payda ${r} olan kesir`;
          return `${l} bölü ${r}`;
        }
      }
    }
  }
}

/** Tek bir ifade veya eşitlik/eşitsizlik zincirini okur. Anlaşılamazsa null. */
export function expressionToSpeech(input: string): string | null {
  const cleaned = input
    .replace(/\\text\{([^{}]*)\}/g, " $1 ")
    .replace(/\\(?:mathrm|textbf|mathbf)\{([^{}]*)\}/g, " $1 ")
    .replace(/&/g, " ")
    .replace(/\\\\/g, " , ")
    .trim();
  const parts = cleaned.split(RELATION_SPLIT);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim();
    if (i % 2 === 1) {
      const rel = RELATIONS.find(([re]) => re.test(p));
      out.push(rel ? rel[1] : p);
      continue;
    }
    if (!p) {
      if (i === 0 || i === parts.length - 1) continue;
      return null;
    }
    const node = parseExpression(p);
    if (!node) return null;
    out.push(speakNode(node));
  }
  return out.join(" ").replace(/\s+/g, " ").trim() || null;
}

/** LaTeX → konuşma. Ayrıştırılamayan kısımlar için sembol bazlı yedek çeviri kullanılır. */
export function latexToSpeech(latex: string): string {
  if (!latex.trim()) return "";
  const statements = latex.split(/\\Rightarrow|\\implies|\\quad|\\qquad|\\\\|;/).map((s) => s.trim()).filter(Boolean);
  return statements
    .map((s) => expressionToSpeech(s) ?? fallbackSymbols(s))
    .join(", ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ayrıştırılamayan ifadeler için kaba ama güvenli sembol çevirisi. */
export function fallbackSymbols(s: string): string {
  return s
    .replace(/m\s*\(\s*\\(?:hat|widehat)\{([A-Za-z]+)\}\s*\)/g, " $1 açısı ")
    .replace(/\\(?:hat|widehat)\{([A-Za-z]+)\}/g, " $1 açısı ")
    .replace(/\\overline\{([A-Za-z]+)\}/g, " $1 doğru parçası ")
    .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a, b) => {
      const num = fallbackSymbols(a);
      const den = fallbackSymbols(b);
      return ` ${locative(den)} ${num} `;
    })
    .replace(/\\sqrt\{([^{}]*)\}/g, (_, a) => ` ${genitive(fallbackSymbols(a))} karekökü `)
    .replace(/\\text\{([^{}]*)\}/g, " $1 ")
    .replace(/\\left|\\right|\\,|\\;|\\!|\\displaystyle/g, " ")
    .replace(/\\cdot|\\times|[×·]/g, " çarpı ")
    .replace(/\\div|÷/g, " bölü ")
    .replace(/\\pi|π/g, " pi ")
    .replace(/\\degree|\^\{?\\circ\}?|°/g, " derece ")
    .replace(/\\angle|∠/g, " açı ")
    .replace(/\\triangle|△/g, " üçgen ")
    .replace(/\\%|%/g, " yüzde ")
    .replace(/\\(?:leq?|geq?|neq?|approx)/g, (m) => ` ${RELATIONS.find(([re]) => re.test(m))?.[1] ?? ""} `)
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\^2|²/g, " kare ")
    .replace(/\^3|³/g, " küp ")
    .replace(/=/g, " eşittir ")
    .replace(/\+/g, " artı ")
    .replace(/[-−]/g, " eksi ")
    .replace(/\d+(?:[.,]\d+)?/g, (m) => ` ${speakNum(m)} `)
    .replace(/(^|\s)([a-z])(?=\s|$)/g, (_, sp, ch) => `${sp}${letterName(ch)}`)
    .replace(/\s+/g, " ")
    .trim();
}

/* ─────────────── Düz Türkçe metin içindeki matematik parçalarını çevirme ─────────────── */

const TOKEN_RE =
  /(\\[a-zA-Z]+(?:\{[^{}]*\})*)|(\d+(?:[.,]\d+)?(?:['’][a-zçğıöşü]+)?)|([A-Za-zÇĞİÖŞÜçğıöşüâîû]+(?:['’][a-zçğıöşü]+)?)|([+\-−×·÷=<>≤≥≠/^²³√%:*])|([()])|(\s+)|([\s\S])/g;

type TT = "latex" | "num" | "word" | "op" | "paren" | "space" | "other";
interface Tk {
  type: TT;
  text: string;
}

function lexText(text: string): Tk[] {
  const out: Tk[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const type: TT = m[1] ? "latex" : m[2] ? "num" : m[3] ? "word" : m[4] ? "op" : m[5] ? "paren" : m[6] ? "space" : "other";
    out.push({ type, text: m[0] });
  }
  return out;
}

const VARIABLE_ONLY = /^[xyz](?:['’][a-zçğıöşü]+)?$/;
const SINGLE_LETTER = /^[a-zA-Z](?:['’][a-zçğıöşü]+)?$/;

function isMathToken(t: Tk): boolean {
  if (t.type === "latex" || t.type === "num" || t.type === "op" || t.type === "paren") return true;
  if (t.type === "word") return SINGLE_LETTER.test(t.text);
  return false;
}

/**
 * Öğretmenin anlatım metnindeki matematik parçalarını (2x + 5 = 15, 3/5, x², %25, √16 …)
 * Türkçe okunuşa çevirir; normal Türkçe cümleleri değiştirmez.
 */
export function textToSpeech(text: string): string {
  // $...$ ve \( ... \) bloklarını önce çevir
  let s = text
    .replace(/\$\$([^$]+)\$\$/g, (_, m) => ` ${latexToSpeech(m)} `)
    .replace(/\$([^$]+)\$/g, (_, m) => ` ${latexToSpeech(m)} `)
    .replace(/\\\((.+?)\\\)/g, (_, m) => ` ${latexToSpeech(m)} `);

  const toks = lexText(s);
  const out: string[] = [];
  let i = 0;
  while (i < toks.length) {
    if (!isMathToken(toks[i])) {
      out.push(toks[i].text);
      i++;
      continue;
    }
    // matematik koşusunu topla (aradaki boşluklar dahil)
    let j = i;
    let lastMath = i;
    while (j < toks.length && (isMathToken(toks[j]) || toks[j].type === "space")) {
      if (isMathToken(toks[j])) {
        lastMath = j;
        // ek almış belirteç (15'i, x'in) koşuyu bitirir
        if (/['’]/.test(toks[j].text)) {
          j++;
          break;
        }
      }
      j++;
    }
    let run = toks.slice(i, lastMath + 1);
    const trailingSpace = toks.slice(lastMath + 1, j).map((t) => t.text).join("");
    // baştaki noktalama işlevli işlemleri (":", "/", "=") ayıkla
    const leading: string[] = [];
    while (run.length && ((run[0].type === "op" && !/^[-−√%(]$/.test(run[0].text)) || run[0].type === "space")) {
      leading.push(run[0].text);
      run = run.slice(1);
    }
    const trailing: string[] = [];
    while (run.length && ((run[run.length - 1].type === "op" && !/^[%²³]$/.test(run[run.length - 1].text)) || run[run.length - 1].type === "space")) {
      trailing.unshift(run[run.length - 1].text);
      run = run.slice(0, -1);
    }
    out.push(leading.join(""));
    out.push(speakRun(run));
    out.push(trailing.join(""));
    out.push(trailingSpace);
    i = j;
  }
  s = out.join("");
  return s.replace(/[ \t]+/g, " ").replace(/\s+([.,!?;])/g, "$1").trim();
}

function speakRun(run: Tk[]): string {
  if (!run.length) return "";
  const raw = run.map((t) => t.text).join("");
  const hasNumOrOp = run.some((t) => t.type === "num" || t.type === "latex" || (t.type === "op" && t.text !== ":"));
  // yalnızca tek harf (ör. Türkçe "o", "a") → değişken sayma; x, y, z ise değişkendir
  if (!hasNumOrOp) {
    if (run.length === 1 && VARIABLE_ONLY.test(run[0].text)) return speakWithSuffix(run[0].text);
    if (run.length === 1 && /['’]/.test(run[0].text) && SINGLE_LETTER.test(run[0].text)) return speakWithSuffix(run[0].text);
    return raw;
  }
  // ek (15'i, x'in) varsa ayır
  const m = /^(.*?)['’]([a-zçğıöşü]+)$/.exec(raw);
  const body = m ? m[1] : raw;
  const suffix = m ? m[2] : "";
  const spoken = expressionToSpeech(body) ?? fallbackSymbols(body);
  return suffix ? attachSuffix(spoken, suffix) : spoken;
}

function speakWithSuffix(token: string): string {
  const [base, suffix] = token.split(/['’]/);
  const spoken = letterName(base);
  return suffix ? attachSuffix(spoken, suffix) : spoken;
}

/**
 * Yazıdaki eki okunuşa uyarlar. Yazar ekleri rakamın okunuşuna göre yazar ("5'in", "10'u"),
 * bu yüzden çoğunlukla ek doğrudan eklenir; yalnızca bilinen ek türlerinde ünlü uyumu yeniden kurulur.
 */
function attachSuffix(spoken: string, suffix: string): string {
  const s = suffix.toLocaleLowerCase("tr-TR");
  if (/^n?[ıiuü]n$/.test(s)) return genitive(spoken);
  if (/^[dt][ae]$/.test(s)) return locative(spoken);
  if (/^y?[ae]$/.test(s)) return dative(spoken);
  return spoken + s;
}

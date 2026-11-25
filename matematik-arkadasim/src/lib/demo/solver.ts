import { evaluate, parseExpression, toLinear, variablesOf, type Node } from "@/lib/math/expr";
import { lcm, Rational } from "@/lib/math/rational";
import type { Solution, SolutionStep, VisualInstruction } from "@/lib/schema/solution";
import { latexToSpeech } from "@/lib/speech/mathToSpeech";
import { numberWithSuffix } from "@/lib/speech/turkishNumbers";

/**
 * KURAL TABANLI DEMO ÇÖZÜCÜ — yapay zekâ değildir.
 * API anahtarı yokken uygulamanın akıllı tahta ve seslendirme özelliklerini denemek için
 * yalnızca belirli soru türlerini (kesir/tam sayı işlemleri, birinci dereceden denklemler,
 * "bir sayının yüzdesi") kesin aritmetikle adım adım çözer. Çıktı her zaman "demo" olarak etiketlenir.
 */

const say = (latex: string) => latexToSpeech(latex);

function rl(r: Rational, wrapNegative = false): string {
  const s = r.toLatex();
  return wrapNegative && r.n < 0n ? `\\left(${s}\\right)` : s;
}

/** Soru metnindeki "kaçtır", "işleminin sonucu" gibi kalıpları temizler. */
/**
 * Saf işlem / denklem sorularında bulunabilecek soru kalıpları. Bunların DIŞINDA bir sözcük varsa
 * soru sözel bir problemdir ve kural tabanlı çözücü onu ÇÖZMEZ (kelimeleri atıp kalan sayılarla işlem
 * yapmak yanlış cevaba yol açar).
 */
const QUESTION_WORDS = new Set([
  "işleminin", "işlemin", "işlemi", "işlemini", "sonucu", "sonucunu", "kaçtır", "kaç", "olur", "eder", "nedir",
  "değeri", "değerini", "ifadesinin", "hesaplayınız", "hesaplayın", "hesapla", "bulunuz", "bulun", "bul",
  "denklemini", "denkleminde", "denklemin", "denklemi", "çözünüz", "çözün", "çöz", "için",
]);

/** Soru metnini saf matematik ifadesine indirger; tanınmayan sözcük varsa null. */
export function pureMath(text: string): string | null {
  let t = text
    .replace(/['’][a-zçğıöşü]+/gi, "") // 15'tir → 15
    .replace(/(=[^=]*?)\s[a-zA-Z]\s+(?=kaçtır|nedir|değeri)/i, "$1 "); // "… = 15 denkleminde x kaçtır"
  const words = t.match(/[A-Za-zÇĞİÖŞÜçğıöşüâîû]{2,}/g) ?? [];
  if (words.some((w) => !QUESTION_WORDS.has(w.toLocaleLowerCase("tr-TR")))) return null;
  t = t
    .replace(/[A-Za-zÇĞİÖŞÜçğıöşüâîû]{2,}/g, " ")
    .replace(/[?!:;]/g, " ")
    .replace(/\.\s*$/, "")
    .replace(/=\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return t || null;
}

/** Geriye dönük uyumluluk: saf matematik değilse boş dize döner. */
export function stripQuestionWords(text: string): string {
  return pureMath(text) ?? "";
}

let stepCounter = 0;
function step(partial: Omit<SolutionStep, "stepId" | "visualInstructions" | "highlightedElements"> & Partial<SolutionStep>): SolutionStep {
  stepCounter++;
  // Cümle başını büyüt; ama "x terimini" gibi tek harfli değişken adlarını büyütme
  const cap = (t: string) => (/^[a-z](\s|$)/.test(t) ? t : t.charAt(0).toLocaleUpperCase("tr-TR") + t.slice(1));
  return {
    stepId: String(stepCounter),
    visualInstructions: [],
    highlightedElements: [],
    ...partial,
    narration: cap(partial.narration),
    explanation: cap(partial.explanation),
  } as SolutionStep;
}

/* ───────────────────────────── Aritmetik (kesir, tam sayı, rasyonel) ───────────────────────────── */

type VNode = Node;

function valueOf(n: VNode): Rational | null {
  if (n.kind === "num") return n.value;
  if (n.kind === "bin" && n.literal && n.left.kind === "num" && n.right.kind === "num" && !n.right.value.isZero()) return n.left.value.div(n.right.value);
  if (n.kind === "neg" && n.arg.kind === "num") return n.arg.value.neg();
  if (n.kind === "group") return valueOf(n.arg);
  return null;
}

function numNode(v: Rational): VNode {
  return { kind: "num", value: v, raw: v.toString() };
}

function latexOf(n: VNode, parentOp?: string): string {
  if (n.kind === "bin" && n.literal && n.left.kind === "num" && n.right.kind === "num") return `\\frac{${n.left.raw}}{${n.right.raw}}`;
  if (n.kind === "num" && /[.,]/.test(n.raw)) return n.raw.replace(/[.,]/, "{,}");
  const v = n.kind === "num" ? n.value : null;
  if (v) return rl(v, parentOp !== undefined && parentOp !== "root");
  switch (n.kind) {
    case "group":
      return `\\left(${latexOf(n.arg, "root")}\\right)`;
    case "neg": {
      const inner = valueOf(n);
      if (inner) return rl(inner, parentOp !== undefined && parentOp !== "root");
      return `-${latexOf(n.arg, "neg")}`;
    }
    case "percent":
      return `\\%${latexOf(n.arg, "percent")}`;
    case "sqrt":
      return `\\sqrt{${latexOf(n.arg, "root")}}`;
    case "pow":
      return `${latexOf(n.base, "pow")}^{${latexOf(n.exp, "root")}}`;
    case "bin": {
      const op = n.op === "*" ? "\\cdot" : n.op === "/" ? "\\div" : n.op;
      // sol işlenen kökteki gibi yazılabilir (ör. -3 + 5)
      return `${latexOf(n.left, n.op === "+" || n.op === "-" ? "root-left" : n.op)} ${op} ${latexOf(n.right, n.op)}`;
    }
    case "var":
      return n.name;
  }
  return "";
}

interface Reduction {
  node: VNode;
  op: VNode;
  result: Rational;
}

/** Hesaplanma sırasındaki ilk işlemi bulur (AST işlem önceliğini zaten içerir) ve bir adım hesaplar. */
function reduceOnce(n: VNode): Reduction | null {
  switch (n.kind) {
    case "num":
    case "var":
      return null;
    case "group": {
      const v = valueOf(n.arg);
      if (v) return null; // tek sayılı parantez: işlem değil
      const r = reduceOnce(n.arg);
      if (!r) return null;
      const inner = r.node;
      const iv = valueOf(inner);
      return { ...r, node: iv && inner.kind === "num" ? { kind: "group", arg: inner } : { kind: "group", arg: inner } };
    }
    case "neg": {
      if (valueOf(n)) return null;
      const r = reduceOnce(n.arg);
      if (r) return { ...r, node: { kind: "neg", arg: r.node } };
      return null;
    }
    case "percent":
    case "sqrt": {
      const r = reduceOnce(n.arg);
      if (r) return { ...r, node: { ...n, arg: r.node } };
      const v = valueOf(n.arg);
      if (!v) return null;
      const result = n.kind === "percent" ? v.div(Rational.of(100)) : v.sqrt();
      if (!result) return null;
      return { node: numNode(result), op: n, result };
    }
    case "pow": {
      const rb = reduceOnce(n.base);
      if (rb) return { ...rb, node: { ...n, base: rb.node } };
      const b = valueOf(n.base);
      const e = valueOf(n.exp);
      if (!b || !e || !e.isInteger()) return null;
      const result = b.pow(Number(e.n));
      return { node: numNode(result), op: n, result };
    }
    case "bin": {
      if (n.literal) return null;
      const rl_ = reduceOnce(n.left);
      if (rl_) return { ...rl_, node: { ...n, left: rl_.node } };
      const rr = reduceOnce(n.right);
      if (rr) return { ...rr, node: { ...n, right: rr.node } };
      const a = valueOf(n.left);
      const b = valueOf(n.right);
      if (!a || !b) return null;
      let result: Rational;
      if (n.op === "+") result = a.add(b);
      else if (n.op === "-") result = a.sub(b);
      else if (n.op === "*") result = a.mul(b);
      else {
        if (b.isZero()) throw new RangeError("Sıfıra bölme");
        result = a.div(b);
      }
      return { node: numNode(result), op: n, result };
    }
  }
}

/** Tek sayılı parantezleri sadeleştirir: ((5)) → 5 */
function unwrap(n: VNode): VNode {
  if (n.kind === "group") {
    const inner = unwrap(n.arg);
    return valueOf(inner) ? numNode(valueOf(inner)!) : { kind: "group", arg: inner };
  }
  if (n.kind === "neg") {
    const inner = unwrap(n.arg);
    const v = valueOf({ kind: "neg", arg: inner });
    return v ? numNode(v) : { kind: "neg", arg: inner };
  }
  if (n.kind === "bin") return n.literal ? n : { ...n, left: unwrap(n.left), right: unwrap(n.right) };
  if (n.kind === "pow") return { ...n, base: unwrap(n.base), exp: unwrap(n.exp) };
  if (n.kind === "percent" || n.kind === "sqrt") return { ...n, arg: unwrap(n.arg) };
  return n;
}

function hasFraction(r: Rational) {
  return !r.isInteger();
}

function explainOperation(op: VNode, result: Rational): { title: string; explanation: string; latex: string; narration: string; visuals: VisualInstruction[]; highlights: SolutionStep["highlightedElements"] } {
  const visuals: VisualInstruction[] = [];
  const highlights: SolutionStep["highlightedElements"] = [];
  const res = rl(result);
  if (op.kind === "bin") {
    const a = valueOf(op.left)!;
    const b = valueOf(op.right)!;
    const A = rl(a, true);
    const B = rl(b, true);
    const sym = op.op === "*" ? "\\cdot" : op.op === "/" ? "\\div" : op.op;
    const base = `${a.n < 0n ? rl(a) : A} ${sym} ${B}`;

    if ((op.op === "+" || op.op === "-") && (hasFraction(a) || hasFraction(b))) {
      const L = lcm(a.d, b.d);
      const ea = a.n * (L / a.d);
      const eb = b.n * (L / b.d);
      const rawN = op.op === "+" ? ea + eb : ea - eb;
      const raw = `\\frac{${rawN}}{${L}}`;
      const simplified = new Rational(rawN, L);
      const same = a.d === b.d;
      const parts = same
        ? [base, raw]
        : [base, `\\frac{${ea}}{${L}} ${op.op} ${eb < 0n ? `\\left(\\frac{${eb}}{${L}}\\right)` : `\\frac{${eb}}{${L}}`}`, raw];
      if (!(simplified.n === rawN && simplified.d === L)) parts.push(res);
      const latex = parts.join(" = ");
      highlights.push({ value: String(L), color: "orange", reason: "ortak payda" });
      if (L <= 24n && a.n >= 0n && b.n >= 0n && ea <= 48n && eb <= 48n) {
        visuals.push({
          type: "fractionBars",
          bars: [
            { numerator: Number(ea), denominator: Number(L), label: `${a.toString()} = ${ea}/${L}`, color: "purple" },
            { numerator: Number(eb), denominator: Number(L), label: `${b.toString()} = ${eb}/${L}`, color: "blue" },
          ],
        });
      }
      return {
        title: same ? (op.op === "+" ? "Payları toplayalım" : "Payları çıkaralım") : "Paydaları eşitleyelim",
        explanation: same
          ? `Paydalar zaten eşit (${L}). Bu yüzden payları ${op.op === "+" ? "topluyoruz" : "çıkarıyoruz"}, paydayı aynen yazıyoruz.`
          : `Kesirleri ${op.op === "+" ? "toplamak" : "çıkarmak"} için paydaların eşit olması gerekir. ${a.d} ve ${b.d} sayılarının ortak katı olan ${L}'yi ortak payda seçiyoruz ve kesirleri genişletiyoruz. Sonra payları ${op.op === "+" ? "topluyoruz" : "çıkarıyoruz"}.`,
        latex,
        narration: same
          ? `Paydalar eşit olduğu için payları ${op.op === "+" ? "topluyoruz" : "çıkarıyoruz"}. ${say(base)} işleminin sonucu ${say(res)} olur.`
          : `Paydalar farklı, bu yüzden önce paydaları eşitliyoruz. Ortak payda ${say(String(L))}. ${say(rl(a))} kesri ${say(`\\frac{${ea}}{${L}}`)} olur, ${say(rl(b))} kesri ${say(`\\frac{${eb}}{${L}}`)} olur. Payları ${op.op === "+" ? "toplarsak" : "çıkarırsak"} sonuç ${say(res)} olur.`,
        visuals,
        highlights,
      };
    }

    if (op.op === "+" || op.op === "-") {
      const lo = Math.min(a.toNumber(), result.toNumber(), 0);
      const hi = Math.max(a.toNumber(), result.toNumber(), 0);
      if (a.isInteger() && b.isInteger() && hi - lo <= 24 && (a.n < 0n || b.n < 0n || result.n < 0n)) {
        visuals.push({
          type: "numberLine",
          min: Math.floor(lo) - 1,
          max: Math.ceil(hi) + 1,
          step: 1,
          points: [
            { value: a.toNumber(), label: a.toString(), color: "blue" },
            { value: result.toNumber(), label: result.toString(), color: "green" },
          ],
          jumps: [{ from: a.toNumber(), to: result.toNumber(), label: `${op.op === "+" ? "+" : "−"}${b.n < 0n ? `(${b.toString()})` : b.toString()}`, color: "orange" }],
        });
      }
      const minusNeg = op.op === "-" && b.n < 0n;
      return {
        title: op.op === "+" ? "Toplama işlemini yapalım" : "Çıkarma işlemini yapalım",
        explanation: minusNeg
          ? `Negatif bir sayıyı çıkarmak, o sayının pozitifini eklemek demektir: ${a.toString()} − (${b.toString()}) = ${a.toString()} + ${b.neg().toString()}.`
          : a.n < 0n || b.n < 0n
            ? "Tam sayılarla işlem yaparken sayı doğrusunda hareket ettiğimizi düşünebiliriz: artı yönü sağa, eksi yönü sola doğrudur."
            : `${a.toString()} ile ${b.toString()} sayılarını ${op.op === "+" ? "topluyoruz" : "birbirinden çıkarıyoruz"}.`,
        latex: minusNeg ? `${base} = ${rl(a)} + ${rl(b.neg())} = ${res}` : `${base} = ${res}`,
        narration: `${say(base)} işleminin sonucu ${say(res)} olur.${minusNeg ? " Çünkü negatif bir sayıyı çıkarmak, pozitifini eklemekle aynıdır." : ""}`,
        visuals,
        highlights,
      };
    }

    if (op.op === "*") {
      const sign = a.n < 0n !== b.n < 0n && !result.isZero();
      const frac = hasFraction(a) || hasFraction(b);
      const rawN = a.n * b.n;
      const rawD = a.d * b.d;
      const latex = frac
        ? `${base} = \\frac{${a.n} \\cdot ${b.n}}{${a.d} \\cdot ${b.d}} = \\frac{${rawN}}{${rawD}}${new Rational(rawN, rawD).d !== rawD ? ` = ${res}` : ""}`
        : `${base} = ${res}`;
      return {
        title: "Çarpma işlemini yapalım",
        explanation: frac
          ? "Kesirleri çarparken pay ile payı, payda ile paydayı çarparız. Sonra mümkünse sadeleştiririz."
          : a.n < 0n || b.n < 0n
            ? `İşaret kuralı: ${sign ? "zıt işaretli iki sayının çarpımı negatiftir" : "aynı işaretli iki sayının çarpımı pozitiftir"}.`
            : `${a.toString()} ile ${b.toString()} sayılarını çarpıyoruz.`,
        latex,
        narration: `${say(base)} işleminin sonucu ${say(res)} olur.${frac ? " Pay ile payı, payda ile paydayı çarptık." : ""}`,
        visuals,
        highlights,
      };
    }

    // bölme
    const frac = hasFraction(a) || hasFraction(b) || !result.isInteger();
    const inv = new Rational(b.d, b.n);
    const latex = frac && (hasFraction(a) || hasFraction(b)) ? `${base} = ${rl(a)} \\cdot ${rl(inv, true)} = ${res}` : `${base} = ${res}`;
    return {
      title: "Bölme işlemini yapalım",
      explanation:
        hasFraction(a) || hasFraction(b)
          ? "Kesirlerle bölmede birinci kesri aynen yazarız, ikinci kesri ters çevirip çarparız."
          : a.n < 0n !== b.n < 0n
            ? "İşaret kuralı: zıt işaretli iki sayının bölümü negatiftir."
            : `${a.toString()} sayısını ${b.toString()} sayısına bölüyoruz.`,
      latex,
      narration: `${say(base)} işleminin sonucu ${say(res)} olur.`,
      visuals,
      highlights,
    };
  }
  if (op.kind === "pow") {
    const b = valueOf(op.base)!;
    const e = Number(valueOf(op.exp)!.n);
    const expanded = e > 0 && e <= 6 ? Array(e).fill(rl(b, true)).join(" \\cdot ") : null;
    return {
      title: "Üslü ifadeyi hesaplayalım",
      explanation: `Üs, tabanın kendisiyle kaç kez çarpılacağını gösterir.${b.n < 0n ? " Negatif sayının çift kuvveti pozitif, tek kuvveti negatiftir." : ""}`,
      latex: `${rl(b, true)}^{${e}}${expanded ? ` = ${expanded}` : ""} = ${res}`,
      narration: `${say(`${rl(b, true)}^{${e}}`)} demek, bu sayıyı kendisiyle ${e} kez çarpmak demektir. Sonuç ${say(res)}.`,
      visuals,
      highlights,
    };
  }
  if (op.kind === "percent") {
    const v = valueOf(op.arg)!;
    return {
      title: "Yüzdeyi kesre çevirelim",
      explanation: "Yüzde, paydası 100 olan bir kesirdir.",
      latex: `\\%${rl(v)} = \\frac{${v.toString()}}{100} = ${res}`,
      narration: `Yüzde ${say(rl(v))}, yüzde ${say(rl(v))} demektir; yani ${say(res)}.`,
      visuals: v.isInteger() && v.n >= 0n && v.n <= 100n ? [{ type: "percentGrid", percent: Number(v.n), label: `%${v.toString()}` }] : [],
      highlights,
    };
  }
  // sqrt
  const v = valueOf((op as Extract<VNode, { kind: "sqrt" }>).arg)!;
  return {
    title: "Karekökü bulalım",
    explanation: `Karesi ${v.toString()} olan pozitif sayıyı arıyoruz.`,
    latex: `\\sqrt{${rl(v)}} = ${res}`,
    narration: `${say(`\\sqrt{${rl(v)}}`)}, ${say(res)} olur; çünkü ${say(res)} çarpı ${say(res)} eşittir ${say(rl(v))}.`,
    visuals,
    highlights,
  };
}

function precedenceRule(root: VNode): string | null {
  let hasMulDiv = false;
  let hasAddSub = false;
  let hasGroupOp = false;
  const walk = (n: VNode) => {
    if (n.kind === "bin" && n.literal) return;
    if (n.kind === "bin") {
      if (n.op === "*" || n.op === "/") hasMulDiv = true;
      else hasAddSub = true;
      walk(n.left);
      walk(n.right);
    } else if (n.kind === "group") {
      if (!valueOf(n.arg)) hasGroupOp = true;
      walk(n.arg);
    } else if (n.kind === "neg" || n.kind === "percent" || n.kind === "sqrt") walk(n.arg);
    else if (n.kind === "pow") {
      hasMulDiv = true;
      walk(n.base);
    }
  };
  walk(root);
  if ((hasMulDiv && hasAddSub) || hasGroupOp) return "İşlem önceliği: önce parantez içi, sonra üslü ifadeler, sonra çarpma ve bölme (soldan sağa), en son toplama ve çıkarma (soldan sağa) yapılır.";
  return null;
}

export function solveArithmetic(questionText: string): Solution | null {
  const exprText = stripQuestionWords(questionText);
  const parsed = parseExpression(exprText);
  if (!parsed || variablesOf(parsed).size) return null;
  let node = unwrap(parsed);
  if (valueOf(node)) return null; // tek sayı: işlem yok
  const final = evaluate(node);
  if (!final) return null;

  stepCounter = 0;
  const steps: SolutionStep[] = [];
  const startLatex = latexOf(node);
  const rule = precedenceRule(node);
  steps.push(
    step({
      title: "İşlemi tahtaya yazalım",
      explanation: rule ?? "Önce işlemi dikkatlice okuyalım ve hangi işlemi yapacağımıza karar verelim.",
      latex: startLatex,
      narration: `Hesaplayacağımız işlem: ${say(startLatex)}. ${rule ? "Önce işlem önceliğini hatırlayalım: önce parantez içi, sonra çarpma ve bölme, en son toplama ve çıkarma yapılır." : "Hadi adım adım hesaplayalım."}`,
      visualInstructions: rule ? [{ type: "rule", title: "İşlem önceliği", text: "Parantez → Üs → Çarpma/Bölme → Toplama/Çıkarma (soldan sağa)" }] : [],
    }),
  );

  let guard = 0;
  while (!valueOf(node) && guard++ < 10) {
    const r = reduceOnce(node);
    if (!r) return null;
    const ex = explainOperation(r.op, r.result);
    const nextNode = unwrap(r.node);
    const remaining = valueOf(nextNode) ? null : latexOf(nextNode);
    steps.push(
      step({
        title: ex.title,
        explanation: ex.explanation + (remaining ? ` Kalan işlem: ${remaining.replace(/\\left|\\right/g, "")}` : ""),
        latex: ex.latex,
        narration: ex.narration + (remaining ? ` Şimdi işlemimiz şöyle oldu: ${say(remaining)}.` : ""),
        visualInstructions: ex.visuals,
        highlightedElements: ex.highlights,
      }),
    );
    node = nextNode;
  }
  if (!valueOf(node) || steps.length > 12) return null;

  const dec = final.toDecimalString();
  const finalLatex = rl(final);
  steps.push(
    step({
      title: "Sonucu kontrol edelim",
      explanation: !final.isInteger()
        ? `Sonuç en sade hâlinde ${final.toString()}${dec ? ` (ondalık gösterimi ${dec})` : ""}. Pay ile paydanın 1'den başka ortak böleni yok.`
        : "Tüm işlemleri sırasıyla yaptık; sonuç bir tam sayı çıktı.",
      latex: `${startLatex} = ${finalLatex}`,
      narration: `Böylece sonucu bulduk: ${say(startLatex)} eşittir ${say(finalLatex)}.${dec && !final.isInteger() ? ` Bu sayıyı ondalık olarak ${say(dec)} diye de yazabiliriz.` : ""}`,
      visualInstructions: [{ type: "rule", title: "Sonuç", text: `Sonuç: ${final.toString()}${dec && !final.isInteger() ? ` = ${dec}` : ""}`, latex: `${startLatex} = ${finalLatex}` }],
    }),
  );

  const hasFracs = /\\frac/.test(startLatex);
  return {
    question: questionText.trim(),
    topic: hasFracs ? "Rasyonel Sayılarla İşlemler" : "Tam Sayılarla İşlemler",
    topicId: hasFracs ? "kesirler" : "tam-sayilar",
    difficulty: steps.length > 4 ? "orta" : "kolay",
    givenInformation: [`İşlem: ${exprText}`],
    requestedInformation: "İşlemin sonucu",
    solutionStrategy: rule ? "İşlem önceliğine uyarak işlemleri birer birer yapacağız." : hasFracs ? "Kesir işlem kurallarını kullanarak adım adım hesaplayacağız." : "İşaret kurallarını kullanarak hesaplayacağız.",
    steps,
    finalAnswer: { text: `Sonuç: ${final.toString()}`, latex: finalLatex, narration: `Sonuç ${say(finalLatex)}.` },
    verification: {
      method: "Her adımı kesin kesir aritmetiğiyle yeniden hesapladık; sonuçlar tutarlı.",
      latex: `${startLatex} = ${finalLatex}`,
      isVerified: true,
    },
    commonMistakes: hasFracs
      ? ["Paydaları eşitlemeden payları toplamak.", "Bölmede ikinci kesir yerine birinci kesri ters çevirmek.", "Sonucu sadeleştirmeyi unutmak."]
      : ["Negatif sayının çıkarılmasında işareti değiştirmeyi unutmak.", "İşlem önceliğine uymadan soldan sağa hesaplamak."],
    similarQuestion: similarArithmetic(final, hasFracs),
  };
}

function similarArithmetic(final: Rational, fracs: boolean): Solution["similarQuestion"] {
  if (fracs) return { text: "2/3 + 1/4 işleminin sonucu kaçtır?", answer: "11/12" };
  return { text: "(-6) + 4 · (-2) işleminin sonucu kaçtır?", answer: final.n === -14n ? "-14" : "-14" };
}

/* ───────────────────────────── Birinci dereceden denklem ───────────────────────────── */

function linLatex(a: Rational, b: Rational, v: string): string {
  const parts: string[] = [];
  if (!a.isZero()) {
    if (a.eq(Rational.of(1))) parts.push(v);
    else if (a.eq(Rational.of(-1))) parts.push(`-${v}`);
    else parts.push(`${a.toLatex()}${v}`);
  }
  if (!b.isZero() || !parts.length) {
    if (!parts.length) parts.push(b.toLatex());
    else parts.push(b.n < 0n ? `- ${b.neg().toLatex()}` : `+ ${b.toLatex()}`);
  }
  return parts.join(" ");
}

export function solveLinearEquation(questionText: string): Solution | null {
  const cleaned = stripQuestionWords(questionText).replace(/^.*?:\s*/, "");
  const sides = cleaned.split("=");
  if (sides.length !== 2) return null;
  const L = parseExpression(sides[0]);
  const R = parseExpression(sides[1]);
  if (!L || !R) return null;
  const vars = new Set([...variablesOf(L), ...variablesOf(R)]);
  if (vars.size !== 1) return null;
  const v = [...vars][0];
  const l = toLinear(L, v);
  const r = toLinear(R, v);
  if (!l || !r) return null;
  const a = l.a.sub(r.a);
  if (a.isZero()) return null;

  stepCounter = 0;
  const steps: SolutionStep[] = [];
  const original = `${sides[0].trim()} = ${sides[1].trim()}`;
  const origNodeLatex = `${latexOfExpr(L)} = ${latexOfExpr(R)}`;
  const value = r.b.sub(l.b).div(a);

  steps.push(
    step({
      title: "Denklemi tanıyalım",
      explanation: `Bu bir birinci dereceden denklem. Bilinmeyenimiz ${v}. Denklemi bir terazi gibi düşünelim: iki taraf her zaman dengede olmalı. Bir tarafa ne yaparsak diğer tarafa da aynısını yapacağız.`,
      latex: origNodeLatex,
      narration: `Denklemimiz: ${say(origNodeLatex)}. Bunu dengede duran bir terazi gibi düşünelim. Amacımız ${say(v)} bilinmeyenini yalnız bırakmak.`,
      visualInstructions: [{ type: "balance", left: latexOfExpr(L), right: latexOfExpr(R), label: "Terazi dengede" }],
    }),
  );

  let curLatex = `${linLatex(l.a, l.b, v)} = ${linLatex(r.a, r.b, v)}`;
  if (curLatex.replace(/\s/g, "") !== origNodeLatex.replace(/\s|\\left|\\right|\\cdot/g, "")) {
    steps.push(
      step({
        title: "Her iki tarafı sadeleştirelim",
        explanation: "Parantezleri dağılma özelliğiyle açıp benzer terimleri bir araya getiriyoruz.",
        latex: `${origNodeLatex} \\Rightarrow ${curLatex}`,
        narration: `Önce iki tarafı da sadeleştirelim. Denklem ${say(curLatex)} hâline gelir.`,
        visualInstructions: [{ type: "transform", before: origNodeLatex, after: curLatex, label: "Sadeleştir" }],
      }),
    );
  }

  let la = l.a;
  let lb = l.b;
  let rb = r.b;
  if (!r.a.isZero()) {
    const moved = r.a;
    la = l.a.sub(moved);
    const next = `${linLatex(la, lb, v)} = ${linLatex(Rational.of(0), rb, v)}`;
    const term = linLatex(moved, Rational.of(0), v);
    steps.push(
      step({
        title: "Bilinmeyenleri bir tarafta toplayalım",
        explanation: `Her iki taraftan ${term} çıkarıyoruz. Böylece ${v} içeren terimler sol tarafta toplanır.`,
        latex: `${curLatex} \\Rightarrow ${next}`,
        narration: `Her iki taraftan ${say(term)} çıkarıyoruz. Denklem ${say(next)} olur.`,
        visualInstructions: [{ type: "transform", before: curLatex, after: next, label: `Her iki taraftan ${term.replace(/\\frac\{(\d+)\}\{(\d+)\}/g, "$1/$2")} çıkar` }],
        highlightedElements: [{ value: term, color: "orange", reason: "her iki taraftan çıkarılan terim" }],
      }),
    );
    curLatex = next;
  }

  if (!lb.isZero()) {
    const before = curLatex;
    const newR = rb.sub(lb);
    const op = lb.n > 0n ? "çıkarıyoruz" : "ekliyoruz";
    const fromTo = lb.n > 0n ? "taraftan" : "tarafa";
    const amount = lb.n > 0n ? lb : lb.neg();
    const next = `${linLatex(la, Rational.of(0), v)} = ${newR.toLatex()}`;
    const sideOp = lb.n > 0n ? "-" : "+";
    steps.push(
      step({
        title: lb.n > 0n ? `Her iki taraftan ${amount.toString()} çıkaralım` : `Her iki tarafa ${amount.toString()} ekleyelim`,
        explanation: `${v} terimini yalnız bırakmak için her iki ${fromTo} ${amount.toString()} ${op}. Toplamanın tersi çıkarma, çıkarmanın tersi toplamadır.`,
        latex: `${linLatex(la, lb, v)} ${sideOp} ${amount.toLatex()} = ${rb.toLatex()} ${sideOp} ${amount.toLatex()} \\Rightarrow ${next}`,
        narration: `Eşitliğin dengesini bozmamak için her iki ${fromTo} da ${say(amount.toLatex())} ${op}. Böylece ${say(next)} olur ve bilinmeyeni yalnız bırakmaya bir adım daha yaklaşırız.`,
        visualInstructions: [
          { type: "transform", before, after: next, label: `Her iki tarafa ${sideOp === "-" ? "−" : "+"}${amount.toString()}` },
          { type: "balance", left: linLatex(la, Rational.of(0), v), right: newR.toLatex(), label: "Terazi hâlâ dengede" },
        ],
        highlightedElements: [{ value: amount.toLatex(), color: "orange", reason: "her iki taraftan işlem yapılan sayı" }],
        studentQuestion: { prompt: `${rb.toString()} ${sideOp} ${amount.toString()} işleminin sonucu kaçtır?`, expectedAnswer: newR.toString(), hint: "Sağ taraftaki sayıya aynı işlemi uygula." },
      }),
    );
    rb = newR;
    lb = Rational.of(0);
    curLatex = next;
  }

  if (!la.eq(Rational.of(1))) {
    const next = `${v} = ${value.toLatex()}`;
    steps.push(
      step({
        title: `Her iki tarafı ${la.toString()} sayısına bölelim`,
        explanation: `${linLatex(la, Rational.of(0), v)} ifadesi "${la.toString()} çarpı ${v}" demektir. Çarpmanın tersi bölmedir; bu yüzden her iki tarafı ${la.toString()} sayısına bölüyoruz.`,
        latex: `\\frac{${linLatex(la, Rational.of(0), v)}}{${la.toLatex()}} = \\frac{${rb.toLatex()}}{${la.toLatex()}} \\Rightarrow ${next}`,
        narration: `${say(linLatex(la, Rational.of(0), v))}, ${say(la.toLatex())} çarpı ${say(v)} demek. Her iki tarafı ${say(la.toLatex())} sayısına bölüyoruz ve ${say(next)} buluyoruz.`,
        visualInstructions: [{ type: "transform", before: curLatex, after: next, label: `Her iki tarafı ${la.toString()}'e böl` }],
        highlightedElements: [{ value: la.toLatex(), color: "purple", reason: "katsayı" }],
        studentQuestion: { prompt: `${rb.toString()} ÷ ${la.toString()} kaçtır?`, expectedAnswer: value.toString(), hint: "Bölme işlemini yap; gerekirse kesir olarak bırak." },
      }),
    );
  }

  const check = substituteLatex(L, v, value) + " = " + substituteLatex(R, v, value);
  const leftVal = evaluate(L, { [v]: value })!;
  steps.push(
    step({
      title: "Kontrol edelim",
      explanation: `Bulduğumuz ${v} = ${value.toString()} değerini ilk denklemde yerine koyuyoruz. İki taraf da ${leftVal.toString()} çıkıyorsa cevabımız doğrudur.`,
      latex: `${check} \\Rightarrow ${leftVal.toLatex()} = ${leftVal.toLatex()}`,
      narration: `Şimdi kontrol edelim. ${say(v)} yerine ${say(value.toLatex())} koyalım. İki taraf da ${say(leftVal.toLatex())} çıkıyor. Demek ki cevabımız doğru!`,
      visualInstructions: [{ type: "rule", title: "Altın kural", text: "Denklemi çözdükten sonra bulduğun değeri yerine koyarak mutlaka kontrol et." }],
    }),
  );

  return {
    question: questionText.trim(),
    topic: "Eşitlik ve Denklem",
    topicId: "denklemler",
    difficulty: steps.length > 4 ? "orta" : "kolay",
    givenInformation: [`Denklem: ${original}`],
    requestedInformation: `${v} bilinmeyeninin değeri`,
    solutionStrategy: "Eşitliğin korunumu: her iki tarafa aynı işlemi yaparak bilinmeyeni yalnız bırakacağız (ters işlem).",
    steps,
    finalAnswer: { text: `${v} = ${value.toString()}`, latex: `${v} = ${value.toLatex()}`, narration: `${say(v)} eşittir ${say(value.toLatex())}.` },
    verification: { method: `${v} = ${value.toString()} değerini denklemde yerine koyduk; iki taraf eşit çıktı.`, latex: `${check}`, isVerified: true },
    commonMistakes: [
      "Sayıyı yalnızca bir taraftan çıkarıp diğer tarafı unutmak (eşitliğin dengesi bozulur).",
      "Sadece bir tarafa işlem yapıp diğer tarafı unutmak.",
      "Katsayıya bölmek yerine katsayıyı çıkarmak.",
    ],
    similarQuestion: { text: "3x - 4 = 11 denklemini çözünüz.", answer: "x = 5" },
  };
}

function latexOfExpr(n: Node): string {
  // denklemde okunabilir LaTeX: örtük çarpımları korur
  switch (n.kind) {
    case "num":
      return n.value.isInteger() ? n.value.toString() : n.raw.replace(".", "{,}");
    case "var":
      return n.name;
    case "group":
      return `\\left(${latexOfExpr(n.arg)}\\right)`;
    case "neg":
      return `-${latexOfExpr(n.arg)}`;
    case "percent":
      return `\\%${latexOfExpr(n.arg)}`;
    case "sqrt":
      return `\\sqrt{${latexOfExpr(n.arg)}}`;
    case "pow":
      return `${latexOfExpr(n.base)}^{${latexOfExpr(n.exp)}}`;
    case "bin": {
      if (n.op === "/") return n.divSign ? `${latexOfExpr(n.left)} \\div ${latexOfExpr(n.right)}` : `\\frac{${stripG(n.left)}}{${stripG(n.right)}}`;
      if (n.op === "*") {
        const implicit = n.left.kind === "num" && (n.right.kind === "var" || n.right.kind === "group");
        return implicit ? `${latexOfExpr(n.left)}${latexOfExpr(n.right)}` : `${latexOfExpr(n.left)} \\cdot ${latexOfExpr(n.right)}`;
      }
      return `${latexOfExpr(n.left)} ${n.op} ${latexOfExpr(n.right)}`;
    }
  }
}
function stripG(n: Node) {
  return n.kind === "group" ? latexOfExpr(n.arg) : latexOfExpr(n);
}

function substituteLatex(n: Node, v: string, value: Rational): string {
  const repl = (m: Node): Node => {
    switch (m.kind) {
      case "var":
        return m.name === v ? ({ kind: "group", arg: { kind: "num", value, raw: value.toString() } } as Node) : m;
      case "neg":
      case "group":
      case "percent":
      case "sqrt":
        return { ...m, arg: repl(m.arg) } as Node;
      case "pow":
        return { ...m, base: repl(m.base), exp: repl(m.exp) };
      case "bin": {
        const left = repl(m.left);
        const right = repl(m.right);
        // örtük çarpımı açık çarpıma çevir: 2x → 2·(5)
        return { ...m, left, right };
      }
      default:
        return m;
    }
  };
  const replaced = repl(n);
  const ltx = (m: Node): string => {
    if (m.kind === "group" && m.arg.kind === "num") {
      const val = m.arg.value;
      return val.n < 0n || !val.isInteger() ? `\\left(${val.toLatex()}\\right)` : val.toLatex();
    }
    if (m.kind === "bin" && m.op === "*") return `${ltx(m.left)} \\cdot ${ltx(m.right)}`;
    if (m.kind === "bin" && m.op === "/") return m.divSign ? `${ltx(m.left)} \\div ${ltx(m.right)}` : `\\frac{${ltx(m.left)}}{${ltx(m.right)}}`;
    if (m.kind === "bin") return `${ltx(m.left)} ${m.op} ${ltx(m.right)}`;
    if (m.kind === "group") return `\\left(${ltx(m.arg)}\\right)`;
    if (m.kind === "neg") return `-${ltx(m.arg)}`;
    if (m.kind === "pow") return `${ltx(m.base)}^{${ltx(m.exp)}}`;
    return latexOfExpr(m);
  };
  return ltx(replaced);
}

/* ───────────────────────────── Yüzde ───────────────────────────── */

/** Yalnızca "N sayısının %P'si kaçtır?" biçimindeki soruların TAMAMI eşleşir; sözel problemler eşleşmez. */
const PERCENT_RE = /^\s*(\d+(?:[.,]\d+)?)\s*(?:sayısının|['’][a-zçğıöşü]*n)\s*%\s*(\d+(?:[.,]\d+)?)['’]?[a-zçğıöşü]*\s*(?:kaçtır|kaç eder|nedir)?\s*\??\s*$/i;

export function solvePercent(questionText: string): Solution | null {
  const t = questionText.replace(/yüzde\s*(\d)/gi, "%$1");
  if (/indirim|zam|artış|azal|kâr|kar\b|zarar/i.test(t)) return null; // problemleri YZ'ye bırak
  const m = PERCENT_RE.exec(t);
  if (!m) return null;
  const N = Rational.parseDecimal(m[1]);
  const p = Rational.parseDecimal(m[2]);
  if (!N || !p) return null;
  const result = N.mul(p).div(Rational.of(100));
  const Nl = N.toLatex();
  const pl = p.toLatex();
  const res = result.toLatex();
  const resText = result.toDecimalString() ?? result.toString();
  stepCounter = 0;
  const steps: SolutionStep[] = [
    step({
      title: "Yüzdeyi kesir olarak yazalım",
      explanation: `Yüzde, "yüzde kaç parça" demektir. %${m[2]} ifadesi, 100 eş parçanın ${m[2]} tanesi yani ${m[2]}/100 demektir.`,
      latex: `\\%${pl} = \\frac{${pl}}{100}`,
      narration: `Yüzde ${say(pl)}, yüz eş parçanın ${say(pl)} tanesi demektir. Yani ${say(`\\frac{${pl}}{100}`)}.`,
      visualInstructions: p.isInteger() && p.n <= 100n ? [{ type: "percentGrid", percent: Number(p.n), label: `%${m[2]}` }] : [],
      highlightedElements: [{ value: "100", color: "purple", reason: "yüzdenin paydası her zaman 100" }],
    }),
    step({
      title: "Sayıyı bu kesirle çarpalım",
      explanation: `Bir sayının yüzdesini bulmak için sayıyı bu kesirle çarparız: ${m[1]} · ${m[2]}/100.`,
      latex: `${Nl} \\cdot \\frac{${pl}}{100} = \\frac{${N.mul(p).toLatex()}}{100} = ${res}`,
      narration: `${say(Nl)} sayısını ${say(`\\frac{${pl}}{100}`)} ile çarpıyoruz. Sonuç ${say(res)} olur.`,
      highlightedElements: [{ value: Nl, color: "blue", reason: "bütün" }],
      studentQuestion: { prompt: `${m[1]} · ${m[2]} ÷ 100 kaçtır?`, expectedAnswer: result.toString(), hint: "Önce çarp, sonra 100'e böl." },
    }),
    step({
      title: "Kontrol edelim",
      explanation: `${resText} sayısı ${m[1]} sayısının ${numberWithSuffix("%" + m[2], "possessive")} ise, ${resText} ÷ ${m[1]} işlemi ${m[2]}/100 vermelidir.`,
      latex: `\\frac{${res}}{${Nl}} = \\frac{${pl}}{100}`,
      narration: `Kontrol edelim: ${say(res)} sayısını ${say(Nl)} sayısına bölünce ${say(`\\frac{${pl}}{100}`)} buluyoruz. Cevabımız doğru.`,
    }),
  ];
  return {
    question: questionText.trim(),
    topic: "Yüzdeler",
    topicId: "yuzdeler",
    difficulty: "kolay",
    givenInformation: [`Bütün: ${m[1]}`, `Yüzde: %${m[2]}`],
    requestedInformation: `${m[1]} sayısının ${numberWithSuffix("%" + m[2], "possessive")}`,
    solutionStrategy: "Yüzdeyi paydası 100 olan kesre çevirip sayı ile çarpacağız.",
    steps,
    finalAnswer: { text: `${m[1]} sayısının ${numberWithSuffix("%" + m[2], "possessive")} ${resText} eder.`, latex: res, narration: `Cevap ${say(res)}.` },
    verification: { method: "Bulunan sonucu bütüne bölüp yüzde oranını geri elde ettik.", latex: `\\frac{${res}}{${Nl}} = \\frac{${pl}}{100}`, isVerified: true },
    commonMistakes: ["Yüzdeyi 100'e bölmeyi unutmak.", "Sayıyı yüzdeye bölmek (ör. 240 ÷ 25)."],
    similarQuestion: { text: "360 sayısının %15'i kaçtır?", answer: "54" },
  };
}

/** Demo çözücünün desteklediği türlerden birini dener. */
export function solveDemo(text: string): Solution | null {
  try {
    const pct = solvePercent(text);
    if (pct) return pct;
    const pure = pureMath(text);
    if (!pure) return null; // sözel problem: demo çözücü kapsam dışı (uydurmaz)
    return (pure.includes("=") && /[a-z]/i.test(pure) ? solveLinearEquation(text) : null) ?? (pure.includes("=") ? null : solveArithmetic(text));
  } catch {
    return null;
  }
}

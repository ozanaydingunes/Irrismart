import { Rational } from "./rational";

/**
 * Küçük, güvenli matematik ifade ayrıştırıcısı.
 * LaTeX (\frac, \cdot, \times, \div, \sqrt, ^, \left( … ) ve düz metin (3/4, 2x+5, ×, ÷, √, ², %)
 * girdilerini anlar. Hiçbir zaman eval kullanmaz; desteklemediği girdide null döner.
 */

export type Node =
  | { kind: "num"; value: Rational; raw: string }
  | { kind: "var"; name: string }
  | { kind: "neg"; arg: Node }
  | { kind: "bin"; op: "+" | "-" | "*" | "/"; left: Node; right: Node; explicitFrac?: boolean; divSign?: boolean; literal?: boolean }
  | { kind: "pow"; base: Node; exp: Node }
  | { kind: "sqrt"; arg: Node }
  | { kind: "percent"; arg: Node }
  | { kind: "group"; arg: Node };

type Tok =
  | { t: "num"; v: string }
  | { t: "var"; v: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" | "^" | "%"; sign?: boolean }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "frac" }
  | { t: "sqrt" };

const IGNORED_COMMANDS = [
  "\\left",
  "\\right",
  "\\displaystyle",
  "\\,",
  "\\;",
  "\\!",
  "\\:",
  "\\quad",
  "\\qquad",
  "\\big",
  "\\Big",
];

/** Metni ayrıştırıcıya uygun hâle getirir. Desteklenmeyen LaTeX komutu varsa null. */
export function normalize(input: string): string | null {
  let s = input.trim();
  // matematik sınırlayıcıları
  s = s.replace(/^\$+|\$+$/g, "").replace(/^\\\(|\\\)$/g, "").replace(/^\\\[|\\\]$/g, "");
  s = s.replace(/\\[dt]frac/g, "\\frac");
  for (const c of IGNORED_COMMANDS) s = s.split(c).join(" ");
  s = s.replace(/\\cdot|\\times|[×·∙⋅]/g, "*");
  s = s.replace(/\\div/g, "÷");
  s = s.replace(/[−–—]/g, "-");
  s = s.replace(/\\%/g, "%");
  s = s.replace(/²/g, "^2").replace(/³/g, "^3");
  s = s.replace(/√/g, "\\sqrt");
  s = s.replace(/\\sqrt\[2\]/g, "\\sqrt");
  s = s.replace(/\\\{|\\\}/g, " ");
  // yalnızca \frac ve \sqrt komutlarına izin ver
  const cmd = s.match(/\\[a-zA-Z]+/g)?.filter((c) => c !== "\\frac" && c !== "\\sqrt");
  if (cmd && cmd.length) return null;
  return s;
}

function tokenize(src: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (src.startsWith("\\frac", i)) {
      out.push({ t: "frac" });
      i += 5;
      continue;
    }
    if (src.startsWith("\\sqrt", i)) {
      out.push({ t: "sqrt" });
      i += 5;
      continue;
    }
    if (/\d/.test(ch)) {
      // ondalık: 2,5 veya 2.5 (virgülden sonra hemen rakam gelmeli)
      const m = /^\d+(?:[.,]\d+)?/.exec(src.slice(i))!;
      let v = m[0];
      // "1,2,3" gibi listeleri ondalık sanmamak için: virgüllü sayının ardından yine virgül+rakam geliyorsa liste
      if (/,/.test(v) && /^,\d/.test(src.slice(i + v.length))) return null;
      // binlik ayırıcı "1.000" → 1000 (nokta + tam 3 hane ve ardından rakam yok)
      if (/^\d{1,3}(\.\d{3})+$/.test(src.slice(i).match(/^[\d.]+/)?.[0] ?? "")) {
        const full = src.slice(i).match(/^[\d.]+/)![0];
        v = full.replace(/\./g, "");
        i += full.length;
        out.push({ t: "num", v });
        continue;
      }
      out.push({ t: "num", v });
      i += v.length;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      out.push({ t: "var", v: ch });
      i++;
      continue;
    }
    if ("+-*/^%".includes(ch)) {
      out.push({ t: "op", v: ch as "+" });
      i++;
      continue;
    }
    if (ch === ":" || ch === "÷") {
      out.push({ t: "op", v: "/", sign: true });
      i++;
      continue;
    }
    if ("({[".includes(ch)) {
      out.push({ t: "lp" });
      i++;
      continue;
    }
    if (")}]".includes(ch)) {
      out.push({ t: "rp" });
      i++;
      continue;
    }
    return null; // desteklenmeyen karakter
  }
  return out;
}

class Parser {
  private i = 0;
  constructor(private toks: Tok[]) {}

  parse(): Node | null {
    const n = this.expr();
    if (!n || this.i !== this.toks.length) return null;
    return n;
  }

  private peek() {
    return this.toks[this.i];
  }
  private isOp(v: string) {
    const p = this.peek();
    return !!p && p.t === "op" && p.v === v;
  }

  private expr(): Node | null {
    let left = this.term();
    if (!left) return null;
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.toks[this.i++] as { v: "+" | "-" }).v;
      const right = this.term();
      if (!right) return null;
      left = { kind: "bin", op, left, right };
    }
    return left;
  }

  private term(): Node | null {
    let left = this.unary();
    if (!left) return null;
    for (;;) {
      if (this.isOp("*") || this.isOp("/")) {
        const tok = this.toks[this.i++] as { v: "*" | "/"; sign?: boolean };
        const right = this.unary();
        if (!right) return null;
        left = { kind: "bin", op: tok.v, left, right, divSign: tok.sign };
        continue;
      }
      // örtük çarpma: 2x, 3(…), x(…), )(, 2\frac…, 2\sqrt…
      const p = this.peek();
      if (p && (p.t === "var" || p.t === "lp" || p.t === "frac" || p.t === "sqrt" || (p.t === "num" && left.kind !== "num"))) {
        const right = this.power();
        if (!right) return null;
        left = { kind: "bin", op: "*", left, right };
        continue;
      }
      return left;
    }
  }

  private unary(): Node | null {
    if (this.isOp("-")) {
      this.i++;
      const arg = this.unary();
      return arg ? { kind: "neg", arg } : null;
    }
    if (this.isOp("+")) {
      this.i++;
      return this.unary();
    }
    if (this.isOp("%")) {
      // Türkçe yazım: %25 → yüzde 25
      this.i++;
      const arg = this.power();
      return arg ? { kind: "percent", arg } : null;
    }
    return this.power();
  }

  private power(): Node | null {
    let base = this.postfix();
    if (!base) return null;
    if (this.isOp("^")) {
      this.i++;
      // üs: tek işaretli atom veya grup
      let exp: Node | null;
      if (this.isOp("-")) {
        this.i++;
        const a = this.atom();
        exp = a ? { kind: "neg", arg: a } : null;
      } else exp = this.atom();
      if (!exp) return null;
      base = { kind: "pow", base, exp };
    }
    return base;
  }

  private postfix(): Node | null {
    let a = this.atom();
    if (!a) return null;
    while (this.isOp("%")) {
      this.i++;
      a = { kind: "percent", arg: a };
    }
    return a;
  }

  private group(): Node | null {
    const p = this.peek();
    if (!p || p.t !== "lp") return null;
    this.i++;
    const e = this.expr();
    if (!e) return null;
    if (this.peek()?.t !== "rp") return null;
    this.i++;
    return e;
  }

  private atom(): Node | null {
    const p = this.peek();
    if (!p) return null;
    if (p.t === "num") {
      this.i++;
      const value = Rational.parseDecimal(p.v);
      if (!value) return null;
      const numNode: Node = { kind: "num", value, raw: p.v };
      // "3/4" gibi iki tam sayı arasındaki düz eğik çizgi kesir sayısıdır (işlem önceliğinde tek sayı gibi davranır)
      const op = this.toks[this.i];
      const den = this.toks[this.i + 1];
      const after = this.toks[this.i + 2];
      if (
        op && op.t === "op" && op.v === "/" && !op.sign &&
        den && den.t === "num" && /^\d+$/.test(p.v) && /^\d+$/.test(den.v) &&
        !(after && after.t === "op" && after.v === "^")
      ) {
        this.i += 2;
        const d = Rational.parseDecimal(den.v)!;
        return { kind: "bin", op: "/", left: numNode, right: { kind: "num", value: d, raw: den.v }, literal: true };
      }
      return numNode;
    }
    if (p.t === "var") {
      this.i++;
      return { kind: "var", name: p.v };
    }
    if (p.t === "lp") {
      const g = this.group();
      return g ? { kind: "group", arg: g } : null;
    }
    if (p.t === "frac") {
      this.i++;
      const num = this.group();
      const den = num && this.group();
      if (!num || !den) return null;
      const lit = num.kind === "num" && den.kind === "num" && num.value.isInteger() && den.value.isInteger();
      return { kind: "bin", op: "/", left: num, right: den, explicitFrac: true, literal: lit || undefined };
    }
    if (p.t === "sqrt") {
      this.i++;
      const g = this.peek()?.t === "lp" ? this.group() : this.atom();
      return g ? { kind: "sqrt", arg: g } : null;
    }
    return null;
  }
}

export function parseExpression(input: string): Node | null {
  const norm = normalize(input);
  if (norm === null || !norm.trim()) return null;
  const toks = tokenize(norm);
  if (!toks || !toks.length) return null;
  try {
    return new Parser(toks).parse();
  } catch {
    return null;
  }
}

export type Env = Record<string, Rational>;

/** İfadeyi kesin olarak hesaplar. Tanımsız değişken veya irrasyonel sonuçta null. */
export function evaluate(node: Node, env: Env = {}): Rational | null {
  try {
    return ev(node, env);
  } catch {
    return null;
  }
}

function ev(node: Node, env: Env): Rational | null {
  switch (node.kind) {
    case "num":
      return node.value;
    case "var":
      return env[node.name] ?? null;
    case "group":
      return ev(node.arg, env);
    case "neg": {
      const a = ev(node.arg, env);
      return a ? a.neg() : null;
    }
    case "percent": {
      const a = ev(node.arg, env);
      return a ? a.div(Rational.of(100)) : null;
    }
    case "sqrt": {
      const a = ev(node.arg, env);
      return a ? a.sqrt() : null;
    }
    case "pow": {
      const b = ev(node.base, env);
      const e = ev(node.exp, env);
      if (!b || !e || !e.isInteger()) return null;
      return b.pow(Number(e.n));
    }
    case "bin": {
      const l = ev(node.left, env);
      const r = ev(node.right, env);
      if (!l || !r) return null;
      switch (node.op) {
        case "+":
          return l.add(r);
        case "-":
          return l.sub(r);
        case "*":
          return l.mul(r);
        case "/":
          return r.isZero() ? null : l.div(r);
      }
    }
  }
}

export function variablesOf(node: Node, acc = new Set<string>()): Set<string> {
  switch (node.kind) {
    case "var":
      acc.add(node.name);
      break;
    case "neg":
    case "group":
    case "percent":
    case "sqrt":
      variablesOf(node.arg, acc);
      break;
    case "pow":
      variablesOf(node.base, acc);
      variablesOf(node.exp, acc);
      break;
    case "bin":
      variablesOf(node.left, acc);
      variablesOf(node.right, acc);
      break;
  }
  return acc;
}

/** a·x + b biçiminde doğrusal ifade (tek değişkenli). */
export interface Linear {
  a: Rational;
  b: Rational;
}

export function toLinear(node: Node, variable: string): Linear | null {
  try {
    return lin(node, variable);
  } catch {
    return null;
  }
}

function lin(node: Node, v: string): Linear | null {
  const zero = Rational.of(0);
  switch (node.kind) {
    case "num":
      return { a: zero, b: node.value };
    case "var":
      return node.name === v ? { a: Rational.of(1), b: zero } : null;
    case "group":
      return lin(node.arg, v);
    case "neg": {
      const x = lin(node.arg, v);
      return x ? { a: x.a.neg(), b: x.b.neg() } : null;
    }
    case "percent": {
      const x = lin(node.arg, v);
      const h = Rational.of(100);
      return x ? { a: x.a.div(h), b: x.b.div(h) } : null;
    }
    case "sqrt":
    case "pow": {
      if (variablesOf(node).size) return null;
      const val = evaluate(node);
      return val ? { a: zero, b: val } : null;
    }
    case "bin": {
      const l = lin(node.left, v);
      const r = lin(node.right, v);
      if (!l || !r) return null;
      switch (node.op) {
        case "+":
          return { a: l.a.add(r.a), b: l.b.add(r.b) };
        case "-":
          return { a: l.a.sub(r.a), b: l.b.sub(r.b) };
        case "*":
          if (!l.a.isZero() && !r.a.isZero()) return null;
          return { a: l.a.mul(r.b).add(r.a.mul(l.b)), b: l.b.mul(r.b) };
        case "/":
          if (!r.a.isZero() || r.b.isZero()) return null;
          return { a: l.a.div(r.b), b: l.b.div(r.b) };
      }
    }
  }
}

/**
 * Bir eşitlik zincirini ("a = b = c") parçalar. Üst düzeydeki "=" işaretlerinden böler;
 * \text{...}, &, \\ gibi hizalama işaretlerini temizler.
 */
export function splitEquation(input: string): string[] {
  const cleaned = input.replace(/&/g, " ").replace(/\\\\/g, " ");
  return cleaned.split(/=/).map((s) => s.trim());
}

export function nodeToLatex(node: Node): string {
  switch (node.kind) {
    case "num":
      return node.value.isInteger() ? node.value.toString() : node.raw.replace(".", ",");
    case "var":
      return node.name;
    case "group":
      return `\\left(${nodeToLatex(node.arg)}\\right)`;
    case "neg":
      return `-${nodeToLatex(node.arg)}`;
    case "percent":
      return `\\%${nodeToLatex(node.arg)}`;
    case "sqrt":
      return `\\sqrt{${nodeToLatex(node.arg)}}`;
    case "pow":
      return `${nodeToLatex(node.base)}^{${nodeToLatex(node.exp)}}`;
    case "bin": {
      const l = nodeToLatex(node.left);
      const r = nodeToLatex(node.right);
      if (node.op === "/") {
        if (node.divSign) return `${l} \\div ${r}`;
        if (node.explicitFrac) return `\\frac{${stripGroup(node.left)}}{${stripGroup(node.right)}}`;
        if (isSimpleFractionPart(node.left) && isSimpleFractionPart(node.right)) return `\\frac{${l}}{${r}}`;
        return `${l} \\div ${r}`;
      }
      if (node.op === "*") {
        const implicit =
          (node.left.kind === "num" && (node.right.kind === "var" || node.right.kind === "group")) ||
          (node.left.kind === "var" && node.right.kind === "var");
        return implicit ? `${l}${r}` : `${l} \\cdot ${r}`;
      }
      return `${l} ${node.op} ${r}`;
    }
  }
}

function stripGroup(n: Node): string {
  return n.kind === "group" ? nodeToLatex(n.arg) : nodeToLatex(n);
}

function isSimpleFractionPart(n: Node) {
  return n.kind === "num" || n.kind === "var";
}

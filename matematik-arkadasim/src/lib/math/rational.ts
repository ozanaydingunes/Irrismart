/**
 * BigInt tabanlı kesin rasyonel sayı. Kayan nokta hatası olmadan kesir, ondalık ve
 * tam sayı işlemleri yapar (ör. 0,1 + 0,2 = 3/10 tam olarak).
 */
export class Rational {
  readonly n: bigint;
  readonly d: bigint;

  constructor(n: bigint | number, d: bigint | number = 1n) {
    let nn = typeof n === "number" ? BigInt(n) : n;
    let dd = typeof d === "number" ? BigInt(d) : d;
    if (dd === 0n) throw new RangeError("Sıfıra bölme tanımsızdır.");
    if (dd < 0n) {
      nn = -nn;
      dd = -dd;
    }
    const g = gcd(abs(nn), dd);
    this.n = g === 0n ? 0n : nn / g;
    this.d = g === 0n ? 1n : dd / g;
  }

  static of(n: number | bigint, d: number | bigint = 1): Rational {
    return new Rational(BigInt(n), BigInt(d));
  }

  /** "2,5", "2.5", "-0,125", "3" gibi ondalık metinleri tam olarak çevirir. */
  static parseDecimal(text: string): Rational | null {
    const m = /^([+-])?(\d+)(?:[.,](\d+))?$/.exec(text.trim());
    if (!m) return null;
    const sign = m[1] === "-" ? -1n : 1n;
    const intPart = m[2];
    const frac = m[3] ?? "";
    const n = BigInt(intPart + frac) * sign;
    const d = 10n ** BigInt(frac.length);
    return new Rational(n, d);
  }

  add(o: Rational) {
    return new Rational(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Rational) {
    return new Rational(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Rational) {
    return new Rational(this.n * o.n, this.d * o.d);
  }
  div(o: Rational) {
    if (o.n === 0n) throw new RangeError("Sıfıra bölme tanımsızdır.");
    return new Rational(this.n * o.d, this.d * o.n);
  }
  neg() {
    return new Rational(-this.n, this.d);
  }
  pow(e: number): Rational {
    if (!Number.isInteger(e) || Math.abs(e) > 64) throw new RangeError("Üs desteklenmiyor.");
    if (e < 0) return Rational.of(1).div(this.pow(-e));
    let r = Rational.of(1);
    for (let i = 0; i < e; i++) r = r.mul(this);
    return r;
  }
  /** Tam kare (rasyonel) ise karekök, değilse null. */
  sqrt(): Rational | null {
    if (this.n < 0n) return null;
    const a = isqrt(this.n);
    const b = isqrt(this.d);
    if (a * a !== this.n || b * b !== this.d) return null;
    return new Rational(a, b);
  }
  eq(o: Rational) {
    return this.n === o.n && this.d === o.d;
  }
  cmp(o: Rational) {
    const l = this.n * o.d;
    const r = o.n * this.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }
  isZero() {
    return this.n === 0n;
  }
  isInteger() {
    return this.d === 1n;
  }
  toNumber() {
    return Number(this.n) / Number(this.d);
  }

  /** Bölen yalnızca 2 ve 5 çarpanlarından oluşuyorsa sonlu ondalık gösterim. */
  toDecimalString(): string | null {
    let d = this.d;
    while (d % 2n === 0n) d /= 2n;
    while (d % 5n === 0n) d /= 5n;
    if (d !== 1n) return null;
    let digits = 0;
    let scale = 1n;
    while ((this.n * scale) % this.d !== 0n) {
      scale *= 10n;
      digits++;
    }
    const scaled = (this.n * scale) / this.d;
    const neg = scaled < 0n;
    const s = abs(scaled).toString().padStart(digits + 1, "0");
    const intPart = s.slice(0, s.length - digits) || "0";
    const fracPart = s.slice(s.length - digits);
    return (neg ? "-" : "") + intPart + (digits ? "," + fracPart : "");
  }

  toString(): string {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }

  toLatex(): string {
    if (this.d === 1n) return this.n.toString();
    const sign = this.n < 0n ? "-" : "";
    return `${sign}\\frac{${abs(this.n)}}{${this.d}}`;
  }
}

export function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function lcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return abs(a * b) / gcd(a, b);
}

export function abs(a: bigint) {
  return a < 0n ? -a : a;
}

function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (x * x > n) x--;
  while ((x + 1n) * (x + 1n) <= n) x++;
  return x;
}

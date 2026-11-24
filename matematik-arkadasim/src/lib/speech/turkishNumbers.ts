/**
 * Türkçe sayı okuma ve ünlü uyumuna göre ek getirme yardımcıları.
 */

const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
const SCALES = ["", "bin", "milyon", "milyar", "trilyon"];

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  const parts: string[] = [];
  if (h) parts.push(h === 1 ? "yüz" : `${ONES[h]} yüz`);
  if (t) parts.push(TENS[t]);
  if (o) parts.push(ONES[o]);
  return parts.join(" ");
}

/** Tam sayıyı Türkçe okur: 1250 → "bin iki yüz elli", -7 → "eksi yedi". */
export function integerToWords(value: number | bigint): string {
  let n = typeof value === "bigint" ? value : BigInt(Math.trunc(value));
  if (n === 0n) return "sıfır";
  const neg = n < 0n;
  if (neg) n = -n;
  if (n >= 10n ** 15n) return (neg ? "eksi " : "") + n.toString().split("").map((d) => integerToWords(Number(d))).join(" ");
  const groups: number[] = [];
  while (n > 0n) {
    groups.push(Number(n % 1000n));
    n /= 1000n;
  }
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    if (i === 1 && g === 1) words.push("bin");
    else words.push(`${threeDigits(g)}${SCALES[i] ? " " + SCALES[i] : ""}`);
  }
  return (neg ? "eksi " : "") + words.join(" ");
}

/** "2,05" → "iki virgül sıfır beş"; "12,5" → "on iki virgül beş". */
export function decimalToWords(text: string): string {
  const m = /^(-)?(\d+)(?:[.,](\d+))?$/.exec(text.trim());
  if (!m) return text;
  const intWords = integerToWords(BigInt(m[2]));
  let out = (m[1] ? "eksi " : "") + intWords;
  if (m[3]) {
    const frac = m[3];
    const leadingZeros = frac.match(/^0+/)?.[0].length ?? 0;
    const rest = frac.slice(leadingZeros);
    const zeros = Array(leadingZeros).fill("sıfır");
    out += " virgül " + [...zeros, rest ? integerToWords(BigInt(rest)) : ""].filter(Boolean).join(" ");
  }
  return out;
}

const BACK_VOWELS = "aıou";
const FRONT_VOWELS = "eiöü";
const ALL_VOWELS = BACK_VOWELS + FRONT_VOWELS + "âîû";
const VOICELESS = "fstkçşhp";

function lastVowel(word: string): string {
  const w = word.toLocaleLowerCase("tr-TR");
  for (let i = w.length - 1; i >= 0; i--) if (ALL_VOWELS.includes(w[i])) return w[i];
  return "e";
}

function endsWithVowel(word: string) {
  return ALL_VOWELS.includes(word.toLocaleLowerCase("tr-TR").slice(-1));
}

function endsWithVoiceless(word: string) {
  return VOICELESS.includes(word.toLocaleLowerCase("tr-TR").slice(-1));
}

function isBack(v: string) {
  return "aıouâû".includes(v);
}

/** Bulunma eki: beş → beşte, on → onda, iki → ikide, dört → dörtte. */
export function locative(word: string): string {
  const v = lastVowel(word);
  const consonant = endsWithVoiceless(word) ? "t" : "d";
  return word + consonant + (isBack(v) ? "a" : "e");
}

/** Dört yönlü ünlü uyumu: ı, i, u, ü */
function fourWay(v: string): string {
  if ("aıâ".includes(v)) return "ı";
  if ("ei".includes(v) || v === "î") return "i";
  if ("ouû".includes(v)) return "u";
  return "ü";
}

/** İlgi (tamlayan) eki: beş → beşin, iki → ikinin, on → onun, x (iks) → iksin. */
export function genitive(word: string): string {
  const v = fourWay(lastVowel(word));
  const stem = word.endsWith("dört") ? word.slice(0, -1) + "d" : word;
  return stem + (endsWithVowel(word) ? "n" : "") + v + "n";
}

/** Sıra sayısı: 2 → ikinci, 3 → üçüncü, 4 → dördüncü, 10 → onuncu. */
export function ordinal(n: number): string {
  const w = integerToWords(n);
  const base = w.endsWith("dört") ? w.slice(0, -1) + "d" : w;
  const v = fourWay(lastVowel(base));
  return base + (endsWithVowel(base) ? "" : v) + "nc" + v;
}

/** Değişken harflerinin okunuşu. */
const LETTER_NAMES: Record<string, string> = {
  a: "a", b: "be", c: "ce", d: "de", e: "e", f: "fe", g: "ge", h: "he", i: "i", j: "je",
  k: "ke", l: "le", m: "me", n: "ne", o: "o", p: "pe", q: "kü", r: "re", s: "se", t: "te",
  u: "u", v: "ve", w: "dabılyu", x: "iks", y: "ye", z: "ze",
};

export function letterName(ch: string): string {
  return LETTER_NAMES[ch.toLowerCase()] ?? ch;
}

/** "x'in" gibi kesme işaretli eklerde kullanılacak ek (okunuşa göre): x → "iksin" için "in". */
/** Yönelme eki: üç → üçe, dört → dörde, iki → ikiye, on → ona. */
export function dative(word: string): string {
  const v = lastVowel(word);
  const stem = word.endsWith("dört") ? word.slice(0, -1) + "d" : word;
  return stem + (endsWithVowel(word) ? "y" : "") + (isBack(v) ? "a" : "e");
}

/** 3. tekil iyelik eki: beş → beşi, iki → ikisi, on → onu, dört → dördü. */
export function possessive(word: string): string {
  const v = fourWay(lastVowel(word));
  const stem = word.endsWith("dört") ? word.slice(0, -1) + "d" : word;
  return stem + (endsWithVowel(word) ? "s" : "") + v;
}

/** Rakamla yazılmış sayıya kesme işaretiyle ek getirir: (25, "possessive") → "25'i", (10, "genitive") → "10'un". */
export function numberWithSuffix(n: string | number, kind: "possessive" | "genitive" | "locative" | "dative"): string {
  const text = String(n);
  const m = /^%?(-?\d+(?:[.,]\d+)?)$/.exec(text);
  const spoken = m ? decimalToWords(m[1]) : text;
  const full = kind === "possessive" ? possessive(spoken) : kind === "genitive" ? genitive(spoken) : kind === "locative" ? locative(spoken) : dative(spoken);
  return `${text}'${full.slice(spoken.length)}`;
}

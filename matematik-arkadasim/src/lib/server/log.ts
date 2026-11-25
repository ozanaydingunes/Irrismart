/**
 * Güvenli günlük kaydı: istek gövdeleri, soru metinleri ve görseller ASLA yazılmaz;
 * yalnızca hata türü ve kısa teknik mesaj. Anahtar benzeri dizeler maskelenir.
 */
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{8,}/g, // OpenAI / Anthropic anahtar biçimleri
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /x-api-key["':\s]+[A-Za-z0-9._-]+/gi,
  /data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/gi,
];

export function redact(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, "[gizlendi]");
  return out.slice(0, 300);
}

export function logError(scope: string, error: unknown) {
  const kind = typeof error === "object" && error && "kind" in error ? String((error as { kind: unknown }).kind) : "";
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[${scope}]${kind ? ` (${kind})` : ""} ${redact(msg)}`);
}

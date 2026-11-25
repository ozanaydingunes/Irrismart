/**
 * Yaklaşık maliyet hesabı (USD / 1 milyon jeton). Günlük harcama sınırı bu tabloyla uygulanır.
 * Fiyatlar değişebilir: yayın öncesi sağlayıcının güncel fiyat sayfasından kontrol edin.
 * Tabloda olmayan modeller için temkinli (yüksek) bir varsayılan kullanılır; gerçek fiyatı
 * MODEL_PRICE_INPUT / MODEL_PRICE_OUTPUT ortam değişkenleriyle verebilirsiniz.
 */
export const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

export const UNKNOWN_MODEL_PRICE = { input: 10, output: 40 };

export function priceFor(model: string): { input: number; output: number } {
  const known = MODEL_PRICES[model];
  if (known) return known;
  const i = Number(process.env.MODEL_PRICE_INPUT);
  const o = Number(process.env.MODEL_PRICE_OUTPUT);
  if (Number.isFinite(i) && Number.isFinite(o) && i > 0 && o > 0) return { input: i, output: o };
  return UNKNOWN_MODEL_PRICE;
}

/** Bir çağrının yaklaşık maliyeti (USD). Önbellekten okunan jetonlar da tam fiyattan sayılır (temkinli). */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = priceFor(model);
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

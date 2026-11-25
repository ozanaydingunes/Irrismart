import "server-only";

/**
 * Sunucu yapılandırması. API anahtarları ve gizli değerler yalnızca burada okunur;
 * tarayıcıya hiçbir zaman gönderilmez.
 */

export type ProviderName = "anthropic" | "openai" | "demo" | "mock";
type Effort = "low" | "medium" | "high";

function num(name: string, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const v = Number(process.env[name]);
  if (!process.env[name]?.trim() || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

export interface ServerConfig {
  provider: ProviderName;
  anthropic: { apiKey: string; model: string; lightModel: string; effort: Effort };
  openai: { apiKey: string; model: string; lightModel: string; baseUrl: string };
  tts: { provider: "none" | "openai"; model: string; voiceFemale: string; voiceMale: string };
  limits: {
    perMinute: number;
    dailyPerClient: number;
    dailyGlobal: number;
    dailyBudgetUsd: number;
    maxImageBytes: number;
  };
  access: { pin: string; sessionSecret: string };
  store: { upstashUrl: string; upstashToken: string };
  isProduction: boolean;
}

const EFFORTS: Effort[] = ["low", "medium", "high"];

export function getConfig(): ServerConfig {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
  const openaiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const requested = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();

  // Seçilen sağlayıcının anahtarı yoksa demo moduna düşülür (sessizce başka sağlayıcıya geçilmez).
  let provider: ProviderName = "demo";
  if (requested === "openai") provider = openaiKey ? "openai" : "demo";
  else if (requested === "demo") provider = "demo";
  // Yalnızca otomatik testler: iki ayrı bayrak birlikte gerekir
  else if (requested === "mock" && process.env.ALLOW_MOCK_PROVIDER === "1") provider = "mock";
  else if (requested === "anthropic") provider = anthropicKey ? "anthropic" : "demo";
  else if (requested === "") provider = anthropicKey ? "anthropic" : openaiKey ? "openai" : "demo";

  const effortEnv = (process.env.ANTHROPIC_EFFORT ?? "medium").trim() as Effort;
  const ttsProvider = process.env.TTS_PROVIDER?.trim() === "openai" && openaiKey ? "openai" : "none";

  return {
    provider,
    anthropic: {
      apiKey: anthropicKey,
      // Varsayılan: doğruluk/maliyet dengesi iyi olan Sonnet. Daha ucuz: claude-haiku-5-5, en doğru: claude-opus-5-5
      model: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5",
      // Cevap kontrolü ve ipucu gibi basit görevler için ucuz model
      lightModel: process.env.ANTHROPIC_LIGHT_MODEL?.trim() || "claude-haiku-5-5",
      effort: EFFORTS.includes(effortEnv) ? effortEnv : "medium",
    },
    openai: {
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1",
      lightModel: process.env.OPENAI_LIGHT_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
      baseUrl: (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, ""),
    },
    tts: {
      provider: ttsProvider,
      model: process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts",
      voiceFemale: process.env.OPENAI_TTS_VOICE_FEMALE?.trim() || "nova",
      voiceMale: process.env.OPENAI_TTS_VOICE_MALE?.trim() || "onyx",
    },
    limits: {
      perMinute: num("RATE_LIMIT_PER_MINUTE", 8, 0, 1000),
      dailyPerClient: num("DAILY_LIMIT_PER_CLIENT", 40, 0, 100000),
      dailyGlobal: num("DAILY_LIMIT_GLOBAL", 300, 0, 1000000),
      dailyBudgetUsd: num("DAILY_BUDGET_USD", 2, 0, 10000),
      // Vercel sunucusuz fonksiyon gövde sınırı ~4,5 MB: base64 şişmesiyle 3 MB görsel ≈ 4 MB gövde
      maxImageBytes: Math.round(num("MAX_IMAGE_MB", 3, 0.5, 10) * 1024 * 1024),
    },
    access: {
      pin: process.env.APP_ACCESS_PIN?.trim() ?? "",
      sessionSecret: process.env.APP_SESSION_SECRET?.trim() ?? "",
    },
    store: {
      // Vercel Marketplace (Upstash) entegrasyonu KV_REST_API_* adlarını da kullanabilir
      upstashUrl: (process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim() || "").replace(/\/+$/, ""),
      upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim() || "",
    },
    isProduction: process.env.NODE_ENV === "production",
  };
}

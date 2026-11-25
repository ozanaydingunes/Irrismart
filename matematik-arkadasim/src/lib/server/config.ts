import "server-only";

/**
 * Sunucu yapılandırması. API anahtarları ve gizli değerler yalnızca burada okunur;
 * tarayıcıya hiçbir zaman gönderilmez.
 */

export type ProviderName = "ollama" | "anthropic" | "openai" | "demo" | "mock";
type Effort = "low" | "medium" | "high";

function num(name: string, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const v = Number(process.env[name]);
  if (!process.env[name]?.trim() || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

export interface ServerConfig {
  provider: ProviderName;
  /** Ücretli sağlayıcılar (Anthropic, OpenAI, sunucu TTS) yalnızca ALLOW_PAID_AI=1 ile açılır */
  paidAllowed: boolean;
  ollama: { baseUrl: string; model: string; lightModel: string; timeoutMs: number; authHeader: string };
  anthropic: { apiKey: string; model: string; lightModel: string; effort: Effort };
  openai: { apiKey: string; model: string; lightModel: string; baseUrl: string };
  tts: { provider: "none" | "openai"; model: string; voiceFemale: string; voiceMale: string };
  limits: {
    perMinute: number;
    dailyPerClient: number;
    dailyGlobal: number;
    dailyBudgetUsd: number;
    /** Günlük yeni soru sınırı (aile geneli; ebeveyn uygulamadan değiştirebilir) */
    dailyQuestions: number;
    maxImageBytes: number;
  };
  access: { pin: string; sessionSecret: string; parentPin: string };
  store: { upstashUrl: string; upstashToken: string; dataDir: string; useFile: boolean };
  isProduction: boolean;
}

const EFFORTS: Effort[] = ["low", "medium", "high"];

export function getConfig(): ServerConfig {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
  const openaiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const requested = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();

  // SIFIR MALİYET VARSAYILANI: ücretli sağlayıcılar, anahtar olsa bile ALLOW_PAID_AI=1 olmadan ASLA kullanılmaz.
  // Seçilen sağlayıcı kullanılamıyorsa demo moduna düşülür; sessizce başka (özellikle ücretli) sağlayıcıya geçilmez.
  const paidAllowed = process.env.ALLOW_PAID_AI?.trim() === "1";
  let provider: ProviderName = "demo";
  if (requested === "" || requested === "ollama") provider = "ollama";
  else if (requested === "demo") provider = "demo";
  // Yalnızca otomatik testler: iki ayrı bayrak birlikte gerekir
  else if (requested === "mock" && process.env.ALLOW_MOCK_PROVIDER === "1") provider = "mock";
  else if (requested === "openai") provider = paidAllowed && openaiKey ? "openai" : "demo";
  else if (requested === "anthropic") provider = paidAllowed && anthropicKey ? "anthropic" : "demo";

  const effortEnv = (process.env.ANTHROPIC_EFFORT ?? "medium").trim() as Effort;
  // Ücretli seslendirme varsayılan olarak kapalı; ücretsiz Web Speech API kullanılır
  const ttsProvider = paidAllowed && process.env.TTS_PROVIDER?.trim() === "openai" && openaiKey ? "openai" : "none";
  const ollamaModel = process.env.OLLAMA_MODEL?.trim() || "gemma4:e4b";

  return {
    provider,
    paidAllowed,
    ollama: {
      // Ollama'nın çalıştığı bilgisayar (aynı bilgisayardaysa varsayılan doğrudur)
      baseUrl: (process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434").replace(/\/+$/, ""),
      model: ollamaModel,
      lightModel: process.env.OLLAMA_LIGHT_MODEL?.trim() || ollamaModel,
      // Yerel model ev bilgisayarında yavaş olabilir: varsayılan 5 dakika
      timeoutMs: Math.round(num("OLLAMA_TIMEOUT_SECONDS", 300, 30, 1800) * 1000),
      // İsteğe bağlı: Ollama bir ters vekil/tünel arkasındaysa gönderilecek yetki başlığı ("Ad: değer")
      authHeader: process.env.OLLAMA_AUTH_HEADER?.trim() ?? "",
    },
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
      // Yeni soru sınırı dailyQuestions'tadır; bunlar ek sorular (Anlamadım, ipucu…) dahil tüm çağrılar için üst sınırdır
      dailyPerClient: num("DAILY_LIMIT_PER_CLIENT", 150, 0, 100000),
      dailyGlobal: num("DAILY_LIMIT_GLOBAL", 300, 0, 1000000),
      dailyBudgetUsd: num("DAILY_BUDGET_USD", 1, 0, 10000),
      dailyQuestions: num("DAILY_QUESTION_LIMIT", 10, 0, 1000),
      // Vercel sunucusuz fonksiyon gövde sınırı ~4,5 MB: base64 şişmesiyle 3 MB görsel ≈ 4 MB gövde
      maxImageBytes: Math.round(num("MAX_IMAGE_MB", 3, 0.5, 10) * 1024 * 1024),
    },
    access: {
      pin: process.env.APP_ACCESS_PIN?.trim() ?? "",
      sessionSecret: process.env.APP_SESSION_SECRET?.trim() ?? "",
      // Günlük soru sınırını uygulamadan değiştirmek için ebeveyn PIN'i (çocuğun bildiği aile PIN'inden farklı olmalı)
      parentPin: process.env.PARENT_PIN?.trim() ?? "",
    },
    store: {
      // Vercel Marketplace (Upstash) entegrasyonu KV_REST_API_* adlarını da kullanabilir
      upstashUrl: (process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim() || "").replace(/\/+$/, ""),
      upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim() || "",
      // Ev bilgisayarında (Vercel dışında) sayaçlar dosyada tutulur: yeniden başlatmada sıfırlanmaz
      dataDir: process.env.DATA_DIR?.trim() || ".data",
      useFile: process.env.VERCEL !== "1" && process.env.COUNTER_STORE?.trim() !== "memory",
    },
    isProduction: process.env.NODE_ENV === "production",
  };
}

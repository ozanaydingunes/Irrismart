import "server-only";

/**
 * Sunucu yapılandırması. API anahtarları ve gizli değerler yalnızca burada okunur;
 * tarayıcıya hiçbir zaman gönderilmez.
 */

export type ProviderName = "cloudflare" | "groq" | "ollama" | "anthropic" | "openai" | "demo" | "mock";
export type FreeProviderName = "cloudflare" | "groq";
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
  cloudflare: { accountId: string; apiToken: string; model: string; lightModel: string; baseUrl: string; dailyNeuronBudget: number; configured: boolean };
  groq: { apiKey: string; model: string; baseUrl: string; dailyRequestBudget: number; dailyTokenBudget: number; configured: boolean };
  /** Birincil ücretsiz sağlayıcının kotası dolunca sırayla denenecek, ebeveynin onayladığı ÜCRETSİZ yedekler */
  freeFallbacks: FreeProviderName[];
  ollama: { baseUrl: string; model: string; lightModel: string; timeoutMs: number; authHeader: string; numCtx: number };
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
  access: { pin: string; sessionSecret: string; pinRequired: boolean };
  store: { upstashUrl: string; upstashToken: string; dataDir: string; useFile: boolean; persistentRequired: boolean };
  /** Saf işlem/denklem sorularını yapay zekâ çağırmadan yerel kesin hesaplama motoruyla çöz */
  localSolverFirst: boolean;
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
  const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
  const cfToken = process.env.CLOUDFLARE_API_TOKEN?.trim() ?? "";
  const groqKey = process.env.GROQ_API_KEY?.trim() ?? "";
  const cfConfigured = !!cfAccount && !!cfToken;
  let provider: ProviderName = "demo";
  // Varsayılan: Cloudflare Workers AI (ücretsiz). Ev bilgisayarındaki Ollama yalnızca AI_PROVIDER=ollama ile.
  if (requested === "" || requested === "cloudflare") provider = cfConfigured ? "cloudflare" : "demo";
  else if (requested === "groq") provider = groqKey ? "groq" : "demo";
  else if (requested === "ollama") provider = "ollama";
  else if (requested === "demo") provider = "demo";
  // Yalnızca otomatik testler: iki ayrı bayrak birlikte gerekir
  else if (requested === "mock" && process.env.ALLOW_MOCK_PROVIDER === "1") provider = "mock";
  else if (requested === "openai") provider = paidAllowed && openaiKey ? "openai" : "demo";
  else if (requested === "anthropic") provider = paidAllowed && anthropicKey ? "anthropic" : "demo";

  // Yedekler YALNIZCA ücretsiz sağlayıcılardan seçilebilir; ücretli adlar (anthropic/openai) burada yok sayılır.
  const fallbackEnv = process.env.AI_FALLBACK_PROVIDERS ?? "groq";
  const freeFallbacks = [...new Set(fallbackEnv.split(",").map((x) => x.trim().toLowerCase()))].filter(
    (x): x is FreeProviderName => (x === "cloudflare" && cfConfigured) || (x === "groq" && !!groqKey),
  );
  const onVercel = process.env.VERCEL === "1";

  const effortEnv = (process.env.ANTHROPIC_EFFORT ?? "medium").trim() as Effort;
  // Ücretli seslendirme varsayılan olarak kapalı; ücretsiz Web Speech API kullanılır
  const ttsProvider = paidAllowed && process.env.TTS_PROVIDER?.trim() === "openai" && openaiKey ? "openai" : "none";
  // 8 GB RAM'li ev bilgisayarı için varsayılan: gemma3:4b (≈3,4 GB, metin + görsel). 16 GB+ için gemma4:e4b önerilir.
  const ollamaModel = process.env.OLLAMA_MODEL?.trim() || "gemma3:4b";

  return {
    provider,
    paidAllowed,
    cloudflare: {
      accountId: cfAccount,
      apiToken: cfToken,
      // Görsel destekli (Vision) ve JSON modlu model. Mistral Small 3.1 Cloudflare'de yalnızca metin alır.
      model: process.env.CLOUDFLARE_MODEL?.trim() || "@cf/meta/llama-4-scout-17b-16e-instruct",
      // Görselsiz basit görevler (ipucu, cevap kontrolü) için; varsayılan olarak aynı model (doğruluktan ödün vermemek için)
      lightModel: process.env.CLOUDFLARE_LIGHT_MODEL?.trim() || process.env.CLOUDFLARE_MODEL?.trim() || "@cf/meta/llama-4-scout-17b-16e-instruct",
      baseUrl: (process.env.CLOUDFLARE_API_BASE_URL?.trim() || "https://api.cloudflare.com/client/v4").replace(/\/+$/, ""),
      // Ücretsiz plan: günde 10.000 nöron. %10 güvenlik payı; 10.000 üzeri asla ayarlanamaz.
      dailyNeuronBudget: Math.round(num("CLOUDFLARE_DAILY_NEURON_BUDGET", 9000, 500, 10000)),
      configured: cfConfigured,
    },
    groq: {
      apiKey: groqKey,
      model: process.env.GROQ_MODEL?.trim() || "qwen/qwen3.8-27b",
      baseUrl: (process.env.GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1").replace(/\/+$/, ""),
      // Ücretsiz plan (qwen3.8-27b): günde 1.000 istek, 200.000 jeton → %10 güvenlik payı
      dailyRequestBudget: Math.round(num("GROQ_DAILY_REQUEST_BUDGET", 900, 10, 1000)),
      dailyTokenBudget: Math.round(num("GROQ_DAILY_TOKEN_BUDGET", 180000, 1000, 200000)),
      configured: !!groqKey,
    },
    freeFallbacks,
    ollama: {
      // Ollama'nın çalıştığı bilgisayar (aynı bilgisayardaysa varsayılan doğrudur)
      baseUrl: (process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434").replace(/\/+$/, ""),
      model: ollamaModel,
      lightModel: process.env.OLLAMA_LIGHT_MODEL?.trim() || ollamaModel,
      // Yerel model ev bilgisayarında yavaş olabilir: varsayılan 5 dakika
      timeoutMs: Math.round(num("OLLAMA_TIMEOUT_SECONDS", 300, 30, 1800) * 1000),
      // İsteğe bağlı: Ollama bir ters vekil/tünel arkasındaysa gönderilecek yetki başlığı ("Ad: değer")
      authHeader: process.env.OLLAMA_AUTH_HEADER?.trim() ?? "",
      // Bağlam penceresi: büyüdükçe bellek kullanımı artar. 8 GB RAM için 8192 önerilir.
      numCtx: Math.round(num("OLLAMA_NUM_CTX", 8192, 2048, 131072)),
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
      // Kötüye kullanım koruması (normal öğrenci kullanımını kısıtlamaz): dakikada en fazla 20 istek
      perMinute: num("RATE_LIMIT_PER_MINUTE", 20, 0, 1000),
      // Günlük soru/istek sınırı YOK (0 = sınırsız). Yalnızca ebeveyn bilerek açarsa uygulanır.
      dailyPerClient: num("DAILY_LIMIT_PER_CLIENT", 0, 0, 100000),
      dailyGlobal: num("DAILY_LIMIT_GLOBAL", 0, 0, 1000000),
      // Yalnızca ücretli sağlayıcılar için (ALLOW_PAID_AI=1); ücretsiz sağlayıcılarda harcama oluşmaz
      dailyBudgetUsd: num("DAILY_BUDGET_USD", 1, 0, 10000),
      // Vercel sunucusuz fonksiyon gövde sınırı ~4,5 MB: base64 şişmesiyle 3 MB görsel ≈ 4 MB gövde
      maxImageBytes: Math.round(num("MAX_IMAGE_MB", 3, 0.5, 10) * 1024 * 1024),
    },
    access: {
      pin: process.env.APP_ACCESS_PIN?.trim() ?? "",
      sessionSecret: process.env.APP_SESSION_SECRET?.trim() ?? "",
      // İnternette (Vercel) yayında aile PIN'i ZORUNLU: tanımlı değilse yapay zekâ uçları çalışmaz
      pinRequired: onVercel || process.env.REQUIRE_ACCESS_PIN?.trim() === "1",
    },
    store: {
      // Vercel Marketplace (Upstash) entegrasyonu KV_REST_API_* adlarını da kullanabilir
      upstashUrl: (process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim() || "").replace(/\/+$/, ""),
      upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim() || "",
      // Ev bilgisayarında (Vercel dışında) sayaçlar dosyada tutulur: yeniden başlatmada sıfırlanmaz
      dataDir: process.env.DATA_DIR?.trim() || ".data",
      useFile: !onVercel && process.env.COUNTER_STORE?.trim() !== "memory",
      // Vercel'de sayaçlar (hız sınırı, PIN deneme sınırı, ücretsiz kota) kalıcı olmalı: Upstash gerekir
      persistentRequired: onVercel,
    },
    localSolverFirst: process.env.LOCAL_SOLVER_FIRST?.trim() !== "0",
    isProduction: process.env.NODE_ENV === "production",
  };
}

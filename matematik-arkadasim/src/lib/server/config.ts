import "server-only";

/**
 * Sunucu yapılandırması. API anahtarları yalnızca burada okunur ve tarayıcıya gönderilmez.
 */

export type ProviderName = "anthropic" | "openai" | "demo";

function int(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export interface ServerConfig {
  provider: ProviderName;
  anthropic: { apiKey: string; model: string; effort: "low" | "medium" | "high" | "xhigh" | "max" };
  openai: { apiKey: string; model: string; baseUrl: string };
  tts: { provider: "none" | "openai"; model: string; voiceFemale: string; voiceMale: string };
  limits: { perMinute: number; dailyPerClient: number; dailyGlobal: number; maxImageBytes: number };
}

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

export function getConfig(): ServerConfig {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
  const openaiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const requested = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();

  // Seçilen sağlayıcının anahtarı yoksa demo moduna düşülür (sessizce başka sağlayıcıya geçilmez).
  let provider: ProviderName = "demo";
  if (requested === "openai") provider = openaiKey ? "openai" : "demo";
  else if (requested === "demo") provider = "demo";
  else if (requested === "anthropic" || requested === "") provider = anthropicKey ? "anthropic" : requested === "" && openaiKey ? "openai" : "demo";

  const effortEnv = (process.env.ANTHROPIC_EFFORT ?? "medium").trim() as ServerConfig["anthropic"]["effort"];
  const ttsProvider = process.env.TTS_PROVIDER?.trim() === "openai" && openaiKey ? "openai" : "none";

  return {
    provider,
    anthropic: {
      apiKey: anthropicKey,
      model: process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5",
      effort: EFFORTS.includes(effortEnv) ? effortEnv : "medium",
    },
    openai: {
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1",
      baseUrl: (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, ""),
    },
    tts: {
      provider: ttsProvider,
      model: process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts",
      voiceFemale: process.env.OPENAI_TTS_VOICE_FEMALE?.trim() || "nova",
      voiceMale: process.env.OPENAI_TTS_VOICE_MALE?.trim() || "onyx",
    },
    limits: {
      perMinute: int("RATE_LIMIT_PER_MINUTE", 10),
      dailyPerClient: int("DAILY_LIMIT_PER_CLIENT", 60),
      dailyGlobal: int("DAILY_LIMIT_GLOBAL", 2000),
      maxImageBytes: Math.round(Math.min(10, Math.max(0.5, Number(process.env.MAX_IMAGE_MB ?? 4) || 4)) * 1024 * 1024),
    },
  };
}

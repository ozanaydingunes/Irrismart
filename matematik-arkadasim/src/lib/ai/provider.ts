import "server-only";
import type { AllowedImageType } from "@/lib/server/image";

/**
 * Modüler yapay zekâ sağlayıcı arayüzü. Yeni bir sağlayıcı eklemek için bu arayüzü
 * uygulayan bir sınıf yazıp `getProvider` içine eklemek yeterlidir.
 */

export type ContentPart = { type: "text"; text: string } | { type: "image"; mediaType: AllowedImageType; base64: string };

export interface ChatTurn {
  role: "user" | "assistant";
  parts: ContentPart[];
}

export interface CompletionRequest {
  system: string;
  messages: ChatTurn[];
  maxTokens: number;
  /** Basit görevler (cevap kontrolü, ipucu): daha ucuz model / daha az düşünme */
  light?: boolean;
  /** İsteğin en geç bitmesi gereken an (ms, Date.now() cinsinden) */
  deadline?: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface AIProvider {
  readonly name: string;
  /** Bu sağlayıcı için bir isteğin toplam süre bütçesi (yoksa varsayılan) */
  readonly timeBudgetMs?: number;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

export type AIErrorKind =
  | "auth" // geçersiz / yetkisiz anahtar
  | "billing" // bakiye veya kota bitti
  | "rate" // hız sınırı (geçici)
  | "overloaded" // sağlayıcı yoğun / 5xx (geçici)
  | "timeout"
  | "network"
  | "refusal" // model güvenlik nedeniyle reddetti (başka modele GEÇİLMEZ)
  | "truncated"
  | "bad_request"
  | "invalid_output"
  | "unavailable" // yerel model motoruna (Ollama) ulaşılamıyor
  | "model_missing" // yerel model indirilmemiş
  | "unknown";

export class AIError extends Error {
  constructor(
    message: string,
    readonly kind: AIErrorKind,
  ) {
    super(message);
  }
  get retryable() {
    return this.kind === "rate" || this.kind === "overloaded" || this.kind === "network";
  }
}

/** Kullanıcıya gösterilecek Türkçe hata metni (teknik ayrıntı veya anahtar sızdırmaz). */
export function userMessageFor(error: unknown): string {
  if (error instanceof AIError) {
    switch (error.kind) {
      case "auth":
        return "Yapay zekâ servisine bağlanılamadı: API anahtarı geçersiz veya yetkisiz. Lütfen uygulamayı kuran yetişkine haber ver.";
      case "billing":
        return "Yapay zekâ servisinin kullanım bakiyesi veya kotası dolmuş. Lütfen uygulamayı kuran yetişkine haber ver. Bu sırada Soru Defterim'deki kayıtlı soruları çalışabilirsin.";
      case "rate":
      case "overloaded":
        return "Yapay zekâ servisi şu an çok yoğun. Biraz bekleyip tekrar dener misin?";
      case "timeout":
        return "Yanıt çok uzun sürdü ve zaman aşımına uğradı. Lütfen tekrar dene; soru çok uzunsa kısaltmayı deneyebilirsin.";
      case "network":
        return "Yapay zekâ servisine ulaşılamadı. İnternet bağlantısını kontrol edip tekrar dene.";
      case "refusal":
        return "Bu isteğe yardımcı olamıyorum. Lütfen bir matematik sorusu gönder.";
      case "truncated":
        return "Çözüm çok uzun oldu ve yarıda kesildi. Soruyu biraz daha kısa yazmayı veya tek bir soru göndermeyi dene.";
      case "unavailable":
        return "Pi Hoca'nın çalıştığı ev bilgisayarına ulaşılamadı. Bilgisayarın açık olduğundan ve Ollama'nın çalıştığından emin olup tekrar dene.";
      case "model_missing":
        return "Pi Hoca'nın yapay zekâ modeli bilgisayara henüz indirilmemiş. Kurulum rehberindeki 'model indirme' adımını yapın.";
      case "invalid_output":
        return "Yapay zekânın çözümü doğrulamadan geçemedi. Lütfen tekrar dene.";
      default:
        return "Yapay zekâ beklenmedik bir yanıt verdi. Lütfen tekrar dene.";
    }
  }
  return "Beklenmedik bir hata oluştu. Lütfen tekrar dene.";
}

/** Kalan süreyi hesaplar; süre bittiyse zaman aşımı hatası fırlatır. */
export function remainingMs(deadline: number | undefined, cap: number): number {
  if (!deadline) return cap;
  const left = deadline - Date.now();
  if (left < 3000) throw new AIError("deadline", "timeout");
  return Math.min(cap, left);
}

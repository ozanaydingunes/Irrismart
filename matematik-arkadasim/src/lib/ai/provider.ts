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
  /** Basit görevlerde (ör. cevap kontrolü) daha az düşünme */
  light?: boolean;
}

export interface AIProvider {
  readonly name: string;
  complete(req: CompletionRequest): Promise<string>;
}

export class AIError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "rate" | "overloaded" | "refusal" | "truncated" | "network" | "bad_request" | "unknown",
  ) {
    super(message);
  }
}

/** Kullanıcıya gösterilecek Türkçe hata metni (teknik ayrıntı sızdırmaz). */
export function userMessageFor(error: unknown): string {
  if (error instanceof AIError) {
    switch (error.kind) {
      case "auth":
        return "Yapay zekâ servisine bağlanılamadı (yapılandırma sorunu). Lütfen daha sonra tekrar dene.";
      case "rate":
      case "overloaded":
        return "Yapay zekâ servisi şu an çok yoğun. Biraz bekleyip tekrar dener misin?";
      case "refusal":
        return "Bu isteğe yardımcı olamıyorum. Lütfen bir matematik sorusu gönder.";
      case "truncated":
        return "Çözüm çok uzun oldu ve yarıda kesildi. Soruyu biraz daha kısa yazmayı dene.";
      case "network":
        return "Yapay zekâ servisine ulaşılamadı. İnternet bağlantısını kontrol edip tekrar dene.";
      default:
        return "Yapay zekâ beklenmedik bir yanıt verdi. Lütfen tekrar dene.";
    }
  }
  return "Beklenmedik bir hata oluştu. Lütfen tekrar dene.";
}

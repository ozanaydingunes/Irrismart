import "server-only";
import { DEMO_SAMPLES } from "@/lib/demo/samples";
import type { AIProvider, CompletionRequest, CompletionResult } from "./provider";

/**
 * YALNIZCA OTOMATİK TESTLER İÇİN sahte sağlayıcı. Gerçek yapay zekâ değildir.
 * Etkinleştirmek için hem AI_PROVIDER=mock hem ALLOW_MOCK_PROVIDER=1 gerekir; yayın ortamında
 * asla açmayın. Fotoğraf akışlarını (çoklu soru seçimi, okunan metni doğrulama) API'siz test eder.
 */
export class MockProvider implements AIProvider {
  readonly name = "TEST SAĞLAYICISI (gerçek yapay zekâ değil)";

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const last = req.messages.at(-1)!;
    const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("\n");
    const hasImage = req.messages.some((m) => m.parts.some((p) => p.type === "image"));
    const out = (o: unknown): CompletionResult => ({ text: JSON.stringify(o), model: "mock", usage: { inputTokens: 0, outputTokens: 0 } });

    if (req.system.includes("ETKİLEŞİMLİ ÖZEL DERS")) return out({ message: "Test yanıtı: bu adımda eşitliğin dengesini koruyoruz.", narration: "Test yanıtı.", steps: [] });
    if (req.system.includes("cevabı kontrol ediyorsun")) return out({ correct: false, feedback: "Test kontrolü.", narration: "Test kontrolü." });
    if (text.includes("[test:unreadable]")) return out({ status: "unreadable", message: "Fotoğrafın alt kısmı kesilmiş; şıkları göremiyorum. Sorunun tamamını çekip tekrar dener misin?" });
    if (hasImage && !text.includes("YALNIZCA şunu çözmeni")) {
      return out({
        status: "multiple",
        message: "Fotoğrafta iki soru görüyorum. Hangisini çözelim?",
        questions: [
          { label: "1. soru", text: "Bir sayının 3 katının 4 fazlası 25'tir. Bu sayı kaçtır?" },
          { label: "2. soru", text: "3/4 + 1/6 işleminin sonucu kaçtır?" },
        ],
      });
    }
    const base = DEMO_SAMPLES.find((s) => s.id === "denklem-problem")!.solution;
    return out({ status: "ok", solution: { ...base, readingNote: hasImage ? "Test: fotoğraftaki '3 katı' ifadesini 3x olarak okudum." : undefined } });
  }
}

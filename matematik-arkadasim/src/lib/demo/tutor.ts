import { answersEquivalent } from "@/lib/math/answer";
import type { CheckReply, Solution, TutorAction, TutorReply } from "@/lib/schema/solution";
import { findTopic, TOPICS } from "@/lib/topics";
import { textToSpeech } from "@/lib/speech/mathToSpeech";
import { DEMO_SAMPLES } from "./samples";
import { solveDemo } from "./solver";

/**
 * DEMO özel ders yanıtları — yapay zekâ değildir. Çözümde zaten bulunan bilgilerden
 * (açıklama, ipucu, kural, benzer soru) şablonla yanıt üretir.
 */
export function demoTutorReply(solution: Solution, stepIndex: number, action: TutorAction): TutorReply {
  const step = solution.steps[Math.min(Math.max(stepIndex, 0), solution.steps.length - 1)];
  const topic = findTopic(solution.topicId) ?? findTopic(solution.topic);
  const rule = topic?.rules[0]?.text;
  let message: string;
  switch (action) {
    case "hint":
      message = step.studentQuestion?.hint
        ? `İpucu: ${step.studentQuestion.hint}`
        : `İpucu: Bu adımda "${step.title.toLocaleLowerCase("tr-TR")}" yapıyoruz. ${solution.solutionStrategy}`;
      break;
    case "why":
      message = `Bunu yapmamızın nedeni şu: ${step.explanation}${rule ? ` Hatırla: ${rule}` : ""}`;
      break;
    case "dont_understand":
    case "simpler":
      message = `Hiç sorun değil, birlikte tekrar bakalım. Bu adımın amacı: ${step.title}. ${step.explanation}${rule ? ` Kısaca kural şu: ${rule}` : ""}`;
      break;
    case "example":
      message = `Benzer bir örnek: ${solution.similarQuestion.text}${solution.similarQuestion.answer ? ` (Cevap: ${solution.similarQuestion.answer})` : ""}. Aynı yöntemi kullanarak çözmeyi dene!`;
      break;
    case "other_method":
      message = `Başka bir yol olarak sonucu kontrol yöntemini kullanabiliriz: ${solution.verification.method}`;
      break;
    case "explain_topic":
      message = topic
        ? `${topic.title}: ${topic.summary} ${topic.rules.map((r) => r.text).join(" ")}`
        : `Bu soru "${solution.topic}" konusuyla ilgili. ${solution.solutionStrategy}`;
      break;
    default:
      message = "Demo modunda serbest sorularını yanıtlayamıyorum; bunun için yapay zekâ bağlantısı gerekir. Yukarıdaki hazır düğmeleri kullanabilirsin.";
  }
  return { message, narration: textToSpeech(message), steps: [] };
}

export function demoCheck(studentAnswer: string, expected: string | undefined): CheckReply {
  if (!expected) {
    const message = "Demo modunda bu cevabı otomatik kontrol edemiyorum. Çözüm adımlarıyla karşılaştırarak kendin kontrol edebilirsin.";
    return { correct: false, feedback: message, narration: message, mistakeReason: undefined };
  }
  const eq = answersEquivalent(studentAnswer, expected);
  if (eq === true) {
    const m = "Harika, doğru! 🎉 Aynen böyle devam.";
    return { correct: true, feedback: m, narration: "Harika, doğru! Aynen böyle devam." };
  }
  if (eq === false) {
    const m = "Bu sefer olmadı ama sorun değil. İşlemi bir kez daha dikkatlice yap; istersen ipucu düğmesini kullan.";
    return { correct: false, feedback: m, narration: m, mistakeReason: "Sonuç beklenen değerle eşleşmedi." };
  }
  const m = `Cevabını tam anlayamadım. Sayı olarak yazar mısın? (ör. 12, 3/4 veya 2,5)`;
  return { correct: false, feedback: m, narration: m };
}

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Konuya göre demo alıştırma: ya rastgele sayılarla üretilen bir işlem ya da hazır örnek. */
export function demoPractice(topicId: string): Solution | null {
  const gen: Record<string, () => string> = {
    kesirler: () => {
      const d1 = rnd(2, 6);
      let d2 = rnd(2, 8);
      if (d2 === d1) d2 = d1 + 1;
      return `${rnd(1, d1 - 1)}/${d1} + ${rnd(1, d2 - 1)}/${d2}`;
    },
    "tam-sayilar": () => `(${-rnd(2, 9)}) + ${rnd(2, 6)} · (${-rnd(2, 5)})`,
    denklemler: () => {
      const a = rnd(2, 6);
      const x = rnd(2, 9);
      const b = rnd(1, 12);
      return `${a}x + ${b} = ${a * x + b}`;
    },
    yuzdeler: () => `${rnd(2, 9) * 40} sayısının %${[10, 15, 20, 25, 40, 75][rnd(0, 5)]}'i kaçtır?`,
    "rasyonel-sayilar": () => `${-rnd(1, 4)}/${rnd(5, 8)} - ${rnd(1, 3)}/${rnd(2, 4)}`,
  };
  const g = gen[topicId];
  if (g) {
    for (let i = 0; i < 5; i++) {
      const s = solveDemo(g());
      if (s) return s;
    }
  }
  const sample = DEMO_SAMPLES.find((s) => s.topicId === topicId) ?? DEMO_SAMPLES.find((s) => findTopic(s.topicId)?.unit === findTopic(topicId)?.unit);
  return sample?.solution ?? null;
}

export const DEMO_TOPICS_WITH_PRACTICE = TOPICS.filter((t) => demoPracticeAvailable(t.id)).map((t) => t.id);

function demoPracticeAvailable(id: string) {
  return ["kesirler", "tam-sayilar", "denklemler", "yuzdeler", "rasyonel-sayilar"].includes(id) || DEMO_SAMPLES.some((s) => s.topicId === id);
}

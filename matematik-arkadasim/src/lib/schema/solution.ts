import { z } from "zod";

/**
 * Yapay zekânın ürettiği tüm çözümler bu şemalarla doğrulanır.
 * Görsel talimatlar yalnızca aşağıdaki türlerle sınırlıdır; uygulama hiçbir koşulda
 * YZ'den gelen HTML veya JavaScript çalıştırmaz.
 */

const shortText = (max = 200) => z.string().trim().max(max);
const num = z.number().finite();

export const COLOR_NAMES = ["blue", "purple", "green", "orange", "red", "pink", "teal", "gray"] as const;
export const colorSchema = z.enum(COLOR_NAMES);
export type ColorName = z.infer<typeof colorSchema>;

/** YZ bazen bilinmeyen renk adı yollar; şemayı kırmak yerine varsayılan renge çeviririz. */
const lenientColor = z.preprocess(
  (v) => (typeof v === "string" && (COLOR_NAMES as readonly string[]).includes(v) ? v : undefined),
  colorSchema.optional(),
);

/* ───────────────────────────── Görsel talimatlar ───────────────────────────── */

export const numberLineSchema = z.object({
  type: z.literal("numberLine"),
  min: num,
  max: num,
  step: num.positive().optional(),
  points: z
    .array(z.object({ value: num, label: shortText(30).optional(), color: lenientColor }))
    .max(12)
    .default([]),
  jumps: z
    .array(z.object({ from: num, to: num, label: shortText(30).optional(), color: lenientColor }))
    .max(8)
    .default([]),
});

export const fractionBarsSchema = z.object({
  type: z.literal("fractionBars"),
  bars: z
    .array(
      z.object({
        numerator: z.number().int().min(0).max(60),
        denominator: z.number().int().min(1).max(30),
        label: shortText(40).optional(),
        color: lenientColor,
      }),
    )
    .min(1)
    .max(5),
});

export const fractionPieSchema = z.object({
  type: z.literal("fractionPie"),
  numerator: z.number().int().min(0).max(36),
  denominator: z.number().int().min(1).max(12),
  label: shortText(40).optional(),
  color: lenientColor,
});

export const percentGridSchema = z.object({
  type: z.literal("percentGrid"),
  percent: z.number().min(0).max(100),
  label: shortText(60).optional(),
  color: lenientColor,
});

const pointId = z.string().trim().min(1).max(4);
export const geometrySchema = z.object({
  type: z.literal("geometry"),
  /** Noktalar 0–100 aralığında soyut bir koordinat sisteminde verilir (y aşağı doğru artar). */
  points: z
    .array(z.object({ id: pointId, x: num.min(0).max(100), y: num.min(0).max(100), label: shortText(12).optional() }))
    .min(1)
    .max(12),
  segments: z
    .array(
      z.object({
        from: pointId,
        to: pointId,
        label: shortText(20).optional(),
        color: lenientColor,
        dashed: z.boolean().optional(),
      }),
    )
    .max(20)
    .default([]),
  angles: z
    .array(
      z.object({
        at: pointId,
        from: pointId,
        to: pointId,
        label: shortText(16).optional(),
        right: z.boolean().optional(),
        color: lenientColor,
      }),
    )
    .max(8)
    .default([]),
  circles: z
    .array(z.object({ center: pointId, radius: num.min(1).max(50), label: shortText(20).optional(), color: lenientColor }))
    .max(3)
    .default([]),
  fill: z.array(pointId).max(12).optional(),
  caption: shortText(80).optional(),
});

export const tableSchema = z.object({
  type: z.literal("table"),
  headers: z.array(shortText(30)).min(1).max(8),
  rows: z.array(z.array(shortText(30)).max(8)).min(1).max(10),
  highlight: z.array(z.object({ row: z.number().int().min(0), col: z.number().int().min(0) })).max(20).optional(),
  caption: shortText(80).optional(),
});

export const barChartSchema = z.object({
  type: z.literal("barChart"),
  title: shortText(60).optional(),
  bars: z.array(z.object({ label: shortText(20), value: num, color: lenientColor })).min(1).max(10),
  unit: shortText(10).optional(),
});

export const lineGraphSchema = z.object({
  type: z.literal("lineGraph"),
  xLabel: shortText(20).optional(),
  yLabel: shortText(20).optional(),
  points: z.array(z.object({ x: num, y: num, label: shortText(16).optional() })).min(1).max(12),
  connect: z.boolean().default(true),
});

export const transformSchema = z.object({
  type: z.literal("transform"),
  before: shortText(160),
  after: shortText(160),
  label: shortText(60).optional(),
});

export const balanceSchema = z.object({
  type: z.literal("balance"),
  left: shortText(80),
  right: shortText(80),
  label: shortText(60).optional(),
});

export const ruleSchema = z.object({
  type: z.literal("rule"),
  title: shortText(60).optional(),
  text: shortText(300),
  latex: shortText(200).optional(),
});

export const visualInstructionSchema = z.discriminatedUnion("type", [
  numberLineSchema,
  fractionBarsSchema,
  fractionPieSchema,
  percentGridSchema,
  geometrySchema,
  tableSchema,
  barChartSchema,
  lineGraphSchema,
  transformSchema,
  balanceSchema,
  ruleSchema,
]);
export type VisualInstruction = z.infer<typeof visualInstructionSchema>;
export const VISUAL_TYPES = visualInstructionSchema.options.map((o) => o.shape.type.value);

/**
 * Bilinmeyen veya bozuk görsel talimatları sessizce ayıklar.
 * Tek bir hatalı çizim yüzünden tüm çözüm reddedilmez.
 */
const lenientVisuals = z.preprocess((v) => {
  if (!Array.isArray(v)) return [];
  return v.filter((item) => visualInstructionSchema.safeParse(item).success).slice(0, 4);
}, z.array(visualInstructionSchema));

/* ───────────────────────────── Çözüm adımı ───────────────────────────── */

export const highlightSchema = z.object({
  value: shortText(40).pipe(z.string().min(1)),
  color: colorSchema.catch("blue"),
  reason: shortText(120).optional(),
});
export type Highlight = z.infer<typeof highlightSchema>;

export const studentQuestionSchema = z.object({
  prompt: shortText(300).pipe(z.string().min(1)),
  expectedAnswer: shortText(60).optional(),
  hint: shortText(300).optional(),
});

export const stepSchema = z.object({
  stepId: z.coerce.string().trim().min(1).max(20),
  title: shortText(120).pipe(z.string().min(1)),
  explanation: shortText(1200).pipe(z.string().min(1)),
  latex: z.string().trim().max(600).default(""),
  narration: shortText(1500).pipe(z.string().min(1)),
  visualInstructions: lenientVisuals.default([]),
  highlightedElements: z.preprocess(
    (v) => (Array.isArray(v) ? v.filter((h) => highlightSchema.safeParse(h).success).slice(0, 6) : []),
    z.array(highlightSchema),
  ).default([]),
  studentQuestion: z.preprocess((v) => (v && typeof v === "object" ? v : undefined), studentQuestionSchema.optional()),
});
export type SolutionStep = z.infer<typeof stepSchema>;

export const DIFFICULTIES = ["kolay", "orta", "zor"] as const;

export const solutionSchema = z.object({
  question: shortText(2000).pipe(z.string().min(1)),
  topic: shortText(80).pipe(z.string().min(1)),
  topicId: z.string().trim().max(40).optional(),
  difficulty: z.preprocess(
    (v) => (typeof v === "string" ? v.toLocaleLowerCase("tr-TR") : v),
    z.enum(DIFFICULTIES).catch("orta"),
  ),
  givenInformation: z.array(shortText(300)).max(12).default([]),
  requestedInformation: shortText(400).pipe(z.string().min(1)),
  solutionStrategy: shortText(800).pipe(z.string().min(1)),
  steps: z.array(stepSchema).min(1).max(14),
  finalAnswer: z.object({
    text: shortText(300).pipe(z.string().min(1)),
    latex: z.string().trim().max(300).optional(),
    choice: z
      .preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase().slice(0, 1) : undefined), z.enum(["A", "B", "C", "D", "E"]).optional()),
    narration: shortText(600).optional(),
  }),
  verification: z.object({
    method: shortText(400).pipe(z.string().min(1)),
    latex: z.string().trim().max(400).optional(),
    isVerified: z.boolean(),
  }),
  commonMistakes: z.array(shortText(300)).max(6).default([]),
  similarQuestion: z.object({
    text: shortText(600).pipe(z.string().min(1)),
    answer: shortText(120).optional(),
  }),
  choices: z
    .array(z.object({ key: z.string().trim().max(2), text: shortText(200) }))
    .max(6)
    .optional(),
  /** YZ'nin emin olmadığı noktalar — öğrenciye dürüstçe gösterilir. */
  uncertainty: shortText(400).optional(),
});
export type Solution = z.infer<typeof solutionSchema>;

/* ───────────────────────────── Çözüm yanıt zarfı ───────────────────────────── */

/** YZ'nin ilk kararı: soru çözülebilir mi? */
export const solveEnvelopeSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), solution: solutionSchema }),
  z.object({ status: z.literal("unreadable"), message: shortText(400).pipe(z.string().min(1)) }),
  z.object({ status: z.literal("not_math"), message: shortText(400).pipe(z.string().min(1)) }),
]);
export type SolveEnvelope = z.infer<typeof solveEnvelopeSchema>;

export const LEARNING_MODES = ["full", "hint", "together", "exam"] as const;
export type LearningMode = (typeof LEARNING_MODES)[number];

export type SolutionSource = "ai" | "demo";

export interface VerificationIssue {
  stepId: string;
  kind: "arithmetic" | "substitution";
  message: string;
}

export interface SolveResult {
  ok: true;
  source: SolutionSource;
  provider: string;
  solution: Solution;
  issues: VerificationIssue[];
  /** Demo modunda neden demo kullanıldığı vb. bilgi */
  notice?: string;
}

export interface SolveFailure {
  ok: false;
  code: "UNREADABLE" | "NOT_MATH" | "DEMO_UNSUPPORTED" | "RATE_LIMITED" | "DAILY_LIMIT" | "BAD_INPUT" | "AI_ERROR" | "INVALID_AI_OUTPUT";
  message: string;
  source?: SolutionSource;
}

/* ───────────────────────────── Özel ders yanıtı ───────────────────────────── */

export const TUTOR_ACTIONS = [
  "dont_understand",
  "simpler",
  "why",
  "other_method",
  "example",
  "hint",
  "explain_topic",
  "free_question",
] as const;
export type TutorAction = (typeof TUTOR_ACTIONS)[number];

export const tutorReplySchema = z.object({
  message: shortText(2000).pipe(z.string().min(1)),
  narration: shortText(2000).pipe(z.string().min(1)),
  steps: z.array(stepSchema).max(8).default([]),
});
export type TutorReply = z.infer<typeof tutorReplySchema>;

export const checkReplySchema = z.object({
  correct: z.boolean(),
  feedback: shortText(800).pipe(z.string().min(1)),
  narration: shortText(800).pipe(z.string().min(1)),
  mistakeReason: shortText(400).optional(),
});
export type CheckReply = z.infer<typeof checkReplySchema>;

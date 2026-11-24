import { z } from "zod";
import { LEARNING_MODES, solutionSchema, TUTOR_ACTIONS } from "./solution";

/** API istek gövdeleri (sunucuda doğrulanır). */

export const solveRequestSchema = z
  .object({
    text: z.string().max(2000, "Soru metni en fazla 2000 karakter olabilir.").optional(),
    image: z.string().max(14_000_000, "Görsel çok büyük.").optional(),
    mode: z.enum(LEARNING_MODES).default("full"),
  })
  .refine((v) => (v.text && v.text.trim().length > 0) || !!v.image, { message: "Lütfen bir soru yaz veya fotoğraf yükle." });
export type SolveRequest = z.input<typeof solveRequestSchema>;

export const tutorRequestSchema = z.object({
  solution: solutionSchema,
  stepIndex: z.number().int().min(0).max(30),
  action: z.enum(TUTOR_ACTIONS),
  message: z.string().max(1000, "Mesaj en fazla 1000 karakter olabilir.").optional(),
  history: z
    .array(z.object({ role: z.enum(["student", "teacher"]), text: z.string().max(2000) }))
    .max(20)
    .default([]),
});
export type TutorRequest = z.input<typeof tutorRequestSchema>;

export const checkRequestSchema = z.object({
  question: z.string().min(1).max(2000),
  prompt: z.string().min(1).max(600),
  expected: z.string().max(200).optional(),
  studentAnswer: z.string().trim().min(1, "Lütfen bir cevap yaz.").max(300),
});
export type CheckRequest = z.input<typeof checkRequestSchema>;

export const practiceRequestSchema = z.object({
  topicId: z.string().min(1).max(40),
  difficulty: z.enum(["kolay", "orta", "zor"]).default("orta"),
  basedOn: z.string().max(1000).optional(),
});
export type PracticeRequest = z.input<typeof practiceRequestSchema>;

export const ttsRequestSchema = z.object({
  text: z.string().trim().min(1).max(800),
  voice: z.enum(["female", "male"]).default("female"),
});

export interface StatusResponse {
  mode: "ai" | "demo";
  provider: string;
  serverTts: boolean;
  dailyLimitPerClient: number;
  maxImageMb: number;
}

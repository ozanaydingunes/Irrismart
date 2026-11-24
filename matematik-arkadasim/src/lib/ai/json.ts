import type { z } from "zod";

/**
 * Model çıktısından JSON nesnesini güvenle çıkarır: ```json çitlerini, öncesindeki/sonrasındaki
 * açıklama metnini temizler; ilk dengeli { … } bloğunu bulur.
 */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  if (start < 0) throw new Error("Yanıtta JSON bulunamadı.");
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return JSON.parse(candidate.slice(start, i + 1));
    }
  }
  throw new Error("JSON yanıtı yarıda kesilmiş.");
}

export function formatZodIssues(error: z.ZodError, max = 8): string {
  return error.issues
    .slice(0, max)
    .map((i) => `- ${i.path.join(".") || "(kök)"}: ${i.message}`)
    .join("\n");
}

export type ParseOutcome<T> = { ok: true; data: T } | { ok: false; error: string };

export function parseWithSchema<T>(text: string, schema: z.ZodType<T>): ParseOutcome<T> {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "JSON ayrıştırılamadı." };
  }
  const r = schema.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, error: formatZodIssues(r.error) };
}

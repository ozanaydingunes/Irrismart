import { practice } from "@/lib/ai/service";
import { practiceRequestSchema } from "@/lib/schema/api";
import { getConfig } from "@/lib/server/config";
import { guardedJsonRoute } from "@/lib/server/handler";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Hobby üst sınırı (ücretsiz yedek sağlayıcıya geçiş için süre)

export async function POST(req: Request) {
  const cfg = getConfig();
  return guardedJsonRoute(req, {
    schema: practiceRequestSchema,
    maxBodyBytes: 10_000,
    countsTowardQuota: () => cfg.provider !== "demo",
    handle: async (input) => ({ ...(await practice(input)) }),
  });
}

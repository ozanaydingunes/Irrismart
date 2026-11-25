import { practice } from "@/lib/ai/service";
import { practiceRequestSchema } from "@/lib/schema/api";
import { getConfig } from "@/lib/server/config";
import { guardedJsonRoute } from "@/lib/server/handler";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const cfg = getConfig();
  return guardedJsonRoute(req, {
    schema: practiceRequestSchema,
    maxBodyBytes: 10_000,
    countsTowardQuota: () => cfg.provider !== "demo",
    countsAsQuestion: () => true,
    handle: async (input) => ({ ...(await practice(input)) }),
  });
}

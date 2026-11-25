import { tutor } from "@/lib/ai/service";
import { tutorRequestSchema } from "@/lib/schema/api";
import { getConfig } from "@/lib/server/config";
import { guardedJsonRoute } from "@/lib/server/handler";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const cfg = getConfig();
  return guardedJsonRoute(req, {
    schema: tutorRequestSchema,
    maxBodyBytes: 200_000,
    countsTowardQuota: () => cfg.provider !== "demo",
    handle: async (input) => ({ ...(await tutor(input)) }),
  });
}

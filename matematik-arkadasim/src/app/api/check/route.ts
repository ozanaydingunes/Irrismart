import { checkAnswer } from "@/lib/ai/service";
import { answersEquivalent } from "@/lib/math/answer";
import { checkRequestSchema } from "@/lib/schema/api";
import { getConfig } from "@/lib/server/config";
import { guardedJsonRoute } from "@/lib/server/handler";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const cfg = getConfig();
  return guardedJsonRoute(req, {
    schema: checkRequestSchema,
    maxBodyBytes: 20_000,
    // Yerel kontrolle karar verilebiliyorsa YZ kotası harcanmaz
    countsTowardQuota: (i) => cfg.provider !== "demo" && !(i.expected && answersEquivalent(i.studentAnswer, i.expected) !== null),
    handle: async (input) => ({ ...(await checkAnswer(input)) }),
  });
}

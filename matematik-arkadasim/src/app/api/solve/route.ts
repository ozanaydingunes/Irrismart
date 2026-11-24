import { solveQuestion } from "@/lib/ai/service";
import { solveRequestSchema } from "@/lib/schema/api";
import { getConfig } from "@/lib/server/config";
import { guardedJsonRoute, jsonError } from "@/lib/server/handler";
import { parseImageDataUrl } from "@/lib/server/image";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const cfg = getConfig();
  return guardedJsonRoute(req, {
    schema: solveRequestSchema,
    maxBodyBytes: Math.ceil(cfg.limits.maxImageBytes * 1.4) + 20_000,
    countsTowardQuota: () => cfg.provider !== "demo",
    handle: async (input) => {
      let image;
      if (input.image) {
        const check = parseImageDataUrl(input.image, cfg.limits.maxImageBytes);
        if (!check.ok) return jsonError(400, "BAD_INPUT", check.message);
        image = check.image;
      }
      // Görsel yalnızca bu istek süresince bellekte tutulur; diske/kalıcı depoya yazılmaz.
      const result = await solveQuestion({ text: input.text, image, mode: input.mode });
      return { ...result };
    },
  });
}

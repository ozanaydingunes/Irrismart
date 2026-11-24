import { NextResponse } from "next/server";
import { getProvider } from "@/lib/ai/service";
import type { StatusResponse } from "@/lib/schema/api";
import { getConfig } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Arayüzün demo/gerçek modu göstermesi için. Anahtar veya gizli bilgi döndürmez. */
export async function GET() {
  const cfg = getConfig();
  const provider = getProvider(cfg);
  const body: StatusResponse = {
    mode: provider ? "ai" : "demo",
    provider: provider ? provider.name : "Demo (yapay zekâ bağlı değil)",
    serverTts: cfg.tts.provider !== "none",
    dailyLimitPerClient: cfg.limits.dailyPerClient,
    maxImageMb: Math.round(cfg.limits.maxImageBytes / 1048576),
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}

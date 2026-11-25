import { NextResponse } from "next/server";
import { OllamaProvider } from "@/lib/ai/ollama";
import { getProvider } from "@/lib/ai/service";
import type { StatusResponse } from "@/lib/schema/api";
import { getConfig } from "@/lib/server/config";
import { identify } from "@/lib/server/handler";
import { dailyQuestionLimit, questionsUsedToday } from "@/lib/server/quota";
import { getStore } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Arayüz için durum: mod, yerel model durumu, günlük soru hakkı, PIN. Anahtar veya gizli bilgi döndürmez. */
export async function GET(req: Request) {
  const cfg = getConfig();
  const provider = getProvider(cfg);
  const id = identify(req);
  const store = getStore();
  const [used, limit] = await Promise.all([questionsUsedToday(store).catch(() => 0), dailyQuestionLimit(store, cfg.limits.dailyQuestions).catch(() => cfg.limits.dailyQuestions)]);
  let localModel: StatusResponse["localModel"];
  if (provider instanceof OllamaProvider) localModel = { ...(await provider.health()), model: cfg.ollama.model };
  const body: StatusResponse = {
    mode: provider ? "ai" : "demo",
    provider: provider ? provider.name : "Demo (yapay zekâ bağlı değil)",
    providerKind: provider ? cfg.provider : "demo",
    paidAllowed: cfg.paidAllowed,
    localModel,
    serverTts: cfg.tts.provider !== "none",
    dailyLimitPerClient: cfg.limits.dailyPerClient,
    maxImageMb: Math.round((cfg.limits.maxImageBytes / 1048576) * 10) / 10,
    accessRequired: !!cfg.access.pin,
    authenticated: id.authenticated,
    questionsUsedToday: used,
    dailyQuestionLimit: limit,
    parentPinSet: !!cfg.access.parentPin,
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}

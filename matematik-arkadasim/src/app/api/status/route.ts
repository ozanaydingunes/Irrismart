import { NextResponse } from "next/server";
import { freeStates } from "@/lib/ai/freeChain";
import { OllamaProvider } from "@/lib/ai/ollama";
import { aiQueue } from "@/lib/ai/queue";
import { freeEntries, getProvider, modelCredit } from "@/lib/ai/service";
import type { StatusResponse } from "@/lib/schema/api";
import { getConfig } from "@/lib/server/config";
import { deploymentProblem, identify } from "@/lib/server/handler";
import { getStore } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Arayüz için durum: mod, ücretsiz kapasite durumu, yerel model durumu, PIN. Anahtar veya gizli bilgi döndürmez. */
export async function GET(req: Request) {
  const cfg = getConfig();
  const provider = getProvider(cfg);
  const id = identify(req);
  let localModel: StatusResponse["localModel"];
  if (provider instanceof OllamaProvider) localModel = { ...(await provider.health()), model: cfg.ollama.model };
  const freeAi = await freeStates(getStore(), freeEntries(cfg)).catch(() => []);
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
    freeAi,
    setupProblem: provider ? deploymentProblem() : null,
    modelCredit: provider ? modelCredit(cfg) : null,
    aiBusy: aiQueue().busy,
    syncAvailable: cfg.store.useFile,
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}

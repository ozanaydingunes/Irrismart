import { NextResponse } from "next/server";
import { z } from "zod";
import { guardedJsonRoute, identify, jsonError } from "@/lib/server/handler";
import { getSyncStore, SYNC_KINDS } from "@/lib/server/syncStore";

export const runtime = "nodejs";

const recordSchema = z.object({
  kind: z.enum(SYNC_KINDS),
  id: z.string().min(1).max(120),
  updatedAt: z.number().int().nonnegative(),
  deleted: z.boolean().optional(),
  // Kayıt içeriği (ör. defter girdisi). Fotoğraf alanı sunucuda silinir.
  data: z.record(z.string(), z.unknown()).optional(),
});

const syncSchema = z.object({
  sinceRev: z.number().int().nonnegative(),
  push: z.array(recordSchema).max(500, "Tek seferde en fazla 500 kayıt gönderilebilir.").default([]),
});

/**
 * Cihazlar arası eşitleme (yalnızca ev sunucusunda). Aile PIN'i gerekir. Yapay zekâ kotasını kullanmaz.
 * İstemci: değişen kayıtlarını gönderir, sinceRev'den sonraki aile kayıtlarını alır.
 */
export async function POST(req: Request) {
  const store = getSyncStore();
  if (!store) return jsonError(501, "SYNC_UNAVAILABLE", "Cihazlar arası eşitleme bu kurulumda kullanılamıyor.");
  return guardedJsonRoute(req, {
    schema: syncSchema,
    maxBodyBytes: 6_000_000,
    countsTowardQuota: () => false,
    handle: async (input) => {
      for (const r of input.push) {
        if (r.data && JSON.stringify(r.data).length > 400_000) return jsonError(413, "BAD_INPUT", "Bir kayıt çok büyük.");
      }
      const changed = await store.push(input.push);
      const pulled = store.pull(input.sinceRev);
      return { ok: true, changed, ...pulled };
    },
  });
}

/** "Tüm verilerimi sil": ev sunucusundaki aile kopyasını da siler. Aile PIN'i gerekir. */
export async function DELETE(req: Request) {
  const store = getSyncStore();
  if (!store) return jsonError(501, "SYNC_UNAVAILABLE", "Cihazlar arası eşitleme bu kurulumda kullanılamıyor.");
  if (!identify(req).authenticated) return jsonError(401, "AUTH_REQUIRED", "Devam etmek için aile PIN'ini girmen gerekiyor.");
  await store.wipe();
  return NextResponse.json({ ok: true, rev: store.rev });
}

/**
 * Yüklenen görselin güvenlik kontrolü: veri URL biçimi, izin verilen tür, sihirli baytlar ve boyut.
 */

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export interface ParsedImage {
  mediaType: AllowedImageType;
  base64: string;
  bytes: number;
}

export type ImageCheck = { ok: true; image: ParsedImage } | { ok: false; message: string };

function sniff(bytes: Uint8Array): AllowedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}

export function parseImageDataUrl(dataUrl: string, maxBytes: number): ImageCheck {
  const m = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!m) return { ok: false, message: "Görsel biçimi anlaşılamadı. Lütfen JPG, PNG veya WEBP yükle." };
  const declared = m[1];
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(declared)) {
    return { ok: false, message: "Bu dosya türü desteklenmiyor. Lütfen JPG, PNG veya WEBP yükle." };
  }
  const base64 = m[2].replace(/\s+/g, "");
  const bytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  if (bytes > maxBytes) {
    return { ok: false, message: `Görsel çok büyük (${(bytes / 1048576).toFixed(1)} MB). En fazla ${(maxBytes / 1048576).toFixed(0)} MB olabilir.` };
  }
  const head = Uint8Array.from(Buffer.from(base64.slice(0, 32), "base64"));
  const real = sniff(head);
  if (!real) return { ok: false, message: "Dosya içeriği geçerli bir görsel değil." };
  return { ok: true, image: { mediaType: real, base64, bytes } };
}

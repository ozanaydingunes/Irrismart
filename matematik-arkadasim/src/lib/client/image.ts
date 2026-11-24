"use client";

/**
 * Görsel işleme (tarayıcıda): türü/boyutu kontrol, döndürme, kırpma ve sıkıştırma.
 * Sunucuya yalnızca küçültülmüş JPEG gönderilir.
 */

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024;
export const MAX_DIMENSION = 1600;

export interface CropRect {
  /** 0–1 arası oranlar (döndürülmüş görsele göre) */
  x: number;
  y: number;
  w: number;
  h: number;
}

export function validateFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Lütfen bir görsel dosyası seç (JPG, PNG veya WEBP).";
  if (!ACCEPTED_TYPES.includes(file.type)) return "Bu görsel türü desteklenmiyor. Lütfen JPG, PNG veya WEBP kullan.";
  if (file.size > MAX_ORIGINAL_BYTES) return "Fotoğraf çok büyük (en fazla 15 MB). Daha küçük bir fotoğraf dene.";
  return null;
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Görsel açılamadı. Fotoğraf bozuk olabilir ya da bu tarayıcı bu biçimi (ör. HEIC) desteklemiyor olabilir."));
    };
    img.src = url;
  });
}

/** Görseli döndürüp kırpar, en uzun kenarı MAX_DIMENSION olacak şekilde küçültür ve JPEG veri URL'si döndürür. */
export function processImage(img: HTMLImageElement, rotation: 0 | 90 | 180 | 270, crop: CropRect, quality = 0.82): string {
  const rw = rotation % 180 === 0 ? img.naturalWidth : img.naturalHeight;
  const rh = rotation % 180 === 0 ? img.naturalHeight : img.naturalWidth;
  // 1) döndürülmüş tam görsel
  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = rw;
  rotCanvas.height = rh;
  const rc = rotCanvas.getContext("2d")!;
  rc.translate(rw / 2, rh / 2);
  rc.rotate((rotation * Math.PI) / 180);
  rc.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  // 2) kırp + küçült
  const sx = Math.round(crop.x * rw);
  const sy = Math.round(crop.y * rh);
  const sw = Math.max(1, Math.round(crop.w * rw));
  const sh = Math.max(1, Math.round(crop.h * rh));
  const scale = Math.min(1, MAX_DIMENSION / Math.max(sw, sh));
  const out = document.createElement("canvas");
  out.width = Math.round(sw * scale);
  out.height = Math.round(sh * scale);
  const oc = out.getContext("2d")!;
  oc.fillStyle = "#ffffff";
  oc.fillRect(0, 0, out.width, out.height);
  oc.imageSmoothingQuality = "high";
  oc.drawImage(rotCanvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
  let url = out.toDataURL("image/jpeg", quality);
  // 3) hâlâ büyükse kaliteyi düşür (~1,5 MB hedef)
  let q = quality;
  while (url.length * 0.75 > 1.5 * 1024 * 1024 && q > 0.45) {
    q -= 0.1;
    url = out.toDataURL("image/jpeg", q);
  }
  return url;
}

export function dataUrlBytes(url: string) {
  const b64 = url.split(",")[1] ?? "";
  return Math.floor((b64.length * 3) / 4);
}

/**
 * İstemci IP'si. Vercel'de x-vercel-forwarded-for / x-real-ip platform tarafından yazılır
 * (istemci taklit edemez); diğer ortamlarda x-forwarded-for'un ilk değeri kullanılır.
 * IP yalnızca özetlenmiş (hash) olarak sayaç anahtarında kullanılır, saklanmaz.
 */
export function clientKey(headers: Headers): string {
  const pick = (h: string) => headers.get(h)?.split(",")[0]?.trim();
  return pick("x-vercel-forwarded-for") || pick("x-real-ip") || pick("x-forwarded-for") || "local";
}

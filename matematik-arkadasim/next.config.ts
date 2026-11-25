import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const isProd = process.env.NODE_ENV === "production";

/**
 * İçerik Güvenlik Politikası: yalnızca kendi kaynaklarımız. Next.js'in satır içi önyükleme betikleri ve
 * KaTeX'in satır içi stilleri için 'unsafe-inline' gerekir; harici betik/çerçeve/eklenti yasaktır.
 * Geliştirme modunda hızlı yenileme için 'unsafe-eval' eklenir.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Kamera ve mikrofon yalnızca bu uygulamanın kendi sayfalarında, kullanıcı izniyle kullanılabilir.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Depo kökünde başka bir proje (IrriGrow) olduğu için kök klasörü açıkça belirt
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;

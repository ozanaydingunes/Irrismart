import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "katex/dist/katex.min.css";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ServiceWorkerRegister } from "@/components/layout/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: { default: "Matematik Arkadaşım", template: "%s · Matematik Arkadaşım" },
  description: "7. sınıf öğrencileri için yapay zekâ destekli, akıllı tahtalı ve sesli kişisel matematik öğretmeni.",
  applicationName: "Matematik Arkadaşım",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Mat. Arkadaşım", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f6ff",
};

/** Tema, sayfa çizilmeden önce uygulanır (yanıp sönmeyi önler). Statik, kullanıcı girdisi içermeyen betik. */
const THEME_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem("matematik-arkadasim:settings")||"{}");var t=s.theme||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        <AppShell>{children}</AppShell>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

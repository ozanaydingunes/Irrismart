import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Matematik Arkadaşım",
    short_name: "Mat. Arkadaşım",
    description: "7. sınıf öğrencileri için yapay zekâ destekli, akıllı tahtalı ve sesli matematik öğretmeni.",
    lang: "tr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f7f6ff",
    theme_color: "#7a72ef",
    categories: ["education", "kids"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Soru Çöz", url: "/coz", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Soru Defterim", url: "/defter", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

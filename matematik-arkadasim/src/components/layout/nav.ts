import { BarChart3, BookMarked, Camera, Home, Layers, Settings } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Ana Sayfa", short: "Ana Sayfa", icon: Home },
  { href: "/coz", label: "Soru Çöz", short: "Soru Çöz", icon: Camera },
  { href: "/konular", label: "Konular", short: "Konular", icon: Layers },
  { href: "/defter", label: "Soru Defterim", short: "Defterim", icon: BookMarked },
  { href: "/gelisim", label: "Gelişimim", short: "Gelişimim", icon: BarChart3 },
  { href: "/ayarlar", label: "Ayarlar", short: "Ayarlar", icon: Settings },
] as const;

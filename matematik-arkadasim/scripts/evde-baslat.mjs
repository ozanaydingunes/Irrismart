// Pi Hoca'yı evdeki Windows (veya Mac/Linux) bilgisayarda başlatır.
//   npm run evde-baslat          → ÖNERİLEN: yalnızca bu bilgisayar içinden (127.0.0.1) dinler;
//                                   telefon/tabletler Tailscale'in güvenli HTTPS adresiyle bağlanır.
//                                   Güvenlik duvarında bir şey açmak gerekmez.
//   npm run evde-baslat -- --wifi → yalnızca ev Wi-Fi'ında düz http ile (mikrofon ve "ana ekrana ekle" kısıtlı).
// Ollama her iki durumda da yalnızca bu bilgisayarda (127.0.0.1:11434) kalır; internete açılmaz.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

const PORT = process.env.PORT || "3000";
const WIFI = process.argv.includes("--wifi");
const isWin = process.platform === "win32";

if (!existsSync(".env.local")) {
  console.log("Önce ayarları oluşturun:  npm run kurulum");
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const base = env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const model = env.OLLAMA_MODEL || "gemma3:4b";

try {
  const r = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3000) });
  const j = await r.json();
  const names = (j.models ?? []).map((m) => m.name);
  if (!names.some((n) => n === model || n === `${model}:latest`)) console.log(`⚠  Ollama çalışıyor ama "${model}" modeli indirilmemiş. Şunu çalıştırın:  ollama pull ${model}`);
  else console.log(`✓ Ollama çalışıyor, model hazır: ${model}`);
} catch {
  console.log("⚠  Ollama'ya ulaşılamadı. Ollama uygulamasını açın (Windows'ta saat yanındaki simgesi görünmeli) ve tekrar deneyin.");
}

if (!existsSync(".next/BUILD_ID")) {
  console.log("\nİlk çalıştırma: uygulama hazırlanıyor (birkaç dakika sürebilir)…");
  const b = spawnSync("npx", ["next", "build"], { stdio: "inherit", shell: isWin });
  if (b.status !== 0) process.exit(b.status ?? 1);
}

console.log("\n=========================================================");
if (WIFI) {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal && !i.address.startsWith("100."))
    .map((i) => i.address);
  console.log(" Pi Hoca hazır (yalnızca ev Wi-Fi'ı). Telefon/tablette açın:");
  for (const ip of ips) console.log(`   http://${ip}:${PORT}`);
  console.log(" Not: Bu modda mikrofon ve 'ana ekrana ekle' tam çalışmayabilir.");
  console.log(" Windows güvenlik duvarı sorarsa YALNIZCA 'Özel ağlar' için izin verin.");
} else {
  let url = "";
  const st = spawnSync("tailscale", ["serve", "status"], { encoding: "utf8", shell: isWin });
  const m = /(https:\/\/[a-z0-9.-]+\.ts\.net)/i.exec(`${st.stdout ?? ""}`);
  if (m) url = m[1];
  if (url) {
    console.log(" Pi Hoca hazır! Telefon ve tabletlerde (Tailscale açıkken) açın:");
    console.log(`   ${url}`);
  } else if (st.error || st.status === null) {
    console.log(" Tailscale bulunamadı. Kurulum rehberindeki 'Tailscale' bölümünü yapın,");
    console.log(" ya da yalnızca ev Wi-Fi'ı için:  npm run evde-baslat -- --wifi");
  } else {
    console.log(" Tailscale kurulu ama paylaşım açık değil. BİR KEZ şunu çalıştırın:");
    console.log(`   tailscale serve --bg ${PORT}`);
    console.log(" (Bilgisayar yeniden başlasa da paylaşım kendiliğinden devam eder.)");
  }
}
console.log(" Bu bilgisayarda:  http://localhost:" + PORT);
console.log(" Kapatmak için bu pencerede Ctrl + C");
console.log("=========================================================\n");
spawn("npx", ["next", "start", "-H", WIFI ? "0.0.0.0" : "127.0.0.1", "-p", PORT], { stdio: "inherit", shell: isWin });

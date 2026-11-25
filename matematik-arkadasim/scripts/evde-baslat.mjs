// Uygulamayı ev ağında başlatır ve telefona yazılacak adresi gösterir.
// Kullanım: npm run evde-baslat
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

const PORT = process.env.PORT || "3000";
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
const model = env.OLLAMA_MODEL || "gemma4:e4b";

try {
  const r = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3000) });
  const j = await r.json();
  const names = (j.models ?? []).map((m) => m.name);
  if (!names.some((n) => n === model || n === `${model}:latest`)) {
    console.log(`⚠  Ollama çalışıyor ama "${model}" modeli indirilmemiş. Şunu çalıştırın:  ollama pull ${model}`);
  } else console.log(`✓ Ollama çalışıyor, model hazır: ${model}`);
} catch {
  console.log("⚠  Ollama'ya ulaşılamadı. Ollama uygulamasını açın (Windows/Mac'te simgesi saat yanında görünür) ve tekrar deneyin.");
}

if (!existsSync(".next/BUILD_ID")) {
  console.log("\nİlk çalıştırma: uygulama hazırlanıyor (birkaç dakika sürebilir)…");
  const b = spawnSync("npx", ["next", "build"], { stdio: "inherit", shell: process.platform === "win32" });
  if (b.status !== 0) process.exit(b.status ?? 1);
}

const ips = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => i.address);
console.log("\n=========================================================");
console.log(" Pi Hoca hazır! Kızınızın telefonunda (aynı Wi-Fi'da) açın:");
for (const ip of ips) console.log(`   http://${ip}:${PORT}`);
console.log(" Bu bilgisayarda:  http://localhost:" + PORT);
console.log(" Kapatmak için bu pencerede Ctrl + C");
console.log("=========================================================\n");
spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", PORT], { stdio: "inherit", shell: process.platform === "win32" });

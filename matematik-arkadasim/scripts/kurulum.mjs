// Ücretsiz ev kurulumu sihirbazı: .env.local dosyasını soru sorarak oluşturur.
// Kullanım: npm run kurulum
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";

const rl = createInterface({ input, terminal: false });
const lines = rl[Symbol.asyncIterator]();
// Hem klavyede hem yönlendirilmiş girdide güvenilir satır okuma
rl.question = async (q) => {
  output.write(q);
  const { value, done } = await lines.next();
  if (done) {
    console.log("\nGirdi bitti; kurulum tamamlanmadı.");
    process.exit(1);
  }
  return value;
};
console.log("\n=== Matematik Arkadaşım — ücretsiz kurulum ===\n");
console.log("Bu sihirbaz ayar dosyasını (.env.local) oluşturur. Hiçbir ücretli servis açılmaz.\n");

if (existsSync(".env.local")) {
  const a = (await rl.question(".env.local zaten var. Üzerine yazılsın mı? (e/h): ")).trim().toLowerCase();
  if (a !== "e") {
    console.log("Vazgeçildi; mevcut ayarlar korunuyor.");
    rl.close();
    process.exit(0);
  }
}

async function askPin(label) {
  for (;;) {
    const v = (await rl.question(label)).trim();
    if (/^\d{4,8}$/.test(v)) return v;
    console.log("  Lütfen 4–8 haneli bir sayı yazın.");
  }
}

const familyPin = await askPin("1) Kızınızın gireceği AİLE PIN'i (4–8 rakam): ");
const ram = (await rl.question("2) Bilgisayarınızın belleği (RAM) 16 GB veya daha fazla mı? (e/h): ")).trim().toLowerCase();
// 8 GB RAM: gemma3:4b (≈3,4 GB) ve küçük bağlam penceresi; 16 GB+: gemma4:e4b
const model = ram === "e" ? "gemma4:e4b" : "gemma3:4b";
const numCtx = ram === "e" ? "16384" : "8192";
rl.close();

const env = `# Matematik Arkadaşım — ücretsiz ev kurulumu (npm run kurulum ile oluşturuldu)
# Bu dosyayı kimseyle paylaşmayın; Git'e eklenmez.
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=${model}
OLLAMA_NUM_CTX=${numCtx}
# Ücretli yapay zekâ ve ücretli seslendirme KAPALI (açmayın)
ALLOW_PAID_AI=0
TTS_PROVIDER=none
APP_ACCESS_PIN=${familyPin}
APP_SESSION_SECRET=${randomBytes(32).toString("hex")}
APP_TIMEZONE=Europe/Istanbul
`;
writeFileSync(".env.local", env, { mode: 0o600 });
console.log(`\n✓ .env.local oluşturuldu (model: ${model}; soru sınırı yok).`);
console.log(`\nSıradaki adım: model indirilmediyse  ollama pull ${model}`);
console.log("Ardından:  npm run evde-baslat\n");

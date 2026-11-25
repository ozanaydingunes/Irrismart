// Belgeler için yüksek çözünürlüklü mobil ekran görüntüleri (demo modunda). Önce `npm run build`.
// Çıktı: docs/ekran-goruntuleri/
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const OUT = fileURLToPath(new URL("../docs/ekran-goruntuleri/", import.meta.url));
mkdirSync(OUT, { recursive: true });
const PORT = 3219;
const srv = spawn("npx", ["next", "start", "-p", String(PORT)], {
  cwd: root,
  env: { ...process.env, AI_PROVIDER: "demo", ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "", COUNTER_STORE: "memory" },
  stdio: "ignore",
  detached: true,
});
const base = `http://localhost:${PORT}`;
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`${base}/api/status`)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
const browser = await chromium.launch();
const shots = [
  { file: "ana-sayfa-390x844.png", w: 390, h: 844, path: "/" },
  { file: "ana-sayfa-320x568.png", w: 320, h: 568, path: "/" },
  { file: "sesli-ders-390x844.png", w: 390, h: 844, path: "/coz?q=" + encodeURIComponent("3/4 + 1/6") + "&mode=full", step: 1 },
  { file: "sesli-ders-320x568.png", w: 320, h: 568, path: "/coz?q=" + encodeURIComponent("2x + 5 = 15") + "&mode=full", step: 0 },
  { file: "sesli-ders-koyu-390x844.png", w: 390, h: 844, path: "/coz?q=" + encodeURIComponent("2x + 5 = 15") + "&mode=full", step: 1, dark: true },
];
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "tr-TR", colorScheme: s.dark ? "dark" : "light" });
  const p = await ctx.newPage();
  await p.goto(base + s.path);
  if (s.step !== undefined) {
    await p.locator('section[aria-label="Akıllı tahta"] .katex').first().waitFor();
    for (let i = 0; i < s.step; i++) await p.getByRole("button", { name: "Sonraki adım", exact: true }).click();
    await p.waitForTimeout(2200); // yazma/çizim animasyonları bitsin (anlatım sürüyor)
  } else await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + s.file });
  console.log("✓", s.file);
  await ctx.close();
}
await browser.close();
try {
  process.kill(-srv.pid, "SIGTERM");
} catch {
  srv.kill();
}

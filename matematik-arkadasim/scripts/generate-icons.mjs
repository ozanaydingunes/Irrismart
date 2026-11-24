// Uygulama ikonlarını SVG kaynağından PNG olarak üretir (Playwright/Chromium ile).
// Kullanım: npm run icons
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../public/icons/", import.meta.url));
const svg = readFileSync(dir + "icon.svg", "utf8");

const targets = [
  { file: "icon-192.png", size: 192, pad: 0, bg: "transparent" },
  { file: "icon-512.png", size: 512, pad: 0, bg: "transparent" },
  { file: "maskable-512.png", size: 512, pad: 0.12, bg: "#7a72ef" },
  { file: "apple-touch-icon.png", size: 180, pad: 0.06, bg: "#7a72ef" },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.pad * 2));
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:${t.bg};display:flex;align-items:center;justify-content:center;width:${t.size}px;height:${t.size}px">` +
      svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `) +
      `</body></html>`,
  );
  await page.screenshot({ path: dir + t.file, omitBackground: t.bg === "transparent" });
  console.log("✓", t.file);
}
await browser.close();

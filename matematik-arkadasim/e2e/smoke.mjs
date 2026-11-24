// Uçtan uca duman testi (Playwright). Önce `npm run build` çalıştırılmalıdır.
// Kullanım: npm run test:e2e   (BASE_URL verilirse sunucu başlatılmaz)
// Ekran görüntüleri: e2e/screens/
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const OUT = fileURLToPath(new URL("./screens", import.meta.url));
mkdirSync(OUT, { recursive: true });
const PORT = 3217;
let base = process.env.BASE_URL;
let server;

if (!base) {
  base = `http://localhost:${PORT}`;
  // Testler her zaman demo modunda çalışır (gerçek API anahtarı kullanılmaz)
  server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: root,
    env: { ...process.env, AI_PROVIDER: "demo", ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "" },
    stdio: "ignore",
    detached: true, // süreç grubu: next-server alt süreciyle birlikte kapatılır
  });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${base}/api/status`);
      if (r.ok) break;
    } catch {
      /* bekle */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

const browser = await chromium.launch();
const results = [];
const consoleErrors = [];

async function test(name, ctxOpts, fn) {
  const ctx = await browser.newContext({ locale: "tr-TR", ...ctxOpts });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[${name}] ${m.text()}`));
  page.on("pageerror", (e) => consoleErrors.push(`[${name}] pageerror: ${e.message}`));
  try {
    await fn(page);
    results.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log(`✗ ${name}\n   ${e.message.split("\n")[0]}`);
    await page.screenshot({ path: `${OUT}/HATA-${name.replace(/\W+/g, "_")}.png`, fullPage: true }).catch(() => {});
  }
  await ctx.close();
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const desktop = { viewport: { width: 1280, height: 900 } };

await test("Tüm sayfalar açılıyor ve Türkçe başlıklar görünüyor", desktop, async (p) => {
  for (const [path, heading] of [
    ["/", "Matematik Arkadaşın burada."],
    ["/coz", "Soru Çöz"],
    ["/konular", "Konular"],
    ["/defter", "Soru Defterim"],
    ["/gelisim", "Gelişimim"],
    ["/ayarlar", "Ayarlar"],
  ]) {
    await p.goto(base + path);
    await p.getByRole("heading", { name: heading, exact: true }).first().waitFor({ timeout: 10000 });
  }
  await p.goto(base + "/");
  await p.screenshot({ path: `${OUT}/ana-sayfa-masaustu.png`, fullPage: true });
});

await test("Demo modu açıkça etiketleniyor", desktop, async (p) => {
  await p.goto(base + "/");
  await p.getByText("Demo modundasın").waitFor();
  await p.getByText("DEMO MODU — yapay zekâ bağlı değil").waitFor();
});

await test("Gelişim paneli veri yokken sahte istatistik göstermiyor", desktop, async (p) => {
  await p.goto(base + "/gelisim");
  await p.getByText("Henüz veri yok").waitFor();
  const text = await p.locator("main").innerText();
  expect(!/%\d+/.test(text), "Veri yokken yüzde değeri gösterilmemeli");
});

await test("Kesir sorusu: akıllı tahta adım adım, demo etiketiyle", desktop, async (p) => {
  await p.goto(base + "/coz");
  await p.getByRole("tab", { name: "Yaz" }).click();
  await p.getByLabel("Sorunu yaz").fill("3/4 + 1/6");
  await p.getByRole("button", { name: "Soruyu çöz" }).click();
  await p.getByText("Verilenler").waitFor();
  await p.getByText("DEMO — yapay zekâ çözümü değil").waitFor();
  // Tüm çözüm bir anda gösterilmez: başta yalnızca 1. adım tahtada
  const items = await p.locator('section[aria-label="Akıllı tahta"] > ol > li').count();
  expect(items === 1, `Başta tek adım görünmeli, görünen: ${items}`);
  await p.locator(".katex").first().waitFor();
  await p.screenshot({ path: `${OUT}/ders-kesir-masaustu.png`, fullPage: true });
  await p.getByRole("button", { name: "Sonraki adım", exact: true }).click();
  await p.getByText("Paydaları eşitleyelim").first().waitFor();
  await p.getByText("ortak payda", { exact: false }).first().waitFor();
  await p.locator('svg[aria-label*="kesir şeridi"]').first().waitFor();
  await p.getByText("Adım 2 / 3").waitFor();
  await p.getByRole("button", { name: "Önceki adım", exact: true }).click();
  await p.getByText("Adım 1 / 3").waitFor();
  await p.getByRole("button", { name: "Sonraki adım", exact: true }).click();
  await p.getByRole("button", { name: "Sonraki adım", exact: true }).click();
  await p.getByText("Sonuç: 11/12").first().waitFor();
  await p.getByText("Sık yapılan hatalar").waitFor();
  await p.screenshot({ path: `${OUT}/ders-sonuc-masaustu.png`, fullPage: true });
});

await test("Hız seçenekleri 0,75x–1,5x ve oynat/duraklat düğmesi var", desktop, async (p) => {
  await p.goto(base + "/coz?q=" + encodeURIComponent("2x + 5 = 15") + "&mode=hint");
  await p.getByText("Verilenler").waitFor();
  for (const r of ["0,75x", "1x", "1,25x", "1,5x"]) await p.getByRole("radio", { name: r, exact: true }).first().waitFor();
  await p.getByRole("radio", { name: "1,25x", exact: true }).first().click();
  const checked = await p.getByRole("radio", { name: "1,25x", exact: true }).first().getAttribute("aria-checked");
  expect(checked === "true", "Hız seçimi çalışmalı");
  await p.locator('button[aria-label="Anlatımı başlat"], button[aria-label="Devam et"], button[aria-label="Duraklat"]').first().waitFor();
});

await test("İpucu modu: adım önce gizli, istenince açılıyor", desktop, async (p) => {
  await p.goto(base + "/coz?q=" + encodeURIComponent("2x + 5 = 15") + "&mode=hint");
  await p.getByText("Verilenler").waitFor();
  await p.getByRole("button", { name: "Sıradaki ipucuna geç" }).click();
  await p.getByText("Önce sen dene!").waitFor();
  await p.getByRole("button", { name: "Bu adımı göster ve anlat" }).click();
  await p.locator(".katex").first().waitFor();
});

await test("Birlikte çözme: öğrenci cevabı kontrol ediliyor", desktop, async (p) => {
  await p.goto(base + "/coz?q=" + encodeURIComponent("2x + 5 = 15") + "&mode=together");
  await p.getByText("Verilenler").waitFor();
  await p.getByRole("button", { name: "Sonraki adım", exact: true }).click({ trial: true }).catch(() => {});
  // 1. adımdan sonra öğrenciye soru sorulur
  await p.getByRole("button", { name: /Anlatımı başlat|Devam et/ }).first().click();
  await p.getByText("Sıra sende!").first().waitFor({ timeout: 30000 });
  await p.getByLabel("Cevabın").fill("9");
  await p.getByRole("button", { name: "Kontrol et" }).click();
  await p.getByText("Bu sefer olmadı").waitFor();
  await p.getByLabel("Cevabın").fill("10");
  await p.getByRole("button", { name: "Kontrol et" }).click();
  await p.getByText("Harika, doğru!").waitFor();
  await p.screenshot({ path: `${OUT}/birlikte-cozme.png`, fullPage: true });
});

await test("Sınav modu: önce cevap, sonra çözüm; deftere ve gelişime işleniyor", desktop, async (p) => {
  await p.goto(base + "/coz?q=" + encodeURIComponent("240 sayısının %25'i kaçtır?") + "&mode=exam");
  await p.getByText("Önce sen çöz!").waitFor();
  await p.getByLabel("Cevabın").fill("60");
  await p.getByRole("button", { name: "Kontrol et" }).click();
  await p.getByText("Tebrikler, doğru cevap!").waitFor();
  await p.getByText("Verilenler").waitFor({ timeout: 8000 });
  await p.goto(base + "/gelisim");
  await p.getByText("Başarı oranı").waitFor();
  await p.getByText("%100").first().waitFor();
  await p.goto(base + "/defter");
  await p.getByText("240 sayısının %25'i kaçtır?").first().waitFor();
  await p.screenshot({ path: `${OUT}/defter.png`, fullPage: true });
});

await test("Özel ders: hazır düğmeler yanıt veriyor (demo)", desktop, async (p) => {
  await p.goto(base + "/coz?q=" + encodeURIComponent("2x + 5 = 15") + "&mode=full");
  await p.getByText("Verilenler").waitFor();
  for (const label of ["Anlamadım", "Daha basit anlat", "Neden böyle yaptık?", "Başka yöntemle çöz", "Örnek ver", "İpucu ver", "Önceki adıma dön", "Bu konuyu baştan anlat"]) {
    await p.getByRole("button", { name: label }).waitFor();
  }
  await p.getByRole("button", { name: "Neden böyle yaptık?" }).click();
  await p.getByText("Bunu yapmamızın nedeni").waitFor();
});

await test("Geometri örneği (mobil): SVG çizim ve çoktan seçmeli şık", { ...devices["iPhone 13"] }, async (p) => {
  await p.goto(base + "/coz?q=" + encodeURIComponent("Bir ABC üçgeninde A açısı 50°, B açısı 70°'dir. C açısı kaç derecedir? A) 50° B) 60° C) 70° D) 80°") + "&mode=full");
  await p.getByText("Verilenler").waitFor();
  await p.locator('svg[aria-label="ABC üçgeni"]').waitFor();
  await p.getByRole("navigation", { name: "Alt menü" }).waitFor();
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(!overflow, "Mobilde yatay taşma olmamalı");
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/ders-geometri-mobil.png`, fullPage: true });
});

await test("Koyu tema", { ...desktop, colorScheme: "dark" }, async (p) => {
  await p.goto(base + "/coz?q=" + encodeURIComponent("-3/4, 1/2 ve -1/3 rasyonel sayılarını küçükten büyüğe sıralayınız.") + "&mode=full");
  await p.getByText("Verilenler").waitFor();
  const dark = await p.evaluate(() => document.documentElement.classList.contains("dark"));
  expect(dark, "Sistem koyu temadayken koyu tema uygulanmalı");
  await p.getByRole("button", { name: "Sonraki adım", exact: true }).click();
  await p.getByRole("button", { name: "Sonraki adım", exact: true }).click();
  await p.locator('svg[aria-label*="sayı doğrusu"]').waitFor();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/ders-koyu-tema.png`, fullPage: true });
});

await test("Okunamayan fotoğraf demo modunda uydurulmuyor", desktop, async (p) => {
  const tinyPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const res = await p.request.post(base + "/api/solve", { data: { image: tinyPng, mode: "full" } });
  const json = await res.json();
  expect(json.ok === false && json.code === "DEMO_UNSUPPORTED", "Demo modunda görsel çözümü uydurulmamalı");
  const bad = await p.request.post(base + "/api/solve", { data: { image: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", mode: "full" } });
  expect(bad.status() === 400, "Desteklenmeyen tür 400 dönmeli");
});

await test("PWA: manifest ve service worker erişilebilir", desktop, async (p) => {
  const m = await (await p.request.get(base + "/manifest.webmanifest")).json();
  expect(m.lang === "tr" && m.icons.length >= 3 && m.display === "standalone", "Manifest eksik");
  const sw = await p.request.get(base + "/sw.js");
  expect(sw.ok(), "sw.js erişilemedi");
  await p.goto(base + "/");
  const registered = await p.evaluate(async () => {
    for (let i = 0; i < 20; i++) {
      const r = await navigator.serviceWorker.getRegistration();
      if (r) return true;
      await new Promise((res) => setTimeout(res, 250));
    }
    return false;
  });
  expect(registered, "Service worker kaydedilmeli");
});

await browser.close();
if (server) {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill();
  }
}

const failed = results.filter((r) => !r.ok);
const relevantErrors = consoleErrors.filter((e) => !/favicon|Failed to load resource: the server responded with a status of 4\d\d/.test(e));
if (relevantErrors.length) console.log("\nKonsol hataları:\n" + relevantErrors.join("\n"));
console.log(`\n${results.length - failed.length}/${results.length} senaryo geçti. Ekran görüntüleri: e2e/screens/`);
process.exit(failed.length || relevantErrors.length ? 1 : 0);

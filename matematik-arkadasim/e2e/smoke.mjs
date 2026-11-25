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
const MOCK_PORT = 3218;
const servers = [];

async function startServer(port, env) {
  const srv = spawn("npx", ["next", "start", "-p", String(port)], {
    cwd: root,
    // Gerçek API anahtarları testlere asla verilmez
    // Sayaçlar testte bellekte tutulur (proje klasöründe .data/ dosyası biriktirmesin)
    env: { ...process.env, ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "", COUNTER_STORE: "memory", ...env },
    stdio: "ignore",
    detached: true, // süreç grubu: next-server alt süreciyle birlikte kapatılır
  });
  servers.push(srv);
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${url}/api/status`)).ok) break;
    } catch {
      /* bekle */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return url;
}

// 1) Demo modu  2) Test sağlayıcısı + aile PIN'i (fotoğraf akışları ve erişim kontrolü için)
let base = process.env.BASE_URL ?? (await startServer(PORT, { AI_PROVIDER: "demo" }));
const mockBase = process.env.BASE_URL
  ? null
  : await startServer(MOCK_PORT, { AI_PROVIDER: "mock", ALLOW_MOCK_PROVIDER: "1", APP_ACCESS_PIN: "2468", APP_SESSION_SECRET: "e2e-test-gizli-anahtar-en-az-32-karakter-uzun" });

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
    ["/", "Hangi soruyu birlikte çözelim?"],
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

await test("Ana ekranda üç temel işlem öncelikli (Fotoğraf çek, Soru yükle, Soru yaz)", { ...devices["iPhone 13"] }, async (p) => {
  await p.goto(base + "/");
  for (const name of ["Fotoğraf çek", /Soru yükle/, "Soru yaz"]) await p.getByRole("button", { name }).first().waitFor();
  // Alt menü sade: 3 sayfa + Diğer
  const items = await p.getByRole("navigation", { name: "Alt menü" }).locator("li").count();
  expect(items === 4, `Alt menüde 4 öğe olmalı, var: ${items}`);
  await p.getByRole("button", { name: "Diğer sayfalar" }).click();
  await p.getByRole("link", { name: "Konular" }).waitFor();
  await p.keyboard.press("Escape");
  await p.screenshot({ path: `${OUT}/ana-sayfa-mobil.png`, fullPage: true });
  await p.getByRole("button", { name: "Soru yaz" }).click();
  await p.waitForURL(/yontem=yaz/);
  await p.getByLabel("Sorunu yaz").waitFor();
  // Küçük ekranda dokunma hedefleri en az 44 px
  const small = await p.evaluate(() =>
    [...document.querySelectorAll("main button, nav a, nav button")]
      .filter((el) => el.offsetParent !== null)
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && (r.height < 40 || r.width < 40)).length,
  );
  expect(small === 0, `${small} adet 40 px'den küçük dokunma hedefi var`);
});

await test("Güvenlik başlıkları (CSP, nosniff, çerçeve yasağı)", desktop, async (p) => {
  const r = await p.request.get(base + "/");
  const h = r.headers();
  expect(/default-src 'self'/.test(h["content-security-policy"] ?? ""), "CSP yok");
  expect(/frame-ancestors 'none'/.test(h["content-security-policy"] ?? ""), "frame-ancestors yok");
  expect(h["x-content-type-options"] === "nosniff", "nosniff yok");
});

await test("Demo modu açıkça etiketleniyor", desktop, async (p) => {
  await p.goto(base + "/");
  await p.getByText("Demo modu:").waitFor();
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
  await p.locator('section[aria-label="Akıllı tahta"]').waitFor();
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
  await p.getByText("Adım 2 / 3").waitFor({ state: "attached" });
  await p.getByRole("button", { name: "Önceki adım", exact: true }).click();
  await p.getByText("Adım 1 / 3").waitFor({ state: "attached" });
  await p.getByRole("button", { name: "Sonraki adım", exact: true }).click();
  await p.getByRole("button", { name: "Sonraki adım", exact: true }).click();
  await p.getByText("Sonuç: 11/12").first().waitFor();
  await p.getByText("Sık yapılan hatalar").waitFor();
  await p.screenshot({ path: `${OUT}/ders-sonuc-masaustu.png`, fullPage: true });
});

await test("Hız seçenekleri 0,75x–1,5x ve oynat/duraklat düğmesi var", desktop, async (p) => {
  await p.goto(base + "/coz?q=" + encodeURIComponent("2x + 5 = 15") + "&mode=hint");
  await p.locator('section[aria-label="Akıllı tahta"]').waitFor();
  for (const r of ["0,75x", "1x", "1,25x", "1,5x"]) await p.getByRole("radio", { name: r, exact: true }).first().waitFor();
  await p.getByRole("radio", { name: "1,25x", exact: true }).first().click();
  const checked = await p.getByRole("radio", { name: "1,25x", exact: true }).first().getAttribute("aria-checked");
  expect(checked === "true", "Hız seçimi çalışmalı");
  await p.locator('button[aria-label="Anlatımı başlat"], button[aria-label="Devam et"], button[aria-label="Duraklat"]').first().waitFor();
});

await test("İpucu modu: adım önce gizli, istenince açılıyor", desktop, async (p) => {
  await p.goto(base + "/coz?q=" + encodeURIComponent("2x + 5 = 15") + "&mode=hint");
  await p.locator('section[aria-label="Akıllı tahta"]').waitFor();
  await p.getByRole("button", { name: "Sıradaki ipucuna geç" }).click();
  await p.getByText("Önce sen dene!").waitFor();
  await p.getByRole("button", { name: "Bu adımı göster ve anlat" }).click();
  await p.locator(".katex").first().waitFor();
});

await test("Birlikte çözme: öğrenci cevabı kontrol ediliyor", desktop, async (p) => {
  await p.goto(base + "/coz?q=" + encodeURIComponent("2x + 5 = 15") + "&mode=together");
  await p.locator('section[aria-label="Akıllı tahta"]').waitFor();
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
  await p.locator('section[aria-label="Akıllı tahta"]').waitFor({ timeout: 8000 });
  await p.goto(base + "/gelisim");
  await p.getByText("Başarı oranı").waitFor();
  await p.getByText("%100").first().waitFor();
  await p.goto(base + "/defter");
  await p.getByText("240 sayısının %25'i kaçtır?").first().waitFor();
  await p.screenshot({ path: `${OUT}/defter.png`, fullPage: true });
});

await test("Özel ders: hazır düğmeler yanıt veriyor (demo)", desktop, async (p) => {
  await p.goto(base + "/coz?q=" + encodeURIComponent("2x + 5 = 15") + "&mode=full");
  await p.locator('section[aria-label="Akıllı tahta"]').waitFor();
  for (const label of ["Anlamadım", "Daha basit anlat", "Neden böyle yaptık?", "Başka yöntemle çöz", "Örnek ver", "İpucu ver", "Önceki adıma dön", "Bu konuyu baştan anlat"]) {
    await p.locator("#ogretmene-sor").getByRole("button", { name: label, exact: true }).waitFor();
  }
  await p.getByRole("button", { name: "Neden böyle yaptık?" }).click();
  await p.getByText("Bunu yapmamızın nedeni").waitFor();
});

await test("Geometri örneği (mobil): SVG çizim ve çoktan seçmeli şık", { ...devices["iPhone 13"] }, async (p) => {
  await p.goto(base + "/coz?q=" + encodeURIComponent("Bir ABC üçgeninde A açısı 50°, B açısı 70°'dir. C açısı kaç derecedir? A) 50° B) 60° C) 70° D) 80°") + "&mode=full");
  await p.locator('section[aria-label="Akıllı tahta"]').waitFor();
  await p.locator('svg[aria-label="ABC üçgeni"]').waitFor();
  await p.getByRole("navigation", { name: "Alt menü" }).waitFor();
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(!overflow, "Mobilde yatay taşma olmamalı");
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/ders-geometri-mobil.png`, fullPage: true });
});

await test("Koyu tema", { ...desktop, colorScheme: "dark" }, async (p) => {
  await p.goto(base + "/coz?q=" + encodeURIComponent("-3/4, 1/2 ve -1/3 rasyonel sayılarını küçükten büyüğe sıralayınız.") + "&mode=full");
  await p.locator('section[aria-label="Akıllı tahta"]').waitFor();
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

await test("Duraklatılmışken adım değiştirilince formül ve çizim görünür hâle gelir", desktop, async (p) => {
  await p.goto(base + "/coz?q=" + encodeURIComponent("3/4 + 1/6") + "&mode=full");
  await p.locator('section[aria-label="Akıllı tahta"] .katex').first().waitFor();
  await p.getByRole("button", { name: "Duraklat" }).click().catch(() => {});
  await p.getByRole("button", { name: "Sonraki adım", exact: true }).click();
  await p.waitForTimeout(2500);
  const hidden = await p.evaluate(() => {
    const cur = document.querySelector('li[aria-current="step"]');
    const els = [...cur.querySelectorAll(".katex-host, figure")];
    if (!els.length) return "öğe yok";
    // Görünürlük: opaklık ve kırpma (clip-path) animasyon sonunda tam olmalı
    const bad = els.filter((el) => {
      const cs = getComputedStyle(el);
      const clipped = cs.clipPath && cs.clipPath !== "none" && (cs.clipPath.match(/-?[\d.]+/g) ?? []).some((n) => Number(n) !== 0);
      return Number(cs.opacity) < 0.95 || clipped;
    });
    return bad.length ? `${bad.length} öğe görünmez (${getComputedStyle(bad[0]).opacity}, ${getComputedStyle(bad[0]).clipPath})` : "ok";
  });
  expect(hidden === "ok", hidden);
});

await test("Oynatıcıdaki 'Anlamadım' öğretmene sorar, 'Tekrar dinle' çalışır", { ...devices["iPhone 13"] }, async (p) => {
  await p.goto(base + "/coz?q=" + encodeURIComponent("2x + 5 = 15") + "&mode=full");
  await p.getByRole("button", { name: "Anlamadım" }).first().waitFor();
  await p.getByRole("button", { name: "Bu adımı tekrar anlat" }).click();
  await p.locator("main").getByRole("button", { name: "Anlamadım" }).first().click();
  await p.getByText("Hiç sorun değil").waitFor();
});

/* ─── Ekran boyutu matrisi: taşma, alt menü çakışması, görüntüler ─── */
const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568, mobile: true },
  { name: "360x800", width: 360, height: 800, mobile: true },
  { name: "375x667", width: 375, height: 667, mobile: true },
  { name: "390x844", width: 390, height: 844, mobile: true },
  { name: "430x932", width: 430, height: 932, mobile: true },
  { name: "tablet-820x1180", width: 820, height: 1180, mobile: false },
  { name: "masaustu-1440x900", width: 1440, height: 900, mobile: false },
];
const PAGES = [
  { key: "ana-sayfa", path: "/", ready: (p) => p.getByRole("button", { name: /Fotoğraf çek/ }).first().waitFor() },
  { key: "soru-yukleme", path: "/coz?yontem=yaz", ready: (p) => p.getByLabel("Sorunu yaz").waitFor() },
  { key: "sesli-ders", path: "/coz?q=" + encodeURIComponent("2x + 5 = 15") + "&mode=full", ready: (p) => p.locator('section[aria-label="Akıllı tahta"] .katex').first().waitFor() },
  { key: "soru-defteri", path: "/defter", ready: (p) => p.getByRole("heading", { name: "Soru Defterim" }).waitFor() },
  { key: "ayarlar", path: "/ayarlar", ready: (p) => p.getByRole("heading", { name: "Ayarlar", exact: true }).waitFor() },
];

for (const vp of VIEWPORTS) {
  await test(`Ekran ${vp.name}: taşma yok, alt menü içeriği kapatmıyor`, { viewport: { width: vp.width, height: vp.height }, hasTouch: vp.mobile, isMobile: vp.mobile, deviceScaleFactor: 1 }, async (p) => {
    for (const pg of PAGES) {
      await p.goto(base + pg.path);
      await pg.ready(p);
      await p.waitForTimeout(pg.key === "sesli-ders" ? 1800 : 300);
      // overflow-x: clip taşmayı gizleyebileceği için ekran dışına taşan GÖRÜNÜR öğeleri ara
      // (kendi içinde kaydırılabilir alanlar, ör. uzun formüller, hariç)
      const outside = await p.evaluate(() => {
        const W = window.innerWidth;
        const scrollable = (el) => {
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            const ox = getComputedStyle(a).overflowX;
            if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
          }
          return false;
        };
        return [...document.querySelectorAll("body *")]
          .filter((el) => el.offsetParent !== null && !el.closest(".sr-only") && getComputedStyle(el).position !== "fixed")
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.right > W + 1 || r.left < -1) && !scrollable(el);
          })
          .slice(0, 3)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} (${Math.round(el.getBoundingClientRect().right)}px)`);
      });
      expect(outside.length === 0, `${pg.key}: ekran dışına taşan öğe: ${outside.join(", ")}`);
      await p.screenshot({ path: `${OUT}/olcu-${vp.name}-${pg.key}.png` });
      if (vp.mobile) {
        // Sayfanın en altına inince son içerik öğesi alt menünün üstünde kalmalı
        const gap = await p.evaluate(async () => {
          window.scrollTo(0, document.documentElement.scrollHeight);
          await new Promise((r) => setTimeout(r, 150));
          const nav = document.querySelector('nav[aria-label="Alt menü"]').getBoundingClientRect();
          const main = document.querySelector("main");
          const last = [...main.querySelectorAll("*")].filter((el) => el.offsetParent !== null && el.getBoundingClientRect().height > 0).at(-1);
          return nav.top - last.getBoundingClientRect().bottom;
        });
        expect(gap >= 0, `${pg.key}: son içerik alt menünün ${-gap}px altında kalıyor`);
      }
      if (pg.key === "ana-sayfa") {
        // Demo uyarısı görünür ve hiçbir menünün arkasında değil
        const covered = await p.evaluate(() => {
          const el = [...document.querySelectorAll("main p")].find((x) => x.textContent?.includes("Demo modu:"));
          if (!el) return "yok";
          el.scrollIntoView({ block: "center" });
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return el.contains(hit) ? "ok" : "kapalı";
        });
        expect(covered === "ok", `Demo uyarısı: ${covered}`);
      }
      if (pg.key === "sesli-ders" && vp.mobile) {
        // Aktif adımın başlığı oynatıcının altında kalmamalı
        const ok = await p.evaluate(() => {
          const cur = document.querySelector('li[aria-current="step"]');
          cur.scrollIntoView({ block: "start" });
          const t = cur.querySelector("button").getBoundingClientRect();
          const player = document.querySelector('[aria-label="Önceki adım"]').closest("div.sticky").getBoundingClientRect();
          return t.bottom <= player.top || t.top >= player.bottom;
        });
        expect(ok, "Aktif adım başlığı oynatıcının altında kalıyor");
      }
    }
    if (vp.mobile) {
      await p.goto(base + "/");
      await p.screenshot({ path: `${OUT}/olcu-${vp.name}-ana-sayfa-tam.png`, fullPage: true });
    }
  });
}

if (mockBase) {
  await test("Aile PIN'i: PIN'siz yapay zekâ isteği reddedilir, yanlış PIN kabul edilmez", desktop, async (p) => {
    const r = await p.request.post(mockBase + "/api/solve", { data: { text: "2x+5=15", mode: "full" } });
    expect(r.status() === 401, `PIN'siz istek 401 olmalı, gelen ${r.status()}`);
    await p.goto(mockBase + "/coz");
    await p.getByLabel("Aile PIN'i").fill("1111");
    await p.getByRole("button", { name: "Giriş" }).click();
    await p.getByText("PIN yanlış").waitFor();
    await p.getByLabel("Aile PIN'i").fill("2468");
    await p.getByRole("button", { name: "Giriş" }).click();
    await p.getByLabel("Aile PIN'i").waitFor({ state: "detached" });
    const cookies = await p.context().cookies();
    const auth = cookies.find((c) => c.name === "ma_auth");
    expect(auth && auth.httpOnly && auth.sameSite === "Strict", "Erişim çerezi HttpOnly + SameSite=Strict olmalı");
  });

  await test("Fotoğrafta iki soru: öğrenciye hangisini çözeceği sorulur, okunan soru doğrulatılır", desktop, async (p) => {
    await p.goto(mockBase + "/coz");
    await p.getByLabel("Aile PIN'i").fill("2468");
    await p.getByRole("button", { name: "Giriş" }).click();
    await p.getByLabel("Aile PIN'i").waitFor({ state: "detached" });
    // 2x2 beyaz PNG
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mP8z8DwnwEJMOIAAP0gAgEnU0Y1AAAAAElFTkSuQmCC", "base64");
    await p.locator('input[aria-label="Galeriden fotoğraf seç"]').setInputFiles({ name: "soru.png", mimeType: "image/png", buffer: png });
    await p.getByText("Önizleme").waitFor();
    await p.getByRole("button", { name: "Soruyu çöz" }).click();
    await p.getByText("Fotoğrafta iki soru görüyorum").waitFor();
    await p.screenshot({ path: `${OUT}/coklu-soru-secimi.png`, fullPage: true });
    await p.getByRole("button", { name: /1\. soru/ }).click();
    await p.getByText("Doğru okumuş muyum?").waitFor();
    await p.getByText("TEST SAĞLAYICISI").first().waitFor();
    await p.getByRole("button", { name: "Hayır, düzelteceğim" }).click();
    await p.getByLabel("Soruyu doğru hâliyle yaz:").waitFor();
  });

  await test("Sorunun bir kısmı kesikse çözüm uydurulmaz", desktop, async (p) => {
    const ctx = p.context();
    await p.goto(mockBase + "/coz");
    await p.getByLabel("Aile PIN'i").fill("2468");
    await p.getByRole("button", { name: "Giriş" }).click();
    await p.getByLabel("Aile PIN'i").waitFor({ state: "detached" });
    const r = await ctx.request.post(mockBase + "/api/solve", { data: { text: "[test:unreadable] yarım soru", mode: "full" } });
    const j = await r.json();
    expect(j.ok === false && j.code === "UNREADABLE", "Kesik soruda UNREADABLE dönmeli");
  });
}

await browser.close();
for (const srv of servers) {
  try {
    process.kill(-srv.pid, "SIGTERM");
  } catch {
    srv.kill();
  }
}

const failed = results.filter((r) => !r.ok);
const relevantErrors = consoleErrors.filter((e) => !/favicon|Failed to load resource: the server responded with a status of 4\d\d/.test(e));
if (relevantErrors.length) console.log("\nKonsol hataları:\n" + relevantErrors.join("\n"));
console.log(`\n${results.length - failed.length}/${results.length} senaryo geçti. Ekran görüntüleri: e2e/screens/`);
process.exit(failed.length || relevantErrors.length ? 1 : 0);

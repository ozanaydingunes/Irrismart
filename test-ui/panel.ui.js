#!/usr/bin/env node
// MH-1 — Tarayıcı (arayüz) testleri: `npm run test:ui`
// Hidrolik panelinin 8 sekmesini ve her shift ekranını telefon (390 px) ve masaüstü (1280 px) genişliğinde açar.
//  • Aynı veri: iki genişlikte ekrandaki bütün sayılar (data-v) birebir aynı ve hepsi görünür.
//  • Mobil kullanılabilirlik: yatay sayfa taşması yok, sekme ve shift düğmeleri ≥ 40 px.
//  • Tema: açık ve koyu temada panel çizilir, metin/zemin karşıtlığı en az 4,5:1.
//  • Diğer ekranlar: Projeler, Arazi, Veriler, Sonuç, Malzeme, Proje ve Ayarlar hatasız açılır.
// İsteğe bağlı: SHOTS=<klasör> verilirse ekran görüntüleri kaydedilir.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www'), SHOTS = process.env.SHOTS || null;
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf' };
const lat = 36.9, lng = 30.7, dl = 0.0025, dn = 0.0035;
const PROJECTS = [
  { id: 'p1', name: 'S01 Domates', created: 1, updated: 1, poly: [], src: null, inp: { crop: 'domates', srcType: 'kuyu', region: 'akdeniz', soil: 'tinli', rowDir: 'uzun', emitter: 'normal', geom: 'dikdortgen', area_da: 50, L: 400, W: 125, Q: 45, depth: 40 } },
  { id: 'p2', name: 'Parsel', created: 1, updated: 1, poly: [[lat, lng], [lat, lng + dn], [lat + dl, lng + dn], [lat + dl * 1.2, lng + dn * 0.3]], src: [lat, lng], inp: { crop: 'domates', srcType: 'kuyu', region: 'akdeniz', soil: 'tinli', rowDir: 'uzun', emitter: 'normal', geom: 'parsel', Q: 60, depth: 30 } },
  { id: 'p3', name: 'Zeytin hidrant', created: 1, updated: 1, poly: [], src: null, inp: { crop: 'zeytin', srcType: 'sebeke', pAvail: 1.5, region: 'ege', soil: 'tinli', rowDir: 'uzun', emitter: 'pc', geom: 'dikdortgen', area_da: 120, Q: 80 } },
];
const TABS = ['ozet', 'lateral', 'manifold', 'anahat', 'shift', 'pompa', 'basinc', 'tablo'];
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };

function lum(rgb) { const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

(async () => {
  const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); }).listen(0);
  const port = srv.address().port, browser = await chromium.launch();
  const open = async (w, h, theme) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.route(/arcgisonline|open-meteo/, r => r.abort());
    const pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
    await pg.addInitScript(([p, th]) => { localStorage.setItem('irrismart.projects.v1', p); localStorage.setItem('irrigrow.theme', th); }, [JSON.stringify(PROJECTS), theme]);
    await pg.goto(`http://localhost:${port}/`); await pg.waitForTimeout(1100);
    await pg.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
    return { ctx, pg, errs };
  };
  // Sekmedeki sayılar ve görünürlükleri
  const collect = pg => pg.$$eval('#hydro .hp-body [data-v]', els => els.map(e => { const r = e.getBoundingClientRect(), st = getComputedStyle(e); return { v: e.dataset.v, txt: e.textContent, vis: r.width > 0 && r.height > 0 && st.visibility !== 'hidden' }; }));

  for (const proj of PROJECTS) {
    const views = {};
    for (const [w, h, tag] of [[390, 844, 'mobil'], [1280, 900, 'masaustu']]) {
      const { ctx, pg, errs } = await open(w, h, 'acik');
      await pg.click(`[data-open=${proj.id}]`); await pg.waitForTimeout(400);
      await pg.click('[data-v=hidrolik]'); await pg.waitForTimeout(700);
      const nShift = await pg.$$eval('#hydro .hp-barrow', x => x.length);
      for (const tab of TABS) {
        const steps = tab === 'shift' ? Array.from({ length: nShift }, (_, j) => j) : [null];
        for (const j of steps) {
          if (j == null) await pg.click(`#hydro [data-ptab=${tab}]`); else await pg.click(`#hydro .hp-chip[data-shift="${j}"], #hydro [data-ptab=shift]`).then(() => pg.click(`#hydro .hp-chip[data-shift="${j}"]`));
          await pg.waitForTimeout(250);
          const key = j == null ? tab : `shift${j + 1}`;
          const vals = await collect(pg);
          views[key] = views[key] || {}; views[key][tag] = vals;
          check(vals.every(x => x.vis), `${proj.id} ${tag} ${key}: görünmeyen sayı (${vals.filter(x => !x.vis).length})`);
          const over = await pg.evaluate(() => { const v = document.querySelector('#v-hidrolik'); return v.scrollWidth - v.clientWidth; });
          check(over <= 1, `${proj.id} ${tag} ${key}: yatay sayfa taşması ${over} px`);
          if (tag === 'mobil') {
            const small = await pg.$$eval('#hydro .hp-tab, #hydro .hp-chip', els => els.filter(e => e.getBoundingClientRect().height < 40).length);
            check(small === 0, `${proj.id} ${key}: 40 px'ten küçük dokunma hedefi (${small})`);
          }
          if (SHOTS && proj.id === 'p1') { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `${tag}-${key}.png`), fullPage: false }); }
        }
      }
      check(!errs.length, `${proj.id} ${tag}: sayfa hatası ${errs.join(' | ')}`);
      await ctx.close();
    }
    for (const [key, v] of Object.entries(views)) {
      const a = JSON.stringify((v.mobil || []).map(x => [x.v, x.txt])), b = JSON.stringify((v.masaustu || []).map(x => [x.v, x.txt]));
      check(a === b && (v.mobil || []).length > 0 || key === 'tablo', `${proj.id} ${key}: mobil ve masaüstü verisi farklı (${(v.mobil || []).length} / ${(v.masaustu || []).length})`);
    }
  }

  // Koyu tema: panel ve diğer ekranlar; karşıtlık
  for (const theme of ['koyu', 'acik']) {
    const { ctx, pg, errs } = await open(390, 844, theme);
    const t = await pg.evaluate(() => document.documentElement.dataset.theme);
    check(t === (theme === 'koyu' ? 'dark' : 'light'), `tema uygulanmadı: ${theme} → ${t}`);
    await pg.click('[data-open=p1]'); await pg.waitForTimeout(400);
    for (const v of ['arazi', 'veri', 'sonuc', 'hidrolik', 'malzeme', 'teknik']) { await pg.click(`[data-v=${v}]`); await pg.waitForTimeout(v === 'teknik' ? 900 : 400); }
    await pg.click('[data-v=hidrolik]'); await pg.waitForTimeout(400);
    for (const tab of ['ozet', 'anahat']) {
      await pg.click(`#hydro [data-ptab=${tab}]`); await pg.waitForTimeout(250);
      const pairs = await pg.$$eval('#hydro .hp-kv dt, #hydro .hp-kv dd, #hydro .hp-kpi b, #hydro .hp-rt td, #hydro .hp-b, #hydro .hp-src, #hydro h3', els => els.slice(0, 300).map(e => {
        const c = getComputedStyle(e).color; let n = e, bg = 'rgba(0, 0, 0, 0)';
        while (n && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) { bg = getComputedStyle(n).backgroundColor; n = n.parentElement; }
        return [c, bg, e.className || e.tagName];
      }));
      const nums = s => s.match(/[\d.]+/g).slice(0, 3).map(Number);
      const low = pairs.map(([c, bg, cl]) => [contrast(nums(c), nums(bg)), cl]).filter(([r]) => r < 4.5);
      check(!low.length, `${theme} ${tab}: düşük karşıtlık ${low.slice(0, 4).map(([r, c]) => c + ' ' + r.toFixed(2)).join(', ')}`);
      if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `tema-${theme}-${tab}.png`) });
    }
    await pg.click('#btnSettings'); await pg.waitForTimeout(300);
    check(!!(await pg.$('#themeSet')), 'Ayarlar: tema seçimi yok');
    check(!errs.length, `${theme}: sayfa hatası ${errs.join(' | ')}`);
    await ctx.close();
  }

  await browser.close(); srv.close();
  console.log(`\n${passes} kontrol geçti, ${fails} kontrol başarısız`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

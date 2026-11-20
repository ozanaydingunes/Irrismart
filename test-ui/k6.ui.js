#!/usr/bin/env node
// K-6 — IrriGrow 1.0.0 sürüm adayı, tarayıcı testleri (390 px telefon):
//  S-1 Eski sürümden güncelleme: v0.6.0’ın gerçek localStorage dökümü 1.0.0’da açılır; proje, girdiler ve fiyat
//      ayarı aynen; hesap yapılır; kurtarma alanına düşmez; Ayarlar’da "IrriGrow v1.0.0"
//  S-2 Haritada arazi çizme (dokunarak 4 köşe) → Uygula → alan/boyut → hesap → elle PN (PE100 SDR11) → shift ataması
//      korunur → PDF ve JSON yedek; çizilen projenin yanında eski proje korunur
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..', 'www');
const LS = require('../test/fixtures/localstorage-v0.6.0.json');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'irri-k6-'));
  const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const URL0 = `http://localhost:${srv.address().port}/`, browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, hasTouch: false });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept(d.type() === 'prompt' ? d.defaultValue() : undefined));
  await pg.addInitScript(ls => { if (!sessionStorage.getItem('s')) { for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); sessionStorage.setItem('s', '1'); } }, LS);
  await pg.goto(URL0); await pg.waitForTimeout(900);
  await pg.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
  const projeler = () => pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1')));
  const go = async v => { await pg.click(`nav.tabs [data-v=${v}]`); await pg.waitForTimeout(700); };
  const dl = async sel => { const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click(sel)]); const fp = path.join(tmp, d.suggestedFilename()); await d.saveAs(fp); return { fn: d.suggestedFilename(), buf: fs.readFileSync(fp) }; };

  // S-1
  const eski = JSON.parse(LS['irrismart.projects.v1']), eskiAyar = JSON.parse(LS['irrismart.settings.v1']);
  let ps = await projeler();
  check(ps.length === eski.length && ps[0].id === eski[0].id && ps[0].name === eski[0].name && JSON.stringify(ps[0].inp) === JSON.stringify(eski[0].inp), 'S-1 eski proje aynen korunmadı');
  check(!(await pg.evaluate(() => Object.keys(localStorage).some(k => /rescue|kurtar/i.test(k)))), 'S-1 eski veri kurtarma alanına düştü');
  const ayar = await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.settings.v1')));
  check(Object.keys(eskiAyar).every(k => JSON.stringify(ayar[k]) === JSON.stringify(eskiAyar[k])), 'S-1 eski fiyat ayarları değişti');
  check((await pg.textContent('#projList')).includes(eski[0].name), 'S-1 eski proje listede yok');
  await pg.click(`[data-open="${eski[0].id}"]`); await pg.waitForTimeout(400); await go('sonuc');
  check((await pg.$$('#akil .ak-card')).length > 0, 'S-1 eski proje 1.0.2’de hesaplanamadı');
  await pg.click('#btnSettings'); await pg.waitForTimeout(400);
  check(/IrriGrow v1\.0\.2/.test(await pg.textContent('#settings')), 'S-1 Ayarlar’da sürüm 1.0.2 yazmıyor');

  // S-2
  await go('projeler'); await pg.click('#btnNew'); await pg.waitForTimeout(900);   // ad penceresi varsayılanla onaylanır
  check(!!(await pg.$('#v-arazi.on')), 'S-2 yeni proje harita ekranını açmadı');
  const kutu = await pg.$eval('#map', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const cx = kutu.x + kutu.w / 2, cy = kutu.y + kutu.h / 2;
  await pg.mouse.move(cx, cy);
  for (let i = 0; i < 12; i++) { await pg.mouse.wheel(0, -240); await pg.waitForTimeout(120); }   // ≈ zoom 17–18
  await pg.waitForTimeout(500);
  const d = Math.min(kutu.w, kutu.h) * 0.3;
  for (const [dx, dy] of [[-d, -d], [d, -d], [d, d], [-d, d]]) { await pg.mouse.click(cx + dx, cy + dy); await pg.waitForTimeout(250); }
  let p = (await projeler())[0];
  check(p.poly && p.poly.length === 4, `S-2 haritada 4 köşe çizilmedi: ${p.poly && p.poly.length}`);
  await pg.click('#mApply'); await pg.waitForTimeout(2200);
  p = (await projeler())[0];
  check(p.inp.geom === 'parsel' && p.inp.area_da > 1 && p.inp.area_da < 500 && p.inp.L > 0 && p.inp.W > 0, `S-2 alan/boyut uygulanmadı: ${p.inp.area_da} da`);
  if (!(await pg.$('#v-veri.on'))) await go('veri');
  await pg.fill('[name=Q]', '30'); await pg.click('#btnCalc'); await pg.waitForTimeout(1500);
  if (!(await pg.$('#v-sonuc.on'))) await go('sonuc');
  check((await pg.$$('#akil .ak-card')).length > 0, 'S-2 çizilen parselde hesap yapılmadı');
  await pg.evaluate(() => document.querySelectorAll('#result details.ucard').forEach(x => { x.open = true; }));
  const sel = await pg.$('#result select[data-unit]');
  if (sel) { const o = await sel.$$eval('option', x => x.map(y => y.value)); await sel.selectOption(o[o.length - 1]); await pg.waitForTimeout(900); }
  const shift0 = JSON.stringify((await projeler())[0].shiftEdit);
  check(!!sel && shift0 && shift0 !== 'null', 'S-2 elle shift ataması yapılamadı');
  await go('hidrolik');
  const ods = await pg.$$eval('#boruOd option', os => os.map(o => +o.value).filter(Boolean));
  await pg.selectOption('#boruMalz', 'PE100'); await pg.selectOption('#boruOd', String(ods[Math.floor(ods.length / 2)])); await pg.selectOption('#boruSdr', '11');
  await pg.click('#boruUygula'); await pg.waitForTimeout(1000);
  p = (await projeler())[0];
  check(p.inp.boruSecimi && p.inp.boruSecimi.ana.sdr === 11 && /SDR11 PN16/.test(await pg.textContent('#boruKarti')), 'S-2 elle PN seçimi uygulanmadı');
  check(JSON.stringify(p.shiftEdit) === shift0, 'S-2 boru seçimi elle shift atamasını değiştirdi');
  await go('sonuc');
  const pdf = await dl('#bPdf'); check(pdf.buf.slice(0, 4).toString() === '%PDF', 'S-2 PDF');
  await go('projeler');
  const yd = await dl('#btnBackup'); const yj = JSON.parse(yd.buf.toString());
  check(yj.projects.length === 2 && yj.projects.some(x => x.id === eski[0].id) && yj.projects.some(x => x.inp.boruSecimi), 'S-2 yedekte iki proje (eski + çizilen) yok');
  check(!errs.length, 'sayfa hatası: ' + errs.join(' | '));
  await ctx.close(); await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`K-6 sürüm adayı testleri: ${passes} kontrol geçti, ${fails} kontrol başarısız`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

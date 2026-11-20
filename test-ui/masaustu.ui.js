#!/usr/bin/env node
// IrriGrow 1.0 — masaüstü web kapsamlı denetimi (1440 px; tutarlılık için 390 px):
//  D-1 KML ile parsel → haritada köşe sürükleyerek düzenleme (alan değişir, revizyonlu) → Uygula
//  D-2 Shift kutuları parseli örtmez (ayrıntı düzeyi alana göre); köşe tutamaçları kutuların üstünde
//  D-3 Otomatik shift ve hidrolik hesap; elle PN / çap / SDR (PE100 Ø, SDR11 ↔ SDR17) → motor ve ekran aynı
//  D-4 Pompa, filtre ve vana önerileri ekranda (motorun seçtiği kayıtlar)
//  D-5 Raporlar menüsü: PDF, Excel, Hidrolik Excel, DXF, A3 pafta; Yedek menüsü: yedekle ve geri yükle
//  D-6 Sekiz dil: her dilde sayfa hatası yok, menü metni değişir, he → dir=rtl; Türkçe karakterler (proje adı) bozulmaz
//  D-7 Aynı proje telefonda (390 px) ve masaüstünde (1440 px) aynı hidrolik değerleri gösterir
//  D-8 Veriler formunda ondalık ayırıcı dile göre (tr: virgül), kayıtlı değer değişmez
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const XLSX = require('../www/vendor/xlsx.full.min.js');
const ROOT = path.join(__dirname, '..', 'www');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };
const dik = (lat, lng, dLat, dLng) => [[lng, lat], [lng + dLng, lat], [lng + dLng, lat + dLat], [lng, lat + dLat], [lng, lat]].map(([x, y]) => `${x},${y}`).join(' ');
const KML = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Çiğdem Şeftali Ünlü</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${dik(36.9, 30.7, 0.0025, 0.0035)}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`;

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'irri-masaustu-'));
  const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const URL0 = `http://localhost:${srv.address().port}/`, browser = await chromium.launch();
  const open = async (w, h, seed) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, acceptDownloads: true });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept(d.type() === 'prompt' ? d.defaultValue() : undefined));
    if (seed) await pg.addInitScript(p => { if (!sessionStorage.getItem('s')) { localStorage.setItem('irrismart.projects.v1', p); sessionStorage.setItem('s', '1'); } }, seed);
    await pg.goto(URL0); await pg.waitForTimeout(900);
    await pg.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
    return { ctx, pg, errs };
  };
  const go = async (pg, v) => { await pg.click(`[data-v=${v}]:visible`); await pg.waitForTimeout(800); };
  const proje = pg => pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0]);
  const dl = async (pg, fn) => { const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), fn()]); const fp = path.join(tmp, d.suggestedFilename()); await d.saveAs(fp); return { fn: d.suggestedFilename(), fp, buf: fs.readFileSync(fp) }; };
  const hydroDegerler = pg => pg.$$eval('#hydro [data-v]', els => els.map(e => e.getAttribute('data-v')).filter(Boolean));

  const { ctx, pg, errs } = await open(1440, 900);
  check(await pg.evaluate(() => document.documentElement.classList.contains('desk')), 'masaüstü düzeni etkin değil');
  // D-1
  await pg.setInputFiles('#kmlFile', { name: 'Çiğdem.kml', mimeType: 'application/vnd.google-earth.kml+xml', buffer: Buffer.from(KML) });
  await pg.waitForTimeout(500); await pg.click('#kmlUygula'); await pg.waitForTimeout(2300);
  let p = await proje(pg);
  check(p.name === 'Çiğdem Şeftali Ünlü' && p.poly.length === 4, 'D-1 KML ile proje / Türkçe ad: ' + p.name);
  const alan0 = p.inp.area_da;
  await go(pg, 'arazi');
  const vtx = await pg.$$('#map .vtx');
  check(vtx.length === 4, `D-1 köşe tutamacı yok: ${vtx.length}`);
  if (vtx.length) {
    const bb = await vtx[2].boundingBox();
    await pg.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await pg.mouse.down();
    await pg.mouse.move(bb.x + bb.width / 2 + 60, bb.y + bb.height / 2 - 40, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(600);
    p = await proje(pg);
    const once = [36.9025, 30.7035];
    check(Math.abs(p.poly[2][0] - once[0]) + Math.abs(p.poly[2][1] - once[1]) > 1e-5, 'D-1 köşe sürüklenerek taşınmadı');
    await pg.click('#mApply'); await pg.waitForTimeout(2300); await go(pg, 'arazi');
    p = await proje(pg);
    check(p.inp.area_da > alan0, `D-1 düzenleme sonrası alan güncellenmedi: ${alan0} → ${p.inp.area_da}`);
  }
  // D-3
  await go(pg, 'veri'); await pg.fill('[name=Q]', '90'); await pg.click('#btnCalc'); await pg.waitForTimeout(1500);
  if (!(await pg.$('#v-sonuc.on'))) await go(pg, 'sonuc');
  check((await pg.$$('#akil .ak-card')).length > 0, 'D-3 otomatik hesap yapılmadı');
  const motor = () => pg.evaluate(() => { const p = JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0]; const r = IrriEngine.design(p.inp, undefined, { manual: p.shiftEdit || null, poly: p.poly, src: p.src, station: p.station, route: p.route });
    return { ok: r.ok, ns: r.sel && r.sel.groups.length, od: r.main.sel.od, sdr: r.main.sel.pipe.sdr, pn: r.main.sel.pipe.pn, ic: r.main.sel.ic, v: r.main.sel.v, pump: r.pump && r.pump.p && r.pump.p.model, filtre: (r.filter.items || []).map(x => x.f.ad), vana: r.valve }; });
  const oto = await motor();
  check(oto.ok && oto.ns >= 1, 'D-3 motor sonucu yok');
  await go(pg, 'arazi');
  // D-2: kutular ve tutamaçlar
  const z = await pg.evaluate(() => { const el = document.getElementById('map'); const v = document.querySelector('#map .vtx'), b = document.querySelector('#map .sboxw');
    return { small: el.classList.contains('zsmall'), nobox: el.classList.contains('znobox'), vz: v ? +getComputedStyle(v).zIndex : 0, bz: b ? +getComputedStyle(b).zIndex : -1, kutu: document.querySelectorAll('#map .sboxw').length }; });
  check(z.kutu > 0 && (z.small || z.nobox), `D-2 shift kutuları tam boyda parseli örtüyor: ${JSON.stringify(z)}`);
  check(z.vz > z.bz, `D-2 köşe tutamacı kutuların altında: ${JSON.stringify(z)}`);
  await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(500); await pg.click('.leaflet-control-zoom-in'); await pg.waitForTimeout(500);
  check(!(await pg.evaluate(() => document.getElementById('map').classList.contains('zsmall'))), 'D-2 yakınlaşınca kutu ayrıntısı açılmadı');
  await go(pg, 'hidrolik');
  const ods = await pg.$$eval('#boruOd option', os => os.map(o => +o.value).filter(Boolean));
  const od = ods.includes(125) ? 125 : ods[Math.floor(ods.length / 2)];
  const sonuc = {};
  for (const sdr of [11, 17]) {
    await pg.selectOption('#boruMalz', 'PE100'); await pg.selectOption('#boruOd', String(od)); await pg.selectOption('#boruSdr', String(sdr));
    await pg.click('#boruUygula'); await pg.waitForTimeout(1000);
    const m = await motor(); sonuc[sdr] = m;
    check(m.od === od && m.sdr === sdr && m.pn === (sdr === 11 ? 16 : 10), `D-3 SDR${sdr} motor: ${JSON.stringify(m)}`);
    check(new RegExp(`PE100 Ø${od} SDR${sdr} PN${sdr === 11 ? 16 : 10}`).test(await pg.textContent('#hydro')), `D-3 SDR${sdr} ekranda yok`);
  }
  check(sonuc[17].ic > sonuc[11].ic && sonuc[17].v < sonuc[11].v, 'D-3 SDR17 daha büyük iç çap/düşük hız vermeli');
  // D-4 pompa, filtre, vana
  for (const tab of ['pompa']) { const b = await pg.$(`[data-ptab=${tab}]`); if (b) { await b.click(); await pg.waitForTimeout(400); } }
  const htxt = await pg.textContent('#hydro');
  check(!!oto.pump && htxt.includes(sonuc[17].pump), `D-4 pompa önerisi ekranda yok: ${sonuc[17].pump}`);
  check(sonuc[17].filtre.length > 0 && sonuc[17].filtre.every(f => htxt.includes(f)), `D-4 filtre önerisi ekranda yok: ${sonuc[17].filtre}`);
  await go(pg, 'malzeme');
  const btxt = await pg.textContent('#bom');
  check(/vana/i.test(btxt) && /Pompa|pompa/.test(btxt) && /[Ff]iltre|[Hh]idrosiklon/.test(btxt), 'D-4 malzeme listesinde pompa/filtre/vana yok');
  // D-5 raporlar ve yedek
  await go(pg, 'sonuc');
  const menu = async k => { await pg.click('#deskTools summary:has-text("Raporlar")'); return dl(pg, () => pg.click(`#deskTools [data-dt=${k}]`)); };
  const pdf = await menu('pdf'), xls = await menu('xlsx'), hx = await menu('hxlsx'), dxf = await menu('dxf');
  await go(pg, 'teknik'); const fmt = await pg.$('#tech select[data-o=format]'); if (fmt) { await fmt.selectOption('A3'); await pg.waitForTimeout(400); }
  const a3 = await menu('sheet');
  check(pdf.buf.slice(0, 4).toString() === '%PDF' && /^IrriGrow_Cigdem_Seftali_Unlu-[0-9a-z]{4}_/.test(pdf.fn), 'D-5 PDF: ' + pdf.fn);
  const wb = XLSX.read(xls.buf), oz = XLSX.utils.sheet_to_json(wb.Sheets['Özet'], { header: 1 }).map(r => r.join(' ')).join('\n');
  check(oz.includes('Çiğdem Şeftali Ünlü') && wb.SheetNames.includes('Hidrolik'), 'D-5 Excel (Türkçe ad içerikte)');
  check(hx.buf.slice(0, 2).toString() === 'PK' && /_hidrolik_/.test(hx.fn), 'D-5 Hidrolik Excel');
  check(/SECTION/.test(dxf.buf.toString('latin1').slice(0, 2000)), 'D-5 DXF');
  check(/_pafta_A3_.*\.pdf$/.test(a3.fn) && a3.buf.slice(0, 4).toString() === '%PDF', 'D-5 A3 pafta: ' + a3.fn);
  await pg.click('#deskTools summary:has-text("Yedek")');
  const yd = await dl(pg, () => pg.click('#deskTools [data-dt=backup]'));
  check(JSON.parse(yd.buf.toString()).projects[0].inp.boruSecimi.ana.sdr === 17, 'D-5 yedek');
  // D-8 ondalık ayırıcı
  await go(pg, 'veri');
  const egim = await pg.$eval('[name=slopeLong]', e => e.value).catch(() => '');
  p = await proje(pg);
  check(typeof p.inp.Q !== 'undefined' && !/\./.test(await pg.$eval('[name=Q]', e => e.value)), 'D-8 debi alanı');
  if (typeof p.inp.slopeLong === 'number' && !Number.isInteger(p.inp.slopeLong)) check(/,/.test(egim) && !/\./.test(egim), `D-8 eğim virgülle gösterilmeli: ${egim}`);
  const masaustuDeger = (await go(pg, 'hidrolik'), await hydroDegerler(pg));
  check(!errs.length, 'sayfa hatası: ' + errs.join(' | '));
  const kayit = await pg.evaluate(() => localStorage.getItem('irrismart.projects.v1'));
  await ctx.close();

  // D-7 telefon = masaüstü
  {
    const t = await open(390, 844, kayit);
    await t.pg.click('nav.tabs [data-v=projeler]'); await t.pg.waitForTimeout(300);
    await t.pg.click(`[data-open="${JSON.parse(kayit)[0].id}"]`); await t.pg.waitForTimeout(400);
    await t.pg.click('nav.tabs [data-v=hidrolik]'); await t.pg.waitForTimeout(900);
    const tel = await hydroDegerler(t.pg);
    check(tel.length > 10 && JSON.stringify(tel) === JSON.stringify(masaustuDeger), `D-7 telefon/masaüstü hidrolik değerleri farklı (${tel.length} / ${masaustuDeger.length})`);
    check(!(await t.pg.evaluate(() => document.documentElement.classList.contains('desk'))), 'D-7 telefonda masaüstü düzeni etkinleşti');
    check(!t.errs.length, 'sayfa hatası (telefon): ' + t.errs.join(' | '));
    await t.ctx.close();
  }

  // D-6 sekiz dil
  {
    const L = await open(1440, 900, kayit);
    await L.pg.click(`[data-open="${JSON.parse(kayit)[0].id}"]`); await L.pg.waitForTimeout(400);
    const diller = ['tr', 'en', 'de', 'es', 'ru', 'it', 'he', 'zh'], menuMetni = {};
    for (const d of diller) {
      await L.pg.click('#btnSettings'); await L.pg.waitForTimeout(400);
      await L.pg.selectOption('#langSet', d); await L.pg.waitForTimeout(700);
      await go(L.pg, 'sonuc'); await go(L.pg, 'hidrolik');
      const s = await L.pg.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, nav: [...document.querySelectorAll('[data-v=hidrolik]')].map(e => e.textContent.trim()).join('|'), ov: document.documentElement.scrollWidth - innerWidth, adi: document.body.textContent.includes('Çiğdem Şeftali Ünlü') }));
      menuMetni[d] = s.nav;
      check(s.lang === d && s.dir === (d === 'he' ? 'rtl' : 'ltr'), `D-6 ${d}: lang/dir ${s.lang}/${s.dir}`);
      check(s.ov <= 0, `D-6 ${d}: yatay taşma ${s.ov}px`);
      check(s.adi, `D-6 ${d}: Türkçe proje adı bozuldu`);
    }
    check(new Set(Object.values(menuMetni)).size === diller.length, 'D-6 menü metni her dilde farklı olmalı: ' + JSON.stringify(menuMetni));
    check(!L.errs.length, 'sayfa hatası (diller): ' + L.errs.join(' | '));
    await L.ctx.close();
  }
  await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Masaüstü web 1.0: ${passes} kontrol geçti, ${fails} kontrol başarısız`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

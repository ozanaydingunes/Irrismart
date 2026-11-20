#!/usr/bin/env node
// 1.0 yayın güvenliği — projelerin JSON yedekle başka bir uygulamaya taşınması (ör. com.irrigrow.app.dev → com.irrigrow.app).
// İki uygulama iki ayrı köken (ayrı yerel depolama) ile taklit edilir: A = geliştirme sürümü, B = üretim sürümü.
//  T-1 A'da: gerçek v0.6.0 dökümü + bütün alanları dolu bir proje (KML kaynağı, kot, elle boru, elle shift, istasyon,
//      güzergâh, revizyonlar, pafta ayarları) → Projeler → Yedekle (JSON)
//  T-2 Boş B'ye "Yedekten yükle": proje sayısı, kimlikler ve her projenin bütün alanları A ile birebir aynı; fiyat ayarları da
//  T-3 B'de açılan taşınmış proje aynı hesap sonucunu verir (motor çıktısı A = B)
//  T-4 B'de aynı kimlikli ama farklı içerikli proje varken yükleme: mevcut proje silinmez, "(yedekten)" kopya eklenir;
//      aynı yedeği ikinci kez yüklemek yeni kopya üretmez
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..', 'www');
const LS0 = require('../test/fixtures/localstorage-v0.6.0.json');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };
const sirali = v => Array.isArray(v) ? v.map(sirali) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => (o[k] = sirali(v[k]), o), {}) : v;
const J = v => JSON.stringify(sirali(v));
const lat = 36.9, lng = 30.7;
const ZENGIN = {
  id: 'zengin1', name: 'Çiğdem Ünlü — taşıma', created: 1700000000000, updated: 1700000500000,
  poly: [[lat, lng], [lat, lng + 0.0035], [lat + 0.0025, lng + 0.0035], [lat + 0.0025, lng]], src: [lat - 0.0002, lng - 0.0002],
  station: [lat - 0.0001, lng - 0.0001], route: [[lat, lng - 0.0001]],
  inp: { crop: 'domates', srcType: 'kuyu', region: 'akdeniz', soil: 'tinli', rowDir: 'uzun', emitter: 'normal', geom: 'parsel', Q: 90, depth: 40, area_da: 87.2, L: 310, W: 278, slopeLong: 1.1, slopeShort: 0.3, boruSecimi: { ana: { malzeme: 'PE100', od: 125, sdr: 17 } } },
  elev: { zmin: 50, zmax: 56, total: 6, src: 'Open-Meteo (Copernicus DEM ~90 m)' },
  geoKaynak: { tur: 'kmz', dosya: 'ciftlik.kmz', icDosya: 'doc.kml', parsel: 'Büyük tarla', iceAktarma: '2026-11-19T10:00:00.000Z', yukseklikler: [120, 120, 120, 120], irtifaModu: 'absolute', kotDogrulanmis: false, alan_m2: 87200 },
  techOpt: { format: 'A3', orient: 'yatay' }, drawPos: { S1: [lat + 0.001, lng + 0.001] }, akil: { planOrani: 0.8 },
};

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'irri-tasima-'));
  const sunucu = async () => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0); await new Promise(r => s.on('listening', r)); return s; };
  const sA = await sunucu(), sB = await sunucu();   // iki ayrı port = iki ayrı köken = iki ayrı uygulama deposu
  const browser = await chromium.launch();
  const ac = async (srv, seed) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
    if (seed) await pg.addInitScript(ls => { if (!sessionStorage.getItem('s')) { for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); sessionStorage.setItem('s', '1'); } }, seed);
    await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(900);
    return { ctx, pg, errs };
  };
  const projeler = pg => pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1') || '[]'));
  const motor = (pg, id) => pg.evaluate(id => { const p = JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(x => x.id === id); const r = IrriEngine.design(p.inp, undefined, { manual: p.shiftEdit || null, poly: p.poly, src: p.src, station: p.station, route: p.route });
    return r.ok ? { ns: r.sel.groups.length, od: r.main.sel.od, ic: r.main.sel.ic, v: r.main.sel.v, H: r.main.sel.H, pump: r.pump && r.pump.p && r.pump.p.model } : { hata: r.err }; }, id);

  // T-1: A (geliştirme sürümü)
  const eski = JSON.parse(LS0['irrismart.projects.v1']);
  const A = await ac(sA, { ...LS0, 'irrismart.projects.v1': JSON.stringify([ZENGIN, ...eski]) });
  await A.pg.click(`[data-open="${ZENGIN.id}"]`); await A.pg.waitForTimeout(400);
  await A.pg.click('nav.tabs [data-v=sonuc]'); await A.pg.waitForTimeout(1200);
  await A.pg.evaluate(() => document.querySelectorAll('#result details.ucard').forEach(d => { d.open = true; }));
  const sel = await A.pg.$('#result select[data-unit]');
  if (sel) { const o = await sel.$$eval('option', x => x.map(y => y.value)); await sel.selectOption(o[o.length - 1]); await A.pg.waitForTimeout(900); }
  const aProj = await projeler(A.pg), aAyar = await A.pg.evaluate(() => localStorage.getItem('irrismart.settings.v1'));
  check(aProj.length === 1 + eski.length && aProj.find(p => p.id === ZENGIN.id).shiftEdit && (aProj.find(p => p.id === ZENGIN.id).revs || []).length > 0, 'T-1 A’da zengin proje (elle shift, revizyon) hazırlanamadı');
  const aMotor = await motor(A.pg, ZENGIN.id);
  await A.pg.click('nav.tabs [data-v=projeler]'); await A.pg.waitForTimeout(300);
  const [d] = await Promise.all([A.pg.waitForEvent('download'), A.pg.click('#btnBackup')]);
  const yedek = path.join(tmp, d.suggestedFilename()); await d.saveAs(yedek);
  check(/^IrriGrow_yedek_.*\.json$/.test(d.suggestedFilename()), 'T-1 yedek dosya adı: ' + d.suggestedFilename());
  check(!A.errs.length, 'A sayfa hatası: ' + A.errs.join(' | '));

  // T-2 / T-3: boş B (üretim sürümü)
  const B = await ac(sB, null);
  check((await projeler(B.pg)).length === 0, 'T-2 B başlangıçta boş olmalı (ayrı depolama)');
  await B.pg.setInputFiles('#restoreFile', yedek); await B.pg.waitForTimeout(900);
  const bProj = await projeler(B.pg);
  check(bProj.length === aProj.length, `T-2 proje sayısı ${bProj.length} ≠ ${aProj.length}`);
  for (const a of aProj) {
    const b = bProj.find(x => x.id === a.id);
    check(!!b, `T-2 ${a.id} taşınmadı`);
    if (!b) continue;
    const alanlar = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => k !== 'schema');
    const fark = alanlar.filter(k => J(a[k]) !== J(b[k]));
    check(!fark.length, `T-2 ${a.id} alanları farklı: ${fark.join(', ')}`);
  }
  const bAyar = await B.pg.evaluate(() => localStorage.getItem('irrismart.settings.v1'));
  check(J(JSON.parse(bAyar || '{}').items || {}) === J(JSON.parse(aAyar || '{}').items || {}) && bAyar && bAyar.includes('"edited"'), 'T-2 fiyat ayarları taşınmadı');
  const bMotor = await motor(B.pg, ZENGIN.id);
  check(!aMotor.hata && J(aMotor) === J(bMotor), `T-3 hesap sonucu farklı: ${J(aMotor)} / ${J(bMotor)}`);
  await B.pg.click(`[data-open="${ZENGIN.id}"]`); await B.pg.waitForTimeout(400);
  await B.pg.click('nav.tabs [data-v=hidrolik]'); await B.pg.waitForTimeout(900);
  check(/PE100 Ø125 SDR17 PN10/.test(await B.pg.textContent('#boruKarti')), 'T-3 taşınan projede elle boru seçimi görünmüyor');
  check(!B.errs.length, 'B sayfa hatası: ' + B.errs.join(' | '));

  // T-4: B'de aynı kimlik, farklı içerik
  await B.pg.evaluate(() => { const P = JSON.parse(localStorage.getItem('irrismart.projects.v1')); const z = P.find(x => x.id === 'zengin1'); z.name = 'B’de değişti'; z.inp.Q = 70; localStorage.setItem('irrismart.projects.v1', JSON.stringify(P)); });
  await B.pg.reload(); await B.pg.waitForTimeout(900);
  await B.pg.setInputFiles('#restoreFile', yedek); await B.pg.waitForTimeout(900);
  let p4 = await projeler(B.pg);
  const mevcut = p4.find(x => x.id === ZENGIN.id), kopya = p4.filter(x => x.kaynakKimlik === ZENGIN.id);
  check(mevcut && mevcut.name === 'B’de değişti' && mevcut.inp.Q === 70, 'T-4 mevcut proje üzerine yazıldı');
  check(kopya.length === 1 && /\(yedekten\)/.test(kopya[0].name) && J(kopya[0].inp) === J(aProj.find(x => x.id === ZENGIN.id).inp) && J(kopya[0].geoKaynak) === J(ZENGIN.geoKaynak), 'T-4 "(yedekten)" kopya eklenmedi veya eksik');
  check(p4.length === aProj.length + 1, `T-4 proje sayısı ${p4.length}`);
  await B.pg.setInputFiles('#restoreFile', yedek); await B.pg.waitForTimeout(900);
  check((await projeler(B.pg)).length === p4.length, 'T-4 aynı yedeği yeniden yüklemek kopya üretmemeli');
  await A.ctx.close(); await B.ctx.close(); await browser.close(); sA.close(); sB.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`JSON ile taşıma: ${passes} kontrol geçti, ${fails} kontrol başarısız`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

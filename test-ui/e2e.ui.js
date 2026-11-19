#!/usr/bin/env node
// IrriGrow 1.0 — uçtan uca akış (K-1…K-4 birlikte), masaüstü 1280 px:
//  E-1 Projeler → "KML/KMZ dosyasından yeni proje" (gerçek dosya seçici olayı) → 3 adaydan biri seçilir → uygulanır
//  E-2 Veriler → debi/derinlik → hesap; W-SD-01 hiçbir zaman "uygunsuz" değil
//  E-3 Sonuç → elle shift ataması
//  E-4 Hidrolik → elle boru (PE100 SDR11 → SDR17): iç çap = kütüphane, hız = Q/A, PN etiketi tutarlı; hesap kendiliğinden yenilenir
//      elle shift ataması boru değişikliğinden sonra korunur; doğrulanmamış kombinasyon (PN6, PVC-U) seçilemez
//  E-5 Raporlar: PDF, Excel (seçilen boru etiketi), Hidrolik Excel, A3 pafta PDF, DXF
//  E-6 Yedek → boş tarayıcıya geri yükleme: geoKaynak (kot doğrulanmamış), boruSecimi ve elle shift ataması korunur
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const C = require('../www/vendor/xlsx.full.min.js').CFB;
const XLSX = require('../www/vendor/xlsx.full.min.js');
const ROOT = path.join(__dirname, '..', 'www');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };

// 37°K'de ~300 m × ~220 m (≈ 66 da), ~150 m × ~110 m (≈ 16 da) ve kendini kesen bir sınır
const dik = (lat, lng, dLat, dLng) => [[lng, lat], [lng + dLng, lat], [lng + dLng, lat + dLat], [lng, lat + dLat], [lng, lat]].map(([x, y]) => `${x},${y},120`).join(' ');
const poly = k => `<Polygon><outerBoundaryIs><LinearRing><coordinates>${k}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
const pm = (ad, g) => `<Placemark><name>${ad}</name>${g}</Placemark>`;
const KML = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder><name>Çiftlik</name>`
  + pm('Büyük tarla', poly(dik(37.0, 35.0, 0.002, 0.0034))) + pm('Küçük tarla', poly(dik(37.01, 35.0, 0.001, 0.0017)))
  + pm('Hatalı', poly('35.1,37 35.101,37.001 35.101,37 35.1,37.001 35.1,37')) + `</Folder></Document></kml>`;
const KMZ = (() => { const z = C.utils.cfb_new(); C.utils.cfb_add(z, 'doc.kml', Buffer.from(KML)); return Buffer.from(C.write(z, { fileType: 'zip', type: 'array', compression: true })); })();

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'irri-e2e-'));
  const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const URL0 = `http://localhost:${srv.address().port}/`, browser = await chromium.launch();
  const open = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
    await pg.goto(URL0); await pg.waitForTimeout(900);
    await pg.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
    return { ctx, pg, errs };
  };
  const go = async (pg, v) => { await pg.click(`nav.tabs [data-v=${v}]`); await pg.waitForTimeout(700); };
  const proje = pg => pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0]);
  const download = async (pg, sel) => { const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click(sel)]); const fp = path.join(tmp, d.suggestedFilename()); await d.saveAs(fp); return { fn: d.suggestedFilename(), fp, buf: fs.readFileSync(fp) }; };
  const motor = pg => pg.evaluate(() => { const p = JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0]; const st = JSON.parse(localStorage.getItem('irrismart.settings.v1') || 'null') || undefined;
    const r = IrriEngine.design(p.inp, st, { manual: p.shiftEdit || null, poly: p.poly, src: p.src, station: p.station, route: p.route }); if (!r.main) return { ok: false, hata: JSON.stringify(r).slice(0, 400), inp: p.inp }; const s = r.main.sel;
    const row = s.pipe && s.pipe.malzeme !== 'PVC-U' ? IrriPipes.bul(s.pipe.malzeme, s.od, s.pipe.sdr) : null;
    return { ok: r.ok, od: s.od, ic: s.ic, v: s.v, Q: r.main.Q ?? r.Qsys ?? null, pn: s.pipe && s.pipe.pn, sdr: s.pipe && s.pipe.sdr, mal: s.pipe && s.pipe.malzeme, secim: s.secim, pnYeterli: s.pnYeterli, libIc: row ? IrriPipes.icCap(row) : null }; });

  const { ctx, pg, errs } = await open();
  // E-1
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#btnKmlYeni')]);
  await fc.setFiles({ name: 'ciftlik.kmz', mimeType: 'application/vnd.google-earth.kmz', buffer: KMZ }); await pg.waitForTimeout(500);
  const adaylar = await pg.$$eval('#kmlListe input[name=kmlP]', rs => rs.map(r => ({ v: r.value, d: r.disabled })));
  check(adaylar.length === 3 && adaylar.filter(a => a.d).length === 1, 'E-1 3 aday / 1 seçilemez bekleniyor: ' + JSON.stringify(adaylar));
  await pg.check(`#kmlListe input[value="${adaylar[0].v}"]`); await pg.click('#kmlUygula'); await pg.waitForTimeout(2200);
  let p = await proje(pg);
  check(p.name === 'Büyük tarla' && p.poly.length === 4 && p.inp.geom === 'parsel' && p.inp.area_da > 60 && p.inp.area_da < 70, `E-1 proje/parsel: ${p.name} ${p.inp.area_da} da`);
  check(p.geoKaynak && p.geoKaynak.tur === 'kmz' && p.geoKaynak.kotDogrulanmis === false, 'E-1 geoKaynak');
  check(!p.inp.grad && !p.elev, 'E-1 KML yüksekliği eğim/kot olarak kullanılmamalı (Open-Meteo engelli)');
  // E-2
  if (!(await pg.$('#v-veri.on'))) await go(pg, 'veri');
  await pg.fill('[name=Q]', '60'); await pg.fill('[name=depth]', '40');
  await pg.click('#btnCalc'); await pg.waitForTimeout(1500);
  if (!(await pg.$('#v-sonuc.on'))) await go(pg, 'sonuc');
  check((await pg.$$('#akil .ak-card')).length > 0, 'E-2 hesap sonucu / uyarılar yok');
  const sd = () => pg.$$eval('#akil .ak-card[data-kod="W-SD-01"]', cs => cs.map(c => c.dataset.seviye));
  check((await sd()).every(s => s !== 'uygunsuz'), 'E-2 W-SD-01 uygunsuz olmamalı');
  // E-3
  await pg.evaluate(() => document.querySelectorAll('#result details.ucard').forEach(d => { d.open = true; }));
  const sel = await pg.$('#result select[data-unit]');
  if (sel) { const o = await sel.$$eval('option', x => x.map(y => y.value)); await sel.selectOption(o[o.length - 1]); await pg.waitForTimeout(900); }
  p = await proje(pg); const shift0 = JSON.stringify(p.shiftEdit);
  check(!!sel && !!p.shiftEdit, 'E-3 elle shift ataması yapılamadı');
  // E-4
  await go(pg, 'hidrolik');
  check(await pg.$eval('#boruMalz option[value="PVC-U"]', o => o.disabled), 'E-4 PVC-U seçilemez olmalı');
  check(!(await pg.$$eval('#boruSdr option', os => os.map(o => o.value))).includes('26'), 'E-4 PN6 (SDR26) listede olmamalı');
  const ods = await pg.$$eval('#boruOd option', os => os.map(o => +o.value).filter(Boolean));
  const od = ods.includes(140) ? 140 : ods[Math.floor(ods.length / 2)];
  const sonuclar = {};
  for (const sdr of ['11', '17']) {
    await pg.selectOption('#boruMalz', 'PE100'); await pg.selectOption('#boruOd', String(od)); await pg.selectOption('#boruSdr', sdr);
    await pg.click('#boruUygula'); await pg.waitForTimeout(1000);
    const m = await motor(pg); sonuclar[sdr] = m;
    const pn = sdr === '11' ? 16 : 10;
    check(m.ok && m.secim === 'kullanici' && m.mal === 'PE100' && m.od === od && m.sdr === +sdr && m.pn === pn, `E-4 SDR${sdr}: motor seçimi ${JSON.stringify(m)}`);
    const icMm = m.ic > 5 ? m.ic : m.ic * 1000, libMm = m.libIc > 5 ? m.libIc : m.libIc * 1000;
    check(m.libIc && Math.abs(icMm - libMm) < 0.05, `E-4 SDR${sdr}: iç çap ${icMm} ≠ kütüphane ${libMm}`);
    if (m.Q) { const A = Math.PI * Math.pow(icMm / 1000, 2) / 4, q = m.Q > 1 ? m.Q / 3600 : m.Q; check(Math.abs(q / A - m.v) / m.v < 0.02, `E-4 SDR${sdr}: hız ${m.v} ≠ Q/A ${q / A}`); }
    const kart = await pg.$eval('#boruKarti', e => e.textContent);
    check(new RegExp(`PE100 Ø${od} SDR${sdr} PN${pn}`).test(kart), `E-4 SDR${sdr}: kartta etiket yok`);
    check(new RegExp(`PE100 Ø${od} SDR${sdr} PN${pn}`).test(await pg.$eval('#hydro', e => e.textContent)), `E-4 SDR${sdr}: hidrolik panel yenilenmedi`);
  }
  check(sonuclar['17'].ic > sonuclar['11'].ic && sonuclar['17'].v < sonuclar['11'].v, 'E-4 PN10 daha büyük iç çap / daha düşük hız vermeli');
  p = await proje(pg);
  check(JSON.stringify(p.shiftEdit) === shift0, 'E-4 boru değişikliği elle shift atamasını sildi/değiştirdi');
  await go(pg, 'sonuc');
  check((await sd()).every(s => s !== 'uygunsuz'), 'E-4 elle boru ile W-SD-01 uygunsuz olmamalı');
  // E-5
  const pdf = await download(pg, '#bPdf'), xls = await download(pg, '#bXls');
  check(pdf.buf.slice(0, 4).toString() === '%PDF' && pdf.buf.length > 20000, 'E-5 PDF');
  const wb = XLSX.read(xls.buf); const hid = XLSX.utils.sheet_to_json(wb.Sheets['Hidrolik'], { header: 1 }).map(x => x.join(' ')).join('\n');
  check(/^IrriGrow_Buyuk_tarla-[0-9a-z]{4}_\d{8}-\d{4}\.pdf$/.test(pdf.fn) && /^IrriGrow_Buyuk_tarla-[0-9a-z]{4}_.*\.xlsx$/.test(xls.fn), `E-5 Türkçe proje adında dosya adı: ${pdf.fn} / ${xls.fn}`);
  // Yalnız dosya adı ASCII: proje adı ve rapor içeriği Türkçe kalır
  const ozetSayfa = wb.SheetNames.map(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 }).map(x => x.join(' ')).join('\n')).join('\n');
  check(/Büyük tarla/.test(ozetSayfa) && (await proje(pg)).name === 'Büyük tarla', 'E-5 proje adı / Excel içeriği Türkçe kalmalı');
  check(/[çğışöüÇĞİŞÖÜ]/.test(ozetSayfa.replace(/Büyük tarla/g, '')), 'E-5 Excel içindeki Türkçe metinler değişmemeli');
  const adlar = await pg.evaluate(() => ['Büyük tarla', 'Buyuk tarla', 'Buyuk_tarla', 'Buyuk  tarla', 'Поле 1', 'Поле 2', 'שדה', '田地', 'S01 Domates'].map(IrriReport.dosyaAdi));
  check(new Set(adlar).size === adlar.length && adlar.every(a => /^[A-Za-z0-9_-]+$/.test(a)) && adlar[8] === 'S01_Domates' && adlar[1] === 'Buyuk_tarla', 'E-5 farklı adlar aynı dosya adına düşmemeli: ' + adlar.join(', '));
  check(adlar[0] === await pg.evaluate(() => IrriReport.dosyaAdi('Büyük tarla')), 'E-5 dosya adı eki sabit olmalı');
  // Android (sahte Capacitor dosya sistemi): aynı dakikada iki kayıt birbirinin üzerine yazılmaz
  const yazilan = await pg.evaluate(async () => {
    const dosyalar = new Set(), yol = []; const eski = window.Capacitor;
    window.Capacitor = { isNativePlatform: () => true, Plugins: { Filesystem: {
      writeFile: async o => { if (o.directory === 'DOCUMENTS') { dosyalar.add(o.path); yol.push(o.path); } return { uri: 'file:///cache/' + o.path }; },
      stat: async o => { if (!dosyalar.has(o.path)) throw new Error('File does not exist'); return {}; } } } };
    try { for (let k = 0; k < 3; k++) await IrriReport.saveFile('IrriGrow_' + IrriReport.dosyaAdi('Büyük tarla'), 'pdf', 'JVBERg==', 'application/pdf'); }
    finally { window.Capacitor = eski; document.querySelectorAll('#fileSheet').forEach(e => e.remove()); }
    return yol;
  });
  check(yazilan.length === 3 && new Set(yazilan).size === 3 && /_2\.pdf$/.test(yazilan[1]) && /_3\.pdf$/.test(yazilan[2]), 'E-5 Android: aynı adlı dosyanın üzerine yazıldı: ' + yazilan.join(', '));
  check(new RegExp(`PE100 Ø${od} SDR17 PN10 \\(elle seçildi\\)`).test(hid), 'E-5 Excel Hidrolik sayfasında seçilen boru yok');
  await go(pg, 'hidrolik'); await pg.click('[data-ptab=tablo]'); await pg.waitForTimeout(400);
  const hx = await download(pg, '#hXls'); check(hx.buf.slice(0, 2).toString() === 'PK', 'E-5 Hidrolik Excel');
  await go(pg, 'teknik');
  const fmt = await pg.$('#tech select[data-o=format]'); if (fmt) { await fmt.selectOption('A3'); await pg.waitForTimeout(500); }
  const pa = await download(pg, '#tPdf'), dx = await download(pg, '#tDxf');
  check(/_pafta_A3.*\.pdf$/.test(pa.fn) && pa.buf.slice(0, 4).toString() === '%PDF', 'E-5 A3 pafta PDF');
  check(/\.dxf$/.test(dx.fn) && /SECTION/.test(dx.buf.toString('latin1').slice(0, 2000)), 'E-5 DXF');
  // E-6
  await go(pg, 'projeler');
  const yd = await download(pg, '#btnBackup'); const yj = JSON.parse(yd.buf.toString());
  const yp = yj.projects[0];
  check(yp.geoKaynak && yp.geoKaynak.kotDogrulanmis === false && yp.inp.boruSecimi && yp.inp.boruSecimi.ana.sdr === 17 && JSON.stringify(yp.shiftEdit) === shift0, 'E-6 yedek içeriği eksik');
  check(!errs.length, 'sayfa hatası: ' + errs.join(' | '));
  await ctx.close();
  {
    const { ctx: c2, pg: p2, errs: e2 } = await open();
    await p2.setInputFiles('#restoreFile', yd.fp); await p2.waitForTimeout(800);
    const ps = await p2.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1') || '[]'));
    const q = ps.find(x => x.id === yp.id);
    check(q && q.geoKaynak && q.geoKaynak.kotDogrulanmis === false && q.inp.boruSecimi.ana.od === od && JSON.stringify(q.shiftEdit) === shift0 && q.poly.length === 4, 'E-6 yedekten geri yükleme eksik');
    await p2.click(`[data-open="${yp.id}"]`); await p2.waitForTimeout(400); await go(p2, 'hidrolik');
    check(new RegExp(`PE100 Ø${od} SDR17 PN10`).test(await p2.$eval('#boruKarti', e => e.textContent)), 'E-6 geri yüklenen projede seçili boru yok');
    check(!e2.length, 'sayfa hatası (geri yükleme): ' + e2.join(' | '));
    await c2.close();
  }
  await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Uçtan uca (1.0): ${passes} kontrol geçti, ${fails} kontrol başarısız`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

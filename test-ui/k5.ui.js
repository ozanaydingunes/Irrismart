#!/usr/bin/env node
// K-5 — Kot verisi kaynakları ve sınırları (390 px telefon ve 1280 px masaüstü):
//  K5-a Harita atfı: Esri + Open-Meteo · Copernicus DEM
//  K5-b Open-Meteo yanıtı (test sahte yanıt verir) → harita bilgisinde "ön inceleme, ölçülmüş kot değil" notu ve "ayrıntı"
//  K5-c "ayrıntı" Ayarlar’daki "Veri kaynakları ve sınırlamalar" kartını açar: iki kaynak, lisans metni, 5 sınır, KML notu, gizlilik
//  K5-d Excel Varsayımlar: kot kaynağı, aralık, sınırlar, atıflar ve KML parsel kaynağı; PDF üretilir ve daha uzundur
//  K5-e KML’deki yükseklikler kullanılmaz: ölçülen kot Open-Meteo’dan (sahte yanıt 50–56 m), KML’deki 999 m değil
//  Yatay taşma yok; sayfa hatası yok
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const XLSX = require('../www/vendor/xlsx.full.min.js');
const ROOT = path.join(__dirname, '..', 'www');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };
const dik = (lat, lng, dLat, dLng) => [[lng, lat], [lng + dLng, lat], [lng + dLng, lat + dLat], [lng, lat + dLat], [lng, lat]].map(([x, y]) => `${x},${y},999`).join(' ');
const KML = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Kot tarlası</name><Polygon><altitudeMode>absolute</altitudeMode><outerBoundaryIs><LinearRing><coordinates>${dik(37.0, 35.0, 0.002, 0.003)}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`;

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'irri-k5-'));
  const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const URL0 = `http://localhost:${srv.address().port}/`, browser = await chromium.launch();
  for (const w of [390, 1280]) {
    const tag = `[${w}px]`;
    const ctx = await browser.newContext({ viewport: { width: w, height: 880 }, acceptDownloads: true });
    let kotIstegi = 0;
    // Sahte Open-Meteo yükseklik yanıtı: doğuya doğru yükselen düzlem (50–56 m)
    await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r => {
      kotIstegi++;
      const u = new URL(r.request().url()), lat = u.searchParams.get('latitude').split(','), lng = u.searchParams.get('longitude').split(',').map(Number);
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elevation: lat.map((_, i) => +(50 + (lng[i] - 35.0) / 0.003 * 6).toFixed(2)) }) });
    });
    await ctx.route(/^https?:\/\/(?!localhost)(?!api\.open-meteo\.com)/, r => r.abort());
    const pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
    await pg.goto(URL0); await pg.waitForTimeout(900);
    await pg.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
    // KML ile yeni proje → uygula (eğim ölçümü sahte Open-Meteo’dan)
    await pg.setInputFiles('#kmlFile', { name: 'kot.kml', mimeType: 'application/vnd.google-earth.kml+xml', buffer: Buffer.from(KML) });
    await pg.waitForTimeout(400); await pg.click('#kmlUygula'); await pg.waitForTimeout(2200);   // Uygula 1,4 s sonra Veriler ekranına geçer
    const p = await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0]);
    check(kotIstegi === 1 && p.elev && p.elev.zmin >= 49.9 && p.elev.zmax <= 56.1 && p.elev.zmax > 55, `${tag} K5-e kot Open-Meteo’dan alınmalı: ${JSON.stringify(p.elev)}`);
    check(p.inp.slopeLong > 0 || p.inp.slopeShort > 0, `${tag} K5-e eğim ölçülmedi`);
    check(p.geoKaynak && p.geoKaynak.yukseklikler.every(z => z === 999) && p.elev.zmax < 100, `${tag} K5-e KML yüksekliği (999 m) kot olarak kullanılmamalı`);
    // K5-a, K5-b
    await pg.click('nav.tabs [data-v=arazi]'); await pg.waitForTimeout(500);
    const atif = await pg.$eval('.leaflet-control-attribution', e => e.textContent);
    check(/Esri, Vantor, Earthstar Geographics/.test(atif) && /Open-Meteo\.com \(CC BY 4\.0\) · Copernicus DEM GLO-90/.test(atif) && await pg.$eval('.leaflet-control-attribution a[href="https://open-meteo.com/"]', a => a.target === '_blank').catch(() => false), `${tag} K5-a harita atfı: ${atif}`);
    check(await pg.isVisible('#kotNotu') && /ön inceleme, ölçülmüş kot değil/.test(await pg.textContent('#kotNotu')), `${tag} K5-b haritada kot notu yok`);
    // K5-c
    await pg.click('#kotBilgi'); await pg.waitForTimeout(500);
    check(!!(await pg.$('#v-ayarlar.on')) && await pg.$eval('#kaynakKarti', d => d.open), `${tag} K5-c "ayrıntı" Ayarlar kartını açmadı`);
    const kart = await pg.textContent('#kaynakKarti');
    for (const s of ['Esri World Imagery', 'Open-Meteo Elevation API', 'Copernicus DEM GLO-90', '© DLR e.V. 2010-2014', 'Çözünürlük yaklaşık 90 m', 'Yüzey modelidir', 'Düşey hata', 'düzlem uydurularak', 'doğrulanmış hidrolik kot değildir', 'hidrolik hesapta kullanılmaz', 'yalnız bu cihazda saklanır'])
      check(kart.includes(s), `${tag} K5-c kartta eksik: ${s}`);
    const ov = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth); check(ov <= 0, `${tag} yatay taşma ${ov}px`);
    // K5-d: Excel Varsayımlar ve PDF
    await pg.evaluate(() => { const P = JSON.parse(localStorage.getItem('irrismart.projects.v1')); P[0].inp.Q = 40; localStorage.setItem('irrismart.projects.v1', JSON.stringify(P)); });
    await pg.reload(); await pg.waitForTimeout(900);
    await pg.click('nav.tabs [data-v=projeler]'); await pg.waitForTimeout(300); await pg.click(`[data-open="${p.id}"]`); await pg.waitForTimeout(300);
    await pg.click('nav.tabs [data-v=sonuc]'); await pg.waitForTimeout(1200);
    const dl = async sel => { const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click(sel)]); const fp = path.join(tmp, w + '_' + d.suggestedFilename()); await d.saveAs(fp); return fs.readFileSync(fp); };
    const xb = await dl('#bXls'), pb = await dl('#bPdf');
    const rows = XLSX.utils.sheet_to_json(XLSX.read(xb).Sheets['Varsayımlar'], { header: 1 }).filter(r => r[0] === 'Veri kaynağı').map(r => r[1]);
    const hep = rows.join('\n');
    check(/Kot ve eğim kaynağı: Open-Meteo Elevation API — Copernicus DEM GLO-90/.test(hep) && /50–56 m/.test(hep), `${tag} K5-d Excel kot kaynağı/aralığı: ${rows[0]}`);
    check(/doğrulanmış hidrolik kot değildir/.test(hep) && /© DLR e\.V\./.test(hep) && /Esri, Vantor/.test(hep) && /Elevation data by Open-Meteo\.com \(https:\/\/open-meteo\.com\/\), CC BY 4\.0/.test(hep), `${tag} K5-d Excel sınır/atıf`);
    check(/Parsel sınırı: KML dosyası “kot\.kml”, parsel “Kot tarlası”/.test(hep) && /hidrolik hesapta kullanılmaz/.test(hep), `${tag} K5-d Excel KML kaynağı`);
    check(pb.slice(0, 4).toString() === '%PDF' && pb.length > 20000, `${tag} K5-d PDF üretilmedi`);
    // PDF kaynak bölümü: aynı projede kaynak bilgisi yokken PDF daha az sayfa/bayt
    const kisa = await pg.evaluate(async () => { const P = JSON.parse(localStorage.getItem('irrismart.projects.v1')); const q = P[0]; return IrriKaynak.projeSatirlari(Object.assign({}, q, { elev: null, geoKaynak: null })).length; });
    check(kisa === 0, `${tag} K5-d kaynaksız projede bölüm olmamalı`);
    check(!errs.length, `${tag} sayfa hatası: ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`K-5 arayüz testleri: ${passes} kontrol geçti, ${fails} kontrol başarısız`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

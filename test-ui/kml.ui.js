#!/usr/bin/env node
// MH-KML (K-4) — Tarayıcı testleri: KML/KMZ içe aktarma akışı.
//  • Dosya seçici (input[type=file]) ile KML ve KMZ; önizleme projeyi değiştirmez; İptal hiçbir şeyi değiştirmez.
//  • Birden çok parselde kullanıcı seçer; hesaplanamayan parsel seçilemez; önizleme katmanı haritada.
//  • Mevcut parsel onaysız değiştirilmez; onayla uygulanır, revizyon alınır, "İçe aktarmayı geri al" önceki hâle döner.
//  • Kaynak bilgisi (geoKaynak, kotDogrulanmis:false) projede ve yedekte saklanır.
//  • Güvensiz dosya (DOCTYPE) reddedilir; açık proje yoksa yeni proje oluşturulur; 390 px’te yatay taşma yok.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const C = require('../www/vendor/xlsx.full.min.js').CFB;
const ROOT = path.join(__dirname, '..', 'www');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const ESKI = [[37.0, 35.0], [37.0, 35.0012], [37.0008, 35.0012], [37.0008, 35.0]];
const PROJECTS = [{ id: 'p1', name: 'Eski parsel', created: 1, updated: 1, poly: ESKI, src: null, inp: { crop: 'domates', srcType: 'kuyu', region: 'akdeniz', soil: 'tinli', area_da: 10, L: 130, W: 89, Q: 45, depth: 40, geom: 'parsel' } }];
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };

const kare = (lat, lng, d) => [[lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat]].map(([x, y]) => `${x},${y},0`).join(' ');
const poly = k => `<Polygon><outerBoundaryIs><LinearRing><coordinates>${k}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
const pm = (ad, g) => `<Placemark><name>${ad}</name>${g}</Placemark>`;
const kml = g => `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${g}</Document></kml>`;
const IKI = kml(pm('Kuzey tarla', poly(kare(37.01, 35.01, 0.002))) + pm('Güney tarla', poly(kare(37.0, 35.01, 0.001))) + pm('Kelebek', poly('35,37 35.001,37.001 35.001,37 35,37.001 35,37')));
const TEK = kml(pm('<![CDATA[Tek <b>parsel</b>]]>', poly(kare(36.5, 34.5, 0.0015))));
const kmz = s => { const z = C.utils.cfb_new(); C.utils.cfb_add(z, 'doc.kml', Buffer.from(s)); return Buffer.from(C.write(z, { fileType: 'zip', type: 'array', compression: true })); };

(async () => {
  const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const port = srv.address().port, browser = await chromium.launch();
  const open = async (w, h, projs) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const disari = [];
    await ctx.route(/^https?:\/\/(?!localhost)/, r => { disari.push(r.request().url()); r.abort(); });
    const pg = await ctx.newPage(), errs = [], dialogs = [];
    const durum = { cevap: true };
    pg.on('pageerror', e => errs.push(e.message));
    pg.on('dialog', d => { dialogs.push(d.message()); d.type() === 'confirm' && !durum.cevap ? d.dismiss() : d.accept(); });
    await pg.addInitScript(p => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('irrismart.projects.v1', p); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(projs));
    await pg.goto(`http://localhost:${port}/`); await pg.waitForTimeout(900);
    await pg.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
    return { ctx, pg, errs, dialogs, durum, disari };
  };
  const kayit = pg => pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1')));
  const yukle = async (pg, name, buffer, mimeType = 'application/vnd.google-earth.kml+xml') => { await pg.setInputFiles('#kmlFile', { name, mimeType, buffer: Buffer.from(buffer) }); await pg.waitForTimeout(350); };
  // Harita canvas ile çiziliyor: seçili parselin turuncu (#ff6f00) çizgisi piksel olarak aranır (karo görüntüleri engelli → canvas temiz)
  const turuncu = pg => pg.evaluate(() => { let n = 0; for (const c of document.querySelectorAll('#map canvas')) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && Math.abs(d[i + 1] - 111) < 20 && d[i + 2] < 30 && d[i + 3] > 200) n++; } return n > 50 ? 1 : 0; });

  // 1) Mevcut projede: önizleme, seçim, iptal, onay reddi, uygula, geri al, yedek — telefon (390 px)
  {
    const { ctx, pg, errs, dialogs, durum, disari } = await open(390, 844, PROJECTS);
    await pg.click('[data-v=projeler]'); await pg.waitForTimeout(200); await pg.click('[data-open=p1]'); await pg.waitForTimeout(300);
    await pg.click('[data-v=arazi]'); await pg.waitForTimeout(500);
    check(await pg.isVisible('#mKml'), 'KML/KMZ düğmesi görünmüyor');
    check(!(await pg.isVisible('#mKmlGeri')), 'içe aktarma yokken "geri al" görünmemeli');
    const once = JSON.stringify(await kayit(pg));
    await yukle(pg, 'iki.kml', IKI);
    check(await pg.isVisible('#kmlPanel'), 'önizleme paneli açılmadı');
    const satir = await pg.$$eval('#kmlListe input[name=kmlP]', rs => rs.map(r => ({ v: r.value, d: r.disabled, c: r.checked })));
    check(satir.length === 3, `3 aday bekleniyor: ${satir.length}`);
    check(satir.filter(r => r.d).length === 1, 'kendini kesen parsel seçilemez olmalı');
    check(satir.every(r => !r.c) && await pg.isDisabled('#kmlUygula'), 'birden çok uygun parselde seçim kullanıcıya bırakılmalı');
    const txt = await pg.textContent('#kmlPanel');
    check(/kendini kesiyor/.test(txt) && /Önizleme/.test(txt) && /da/.test(txt), 'panel metni eksik');
    check(JSON.stringify(await kayit(pg)) === once, 'önizleme projeyi değiştirdi');
    await pg.check(`#kmlListe input[value="${satir[1].v}"]`); await pg.waitForTimeout(150);
    check(!(await pg.isDisabled('#kmlUygula')), 'seçimden sonra "Projeye uygula" etkin olmalı');
    check(await turuncu(pg) === 1, 'seçilen parsel haritada vurgulanmalı');
    const ov = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth); check(ov <= 0, `390 px yatay taşma ${ov}px`);
    // İptal
    await pg.click('#kmlIptal'); await pg.waitForTimeout(150);
    check(!(await pg.isVisible('#kmlPanel')) && await turuncu(pg) === 0, 'İptal paneli/önizlemeyi kapatmadı');
    check(JSON.stringify(await kayit(pg)) === once, 'İptal projeyi değiştirdi');
    // Onay reddi: mevcut parsel korunur
    await yukle(pg, 'iki.kml', IKI);
    await pg.check(`#kmlListe input[value="${satir[1].v}"]`);
    durum.cevap = false; dialogs.length = 0; await pg.click('#kmlUygula'); await pg.waitForTimeout(200);
    check(dialogs.some(m => /çizilmiş bir parsel var/.test(m)), 'mevcut parselin üzerine yazmadan önce onay sorulmadı');
    check(JSON.stringify((await kayit(pg))[0].poly) === JSON.stringify(ESKI), 'onay reddedilince parsel değişti');
    // Onay: uygulanır
    durum.cevap = true; await pg.click('#kmlUygula'); await pg.waitForTimeout(600);
    let p = (await kayit(pg))[0];
    check(p.poly.length === 4 && Math.abs(p.poly[0][0] - 37.0) < 1e-9 && Math.abs(p.poly[0][1] - 35.01) < 1e-9, 'seçilen parsel uygulanmadı: ' + JSON.stringify(p.poly[0]));
    check(p.geoKaynak && p.geoKaynak.tur === 'kml' && p.geoKaynak.dosya === 'iki.kml' && p.geoKaynak.parsel === 'Güney tarla' && p.geoKaynak.kotDogrulanmis === false, 'geoKaynak: ' + JSON.stringify(p.geoKaynak));
    check(Array.isArray(p.geoKaynak.yukseklikler), 'KML yükseklikleri saklanmalı (kot sayılmadan)');
    const rv = p.kmlGeriAl && (p.revs || []).find(r => r.rev === p.kmlGeriAl.rev);   // aynı içerikli son revizyon yeniden yazılmaz
    check(rv && JSON.stringify(JSON.parse(rv.data).poly) === JSON.stringify(ESKI), 'içe aktarma öncesi parsel revizyonda yok');
    check(Math.abs(p.inp.area_da - 9.87) < 0.1 && p.inp.geom === 'parsel', 'alan uygulanmadı: ' + p.inp.area_da);
    check(!(await pg.isVisible('#kmlPanel')), 'uygulamadan sonra panel kapanmalı');
    // Yedek: geoKaynak yedekte
    const yedek = await pg.evaluate(() => IrriStore.backupPayload(JSON.parse(localStorage.getItem('irrismart.projects.v1'))));
    check(yedek.projects[0].geoKaynak && yedek.projects[0].geoKaynak.parsel === 'Güney tarla', 'geoKaynak yedekte yok');
    const geri = await pg.evaluate(() => IrriStore.readBackup(JSON.stringify(IrriStore.backupPayload(JSON.parse(localStorage.getItem('irrismart.projects.v1'))))));
    check(geri.valid[0].geoKaynak && geri.valid[0].geoKaynak.kotDogrulanmis === false, 'geoKaynak yedekten geri okunmadı');
    // Geri al
    await pg.click('[data-v=arazi]'); await pg.waitForTimeout(400);
    check(await pg.isVisible('#mKmlGeri'), '"İçe aktarmayı geri al" görünmüyor');
    dialogs.length = 0; await pg.click('#mKmlGeri'); await pg.waitForTimeout(300);
    check(dialogs.some(m => /geri alınsın mı/.test(m)), 'geri alma onayı sorulmadı');
    p = (await kayit(pg))[0];
    check(JSON.stringify(p.poly) === JSON.stringify(ESKI) && !p.geoKaynak && !p.kmlGeriAl && p.inp.area_da === 10, 'geri alma önceki hâli getirmedi');
    check(!(await pg.isVisible('#mKmlGeri')), 'geri almadan sonra düğme gizlenmeli');
    // Güvensiz dosya
    dialogs.length = 0;
    await yukle(pg, 'kotu.kml', '<?xml version="1.0"?><!DOCTYPE kml [<!ENTITY x SYSTEM "file:///etc/passwd">]><kml><Placemark><name>&x;</name></Placemark></kml>');
    check(dialogs.some(m => /DOCTYPE/.test(m)), 'DOCTYPE uyarısı gösterilmedi');
    check(!(await pg.isVisible('#kmlPanel')), 'güvensiz dosyada panel açılmamalı');
    check(!disari.some(u => /invalid|passwd/.test(u)), 'dış istek yapıldı');
    check(!errs.length, 'sayfa hatası: ' + errs.join(' | '));
    await ctx.close();
  }

  // 2) Açık proje yokken KMZ: tek parsel otomatik seçilir, yeni proje oluşur; metin olarak gösterilir (betik değil) — masaüstü
  {
    const { ctx, pg, errs } = await open(1280, 900, []);
    check(await pg.isVisible('#btnKmlYeni'), 'Projeler ekranında "KML/KMZ dosyasından yeni proje" yok');
    // İptal: geçici proje silinir, hiçbir şey değişmez
    await yukle(pg, 'tek.kmz', kmz(TEK), 'application/vnd.google-earth.kmz');
    check(await pg.isVisible('#kmlPanel'), 'KMZ paneli açılmadı (proje yokken)');
    check((await kayit(pg)).length === 1 && (await kayit(pg))[0].poly.length === 0, 'önizleme için geçici proje beklenir');
    await pg.click('#kmlIptal'); await pg.waitForTimeout(300);
    check((await kayit(pg)).length === 0, 'İptal geçici projeyi silmedi');
    // Ekrandan çıkış da geçici projeyi siler
    await yukle(pg, 'tek.kmz', kmz(TEK), 'application/vnd.google-earth.kmz');
    await pg.click('[data-v=projeler]'); await pg.waitForTimeout(300);
    check((await kayit(pg)).length === 0, 'ekrandan çıkınca geçici proje silinmedi');
    await yukle(pg, 'tek.kmz', kmz(TEK), 'application/vnd.google-earth.kmz');
    check(await pg.isVisible('#kmlPanel'), 'KMZ paneli açılmadı');
    check(await pg.$$eval('#kmlListe input[name=kmlP]:checked', r => r.length) === 1 && !(await pg.isDisabled('#kmlUygula')), 'tek uygun parsel kendiliğinden seçilmeli');
    check(await pg.$$eval('#kmlPanel b b', x => x.length) === 0 && /Tek <b>parsel<\/b>/.test(await pg.textContent('#kmlListe')), 'parsel adı HTML olarak işlendi');
    await pg.click('#kmlUygula'); await pg.waitForTimeout(600);
    const ps = await kayit(pg);
    check(ps.length === 1 && ps[0].poly.length === 4 && ps[0].geoKaynak.tur === 'kmz' && /doc\.kml$/.test(ps[0].geoKaynak.icDosya), 'KMZ ile yeni proje oluşmadı: ' + JSON.stringify(ps.map(p => p.geoKaynak)));
    check(ps[0].name === 'Tek <b>parsel</b>', 'proje adı: ' + ps[0].name);
    check(!errs.length, 'sayfa hatası: ' + errs.join(' | '));
    await ctx.close();
  }

  await browser.close(); srv.close();
  console.log(`KML arayüz testleri: ${passes} geçti, ${fails} başarısız`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

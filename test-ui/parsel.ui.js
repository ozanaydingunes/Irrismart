#!/usr/bin/env node
// Çoklu parsel (1.0.7 düzeltme) — tarayıcı testleri. Masaüstü 1366×768 ve 1920×1080, telefon 390 px.
//  • Tek parsel KML (önceki akış), iki parselli KML (çoklu seçim, Tümünü seç / Seçimi temizle, nokta parsel sayılmaz),
//    çok parselli KMZ; seçilenler AYRI parseller olarak eklenir (birleştirilmez); KML yüksekliği kot sayılmaz.
//  • Elle iki ve üç parsel çizimi; KML parseline sonradan elle parsel ekleme; parsel seçme, yeniden adlandırma, silme;
//    köşe taşıma diğer parsellerin geometrisini bozmaz; her parselin kendi kaynağı.
//  • Bağımsız hidrolik: her parsel ayrı hesaplanır (Sonuç ekranı parsel özeti), eksik parsel "hesaplandı" görünmez.
//  • Eski tek parselli proje değişmeden açılır ve aynı sonucu verir. JSON yedek / geri yükleme, PDF ve Excel.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const C = require('../www/vendor/xlsx.full.min.js').CFB;
const ROOT = path.join(__dirname, '..', 'www');
const OUT = process.env.EKRAN_DIZIN || null;
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };

const kare = (lat, lng, d, e) => [[lng, lat], [lng + d, lat], [lng + d, lat + e], [lng, lat + e], [lng, lat]].map(([x, y]) => `${x},${y},12`).join(' ');
const pm = (ad, k) => `<Placemark><name>${ad}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${k}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
const kml = g => `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${g}</Document></kml>`;
const TEK = kml(pm('Tek tarla', kare(38.30, 27.60, 0.004, 0.003)));
const IKI = kml(pm('FIELD1', kare(38.10, 27.70, 0.006, 0.004)) + pm('field2 tire', kare(38.09, 27.715, 0.005, 0.004)) + '<Placemark><name>Kuyu 1</name><Point><coordinates>27.702,38.101,0</coordinates></Point></Placemark>');
const COK = kml(Array.from({ length: 5 }, (_, i) => pm('Blok ' + (i + 1), kare(38.20 + i * 0.006, 27.80, 0.004, 0.004))).join(''));
const kmz = s => { const z = C.utils.cfb_new(); C.utils.cfb_add(z, 'doc.kml', Buffer.from(s)); return Buffer.from(C.write(z, { fileType: 'zip', type: 'array', compression: true })); };
const ESKI_POLY = [[37.0, 35.0], [37.0, 35.0012], [37.0008, 35.0012], [37.0008, 35.0]];
const PROJ = [
  { id: 'eski', name: 'Eski tek parsel', created: 1, updated: 1, schema: 2, rev: 3, revs: [], poly: ESKI_POLY, src: [37.0001, 35.0001], inp: { crop: 'domates', srcType: 'kuyu', region: 'akdeniz', soil: 'tinli', area_da: 10, L: 130, W: 89, Q: 45, depth: 40, geom: 'parsel' } },
  { id: 'bos', name: 'Boş proje', created: 2, updated: 2, schema: 2, rev: 1, revs: [], poly: [], src: null, inp: { crop: 'domates', srcType: 'kuyu', region: 'akdeniz', soil: 'tinli', geom: 'parsel' } },
];

(async () => {
  const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const port = srv.address().port, browser = await chromium.launch();
  const open = async (w, h, ek = {}) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: w, height: h }, acceptDownloads: true }, ek));
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const pg = await ctx.newPage(), errs = [], cevap = [];
    pg.on('pageerror', e => errs.push(e.message));
    pg.on('dialog', d => d.type() === 'prompt' ? d.accept(cevap.length ? cevap.shift() : d.defaultValue()) : d.accept());
    await pg.addInitScript(p => { if (!sessionStorage.getItem('s')) { localStorage.setItem('irrismart.projects.v1', p); sessionStorage.setItem('s', '1'); } }, JSON.stringify(PROJ));
    await pg.goto(`http://localhost:${port}/`); await pg.waitForTimeout(800);
    await pg.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
    await pg.evaluate(() => L.Map.addInitHook(function () { window.__map = this; }));
    return { ctx, pg, errs, cevap };
  };
  const projeAc = async (pg, id) => { await pg.click('[data-v=projeler]'); await pg.waitForTimeout(150); await pg.click(`[data-open=${id}]`); await pg.waitForTimeout(250); await pg.click('[data-v=arazi]'); await pg.waitForTimeout(600); };
  const kayit = (pg, id) => pg.evaluate(id => JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(p => p.id === id), id);
  const yukle = async (pg, name, buffer, mimeType = 'application/vnd.google-earth.kml+xml') => { await pg.setInputFiles('#kmlFile', { name, mimeType, buffer: Buffer.from(buffer) }); await pg.waitForTimeout(600); };
  const parselSay = p => 1 + ((p && p.parseller) || []).length;
  // Haritada sınır çizimi: harita merkezine göre piksel ofsetlerine dokunulur
  const ciz = async (pg, merkez, ofs) => {
    await pg.evaluate(c => __map.setView(c, 16, { animate: false }), merkez); await pg.waitForTimeout(250);
    const b = await pg.evaluate(() => { const r = document.querySelector('#map').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    for (const [dx, dy] of ofs) { await pg.mouse.click(b.x + b.w / 2 + dx, b.y + b.h * 0.45 + dy); await pg.waitForTimeout(120); }
  };
  const modu = async (pg, m) => { await pg.click(`#mModes [data-m=${m}]`); await pg.waitForTimeout(150); };

  // ================= Masaüstü 1366×768 =================
  {
    const { ctx, pg, errs, cevap } = await open(1366, 768);
    // 1) Eski tek parselli proje: değişmeden açılır, sonuç aynı
    await projeAc(pg, 'eski');
    const eskiSonuc = await pg.evaluate(() => { const A = window.IrriApp.ekipmanBaglam(); return JSON.stringify({ Q: A.r.sel.Qj, ana: A.r.main.sel.od, H: A.r.pump && A.r.pump.H }); });
    const motorSonuc = await pg.evaluate(p => { const r = window.IrriEngine.design(p.inp, null, { poly: p.poly, src: p.src }); return JSON.stringify({ Q: r.sel.Qj, ana: r.main.sel.od, H: r.pump && r.pump.H }); }, PROJ[0]);
    check(eskiSonuc === motorSonuc, 'eski proje: uygulama sonucu motorun tek parsel sonucuyla aynı');
    let e = await kayit(pg, 'eski');
    check(!('parseller' in e) && !('parselId' in e) && JSON.stringify(e.poly) === JSON.stringify(ESKI_POLY), 'eski projeye çoklu parsel alanı eklenmedi');
    check(await pg.isVisible('#parselBar') && /Parsel 1/.test(await pg.textContent('#parselBar')) && await pg.isVisible('#pYeni'), 'tek parselde parsel şeridi ve "＋ Parsel"');

    // 2) Tek parsel KML (boş projede önceki akış: Projeye aktar → parsel)
    await projeAc(pg, 'bos');
    await yukle(pg, 'tek.kml', TEK);
    check(await pg.$$eval('#kmlListe input[name=kmlP]', r => r.length === 1 && r[0].type === 'checkbox' && r[0].checked), 'tek parsel: onay kutusu kendiliğinden seçili');
    await pg.click('#kmlUygula'); await pg.waitForTimeout(1800);
    let b = await kayit(pg, 'bos');
    check(b.poly.length === 4 && !b.parseller && b.geoKaynak && b.geoKaynak.kotDogrulanmis === false && b.geoKaynak.yukseklikler, 'tek parsel KML: önceki akış, tek parsel; yükseklik saklandı ama kot doğrulanmış sayılmadı');
    await pg.click('[data-v=arazi]'); await pg.waitForTimeout(500);

    // 3) Aynı projeye iki parselli KML: Tümünü seç / Seçimi temizle; nokta parsel değil; ayrı parsel olarak ekle
    await yukle(pg, 'iki.kml', IKI);
    const liste = await pg.$$eval('#kmlListe input[name=kmlP]', r => r.map(x => ({ t: x.type, c: x.checked })));
    check(liste.length === 2 && liste.every(x => x.t === 'checkbox' && !x.c) && /1 nokta \(Point\) parsel olarak alınmadı/.test(await pg.textContent('#kmlPanel')), 'iki parsel listelendi (onay kutusu, seçim kullanıcıda); nokta parsel sayılmadı');
    check(await pg.isDisabled('#kmlEkle') && await pg.isDisabled('#kmlUygula'), 'seçim yokken ekleme / değiştirme kapalı');
    await pg.click('#kmlTum'); await pg.waitForTimeout(300);
    const onz = await pg.evaluate(() => { let n = 0, tip = []; __map.eachLayer(l => { if (l instanceof L.Polygon && l.options.color === '#ff6f00') { n++; if (l.getTooltip()) tip.push(l.getTooltip().getContent()); } }); return { n, tip }; });
    check(onz.n === 2 && onz.tip.includes('FIELD1') && onz.tip.includes('field2 tire'), 'seçilen iki parsel haritada aynı anda, adlarıyla önizlendi ' + JSON.stringify(onz));
    check(/2 parsel/.test(await pg.textContent('#kmlSecili')) && await pg.isDisabled('#kmlUygula') && /2 parseli ekle/.test(await pg.textContent('#kmlEkle')), 'iki seçimde "2 parseli ekle"; "aktif parseli değiştir" yalnız tek seçimde');
    await pg.click('#kmlHic'); await pg.waitForTimeout(200);
    check(await pg.$$eval('#kmlListe input:checked', r => r.length) === 0 && await pg.isDisabled('#kmlEkle'), 'Seçimi temizle');
    check(JSON.stringify((await kayit(pg, 'bos')).poly) === JSON.stringify(b.poly), 'önizleme projeyi değiştirmedi');
    if (OUT) { await pg.click('#kmlTum'); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(OUT, '1366-kml-coklu-secim.png') }); }
    else { await pg.click('#kmlTum'); await pg.waitForTimeout(200); }
    await pg.click('#kmlEkle'); await pg.waitForTimeout(800);
    b = await kayit(pg, 'bos');
    check(parselSay(b) === 3 && b.parseller.map(x => x.ad).sort().join('|') === 'FIELD1|field2 tire' && b.parseller.every(x => x.poly.length === 4 && x.inp.area_da > 0 && x.geoKaynak && x.geoKaynak.kotDogrulanmis === false), 'iki KML parseli ayrı parseller olarak eklendi (birleştirilmedi), alanları ve kaynak bilgileri ayrı');
    check(b.poly.length === 4 && P1(b) === 'Parsel 1', 'aktif parsel (ilk parsel) korundu');
    function P1(p) { return p.parselAd || 'Parsel 1'; }
    const diger = await pg.evaluate(() => { let n = 0, tip = []; __map.eachLayer(l => { if (l instanceof L.Polygon && l.getTooltip && l.getTooltip()) { n++; tip.push(l.getTooltip().getContent()); } }); return tip; });
    check(diger.some(x => /FIELD1/.test(x)) && diger.some(x => /field2 tire/.test(x)) && diger.some(x => /aktif/.test(x)), 'bütün parseller haritada adlarıyla: ' + JSON.stringify(diger));
    check((await pg.$$('#parselBar [data-parsel]')).length === 3, 'parsel şeridinde 3 parsel');
    if (OUT) await pg.screenshot({ path: path.join(OUT, '1366-uc-parsel.png') });

    // 4) KML parsellerine sonradan elle parsel ekleme; köşe taşıma diğerlerini bozmaz
    const kmlPoly = p => JSON.stringify(p.parseller.filter(x => x.ad === 'FIELD1' || x.ad === 'field2 tire').map(x => x.poly));
    const onceDiger = kmlPoly(await kayit(pg, 'bos'));
    cevap.push('Elle çizilen');
    await pg.click('#pYeni'); await pg.waitForTimeout(400);
    check((await kayit(pg, 'bos')).parselAd === 'Elle çizilen' && await pg.evaluate(() => document.querySelector('#mModes [data-m=sinir]').classList.contains('on')), 'yeni parsel aktif ve Sınır modunda');
    await ciz(pg, [38.08, 27.73], [[-60, -40], [60, -40], [60, 40], [-60, 40]]);
    b = await kayit(pg, 'bos');
    check(b.poly.length === 4 && parselSay(b) === 4, 'elle dört köşeli parsel çizildi (4 parsel)');
    check(kmlPoly(b) === onceDiger && JSON.parse(onceDiger).length === 2, 'KML parselleri elle çizimde değişmedi');
    // köşe taşı (sürükle)
    const vtx = await pg.$$('#map .vtx'); const vb = await vtx[0].boundingBox();
    await pg.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2); await pg.mouse.down(); await pg.mouse.move(vb.x + 30, vb.y + 25, { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(300);
    const b2 = await kayit(pg, 'bos');
    check(JSON.stringify(b2.poly[0]) !== JSON.stringify(b.poly[0]) && JSON.stringify(b2.parseller) === JSON.stringify(b.parseller), 'aktif parselin köşesi taşındı; diğer parseller değişmedi');
    // kaynak: bu parselin kendi kuyusu
    await modu(pg, 'kaynak'); await ciz(pg, [38.08, 27.73], [[0, 0]]);
    b = await kayit(pg, 'bos');
    check(Array.isArray(b.src) && b.parseller.every(x => !x.src), 'kaynak yalnız aktif parsele işaretlendi');

    // 5) Parsel seçimi (çip), yeniden adlandırma, silme
    await pg.click('#parselBar [data-parsel]:has-text("field2 tire")'); await pg.waitForTimeout(500);
    b = await kayit(pg, 'bos');
    check(b.parselAd === 'field2 tire' && b.poly.length === 4 && !b.src && b.parseller.find(x => x.ad === 'Elle çizilen').src, 'çiple parsel değiştirildi; kaynaklar parsele ait kaldı');
    check(/field2 tire/.test(await pg.textContent('#projName')), 'başlıkta aktif parsel');
    await modu(pg, 'kaynak'); await ciz(pg, [38.092, 27.7175], [[0, 0]]);
    cevap.push('Tire 2');
    await pg.click('#pAd'); await pg.waitForTimeout(300);
    check((await kayit(pg, 'bos')).parselAd === 'Tire 2' && /Tire 2/.test(await pg.textContent('#parselBar')), 'yeniden adlandırıldı');
    // FIELD1'i sil (aktif yapıp)
    await pg.click('#parselBar [data-parsel]:has-text("FIELD1")'); await pg.waitForTimeout(400);
    await pg.click('#pSil'); await pg.waitForTimeout(400);
    b = await kayit(pg, 'bos');
    check(parselSay(b) === 3 && ![b.parselAd].concat(b.parseller.map(x => x.ad)).includes('FIELD1'), 'parsel silindi; diğerleri kaldı');

    // 6) Bağımsız hidrolik: her parsele kaynak debisi girilir (Veriler formu aktif parsele yazar)
    const debiGir = async (q, d) => { await pg.click('[data-v=veri]'); await pg.waitForTimeout(400); await pg.evaluate(([q, d]) => { const A = window.IrriApp.ekipmanBaglam(); A.kaydet(null, c => { c.inp.Q = q; c.inp.depth = d; }); }, [q, d]); await pg.waitForTimeout(200); };
    for (const [ad, q, d] of [['Parsel 1', 45, 40], ['Tire 2', 30, 25], ['Elle çizilen', 20, 15]]) {
      await pg.click('[data-v=arazi]'); await pg.waitForTimeout(300);
      const btn = await pg.$(`#parselBar [data-parsel]:has-text("${ad}")`); if (btn) { await btn.click(); await pg.waitForTimeout(400); }
      await debiGir(q, d);
    }
    await pg.click('[data-v=sonuc]'); await pg.waitForTimeout(1500);
    const kart = await pg.textContent('#parselOzet').catch(() => '');
    check(/Proje parselleri \(3\)/.test(kart) && (kart.match(/Hesaplandı/g) || []).length >= 3 && /Proje toplamı/.test(kart) && /ayrı hesaplanır/.test(kart), 'Sonuç: 3 parsel ayrı hesaplandı, proje toplamı: ' + kart.slice(0, 300));
    const oz = await pg.evaluate(() => { const P = window.IrriParsel, A = window.IrriApp.ekipmanBaglam(); return P.ozetAl(A.cur); });
    check(oz && oz.parseller.every(x => x.durum === 'hesaplandi' && x.shift > 0) && oz.toplam.shift === oz.parseller.reduce((s, x) => s + x.shift, 0) && new Set(oz.parseller.map(x => x.Q)).size === 3, 'her parsel kendi kaynak debisiyle; shift toplamı');
    const bagimsiz = await pg.evaluate(() => { const A = window.IrriApp.ekipmanBaglam(), P = window.IrriParsel, oz = P.ozetAl(A.cur); return P.liste(A.cur).every(x => { const v = x.veri, r = window.IrriEngine.design(v.inp, null, { poly: v.poly, src: v.src, station: v.station, route: v.route, manual: v.shiftEdit || v.shiftEditEski || null }), s = oz.parseller.find(y => y.id === x.id); return r.ok && s.shift === r.sel.groups.length && Math.abs(s.Qsys - Math.max(...r.sel.Qj)) < 1e-9; }); });
    check(bagimsiz, 'parsel sonuçları her parselin tek başına motor hesabıyla aynı (parseller birbirine bağlı sayılmadı)');
    if (OUT) await pg.screenshot({ path: path.join(OUT, '1366-sonuc-parseller.png'), fullPage: false });

    // 7) PDF ve Excel: parsel bölümü
    const rap = await pg.evaluate(() => { const A = window.IrriApp.ekipmanBaglam(), R = window.IrriReportData, b = R.build(A.cur, A.r), wb = R.workbook(window.XLSX, A.cur, A.r); return { parsel: b.parsel && b.parsel.rows.length, ozet: b.ozet.slice(0, 3).map(x => x[0]), sayfalar: wb.SheetNames, ps: JSON.stringify(window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames.find(n => /Parsel/.test(n))], { header: 1 })) }; });
    check(rap.parsel === 5 && rap.sayfalar.includes('Parseller') && /Proje toplamı/.test(rap.ps) && /Tire 2/.test(rap.ps) && /Aktif parsel/.test(rap.ozet[0]), 'Excel "Parseller" sayfası ve rapor özeti: ' + JSON.stringify(rap).slice(0, 200));
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 30000 }), pg.click('#bPdf')]);
    const pdfYol = await dl.path(), pdf = fs.readFileSync(pdfYol);
    check(pdf.length > 20000 && pdf.slice(0, 5).toString() === '%PDF-', 'PDF raporu üretildi (' + pdf.length + ' bayt)');

    // 8) JSON yedek / geri yükleme: bütün parseller korunur
    const yd = await pg.evaluate(() => { const S = window.IrriStore, ps = JSON.parse(localStorage.getItem('irrismart.projects.v1')), y = JSON.stringify(S.backupPayload(ps, {}, null)), g = S.readBackup(y).valid, liste = []; S.mergeBackup(liste, g); const b = liste.find(p => p.id === 'bos'); return { n: 1 + (b.parseller || []).length, ad: [b.parselAd].concat(b.parseller.map(x => x.ad)).sort(), poly: b.parseller.every(x => x.poly.length >= 3) }; });
    check(yd.n === 3 && yd.poly && yd.ad.join('|') === 'Elle çizilen|Parsel 1|Tire 2', 'JSON yedekte bütün parseller: ' + JSON.stringify(yd));
    check((await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)), '1366: yatay taşma yok');
    check(!errs.length, '1366 sayfa hatası: ' + errs.join(' | '));
    await ctx.close();
  }

  // ================= Elle 2 ve 3 parsel + KMZ (1920×1080) =================
  {
    const { ctx, pg, errs, cevap } = await open(1920, 1080);
    await projeAc(pg, 'bos');
    await ciz(pg, [38.0, 27.5], [[-80, -50], [80, -50], [80, 50], [-80, 50]]);
    cevap.push('İkinci'); await pg.click('#pYeni'); await pg.waitForTimeout(300);
    await ciz(pg, [38.0, 27.52], [[-60, -40], [60, -40], [0, 50]]);
    cevap.push('Üçüncü'); await pg.click('#pYeni'); await pg.waitForTimeout(300);
    await ciz(pg, [38.0, 27.54], [[-50, -50], [50, -50], [50, 50], [-50, 50], [-70, 0]]);
    let b = await kayit(pg, 'bos');
    check(parselSay(b) === 3 && b.poly.length === 5 && b.parseller.map(x => x.poly.length).sort().join() === '3,4', 'elle üç bağımsız parsel çizildi (4, 3, 5 köşe)');
    await pg.click('#pHepsi'); await pg.waitForTimeout(300);
    const gor = await pg.evaluate(() => { const bb = __map.getBounds(); let n = 0; __map.eachLayer(l => { if (l instanceof L.Polygon && bb.contains(l.getBounds().getCenter())) n++; }); return n; });
    check(gor >= 3, 'Bütün parselleri göster: üç parsel görünür alanda');
    // Başka parsele haritadan dokunarak geçiş (onaylı)
    const merkez = await pg.evaluate(() => { let c = null; __map.eachLayer(l => { if (l instanceof L.Polygon && l.options.dashArray === '6 4' && !c) { const p = __map.latLngToContainerPoint(l.getBounds().getCenter()); c = [p.x, p.y]; } }); return c; });
    const mb = await pg.evaluate(() => { const r = document.querySelector('#map').getBoundingClientRect(); return [r.left, r.top]; });
    const onceAktif = (await kayit(pg, 'bos')).parselAd;
    await modu(pg, 'sinir'); await pg.mouse.click(mb[0] + merkez[0], mb[1] + merkez[1]); await pg.waitForTimeout(500);
    b = await kayit(pg, 'bos');
    check(b.parselAd !== onceAktif && parselSay(b) === 3 && [b.poly.length].concat(b.parseller.map(x => x.poly.length)).sort().join() === '3,4,5', 'haritada başka parsele dokunmak o parsele geçirdi; köşe eklenmedi');
    if (OUT) await pg.screenshot({ path: path.join(OUT, '1920-elle-uc-parsel.png') });
    // Çok parselli KMZ yeni projeye
    await pg.click('[data-v=projeler]'); await pg.waitForTimeout(200);
    await pg.click('#btnKmlYeni').catch(() => {});
    await pg.setInputFiles('#kmlFile', { name: 'bloklar.kmz', mimeType: 'application/vnd.google-earth.kmz', buffer: kmz(COK) }); await pg.waitForTimeout(800);
    check(await pg.$$eval('#kmlListe input[name=kmlP]', r => r.length) === 5, 'KMZ: 5 parsel listelendi');
    await pg.click('#kmlTum'); await pg.waitForTimeout(200); await pg.click('#kmlUygula'); await pg.waitForTimeout(800);
    const yeni = await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0]);
    check(parselSay(yeni) === 5 && [yeni.parselAd].concat(yeni.parseller.map(x => x.ad)).sort().join('|') === 'Blok 1|Blok 2|Blok 3|Blok 4|Blok 5' && yeni.name === 'bloklar', 'KMZ: 5 parsel tek yeni projeye ayrı parseller olarak aktarıldı');
    check(!errs.length, '1920 sayfa hatası: ' + errs.join(' | '));
    await ctx.close();
  }

  // ================= Telefon 390 px =================
  {
    const { ctx, pg, errs } = await open(390, 844, { isMobile: true, hasTouch: true });
    await projeAc(pg, 'eski');
    check(JSON.stringify((await kayit(pg, 'eski')).poly) === JSON.stringify(ESKI_POLY), '390: eski proje değişmedi');
    await yukle(pg, 'iki.kml', IKI);
    await pg.click('#kmlTum'); await pg.waitForTimeout(200);
    check(await pg.isVisible('#kmlEkle') && await pg.evaluate(() => !!document.querySelector('#kmlPanel').closest('.mapbar')), '390: KML paneli alt çubukta, ekleme düğmesi görünür');
    await pg.click('#kmlEkle'); await pg.waitForTimeout(800);
    check(parselSay(await kayit(pg, 'eski')) === 3, '390: iki parsel eski projeye eklendi');
    check(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '390: yatay taşma yok');
    const serit = await pg.evaluate(() => { const r = document.querySelector('#parselBar').getBoundingClientRect(); return { h: r.height, w: r.width }; });
    check(serit.h <= 44 && serit.w <= 390, '390: parsel şeridi tek satır ' + JSON.stringify(serit));
    if (OUT) await pg.screenshot({ path: path.join(OUT, '390-parseller.png') });
    check(!errs.length, '390 sayfa hatası: ' + errs.join(' | '));
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`Çoklu parsel: ${passes} denetim geçti, ${fails} başarısız`);
  process.exit(fails ? 1 : 0);
})();

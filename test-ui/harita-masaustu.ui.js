#!/usr/bin/env node
// 1.0.7 düzeltme — Masaüstü Arazi haritası ve KML/KMZ paneli (yalnız yerleşim; hesap motoru değişmez).
//  • 1366×768, 1440×900, 1920×1080, 1280×720: harita kullanılabilir yüksekliğin ≥ %60'ı ve ≥ 320 px; KML/KMZ paneli açıkken de küçülmez.
//  • KML ve KMZ; çok parselli liste kendi içinde kayar; panel daraltılır / genişletilir (seçim korunur); seçili parsel
//    haritada vurgulu ve panelin altında kalmaz; önizleme projeyi değiştirmez, "Projeye uygula" ayrı.
//  • Harita boyutu değişince (pencere, panel, tam ekran, sağ panel, alt panel) Leaflet boyutu kabla aynı.
//  • Hesap sonucu yokken sağ panel ince şerit; açılınca harita ve sonuçlar kaybolmaz. Alt panel haritayı 320 px altına indiremez.
//  • Shift, ana hat ve kaynak katmanları panel / tam ekran işlemlerinden sonra korunur.
//  • Telefon 390 px ve 320 px: panel alt çubukta (önceki düzen), yatay taşma yok.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const C = require('../www/vendor/xlsx.full.min.js').CFB;
const ROOT = path.join(__dirname, '..', 'www');
const OUT = process.env.EKRAN_DIZIN || null;   // verilirse ekran görüntüleri buraya yazılır
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };

const kare = (lat, lng, d) => [[lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat]].map(([x, y]) => `${x},${y},0`).join(' ');
const poly = k => `<Polygon><outerBoundaryIs><LinearRing><coordinates>${k}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
const pm = (ad, g) => `<Placemark><name>${ad}</name>${g}</Placemark>`;
const kml = g => `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${g}</Document></kml>`;
// 12 parsel (liste kaydırılabilir olmalı) + 1 hesaplanamayan
const COK = kml(Array.from({ length: 12 }, (_, i) => pm('Parsel ' + (i + 1), poly(kare(37.0 + (i % 4) * 0.004, 35.0 + Math.floor(i / 4) * 0.004, 0.003)))).join('') + pm('Bozuk', poly('35,37 35.001,37.001 35,37')));
const TEK = kml(pm('Tek parsel', poly(kare(36.5, 34.5, 0.004))));
const kmz = s => { const z = C.utils.cfb_new(); C.utils.cfb_add(z, 'doc.kml', Buffer.from(s)); return Buffer.from(C.write(z, { fileType: 'zip', type: 'array', compression: true })); };
const PROJ = [{ id: 'h1', name: 'Harita testi', created: 1, updated: 1, poly: [], src: null, inp: { crop: 'domates', srcType: 'kuyu', region: 'akdeniz', soil: 'tinli', area_da: 10, L: 130, W: 89, Q: 45, depth: 40, geom: 'parsel' } }];

(async () => {
  const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const port = srv.address().port, browser = await chromium.launch();
  const open = async (w, h, ek = {}) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: w, height: h } }, ek));
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
    await pg.addInitScript(p => { if (!sessionStorage.getItem('s')) { localStorage.setItem('irrismart.projects.v1', p); localStorage.removeItem('irrigrow.desk'); sessionStorage.setItem('s', '1'); } }, JSON.stringify(PROJ));
    await pg.goto(`http://localhost:${port}/`); await pg.waitForTimeout(800);
    await pg.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
    await pg.evaluate(() => L.Map.addInitHook(function () { window.__map = this; }));
    await pg.click('[data-v=projeler]'); await pg.waitForTimeout(150); await pg.click('[data-open=h1]'); await pg.waitForTimeout(250);
    await pg.click('[data-v=arazi]'); await pg.waitForTimeout(600);
    return { ctx, pg, errs };
  };
  const yukle = async (pg, name, buffer, mimeType = 'application/vnd.google-earth.kml+xml') => { await pg.setInputFiles('#kmlFile', { name, mimeType, buffer: Buffer.from(buffer) }); await pg.waitForTimeout(500); };
  const rect = (pg, s) => pg.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom, r: r.right }; }, s);
  // Leaflet boyutu harita kabıyla aynı mı (invalidateSize uygulanmış mı)
  const boyutUyumlu = pg => pg.evaluate(() => { const s = __map.getSize(), e = document.querySelector('#map'); return Math.abs(s.x - e.clientWidth) <= 1 && Math.abs(s.y - e.clientHeight) <= 1; });
  // Görünür harita yüksekliği: harita kabının, üstündeki alt çubukla örtülmeyen kısmı
  const gorunur = pg => pg.evaluate(() => { const m = document.querySelector('#map').getBoundingClientRect(), b = document.querySelector('#v-arazi .mapbar').getBoundingClientRect(); return Math.round(Math.min(m.bottom, b.top) - m.top); });
  // Plan katmanları: çokgen (parsel, alt ünite/shift) ve çizgi (ana hat, manifold, lateral) sayısı; kaynak işareti (yakınlaşmaya bağlı etiketler hariç)
  const katmanlar = pg => pg.evaluate(() => { let p = 0, l = 0, m = 0; __map.eachLayer(x => { if (x instanceof L.Polygon) p++; else if (x instanceof L.Polyline) l++; else if ((x instanceof L.Marker || x instanceof L.CircleMarker) && !(x.options.icon && x.options.icon.options && /etiket|label/i.test(x.options.icon.options.className || ''))) m++; }); return { p, l, kaynak: m > 0 }; });

  // ---------- Masaüstü boyutları ----------
  for (const [w, h] of [[1366, 768], [1440, 900], [1920, 1080], [1280, 720]]) {
    const ad = `${w}×${h}`, { ctx, pg, errs } = await open(w, h);
    check(await pg.evaluate(() => document.documentElement.classList.contains('desk')), `${ad} masaüstü düzeni etkin`);
    const kul = h - 56;   // üst çubuk dışında kullanılabilir yükseklik
    const g0 = await gorunur(pg);
    // Hesap sonucu yok: sağ panel ince şerit
    const sag0 = await rect(pg, '#deskRight');
    check(sag0 && sag0.w <= 30, `${ad} hesap yokken sağ panel daraltılmış (${sag0 && sag0.w} px)`);
    // KML: çok parselli dosya
    await yukle(pg, 'cok.kml', COK);
    const g1 = await gorunur(pg), P = await rect(pg, '#kmlPanel'), M = await rect(pg, '#map');
    check(g1 >= 320 && g1 / kul >= 0.6, `${ad} KML paneli açıkken harita ${g1} px (kullanılabilir ${kul} px'in %${Math.round(100 * g1 / kul)}'i)`);
    check(g1 === g0, `${ad} KML paneli harita yüksekliğini değiştirmedi (${g0} → ${g1})`);
    check(P && P.y >= M.y && P.b <= M.y + g1 + 1 && P.w <= M.w * 0.5, `${ad} KML kartı haritanın içinde, haritanın en çok yarısı genişliğinde ${JSON.stringify(P)}`);
    const liste = await pg.evaluate(() => { const e = document.querySelector('#kmlListe'); return { sh: e.scrollHeight, ch: e.clientHeight, n: e.querySelectorAll('input[name=kmlP]').length, oy: getComputedStyle(e).overflowY }; });
    check(liste.n === 13 && liste.sh > liste.ch && /auto|scroll/.test(liste.oy), `${ad} 13 parsellik liste kendi içinde kayar ${JSON.stringify(liste)}`);
    check(await pg.isVisible('#kmlUygula') && await pg.isVisible('#kmlIptal'), `${ad} İptal / Projeye uygula her zaman görünür`);
    check(await pg.evaluate(() => document.querySelector('#kmlUygula').disabled), `${ad} parsel seçilmeden uygulanamaz`);
    // Parsel seç (listeyi kaydırıp sonlardan birini): önizleme, vurgu, panelin altında kalmama
    await pg.locator('#kmlListe input[name=kmlP]:not([disabled])').nth(10).check(); await pg.waitForTimeout(500);
    const vurgu = await pg.evaluate(() => { let n = 0, tip = 0, kutu = null; __map.eachLayer(l => { if (l instanceof L.Polygon && l.options.color === '#ff6f00') { n++; if (l.getTooltip()) tip++; const b = l.getBounds(), a = __map.latLngToContainerPoint(b.getNorthWest()), c = __map.latLngToContainerPoint(b.getSouthEast()); kutu = { x1: a.x, y1: a.y, x2: c.x, y2: c.y }; } }); const P = document.querySelector('#kmlPanel').getBoundingClientRect(), M = document.querySelector('#map').getBoundingClientRect(); return { n, tip, kutu, panelSag: P.right - M.left, secili: document.querySelector('#kmlSecili').textContent }; });
    check(vurgu.n === 1 && vurgu.tip === 1 && /Parsel 11/.test(vurgu.secili), `${ad} seçili parsel turuncu vurgulu, etiketli ve panelde yazılı ${JSON.stringify(vurgu).slice(0, 160)}`);
    check(vurgu.kutu && vurgu.kutu.x1 >= vurgu.panelSag - 2, `${ad} seçili parsel KML kartının altında kalmıyor (parsel sol ${vurgu.kutu && Math.round(vurgu.kutu.x1)} ≥ kart sağ ${Math.round(vurgu.panelSag)})`);
    const proje0 = await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0].poly.length);
    check(proje0 === 0, `${ad} önizleme projeyi değiştirmedi`);
    if (OUT) await pg.screenshot({ path: path.join(OUT, `masaustu-${w}x${h}-kml.png`) });
    // Daralt: liste gizlenir, seçim ve önizleme korunur, harita boyutu doğru
    const hAcik = (await rect(pg, '#kmlPanel')).h;
    await pg.click('#kmlDar'); await pg.waitForTimeout(250);
    const dar = await pg.evaluate(() => ({ gizli: document.querySelector('.kml-govde').hidden, secili: document.querySelector('#kmlSecili').textContent, uyg: !document.querySelector('#kmlUygula').disabled, h: document.querySelector('#kmlPanel').getBoundingClientRect().height }));
    check(dar.gizli && /Parsel 11/.test(dar.secili) && dar.uyg && dar.h < hAcik * 0.6, `${ad} panel daraltıldı (${Math.round(hAcik)} → ${Math.round(dar.h)} px), seçim korundu`);
    if (OUT) await pg.screenshot({ path: path.join(OUT, `masaustu-${w}x${h}-kml-daraltilmis.png`) });
    await pg.click('#kmlDar'); await pg.waitForTimeout(250);
    check(!(await pg.evaluate(() => document.querySelector('.kml-govde').hidden)) && await pg.evaluate(() => document.querySelector('#kmlListe input:checked') !== null), `${ad} panel yeniden genişletildi, seçim duruyor`);
    // Projeye uygula (ayrı işlem) → hesap → sağ panel açılır, harita korunur
    await pg.click('#kmlUygula'); await pg.waitForTimeout(1800);   // uygulama (önceki davranış) Veriler ekranına geçer
    await pg.click('[data-v=arazi]'); await pg.waitForTimeout(800);
    const pr = await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0]);
    check(pr.poly.length >= 3 && pr.geoKaynak && pr.geoKaynak.parsel === 'Parsel 11', `${ad} "Projeye uygula" seçili parseli projeye yazdı`);
    check(!(await pg.isVisible('#kmlPanel')), `${ad} uygulamadan sonra KML paneli kapandı`);
    const sag1 = await rect(pg, '#deskRight');
    check(sag1.w >= 370, `${ad} hesap sonucu olunca sağ panel açık (${sag1.w} px)`);
    check(await boyutUyumlu(pg), `${ad} sağ panel açıldıktan sonra Leaflet boyutu harita kabıyla aynı`);
    const g2 = await gorunur(pg);
    check(g2 >= 320 && g2 / kul >= 0.6, `${ad} hesap sonrası harita ${g2} px (%${Math.round(100 * g2 / kul)})`);
    // Katmanlar (shift, ana hat, kaynak) panel / tam ekran / KMZ önizleme sonrası korunur
    const k0 = await katmanlar(pg);
    check(k0.p >= 2 && k0.l >= 1 && k0.kaynak, `${ad} plan katmanları çizildi ${JSON.stringify(k0)}`);
    await pg.click('#mFull'); await pg.waitForTimeout(300);
    const tam = await gorunur(pg);
    check(tam > g2 && await boyutUyumlu(pg), `${ad} tam ekran harita ${tam} px; Leaflet boyutu güncel`);
    await pg.click('#mFull'); await pg.waitForTimeout(300);
    check(await boyutUyumlu(pg) && JSON.stringify(await katmanlar(pg)) === JSON.stringify(k0), `${ad} tam ekrandan dönüşte katmanlar korundu`);
    // KMZ: mevcut projeye önizleme → İptal; geometri ve katmanlar değişmez
    await yukle(pg, 'tek.kmz', kmz(TEK), 'application/vnd.google-earth.kmz');
    check(await pg.isVisible('#kmlPanel') && /Tek parsel/.test(await pg.textContent('#kmlPanel')), `${ad} KMZ önizlemesi açıldı`);
    await pg.click('#kmlIptal'); await pg.waitForTimeout(400);
    const pr2 = await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0]);
    check(JSON.stringify(pr2.poly) === JSON.stringify(pr.poly), `${ad} KMZ iptali mevcut geometriyi korudu`);
    check(await pg.evaluate(p => __map.getBounds().contains(L.latLngBounds(p).getCenter()), pr.poly), `${ad} İptal sonrası harita projenin parseline döndü`);
    check(JSON.stringify(await katmanlar(pg)) === JSON.stringify(k0), `${ad} KMZ önizleme/iptal sonrası shift, ana hat ve kaynak katmanları korundu ${JSON.stringify(k0)} → ${JSON.stringify(await katmanlar(pg))}`);
    // Sağ panel kapat / aç: harita ve sonuçlar korunur
    await pg.click('#deskRight [data-dk=close]'); await pg.waitForTimeout(250);
    check((await rect(pg, '#deskRight')).w <= 30 && await boyutUyumlu(pg), `${ad} sağ panel daraltıldı, harita genişledi`);
    await pg.click('#deskRight [data-dk=open]'); await pg.waitForTimeout(250);
    check((await rect(pg, '#deskRight')).w >= 370 && await boyutUyumlu(pg) && JSON.stringify(await katmanlar(pg)) === JSON.stringify(k0), `${ad} sağ panel yeniden açıldı; harita ve plan kaybolmadı`);
    // Alt panel en yüksek hâlde: harita 320 px altına inmez
    await pg.evaluate(() => { window.IrriDesk.state.drawerH = 2000; }); await pg.click('#deskBottom [data-db=toggle]'); await pg.waitForTimeout(300);
    const g3 = await gorunur(pg);
    check(await pg.evaluate(() => { const b = document.querySelector('#ssTut'), m = document.querySelector('#v-arazi .mapbar'); return !b || b.getBoundingClientRect().bottom <= m.getBoundingClientRect().top; }), `${ad} Shiftler tutamağı alt panel açılınca da harita alt çubuğunun üstünde`);
    check(g3 >= 319 && await boyutUyumlu(pg), `${ad} alt panel açıkken harita ${g3} px (en az 320)`);
    await pg.click('#deskBottom [data-db=toggle]'); await pg.waitForTimeout(250);
    if (OUT) await pg.screenshot({ path: path.join(OUT, `masaustu-${w}x${h}-plan.png`) });
    // Pencere boyutu değişince yeniden ölçülür
    await pg.setViewportSize({ width: w - 100, height: h - 60 }); await pg.waitForTimeout(400);
    check(await boyutUyumlu(pg), `${ad} pencere küçülünce Leaflet boyutu güncel`);
    check(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${ad} yatay taşma yok`);
    check(!errs.length, `${ad} sayfa hatası: ${errs.join(' | ')}`);
    await ctx.close();
  }

  // ---------- Telefon: panel alt çubukta (önceki düzen) ----------
  for (const w of [390, 320]) {
    const { ctx, pg, errs } = await open(w, w === 390 ? 844 : 616, { isMobile: true, hasTouch: true });
    check(!(await pg.evaluate(() => document.documentElement.classList.contains('desk'))), `${w} px masaüstü düzeni kapalı`);
    await yukle(pg, 'cok.kml', COK);
    const yer = await pg.evaluate(() => { const P = document.querySelector('#kmlPanel'); return { mapbarIci: !!P.closest('.mapbar'), mh: getComputedStyle(P).maxHeight, h: P.getBoundingClientRect().height }; });
    check(yer.mapbarIci && yer.h <= 0.45 * (w === 390 ? 844 : 616) + 2, `${w} px KML paneli alt çubukta, en çok %45 yükseklik ${JSON.stringify(yer)}`);
    await pg.locator('#kmlListe input[name=kmlP]:not([disabled])').nth(2).check(); await pg.waitForTimeout(300);
    check(await pg.isVisible('#kmlDar') && /Parsel 3/.test(await pg.textContent('#kmlSecili')), `${w} px seçim ve daraltma düğmesi`);
    await pg.click('#kmlDar'); await pg.waitForTimeout(200);
    check(await pg.evaluate(() => document.querySelector('.kml-govde').hidden) && await pg.isVisible('#kmlUygula'), `${w} px daraltılınca Projeye uygula görünür`);
    check(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${w} px yatay taşma yok`);
    check(await boyutUyumlu(pg), `${w} px Leaflet boyutu güncel`);
    if (OUT) await pg.screenshot({ path: path.join(OUT, `telefon-${w}-kml.png`) });
    check(!errs.length, `${w} px sayfa hatası: ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`Masaüstü harita ve KML paneli: ${passes} denetim geçti, ${fails} başarısız`);
  process.exit(fails ? 1 : 0);
})();

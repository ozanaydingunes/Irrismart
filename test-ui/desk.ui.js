#!/usr/bin/env node
// MH-WEB-2 — Profesyonel masaüstü düzeni testleri: `npm run test:desk`
//  • 1280 / 1440 / 1920 px: masaüstü düzeni etkin; sol modül çubuğu, sağ mühendislik paneli, alt panel; bütün
//    modüller (Projeler, Arazi, Veriler, Sonuç, Hidrolik, Malzeme, Proje, Ayarlar) çalışır, yatay taşma yok.
//  • Telefon (390 px) ve Android (Capacitor) ortamında masaüstü düzeni ETKİNLEŞMEZ; mobil düzen aynen kalır.
//  • Haritada shift seçimi → sağ panelde gerçek hesap değerleri (motor + MH-1 görünüm modeliyle birebir).
//  • Alt panel açılır/kapanır, yüksekliği sürükleyerek ayarlanır; tablodan seçim sağ paneli günceller.
//  • Üst çubuk: PDF, Excel, Hidrolik Excel, DXF, teknik pafta indirmeleri; JSON yedek ve geri yükleme; tema.
//  • Açık ve koyu temada karşıtlık; tam ekran haritada paneller gizlenir; eski (v0.6.0) projeler açılır.
//  • Bu sürümde olmayan işlevler (geri al/yinele geçmişi, sağ tık menüsü, koordinat girişi) gösterilmez.
// İsteğe bağlı: SHOTS=<klasör>.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..', 'www'), SHOTS = process.env.SHOTS || null;
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const LS0 = require('../test/fixtures/localstorage-v0.6.0.json');
const lat = 36.9, lng = 30.7, dl = 0.0025, dn = 0.0035;
const PROJECTS = [
  { id: 'p2', name: 'Parsel', created: 1, updated: 3, poly: [[lat, lng], [lat, lng + dn], [lat + dl, lng + dn], [lat + dl * 1.2, lng + dn * 0.3]], src: [lat, lng], inp: { crop: 'domates', srcType: 'kuyu', region: 'akdeniz', soil: 'tinli', rowDir: 'uzun', emitter: 'normal', geom: 'parsel', Q: 120, depth: 30 } },
  { id: 't2', name: 'test2', created: 1, updated: 2, poly: [], src: null, inp: { crop: 'domates', area_da: 288.9, srcType: 'kuyu', depth: 40, region: 'akdeniz', Q: 86.3 } },
];
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };
function lum(rgb) { const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

(async () => {
  const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const port = srv.address().port, browser = await chromium.launch(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'irri-desk-'));
  const open = async (o = {}) => {
    const ctx = await browser.newContext({ viewport: { width: o.w || 1440, height: o.h || 900 }, acceptDownloads: true });
    await ctx.route(/arcgisonline|open-meteo/, r => r.abort());
    const pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Masaüstü projesi' : undefined));
    if (o.native) await pg.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true, Plugins: {} }; });
    await pg.addInitScript(([p, th]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('irrismart.projects.v1', p); sessionStorage.setItem('seeded', '1'); } localStorage.setItem('irrigrow.theme', th); }, [o.raw || JSON.stringify(PROJECTS), o.theme || 'acik']);
    await pg.goto(`http://localhost:${port}/`); await pg.waitForTimeout(1000);
    await pg.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
    return { ctx, pg, errs };
  };
  const go = async (pg, v) => { await pg.click(`nav.tabs [data-v=${v}]`); await pg.waitForTimeout(500); };
  const openProj = async (pg, id) => { await go(pg, 'projeler'); await pg.click(`[data-open=${id}]`); await pg.waitForTimeout(500); };
  const box = (pg, sel) => pg.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, vis: getComputedStyle(e).display !== 'none' && r.width > 0 }; }).catch(() => ({ vis: false }));
  const download = async (pg, clickFn) => { const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), clickFn()]); const fp = path.join(tmp, d.suggestedFilename()); await d.saveAs(fp); return { fn: d.suggestedFilename(), buf: fs.readFileSync(fp), fp }; };

  // ---------- Mobil ve Android: masaüstü düzeni etkinleşmez ----------
  for (const [o, tag] of [[{ w: 390, h: 844 }, 'telefon 390 px'], [{ w: 1440, h: 900, native: true }, 'Android (Capacitor) 1440 px'], [{ w: 1100, h: 800 }, 'web 1100 px']]) {
    const { ctx, pg, errs } = await open(o);
    await openProj(pg, 't2'); await go(pg, 'sonuc');
    check(!(await pg.evaluate(() => document.documentElement.classList.contains('desk'))), `${tag}: masaüstü düzeni etkinleşmemeli`);
    const nav = await box(pg, 'nav.tabs'), vh = await pg.evaluate(() => innerHeight);
    check(nav.vis && Math.abs(nav.y + nav.h - vh) < 2 && nav.w >= o.w - 2, `${tag}: alt sekme çubuğu yerinde değil`);
    for (const s of ['#deskRight', '#deskBottom', '#deskTools', '#deskRail']) check(!(await box(pg, s)).vis, `${tag}: ${s} görünmemeli`);
    check(!errs.length, `${tag}: ${errs.join(' | ')}`);
    await ctx.close();
  }

  // ---------- 1280 / 1440 / 1920: yerleşim ve bütün modüller ----------
  for (const w of [1280, 1440, 1920]) {
    const { ctx, pg, errs } = await open({ w, h: w === 1920 ? 1080 : 860 });
    check(await pg.evaluate(() => document.documentElement.classList.contains('desk')), `${w}: masaüstü düzeni etkin değil`);
    await openProj(pg, 'p2'); await go(pg, 'sonuc');
    const rail = await box(pg, 'nav.tabs'), right = await box(pg, '#deskRight'), bot = await box(pg, '#deskBottom'), main = await box(pg, 'main');
    check(rail.vis && rail.x === 0 && rail.w >= 200 && rail.h > 500, `${w}: sol modül çubuğu dikey değil`);
    check(right.vis && Math.abs(right.x + right.w - w) < 2 && right.w >= 360, `${w}: sağ mühendislik paneli yok`);
    check(bot.vis && bot.x >= rail.w - 1 && bot.x + bot.w <= right.x + 1, `${w}: alt panel orta alanın altında değil`);
    check(main.x >= rail.w - 1 && main.x + main.w <= right.x + 1, `${w}: orta alan panellerle çakışıyor`);
    for (const v of ['projeler', 'arazi', 'veri', 'sonuc', 'hidrolik', 'malzeme', 'teknik']) {
      await go(pg, v);
      check(await pg.$eval(`#v-${v}`, e => e.classList.contains('on') && e.getBoundingClientRect().width > 400), `${w}: ${v} modülü açılmadı`);
      const ov = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth); check(ov <= 0, `${w} ${v}: yatay taşma ${ov}px`);
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: `${SHOTS}/${w}-${v}.png` }); }
    }
    const fit = await pg.evaluate(() => { const t = document.querySelector('#deskTools'), sb = document.querySelector('#btnSettings').getBoundingClientRect(); const last = Math.max(...[...t.children].map(e => e.getBoundingClientRect().right)); return { over: t.scrollWidth - t.clientWidth, gap: sb.left - last }; });
    check(fit.over <= 1 && fit.gap >= 0, `${w}: üst araç çubuğu taşıyor (${fit.over}px) veya Ayarlar düğmesinin üstüne biniyor (${fit.gap}px)`);
    await pg.click('#btnSettings'); await pg.waitForTimeout(400);
    check(await pg.$eval('#v-ayarlar', e => e.classList.contains('on')), `${w}: Ayarlar açılmadı`);
    check(await pg.$$eval('#v-hidrolik [data-ptab]', x => x.length) === 8, `${w}: hidrolik 8 bölüm yok`);
    const txt = await pg.$eval('#deskTools', e => e.textContent);
    check(/Yerel kayıt · eşitleme yok/.test(txt) && /Yedek: hiç/.test(txt), `${w}: kayıt/eşitleme/yedek durumu yok`);
    check(!(await pg.$('#deskTools [aria-label*="Geri al"], #deskTools [aria-label*="Yinele"]')) && !/Geri al|Yinele|Koordinat/.test(txt), `${w}: olmayan işlev (geri al/yinele/koordinat) gösteriliyor`);
    check(!errs.length, `${w}: ${errs.join(' | ')}`);
    await ctx.close();
  }

  // ---------- Haritada shift seçimi → sağ panelde gerçek değerler ----------
  {
    const { ctx, pg, errs } = await open({ w: 1440, h: 900 });
    await pg.evaluate(() => L.Map.addInitHook(function () { window.__map = this; }));
    await openProj(pg, 'p2'); await go(pg, 'sonuc'); await go(pg, 'arazi'); await pg.waitForTimeout(800);
    const poly0 = await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(x => x.id === 'p2').poly.length);
    // Shift alanlarının (alt ünite çokgenleri) içindeki noktalara fareyle tıkla; boru çizgisine denk gelen tıklama boruyu seçer
    // (1) Gerçek fare tıklaması: plan nesnesine tıklanınca sağ panel açılır, parsel sınırına köşe EKLENMEZ
    const pts = await pg.evaluate(() => { const out = [], inside = (pt, vs) => { let c = false; for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) { const [xi, yi] = vs[i], [xj, yj] = vs[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
      __map.eachLayer(l => { if (l instanceof L.Polygon && l.options.fillOpacity === 0.38) { const vs = l.getLatLngs()[0].map(q => { const p = __map.latLngToContainerPoint(q); return [p.x, p.y]; }); const xs = vs.map(v => v[0]), ys = vs.map(v => v[1]);
        for (let a = 1; a < 6; a++) for (let b = 1; b < 6; b++) { const p = [Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) * a / 6, Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * b / 6]; if (inside(p, vs)) out.push(p); } } }); return out; });
    check(pts.length > 0, 'haritada shift alanı çizilmedi');
    const mb = await box(pg, '#map');
    for (const [x, y] of pts.slice(0, 6)) { await pg.mouse.click(mb.x + x, mb.y + y); await pg.waitForTimeout(200); }
    const picked = await pg.$eval('#deskRight .dk-head', e => e.textContent).catch(() => '');
    check(/Shift \d+ ·|Lateral|Manifold|Ana boru/.test(picked), 'haritada tıklanan nesne sağ panelde açılmadı: ' + picked);
    // (2) Shift alanı (alt ünite çokgeni) seçimi — çizgiler sık olduğundan tıklama çokgenin kendisine iletilir
    await pg.evaluate(() => { let best = null; __map.eachLayer(l => { if (l instanceof L.Polygon && l.options.fillOpacity === 0.38) { const b = l.getBounds(), a = (b.getEast() - b.getWest()) * (b.getNorth() - b.getSouth()); if (!best || a > best.a) best = { a, l }; } }); best.l.fire('click', { latlng: best.l.getCenter(), originalEvent: new MouseEvent('click') }); });
    await pg.waitForTimeout(300);
    const got = await pg.$eval('#deskRight .dk-head', e => e.textContent).catch(() => '');
    check(await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(x => x.id === 'p2').poly.length) === poly0, 'seçim tıklaması parsel sınırını değiştirdi');
    check(/Shift \d+ ·/.test(got), 'sağ panel shift göstermiyor: ' + got);
    check(!(await pg.$('.leaflet-popup')), 'masaüstünde bilgi balonu yerine sağ panel açılmalı');
    const j = Number(got.match(/Shift (\d+)/)[1]) - 1;
    const want = await pg.evaluate(j => { const p = JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(x => x.id === 'p2'); const r = IrriEngine.design(p.inp, null, { poly: p.poly, src: p.src, station: p.station, route: p.route }); const d = IrriHydroView.build(r, { inp: p.inp, Qsource: 120 }).shift.details[j]; return [d.Q, d.H, d.A, d.dur, d.vol, d.kWh, d.units.join(', ')]; }, j);
    const vals = await pg.$$eval('#deskRight [data-v]', x => x.map(n => Number(n.dataset.v)));
    for (const v of want.slice(0, 6)) check(vals.some(x => Math.abs(x - v) < 1e-9), `sağ panel değeri motorla aynı değil: ${v}`);
    const rtxt = await pg.$eval('#deskRight', e => e.textContent);
    check(rtxt.includes(want[6]) && /Gerekli basınç dökümü/.test(rtxt) && /Pompa görev noktası/.test(rtxt) && /Mühendislik uyarıları/.test(rtxt), 'sağ panelde manifoldlar / döküm / pompa / uyarılar eksik');
    // Alt panel: aç/kapat, sekme, yükseklik ayarı, tablodan seçim
    await pg.click('#deskBottom [data-tab=anahat]'); await pg.waitForTimeout(250);
    const h1 = (await box(pg, '#deskBottom')).h;
    check(h1 > 150 && (await pg.$$('#deskBottom tr[data-sel^="anahat:"]')).length > 2, 'alt panel ana hat tablosu açılmadı');
    const g = await box(pg, '#deskBottom .db-grip');
    await pg.mouse.move(g.x + 50, g.y + 2); await pg.mouse.down(); await pg.mouse.move(g.x + 50, g.y - 120, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(250);
    const h2 = (await box(pg, '#deskBottom')).h;
    check(h2 > h1 + 80, `alt panel yüksekliği sürüklenerek ayarlanmadı (${h1} → ${h2})`);
    await pg.click('#deskBottom tr[data-sel="anahat:2"]'); await pg.waitForTimeout(250);
    check(/Ana boru şebekesi|AH-/.test(await pg.$eval('#deskRight .dk-head', e => e.textContent)), 'tablodan ana hat seçimi sağ panele gelmedi');
    await pg.click('#deskBottom [data-db=toggle]'); await pg.waitForTimeout(250);
    check((await box(pg, '#deskBottom')).h <= 42, 'alt panel kapanmadı');
    // Sağ panel kapat/aç, sol panel daralt
    await pg.click('#deskRight [data-dk=close]'); await pg.waitForTimeout(250);
    check((await box(pg, '#deskRight')).w < 40 && (await box(pg, 'main')).w > 1000, 'sağ panel kapanınca orta alan genişlemedi');
    await pg.click('#deskRight [data-dk=open]'); await pg.waitForTimeout(250);
    await pg.click('#deskRail'); await pg.waitForTimeout(250);
    check((await box(pg, 'nav.tabs')).w <= 70, 'sol panel simgelere daralmadı'); await pg.click('#deskRail');
    // Uyarıdan Sonuç ekranına
    await pg.click('#deskBottom [data-tab=uyari]'); await pg.waitForTimeout(250);
    const k = await pg.$eval('#deskBottom [data-kod]', b => b.dataset.kod); await pg.click(`#deskBottom [data-kod="${k}"]`); await pg.waitForTimeout(700);
    check(await pg.$eval(`#ak-${k}`, e => e.open && document.getElementById('v-sonuc').classList.contains('on')).catch(() => false), 'uyarı bağlantısı Sonuç ekranındaki kartı açmadı');
    // Tam ekran harita
    await go(pg, 'arazi'); await pg.click('#mFull'); await pg.waitForTimeout(300);
    check(!(await box(pg, '#deskRight')).vis && !(await box(pg, 'nav.tabs')).vis && (await box(pg, '#map')).w > 1400, 'tam ekranda paneller gizlenmedi');
    await pg.click('#mFull');
    check(!errs.length, 'seçim: ' + errs.join(' | '));
    await ctx.close();
  }

  // ---------- Üst çubuk: raporlar, yedek, geri yükleme, tema ----------
  {
    const { ctx, pg, errs } = await open({ w: 1440, h: 900 });
    await openProj(pg, 't2'); await go(pg, 'sonuc');
    const menu = async k => { await pg.click('#deskTools summary:has-text("Raporlar")'); return download(pg, () => pg.click(`#deskTools [data-dt=${k}]`)); };
    const pdf = await menu('pdf'), xls = await menu('xlsx'), hx = await menu('hxlsx'), dxf = await menu('dxf'), sh = await menu('sheet');
    check(/\.pdf$/.test(pdf.fn) && pdf.buf.slice(0, 4).toString() === '%PDF', 'Raporlar → PDF');
    check(/\.xlsx$/.test(xls.fn) && xls.buf.slice(0, 2).toString() === 'PK', 'Raporlar → Excel');
    check(/_hidrolik_.*\.xlsx$/.test(hx.fn), 'Raporlar → Hidrolik Excel');
    check(/\.dxf$/.test(dxf.fn) && /SECTION/.test(dxf.buf.toString('latin1').slice(0, 2000)), 'Raporlar → DXF');
    check(/_pafta_.*\.pdf$/.test(sh.fn) && sh.buf.slice(0, 4).toString() === '%PDF', 'Raporlar → Teknik pafta');
    await pg.click('#deskTools summary:has-text("Yedek")');
    const bk = await download(pg, () => pg.click('#deskTools [data-dt=backup]'));
    check(/IrriGrow_yedek_.*\.json$/.test(bk.fn) && JSON.parse(bk.buf.toString()).projects.length === 2, 'Yedek → JSON');
    await pg.waitForTimeout(300);
    check(/Yedek: bugün/.test(await pg.$eval('#deskTools', e => e.textContent)), 'yedek sonrası durum güncellenmedi');
    await ctx.close();
    // Yeni tarayıcıda geri yükleme (mevcut proje korunur)
    const keep = JSON.stringify([{ id: 'yerel', name: 'Yerel', created: 1, updated: 9, poly: [], src: null, inp: { crop: 'domates', area_da: 10, Q: 10 } }]);
    const b2 = await open({ w: 1440, h: 900, raw: keep });
    await b2.pg.click('#deskTools summary:has-text("Yedek")');
    const [fc] = await Promise.all([b2.pg.waitForEvent('filechooser'), b2.pg.click('#deskTools [data-dt=restore]')]);
    await fc.setFiles(bk.fp); await b2.pg.waitForTimeout(1000);
    const ids = await b2.pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1')).map(p => p.id).sort());
    check(JSON.stringify(ids) === JSON.stringify(['p2', 't2', 'yerel']), 'Yedekten yükle: ' + ids);
    await b2.pg.selectOption('#deskTools select[data-dt=theme]', 'koyu'); await b2.pg.waitForTimeout(200);
    check(await b2.pg.evaluate(() => document.documentElement.dataset.theme === 'dark'), 'tema değişmedi');
    check(!errs.length && !b2.errs.length, 'araç çubuğu: ' + errs.concat(b2.errs).join(' | '));
    await b2.ctx.close();
  }

  // ---------- Tema karşıtlığı ----------
  for (const theme of ['acik', 'koyu']) {
    const { ctx, pg } = await open({ w: 1440, h: 900, theme });
    await openProj(pg, 'p2'); await go(pg, 'sonuc');
    await pg.click('#deskBottom [data-tab=shift]'); await pg.click('#deskBottom tr[data-sel="shift:0"]'); await pg.waitForTimeout(300);
    const pairs = await pg.$$eval('#deskTools .dt-btn, #deskTools .dt-status, #deskRight .dk-kind, #deskRight strong, #deskRight .dk-kpi > span, #deskRight dt, #deskRight dd, #deskBottom .db-tab, #deskBottom td, #deskBottom th, nav.tabs button span', els => els.map(e => {
      const col = getComputedStyle(e).color; let n = e, bg = 'rgba(0, 0, 0, 0)';
      while (n && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) { bg = getComputedStyle(n).backgroundColor; n = n.parentElement; }
      return [col, bg, (e.className || e.tagName) + ':' + e.textContent.slice(0, 20)];
    }));
    const rgb = s => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    const low = pairs.filter(([c, b]) => contrast(rgb(c), rgb(b)) < 4.5);
    check(pairs.length > 40 && !low.length, `${theme}: ${low.length} öğede karşıtlık < 4,5 (${low.slice(0, 3).map(x => x[2] + ' ' + x[0] + '/' + x[1]).join('; ')})`);
    if (SHOTS) await pg.screenshot({ path: `${SHOTS}/tema-${theme}.png` });
    await ctx.close();
  }

  // ---------- Eski (v0.6.0) projeler masaüstünde açılır ----------
  {
    const { ctx, pg, errs } = await open({ w: 1440, h: 900, raw: LS0['irrismart.projects.v1'] });
    const ids = await pg.$$eval('#projList [data-open]', x => x.map(e => e.dataset.open));
    check(ids.length > 0, 'eski projeler listelenmedi');
    for (const id of ids) { await openProj(pg, id); await go(pg, 'sonuc'); check(!!(await pg.$('#result .big, #result .note.err')), `eski proje ${id} açılmadı`); }
    check(!errs.length, 'eski projeler: ' + errs.join(' | '));
    await ctx.close();
  }

  await browser.close(); srv.close();
  console.log(`\n${passes} kontrol geçti, ${fails} kontrol başarısız`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

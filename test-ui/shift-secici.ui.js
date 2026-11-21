#!/usr/bin/env node
// 1.0.3 PR-1 — Alt Shift seçici (bottom sheet), Shift detay paneli ve harita bağlantısı.
// Ekranlar: 390 px telefon, Pixel 7 (412 px), geniş ekran Android (800×1280 tablet), 1280 px masaüstü web.
// Gerçek Android WebView'un yerini tutmaz; cihaz testi ayrıca yapılmalıdır.
//  SS-1 Tutamak yalnız Hidrolik ekranında, alt sekme çubuğunu örtmeden; alt sekmeler çalışır
//  SS-2 Panel: bütün shift çipleri, seçili vurgulu; detay değerleri motor sonucuyla aynı; alan alt ünite geometrisinden
//  SS-3 Çok shift: yatay kaydırma; tek shift: panel çalışır
//  SS-4 Kapat: aynı ekran ve kaydırma konumu
//  SS-5 Haritada göster → seçili shift vurgulu; dönüş düğmesi aynı shift'le paneli açar; harita salt okunur
//  SS-6 Telefonda haritada bir shift'e dokunmak paneli o shift ile açar (bilgi balonu yok, sınır değişmez)
//  SS-7 Düzenle → Shift Yönetimi aynı shift seçili açılır; panel hiçbir şey kaydetmez
//  SS-8 Masaüstünde panel sağ çekmece
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };
const lat = 37.0, lng = 35.0;
const poly = [[lat, lng], [lat, lng + 0.0075], [lat + 0.0021, lng + 0.0078], [lat + 0.0027, lng + 0.0012], [lat + 0.0012, lng - 0.0006]];
const proje = (id, inp, extra) => Object.assign({ id, name: 'P ' + id, created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly, src: [lat - 0.0005, lng - 0.0005], station: null, route: [],
  inp: Object.assign({ crop: 'domates', geom: 'parsel', Q: 120, srcType: 'kuyu', depth: 40, region: 'akdeniz', hours: 20 }, inp) }, extra || {});
const PROJ = [proje('p8', {}), proje('p15', { Ns: 15 }),
  { id: 'p1', name: 'Tek shift', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [], src: null, inp: { crop: 'domates', area_da: 4, L: 80, W: 50, Q: 60, srcType: 'kuyu', depth: 20, region: 'akdeniz', hours: 20 } }];
const EKRAN = [
  ['390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ['pixel7', { ...devices['Pixel 7'] }],
  ['tablet', { viewport: { width: 800, height: 1280 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ['1280', { viewport: { width: 1280, height: 860 } }],
];

(async () => {
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const browser = await chromium.launch();
  for (const [ad, opt] of EKRAN) {
    const ctx = await browser.newContext(opt);
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
    await pg.addInitScript(ps => { if (!sessionStorage.getItem('s')) { localStorage.setItem('irrismart.projects.v1', JSON.stringify(ps)); sessionStorage.setItem('s', '1'); } }, PROJ);
    await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(900);
    const desk = await pg.evaluate(() => document.documentElement.classList.contains('desk'));
    const dokun = async sel => { if (opt.hasTouch) await pg.tap(sel); else await pg.click(sel); };
    const git = async v => { await pg.evaluate(v => document.querySelector(`nav.tabs [data-v=${v}]`).click(), v); await pg.waitForTimeout(900); };
    const ac = async id => { await git('projeler'); await dokun(`[data-open="${id}"]`); await pg.waitForTimeout(300); await git('hidrolik'); await pg.waitForTimeout(600); };
    const P = id => pg.evaluate(id => JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(p => p.id === id), id);
    const motor = id => pg.evaluate(id => { const p = JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(x => x.id === id);
      const r = IrriEngine.design(p.inp, JSON.parse(localStorage.getItem('irrismart.settings.v1') || 'null') || undefined, { manual: p.shiftEdit || null, poly: p.poly, src: p.src, station: p.station, route: p.route });
      const vm = IrriHydroView.build(r, { inp: p.inp, Qsource: p.inp.Q }), A = IrriAssess.forProject(p, r), G = IrriShiftYonetimi.geoAlan(r, IrriGeom);
      return { n: r.sel.groups.length, Q: r.sel.Qj, H: r.main.sel.H, A: G && G.shift, genel: IrriShiftYonetimi.uygunluk(IrriShiftYonetimi.ozet(r, vm, A), p.inp.Q, p.inp).genel }; }, id);

    // SS-1
    await ac('p8');
    const m = await motor('p8');
    check(await pg.isVisible('#ssTut') && /Shiftler/.test(await pg.textContent('#ssTut')) && new RegExp(String(m.n)).test(await pg.textContent('#ssTut')), `${ad} SS-1 Hidrolik'te Shiftler tutamağı`);
    if (!desk) {
      const ust = await pg.evaluate(() => { const t = document.querySelector('#ssTut').getBoundingClientRect(), n = document.querySelector('nav.tabs').getBoundingClientRect(); return t.bottom <= n.top + 1; });
      check(ust, `${ad} SS-1 tutamak alt sekme çubuğunu örtmemeli`);
    }
    await git('veri'); check(!(await pg.$('#ssTut')), `${ad} SS-1 Veriler ekranında tutamak olmamalı`); await git('hidrolik');
    // SS-4 hazırlık: Hidrolik ekranını biraz kaydır
    await pg.evaluate(() => { document.querySelector('#v-hidrolik').scrollTop = 300; }); const kay0 = await pg.evaluate(() => document.querySelector('#v-hidrolik').scrollTop);

    // SS-2
    await dokun('#ssTut'); await pg.waitForSelector('#ssSheet', { timeout: 10000 }); await pg.waitForTimeout(300);
    const cipler = await pg.$$eval('#ssSheet .ss-chip', a => a.map(x => [x.dataset.ssj, x.getAttribute('aria-selected')]));
    check(cipler.length === m.n && cipler.filter(c => c[1] === 'true').length === 1, `${ad} SS-2 ${m.n} çip, biri seçili (${cipler.length})`);
    for (const j of [Math.min(2, m.n - 1), 0]) {
      await dokun(`#ssSheet [data-ssj="${j}"]`); await pg.waitForTimeout(300);
      const v = await pg.evaluate(() => ({ j: +document.querySelector('.ss-detay').dataset.j, Q: +document.querySelector('#ssDebi').dataset.v, H: +document.querySelector('#ssBasinc').dataset.v, A: +(document.querySelector('#ssAlan') || {}).dataset.v, sec: document.querySelector('.ss-chip.on').dataset.ssj, genel: document.querySelector('#ssGenel').dataset.genel }));
      check(v.j === j && v.sec === String(j), `${ad} SS-2 seçili shift ${j}`);
      check(Math.abs(v.Q - m.Q[j]) < 1e-9 && Math.abs(v.H - m.H[j]) < 1e-9 && Math.abs(v.A - m.A[j]) < 1e-9 && v.genel === m.genel, `${ad} SS-2 shift ${j + 1} değerleri motorla aynı (${JSON.stringify(v)})`);
    }
    const metin = await pg.textContent('#ssSheet .ss-body');
    check(['Alan', 'Hesaplanan debi', 'Hedef debi', 'Gerekli giriş basıncı', 'Sulama süresi', 'Sulama hacmi', 'Pompa görev noktası', 'Kontrol vanaları', 'Kritik hidrolik kayıplar', 'Manifold ve lateral bağlantıları', 'Mühendislik uygunluk durumu'].every(k => metin.includes(k)), `${ad} SS-2 detay alanlarının hepsi`);
    check(!(await pg.$('#ssSheet input, #ssSheet select')), `${ad} SS-2 hesaplanan değerler düzenlenebilir alan olarak gösterilmemeli`);
    const tasma = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(tasma <= 0, `${ad} SS-2 yatay sayfa taşması ${tasma}px`);

    // SS-4
    await dokun('#ssX'); await pg.waitForTimeout(300);
    check(!(await pg.$('#ssSheet')) && await pg.evaluate(() => document.querySelector('#v-hidrolik').classList.contains('on')) && Math.abs(await pg.evaluate(() => document.querySelector('#v-hidrolik').scrollTop) - kay0) < 2, `${ad} SS-4 kapatınca aynı ekran ve kaydırma`);
    if (!desk) {   // perdeye dokunarak kapatma
      await dokun('#ssTut'); await pg.waitForSelector('#ssSheet'); await pg.touchscreen.tap(20, 90); await pg.waitForTimeout(300);
      check(!(await pg.$('#ssSheet')), `${ad} SS-4 panel dışına dokununca kapanır`);
    }

    // SS-7 Düzenle → Shift Yönetimi aynı shift
    await dokun('#ssTut'); await pg.waitForSelector('#ssSheet'); await dokun('#ssSheet [data-ssj="1"]'); await pg.waitForTimeout(200);
    const kayit0 = JSON.stringify(await P('p8'));
    await dokun('#ssDuzenle'); await pg.waitForSelector('#smPanel', { timeout: 10000 }); await pg.waitForTimeout(300);
    check(await pg.$eval('#smPanel .sm-shift.on', e => e.dataset.j).catch(() => null) === '1', `${ad} SS-7 Shift Yönetimi Shift 2 seçili açılmalı`);
    await dokun('#smIptal'); await pg.waitForTimeout(300);
    check(JSON.stringify(await P('p8')) === kayit0, `${ad} SS-7 panel ve İptal kaydı değiştirmemeli`);

    // SS-5 Haritada göster
    const poly0 = JSON.stringify((await P('p8')).poly);
    await dokun('#ssTut'); await pg.waitForSelector('#ssSheet'); await dokun('#ssSheet [data-ssj="3"]'); await pg.waitForTimeout(200);
    await dokun('#ssHarita'); await pg.waitForTimeout(1800);
    const ds = await pg.$eval('#map', e => Object.assign({}, e.dataset));
    check(await pg.evaluate(() => document.querySelector('#v-arazi').classList.contains('on')) && ds.vurgu === '3' && ds.vurguSigdi === '1', `${ad} SS-5 harita Shift 4'ü vurgulamalı (${ds.vurgu})`);
    const top = await pg.$eval('#map', e => e.getBoundingClientRect()), kutu = ds.vurguKutu && JSON.parse(ds.vurguKutu);
    if (kutu) { if (opt.hasTouch) await pg.touchscreen.tap(top.x + (kutu.x0 + kutu.x1) / 2, top.y + (kutu.y0 + kutu.y1) / 2); else await pg.mouse.click(top.x + (kutu.x0 + kutu.x1) / 2, top.y + (kutu.y0 + kutu.y1) / 2); await pg.waitForTimeout(400); }
    check(JSON.stringify((await P('p8')).poly) === poly0 && !(await pg.$('.leaflet-popup')), `${ad} SS-5 vurgu salt okunur`);
    check(await pg.isVisible('#ssChip') && /Shift 4/.test(await pg.textContent('#ssChip')), `${ad} SS-5 dönüş düğmesi`);
    await dokun('#ssChip'); await pg.waitForTimeout(800);
    check(await pg.evaluate(() => document.querySelector('#v-hidrolik').classList.contains('on')) && await pg.$eval('.ss-chip.on', e => e.dataset.ssj).catch(() => null) === '3', `${ad} SS-5 haritadan dönünce aynı shift seçili`);
    const ds2 = await pg.$eval('#map', e => Object.assign({}, e.dataset));
    check(!ds2.vurgu && !(await pg.$('#ssChip')), `${ad} SS-5 dönüşte vurgu kalkmalı`);
    await dokun('#ssX'); await pg.waitForTimeout(200);

    // SS-6 Haritadan panele (telefon/tablet)
    if (!desk) {
      await git('arazi'); await pg.waitForTimeout(1500);
      const mr = await pg.$eval('#map', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
      // parselin ortasına yakın bir noktaya dokun (harita parsele sığdırılmış)
      let acildi = false;
      const pk = JSON.parse(await pg.$eval('#map', e => e.dataset.planKutu || 'null'));
      for (const [fx, fy] of [[0.5, 0.5], [0.45, 0.55], [0.55, 0.45]]) {
        await pg.touchscreen.tap(mr.x + pk.x0 + (pk.x1 - pk.x0) * fx, mr.y + pk.y0 + (pk.y1 - pk.y0) * fy); await pg.waitForTimeout(500);
        if (await pg.$('#ssSheet')) { acildi = true; break; }
        if (await pg.$('.leaflet-popup')) await pg.evaluate(() => document.querySelector('.leaflet-popup-close-button') && document.querySelector('.leaflet-popup-close-button').click());
      }
      check(acildi, `${ad} SS-6 haritada shift'e dokununca panel açılmalı`);
      check(JSON.stringify((await P('p8')).poly) === poly0, `${ad} SS-6 dokunma sınıra köşe eklememeli`);
      if (acildi) { await dokun('#ssX'); await pg.waitForTimeout(200); }
    }

    // SS-3 Çok shift: yatay kaydırma
    await ac('p15');
    const m15 = await motor('p15');
    await dokun('#ssTut'); await pg.waitForSelector('#ssSheet'); await pg.waitForTimeout(200);
    const yatay = await pg.$eval('#ssSheet .ss-chips', e => [e.scrollWidth, e.clientWidth]);
    check(m15.n >= 12 && (await pg.$$('#ssSheet .ss-chip')).length === m15.n && yatay[0] > yatay[1], `${ad} SS-3 ${m15.n} shift yatay kaydırılabilir (${yatay})`);
    await pg.$eval(`#ssSheet [data-ssj="${m15.n - 1}"]`, e => e.scrollIntoView({ inline: 'center' }));
    await dokun(`#ssSheet [data-ssj="${m15.n - 1}"]`); await pg.waitForTimeout(300);
    const gorunur = await pg.$eval('#ssSheet .ss-chip.on', e => { const r = e.getBoundingClientRect(), p = e.parentElement.getBoundingClientRect(); return r.left >= p.left - 1 && r.right <= p.right + 1; });
    check(gorunur && await pg.$eval('.ss-detay', e => e.dataset.j) === String(m15.n - 1), `${ad} SS-3 son shift seçili ve görünür`);
    await dokun('#ssX'); await pg.waitForTimeout(200);
    // Tek shift
    await ac('p1');
    const m1 = await motor('p1');
    await dokun('#ssTut'); await pg.waitForSelector('#ssSheet'); await pg.waitForTimeout(200);
    check(m1.n === 1 && (await pg.$$('#ssSheet .ss-chip')).length === 1 && await pg.isVisible('#ssSheet .ss-detay'), `${ad} SS-3 tek shift'li projede panel (${m1.n})`);
    check(Math.abs(+(await pg.$eval('#ssAlan', e => e.dataset.v)) - m1.A[0]) < 1e-9, `${ad} SS-3 dikdörtgen projede alan eşdeğer yerleşim geometrisinden`);

    // SS-8 Masaüstü sağ çekmece
    if (desk) {
      const b = await pg.$eval('#ssSheet', e => { const r = e.getBoundingClientRect(); return { right: r.right, w: r.width, top: r.top }; });
      check(Math.abs(b.right - 1280) < 2 && b.w < 700 && b.top < 80 && !(await pg.isVisible('#ssPerde')), `${ad} SS-8 masaüstünde sağ çekmece (${JSON.stringify(b)})`);
    }
    await dokun('#ssX');
    check(!errs.length, `${ad} sayfa hatası: ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`Shift seçici: ${passes} denetim geçti, ${fails} başarısız`);
  process.exit(fails ? 1 : 0);
})();

#!/usr/bin/env node
// 1.0.1 hata düzeltmesi — gerçek cihaz testinde bulunan üç Shift Yönetimi hatasının regresyon testi.
// Android'e yakın koşullar: Pixel 7 öykünmesi (dokunmatik, isMobile, Android Chrome kimliği), işlemci ×4 yavaş,
// ~184 da parsel (8 shift). Gerçek Android WebView'un yerini tutmaz; cihaz testi ayrıca yapılmalıdır.
//  H1 Önizleme: seçimden hemen sonra "hesaplanıyor" durumu; değerler motorla aynı; alt ünite taşımada kaydırma konumu
//     korunur ve önce/sonra özeti görünür kalır; önizleme kayda yazmaz
//  H2 Uygunluk: resmî değerlendirmeyle aynı genel sonuç; varsayımlı günlük süre "uygun" sayılmaz; uygunsuz düzen
//     onaylanıp kaydedilse de sonuç değişmez (panel ve Sonuç ekranı)
//  H3 Harita: seçili shift belirgin vurgulanır ve ekrana sığdırılır; diğerleri soluk; vurgu sırasında harita salt okunur
//     (dokunma sınıra köşe eklemez, bilgi balonu açılmaz)
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };
const lat = 37.0, lng = 35.0;
const temel = (id, extra) => ({ id, name: 'Büyük parsel ' + id, created: 1, updated: 2, schema: 2, rev: 0, revs: [],
  poly: [[lat, lng], [lat, lng + 0.0075], [lat + 0.0021, lng + 0.0078], [lat + 0.0027, lng + 0.0012], [lat + 0.0012, lng - 0.0006]],
  src: [lat - 0.0005, lng - 0.0005], station: null, route: [],
  inp: Object.assign({ crop: 'domates', geom: 'parsel', Q: 120, srcType: 'kuyu', depth: 40, region: 'akdeniz' }, extra || {}) });
const PROJ = [temel('pa'), temel('pb', { hours: 20 })];
const sayi = s => parseFloat(String(s).replace(/\./g, '').replace(',', '.'));

(async () => {
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await pg.addInitScript(ps => { if (!sessionStorage.getItem('s')) { localStorage.setItem('irrismart.projects.v1', JSON.stringify(ps)); sessionStorage.setItem('s', '1'); } }, PROJ);
  await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(1200);
  const P = id => pg.evaluate(id => JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(p => p.id === id), id);
  const ac = async id => { await pg.tap('nav.tabs [data-v=projeler]'); await pg.waitForTimeout(300); await pg.tap(`[data-open="${id}"]`); await pg.waitForTimeout(300); await pg.tap('nav.tabs [data-v=hidrolik]'); await pg.waitForTimeout(2500); await pg.tap('#bShiftYon'); await pg.waitForSelector('#smPanel:not(.sm-min)', { timeout: 30000 }); await pg.waitForTimeout(300); };
  // Motorun bu proje ve taslak için ürettiği değerler (sayfadaki aynı modüllerle)
  const motor = (id, Ns, manual) => pg.evaluate(([id, Ns, manual]) => {
    const p = JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(x => x.id === id), inp = Object.assign({}, p.inp);
    if (Ns != null) inp.Ns = Ns;
    const st = JSON.parse(localStorage.getItem('irrismart.settings.v1') || 'null') || undefined;
    const r = IrriEngine.design(inp, st, { manual, poly: p.poly, src: p.src, station: p.station, route: p.route });
    const o = IrriShiftYonetimi.ozet(r, IrriHydroView.build(r, { inp, Qsource: inp.Q }), IrriAssess.forProject(p, r));
    return { Qmax: o.Qmax, pompaH: o.pompa && o.pompa.H, vMain: o.vMain, hfKritik: o.hfKritik, tur: o.tur, kWh: o.kWh, n: r.sel.groups.length, groups: r.sel.groups, sig: r.layout.sig };
  }, [id, Ns, manual]);
  const ekranDeger = () => pg.$$eval('#smPanel .sm-cmp tr[data-k]', rs => Object.fromEntries(rs.map(r => [r.dataset.k, r.children[2].textContent])));
  const ayni = (e, m, ad) => { const D = { Qmax: 2, pompaH: 2, vMain: 2, hfKritik: 2, tur: 1, kWh: 0 }; const bad = Object.keys(D).filter(k => m[k] != null && Math.abs(sayi(e[k]) - m[k]) > Math.pow(10, -D[k]) * 0.51); check(!bad.length, `${ad}: ekran ≠ motor (${bad.map(k => k + ' ' + e[k] + '≠' + m[k]).join(', ')})`); };

  // ---------- H1 Önizleme ----------
  await ac('pa');
  const m0 = await motor('pa', null, null), kayit0 = JSON.stringify((await P('pa')).inp);
  await pg.evaluate(() => { window.__mesgul = false; new MutationObserver(() => { const e = document.querySelector('#smPanel'); if (e && e.getAttribute('aria-busy') === 'true') window.__mesgul = true; }).observe(document.body, { subtree: true, attributes: true, childList: true }); });
  await pg.selectOption('#smNs', { value: '9' });
  await pg.waitForFunction(() => document.querySelector('#smPanel .sm-cmp') && document.querySelector('#smPanel').getAttribute('aria-busy') !== 'true', null, { timeout: 30000 });
  check(await pg.evaluate(() => window.__mesgul), 'H1 shift sayısı değişince "hesaplanıyor" durumu (aria-busy) gösterilmeli');
  ayni(await ekranDeger(), await motor('pa', 9, null), 'H1 9 shift önizlemesi');
  check(JSON.stringify((await P('pa')).inp) === kayit0, 'H1 önizleme kayda yazmamalı');
  // Son karttaki alt üniteyi taşı: kaydırma konumu korunur, önce/sonra özeti görünür
  await pg.selectOption('#smNs', { value: String(m0.n) }); await pg.waitForFunction(() => document.querySelector('#smPanel').getAttribute('aria-busy') !== 'true', null, { timeout: 30000 }); await pg.waitForTimeout(200);
  const son = await pg.$$eval('#smPanel .sm-shift', a => a[a.length - 1].dataset.j);
  await pg.tap(`#smPanel [data-ac="${son}"]`); await pg.waitForTimeout(300);
  await pg.$eval(`#smPanel select[data-smunit]`, e => e.scrollIntoView({ block: 'center' }));
  const kay0 = await pg.$eval('#smPanel .sm-body', e => e.scrollTop);
  const birim = await pg.$eval('#smPanel select[data-smunit]', e => +e.dataset.smunit);
  const secenek = await pg.$$eval('#smPanel select[data-smunit] option', o => o.map(x => x.value));
  await pg.selectOption('#smPanel select[data-smunit]', { value: secenek[secenek.length - 1] });
  await pg.waitForFunction(() => document.querySelector('#smPanel .sm-cmp') && document.querySelector('#smPanel').getAttribute('aria-busy') !== 'true', null, { timeout: 30000 }); await pg.waitForTimeout(200);
  const kay1 = await pg.$eval('#smPanel .sm-body', e => e.scrollTop);
  check(kay0 > 200 && Math.abs(kay1 - kay0) < 400, `H1 alt ünite taşıyınca panel başa dönmemeli (kaydırma ${kay0} → ${kay1})`);
  const ozetGorunur = await pg.evaluate(() => { const b = document.querySelector('#smOzetBar'); if (!b) return false; const r = b.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight; });
  check(ozetGorunur && /m³\/h/.test(await pg.textContent('#smOzetBar').catch(() => '')), 'H1 taşıma sonrası önce/sonra özeti ekranda görünür olmalı');
  const a0 = []; m0.groups.forEach((g, j) => g.forEach(k => { a0[k] = j; })); a0[birim] = m0.n;
  const ids = [...new Set(a0)].sort((x, y) => x - y), mp = new Map(ids.map((v, i) => [v, i]));
  ayni(await ekranDeger(), await motor('pa', null, { sig: m0.sig, assign: a0.map(v => mp.get(v)) }), 'H1 elle taşıma önizlemesi');
  check(JSON.stringify((await P('pa')).inp) === kayit0 && !(await P('pa')).shiftEdit, 'H1 taşıma önizlemesi kayda yazmamalı');

  // ---------- H2 Uygunluk ----------
  check(await pg.getAttribute('#smUygunluk', 'data-genel') !== 'uygun', 'H2 günlük süre girilmemiş proje "uygun" gösterilmemeli');
  await pg.selectOption('#smNs', { value: String(m0.n) }); await pg.waitForTimeout(300);
  check(await pg.getAttribute('#smUygunluk [data-k=gunluk]', 'data-durum') === 'varsayim' && ['varsayimla', 'uygun-degil'].includes(await pg.getAttribute('#smUygunluk', 'data-genel')) && await pg.isVisible('#smGenel'), 'H2 varsayılan günlük süre: satır "varsayımla", genel sonuç uygun değil (bu projede W-PN-02 de var)');
  await pg.tap('#smIptal'); await pg.waitForTimeout(300);
  await ac('pb');
  await pg.selectOption('#smNs', { value: '9' }); await pg.waitForFunction(() => document.querySelector('#smPanel').getAttribute('aria-busy') !== 'true' && document.querySelector('#smPanel .sm-cmp'), null, { timeout: 30000 });
  check(await pg.getAttribute('#smUygunluk', 'data-genel') === 'uygun-degil' && /W-PN-02/.test(await pg.textContent('#smGenel')), 'H2 9 shift: resmî değerlendirmedeki W-PN-02 nedeniyle "uygun değil" gösterilmeli');
  await pg.selectOption('#smNs', { value: '11' }); await pg.waitForFunction(() => document.querySelector('#smPanel').getAttribute('aria-busy') !== 'true' && document.querySelector('#smPanel .sm-cmp'), null, { timeout: 30000 });
  check(await pg.getAttribute('#smUygunluk [data-k=tur]', 'data-durum') === 'uygun-degil' && await pg.isVisible('#smUygunDegil'), 'H2 11 shift: tur 21,1 h > 20 h açık uyarıyla');
  let soru = ''; pg.removeAllListeners('dialog'); pg.on('dialog', d => { soru += d.message() + ' | '; d.accept(); });
  await pg.tap('#smUygula'); await pg.waitForTimeout(1500);
  check(/Uygun değil/.test(soru) && Number((await P('pb')).inp.Ns) === 11, 'H2 uygun olmayan düzen onayla kaydedilir: ' + soru);
  await pg.tap('nav.tabs [data-v=sonuc]'); await pg.waitForTimeout(2000);
  const kap = () => pg.$eval('#ak-W-KAP-01', e => e.dataset.seviye).catch(() => null);
  check(await kap() === 'uygunsuz', 'H2 kayıttan sonra Sonuç ekranında W-KAP-01 uygunsuz kalmalı');
  await pg.evaluate(() => { const c = document.querySelector('#ak-W-KAP-01'); c.open = true; const s = c.querySelector('select[data-onay]'); s.value = 'kabul'; s.dispatchEvent(new Event('change')); }); await pg.waitForTimeout(300);
  await pg.tap('nav.tabs [data-v=hidrolik]'); await pg.waitForTimeout(1500); await pg.tap('nav.tabs [data-v=sonuc]'); await pg.waitForTimeout(1500);
  check(await kap() === 'uygunsuz', 'H2 "bilinerek kabul" kararı uygunluk sonucunu değiştirmemeli');
  await pg.tap('nav.tabs [data-v=hidrolik]'); await pg.waitForTimeout(1500); await pg.tap('#bShiftYon'); await pg.waitForTimeout(800);
  check(await pg.getAttribute('#smUygunluk', 'data-genel') === 'uygun-degil', 'H2 panel yeniden açıldığında da "uygun değil"');
  await pg.tap('#smGeri'); await pg.waitForTimeout(1500);   // Geri Al: 8 shift'e dön
  check((await P('pb')).inp.Ns == null, 'H2 Geri Al önceki düzene döndü');

  // ---------- H3 Harita ----------
  await ac('pa');
  const mh = await motor('pa', null, null), poly0 = JSON.stringify((await P('pa')).poly);
  await pg.tap('#smPanel [data-harita="1"]'); await pg.waitForTimeout(2500);
  const ds = await pg.$eval('#map', e => Object.assign({}, e.dataset));
  check(ds.vurgu === '1' && Number(ds.vurguBirim) === mh.groups[1].length, `H3 haritada Shift 2 vurgulanmalı (data-vurgu=${ds.vurgu}, birim=${ds.vurguBirim}, beklenen ${mh.groups[1].length})`);
  check(ds.vurguSigdi === '1', 'H3 seçili shift ekrana sığdırılmalı (yakınlaştırma)');
  const kutu = ds.vurguKutu ? JSON.parse(ds.vurguKutu) : null, mapR = await pg.$eval('#map', e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  check(kutu && kutu.x0 >= -2 && kutu.y0 >= -2 && kutu.x1 <= mapR.w + 2 && kutu.y1 <= mapR.h + 2 && (kutu.x1 - kutu.x0) * (kutu.y1 - kutu.y0) > 0.08 * mapR.w * mapR.h, 'H3 seçili shift harita alanında ve belirgin büyüklükte: ' + ds.vurguKutu);
  check(await pg.isVisible('#smChip') && /Shift 2/.test(await pg.textContent('#smChip')), 'H3 panele dönüş düğmesi');
  // Boş alana ve parsele dokunma: salt okunur
  { const top = await pg.$eval('#map', e => e.getBoundingClientRect().top); await pg.touchscreen.tap(mapR.w * 0.12, top + mapR.h * 0.6); await pg.waitForTimeout(600); }   // atıf bağlantısından uzak
  check(JSON.stringify((await P('pa')).poly) === poly0, 'H3 vurgu sırasında haritaya dokunmak sınıra köşe eklememeli');
  if (kutu) { const top = await pg.$eval('#map', e => e.getBoundingClientRect().top); await pg.touchscreen.tap((kutu.x0 + kutu.x1) / 2, top + (kutu.y0 + kutu.y1) / 2); await pg.waitForTimeout(600); }
  check(!(await pg.$('.leaflet-popup')), 'H3 vurgu sırasında bilgi balonu açılıp vurguyu örtmemeli');
  check(JSON.stringify((await P('pa')).poly) === poly0, 'H3 parsel değişmedi');
  await pg.tap('#smChip'); await pg.waitForTimeout(400);
  check(await pg.isVisible('#smPanel'), 'H3 panele dönüldü');
  await pg.tap('#smIptal'); await pg.waitForTimeout(800);
  const ds2 = await pg.$eval('#map', e => Object.assign({}, e.dataset));
  check(!ds2.vurgu, 'H3 panel kapanınca vurgu kalkmalı');
  check(!errs.length, 'sayfa hatası: ' + errs.join(' | '));
  await pg.screenshot({ path: path.join(__dirname, '..', 'test-ui-son.png') }).catch(() => {});
  try { fs.unlinkSync(path.join(__dirname, '..', 'test-ui-son.png')); } catch (e) { }
  await browser.close(); srv.close();
  console.log(`Shift cihaz regresyonu: ${passes} denetim geçti, ${fails} başarısız`);
  process.exit(fails ? 1 : 0);
})();

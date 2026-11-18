#!/usr/bin/env node
// MH-WEB-1 — Web sürümü özellik eşitliği testleri: `npm run test:web`
// Uygulama, GitHub Pages yayın yoluyla aynı alt yolda (/Irrismart/) açılır. Android uygulamasının bütün ekranları
// ve işlevleri tarayıcıda sınanır (docs/ozellik-esitligi.md matrisi; satır kodları [P-..], [A-..] vb.):
//   W-1 Alt yolda açılış, 404 yok          W-2 Bütün ekranlar ve hidrolik bölümler
//   W-3 PDF / Excel / Hidrolik Excel / DXF / A3 pafta / katalog şablonu indirme
//   W-4 JSON yedek → yeni tarayıcıda geri yükleme   W-5 Web notu var, bulut eşitlemesi iması yok
//   W-7 Android (Capacitor) ortamında web notu eklenmez
//   Hesap eşitliği: tarayıcıdaki motor sonucu = Node'daki motor sonucu (aynı kod)
//   Geniş ekran: 1280 / 1440 / 1920 px'te bütün ekranlar taşmasız
// İsteğe bağlı: SHOTS=<klasör> verilirse ekran görüntüleri kaydedilir.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..', 'www'), BASE = '/Irrismart/', SHOTS = process.env.SHOTS || null;
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
const PROJECTS = [
  { id: 'p1', name: 'S01 Domates', created: 1, updated: 3, poly: [], src: null, inp: { crop: 'domates', srcType: 'kuyu', region: 'akdeniz', soil: 'tinli', rowDir: 'uzun', emitter: 'normal', geom: 'dikdortgen', area_da: 50, L: 400, W: 125, Q: 45, depth: 40 } },
  { id: 't2', name: 'test2', created: 1, updated: 2, poly: [], src: null, inp: { crop: 'domates', area_da: 288.9, srcType: 'kuyu', depth: 40, region: 'akdeniz', Q: 86.3 } },
];
// Hesap eşitliği için karşılaştırılan özet (tarayıcıda ve Node'da aynı fonksiyon)
const SUMMARY = `(r, A) => r.ok ? JSON.stringify({ Ns: r.sel.Ns, cyc: r.sel.cycleHours, Qmax: r.sel.Qmax, Qf: r.sectors.Qfield, groups: r.sel.groups,
  main: [r.main.sel.od, r.main.sel.pn, r.main.sel.Hmax, r.main.sel.v], net: r.main.net.map(s => [s.id, s.od, s.L, s.Qmax]),
  pump: [r.pump.need, r.pump.Q, r.pump.H, r.pump.motor, r.pump.kWh], filter: r.filter.text, valve: r.valve.text,
  sch: [r.schedule.gross, r.schedule.t, r.schedule.seasonM3, r.schedule.interval], lat: [r.lateral.d, r.lateral.count, r.lateral.len, r.lateral.maxDH],
  bom: r.bom.map(b => [b.key, b.miktar, b.tutar]), cost: [r.cost.subtotal, r.cost.missing], warn: r.warn, surge: [r.surge.dH, r.surge.peak],
  akil: A ? A.findings.map(x => [x.kod, x.seviye, x.durum.map(q => q.deger), x.cozumler.map(c => c.durum)]) : null }) : JSON.stringify(r.err)`;

let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };

(async () => {
  const srv = http.createServer((q, s) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    if (!u.startsWith(BASE)) { s.writeHead(404); return s.end(); }          // kök yol yok: mutlak yol kullanılırsa 404 olur
    const rel = u.slice(BASE.length), f = path.join(ROOT, rel === '' ? 'index.html' : rel);
    fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); });
  }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const URL0 = `http://localhost:${srv.address().port}${BASE}`;
  const browser = await chromium.launch();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'irri-web-'));
  const open = async (o = {}) => {
    const ctx = await browser.newContext({ viewport: { width: o.w || 1280, height: o.h || 900 }, acceptDownloads: true, geolocation: { latitude: 37.0, longitude: 35.32 }, permissions: ['geolocation'] });
    await ctx.route(/arcgisonline/, r => r.abort());
    await ctx.route(/api\.open-meteo\.com/, r => { const u = new URL(r.request().url()); const n = u.searchParams.get('latitude').split(',').length; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elevation: Array.from({ length: n }, (_, i) => 100 + i * 0.7) }) }); });
    const pg = await ctx.newPage(), errs = [], bad = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept(d.type() === 'prompt' ? (o.promptText || 'Web projesi') : undefined));
    pg.on('response', r => { if (r.status() >= 400 && r.url().startsWith(URL0.replace(BASE, ''))) bad.push(r.status() + ' ' + r.url()); });
    if (o.native) await pg.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true, Plugins: {} }; });
    if (o.seed !== false) await pg.addInitScript(([p, th]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('irrismart.projects.v1', p); sessionStorage.setItem('seeded', '1'); } localStorage.setItem('irrigrow.theme', th); }, [JSON.stringify(o.projects || PROJECTS), o.theme || 'acik']);
    await pg.goto(URL0); await pg.waitForTimeout(1000);
    await pg.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
    return { ctx, pg, errs, bad };
  };
  const go = async (pg, v) => { await pg.click(`nav.tabs [data-v=${v}]`); await pg.waitForTimeout(600); };
  const openProj = async (pg, id) => { await go(pg, 'projeler'); await pg.click(`[data-open=${id}]`); await pg.waitForTimeout(500); };
  const download = async (pg, sel, name) => {
    const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click(sel)]);
    const fn = d.suggestedFilename(), fp = path.join(tmp, fn); await d.saveAs(fp);
    return { fn, fp, buf: fs.readFileSync(fp) };
  };

  // ---------- W-1, W-5: alt yolda açılış ve web notu ----------
  {
    const { ctx, pg, errs, bad } = await open();
    check(await pg.title() !== '' && !!(await pg.$('#v-projeler.on')), 'W-1: uygulama /Irrismart/ altında açılmadı');
    const note = await pg.$eval('#webNote', e => e.textContent).catch(() => '');
    check(/Web sürümü/.test(note) && /yalnız bu tarayıcıda/.test(note) && /bulut eşitlemesi yoktur/.test(note) && /JSON yedek/.test(note), 'W-5: web notu eksik');
    check(/Tarayıcı depolama kullanımı: \d/.test(note), 'W-5: depolama kullanımı gösterilmiyor');
    const all = await pg.evaluate(() => document.body.innerText);
    check(!/(senkronize edildi|eşitlendi|buluta kaydedildi|bulutta saklanır|otomatik yedeklendi)/i.test(all), 'W-5: bulut eşitlemesi ima eden ifade var');
    check(!bad.length, 'W-1: 404/hata yanıtı: ' + bad.join(', '));
    check(!errs.length, 'W-1: sayfa hatası ' + errs.join(' | '));
    await ctx.close();
  }
  // ---------- W-7: Android (Capacitor) ortamında not eklenmez ----------
  {
    const { ctx, pg, errs } = await open({ native: true });
    check(!(await pg.$('#webNote')) && !(await pg.evaluate(() => document.documentElement.classList.contains('web'))), 'W-7: Android ortamında web notu eklendi');
    check(!errs.length, 'W-7: ' + errs.join(' | '));
    await ctx.close();
  }

  // ---------- Hesap eşitliği: tarayıcı motoru = Node motoru ----------
  {
    require('../test/_lib.js'); const E = globalThis.IrriEngine, AS = require('../www/js/assess.js');
    const sum = eval(SUMMARY), SC = require('../test/golden/scenarios.js');
    const cases = SC.map(sc => ({ id: sc.id, inp: sc.inp, opt: sc.opt || {} })).concat([{ id: 'test2', inp: PROJECTS[1].inp, opt: {} }]);
    const { ctx, pg } = await open();
    const browserOut = await pg.evaluate(([cs, src]) => { const f = eval(src); return cs.map(c => { const r = IrriEngine.design(c.inp, null, c.opt); return f(r, r.ok ? IrriAssess.evaluate(r, { inp: c.inp }) : null); }); }, [cases, SUMMARY]);
    // Metinler, kodlar, tamsayılar birebir; ondalık sayılar 1e-9 bağıl toleransla (altın kayıt testiyle aynı ölçüt).
    // Neden tolerans: ECMAScript, Math.pow/exp/log gibi fonksiyonların son bitini JS motoruna bırakır; Node ve
    // Chromium (ve Android WebView) farklı V8 sürümleri kullandığı için son ondalık basamakta (~1e-16) fark olabilir.
    let same = 0, exact = 0, maxRel = 0;
    const cmp = (a, b, p, out) => {
      if (typeof a === 'number' && typeof b === 'number') { const d = Math.abs(a - b), rel = d / Math.max(1e-300, Math.abs(a), Math.abs(b)); if (d > 0) maxRel = Math.max(maxRel, rel); if (!(d <= Math.max(1e-9, 1e-9 * Math.max(Math.abs(a), Math.abs(b))))) out.push(`${p}: ${a} ≠ ${b}`); return; }
      if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') { if (a !== b) out.push(`${p}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); return; }
      const ks = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of ks) cmp(a[k], b[k], p + '.' + k, out);
    };
    cases.forEach((c, i) => {
      const r = E.design(c.inp, null, c.opt), n = sum(r, r.ok ? AS.evaluate(r, { inp: c.inp }) : null), out = [];
      if (n === browserOut[i]) exact++;
      cmp(JSON.parse(n), JSON.parse(browserOut[i]), c.id, out);
      if (!out.length) same++; else check(false, `Hesap eşitliği: ${out.slice(0, 3).join('; ')}`);
    });
    check(same === cases.length, `Hesap eşitliği: ${same}/${cases.length}`);
    console.log(`  hesap eşitliği: ${same}/${cases.length} senaryo aynı (${exact} tanesi bit düzeyinde birebir; en büyük bağıl fark ${maxRel.toExponential(1)})`);
    await ctx.close();
  }

  // ---------- W-2, W-3: bütün ekranlar ve işlevler ----------
  let backup = null;
  {
    const { ctx, pg, errs, bad } = await open({ promptText: 'Web projesi' });
    // [P] Proje yönetimi
    await pg.click('#btnNew'); await pg.waitForTimeout(700);
    check(await pg.$eval('#projName', e => e.textContent) === 'Web projesi' && !!(await pg.$('#v-arazi.on')), '[P-1] yeni proje oluşturulamadı');
    await go(pg, 'projeler');
    const n0 = await pg.$$eval('#projList .proj', x => x.length);
    await pg.click('#projList [data-copy=p1]'); await pg.waitForTimeout(300);
    check(await pg.$$eval('#projList .proj', x => x.length) === n0 + 1, '[P-4] proje çoğaltılamadı');
    await pg.click('#projList [data-ren=p1]'); await pg.waitForTimeout(300);
    check(/Web projesi/.test(await pg.$eval('#projList', e => e.textContent)), '[P-3] yeniden adlandırma çalışmadı');
    const copyId = await pg.$eval('#projList .proj:nth-child(2) [data-del]', e => e.dataset.del).catch(() => null);
    const n1 = await pg.$$eval('#projList .proj', x => x.length);
    const delId = await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(p => /kopya/.test(p.name)).id);
    await pg.click(`#projList [data-del="${delId}"]`); await pg.waitForTimeout(300);
    check(await pg.$$eval('#projList .proj', x => x.length) === n1 - 1, '[P-5] proje silinemedi');

    // [A] Arazi: harita, çizim, köşe taşıma, kaynak, istasyon, ana hat, GPS, uygula (eğim), plan, tam ekran
    await openProj(pg, (await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(p => p.name === 'Web projesi' && !p.inp.Q).id)));
    await go(pg, 'arazi');
    check(!!(await pg.$('#map .leaflet-container, #map.leaflet-container')), '[A-1] harita yüklenmedi');
    check(/Esri/.test(await pg.$eval('.leaflet-control-attribution', e => e.textContent).catch(() => '')), '[A-1] harita atfı (Esri) görünmüyor');
    await pg.click('#mGps'); await pg.waitForTimeout(800);
    check(!/Konum alınamadı/.test(await pg.$eval('#toast', e => e.textContent)), '[A-6] tarayıcı konumu alınamadı');
    const box = await pg.$eval('#map', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await pg.click('#mModes [data-m=sinir]'); await pg.waitForTimeout(200);
    for (const [fx, fy] of [[0.3, 0.3], [0.7, 0.3], [0.7, 0.6], [0.3, 0.6]]) { await pg.mouse.click(box.x + box.w * fx, box.y + box.h * fy); await pg.waitForTimeout(150); }
    const info1 = await pg.$eval('#mapInfo', e => e.textContent);
    check(/dekar/.test(info1) && /4 köşe/.test(info1), '[A-2] haritada sınır çizilemedi: ' + info1);
    const vtx = await pg.$$('.leaflet-marker-icon');
    if (vtx.length) { const b = await vtx[1].boundingBox(); await pg.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await pg.mouse.down(); await pg.mouse.move(b.x + 60, b.y + 30, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(300); }
    check(vtx.length >= 4 && (await pg.$eval('#mapInfo', e => e.textContent)) !== info1, '[A-3] köşe noktası fareyle taşınamadı');
    await pg.click('#mModes [data-m=kaynak]'); await pg.mouse.click(box.x + box.w * 0.2, box.y + box.h * 0.2); await pg.waitForTimeout(200);
    check(/kaynak işaretli/.test(await pg.$eval('#mapInfo', e => e.textContent)), '[A-8] su kaynağı işaretlenemedi');
    await pg.click('#mModes [data-m=istasyon]'); await pg.mouse.click(box.x + box.w * 0.25, box.y + box.h * 0.25); await pg.waitForTimeout(200);
    await pg.click('#mModes [data-m=anahat]'); await pg.mouse.click(box.x + box.w * 0.28, box.y + box.h * 0.35); await pg.waitForTimeout(200);
    const stored = await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(p => p.name === 'Web projesi' && p.poly.length));
    check(stored && stored.poly.length === 4 && stored.src && stored.station && stored.route.length === 1, '[A-9/A-11] sınır, kaynak, istasyon veya ana hat güzergâhı kaydedilmedi');
    await pg.click('#mModes [data-m=sinir]'); await pg.click('#mApply'); await pg.waitForTimeout(1500);
    const ap = await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(p => p.name === 'Web projesi' && p.poly.length));
    check(ap.inp.geom === 'parsel' && ap.inp.area_da > 0 && ap.inp.grad && ap.elev, '[A-4/A-5] parsel uygulanamadı veya eğim (kot servisi) işlenmedi');
    check(!!(await pg.$('#v-veri.on')), '[A-4] “Uygula” sonrası Veriler ekranına geçilmedi (Android ile aynı akış)');
    await go(pg, 'arazi');
    await pg.click('#mFull'); await pg.waitForTimeout(200);
    check(await pg.evaluate(() => document.body.classList.contains('mapfull')), '[A-7] harita tam ekran olmadı');
    await pg.click('#mFull');

    // [V] Veriler: bütün alanlar ve proje ayarları
    await go(pg, 'veri');
    await pg.fill('#form input[name=Q]', '60'); await pg.dispatchEvent('#form input[name=Q]', 'change'); await pg.waitForTimeout(300);
    const fields = await pg.$$eval('#form [name]', els => els.map(e => e.name));
    for (const k of ['geom', 'rowDir', 'slopeLong', 'slopeShort', 'nB', 'teleskop', 'crop', 'Sr', 'Sp', 'region', 'et0', 'soil', 'interval', 'emitter', 'latD', 'q', 'Se', 'srcType', 'Q', 'depth', 'dZ', 'hours', '__planOrani'])   // dSource: haritada kaynak işaretliyse tasarım gereği gizli (mesafe haritadan)
      check(fields.includes(k), `[V] veri alanı yok: ${k}`);
    await pg.click('#btnCalc'); await pg.waitForTimeout(1200);

    // [S] Sonuç: özet, uyarılar, shift alternatifleri, shift düzenleme, ana hat alternatifleri, yerleşim alternatifleri
    check(!!(await pg.$('#v-sonuc.on #result .big')), '[S-1] sonuç ekranı açılmadı');
    check(!!(await pg.$('#akil .ak-card')), '[F-1] mühendislik uyarıları yok');
    check((await pg.$$('#result tr[data-ns]')).length > 0 && (await pg.$$('#result tr[data-od]')).length > 0, '[S-2/S-3] shift veya ana hat alternatifleri tablosu yok');
    await pg.evaluate(() => document.querySelectorAll('#result details.ucard').forEach(d => { d.open = true; }));
    const sel = await pg.$('#result select[data-unit]');
    if (sel) { const opts = await sel.$$eval('option', o => o.map(x => x.value)); await sel.selectOption(opts[opts.length - 1]); await pg.waitForTimeout(900); }
    check(/elle düzenlendi/.test(await pg.$eval('#result', e => e.textContent)), '[E-4] shift ataması elle değiştirilemedi');
    await pg.click('#bShiftAuto'); await pg.waitForTimeout(700);
    await pg.click('#bAlt'); await pg.waitForSelector('#altBody table', { timeout: 60000 });
    check((await pg.$$('#altBody tr[data-alt]')).length >= 2, '[S-4] yerleşim alternatifleri hesaplanmadı');
    const pdf = await download(pg, '#bPdf'), xls = await download(pg, '#bXls');
    check(/^IrriGrow_.*\.pdf$/.test(pdf.fn) && pdf.buf.slice(0, 4).toString() === '%PDF' && pdf.buf.length > 20000, '[R-1] PDF raporu indirilemedi');
    check(/^IrriGrow_.*\.xlsx$/.test(xls.fn) && xls.buf.slice(0, 2).toString() === 'PK', '[R-2] Excel raporu indirilemedi');
    const XLSX = require('xlsx'); const wb = XLSX.read(xls.buf); check(wb.SheetNames.includes('Uyarılar') && wb.SheetNames.includes('Malzeme (fiyatlı)'), '[R-2] Excel sayfaları eksik');

    // [A-12] Haritada plan katmanı (Leaflet canvas çizer) ve [A-13/E-4] harita fırçasıyla shift ataması
    await go(pg, 'arazi'); await pg.waitForTimeout(800);
    const inked = () => pg.evaluate(() => { let n = 0; document.querySelectorAll('#map .leaflet-overlay-pane canvas').forEach(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++; }); return n; });
    const withPlan = await inked();
    await pg.click('#mPlan'); await pg.waitForTimeout(400);
    const noPlan = await inked();
    await pg.click('#mPlan'); await pg.waitForTimeout(400);
    check(withPlan > noPlan * 1.5 && withPlan > 500, `[A-12] haritada plan katmanı çizilmedi (${withPlan} / ${noPlan})`);
    await pg.click('#mModes [data-m=shift]'); await pg.waitForTimeout(400);
    const brushes = await pg.$$('#mShiftBar [data-b]');
    check(brushes.length >= 2, '[A-13] shift fırçası çubuğu yok');
    if (brushes.length >= 2) {
      await brushes[brushes.length - 1].click(); await pg.waitForTimeout(200);
      const mb = await pg.$eval('#map', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
      let assigned = false;
      for (const [fx, fy] of [[0.5, 0.45], [0.4, 0.4], [0.6, 0.5], [0.45, 0.55], [0.55, 0.35]]) {
        await pg.mouse.click(mb.x + mb.w * fx, mb.y + mb.h * fy); await pg.waitForTimeout(400);
        if (await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1')).some(p => p.shiftEdit))) { assigned = true; break; }
      }
      check(assigned, '[A-13/E-4] haritada fırçayla shift ataması yapılamadı');
      const au = await pg.$('#mAuto'); if (au) { await au.click(); await pg.waitForTimeout(400); }
    }
    await pg.click('#mModes [data-m=sinir]');

    // [H] Hidrolik: 8 bölüm, her shift ekranı, Hidrolik Hesap Tablosu ve Hidrolik Excel
    await go(pg, 'hidrolik');
    for (const tab of ['ozet', 'lateral', 'manifold', 'anahat', 'shift', 'pompa', 'basinc', 'tablo']) {
      await pg.click(`[data-ptab=${tab}]`); await pg.waitForTimeout(350);
      check(await pg.$$eval('#hydro [data-v], #hydro table', x => x.length) > 0, `[H] ${tab} bölümü boş`);
    }
    await pg.click('#hpTable [data-tab=sys]').catch(() => {}); await pg.waitForTimeout(300);
    const sf = await pg.$('#sysFill'); if (sf) { await sf.click(); await pg.waitForTimeout(300); }
    const hx = await download(pg, '#hXls');
    check(/_hidrolik_.*\.xlsx$/.test(hx.fn) && hx.buf.slice(0, 2).toString() === 'PK', '[R-3] Hidrolik Excel indirilemedi');

    // [M] Malzeme
    await go(pg, 'malzeme');
    const price = await pg.$('#bom input.price');
    if (price) { await price.fill('12,5'); await price.dispatchEvent('change'); await pg.waitForTimeout(300); }
    check(!!price && (await pg.$$('#bom table tr')).length > 5, '[M-1] malzeme listesi veya fiyat girişi yok');
    const pdf2 = await download(pg, '#bPdf2'); check(pdf2.buf.slice(0, 4).toString() === '%PDF', '[M-2] malzeme ekranından PDF indirilemedi');

    // [T] Teknik proje: pafta, yakınlaştırma, A3 PDF, DXF
    await go(pg, 'teknik');
    check(!!(await pg.$('#techSvg svg')), '[T-1] teknik pafta çizilmedi');
    await pg.click('#tzIn'); await pg.click('#tzOut'); await pg.click('#tzFit');
    const fmtSel = await pg.$('#tech select[data-o=format]');
    if (fmtSel) { await fmtSel.selectOption('A1'); await pg.waitForTimeout(500); }
    check(!!fmtSel && await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1')).some(p => p.techOpt && p.techOpt.format === 'A1')), '[T-1] pafta biçimi değiştirilemedi');
    if (fmtSel) { await pg.selectOption('#tech select[data-o=format]', 'A3'); await pg.waitForTimeout(500); }
    const pa = await download(pg, '#tPdf'), dx = await download(pg, '#tDxf');
    check(/_pafta_A3.*\.pdf$/.test(pa.fn) && pa.buf.slice(0, 4).toString() === '%PDF', '[R-5] A3 pafta PDF indirilemedi');
    check(/\.dxf$/.test(dx.fn) && /SECTION/.test(dx.buf.toString('latin1').slice(0, 2000)), '[R-4] DXF indirilemedi');

    // [J] Ayarlar: tema, dil, fiyatlar, katalog şablonu
    await pg.click('#btnSettings'); await pg.waitForTimeout(400);
    await pg.selectOption('#themeSet', 'koyu'); await pg.waitForTimeout(200);
    check(await pg.evaluate(() => document.documentElement.dataset.theme === 'dark'), '[J-1] koyu tema uygulanmadı');
    await pg.selectOption('#themeSet', 'acik');
    await pg.selectOption('#langSet', 'en'); await pg.waitForTimeout(400);
    check(/Settings|Language|Appearance/.test(await pg.$eval('#settings', e => e.textContent)), '[J-2] dil değişmedi');
    await pg.selectOption('#langSet', 'tr'); await pg.waitForTimeout(400);
    const pin = await pg.$('#settings input[data-k]');
    if (pin) {
      const key = await pin.evaluate(e => e.dataset.k); await pin.fill('7,25'); await pin.dispatchEvent('change'); await pg.waitForTimeout(300);
      check(await pg.evaluate(k => { const st = JSON.parse(localStorage.getItem('irrismart.settings.v1') || '{}'); return Math.abs(Number(st[k]) - 7.25) < 1e-9; }, key), '[J-3] fiyat ayarı kaydedilmedi: ' + key);
    } else check(false, '[J-3] fiyat alanı yok');
    const ct = await download(pg, '#catTpl'); check(JSON.parse(ct.buf.toString()).pompa, '[J-4] katalog şablonu indirilemedi');

    // [P] JSON yedek
    await go(pg, 'projeler');
    backup = await download(pg, '#btnBackup');
    const j = JSON.parse(backup.buf.toString());
    check(/^IrriGrow_yedek_.*\.json$/.test(backup.fn) && j.uygulama === 'IrriGrow' && j.yedekSurum === 1 && j.projects.length >= 3 && j.projects.every(p => p.schema), '[P-6] JSON yedek sürüm bilgisiyle indirilemedi');
    check(!bad.length, 'W-2: 404/hata yanıtı: ' + bad.join(', '));
    check(!errs.length, 'W-2: sayfa hatası ' + errs.join(' | '));
    await ctx.close();
  }

  // ---------- W-4: yedeği yeni bir tarayıcıya geri yükle; mevcut projeler silinmez ----------
  {
    const keep = [{ id: 'yerel', name: 'Yerel proje', created: 1, updated: 9, poly: [], src: null, inp: { crop: 'domates', area_da: 10, Q: 10 } }];
    const { ctx, pg, errs } = await open({ projects: keep });
    await pg.setInputFiles('#restoreFile', backup.fp); await pg.waitForTimeout(1200);
    const after = await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1')));
    const src = JSON.parse(backup.buf.toString()).projects;
    check(after.some(p => p.id === 'yerel') && src.every(p => after.some(q => q.id === p.id)), 'W-4: geri yüklemede proje kaybı');
    const same = src.every(p => { const q = after.find(x => x.id === p.id); return JSON.stringify(q.inp) === JSON.stringify(p.inp) && JSON.stringify(q.poly) === JSON.stringify(p.poly); });
    check(same, 'W-4: geri yüklenen proje girdileri farklı');
    // Aynı proje tarayıcıda geri yüklendikten sonra aynı sonucu verir
    const r = await pg.evaluate(id => { const p = JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(x => x.id === id); const r = IrriEngine.design(p.inp, null, { poly: p.poly, src: p.src, station: p.station, route: p.route }); return r.ok ? [r.sel.Ns, r.sel.cycleHours, r.main.sel.Hmax] : null; }, 'p1');
    require('../test/_lib.js'); const rn = globalThis.IrriEngine.design(src.find(p => p.id === 'p1').inp);
    check(r && JSON.stringify(r) === JSON.stringify([rn.sel.Ns, rn.sel.cycleHours, rn.main.sel.Hmax]), 'W-4: geri yüklenen projenin sonucu farklı');
    check(!errs.length, 'W-4: ' + errs.join(' | '));
    await ctx.close();
  }

  // ---------- Geniş ekranlar: 1280 / 1440 / 1920 px ----------
  for (const w of [1280, 1440, 1920]) {
    const { ctx, pg, errs } = await open({ w, h: 1000 });
    await openProj(pg, 't2');
    for (const v of ['projeler', 'arazi', 'veri', 'sonuc', 'hidrolik', 'malzeme', 'teknik']) {
      if (v === 'projeler') await go(pg, 'projeler'); else { if (!(await pg.$('#projName'))) continue; await go(pg, v); }
      const ov = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      check(ov <= 0, `${w}px ${v}: yatay taşma ${ov}px`);
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: `${SHOTS}/${w}-${v}.png` }); }
    }
    await pg.click('#btnSettings'); await pg.waitForTimeout(300);
    check(await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, `${w}px ayarlar: taşma`);
    check(!errs.length, `${w}px: ${errs.join(' | ')}`);
    await ctx.close();
  }

  await browser.close(); srv.close();
  console.log(`\n${passes} kontrol geçti, ${fails} kontrol başarısız`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

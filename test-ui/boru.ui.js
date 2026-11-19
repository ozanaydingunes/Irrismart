#!/usr/bin/env node
// K-3 — Hidrolik ekranında ana hat borusu seçimi (masaüstü 1280 px ve telefon 390 px):
//   B-1 kart görünür; yalnız doğrulanmış kombinasyonlar seçilebilir, PVC-U "veri eksik" ve seçilemez
//   B-2 seçim uygulanınca proje girdisine yazılır, hesap kendiliğinden yenilenir, ekranda malzeme/SDR/PN/iç çap görünür
//   B-3 aynı dış çapta PN değişince iç çap ve hız değişir
//   B-4 uygunsuz seçim silinmez; gerekçeli uyarı gösterilir
//   B-5 otomatiğe dönüş onaylı; eski davranış (PVC-U otomatik) geri gelir
//   B-6 kütüphane yüklenemezse açık hata; seçim içeren proje sessizce varsayılan boruya dönmez
//   B-7 Excel raporunda seçilen boru etiketi
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
const P1 = { id: 'b1', name: 'Boru testi', created: 1, updated: 2, poly: [], src: null, inp: { crop: 'domates', srcType: 'kuyu', region: 'akdeniz', soil: 'tinli', rowDir: 'uzun', emitter: 'normal', geom: 'dikdortgen', area_da: 50, L: 400, W: 125, Q: 45, depth: 40 } };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };

(async () => {
  const srv = http.createServer((q, s) => {
    const u = decodeURIComponent(q.url.split('?')[0]), f = path.join(ROOT, u === '/' ? 'index.html' : u);
    fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); });
  }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const URL0 = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const open = async (w, o = {}) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, acceptDownloads: true });
    await ctx.route(/arcgisonline|open-meteo/, r => r.abort());
    if (o.kutuphaneYok) await ctx.route(/js\/pipes(-data)?\.js/, r => r.abort());
    const pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
    await pg.addInitScript(p => { if (!sessionStorage.getItem('s')) { localStorage.setItem('irrismart.projects.v1', p); sessionStorage.setItem('s', '1'); } }, JSON.stringify([o.proje || P1]));
    await pg.goto(URL0); await pg.waitForTimeout(800);
    await pg.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
    await pg.click('nav.tabs [data-v=projeler]'); await pg.waitForTimeout(300);
    await pg.click(`[data-open=${(o.proje || P1).id}]`); await pg.waitForTimeout(400);
    await pg.click('nav.tabs [data-v=hidrolik]'); await pg.waitForTimeout(900);
    return { ctx, pg, errs };
  };
  const proje = pg => pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0]);
  const anaCap = pg => pg.evaluate(() => { const r = [...document.querySelectorAll('#hydro [data-v], #hydro td, #hydro .kv div, #hydro *')].map(e => e.textContent).join(' | '); return r; });

  for (const w of [1280, 390]) {
    const { ctx, pg, errs } = await open(w);
    const tag = `[${w}px]`;
    // B-1
    check(!!(await pg.$('#boruKarti')), `${tag} B-1 boru kartı yok`);
    const pvc = await pg.$eval('#boruMalz option[value="PVC-U"]', o => ({ dis: o.disabled, txt: o.textContent }));
    check(pvc.dis && /veri eksik/.test(pvc.txt), `${tag} B-1 PVC-U seçilebilir olmamalı`);
    check(/PVC-U: doğrulanmış katalog verisi yok/.test(await pg.$eval('#boruKarti', e => e.textContent)), `${tag} B-1 PVC-U veri eksikliği mesajı yok`);
    const sdrList = await pg.$$eval('#boruSdr option', os => os.map(o => o.value));
    check(sdrList.length >= 1 && !sdrList.includes('26'), `${tag} B-1 PN6 (SDR26) listede olmamalı: ${sdrList}`);
    // B-2
    await pg.selectOption('#boruMalz', 'PE100'); await pg.selectOption('#boruOd', '110'); await pg.selectOption('#boruSdr', '11');
    await pg.click('#boruUygula'); await pg.waitForTimeout(900);
    let p = await proje(pg);
    check(p.inp.boruSecimi && p.inp.boruSecimi.ana.malzeme === 'PE100' && p.inp.boruSecimi.ana.od === 110 && p.inp.boruSecimi.ana.sdr === 11, `${tag} B-2 seçim projeye yazılmadı`);
    const k1 = await pg.$eval('#boruKarti', e => e.textContent);
    check(/PE100 Ø110 SDR11 PN16/.test(k1) && /90,0 mm/.test(k1), `${tag} B-2 seçili boru/iç çap görünmüyor`);
    check(/PE100 Ø110 SDR11 PN16/.test(await anaCap(pg)), `${tag} B-2 panelde ana çap etiketi güncellenmedi`);
    const v16 = await pg.evaluate(() => { const r = IrriEngine.design(JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0].inp); return r.ok ? r.main.sel.v : null; });
    // B-3
    await pg.selectOption('#boruSdr', '17'); await pg.click('#boruUygula'); await pg.waitForTimeout(900);
    const k2 = await pg.$eval('#boruKarti', e => e.textContent);
    const v10 = await pg.evaluate(() => { const r = IrriEngine.design(JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0].inp); return r.ok ? r.main.sel.v : null; });
    check(/SDR17 PN10/.test(k2) && /96,8 mm/.test(k2) && v16 > v10, `${tag} B-3 PN değişince iç çap/hız değişmedi (${v16} / ${v10})`);
    // B-4
    await pg.selectOption('#boruOd', '63'); await pg.selectOption('#boruSdr', '11'); await pg.click('#boruUygula'); await pg.waitForTimeout(900);
    p = await proje(pg);
    check(p.inp.boruSecimi.ana.od === 63, `${tag} B-4 uygunsuz seçim silinmemeli`);
    const uy = await pg.$('#boruUygunsuz');
    check(!!uy && /2,0 m\/s/.test(await uy.textContent()) && /seçiminiz silinmedi/.test(await uy.textContent()), `${tag} B-4 gerekçeli uygunsuzluk uyarısı yok`);
    // B-5
    await pg.click('#boruKarti [data-boru=oto]'); await pg.waitForTimeout(900);
    p = await proje(pg);
    check(!p.inp.boruSecimi && /Otomatik seçim: PVC-U/.test(await pg.$eval('#boruKarti', e => e.textContent)), `${tag} B-5 otomatiğe dönülemedi`);
    // Taşma yok
    check(!(await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), `${tag} yatay taşma`);
    check(!errs.length, `${tag} sayfa hatası: ${errs.join(' | ')}`);
    await ctx.close();
  }

  // B-6: kütüphane yüklenemezse açık hata, seçimli proje sessizce varsayılana dönmez
  {
    const secimli = Object.assign({}, P1, { id: 'b2', inp: Object.assign({}, P1.inp, { boruSecimi: { ana: { malzeme: 'PE100', od: 110, sdr: 17 } } }) });
    const { ctx, pg } = await open(1280, { kutuphaneYok: true, proje: secimli });
    const t = await pg.$eval('#hydro', e => e.textContent);
    check(/Boru kütüphanesi yüklenemedi/.test(t) && /kütüphane yüklenmeden hesap yapılamaz/.test(t), 'B-6 kütüphane hatası gösterilmedi');
    check(/Boru kütüphanesi yüklü değil/.test(t) && !/PVC-U Ø/.test(t), 'B-6 seçimli proje sessizce varsayılan boruyla hesaplandı');
    check((await proje(pg)).inp.boruSecimi.ana.od === 110, 'B-6 seçim kaybolmamalı');
    await ctx.close();
  }

  // B-7: rapor etiketi (Excel özet satırı)
  {
    const { ctx, pg } = await open(1280);
    const satir = await pg.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0];
      p.inp.boruSecimi = { ana: { malzeme: 'PE100', od: 125, sdr: 17 } };
      const r = IrriEngine.design(p.inp); const wb = IrriReportData.workbook(XLSX, p, r);
      const oku = n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 }).map(x => x.join(' ')).join('\n');
      return { hid: oku('Hidrolik'), mal: wb.SheetNames.filter(n => /^Malzeme/.test(n)).map(oku).join('\n'), vars: oku('Varsayımlar') };
    });
    check(/Ana hat PE100 Ø125 SDR17 PN10 \(elle seçildi\)/.test(satir.hid), 'B-7 Excel Hidrolik sayfasında seçilen boru etiketi yok');
    check(/PE100 boru Ø125 SDR17 PN10/.test(satir.mal), 'B-7 Excel malzeme listesinde seçilen boru yok');
    check(/kullanıcı tarafından seçildi: PE100 Ø125 SDR17 PN10/.test(satir.vars), 'B-7 Excel varsayımlarında seçim yok');
    await ctx.close();
  }

  await browser.close(); srv.close();
  console.log(`\n${passes} kontrol geçti, ${fails} kontrol başarısız`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

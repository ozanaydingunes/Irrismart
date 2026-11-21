#!/usr/bin/env node
// 1.0.5 gerçek cihaz hatası regresyonu (Android emülatöründe gerçek WebView ile bulundu):
//  G1 Shift Yönetimi her girişten açıldığında (Hidrolik düğmesi, Arazi Shift çubuğu, Shiftler paneli → Düzenle)
//     shift sayısı − / + düğmeleri, uygunluk ve önce/sonra bölümü KAYDIRMADAN görünür olmalı.
//     Hata: panel açılırken seçili shift kartına kaydırılıyordu; − / + ekranın ~900 px yukarısında kalıyordu.
//     Önceki testler Playwright'ın tıklamadan önce öğeyi kendiliğinden görünür alana kaydırması nedeniyle bunu yakalamadı;
//     bu test tıklamadan önce konumu ölçer ve dokunuşu ekran koordinatıyla yapar.
//  G2 320 px genişlikte Hidrolik içeriği yatay taşmamalı; Shift Yönetimi düğmesi ekranda olmalı.
//     (Eski WebView'daki taşma yeni Chromium'da yeniden üretilemez; gerçek kanıt emülatör tanılama iş akışındadır.)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };
const lat = 37.0, lng = 35.0;
const PROJ = [{ id: 'pb', name: 'Test 8 shift', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [[lat, lng], [lat, lng + 0.0075], [lat + 0.0021, lng + 0.0078], [lat + 0.0027, lng + 0.0012], [lat + 0.0012, lng - 0.0006]], src: [lat - 0.0005, lng - 0.0005], station: null, route: [], inp: { crop: 'domates', geom: 'parsel', Q: 120, srcType: 'kuyu', depth: 40, region: 'akdeniz', hours: 20 } },
  // G5: küçük projeler — motor daha az shift üretmez (kaynak debisi) veya tek alt ünite vardır
  { id: 'p3', name: 'Test 3 shift', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [], src: null, inp: { crop: 'domates', area_da: 20, L: 200, W: 100, Q: 40, srcType: 'kuyu', depth: 30, region: 'akdeniz', hours: 20 } },
  { id: 'p1', name: 'Test tek shift', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [], src: null, inp: { crop: 'domates', area_da: 4, L: 80, W: 50, Q: 60, srcType: 'kuyu', depth: 20, region: 'akdeniz', hours: 20 } }];

(async () => {
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  // G4 Eski Android WebView (Chrome < 87) `inset` kısaltmasını tanımaz: .view konumsuz kalır, genişliği içeriğe göre büyür
  //    ve dikey kaydırma çalışmaz (API 30 / WebView 83 emülatöründe #hydro 967 px). Uzun biçimli top/right/bottom/left kullanılmalı.
  const css = fs.readFileSync(path.join(ROOT, 'css', 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const insetler = css.match(/(^|[;{\s])inset\s*:[^;}]*/g) || [];
  check(!insetler.length, `G4 CSS eski WebView'da desteklenmeyen inset kısaltması içeriyor: ${insetler.map(x => x.trim()).join(' | ')}`);
  const browser = await chromium.launch();
  for (const [ad, vp] of [['320', { width: 320, height: 616 }], ['390', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
    await pg.addInitScript(ps => { if (!sessionStorage.getItem('s')) { localStorage.setItem('irrismart.projects.v1', JSON.stringify(ps)); sessionStorage.setItem('s', '1'); } }, PROJ);
    await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(800);
    // Dokunuş: öğenin MEVCUT ekran konumuna (Playwright'ın kendiliğinden kaydırması olmadan)
    const kutu = sel => pg.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, top: b.top, bottom: b.bottom, left: b.left, right: b.right }; }, sel);
    const ekranda = b => b && b.top >= 0 && b.bottom <= vp.height && b.left >= 0 && b.right <= vp.width;
    const dokun = async (sel, ad2) => { const b = await kutu(sel); check(ekranda(b), `${ad} ${ad2}: dokunmadan önce ekranda olmalı (${JSON.stringify(b)})`); if (b) { await pg.touchscreen.tap(b.x, b.y); await pg.waitForTimeout(700); } return b; };
    const git = async v => { await pg.evaluate(v => document.querySelector(`nav.tabs [data-v=${v}]`).click(), v); await pg.waitForTimeout(900); };
    await pg.evaluate(() => document.querySelector('[data-open="pb"]').click()); await pg.waitForTimeout(300);
    await git('hidrolik');

    // G2 yatay taşma
    const tasan = await pg.evaluate(() => [...document.querySelectorAll('#v-hidrolik *')].filter(e => e.getBoundingClientRect().width > innerWidth + 1).slice(0, 5).map(e => (e.id || e.tagName) + '.' + String(e.className).slice(0, 25)));
    check(!tasan.length, `${ad} G2 Hidrolik yatay taşıyor: ${tasan}`);

    const ustBolum = async giris => {
      await pg.waitForSelector('#smPanel'); await pg.waitForTimeout(400);
      for (const [sel, ad2] of [['#smNsArti', '+'], ['#smNsEksi', '−'], ['#smNs', 'shift sayısı'], ['#smUygunluk h3', 'uygunluk']]) {
        const b = await kutu(sel); check(ekranda(b), `${ad} G1 ${giris}: ${ad2} kaydırmadan görünür olmalı (${b && Math.round(b.top)})`);
      }
      const arti = await kutu('#smNsArti');
      if (ekranda(arti)) { const n0 = await pg.textContent('#smNsN'); await pg.touchscreen.tap(arti.x, arti.y); await pg.waitForFunction(() => document.querySelector('#smPanel').getAttribute('aria-busy') !== 'true', null, { timeout: 30000 }); await pg.waitForTimeout(300);
        check(+(await pg.textContent('#smNsN')) === +n0 + 1, `${ad} G1 ${giris}: + dokunuşu shift sayısını artırır`);
        check(ekranda(await kutu('#smOzetBar')), `${ad} G1 ${giris}: değişiklikten sonra önce/sonra özeti kaydırmadan görünür`); }
      await pg.evaluate(() => document.querySelector('#smIptal').click()); await pg.waitForTimeout(400);
    };
    // 1) Hidrolik düğmesi
    await dokun('#bShiftYon', 'Shift Yönetimi düğmesi'); await ustBolum('Hidrolik');
    // 2) Shiftler paneli → Shift 4 → Düzenle
    await dokun('#ssTut', 'Shiftler tutamağı'); await pg.waitForSelector('#ssSheet');
    await pg.evaluate(() => document.querySelector('[data-ssj="3"]').scrollIntoView({ inline: 'center' })); await pg.waitForTimeout(600);
    await dokun('[data-ssj="3"]', 'Shift 4 çipi');
    // G3 kısa ekranda çip satırı ezilmemeli: çip görünür ve dokunulan nokta çipin kendisi olmalı
    const ust = await pg.evaluate(() => { const e = document.querySelector('.ss-chip.on'), r = e.getBoundingClientRect(), u = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(u && u.closest('[data-ssj]')); });
    check(ust, `${ad} G3 Shift çipi başka bir katmanın altında kalmamalı`);
    const secilen = await pg.$eval('.ss-chip.on', e => e.dataset.ssj).catch(() => null);
    check(secilen === '3', `${ad} G1 Shift 4 çipi seçildi (${secilen})`);
    await dokun('#ssDuzenle', 'Düzenle'); await pg.waitForSelector('#smPanel');
    const kartlar = await pg.$$eval('#smPanel .sm-shift', a => a.map(x => x.dataset.j + (x.classList.contains('on') ? '*' : '')).join(' ')).catch(() => '-');
    check(await pg.$eval('#smPanel .sm-shift.on', e => e.dataset.j).catch(() => null) === '3', `${ad} G1 Düzenle: Shift 4 seçili (vurgulu) — kartlar: ${kartlar}; git: ${await pg.textContent('#smKartaGit').catch(() => '-')}`);
    await ustBolum('Shiftler paneli');
    // 3) Arazi Shift çubuğu
    await git('arazi'); await pg.evaluate(() => document.querySelector('#mModes [data-m=shift]').click()); await pg.waitForTimeout(500);
    await pg.evaluate(() => document.querySelector('#mShiftBar [data-b="2"]').click()); await pg.waitForTimeout(300);
    await pg.evaluate(() => document.querySelector('#mSY').click()); await ustBolum('Arazi');
    // G5 Pasif − / + ve boş "alt ünite ekle" listesinin nedeni ekranda yazılı olmalı (cihaz testi: soluk düğme "çalışmıyor" gibi görünüyordu)
    for (const [pid, beklenen] of [['p3', { eksi: true, arti: false, neden: 1, ekleYok: false }], ['p1', { eksi: true, arti: true, neden: 2, ekleYok: true }]]) {
      await git('projeler'); await pg.evaluate(i => document.querySelector(`[data-open="${i}"]`).click(), pid); await pg.waitForTimeout(300); await git('hidrolik');
      await pg.evaluate(() => document.querySelector('#bShiftYon').click()); await pg.waitForSelector('#smPanel'); await pg.waitForTimeout(500);
      const d = await pg.evaluate(() => ({ eksi: document.querySelector('#smNsEksi').disabled, arti: document.querySelector('#smNsArti').disabled, neden: [...document.querySelectorAll('#smNsNeden li')].map(x => x.textContent), ekleYok: !!document.querySelector('[data-smekle-yok]'), ekle: !!document.querySelector('select[data-smekle]') }));
      check(d.eksi === beklenen.eksi && d.arti === beklenen.arti, `${ad} G5 ${pid}: − / + durumu (${JSON.stringify(d)})`);
      check(d.neden.length === beklenen.neden, `${ad} G5 ${pid}: pasif düğme nedeni yazılı (${d.neden.join(' | ')})`);
      if (pid === 'p3') check(/Daha az shift mümkün değil/.test(d.neden[0] || ''), `${ad} G5 p3: − nedeni kaynak debisi`);
      if (pid === 'p1') check(d.neden.some(x => /alt ünite sayısı 1/.test(x)), `${ad} G5 p1: + nedeni alt ünite sayısı`);
      check(d.neden.length === 0 || ekranda(await kutu('#smNsNeden')), `${ad} G5 ${pid}: neden metni kaydırmadan görünür`);
      check(d.ekleYok === beklenen.ekleYok && d.ekle === !beklenen.ekleYok, `${ad} G5 ${pid}: boş "alt ünite ekle" listesi yerine neden`);
      const n0 = await pg.textContent('#smNsN'); const e = await kutu('#smNsEksi'); await pg.touchscreen.tap(e.x, e.y); await pg.waitForTimeout(400);
      check(await pg.textContent('#smNsN') === n0, `${ad} G5 ${pid}: pasif − dokunuşu sayıyı değiştirmez`);
      await pg.evaluate(() => document.querySelector('#smIptal').click()); await pg.waitForTimeout(300);
    }
    check(!errs.length, `${ad} sayfa hatası: ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`Shift görünürlük: ${passes} denetim geçti, ${fails} başarısız`);
  process.exit(fails ? 1 : 0);
})();

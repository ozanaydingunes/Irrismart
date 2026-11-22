#!/usr/bin/env node
// PR #40 Otomatik / Manuel Shift modu arayüz testi (Chromium; telefon 390 px ve masaüstü 1280 px).
//  M1 Manuel moda geçiş, etiket; − / + 1 … alt ünite sayısı
//  M2 İstenen sayı sessizce değişmez (motorun kendi bölmesinin 5 yerine 6 verdiği 12 alt üniteli projede manuel 5 → 5)
//  M3 Kaynak debisi altındaki düzen: hesaplanır, "uygun değil", kaynak oranı ✗; kaydedilirse kullanıcı kararı saklanır, uygunluk değişmez
//  M4 Başlangıç dağılımı adayları (debi dengeli / basınç gruplu) motorla değerlendirilir
//  M5 Otomatik moda dönüş; İptal kaydı değiştirmez; Geri Al kararı da geri alır; JSON yedeği alanı taşır
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };
const PROJ = [
  { id: 'p3', name: 'Test 3 shift', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [], src: null, inp: { crop: 'domates', area_da: 20, L: 200, W: 100, Q: 40, srcType: 'kuyu', depth: 30, region: 'akdeniz', hours: 20 } },
  { id: 'pb', name: 'Test 8 shift (parsel)', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [[37, 35], [37, 35.0075], [37.0021, 35.0078], [37.0027, 35.0012], [37.0012, 34.9994]], src: [36.9995, 34.9995], station: null, route: [], inp: { crop: 'domates', geom: 'parsel', Q: 120, srcType: 'kuyu', depth: 40, region: 'akdeniz', hours: 20 } },
  { id: 'p12', name: '12 alt ünite', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [], src: null, inp: { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, srcType: 'kuyu', depth: 40, region: 'akdeniz' } },
];

(async () => {
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const browser = await chromium.launch();
  for (const [ad, vp, ek] of [['320', { width: 320, height: 616 }, { isMobile: true, hasTouch: true }], ['390', { width: 390, height: 844 }, { isMobile: true, hasTouch: true }], ['1280', { width: 1280, height: 800 }, {}]]) {
    const ctx = await browser.newContext(Object.assign({ viewport: vp }, ek));
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const pg = await ctx.newPage(), errs = [], dlg = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { dlg.push(d.message()); d.accept(); });
    await pg.addInitScript(ps => { if (!sessionStorage.getItem('s')) { localStorage.setItem('irrismart.projects.v1', JSON.stringify(ps)); sessionStorage.setItem('s', '1'); } }, PROJ);
    await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(800);
    const P = id => pg.evaluate(id => JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(p => p.id === id), id);
    const tasarim = async id => JSON.stringify(await P(id));
    const tikla = s => pg.evaluate(s => document.querySelector(s).click(), s);
    const bosta = () => pg.waitForFunction(() => { const p = document.querySelector('#smPanel'); return p && p.getAttribute('aria-busy') !== 'true'; }, null, { timeout: 30000 }).then(() => pg.waitForTimeout(250));
    const ac = async id => { await pg.evaluate(() => document.querySelector('#btnBack').click()); await pg.waitForTimeout(300); await pg.evaluate(i => document.querySelector(`[data-open="${i}"]`).click(), id); await pg.waitForTimeout(300); await pg.evaluate(() => document.querySelector('nav.tabs [data-v=hidrolik]') ? document.querySelector('nav.tabs [data-v=hidrolik]').click() : null); await pg.waitForTimeout(900);
      if (!(await pg.isVisible('#bShiftYon'))) await pg.evaluate(() => window.IrriApp.show('hidrolik')); await pg.waitForTimeout(400); await tikla('#bShiftYon'); await pg.waitForSelector('#smPanel'); await bosta(); };
    const N = async () => +(await pg.textContent('#smNsN'));
    const genel = () => pg.$eval('#smUygunluk', e => e.dataset.genel);

    // ---------- M1 / M3 / M4: 6 alt üniteli proje (otomatik adaylar 3, 4, 6; kaynak alt sınırı 3) ----------
    await ac('p3'); const k0 = await tasarim('p3');
    check(await N() === 3 && !(await pg.$('#smManuelEtiket')), `${ad} M1 otomatik modda başlar (3)`);
    // M6 Küçük ekran: başlık, mod seçici, − / +, uygunluk başlığı kaydırmadan ekranda; dokunma hedefleri ≥ 32 px
    const kutu = sel => pg.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height, w: b.width }; }, sel);
    const ekranda = b => b && b.top >= 0 && b.left >= 0 && b.bottom <= vp.height && b.right <= vp.width;
    const kucukEkran = async asama => {
      for (const s2 of ['#smTitle', '#smMod [data-smmod=oto]', '#smMod [data-smmod=manuel]', '#smNsEksi', '#smNsArti', '#smUygunluk h3']) {
        const b = await kutu(s2);
        check(ekranda(b), `${ad} M6 ${asama}: ${s2} kaydırmadan ekranda (${b && Math.round(b.top)}–${b && Math.round(b.bottom)})`);
        if (/smMod|smNs/.test(s2)) check(b && b.h >= 32 && b.w >= 32, `${ad} M6 ${asama}: ${s2} dokunma hedefi ≥ 32 px (${b && Math.round(b.w)}×${b && Math.round(b.h)})`);
      }
    };
    await kucukEkran('otomatik');
    const mb = await kutu('#smMod [data-smmod=manuel]');
    if (ek.hasTouch) await pg.touchscreen.tap(mb.left + mb.w / 2, mb.top + mb.h / 2); else await pg.mouse.click(mb.left + mb.w / 2, mb.top + mb.h / 2);
    await bosta();
    check(await pg.isVisible('#smManuelEtiket'), `${ad} M1 "Manuel tasarım" etiketi (mod seçiciye ekran koordinatıyla dokunuldu)`);
    await kucukEkran('manuel');
    await tikla('#smNsEksi'); await bosta();
    check(await N() === 2, `${ad} M3 manuel − kaynak sınırının altına iner (2), sessizce 3'e dönmez (${await N()})`);
    check(await pg.isVisible('#smKaynakAlti') && await pg.isVisible('#smOtoDisi'), `${ad} M3 "kaynak debisi sınırının altında" ve "otomatik aralık dışı" etiketleri`);
    check(await genel() === 'uygun-degil', `${ad} M3 uygunluk "uygun değil" (${await genel()})`);
    check(/✗/.test(await pg.$$eval('[data-kaynak-oran]', a => a.map(x => x.textContent).join(' '))), `${ad} M3 shift kartında kaynak kapasitesi aşımı ✗`);
    check(!(await pg.isDisabled('#smUygula')), `${ad} M3 hesaplanabilir uygunsuz düzen kaydedilebilir (onayla)`);
    check(await pg.isVisible('#smAdaylar') && (await pg.$$('[data-smaday]')).length >= 1, `${ad} M4 başlangıç dağılımı adayları gösterilir`);
    check(/toplam tur süresi/.test(await pg.textContent('#smAdayOlcut')) && /tur/.test(await pg.textContent('#smAdaylar')), `${ad} M4 karşılaştırma ölçütleri (süre dahil) açıklanır`);
    check(!!(await pg.$('#smUygunDegil')), `${ad} M3 "uygun değil" uyarısı panelde`);
    check(await tasarim('p3') === k0, `${ad} önizleme kaydı değiştirmez`);
    dlg.length = 0; await tikla('#smUygula'); await pg.waitForTimeout(1200);
    const p1 = await P('p3');
    check(dlg.some(m => /Teknik uygunluk sonucu değişmez/.test(m)), `${ad} M3 uygunsuz düzen için onay soruldu`);
    check(p1.shiftEdit && new Set(p1.shiftEdit.assign).size === 2 && p1.shiftKullaniciKarari && p1.shiftKullaniciKarari.genel === 'uygun-degil', `${ad} M3 kayıt: 2 shift'lik gerçek atama + kullanıcı kararı (${JSON.stringify(p1.shiftKullaniciKarari)})`);
    // Rapor: uygunsuz bulgular hesap sonucundan gelir, kullanıcı kararı yalnız not olarak eklenir
    const rap = await pg.evaluate(p => { const r = window.IrriEngine.design(p.inp, null, { manual: p.shiftEdit }); const d = window.IrriReportData.build(p, r); return { uygunsuz: d.akil.findings.filter(f => f.seviye === 'uygunsuz').map(f => f.kod), not: d.akil.other.some(w => /bilerek kaydetti/.test(w)), sheet: JSON.stringify(d.akil.sheet).includes('bilerek kaydetti') }; }, p1);
    check(rap.uygunsuz.length >= 1 && rap.not && rap.sheet, `${ad} M3 raporda uygunsuz bulgu korunur ve kullanıcı kararı notu var (${JSON.stringify(rap)})`);
    await pg.evaluate(() => window.IrriApp.show('hidrolik')); await pg.waitForTimeout(600); await tikla('#bShiftYon'); await pg.waitForSelector('#smPanel'); await bosta();
    check(await N() === 2 && await genel() === 'uygun-degil' && await pg.isVisible('#smManuelEtiket'), `${ad} M3 yeniden açılışta manuel 2 shift ve uygunluk hâlâ "uygun değil" (kullanıcı kararı uygunluğu değiştirmez)`);
    await tikla('#smIptal'); await pg.waitForTimeout(300);
    // JSON yedeği alanı taşır
    const yedek = await pg.evaluate(() => JSON.stringify(window.IrriStore.backupPayload(JSON.parse(localStorage.getItem('irrismart.projects.v1')), {}, null)));
    check(JSON.parse(yedek).projects.find(p => p.id === 'p3').shiftKullaniciKarari && JSON.parse(yedek).projects.find(p => p.id === 'p3').shiftEdit, `${ad} M5 JSON yedeği kullanıcı kararını ve atamayı taşır`);
    // Geri Al
    await pg.evaluate(() => window.IrriApp.show('hidrolik')); await pg.waitForTimeout(600);
    if (await pg.$('#bShiftGeri')) { await tikla('#bShiftGeri'); await pg.waitForTimeout(1000); }
    const p2 = await P('p3'); check(!p2.shiftEdit && !p2.shiftKullaniciKarari, `${ad} M5 Geri Al atamayı ve kararı geri alır`);

    // ---------- M2: 12 alt ünite, manuel 5 shift (motorun kendi bölmesi 5 istendiğinde 6 veriyordu) ----------
    await ac('p12'); const k12 = await tasarim('p12'); const n0 = await N();
    await tikla('#smMod [data-smmod=manuel]'); await bosta();
    for (let g = 0; g < 10 && await N() > 5; g++) { await tikla('#smNsEksi'); await bosta(); }
    for (let g = 0; g < 10 && await N() < 5; g++) { await tikla('#smNsArti'); await bosta(); }
    check(await N() === 5 && !(await pg.$('#smIstenenHata')), `${ad} M2 manuel 5 shift tam 5 olarak hesaplanır (${await N()})`);
    check((await pg.$$('#smPanel .sm-shift')).length === 5, `${ad} M2 5 shift kartı`);
    // M7 Aday tutarlılığı: her aday için kart sayısı = istenen; kart debileri toplamı = toplam debi;
    // Uygula sonrası kayıtlı atama motorda panelde gösterilen debileri verir
    const kartlar = () => pg.$$eval('#smPanel .sm-shift', a => a.map(x => { const m = /Debi \(hesap\)\s*([\d.,]+)/.exec(x.textContent); return m ? +m[1].replace(/\./g, '').replace(',', '.') : NaN; }));
    const adaylar = await pg.$$('[data-smaday]');
    const toplamQ = await pg.evaluate(() => window.IrriEngine.design(JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(p => p.id === 'p12').inp).units.reduce((a, u) => a + u.Q, 0));
    let sonKart = [];
    for (let i = 0; i < adaylar.length; i++) {
      await tikla(`[data-smaday="${i}"]`); await bosta();
      const q = await kartlar(); sonKart = q; const top = q.reduce((a, x) => a + x, 0);
      check(await N() === 5 && q.length === 5 && Math.abs(top - toplamQ) < 0.06, `${ad} M7 aday ${i + 1}: 5 shift, kart debileri toplamı ${top.toFixed(2)} = ${toplamQ.toFixed(2)}`);
    }
    await tikla('#smUygula'); await pg.waitForTimeout(1200);
    const p12 = await P('p12');
    const motorQ = await pg.evaluate(p => window.IrriEngine.design(p.inp, null, { manual: p.shiftEdit }).sel.Qj.map(q => Math.round(q * 100) / 100), p12);
    check(p12.shiftEdit && new Set(p12.shiftEdit.assign).size === 5 && JSON.stringify(motorQ) === JSON.stringify(sonKart.map(q => Math.round(q * 100) / 100)), `${ad} M7 kayıtlı atama motorda panelde gösterilen debileri verir (${motorQ} / ${sonKart})`);
    await pg.evaluate(() => window.IrriApp.show('hidrolik')); await pg.waitForTimeout(600); if (await pg.$('#bShiftGeri')) { await tikla('#bShiftGeri'); await pg.waitForTimeout(1000); }
    check(!(await P('p12')).shiftEdit, `${ad} M7 Geri Al`);
    await ac('p12'); const k12b = await tasarim('p12'); await tikla('#smMod [data-smmod=manuel]'); await bosta();
    // M5 otomatik moda dönüş
    await tikla('#smMod [data-smmod=oto]'); await bosta();
    check(await N() === n0 && !(await pg.$('#smManuelEtiket')), `${ad} M5 otomatik moda dönüş (${await N()})`);
    await tikla('#smIptal'); await pg.waitForTimeout(400);
    check(await tasarim('p12') === k12b, `${ad} M5 İptal kaydı değiştirmez`); void k12;
    // Manuel − / + sınırları: 1'de − pasif ve neden yazılı
    await ac('p3'); await tikla('#smMod [data-smmod=manuel]'); await bosta();
    for (let g = 0; g < 6 && await N() > 1; g++) { await tikla('#smNsEksi'); await bosta(); }
    check(await N() === 1 && await pg.isDisabled('#smNsEksi') && /en az 1/.test(await pg.textContent('#smNsNeden')), `${ad} M1 manuel en az 1 shift; − pasif ve nedeni yazılı`);
    for (let g = 0; g < 8 && !(await pg.isDisabled('#smNsArti')); g++) { await tikla('#smNsArti'); await bosta(); }
    check(await N() === 6 && /alt ünite sayısı 6/.test(await pg.textContent('#smNsNeden')), `${ad} M1 manuel en çok alt ünite sayısı (6); + pasif ve nedeni yazılı`);
    await tikla('#smIptal'); await pg.waitForTimeout(300);
    // ---------- M8 Harita fırçası + manuel mod (parsel projesi) ----------
    if (ad !== '320') {
      await ac('pb'); const kpb = await tasarim('pb');
      await tikla('#smMod [data-smmod=manuel]'); await bosta();
      await tikla('#smPanel [data-hduz="0"]'); await pg.waitForTimeout(2000);
      check(await pg.evaluate(() => document.querySelector('#v-arazi').classList.contains('on')) && /taslak/.test(await pg.textContent('#mShiftBar')), `${ad} M8 manuel modda haritada taslak düzenleme açıldı`);
      const h = await pg.$eval('#map', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
      let B = JSON.parse(await pg.$eval('#map', e => e.dataset.birimler || '[]'));
      const sag = ad === '1280' ? await pg.$eval('#smPanel', e => e.getBoundingClientRect().left).catch(() => h.x + h.w) : h.x + h.w;
      const hedef = B.find(b => b.s !== 0 && b.x > 20 && b.y > 20 && h.x + b.x < sag - 20 && b.y < h.h - 20);
      check(!!hedef, `${ad} M8 ekranda başka shift'e ait alt ünite var`);
      if (hedef) {
        if (ek.hasTouch) await pg.touchscreen.tap(h.x + hedef.x, h.y + hedef.y); else await pg.mouse.click(h.x + hedef.x, h.y + hedef.y);
        await pg.waitForTimeout(2500);
        B = JSON.parse(await pg.$eval('#map', e => e.dataset.birimler || '[]'));
        check((B.find(b => b.k === hedef.k) || {}).s === 0, `${ad} M8 dokunulan alt ünite taslakta Shift 1'e taşındı`);
        check(await tasarim('pb') === kpb, `${ad} M8 harita düzenlemesi kaydı değiştirmez`);
        await tikla(ad === '1280' ? '#mPanel' : '#smChip'); await pg.waitForTimeout(800);
        check(await pg.isVisible('#smPanel') && await pg.$eval('#smMod [data-smmod=manuel]', e => e.classList.contains('on')) && !(await pg.$('#smIstenenHata')), `${ad} M8 panele dönüş: manuel mod; istenen sayı kilidi harita düzenlemesini engellemez`);
        const kq = await kartlar();
        check(kq.length === await N() && kq.every(Number.isFinite), `${ad} M8 harita sonrası shift kartları hesaplandı (${kq.length} shift)`);
        await tikla('#smUygula'); await pg.waitForTimeout(1500);
        const pu = await P('pb'); check(pu.shiftEdit && pu.shiftEdit.assign[hedef.k] === 0, `${ad} M8 Uygula harita atamasını kaydeder`);
        await pg.evaluate(() => window.IrriApp.show('hidrolik')); await pg.waitForTimeout(600); if (await pg.$('#bShiftGeri')) { await tikla('#bShiftGeri'); await pg.waitForTimeout(1000); }
        check(!(await P('pb')).shiftEdit, `${ad} M8 Geri Al`);
      }
    }
    check(!errs.length, `${ad} sayfa hatası: ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`Manuel Shift modu: ${passes} denetim geçti, ${fails} başarısız`);
  process.exit(fails ? 1 : 0);
})();

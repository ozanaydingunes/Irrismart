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
  { id: 'p12', name: '12 alt ünite', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [], src: null, inp: { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, srcType: 'kuyu', depth: 40, region: 'akdeniz' } },
];

(async () => {
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const browser = await chromium.launch();
  for (const [ad, vp, ek] of [['390', { width: 390, height: 844 }, { isMobile: true, hasTouch: true }], ['1280', { width: 1280, height: 800 }, {}]]) {
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
    await tikla('#smMod [data-smmod=manuel]'); await bosta();
    check(await pg.isVisible('#smManuelEtiket'), `${ad} M1 "Manuel tasarım" etiketi`);
    await tikla('#smNsEksi'); await bosta();
    check(await N() === 2, `${ad} M3 manuel − kaynak sınırının altına iner (2), sessizce 3'e dönmez (${await N()})`);
    check(await pg.isVisible('#smKaynakAlti') && await pg.isVisible('#smOtoDisi'), `${ad} M3 "kaynak debisi sınırının altında" ve "otomatik aralık dışı" etiketleri`);
    check(await genel() === 'uygun-degil', `${ad} M3 uygunluk "uygun değil" (${await genel()})`);
    check(/✗/.test(await pg.$$eval('[data-kaynak-oran]', a => a.map(x => x.textContent).join(' '))), `${ad} M3 shift kartında kaynak kapasitesi aşımı ✗`);
    check(!(await pg.isDisabled('#smUygula')), `${ad} M3 hesaplanabilir uygunsuz düzen kaydedilebilir (onayla)`);
    check(await pg.isVisible('#smAdaylar') && (await pg.$$('[data-smaday]')).length >= 1, `${ad} M4 başlangıç dağılımı adayları gösterilir`);
    check(await tasarim('p3') === k0, `${ad} önizleme kaydı değiştirmez`);
    dlg.length = 0; await tikla('#smUygula'); await pg.waitForTimeout(1200);
    const p1 = await P('p3');
    check(dlg.some(m => /Teknik uygunluk sonucu değişmez/.test(m)), `${ad} M3 uygunsuz düzen için onay soruldu`);
    check(p1.shiftEdit && new Set(p1.shiftEdit.assign).size === 2 && p1.shiftKullaniciKarari && p1.shiftKullaniciKarari.genel === 'uygun-degil', `${ad} M3 kayıt: 2 shift'lik gerçek atama + kullanıcı kararı (${JSON.stringify(p1.shiftKullaniciKarari)})`);
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
    const adaylar = await pg.$$('[data-smaday]');
    if (adaylar.length > 1) { await tikla('[data-smaday="1"]'); await bosta(); check(await N() === 5, `${ad} M4 ikinci aday da 5 shift`); }
    // M5 otomatik moda dönüş
    await tikla('#smMod [data-smmod=oto]'); await bosta();
    check(await N() === n0 && !(await pg.$('#smManuelEtiket')), `${ad} M5 otomatik moda dönüş (${await N()})`);
    await tikla('#smIptal'); await pg.waitForTimeout(400);
    check(await tasarim('p12') === k12, `${ad} M5 İptal kaydı değiştirmez`);
    // Manuel − / + sınırları: 1'de − pasif ve neden yazılı
    await ac('p3'); await tikla('#smMod [data-smmod=manuel]'); await bosta();
    for (let g = 0; g < 6 && await N() > 1; g++) { await tikla('#smNsEksi'); await bosta(); }
    check(await N() === 1 && await pg.isDisabled('#smNsEksi') && /en az 1/.test(await pg.textContent('#smNsNeden')), `${ad} M1 manuel en az 1 shift; − pasif ve nedeni yazılı`);
    for (let g = 0; g < 8 && !(await pg.isDisabled('#smNsArti')); g++) { await tikla('#smNsArti'); await bosta(); }
    check(await N() === 6 && /alt ünite sayısı 6/.test(await pg.textContent('#smNsNeden')), `${ad} M1 manuel en çok alt ünite sayısı (6); + pasif ve nedeni yazılı`);
    await tikla('#smIptal'); await pg.waitForTimeout(300);
    check(!errs.length, `${ad} sayfa hatası: ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`Manuel Shift modu: ${passes} denetim geçti, ${fails} başarısız`);
  process.exit(fails ? 1 : 0);
})();

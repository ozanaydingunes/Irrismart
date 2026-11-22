#!/usr/bin/env node
// Teknik ürün veritabanı ekranı — telefon (390 px, 320 px) ve masaüstü (1280 px) aynı kod:
// ürün ekle/düzenle/sil, teknik değer + sayfa, sayfasız değer reddi, kullanıcı incelemesi, ayrı mühendislik doğrulaması,
// arama/filtre, bilgi yedeğinde ürünler (PDF yok), geri yüklemede ürünlerin dönmesi.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };
const pdf = Buffer.from('%PDF-1.4\n% IrriGrow urun ekrani testi\n%%EOF\n');

(async () => {
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const browser = await chromium.launch();
  for (const [ad, vp, ek] of [['390', { width: 390, height: 844 }, { isMobile: true, hasTouch: true }], ['320', { width: 320, height: 616 }, { isMobile: true, hasTouch: true }], ['1280', { width: 1280, height: 800 }, {}]]) {
    const ctx = await browser.newContext(Object.assign({ viewport: vp, acceptDownloads: true }, ek));
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
    await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(700);
    const tikla = s => pg.evaluate(s => document.querySelector(s).click(), s);
    const toast = () => pg.evaluate(() => (document.querySelector('#toast') || {}).textContent || '');
    const V = () => pg.evaluate(() => window.IrriKatalogDepo.urunListele());
    const tasma = () => pg.evaluate(() => [...document.querySelectorAll('#v-katalog *')].filter(e => { if (e.closest('.kat-cipler,.scroll')) return false; const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1); }).slice(0, 3).map(e => (e.id || e.tagName) + '.' + String(e.className).slice(0, 20)));
    // Katalog
    await tikla('#btnKatalog'); await pg.waitForTimeout(400);
    await pg.setInputFiles('#katDosya', { name: 'boru-katalogu.pdf', mimeType: 'application/pdf', buffer: pdf }); await pg.waitForSelector('#kfAd');
    await pg.fill('#kfFirma', 'Test Boru A.Ş.'); await pg.check('[data-kfgrup=boru]'); await tikla('#katKaydet'); await pg.waitForSelector('.kat-doc', { timeout: 20000 });
    await tikla('#btnKatalog'); await pg.waitForTimeout(300);
    await tikla('#katSekme [data-ksekme=urun]'); await pg.waitForSelector('#urYeni');
    check(/yalnız mühendislik doğrulaması geçmiş/.test(await pg.textContent('#katUrun')), `${ad} öneri kuralı ekranda açıklanır`);
    // Ürün ekle
    await tikla('#urYeni'); await pg.waitForSelector('#ufUretici');
    await tikla('#urKaydet'); await pg.waitForTimeout(300);
    check(/üretici gerekli/.test(await toast()), `${ad} zorunlu alan denetimi`);
    await pg.fill('#ufUretici', 'Test Boru A.Ş.'); await pg.fill('#ufModel', 'PE100 63 PN10'); await pg.fill('#ufKod', 'TB-63-10'); await pg.selectOption('#ufKategori', 'boru');
    check(!(await tasma()).length, `${ad} ürün formunda yatay taşma yok ${await tasma()}`);
    await tikla('#urKaydet'); await pg.waitForSelector('#urDogrulama');
    let v = await V(); check(v.urunler.length === 1 && v.urunler[0].muhendislik === 'dogrulanmadi', `${ad} ürün kaydedildi, doğrulanmamış`);
    // Teknik değerler
    const deger = async (adx, d, birim, sayfa) => { await pg.evaluate(() => { const e = document.querySelector('.kat-ekle'); if (e) e.open = true; }); await pg.selectOption('#dvAd', adx); if (birim != null) await pg.selectOption('#dvBirim', birim); await pg.fill('#dvDeger', String(d)); await pg.fill('#dvSayfa', String(sayfa)); await tikla('#dvKaydet'); await pg.waitForTimeout(500); };
    await deger('dis_cap', 63, 'mm', '');
    check(/sayfa numarası yok/.test(await toast()) && (await V()).degerler.length === 0, `${ad} sayfası olmayan değer kaydedilmez`);
    await deger('dis_cap', 63, 'mm', 12); await deger('et_kalinligi', '3,8', 'mm', 12); await deger('pn', 10, 'bar', 12); await deger('malzeme', 'PE100', null, 12);
    v = await V(); check(v.degerler.length === 4 && v.degerler.every(d => d.kaynak.sayfa === 12 && d.kaynak.katalogId === v.urunler[0].katalogId), `${ad} 4 değer, kaynak katalog ve sayfa 12`);
    check(v.degerler.find(d => d.ad === 'et_kalinligi').siDeger === 3.8, `${ad} virgüllü değer doğru okunur`);
    check(/s\. 12/.test(await pg.textContent('#urDogrulama').catch(() => '')) || /s\. 12/.test(await pg.textContent('#katUrun')), `${ad} sayfa referansı görünür`);
    // Denetim: değerler incelenmeden geçmez
    await tikla('#urDenetle'); await pg.waitForTimeout(300);
    check(/kullanıcı incelemesinden/.test(await pg.textContent('#urKurallar')) && !(await pg.$('#urDogrula')), `${ad} incelenmemiş değerle doğrulama yapılamaz`);
    for (let i = 0; i < 4; i++) { await tikla('[data-dinc]'); await pg.waitForTimeout(300); }
    await tikla('#urIncele'); await pg.waitForTimeout(400);
    v = await V(); check(v.urunler[0].inceleme === 'kullanici-onayladi' && v.urunler[0].muhendislik === 'dogrulanmadi', `${ad} kullanıcı incelemesi mühendislik doğrulaması değildir`);
    await tikla('#urDenetle'); await pg.waitForTimeout(300);
    check(/Bütün kurallar geçti/.test(await pg.textContent('#urKurallar')), `${ad} EN 12201 PE100 63 × 3,8 PN10 denetimi geçer`);
    await tikla('#urDogrula'); await pg.waitForTimeout(300);
    check(/doğrulayan/.test(await toast()) && (await V()).urunler[0].muhendislik === 'dogrulanmadi', `${ad} doğrulayan adı olmadan kaydedilmez`);
    await pg.fill('#urDogrulayan', 'Test Mühendisi'); await tikla('#urDogrula'); await pg.waitForTimeout(500);
    v = await V(); check(v.urunler[0].muhendislik === 'dogrulandi' && v.urunler[0].dogrulama.dogrulayan === 'Test Mühendisi' && window_ok(), `${ad} mühendislik doğrulaması kaydedildi`);
    // Değer değişince doğrulama düşer
    await deger('ic_cap', 55.4, 'mm', 12);
    v = await V(); check(v.urunler[0].muhendislik === 'dogrulanmadi', `${ad} değer eklenince ürün yeniden doğrulanmalı`);
    // Arama ve filtre
    await tikla('#urGeri'); await pg.waitForTimeout(300);
    await pg.fill('#urAra', 'TB-63'); await pg.waitForTimeout(300); check((await pg.$$('[data-urun]')).length === 1, `${ad} ürün kodu araması`);
    await pg.fill('#urAra', 'yok-böyle'); await pg.waitForTimeout(300); check((await pg.$$('[data-urun]')).length === 0, `${ad} eşleşmeyen arama`);
    await pg.fill('#urAra', ''); await pg.selectOption('#urKat', 'pompa'); await pg.waitForTimeout(300); check((await pg.$$('[data-urun]')).length === 0, `${ad} kategori filtresi`);
    await pg.selectOption('#urKat', ''); await pg.selectOption('#urDurum', 'dogrulanmadi'); await pg.waitForTimeout(300); check((await pg.$$('[data-urun]')).length === 1, `${ad} durum filtresi`);
    // Bilgi yedeği: ürünler var, PDF yok; silme → geri yükleme → ürün döner
    await tikla('#katSekme [data-ksekme=katalog]'); await pg.waitForTimeout(300);
    const [ind] = await Promise.all([pg.waitForEvent('download', { timeout: 5000 }), tikla('#katYedek')]);
    const y = JSON.parse(fs.readFileSync(await ind.path(), 'utf8'));
    check(y.surum === 2 && y.pdfIcerir === false && y.urunler.length === 1 && y.degerler.length === 5 && !JSON.stringify(y).includes('%PDF'), `${ad} bilgi yedeği ürünleri içerir, PDF içermez`);
    await pg.evaluate(async () => { const D = window.IrriKatalogDepo; const { urunler } = await D.urunListele(); for (const u of urunler) await D.urunSil(u.id); });
    await pg.setInputFiles('#katGeri', { name: 'y.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(y)) }); await pg.waitForTimeout(800);
    v = await V(); check(v.urunler.length === 1 && v.degerler.length === 5, `${ad} geri yüklemede ürün ve değerler döner`);
    // Silme
    await tikla('#katSekme [data-ksekme=urun]'); await pg.waitForSelector('[data-urun]'); await tikla('[data-urun]'); await pg.waitForSelector('#urSil'); await tikla('#urSil'); await pg.waitForTimeout(500);
    v = await V(); check(!v.urunler.length && !v.degerler.length && (await pg.evaluate(() => window.IrriKatalogDepo.listele())).kataloglar.length === 1, `${ad} ürün silinir, katalog kalır`);
    check(!errs.length, `${ad} sayfa hatası: ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`Ürün veritabanı ekranı: ${passes} denetim geçti, ${fails} başarısız`);
  process.exit(fails ? 1 : 0);
})();
function window_ok() { return true; }

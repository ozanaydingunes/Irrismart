#!/usr/bin/env node
// Firma Malzeme Katalogları — aşama 1 arayüz testi (Chromium; Android telefon 390 px ve 320 px, tablet 820 px, masaüstü 1280 px).
// Gerçek Android WebView'daki dosya depolaması (Capacitor Filesystem) bu testte YOKTUR; o yol emülatör iş akışında denenir.
// Test PDF'leri test içinde üretilir; gerçek firma katalogları kullanılmaz.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..', 'www');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
// Geçerli imzalı küçük PDF (+ isteğe bağlı dolgu ile büyük dosya)
const pdf = (etiket, ek = 0) => Buffer.concat([Buffer.from(`%PDF-1.4\n% IrriGrow test ${etiket}\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n`), crypto.randomBytes(ek), Buffer.from('\n%%EOF\n')]);
const lat = 37.0, lng = 35.0;
const PROJ = [{ id: 'pb', name: 'Test 8 shift', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [[lat, lng], [lat, lng + 0.0075], [lat + 0.0021, lng + 0.0078], [lat + 0.0027, lng + 0.0012], [lat + 0.0012, lng - 0.0006]], src: [lat - 0.0005, lng - 0.0005], station: null, route: [], inp: { crop: 'domates', geom: 'parsel', Q: 120, srcType: 'kuyu', depth: 40, region: 'akdeniz', hours: 20 } }];

(async () => {
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const URL0 = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const P1 = pdf('fiyat'), P2 = pdf('fiyat-v2'), P3 = pdf('buyuk', 6 * 1024 * 1024 + 123);
  for (const [ad, vp, ek] of [['390', { width: 390, height: 844 }, { isMobile: true, hasTouch: true }], ['320', { width: 320, height: 616 }, { isMobile: true, hasTouch: true }], ['tablet', { width: 820, height: 1180 }, { hasTouch: true }], ['masaüstü', { width: 1280, height: 800 }, {}]]) {
    const ctx = await browser.newContext(Object.assign({ viewport: vp, acceptDownloads: true }, ek));
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const pg = await ctx.newPage(), errs = [], dlg = [];
    let dlgCevap = true;
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { dlg.push(d.message()); dlgCevap ? d.accept() : d.dismiss(); });
    await pg.addInitScript(ps => { if (!sessionStorage.getItem('s')) { localStorage.setItem('irrismart.projects.v1', JSON.stringify(ps)); sessionStorage.setItem('s', '1'); } }, PROJ);
    await pg.goto(URL0); await pg.waitForTimeout(800);
    const D = () => pg.evaluate(() => window.IrriKatalogDepo.listele());
    const toast = () => pg.evaluate(() => (document.querySelector('#toast') || {}).textContent || '');
    const tasma = () => pg.evaluate(() => [...document.querySelectorAll('#v-katalog *')].filter(e => { if (e.closest('.kat-cipler')) return false; const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1); }).slice(0, 4).map(e => (e.id || e.tagName) + '.' + String(e.className).slice(0, 20)));
    const ekranda = async s => pg.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight; }, s);

    // 1) Proje açmadan üst çubuktan kataloglar
    check(await ekranda('#btnKatalog'), `${ad} üst çubukta katalog düğmesi ekranda`);
    await pg.click('#btnKatalog'); await pg.waitForTimeout(500);
    check(await pg.isVisible('#v-katalog') && !(await pg.isVisible('#v-projeler')), `${ad} proje açmadan katalog ekranı açılır`);
    check(/Henüz katalog yüklenmedi/.test(await pg.textContent('#katalog')), `${ad} boş durum metni`);
    check(!(await tasma()).length, `${ad} boş ekranda yatay taşma yok: ${await tasma()}`);

    // 2) PDF olmayan dosya reddedilir
    await pg.setInputFiles('#katDosya', { name: 'not.pdf', mimeType: 'application/pdf', buffer: Buffer.from('PK\x03\x04 zip değil') });
    await pg.waitForSelector('#kfAd'); await pg.fill('#kfFirma', 'Fırat'); await pg.click('#katKaydet'); await pg.waitForTimeout(800);
    check(/PDF değil/.test(await toast()) && (await D()).kataloglar.length === 0 && (await D()).firmalar.length === 0, `${ad} PDF imzası olmayan dosya kaydedilmez (${await toast()})`);
    await pg.click('#katIptal'); await pg.waitForTimeout(200);

    // 3) Yükleme + bilgiler
    await pg.setInputFiles('#katDosya', { name: 'tarimsal-sulama-fiyat-listesi.pdf', mimeType: 'application/pdf', buffer: P1 });
    await pg.waitForSelector('#kfAd');
    check(await pg.inputValue('#kfAd') === 'tarimsal sulama fiyat listesi', `${ad} katalog adı dosya adından önerilir`);
    await pg.fill('#kfAd', 'Tarımsal Sulama Fiyat Listesi'); await pg.fill('#kfFirma', 'Fırat'); await pg.selectOption('#kfTur', 'fiyat');
    check(await pg.isVisible('#kfKdv'), `${ad} fiyat listesinde KDV / para birimi alanları`);
    await pg.selectOption('#kfKdv', 'haric'); await pg.selectOption('#kfPara', 'TRY');
    await pg.fill('#kfTarih', '32.10.2026'); await pg.click('#katKaydet'); await pg.waitForTimeout(400);
    check(/geçersiz/.test(await toast()) && (await D()).kataloglar.length === 0, `${ad} geçersiz tarih kaydedilmez`);
    await pg.fill('#kfTarih', '20.10.2026'); await pg.check('[data-kfgrup=boru]'); await pg.check('[data-kfgrup=damla]');
    await pg.selectOption('#kfKaynak', 'resmi-site'); await pg.fill('#kfKaynakAc', 'firat.com');
    check(!(await tasma()).length, `${ad} formda yatay taşma yok: ${await tasma()}`);
    await pg.click('#katKaydet'); await pg.waitForSelector('.kat-doc', { timeout: 20000 });
    let v = await D(); const k1 = v.kataloglar[0];
    check(v.kataloglar.length === 1 && v.firmalar.length === 1 && v.firmalar[0].ad === 'Fırat', `${ad} kayıt oluştu`);
    check(k1 && k1.dosya.sha256 === sha(P1) && k1.dosya.boyut === P1.length && k1.belgeTarihi === '2026-10-20' && k1.belgeTuru === 'fiyat' && k1.fiyatListesi.kdvDahil === false && k1.fiyatListesi.paraBirimi === 'TRY' && k1.urunGruplari.join() === 'boru,damla' && k1.kaynak.tur === 'resmi-site', `${ad} bilgiler ve SHA-256 doğru`);
    check(/Fiyat listesi · 20\.10\.2026 · \d+ gün önce · KDV hariç · TRY/.test(await pg.textContent('.kat-doc')), `${ad} fiyat listesi tarihi ve KDV etiketi`);
    check(!JSON.stringify(await pg.evaluate(() => localStorage.getItem('irrismart.projects.v1'))).includes('Fırat'), `${ad} katalog proje verisine yazılmaz`);

    // 4) Yeniden açma: sayfa yenilenince kayıt ve dosya duruyor; dosya doğrulanır
    await pg.reload(); await pg.waitForTimeout(800); await pg.click('#btnKatalog'); await pg.waitForTimeout(500);
    check((await pg.$$('.kat-firma')).length === 1 && /Fırat/.test(await pg.textContent('.kat-firma')), `${ad} yeniden açılışta firma listesi`);
    check((await pg.evaluate(k => window.IrriKatalogDepo.dosyaDogrula(k.dosya), k1)).ok, `${ad} yeniden açılışta PDF SHA-256 doğrulanır`);
    await pg.click('.kat-firma'); await pg.waitForSelector('.kat-doc');
    // window.open adresini yakala (başsız Chromium'un PDF görüntüleyicisine bağlı kalmadan); adresin gösterdiği içerik PDF olmalı
    await pg.evaluate(() => { window.__acilan = null; window.__eskiOpen = window.open; window.open = u => { window.__acilan = u; return {}; }; });
    await pg.click('[data-ac]'); await pg.waitForTimeout(800);
    const acilan = await pg.evaluate(async () => { const u = window.__acilan; window.open = window.__eskiOpen; if (!u) return null; const r = await fetch(u); const b = new Uint8Array(await r.arrayBuffer()); return { u: u.slice(0, 5), imza: String.fromCharCode(...b.slice(0, 5)), n: b.length }; });
    check(acilan && acilan.u === 'blob:' && acilan.imza === '%PDF-' && acilan.n === P1.length, `${ad} “Aç” kayıtlı PDF'i açar (${JSON.stringify(acilan)})`);
    // 5) Aynı dosya yeniden yüklenince uyarı; vazgeçilirse kayıt eklenmez
    dlgCevap = false; dlg.length = 0;
    await pg.setInputFiles('#katDosya', { name: 'kopya.pdf', mimeType: 'application/pdf', buffer: P1 }); await pg.waitForSelector('#kfAd'); await pg.click('#katKaydet'); await pg.waitForTimeout(1200);
    dlgCevap = true;
    check(dlg.some(m => /zaten kayıtlı/.test(m)) && (await D()).kataloglar.length === 1, `${ad} aynı PDF uyarısı; vazgeçince eklenmez`);
    check((await pg.evaluate(() => window.IrriKatalogDepo.sahipsizTemizle())) === 0, `${ad} vazgeçilen dosya depoda kalmadı`);

    // 6) Düzenleme
    await pg.click('[data-duzenle]'); await pg.waitForSelector('#kfAd'); check(await pg.inputValue('#kfTarih') === '20.10.2026', `${ad} düzenlemede tarih gösterimi`);
    await pg.fill('#kfNot', 'Bayi indirimi hariç'); await pg.click('#katKaydet'); await pg.waitForSelector('.kat-doc');
    check((await D()).kataloglar[0].not === 'Bayi indirimi hariç' && (await D()).kataloglar[0].dosya.sha256 === sha(P1), `${ad} düzenleme yalnız bilgiyi değiştirir`);

    // 7) Güncelleme: eski sürüm saklanır; sürüm geçmişi; eski sürüm silinebilir
    await pg.setInputFiles('[data-guncelle]', { name: 'v2.pdf', mimeType: 'application/pdf', buffer: P2 }); await pg.waitForTimeout(1500);
    v = await D(); check(v.kataloglar[0].dosya.sha256 === sha(P2) && v.kataloglar[0].oncekiSurumler.length === 1 && v.kataloglar[0].oncekiSurumler[0].dosya.sha256 === sha(P1), `${ad} güncelleme: eski sürüm saklandı`);
    check(/Sürüm geçmişi \(1\)/.test(await pg.textContent('.kat-doc')), `${ad} sürüm geçmişi görünür`);
    await pg.click('.kat-surum summary'); await pg.click('[data-surumsil]'); await pg.waitForTimeout(800);
    v = await D(); check(!v.kataloglar[0].oncekiSurumler.length && (await pg.evaluate(() => window.IrriKatalogDepo.sahipsizTemizle())) === 0, `${ad} eski sürüm ve dosyası silindi`);

    // 8) Büyük dosya (6 MB, 1 MB'lık parçalarla özet)
    if (ad === '390') {
      await pg.click('#katGeri0'); await pg.setInputFiles('#katDosya', { name: 'buyuk.pdf', mimeType: 'application/pdf', buffer: P3 }); await pg.waitForSelector('#kfAd');
      await pg.fill('#kfFirma', 'Pimtaş'); await pg.click('#katKaydet'); await pg.waitForSelector('.kat-doc', { timeout: 60000 });
      const kb = (await D()).kataloglar.find(x => x.dosya.boyut === P3.length);
      check(kb && kb.dosya.sha256 === sha(P3), `${ad} 6 MB PDF parça parça özetlendi ve doğrulandı`);
      await pg.click('[data-sil]'); await pg.waitForTimeout(800); check(!(await D()).firmalar.some(f => f.ad === 'Pimtaş'), `${ad} son kataloğu silinen firma kaldırılır`);
      await pg.click('#btnKatalog'); await pg.waitForTimeout(300);
    }

    // 9) Bilgi yedeği: PDF içermez; silme → geri yükleme → PDF bekleniyor → yanlış/ doğru PDF eşleştirme
    await pg.click('#btnKatalog'); await pg.waitForTimeout(300);
    const [indir] = await Promise.all([pg.waitForEvent('download', { timeout: 5000 }), pg.click('#katYedek')]);
    const yedek = JSON.parse(fs.readFileSync(await indir.path(), 'utf8'));
    check(yedek.pdfIcerir === false && yedek.kataloglar.length === 1 && !JSON.stringify(yedek).includes('%PDF') && yedek.kataloglar[0].dosya.sha256 === sha(P2) && !yedek.kataloglar[0].dosya.anahtar, `${ad} yedek yalnız bilgi içerir`);
    await pg.click('.kat-firma'); await pg.click('[data-sil]'); await pg.waitForTimeout(800);
    check((await D()).kataloglar.length === 0 && (await D()).firmalar.length === 0, `${ad} silme kaydı ve firmayı kaldırır`);
    await pg.setInputFiles('#katGeri', { name: 'yedek.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(yedek)) }); await pg.waitForTimeout(800);
    check(/PDF bekleniyor/.test(await pg.textContent('#katalog')), `${ad} geri yüklenen kayıt PDF bekliyor`);
    await pg.click('.kat-firma'); await pg.setInputFiles('[data-bagla]', { name: 'yanlis.pdf', mimeType: 'application/pdf', buffer: P1 }); await pg.waitForTimeout(1000);
    check(/eşleşmiyor/.test(await toast()) && (await D()).kataloglar[0].dosya.bekliyor, `${ad} yanlış PDF eşleşmez`);
    await pg.setInputFiles('[data-bagla]', { name: 'dogru.pdf', mimeType: 'application/pdf', buffer: P2 }); await pg.waitForTimeout(1000);
    v = await D(); check(!v.kataloglar[0].dosya.bekliyor && v.kataloglar[0].dosya.sha256 === sha(P2) && (await pg.evaluate(k => window.IrriKatalogDepo.dosyaDogrula(k.dosya), v.kataloglar[0])).ok, `${ad} doğru PDF eşleşir ve doğrulanır`);

    // 10) Örnek veriler gerçek kataloglardan ayrı
    await pg.evaluate(async () => { const M = window.IrriKatalogModel, D = window.IrriKatalogDepo; const f = M.yeniFirma('Örnek Firma', true); await D.firmaKaydet(f); await D.katalogKaydet(Object.assign(M.yeniKatalog({ ad: 'Örnek katalog', firmaId: f.id, dosya: { ad: 'o.pdf', boyut: 1, sha256: 'b'.repeat(64), anahtar: 'yok' }, ornek: true }))); });
    await pg.click('#btnKatalog'); await pg.waitForTimeout(400);
    if (!(await pg.$('.kat-firmalar'))) console.log('HATA AYIKLAMA', (await pg.textContent('#katalog')).slice(0, 300), JSON.stringify(await D()).slice(0, 600));
    check(!/Örnek Firma/.test(await pg.textContent('.kat-firmalar')) && /Örnek katalog/.test(await pg.textContent('.kat-ornek')), `${ad} örnek veri ayrı bölümde`);

    // 11) Malzeme ekranı: proje malzeme listesi değişmeden; sekmeler
    await pg.evaluate(() => document.querySelector('#btnBack').click()); await pg.waitForTimeout(300); await pg.evaluate(() => document.querySelector('[data-open="pb"]').click()); await pg.waitForTimeout(300);
    await pg.evaluate(() => document.querySelector('nav.tabs [data-v=malzeme]').click()); await pg.waitForTimeout(900);
    check(await pg.isVisible('#malzSeg') && /Maliyet/.test(await pg.textContent('#bom')) && (await pg.$$('#bom table')).length >= 1, `${ad} proje malzeme listesi görünür`);
    await pg.click('#malzSeg [data-malz=katalog]'); await pg.waitForTimeout(400);
    check(await pg.isVisible('#v-katalog') && await pg.$eval('nav.tabs [data-v=malzeme]', e => e.classList.contains('on')), `${ad} “Firma katalogları” sekmesi; Malzeme sekmesi seçili kalır`);
    await pg.click('#katSeg [data-malz=proje]'); await pg.waitForTimeout(500);
    check(await pg.isVisible('#v-malzeme'), `${ad} “Proje malzeme listesi”ne dönüş`);
    check(!errs.length, `${ad} sayfa hatası: ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`Firma katalogları: ${passes} denetim geçti, ${fails} başarısız`);
  process.exit(fails ? 1 : 0);
})();

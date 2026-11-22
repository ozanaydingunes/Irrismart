#!/usr/bin/env node
// Ekipman önerileri (Malzeme ekranı) — telefon 390 px ve masaüstü 1280 px aynı kod:
// uygun / verisi eksik / uygun değil listeleri; malzeme listesine ekleme (rapor satırında görünür); pompa "Hesaba uygula" →
// taslak önce/sonra → Uygula (motor seçilen ürünü kullanır) → Geri Al; doğrulanmamış ürün uygun listesine girmez.
// Ürünler test içinde üretilen sentetik verilerdir (gerçek katalog değildir).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };
const PROJ = [{ id: 'pk', name: 'Ekipman testi', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [], src: null, inp: { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, srcType: 'kuyu', depth: 40, region: 'akdeniz' } }];

(async () => {
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const browser = await chromium.launch();
  for (const [ad, vp, ek] of [['390', { width: 390, height: 844 }, { isMobile: true, hasTouch: true }], ['1280', { width: 1280, height: 800 }, {}]]) {
    const ctx = await browser.newContext(Object.assign({ viewport: vp }, ek));
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
    await pg.addInitScript(ps => { if (!sessionStorage.getItem('s')) { localStorage.setItem('irrismart.projects.v1', JSON.stringify(ps)); sessionStorage.setItem('s', '1'); } }, PROJ);
    await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(700);
    const tikla = s => pg.evaluate(s => document.querySelector(s).click(), s);
    const P = () => pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0]);
    await pg.evaluate(() => document.querySelector('[data-open="pk"]').click()); await pg.waitForTimeout(300);
    // Katalog + sentetik doğrulanmış ürünler (gereksinime göre ölçekli pompa eğrisi)
    const hazir = await pg.evaluate(async () => {
      const D = window.IrriKatalogDepo, M = window.IrriKatalogModel, U = window.IrriKatalogUrun, A = window.IrriApp.ekipmanBaglam(), req = window.IrriEsles.gereksinim(A.r, A.cur.inp);
      const dosya = await D.dosyaYaz(new File([new Blob([new TextEncoder().encode('%PDF-1.4\n% ekipman testi\n%%EOF\n')])], 'k.pdf'));
      const f = M.yeniFirma('Test Üretici'); await D.firmaKaydet(f); const k = M.yeniKatalog({ ad: 'Test kataloğu', firmaId: f.id, dosya }); await D.katalogKaydet(k);
      const K = s => ({ katalogId: k.id, sayfa: s, hamMetin: 'test', yontem: 'elle' });
      async function urun(kategori, uretici, model, degerler, egriler, dogrula = true) {
        let u = U.yeniUrun({ uretici, model, urunKodu: model, katalogId: k.id, kategori });
        const ds = degerler.map(([adx, deger, birim], i) => Object.assign(U.yeniDeger({ urunId: u.id, ad: adx, deger, birim, kaynak: K(10 + i) }).deger, { inceleme: 'kullanici-onayladi' }));
        const es = (egriler || []).map(o => Object.assign(U.yeniEgri(Object.assign({ urunId: u.id, kaynak: K(30) }, o)).egri, { inceleme: 'kullanici-onayladi' }));
        u = U.incele(u, 'kullanici-onayladi');
        if (dogrula) { const den = U.muhendislikDenetle(u, ds, es); if (!den.gecti) return 'denetim: ' + JSON.stringify(den.kurallar); u = U.muhendislikOnayla(u, den, 'Test mühendisi'); }
        await D.urunKaydet(u); for (const d of ds) await D.degerKaydet(d); for (const e of es) await D.egriKaydet(e); return u.id;
      }
      const F = [0, 0.4, 0.8, 1.2, 1.6];
      const qh = kx => ({ tur: 'QH', birimX: 'm³/h', birimY: 'm', noktalar: F.map(x => [+(req.Qd * x).toFixed(2), +(req.Hd * kx * (1.3 - 0.3 * x * x)).toFixed(2)]), kosul: { devir: 2900 } });
      const ver = { tur: 'verim', birimX: 'm³/h', birimY: '%', noktalar: F.map((x, i) => [+(req.Qd * x).toFixed(2), [30, 55, 68, 66, 55][i]]) };
      const p1 = await urun('pompa', 'Test Üretici', 'Pompa-A', [['pompa_tipi', 'dalgic', ''], ['guc_motor', 45, 'kW']], [qh(1.1), ver]);
      const p2 = await urun('pompa', 'Doğrulanmamış Üretici', 'Pompa-B', [['pompa_tipi', 'dalgic', ''], ['guc_motor', 45, 'kW']], [qh(1.1), ver], false);
      const v1 = await urun('vana', 'Test Üretici', 'Vana-A', [['dn', 63, 'mm'], ['pn', 16, 'bar'], ['kv', 60, 'Kv']]);
      return { req, p1, p2, v1, pumpOnce: A.r.pump && A.r.pump.ad };
    });
    check(typeof hazir.p1 === 'string' && !/denetim/.test(hazir.p1), `${ad} test ürünleri hazır (${JSON.stringify(hazir).slice(0, 120)})`);
    await pg.evaluate(() => document.querySelector('nav.tabs [data-v=malzeme]').click()); await pg.waitForSelector('#ekipmanKart', { timeout: 20000 }); await pg.waitForTimeout(500);
    check(await pg.isVisible('#ekipmanKart') && /yeni eklenen doğrulanmış ürünler otomatik/.test(await pg.textContent('#ekipmanKart')), `${ad} ekipman önerileri kartı ve açıklama`);
    const metin = await pg.textContent('#ekListe');
    check(/Uygun \(1\)/.test(metin) && /Pompa-A/.test(metin) && /Verisi eksik \(1\)/.test(metin) && /Pompa-B/.test(metin), `${ad} pompa: uygun ve verisi eksik ayrı (${metin.slice(0, 160)})`);
    check(/mühendislik doğrulaması yapılmadı/.test(metin) && /s\.\s?\d+/.test(metin) && /işletme noktası/.test(metin), `${ad} gerekçe, kaynak sayfası ve işletme noktası`);
    // Malzeme listesine ekle → rapor satırı
    await tikla('[data-ekle^="pompa"]'); await pg.waitForSelector('#katalogKalemleri'); await pg.waitForTimeout(400);
    let p = await P(); check(p.katalogKalemleri && p.katalogKalemleri.length === 1 && p.katalogKalemleri[0].model === 'Pompa-A', `${ad} katalog kalemi projeye eklendi`);
    const rap = await pg.evaluate(() => { const A = window.IrriApp.ekipmanBaglam(); return JSON.stringify(window.IrriReportData.build(A.cur, A.r).bomU); });
    check(/Katalog kalemi/.test(rap) && /Pompa-A/.test(rap), `${ad} katalog kalemi PDF/Excel malzeme tablosunda`);
    // Hesaba uygula → taslak → Uygula
    await tikla('[data-hesap^="pompa"]'); await pg.waitForSelector('#ekTaslak');
    check(/Pompa basma yüksekliği/.test(await pg.textContent('#ekTaslak')) && !(await pg.isDisabled('#ekUygula')), `${ad} taslak önce/sonra karşılaştırması`);
    check(JSON.stringify((await P()).ekipmanSecimi || null) === 'null', `${ad} taslak kaydı değiştirmez`);
    await tikla('#ekUygula'); await pg.waitForTimeout(800);
    p = await P(); const sonra = await pg.evaluate(() => { const A = window.IrriApp.ekipmanBaglam(); return { id: A.r.pump.id, ad: A.r.pump.ad }; });
    check(p.ekipmanSecimi && p.ekipmanSecimi.secim.pompa && /^urun:/.test(sonra.id) && /Test Üretici/.test(sonra.ad), `${ad} Uygula: motor seçilen ürünle hesapladı (${sonra.ad})`);
    check(await pg.isVisible('#ekUygulanan'), `${ad} uygulanan ekipman gösterilir`);
    // JSON yedeği: proje içindeki ekipman seçimi taşınır (telefon ↔ masaüstü)
    const yed = await pg.evaluate(() => JSON.stringify(window.IrriStore.backupPayload(JSON.parse(localStorage.getItem('irrismart.projects.v1')), {}, null)));
    check(JSON.parse(yed).projects[0].ekipmanSecimi.katalog.pompa[0].egri.length >= 4, `${ad} proje yedeği uygulanan ekipmanın motor verisini taşır`);
    // Geri Al
    await tikla('#ekKaldir'); await pg.waitForTimeout(800);
    p = await P(); const geri = await pg.evaluate(() => window.IrriApp.ekipmanBaglam().r.pump.ad);
    check(!p.ekipmanSecimi && geri === hazir.pumpOnce, `${ad} Geri Al: otomatik seçime dönüldü (${geri})`);
    // Vana kategorisi
    await tikla('[data-ekkat=vana]'); await pg.waitForTimeout(300);
    check(/Vana-A/.test(await pg.textContent('#ekListe')), `${ad} vana önerisi`);
    check(!errs.length, `${ad} sayfa hatası: ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`Ekipman önerileri: ${passes} denetim geçti, ${fails} başarısız`);
  process.exit(fails ? 1 : 0);
})();

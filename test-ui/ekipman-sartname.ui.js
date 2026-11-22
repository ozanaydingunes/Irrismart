#!/usr/bin/env node
// Seviye 1 teknik şartname: katalog BOŞKEN beş kategoride "Projem İçin Gereken Teknik Özellikler" ve "doğrulanmış eşleşme bulunamadı";
// şartnameyi malzeme listesine ekleme → PDF/Excel malzeme tablosu; sonradan eklenen doğrulanmış ürün kod değişmeden B bölümünde görünür.
// Telefon 390 px ve masaüstü 1280 px aynı kod. Ürün test içinde üretilen sentetik veridir.
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
    const malzeme = async () => { await pg.evaluate(() => document.querySelector('nav.tabs [data-v=malzeme]').click()); await pg.waitForSelector('#ekipmanKart', { timeout: 20000 }); await pg.waitForTimeout(500); };
    await malzeme();
    check((await pg.evaluate(async () => (await window.IrriKatalogDepo.urunListele()).urunler.length)) === 0, `${ad} katalog boş`);
    for (const k of ['pompa', 'filtre', 'vana', 'boru', 'baglanti']) {
      await tikla(`[data-ekkat=${k}]`); await pg.waitForTimeout(250);
      const a = await pg.textContent('#ekSartname').catch(() => ''), b = await pg.textContent('#ekListe');
      const ozel = { pompa: /Toplam dinamik basma yüksekliği/.test(a) && /Yaklaşık mil gücü aralığı/.test(a) && /varsayım/.test(a) && /Dinamik su seviyesi/.test(a),
        filtre: /Gerekli filtre kapasitesi/.test(a) && /Su kalitesi/.test(a) && /Filtrasyon yaklaşımı/.test(a),
        vana: /Kv/.test(a) && /Vana işlevleri/.test(a) && /Çekvalf/.test(a) && /Basınç düzenleme/.test(a),
        boru: /Ana hat segmentleri/.test(a) && /AH-01/.test(a) && /Alternatif ana hat çapları/.test(a),
        baglanti: /Bağlantı uyumu/.test(a) && /Gerekli bağlantı elemanları/.test(a) && /kesin değildir/.test(a) }[k];
      check(/A\. Projem İçin Gereken Teknik Özellikler/.test(a) && ozel, `${ad} ${k}: teknik özellikler (${a.slice(0, 140)})`);
      check(/B\. Uygun Üretici ve Modeller/.test(b) && (k === 'boru' ? true : /doğrulanmış eşleşme bulunamadı/.test(b)) && !/Bu kategoride kayıtlı ürün yok/.test(b), `${ad} ${k}: B bölümü eşleşme yok iletisi`);
      check(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${ad} ${k}: yatay taşma yok`);
    }
    // Şartnameyi malzeme listesine ekle (pompa ve vana) → proje → PDF/Excel malzeme tablosu
    await tikla('[data-ekkat=pompa]'); await pg.waitForTimeout(200); await tikla('#ekSartnameEkle'); await pg.waitForTimeout(400);
    await tikla('[data-ekkat=vana]'); await pg.waitForTimeout(200); await tikla('#ekSartnameEkle'); await pg.waitForTimeout(400);
    await tikla('[data-ekkat=vana]'); await pg.waitForTimeout(200); await tikla('#ekSartnameEkle'); await pg.waitForTimeout(400);
    let p = await P();
    check(p.katalogKalemleri && p.katalogKalemleri.length === 2 && p.katalogKalemleri.every(k => k.tur === 'sartname'), `${ad} şartname kalemleri projede (tekrar eklenmez) ${JSON.stringify(p.katalogKalemleri || []).slice(0, 120)}`);
    check(/Teknik şartname/.test(await pg.textContent('#katalogKalemleri')) && !/uygunluk doğrulanmadı/.test(await pg.textContent('#katalogKalemleri')), `${ad} katalog kalemleri tablosunda şartname`);
    const rap = await pg.evaluate(() => { const A = window.IrriApp.ekipmanBaglam(), R = window.IrriReportData; const bomU = R.build(A.cur, A.r).bomU; const wb = R.workbook && window.XLSX ? R.workbook(window.XLSX, A.cur, A.r) : null; return { bomU: JSON.stringify(bomU), xl: wb ? wb.SheetNames.map(n => JSON.stringify(window.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 }))).join('') : '' }; });
    check((rap.bomU.match(/Teknik şartname/g) || []).length === 2 && /Tasarım debisi/.test(rap.bomU) && /Kv/.test(rap.bomU), `${ad} şartname PDF malzeme tablosunda`);
    check(!rap.xl || /Teknik şartname/.test(rap.xl), `${ad} şartname Excel çalışma kitabında`);
    // Sonradan eklenen doğrulanmış ürün: kod değişmeden B bölümüne girer; doğrulanmamış ürün uygun olmaz
    const ok2 = await pg.evaluate(async () => {
      const D = window.IrriKatalogDepo, M = window.IrriKatalogModel, U = window.IrriKatalogUrun;
      const dosya = await D.dosyaYaz(new File([new Blob([new TextEncoder().encode('%PDF-1.4\n% sartname testi\n%%EOF\n')])], 'k.pdf'));
      const f = M.yeniFirma('Sonradan Üretici'); await D.firmaKaydet(f); const k = M.yeniKatalog({ ad: 'Yeni katalog', firmaId: f.id, dosya }); await D.katalogKaydet(k);
      const ekle = async (model, dog) => { let u = U.yeniUrun({ uretici: 'Sonradan Üretici', model, urunKodu: model, katalogId: k.id, kategori: 'vana' });
        const ds = [['dn', 63, 'mm'], ['pn', 16, 'bar'], ['kv', 60, 'Kv']].map(([a, d, b], i) => Object.assign(U.yeniDeger({ urunId: u.id, ad: a, deger: d, birim: b, kaynak: { katalogId: k.id, sayfa: 5 + i, hamMetin: 't', yontem: 'elle' } }).deger, { inceleme: 'kullanici-onayladi' }));
        u = U.incele(u, 'kullanici-onayladi'); if (dog) { const den = U.muhendislikDenetle(u, ds, []); if (!den.gecti) return false; u = U.muhendislikOnayla(u, den, 'Test'); }
        await D.urunKaydet(u); for (const d of ds) await D.degerKaydet(d); return true; };
      return (await ekle('Yeni-Vana', true)) && (await ekle('Onaysiz-Vana', false));
    });
    check(ok2, `${ad} sonradan ürün eklendi`);
    await pg.evaluate(() => document.querySelector('nav.tabs [data-v=sonuc]') ? document.querySelector('nav.tabs [data-v=sonuc]').click() : null); await pg.waitForTimeout(300);
    await malzeme(); await tikla('[data-ekkat=vana]'); await pg.waitForTimeout(300);
    const b = await pg.textContent('#ekListe'), a = await pg.textContent('#ekSartname');
    check(/Uygun \(1\)/.test(b) && /Yeni-Vana/.test(b) && /Verisi eksik \(1\)/.test(b) && /Onaysiz-Vana/.test(b) && !/doğrulanmış eşleşme bulunamadı/.test(b), `${ad} yeni doğrulanmış ürün otomatik uygun; onaysız ürün uygun değil (${b.slice(0, 160)})`);
    check(/A\. Projem İçin Gereken Teknik Özellikler/.test(a), `${ad} katalog varken de A bölümü görünür`);
    check(!errs.length, `${ad} sayfa hatası: ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`Teknik şartname (Seviye 1): ${passes} denetim geçti, ${fails} başarısız`);
  process.exit(fails ? 1 : 0);
})();

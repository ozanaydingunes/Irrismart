#!/usr/bin/env node
// Katalog teknik ürün veritabanı — IndexedDB sürüm 1 → 2 geçişi: mevcut firma, katalog ve PDF kayıtları korunur;
// yeni ürün / değer / eğri depoları çalışır; kaynaksız değer reddedilir. (Chromium; Android WebView ayrıca emülatörde denenmeli.)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };
// Sürüm 1 deposunu (1.0.6'daki biçim) kuran yalın sayfa
const V1 = `<!doctype html><meta charset="utf-8"><script>
const r = indexedDB.open('irrigrow-katalog', 1);
r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('firmalar', { keyPath: 'id' }); d.createObjectStore('kataloglar', { keyPath: 'id' }); d.createObjectStore('dosyalar'); };
r.onsuccess = () => { const d = r.result, tx = d.transaction(['firmalar', 'kataloglar', 'dosyalar'], 'readwrite');
  tx.objectStore('firmalar').put({ surum: 1, id: 'frm_v1', ad: 'Eski Firma', olusturma: '2026-11-01T00:00:00Z', ornek: false });
  tx.objectStore('kataloglar').put({ surum: 1, id: 'kat_v1', firmaId: 'frm_v1', ad: 'Eski katalog', belgeTuru: 'urun', belgeTarihi: '2026', urunGruplari: ['boru'], kaynak: { tur: 'diger', aciklama: '' }, not: '', dosya: { ad: 'e.pdf', boyut: 9, sha256: 'a'.repeat(64), mime: 'application/pdf', depo: 'indexeddb', anahtar: 'pdf_v1' }, yuklenme: '2026-11-01', guncelleme: '2026-11-01', oncekiSurumler: [], fiyatListesi: null, cikarim: { durum: 'yok', satirlar: [] }, ornek: false });
  tx.objectStore('dosyalar').put(new Blob(['%PDF-1.4\\n'], { type: 'application/pdf' }), 'pdf_v1');
  tx.oncomplete = () => { d.close(); document.title = 'v1-hazir'; }; };
</script>`;

(async () => {
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/v1.html') { r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end(V1); } const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const pg = await ctx.newPage(), errs = []; pg.on('pageerror', e => errs.push(e.message));
  const base = `http://localhost:${srv.address().port}`;
  await pg.goto(base + '/v1.html'); await pg.waitForFunction(() => document.title === 'v1-hazir');
  await pg.goto(base + '/'); await pg.waitForTimeout(800);
  const s = await pg.evaluate(async () => { const D = window.IrriKatalogDepo; const v = await D.listele(); const db = await D.db(); return { surum: db.version, depolar: [...db.objectStoreNames].sort(), firma: v.firmalar.map(f => f.ad), katalog: v.kataloglar.map(k => k.ad), dosya: await D.dosyaVarMi(v.kataloglar[0].dosya) }; });
  check(s.surum === 2, `veritabanı sürüm 2 (${s.surum})`);
  check(['dosyalar', 'egriler', 'degerler', 'firmalar', 'kataloglar', 'urunler'].every(x => s.depolar.includes(x)), `yeni depolar eklendi (${s.depolar})`);
  check(s.firma.join() === 'Eski Firma' && s.katalog.join() === 'Eski katalog' && s.dosya, 'sürüm 1 kayıtları (firma, katalog, PDF) korundu');
  const u = await pg.evaluate(async () => { const D = window.IrriKatalogDepo, U = window.IrriKatalogUrun;
    const urun = U.yeniUrun({ uretici: 'Eski Firma', model: 'PE100 63 PN10', katalogId: 'kat_v1', kategori: 'boru' }); await D.urunKaydet(urun);
    const d = U.yeniDeger({ urunId: urun.id, ad: 'dis_cap', deger: 63, birim: 'mm', kaynak: { katalogId: 'kat_v1', sayfa: 12, hamMetin: '63' } }).deger; await D.degerKaydet(d);
    let red = null; try { await D.degerKaydet(Object.assign({}, d, { id: 'x', kaynak: { katalogId: 'kat_v1' } })); } catch (e) { red = e.message; }
    const o = U.ornekVeri('kat_v1'); for (const x of o.urunler) await D.urunKaydet(x);
    const L = await D.urunListele(); await D.urunSil(urun.id); const L2 = await D.urunListele();
    return { n: L.urunler.length, deger: L.degerler.length, red, sonra: L2.urunler.length, degerSonra: L2.degerler.length, katalog: (await D.listele()).kataloglar.length };
  });
  check(u.n === 5 && u.deger === 1, `ürün ve değer kaydı (${u.n} ürün, ${u.deger} değer)`);
  check(/kaynak katalog ve sayfa/.test(u.red || ''), 'sayfası olmayan değer depoya yazılmaz');
  check(u.sonra === 4 && u.degerSonra === 0 && u.katalog === 1, 'ürün silinince değerleri silinir; katalog kaydına dokunulmaz');
  check(!errs.length, 'sayfa hatası: ' + errs.join(' | '));
  await browser.close(); srv.close();
  console.log(`Katalog ürün veritabanı: ${passes} denetim geçti, ${fails} başarısız`);
  process.exit(fails ? 1 : 0);
})();

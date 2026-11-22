// Firma Malzeme Katalogları — aşama 1 (veri modeli, akışlı SHA-256, yedek, motor ayrılığı)
const { E, test, ok, W } = require('./_lib');
const fs = require('fs'), crypto = require('crypto');
const M = require(W('katalog-model.js'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const dosya = (o = {}) => Object.assign({ ad: 'a.pdf', boyut: 10, sha256: 'a'.repeat(64), mime: 'application/pdf', depo: 'indexeddb', anahtar: 'pdf_1' }, o);

test('KT-01 Akışlı SHA-256 Node crypto ile aynı (boş, blok sınırları, parça parça, 1 MB + 3)', () => {
  for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 128, 1000, 1048576 + 3]) {
    const b = crypto.randomBytes(n), h = M.sha256Akis();
    for (let o = 0, p = 1; o < n; o += p, p = p * 3 + 7) h.ekle(new Uint8Array(b.subarray(o, Math.min(n, o + p))));
    ok(h.bitir() === sha(b), `n=${n}`);
  }
  ok(M.sha256Akis().ekle(new TextEncoder().encode('abc')).bitir() === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'standart "abc" vektörü');
});

test('KT-02 Belge tarihi: yalnız bilinen kısım saklanır, geçersiz tarih reddedilir; yaş en iyimser hesaplanır', () => {
  ok(M.tarihOku('2026') === '2026' && M.tarihOku('10.2026') === '2026-10' && M.tarihOku('2026-10') === '2026-10' && M.tarihOku('20.10.2026') === '2026-10-20' && M.tarihOku('2026-10-20') === '2026-10-20', 'biçimler');
  ok(M.tarihOku('') === null && M.tarihOku('   ') === null, 'boş → bilinmiyor');
  ok(M.tarihOku('31.02.2026') === undefined && M.tarihOku('13.2026') === undefined && M.tarihOku('Ekim 2026') === undefined, 'geçersiz');
  const simdi = Date.UTC(2026, 10, 21);
  ok(M.yasGun('2026-10-20', simdi) === 32 && M.yasGun('2026-10', simdi) === 21 && M.yasGun('2026', simdi) < 0 && M.yasGun(null) === null, 'yaş');
});

test('KT-03 Kayıt: zorunlu alanlar, PDF imzası, bilinmeyen değer tahmin edilmez', () => {
  ok(M.pdfImzasi(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])) && !M.pdfImzasi(new Uint8Array([0x50, 0x4b, 3, 4, 0])) && !M.pdfImzasi(null), 'imza');
  const f = M.yeniFirma('  Fırat '), k = M.yeniKatalog({ ad: 'Fiyat Listesi', firmaId: f.id, belgeTuru: 'fiyat', belgeTarihi: '2026-10-20', urunGruplari: ['boru', 'olmayan'], dosya: dosya() });
  ok(f.ad === 'Fırat' && M.firmaBul([f], 'FIRAT') === f && M.firmaBul([f], 'fırat') === f, 'firma adı eşleştirme (Türkçe büyük/küçük harf)');
  ok(!M.katalogDogrula(k).length, 'geçerli kayıt: ' + M.katalogDogrula(k));
  ok(k.urunGruplari.join() === 'boru' && k.fiyatListesi.kdvDahil === null && k.fiyatListesi.paraBirimi === null, 'KDV ve para birimi belirtilmediyse boş kalır');
  ok(k.cikarim.durum === 'yok' && !k.cikarim.satirlar.length, 'teknik değer yok');
  ok(M.katalogDogrula(Object.assign({}, k, { ad: '' })).length && M.katalogDogrula(Object.assign({}, k, { dosya: dosya({ sha256: 'x' }) })).length && M.katalogDogrula(Object.assign({}, k, { belgeTarihi: '20.10.2026' })).length, 'eksik/geçersiz alanlar');
});

test('KT-04 Güncelleme: eski sürüm saklanır, ayrı silinebilir; aynı dosya tespiti', () => {
  const k = M.yeniKatalog({ ad: 'K', firmaId: 'f', dosya: dosya({ anahtar: 'p1', sha256: '1'.repeat(64) }), belgeTarihi: '2025' });
  const k2 = M.surumEkle(k, dosya({ anahtar: 'p2', sha256: '2'.repeat(64) }), '2026');
  ok(k2.dosya.anahtar === 'p2' && k2.belgeTarihi === '2026' && k2.oncekiSurumler.length === 1 && k2.oncekiSurumler[0].dosya.anahtar === 'p1' && k2.oncekiSurumler[0].belgeTarihi === '2025', 'eski sürüm geçmişte');
  ok(M.dosyaAnahtarlari(k2).join() === 'p2,p1', 'bütün dosya anahtarları');
  ok(M.ayniDosya([k2], '1'.repeat(64)) === k2 && M.ayniDosya([k2], '2'.repeat(64)) === k2 && M.ayniDosya([k2], '3'.repeat(64)) === null, 'yinelenme (eski sürümler dahil)');
  const k3 = M.surumSil(k2, 'p1'); ok(!k3.oncekiSurumler.length && k3.dosya.anahtar === 'p2' && k2.oncekiSurumler.length === 1, 'eski sürüm silme; özgün kayıt değişmez');
});

test('KT-05 Bilgi yedeği PDF içermez; geri yükleme mevcut kayıtları silmez, PDF bekler; örnek veri yedeğe girmez', () => {
  const f = M.yeniFirma('Poelsan'), fo = M.yeniFirma('Örnek', true);
  const k = M.yeniKatalog({ ad: 'Ürün Kataloğu', firmaId: f.id, dosya: dosya({ anahtar: 'gizli-anahtar' }) }), ko = M.yeniKatalog({ ad: 'Ö', firmaId: fo.id, dosya: dosya(), ornek: true });
  const y = M.yedekOlustur([f, fo], [k, ko]), metin = JSON.stringify(y);
  ok(y.pdfIcerir === false && /PDF dosyalarını İÇERMEZ/.test(y.aciklama), 'açık beyan');
  ok(y.kataloglar.length === 1 && y.firmalar.length === 1 && !metin.includes('gizli-anahtar') && !/base64|%PDF/.test(metin), 'yalnız bilgi; örnek ve dosya anahtarı yok');
  const r = M.yedekOku(metin, [], []);
  ok(!r.hata && r.kataloglar.length === 1 && r.kataloglar[0].dosya.bekliyor === true && r.kataloglar[0].dosya.anahtar === null && r.kataloglar[0].dosya.sha256 === k.dosya.sha256, 'geri yükleme: PDF bekleniyor');
  const r2 = M.yedekOku(metin, [f], [k]); ok(r2.kataloglar.length === 0 && r2.atlanan.length === 1 && r2.firmalar.length === 0, 'mevcut kayıt üzerine yazılmaz');
  ok(M.yedekOku('{', [], []).hata && M.yedekOku('{"tur":"baska"}', [], []).hata && M.yedekOku(JSON.stringify(Object.assign({}, y, { surum: 99 })), [], []).hata, 'geçersiz yedek reddedilir');
});

test('KT-06 Filtre: metin, firma, ürün grubu; örnek veriler gerçek kataloglardan ayrı', () => {
  const f1 = M.yeniFirma('Fırat'), f2 = M.yeniFirma('Pimtaş');
  const a = M.yeniKatalog({ ad: 'Fiyat Listesi', firmaId: f1.id, urunGruplari: ['boru', 'damla'], dosya: dosya() }), b = M.yeniKatalog({ ad: 'Genel Katalog', firmaId: f2.id, urunGruplari: ['vana'], dosya: dosya(), not: 'PVC vanalar' }), c = M.yeniKatalog({ ad: 'Örnek', firmaId: f1.id, urunGruplari: ['boru'], dosya: dosya(), ornek: true });
  const L = [a, b, c], F = [f1, f2];
  ok(M.filtrele(L, F, { metin: 'fırat', ornek: false }).length === 1 && M.filtrele(L, F, { metin: 'pvc', ornek: false })[0] === b && M.filtrele(L, F, { grup: 'boru', ornek: false }).length === 1 && M.filtrele(L, F, { ornek: true })[0] === c, 'filtreler');
});

test('KT-07 Motor ayrılığı: katalog modülleri hesap motorunu, boru kütüphanesini ve fiyat kataloğunu kullanmaz; hesap sonucu değişmez', () => {
  for (const f of ['katalog-model.js', 'katalog-depo.js', 'katalog-ui.js']) {
    const s = fs.readFileSync(W(f), 'utf8').replace(/\/\/.*$/gm, '');
    ok(!/IrriEngine|IrriPipes|IrriPipeLib|IrriCatalog\b|IRRI_CATALOG|E\.design|IrriAuto|IrriHyd\b|localStorage/.test(s), f + ': motor/kütüphane/proje deposu erişimi yok');
  }
  const inp = { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, srcType: 'kuyu', depth: 40, region: 'akdeniz' };
  const once = JSON.stringify(E.design(inp));
  require(W('katalog-model.js'));
  ok(JSON.stringify(E.design(inp)) === once, 'aynı girdi → aynı sonuç');
  const app = fs.readFileSync(W('app.js'), 'utf8');
  ok(!/IrriKatalogModel|IrriKatalogDepo/.test(app.slice(app.indexOf('function compute'), app.indexOf('function compute') + 4000)), 'compute() katalog verisi okumaz');
});

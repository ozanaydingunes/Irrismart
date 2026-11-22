// Katalog teknik ürün veritabanı — veri modeli, kaynak zorunluluğu, iki ayrı onay, mühendislik doğrulaması
const { E, test, ok, W } = require('./_lib');
const fs = require('fs');
const U = require(W('katalog-urun.js'));
const K = (s = 3) => ({ katalogId: 'kat_1', sayfa: s, hamMetin: '63 x 3,8 PN10', yontem: 'elle' });
const dg = (ad, deger, birim, urunId = 'u1') => { const r = U.yeniDeger({ urunId, ad, deger, birim, kaynak: K() }); if (r.hata) throw new Error(r.hata.join('; ')); return Object.assign(r.deger, { inceleme: 'kullanici-onayladi' }); };

test('KU-01 Ürün: üretici, model/ürün kodu ve kaynak katalog zorunlu; bilinmeyen kategori "diger"', () => {
  const u = U.yeniUrun({ uretici: 'Firma', model: 'X', katalogId: 'kat_1', kategori: 'boru' });
  ok(!U.urunDogrula(u).length && u.inceleme === 'bekliyor' && u.muhendislik === 'dogrulanmadi', 'geçerli ürün, başlangıç durumları');
  ok(U.urunDogrula(U.yeniUrun({ model: 'X', katalogId: 'k' })).includes('üretici gerekli') && U.urunDogrula(U.yeniUrun({ uretici: 'F', katalogId: 'k' })).length && U.urunDogrula(U.yeniUrun({ uretici: 'F', model: 'X' })).includes('kaynak katalog gerekli'), 'zorunlu alanlar');
  ok(U.yeniUrun({ uretici: 'F', model: 'X', katalogId: 'k', kategori: 'yok' }).kategori === 'diger', 'kategori');
});

test('KU-02 Teknik değer: sayfa, özgün değer ve birim zorunlu; SI dönüşümü yalnız tanımlı birimlerle; tahmin yok', () => {
  const r = U.yeniDeger({ urunId: 'u1', ad: 'pn', deger: '145', birim: 'psi', kaynak: K() });
  ok(!r.hata && Math.abs(r.deger.siDeger - 9.997) < 0.01 && r.deger.deger === '145' && r.deger.birim === 'psi', 'özgün değer ve birim saklanır, SI hesaplanır');
  ok(U.yeniDeger({ urunId: 'u1', ad: 'pn', deger: 10, birim: 'bar', kaynak: { katalogId: 'k' } }).hata.includes('sayfa numarası yok'), 'sayfa yoksa reddedilir');
  ok(U.yeniDeger({ urunId: 'u1', ad: 'pn', deger: 10, birim: 'bar', kaynak: { sayfa: 2 } }).hata.includes('kaynak katalog yok'), 'katalog yoksa reddedilir');
  ok(U.yeniDeger({ urunId: 'u1', ad: 'pn', deger: 10, birim: 'kg', kaynak: K() }).hata.some(h => /birim/.test(h)), 'tanımsız birim reddedilir');
  ok(U.yeniDeger({ urunId: 'u1', ad: 'renk', deger: 'mavi', birim: '', kaynak: K() }).hata.some(h => /bilinmeyen/.test(h)), 'bilinmeyen değer adı reddedilir');
  ok(U.yeniDeger({ urunId: 'u1', ad: 'dis_cap', deger: 'yaklaşık', birim: 'mm', kaynak: K() }).hata.includes('değer sayı değil'), 'sayısal olmayan değer reddedilir');
  ok(U.yeniDeger({ urunId: 'u1', ad: 'kv', deger: 10, birim: 'Cv', kaynak: K() }).deger.siDeger === 8.65, 'Cv → Kv');
});

test('KU-03 Eğri: ≥ 4 nokta, debi kesin artan, kaynak ve (Q–H için) devir/çark çapı zorunlu; ölçülen aralık dışında değer üretilmez', () => {
  const ok1 = U.yeniEgri({ urunId: 'p', tur: 'QH', birimX: 'm³/h', birimY: 'm', noktalar: [[0, 80], [10, 76], [20, 68], [30, 55]], kosul: { devir: 2900 }, kaynak: K(4) });
  ok(!ok1.hata, 'geçerli eğri');
  ok(U.yeniEgri({ urunId: 'p', tur: 'QH', birimX: 'm³/h', birimY: 'm', noktalar: [[0, 80], [10, 76], [20, 68], [30, 55]], kaynak: K(4) }).hata.some(h => /devir/.test(h)), 'devir/çark çapı zorunlu');
  ok(U.yeniEgri({ urunId: 'p', tur: 'QH', birimX: 'm³/h', birimY: 'm', noktalar: [[0, 80], [10, 76], [20, 68]], kosul: { devir: 2900 }, kaynak: K(4) }).hata.includes('en az 4 nokta gerekli'), '4 nokta');
  ok(U.yeniEgri({ urunId: 'p', tur: 'QH', birimX: 'm³/h', birimY: 'm', noktalar: [[0, 80], [20, 76], [10, 68], [30, 55]], kosul: { devir: 2900 }, kaynak: K(4) }).hata.some(h => /artan/.test(h)), 'artan debi');
  const e = ok1.egri;
  ok(Math.abs(U.egriDeger(e, 15) - 72) < 1e-9 && U.egriDeger(e, 35) === null && U.egriDeger(e, -1) === null, 'aralık içi ara değer; dışı null');
});

test('KU-04 Kullanıcı incelemesi mühendislik doğrulaması değildir; ekipman seçiminde yalnız mühendislik doğrulaması geçerlidir', () => {
  let u = U.yeniUrun({ uretici: 'F', model: 'X', katalogId: 'k', kategori: 'boru' });
  u = U.incele(u, 'kullanici-onayladi');
  ok(u.inceleme === 'kullanici-onayladi' && u.muhendislik === 'dogrulanmadi' && !U.secimdeKullanilabilir(u), 'kullanıcı onayı seçimde kullanılmaz');
  let hata = null; try { U.muhendislikOnayla(u, { gecti: false, kurallar: [{ kod: 'x', durum: 'kaldi', mesaj: 'm' }] }, 'Mühendis'); } catch (e) { hata = e.message; }
  ok(/denetimi geçmedi/.test(hata || ''), 'denetim geçmeden doğrulanamaz');
  hata = null; try { U.muhendislikOnayla(u, { gecti: true, kurallar: [] }, ''); } catch (e) { hata = e.message; } ok(/doğrulayan/.test(hata || ''), 'doğrulayan kişi zorunlu');
  const v = U.muhendislikOnayla(u, { gecti: true, kurallar: [] }, 'Mühendis A');
  ok(U.secimdeKullanilabilir(v) && v.dogrulama.dogrulayan === 'Mühendis A' && !U.secimdeKullanilabilir(Object.assign({}, v, { ornek: true })), 'doğrulanmış ürün seçimde; örnek veri asla');
});

test('KU-05 Mühendislik denetimi — boru: tamlık, tutarlılık (iç çap, SDR), EN 12201 standart serisi, işletme basıncı', () => {
  const u = U.yeniUrun({ uretici: 'F', model: 'PE100 63 PN10', katalogId: 'k', kategori: 'boru' });
  const temel = [dg('dis_cap', 63, 'mm'), dg('et_kalinligi', 3.8, 'mm'), dg('pn', 10, 'bar'), dg('malzeme', 'PE100', '')];
  ok(U.muhendislikDenetle(u, temel, [], { calismaBasinci: 6 }).gecti, 'standart PE100 63 × 3,8 PN10 geçer');
  const r1 = U.muhendislikDenetle(u, temel.concat([dg('ic_cap', 58, 'mm')]), []);
  ok(!r1.gecti && r1.kurallar.some(k => k.kod === 'ic-cap'), 'iç çap tutarsızlığı');
  const r2 = U.muhendislikDenetle(u, [dg('dis_cap', 63, 'mm'), dg('et_kalinligi', 3.0, 'mm'), dg('pn', 10, 'bar'), dg('malzeme', 'PE100', '')], []);
  ok(!r2.gecti && r2.kurallar.some(k => k.kod === 'std-sdr-pn'), 'SDR 21 ile PN10 PE100 standartla çelişir');
  const r3 = U.muhendislikDenetle(u, [dg('dis_cap', 64, 'mm'), dg('et_kalinligi', 3.8, 'mm'), dg('pn', 10, 'bar'), dg('malzeme', 'PE100', '')], []);
  ok(r3.kurallar.some(k => k.kod === 'std-cap'), 'standart dışı dış çap');
  ok(U.muhendislikDenetle(u, temel, [], { calismaBasinci: 12 }).kurallar.some(k => k.kod === 'isletme-pn'), 'çalışma basıncı > PN');
  ok(U.muhendislikDenetle(u, temel, [], { sicaklik: 30 }).kurallar.some(k => k.kod === 'isletme-sicaklik' && k.durum === 'eksik'), '20 °C üzeri: katalogda azaltma katsayısı yoksa eksik');
  ok(U.muhendislikDenetle(u, temel.slice(0, 3), []).kurallar.some(k => k.kod === 'eksik-malzeme' && k.durum === 'eksik'), 'eksik malzeme tahmin edilmez');
  const inc = temel.map(d => Object.assign({}, d, { inceleme: 'bekliyor' }));
  ok(!U.muhendislikDenetle(u, inc, []).gecti, 'incelenmemiş değerle doğrulanamaz');
});

test('KU-06 Mühendislik denetimi — vana, filtre, pompa: eksik veri açıkça; temiz/kirli kayıp ayrı; Q–H azalan ve koşullu', () => {
  const v = U.yeniUrun({ uretici: 'F', model: 'V', katalogId: 'k', kategori: 'vana' });
  ok(U.muhendislikDenetle(v, [dg('dn', 50, 'mm'), dg('pn', 16, 'bar')], []).kurallar.some(k => k.kod === 'eksik-kv'), 'vana: Kv yok → eksik');
  ok(U.muhendislikDenetle(v, [dg('dn', 50, 'mm'), dg('pn', 10, 'bar'), dg('kv', 60, 'Kv'), dg('basinc_max', 16, 'bar')], []).kurallar.some(k => k.kod === 'pn-max'), 'vana: en yüksek basınç > PN');
  const f = U.yeniUrun({ uretici: 'F', model: 'Fl', katalogId: 'k', kategori: 'filtre' });
  const rf = U.muhendislikDenetle(f, [dg('dn', 50, 'mm'), dg('debi_max', 25, 'm³/h')], []);
  ok(rf.kurallar.some(k => k.kod === 'eksik-filtrasyon') && rf.kurallar.some(k => k.kod === 'eksik-kayip'), 'filtre: filtrasyon ve temiz kayıp eksik');
  ok(U.muhendislikDenetle(f, [dg('dn', 50, 'mm'), dg('debi_max', 25, 'm³/h'), dg('filtrasyon_mesh', 120, 'mesh'), dg('kayip_temiz', 0.5, 'bar'), dg('kayip_kirli', 0.3, 'bar')], []).kurallar.some(k => k.kod === 'kayip-sira'), 'filtre: temiz kayıp < kirli kayıp');
  const p = U.yeniUrun({ uretici: 'F', model: 'P', katalogId: 'k', kategori: 'pompa' });
  ok(U.muhendislikDenetle(p, [], []).kurallar.some(k => k.kod === 'eksik-qh'), 'pompa: Q–H yok');
  const art = U.yeniEgri({ urunId: 'p', tur: 'QH', birimX: 'm³/h', birimY: 'm', noktalar: [[0, 60], [10, 70], [20, 68], [30, 55]], kosul: { devir: 2900 }, kaynak: K() }).egri;
  const rp = U.muhendislikDenetle(p, [], [art]);
  ok(rp.kurallar.some(k => k.kod === 'qh-azalan') && rp.kurallar.some(k => k.kod === 'eksik-npsh') && rp.kurallar.some(k => k.kod === 'eksik-verim'), 'pompa: artan Q–H, NPSH ve verim eksik');
});

test('KU-07 Örnek veriler açıkça örnek ve doğrulanmamış; boru, vana, filtre, pompa grupları; seçimde kullanılamaz', () => {
  const o = U.ornekVeri('kat_ornek');
  ok(['boru', 'vana', 'filtre', 'pompa'].every(k => o.urunler.some(u => u.kategori === k)), 'dört grup');
  ok(o.urunler.every(u => u.ornek && u.uretici === 'ÖRNEK ÜRETİCİ' && u.muhendislik === 'dogrulanmadi' && !U.secimdeKullanilabilir(u)), 'örnek işaretli, doğrulanmamış');
  ok(o.degerler.every(d => /ÖRNEK VERİ/.test(d.kaynak.hamMetin)) && o.egriler.length === 1, 'kaynak metni örnek olduğunu söyler');
});

test('KU-08 Hesap motoru ve altın kayıtlar etkilenmez; ürün modülü motor / boru kütüphanesi / proje verisi kullanmaz', () => {
  const s = fs.readFileSync(W('katalog-urun.js'), 'utf8').replace(/\/\/.*$/gm, '');
  ok(!/IrriEngine|IrriPipes|IrriPipeLib|IrriCatalog\b|IRRI_CATALOG|E\.design|localStorage/.test(s), 'bağımsız modül');
  const inp = { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, srcType: 'kuyu', depth: 40, region: 'akdeniz' };
  const once = JSON.stringify(E.design(inp)); require(W('katalog-urun.js')); ok(JSON.stringify(E.design(inp)) === once, 'aynı sonuç');
});

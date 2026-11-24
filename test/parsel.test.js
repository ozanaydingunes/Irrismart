// Çoklu parsel (1.0.7 düzeltme): veri modeli, aktif parsel değişimi, alan / çakışma, bağımsız hidrolik, eski projelerin korunumu,
// revizyon koruması, JSON yedek ve rapor tablosu. Hesap motoru (engine.js) değişmez.
const { E, test, ok, near, W } = require('./_lib');
const P = require(W('parsel.js')), St = require(W('store.js'));
const kare = (lat, lng, d, e) => [[lat, lng], [lat, lng + d], [lat + e, lng + d], [lat + e, lng]];
const INP = { crop: 'domates', srcType: 'kuyu', region: 'akdeniz', soil: 'tinli', geom: 'parsel', Q: 45, depth: 40 };
const proje = () => ({ id: 'x', name: 'Tire', created: 1, updated: 1, schema: 2, rev: 1, revs: [], poly: kare(38.10, 27.70, 0.004, 0.003), src: [38.1001, 27.7001], inp: Object.assign({}, INP, { area_da: 100 }), shiftEdit: { sig: 's1', assign: [0, 1] }, meta: { cizen: 'A' } });
const hesapla = v => E.design(v.inp, null, { poly: v.poly, src: v.src, station: v.station, route: v.route, manual: v.shiftEdit || null });
const alanGir = v => { const f = require(W('geom.js')).fieldFromPolygon(v.poly); Object.assign(v.inp, { area_da: +(f.A / 1000).toFixed(2), L: +f.L.toFixed(1), W: +f.W.toFixed(1) }); };

test('PA-01 Tek parselli eski proje: çoklu parsel modülü hiçbir alanı değiştirmez; hesap aynı', () => {
  const p = proje(); alanGir(p); const once = JSON.stringify(p), r0 = JSON.stringify(hesapla(p));
  ok(!P.coklu(p) && P.liste(p).length === 1 && P.aktifId(p) === 'p1' && P.aktifAd(p) === 'Parsel 1', 'tek parsel');
  ok(!P.sec(p, 'p2') && !P.sil(p, 'p1'), 'tek parselde geçiş / silme yok');
  P.ozet(p, hesapla);
  ok(JSON.stringify(p) === once && JSON.stringify(hesapla(p)) === r0, 'proje ve hesap değişmedi');
  const g = St.migrateProject(JSON.parse(once)); ok(!('parseller' in g) && !('parselId' in g), 'migrasyon yeni alan eklemez');
});

test('PA-02 Parsel ekle / geç / adlandır / sil: veri yer değiştirir, kaybolmaz; diğer parselin geometrisi bozulmaz', () => {
  const p = proje(); alanGir(p);
  const id2 = P.ekle(p, 'field2 tire');
  ok(id2 === 'p2' && P.aktifId(p) === 'p2' && p.poly.length === 0 && P.coklu(p), 'yeni boş parsel aktif');
  ok(p.inp.crop === 'domates' && p.inp.Q == null && p.inp.area_da == null && p.shiftEdit == null, 'geometri/kaynak girdileri taşınmadı, ortak girdiler taşındı');
  ok(p.meta && p.meta.cizen === 'A' && p.name === 'Tire', 'proje alanları (ad, meta) yerinde');
  const ilk = p.parseller.find(o => o.id === 'p1');
  ok(ilk && ilk.poly.length === 4 && ilk.shiftEdit.assign.length === 2 && ilk.inp.Q === 45, 'ilk parselin verisi korundu');
  p.poly = kare(38.09, 27.73, 0.003, 0.003); p.src = [38.0901, 27.7301]; p.inp.Q = 30; alanGir(p);
  const p1Once = JSON.stringify(ilk);
  const id3 = P.ekle(p, 'Üçüncü'); p.poly = kare(38.08, 27.75, 0.002, 0.002); alanGir(p);
  ok(JSON.stringify(p.parseller.find(o => o.id === 'p1')) === p1Once, 'üçüncü parsel çizilirken ilk parsel değişmedi');
  ok(P.sec(p, 'p1') && p.poly.length === 4 && p.inp.Q === 45 && p.shiftEdit.sig === 's1' && P.aktifAd(p) === 'Parsel 1', 'ilk parsele dönüldü');
  ok(P.liste(p).map(x => x.ad).join('|') === 'Parsel 1|field2 tire|Üçüncü', 'sıra korunur');
  ok(P.adlandir(p, 'p2', 'Tire 2') && P.liste(p)[1].ad === 'Tire 2', 'adlandırma');
  ok(P.sil(p, id3) && P.liste(p).length === 2, 'pasif parsel silindi');
  ok(P.sil(p, 'p1') && P.aktifId(p) === 'p2' && p.poly.length === 4 && !P.coklu(p), 'aktif parsel silinince diğeri aktif; tek parsel kaldı');
  ok(!P.sil(p, 'p2'), 'son parsel silinemez');
});

test('PA-03 Alan: her parsel ayrı, toplam = parsel alanları toplamı (aradaki boşluk sayılmaz); çakışma bir kez sayılır', () => {
  const p = proje(); alanGir(p); P.ekle(p, 'B'); p.poly = kare(38.20, 27.90, 0.003, 0.003); alanGir(p);
  const a1 = P.alanCevre(p.parseller[0].poly).alan_m2, a2 = P.alanCevre(p.poly).alan_m2;
  const oz = P.ozet(p, null);
  near(oz.toplam.alan_m2, a1 + a2, 1e-6, 'uzak parseller: toplam');
  ok(oz.toplam.cakisma_m2 === 0 && !oz.uyarilar.length, 'çakışma yok');
  // Çakışan üçüncü parsel: ilk parselin yarısı
  P.ekle(p, 'C'); p.poly = kare(38.10, 27.702, 0.004, 0.003); alanGir(p);
  const oz2 = P.ozet(p, null), a3 = P.alanCevre(p.poly).alan_m2;
  ok(oz2.toplam.cakisma_m2 > 0.4 * a1 && oz2.toplam.cakisma_m2 < 0.6 * a1, 'çakışan alan ≈ yarı: ' + oz2.toplam.cakisma_m2 / a1);
  near(oz2.toplam.alan_m2, a1 + a2 + a3 - oz2.toplam.cakisma_m2, 1e-6, 'çakışma bir kez sayıldı');
  ok(oz2.uyarilar.some(u => u.kod === 'cakisma'), 'çakışma uyarısı');
});

test('PA-04 Hidrolik: parseller ayrı kaynaklarla bağımsız hesaplanır; sonuçlar tek parsel hesabıyla aynı; shift numaraları parsele ait', () => {
  const p = proje(); alanGir(p);
  P.ekle(p, 'field2 tire'); p.poly = kare(38.09, 27.73, 0.003, 0.0025); p.src = [38.0901, 27.7301]; p.inp.Q = 30; p.inp.depth = 25; alanGir(p);
  const oz = P.ozet(p, hesapla);
  ok(oz.parseller.every(x => x.durum === 'hesaplandi'), 'iki parsel hesaplandı: ' + JSON.stringify(oz.parseller.map(x => [x.durum, x.neden])));
  const tekA = hesapla(p.parseller[0]), tekB = hesapla(p);
  const A = oz.parseller.find(x => x.id === 'p1'), B = oz.parseller.find(x => x.id === 'p2');
  ok(A.shift === tekA.sel.groups.length && B.shift === tekB.sel.groups.length && Math.abs(A.Qsys - Math.max(...tekA.sel.Qj)) < 1e-9 && Math.abs(B.Qsys - Math.max(...tekB.sel.Qj)) < 1e-9, 'parsel sonuçları tek başına hesapla aynı');
  ok(A.Q === 45 && B.Q === 30 && oz.toplam.shift === A.shift + B.shift, 'her parselin kendi kaynak debisi; shift toplamı');
  ok(A.shiftler.every(s => /^Parsel 1 · Shift \d+$/.test(s.ad)) && B.shiftler.every(s => /^field2 tire · Shift \d+$/.test(s.ad)), 'shift adları parsele ait (karışmaz)');
  ok(oz.toplam.durum === 'hesaplandi', 'toplam hesaplandı');
});

test('PA-05 Hesaplanamayan / eksik parsel uygunmuş gibi gösterilmez; ortak kaynak hesaplanmaz', () => {
  const p = proje(); alanGir(p);
  P.ekle(p, 'Boş'); const oz = P.ozet(p, hesapla);
  const b = oz.parseller.find(x => x.ad === 'Boş');
  ok(b.durum === 'eksik' && /sınırı yok/.test(b.neden) && oz.toplam.durum === 'eksik', 'sınırsız parsel eksik; toplam eksik');
  p.poly = kare(38.1005, 27.7045, 0.002, 0.002); alanGir(p); const oz2 = P.ozet(p, hesapla);
  ok(oz2.parseller.find(x => x.ad === 'Boş').neden === 'Kaynak debisi girilmedi', 'debisiz parsel eksik');
  p.inp.Q = 20; p.src = [38.10012, 27.70012];   // ilk parselin kuyusuyla aynı nokta (≈ 2 m)
  const oz3 = P.ozet(p, hesapla);
  ok(oz3.uyarilar.some(u => u.kod === 'ortak-kaynak') && oz3.toplam.durum === 'eksik', 'aynı kaynak: ortak hesap yapılmadı, toplam eksik');
});

test('PA-06 Revizyon: başka parsel aktifken alınan revizyon o parsel seçilmeden geri yüklenmez', () => {
  const p = proje(); alanGir(p); St.snapshot(p, 'tek'); const revTek = p.rev;
  P.ekle(p, 'B'); p.poly = kare(38.2, 27.9, 0.003, 0.003); St.snapshot(p, 'B aktif'); const revB = p.rev;
  P.sec(p, 'p1');
  const onceB = JSON.stringify(p.parseller);
  ok(!St.restoreRev(p, revB), 'B revizyonu p1 aktifken reddedildi');
  ok(St.restoreRev(p, revTek) && JSON.stringify(p.parseller) === onceB, 'p1 revizyonu p1 aktifken geri yüklendi; diğer parsel değişmedi');
});

test('PA-07 JSON yedek: çoklu parsel geometrileri korunur; eski tek parselli yedek açılır', () => {
  const p = proje(); alanGir(p); P.ekle(p, 'B'); p.poly = kare(38.2, 27.9, 0.003, 0.003); p.src = [38.2001, 27.9001];
  const yedek = JSON.stringify(St.backupPayload([p], {}, null)), geri = St.readBackup(yedek).valid[0];
  ok(geri.parseller.length === 1 && geri.parseller[0].poly.length === 4 && geri.poly.length === 4 && geri.parselAd === 'B' && geri.src[0] === 38.2001, 'parseller yedekte');
  const liste = []; St.mergeBackup(liste, [geri]); ok(liste.length === 1 && P.liste(liste[0]).length === 2, 'geri yüklendi');
  const eski = St.readBackup(JSON.stringify({ uygulama: 'IrriGrow', projects: [{ id: 'e', name: 'Eski', poly: kare(38, 27, 0.002, 0.002), inp: INP }] })).valid[0];
  ok(!P.coklu(eski) && P.liste(eski).length === 1, 'eski yedek tek parsel');
});

test('PA-08 Rapor tablosu: parsel bazlı alan, kaynak debisi, shift ve durum; proje toplamı; bağımsız hesap notu', () => {
  const p = proje(); alanGir(p); P.ekle(p, 'field2 tire'); p.poly = kare(38.09, 27.73, 0.003, 0.0025); p.src = [38.0901, 27.7301]; p.inp.Q = 30; alanGir(p);
  const oz = P.ozet(p, hesapla), T = (s, q) => q ? s.replace(/\{(\w+)\}/g, (m, k) => q[k]) : s, tb = P.raporTablosu(oz, T);
  ok(tb.rows.length === 4 && tb.rows[1][0] === 'Parsel 1' && tb.rows[2][0] === 'field2 tire *' && tb.rows[3][0] === 'Proje toplamı', 'satırlar: ' + JSON.stringify(tb.rows.map(r => r[0])));
  near(tb.rows[3][1], oz.toplam.alan_m2 / 1000, 1e-9, 'toplam alan');
  ok(tb.notlar.some(n => /ayrı hesaplanır/.test(n)) && tb.notlar.some(n => /aktif parsele/.test(n)), 'notlar');
  const RD = require(W('report-data.js'));
  globalThis.IrriParsel = P; P.ozetBelle(p, oz);
  const r = hesapla(p), b = RD.build(p, r);
  ok(b.parsel && b.ozet[0][1] === 'field2 tire' && b.ozet[2][1] === 2, 'rapor verisinde parsel bölümü ve aktif parsel');
  const tek = proje(); alanGir(tek); const bt = RD.build(tek, hesapla(tek));
  ok(!bt.parsel && bt.ozet[0][0] !== 'Aktif parsel (ayrıntılı bölümler)', 'tek parselli raporda değişiklik yok');
});

// ---------- Son kontroller: veri kaybı ve bağımsızlık regresyonları ----------
const tamProje = () => {
  const p = proje(); alanGir(p);
  Object.assign(p, { station: [38.1002, 27.7003], route: [[38.1004, 27.7005]], shiftSira: [1, 0], shiftKullaniciKarari: { not: 'A' }, katalogKalemleri: [{ urunId: 'u1', kategori: 'pompa', miktar: 1 }], ekipmanSecimi: { secim: { pompa: { urunId: 'u1' } }, katalog: {}, ad: { pompa: 'P' } }, elev: { zmin: 1 }, geoKaynak: { tur: 'kml', kotDogrulanmis: false }, hydro: { ptab: 'x' }, drawPos: { S1: [1, 2] }, techOpt: { a: 1 }, akil: { onay: { k: 1 } } });
  P.ekle(p, 'İkinci'); p.poly = kare(38.09, 27.73, 0.003, 0.0025); p.src = [38.0901, 27.7301]; p.inp.Q = 30; alanGir(p);
  Object.assign(p, { station: [38.0902, 27.7302], route: [[38.0905, 27.7305]], shiftEdit: { sig: 's2', assign: [1, 0, 1] }, katalogKalemleri: [{ tur: 'sartname', kategori: 'vana', miktar: 1 }], ekipmanSecimi: { secim: { vana: { urunId: 'v1' } }, katalog: {}, ad: { vana: 'V' } } });
  P.ekle(p, 'Üçüncü'); p.poly = kare(38.08, 27.75, 0.002, 0.002); p.src = [38.0801, 27.7501]; p.inp.Q = 20; alanGir(p);
  return p;
};
const parselHali = p => Object.fromEntries(P.liste(p).map(x => [x.id, JSON.stringify(Object.fromEntries(P.KEYS.filter(k => x.veri[k] !== undefined).map(k => [k, x.veri[k]])))]));

test('PA-09 Parsel değiştirme: sınır, kaynak, istasyon, ana hat, shift, katalog / ekipman kayıtları 40 geçişten sonra birebir korunur', () => {
  const p = tamProje(), once = parselHali(p), ad = JSON.stringify(P.liste(p).map(x => [x.id, x.ad]));
  const ids = ['p1', 'p2', 'p3'];
  for (let i = 0; i < 40; i++) P.sec(p, ids[(i * 7 + 1) % 3]);
  const sonra = parselHali(p);
  ok(ids.every(id => once[id] === sonra[id]), 'parsel verisi değişmedi');
  ok(JSON.stringify(P.liste(p).map(x => [x.id, x.ad])) === ad && p.name === 'Tire' && p.meta.cizen === 'A', 'adlar, sıra ve proje alanları değişmedi');
  // Kalıcı kayıt (JSON) ve geri okuma sonrası da aynı
  const g = St.parseProjects(JSON.stringify([p])).projects[0];
  ok(ids.every(id => parselHali(g)[id] === once[id]), 'kaydet / yükle sonrası aynı');
});

test('PA-10 Aktif parselde yapılan değişiklik (sınır, kaynak, hat, shift, ekipman, girdi, silme) diğer parselleri etkilemez', () => {
  const p = tamProje(); P.sec(p, 'p2'); const once = parselHali(p);
  p.poly.push([38.0915, 27.7315]); p.poly[0] = [38.0899, 27.7299]; p.src = [38.0903, 27.7303]; p.route.push([38.091, 27.731]); p.station = null;
  p.shiftEdit = { sig: 'yeni', assign: [0, 0, 0] }; p.ekipmanSecimi = null; p.katalogKalemleri = []; p.inp.Q = 99; p.inp.crop = 'biber';
  const sonra = parselHali(p);
  ok(sonra.p1 === once.p1 && sonra.p3 === once.p3 && sonra.p2 !== once.p2, 'yalnız aktif parsel değişti');
  ok(P.sil(p, 'p2') && parselHali(p).p1 === once.p1 && parselHali(p).p3 === once.p3, 'aktif parsel silinince diğerleri birebir korundu');
});

test('PA-11 KML/KMZ: her poligon ayrı parsel (çok parçalı yerleşim dahil); hiçbir poligon birleştirilmez; nokta parsel sayılmaz', () => {
  const K = require(W('kml.js'));
  const halka = (lat, lng, d) => `<LinearRing><coordinates>${[[lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat]].map(([x, y]) => `${x},${y},37`).join(' ')}</coordinates></LinearRing>`;
  const pg = (lat, lng, d) => `<Polygon><outerBoundaryIs>${halka(lat, lng, d)}</outerBoundaryIs></Polygon>`;
  const metin = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>
    <Placemark><name>FIELD1</name>${pg(38.10, 27.70, 0.006)}</Placemark>
    <Placemark><name>field2 tire</name>${pg(38.09, 27.715, 0.005)}</Placemark>
    <Placemark><name>Çift</name><MultiGeometry>${pg(38.08, 27.70, 0.002)}${pg(38.08, 27.71, 0.003)}</MultiGeometry></Placemark>
    <Placemark><name>Kuyu</name><Point><coordinates>27.702,38.101,0</coordinates></Point></Placemark></Document></kml>`;
  const s = K.oku(metin, 'tire.kml');
  ok(s.parseller.length === 4 && s.parseller.every(x => x.hesaplanabilir && x.halka.length === 4), 'dört ayrı 4 köşeli parsel: ' + s.parseller.map(x => x.ad + ':' + x.halka.length).join(', '));
  ok(s.notlar.some(n => n.kod === 'nokta'), 'nokta parsel değil');
  // Projeye ayrı ayrı eklenir: her parselin köşe sayısı ve alanı kaynak poligonla aynı
  const p = { id: 'k', name: 'K', poly: [], inp: Object.assign({}, INP) };
  s.parseller.forEach((x, i) => { if (i === 0) { p.poly = x.halka.map(q => [q[0], q[1]]); p.geoKaynak = K.geoKaynak(s, x); } else P.ekle(p, x.ad, { poly: x.halka.map(q => [q[0], q[1]]), geoKaynak: K.geoKaynak(s, x) }); });
  const L = P.liste(p);
  ok(L.length === 4 && L.every((x, i) => x.veri.poly.length === 4 && Math.abs(P.alanCevre(x.veri.poly).alan_m2 - s.parseller[i].alan_m2) < 1e-6), 'parseller birleştirilmeden, alanları aynen eklendi');
  // KML yüksekliği doğrulanmış kot değildir ve hesaba girmez
  ok(L.every(x => x.veri.geoKaynak.kotDogrulanmis === false && x.veri.geoKaynak.yukseklikler && !x.veri.elev && x.veri.inp.dZ == null && x.veri.inp.grad == null), 'yükseklik saklandı, kot doğrulanmamış; eğim/kot girdisi yok');
  const v = L[1].veri; alanGir(v); v.inp.Q = 30; v.src = [v.poly[0][0] + 0.0001, v.poly[0][1] + 0.0001];
  const r1 = hesapla(v), v2 = JSON.parse(JSON.stringify(v)); delete v2.geoKaynak; const r2 = hesapla(v2);
  ok(r1.ok && JSON.stringify([r1.head, r1.sel.Qj]) === JSON.stringify([r2.head, r2.sel.Qj]), 'KML yükseklikleri hidrolik sonucu değiştirmedi');
});

test('PA-12 Toplamların yöntemi açık: çakışmada alan "yaklaşık"; parsel debileri toplanmaz; ortak kaynak "doğrulanmadı"', () => {
  const p = tamProje(); const T = (s, q) => q ? s.replace(/\{(\w+)\}/g, (m, k) => q[k]) : s;
  let oz = P.ozet(p, hesapla), tb = P.raporTablosu(oz, T);
  ok(!oz.toplam.alanYaklasik && tb.rows[tb.rows.length - 1][0] === 'Proje toplamı' && tb.rows[tb.rows.length - 1][3] === '', 'çakışma yok: alan kesin; toplam satırında debi toplamı yok');
  ok(tb.notlar.some(n => /toplanmaz ve ortak pompa debisi değildir/.test(n)) && tb.notlar.some(n => /düzlem alanlarının toplamıdır/.test(n)) && tb.notlar.some(n => /ortak sistem uygunluğu anlamına gelmez/.test(n)), 'yöntem notları');
  ok(!('Q' in oz.toplam) && !('Qsys' in oz.toplam), 'toplamda debi alanı yok');
  P.sec(p, 'p3'); p.poly = kare(38.10, 27.702, 0.004, 0.003); p.src = [38.10012, 27.70012]; alanGir(p);   // p1 ile çakışan, aynı kuyulu
  oz = P.ozet(p, hesapla); tb = P.raporTablosu(oz, T);
  ok(oz.toplam.alanYaklasik && /alan yaklaşık/.test(tb.rows[tb.rows.length - 1][0]) && tb.notlar.some(n => /YAKLAŞIKTIR/.test(n)), 'çakışmada toplam alan yaklaşık olarak işaretli');
  const ortak = oz.parseller.filter(x => x.ortakKaynak).map(x => x.id).sort().join();
  ok(ortak === 'p1,p3' && oz.toplam.durum === 'eksik' && tb.rows.slice(1, -1).filter(r => /Ortak kaynak: doğrulanmadı/.test(r[7])).length === 2, 'ortak kuyulu parseller "doğrulanmadı"; proje durumu eksik');
});

test('PA-13 Yedek: aynı kimlikli farklı proje üzerine yazılmaz (kopya, bütün parseller); eski revizyon başka parseli bozmaz', () => {
  const p = tamProje(), mevcut = JSON.parse(JSON.stringify(p));
  const yedektek = JSON.parse(JSON.stringify(p)); P.sec(yedektek, 'p1'); yedektek.poly = yedektek.poly.slice(0, 3);
  const liste = [mevcut]; St.mergeBackup(liste, [yedektek]);
  ok(liste.length === 2 && JSON.stringify(liste[0]) === JSON.stringify(mevcut) && P.liste(liste[1]).length === 3, 'mevcut proje korundu, yedek bütün parselleriyle kopya');
  // Revizyon: p3 aktifken alınan revizyon, p1 aktifken geri yüklenemez; p1 revizyonu yalnız p1'i değil tüm durumu (parseller dahil) tutarlı getirir
  P.sec(p, 'p3'); St.snapshot(p, 'p3'); const r3 = p.rev; P.sec(p, 'p1'); St.snapshot(p, 'p1'); const r1 = p.rev, h1 = parselHali(p);
  p.poly = []; P.sec(p, 'p2'); p.src = null; P.sec(p, 'p1');
  ok(!St.restoreRev(p, r3), 'başka parselin revizyonu reddedildi');
  ok(St.restoreRev(p, r1) && ['p1', 'p2', 'p3'].every(id => parselHali(p)[id] === h1[id] || (id === 'p1' && JSON.parse(parselHali(p).p1).poly.length === 4)), 'revizyon bütün parselleri tutarlı geri getirdi');
});

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

// 1.0.1 Shift Yönetimi (A+B): sıra/atama yardımcıları, motordan okunan özet, önce/sonra karşılaştırması,
// hedef debinin ve çalışma sırasının hidrolik hesabı değiştirmemesi, rapor sırası ve revizyon/yedek davranışı.
const { E, test, ok, near, W } = require('./_lib');
const HV = require(W('hydro-view.js'));
const SY = require(W('shift-yonetimi.js'));
const RD = require(W('report-data.js'));
const St = require(W('store.js'));
const DICT = require(W('i18n-dict.js'));
const AS = require(W('assess.js'));

const inp = { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, srcType: 'kuyu', depth: 40, region: 'akdeniz' };
const proj = (extra = {}) => Object.assign({ name: 'SY', inp: Object.assign({}, inp) }, extra);
const oz = (r, p = proj()) => SY.ozet(r, HV.build(r, { inp: r.inp || inp, Qsource: inp.Q }), AS.forProject(p, r));

test('SY-01 Çalışma sırası ve alt ünite taşıma yardımcıları', () => {
  ok(SY.siraGecerli([2, 0, 1], 3) && !SY.siraGecerli([0, 0, 1], 3) && !SY.siraGecerli([0, 1], 3) && !SY.siraGecerli(null, 2) && !SY.siraGecerli([0, 1.5], 2), 'permütasyon denetimi');
  ok(SY.siraOf(null, 3).join() === '0,1,2' && SY.siraOf([1, 0], 3).join() === '0,1,2' && SY.siraOf([2, 1, 0], 3).join() === '2,1,0', 'geçersiz sıra varsayılana döner');
  ok(SY.siraTasi([0, 1, 2], 0, 1).join() === '1,0,2' && SY.siraTasi([0, 1, 2], 0, -1).join() === '0,1,2' && SY.siraTasi([0, 1, 2], 2, 1).join() === '0,1,2', 'yukarı/aşağı, uçlarda değişmez');
  ok(SY.siraUyar([1, 0], 3) === null && SY.siraUyar([1, 0], 2).join() === '1,0', 'shift sayısı değişince sıra düşer');
  ok(SY.ataTasi([0, 0, 1, 1], 0, 2).join() === '2,0,1,1' && SY.ataTasi([0, 1, 1], 0, 1).join() === '0,0,0', 'yeni shift ve boşalan shift numarası sıkıştırılır');
  near(SY.hedefSapma(55, 50), 10, 1e-12, 'hedef sapması'); ok(SY.hedefSapma(50, null) === null, 'hedef yoksa sapma yok');
  ok(SY.hedefOku('') === null && SY.hedefOku('12,5') === 12.5 && Number.isNaN(SY.hedefOku('-3')) && Number.isNaN(SY.hedefOku('abc')), 'hedef giriş ayrıştırma');
});

test('SY-02 Özet yalnız motor sonucundan okunur (debi, hız, H, pompa, süre, uyarı sayıları)', () => {
  const r = E.design(inp), o = oz(r);
  ok(o && o.Ns === r.sectors.Ns && o.shifts.length === r.sel.groups.length, 'shift sayısı');
  near(o.Qmax, r.sectors.Qsec, 1e-12, 'en büyük shift debisi'); near(o.Qtoplam, r.sectors.Qfield, 1e-12, 'toplam debi');
  near(o.Hmax, r.main.sel.Hmax, 1e-12, 'H maks.'); near(o.vMain, Math.max(...r.main.net.filter(x => x.kind !== 'kaynak').map(x => x.v)), 1e-12, 'ana hat hızı');
  near(o.tur, r.schedule.cycleHours, 1e-12, 'tur'); near(o.dur, r.schedule.t, 1e-12, 'süre');
  o.shifts.forEach((s, j) => { near(s.Q, r.sel.Qj[j], 1e-12, 'shift debisi ' + j); near(s.H, r.main.sel.H[j], 1e-12, 'shift H ' + j); ok(s.units.length === r.sel.groups[j].length, 'vanalar ' + j); });
  if (r.pump.need) { near(o.pompa.Q, r.pump.Q, 1e-12, 'pompa Q'); near(o.pompa.H, r.pump.H, 1e-12, 'pompa H'); }
  const A = AS.forProject(proj(), r); ok(o.uygunsuz === A.count.uygunsuz && o.uyari === A.count.uyari, 'uyarı sayıları');
  ok(SY.karsilastir(o, oz(r)).every(x => x.yon === 'ayni') && !SY.degisti(SY.karsilastir(o, o)), 'aynı düzen: fark yok');
});

test('SY-03 Önizleme: başka shift sayısı ve elle atama aynı E.design çağrısıyla; karşılaştırma yönleri doğru', () => {
  const r0 = E.design(inp), o0 = oz(r0);
  const alt = r0.sectorAlts.find(a => !a.manual && a.Ns !== r0.sectors.Ns && a.Ns > r0.sectors.Ns);
  ok(alt, 'daha çok shiftli alternatif var');
  const r1 = E.design(Object.assign({}, inp, { Ns: alt.Ns })), o1 = oz(r1);
  ok(r1.ok && o1.Ns === alt.Ns, 'önizleme shift sayısı');
  near(o1.Qmax, alt.Qmax, 1e-9, 'önizleme en büyük debi = alternatif tablosundaki değer');
  const rows = SY.karsilastir(o0, o1), q = rows.find(x => x.k === 'Qmax');
  ok(q.fark < 0 && q.yon === 'iyi' && rows.find(x => x.k === 'Ns').yon === 'ayni' && SY.degisti(rows), 'daha çok shift → daha küçük debi (iyi)');
  // Elle atama: ilk alt üniteyi yeni bir shift'e taşı
  const assign = SY.ataTasi(SY.atamaOf(r0), 0, r0.sel.groups.length);
  const rm = E.design(inp, null, { manual: { sig: r0.layout.sig, assign } });
  ok(rm.ok && rm.sel.manual && rm.sel.groups.length === r0.sel.groups.length + 1 && rm.sel.groups.some(g => g.length === 1 && g[0] === 0), 'elle atama motorda uygulanır');
  ok(oz(rm).manual === true, 'özet elle düzeni bildirir');
});

test('SY-04 Hedef debi ve çalışma sırası hidrolik hesabı değiştirmez; rapor sırası yalnız sıra varken değişir', () => {
  const r = E.design(inp), n = r.sel.groups.length;
  const p0 = proj(), p1 = proj({ shiftSira: SY.siraVarsayilan(n).reverse(), shiftHedef: 30 });
  const a = JSON.stringify(E.design(p0.inp)), b = JSON.stringify(E.design(p1.inp));
  ok(a === b, 'motor sonucu aynı');
  const T0 = RD.build(p0, r), T1 = RD.build(p1, r);
  ok(JSON.stringify(T0.hidrolik) === JSON.stringify(T1.hidrolik), 'hidrolik tablo aynı');
  ok(T0.sektor[0].length === 4 && T0.sektorDec.length === 4 && T0.sektorPdf.w.length === 4, 'sırasız proje: tablo değişmez (4 sütun)');
  ok(T1.sektor[0].length === 5 && T1.sektor.slice(1).map(x => x[1]).join() === p1.shiftSira.map(j => j + 1).join() && T1.sektor.slice(1).map(x => x[0]).join() === SY.siraVarsayilan(n).map(i => i + 1).join(), 'rapor çalışma sırasıyla');
  T1.sektor.slice(1).forEach(row => { const j = row[1] - 1; near(row[3], r.sel.Qj[j], 1e-12, 'satır debisi'); near(row[4], r.main.sel.H[j], 1e-12, 'satır H'); });
  ok(T1.ozet.some(x => /Hedef shift debisi/.test(x[0]) && x[1] === 30) && !T0.ozet.some(x => /Hedef shift debisi/.test(x[0])), 'hedef yalnız girilmişse raporda');
  // Varsayılan sıra veya geçersiz sıra → rapor değişmez
  for (const s of [SY.siraVarsayilan(n), [0], [0, 0]]) ok(RD.build(proj({ shiftSira: s }), r).sektor[0].length === 4, 'geçersiz/varsayılan sıra: ' + JSON.stringify(s));
});

test('SY-05 Revizyon ve yedek: çalışma sırası ve hedef debi taşınır; eski revizyon bu alanları silmez', () => {
  const p = proj({ id: 'x', rev: 0, revs: [], shiftSira: [1, 0], shiftHedef: 20 });
  St.snapshot(p, 'ilk'); const r1 = p.rev;
  p.shiftSira = [0, 1]; p.shiftHedef = 25; St.snapshot(p, 'iki');
  ok(St.restoreRev(p, r1) && p.shiftSira.join() === '1,0' && p.shiftHedef === 20, 'geri yükleme');
  const q = proj({ id: 'y', shiftSira: [1, 0], rev: 3, revs: [{ rev: 3, t: 1, note: '', data: JSON.stringify({ inp, poly: [], src: null }) }] });
  ok(St.restoreRev(q, 3) && q.shiftSira.join() === '1,0', 'eski revizyon mevcut sırayı korur');
  const yedek = St.backupPayload ? St.backupPayload([proj({ id: 'z', shiftSira: [1, 0], shiftHedef: 12 })]) : null;
  if (yedek) { const z = St.readBackup(JSON.stringify(yedek)).valid[0]; ok(z && z.shiftSira.join() === '1,0' && z.shiftHedef === 12, 'JSON yedek gidiş-dönüş'); }
  const m = St.migrateProject({ id: 'eski', name: 'Eski', inp: { crop: 'domates' } });
  ok(!('shiftSira' in m) && !('shiftHedef' in m) && !('shiftGeriAl' in m), 'eski proje taşınırken yeni alan eklenmez');
});

test('SY-06 Karşılaştırma etiketleri 7 dilde çevrili', () => {
  const miss = [];
  for (const [, label, unit] of SY.SATIR) for (const k of [label, unit].filter(x => x && !['h', 'm', 'm³/h', 'm/s', 'kW', 'kWh'].includes(x))) for (const l of ['en', 'de', 'es', 'ru', 'it', 'he', 'zh']) if (!(DICT[k] && DICT[k][l])) miss.push(l + ': ' + k);
  ok(!miss.length, miss.join('\n'));
});

test('SY-07 "Shiftleri Düzenle" yalnız W-HIZ-01 / W-POM-01 kartlarında; seçenek verilmezse uyarı kartı değişmez', () => {
  const AV = require(W('assess-view.js'));
  const r = E.design(inp), A = AS.forProject(proj(), r);
  const kodlar = A.findings.map(x => x.kod);
  ok(kodlar.includes('W-HIZ-01') || kodlar.includes('W-POM-01'), 'senaryoda ilgili bulgu var');
  const html = AV.make({ shiftYonetimi: ['W-HIZ-01', 'W-POM-01'] }).render(A);
  const btn = [...html.matchAll(/data-shiftyon="([^"]+)"/g)].map(m => m[1]);
  ok(btn.length && btn.every(k => k === 'W-HIZ-01' || k === 'W-POM-01') && btn.length === kodlar.filter(k => k === 'W-HIZ-01' || k === 'W-POM-01').length, 'düğmeler: ' + btn.join());
  ok(!/data-shiftyon/.test(AV.make({}).render(A)), 'seçenek yoksa düğme yok (eski çıktı)');
});

test('SY-08 Uygunluk: tur süresi, günlük süre ve kaynak kapasitesi proje verisiyle; hedef debi denetimde kullanılmaz', () => {
  const SC = require('./golden/scenarios'), s18 = SC.find(x => x.id.startsWith('S18'));
  const ozP = (i, opt) => { const r = E.design(i, null, opt); return SY.ozet(r, HV.build(r, { inp: i, Qsource: i.Q }), AS.forProject({ inp: i }, r)); };
  const o5 = ozP(s18.inp, s18.opt), L5 = SY.uygunluk(o5, s18.inp.Q, s18.inp);
  ok(!SY.uygunMu(L5) && L5.genel === 'varsayimla' && L5.varsayilan === true, '5 shift: günlük süre girilmediği için yalnız varsayımla uygun (doğrulanmadı)');   // 1.0.1 düzeltmesi: varsayımlı veri uygun sayılmaz
  const i12 = Object.assign({}, s18.inp, { Ns: 12 }), o12 = ozP(i12, s18.opt), L12 = SY.uygunluk(o12, i12.Q, i12);
  const by = k => L12.find(x => x.k === k);
  near(o12.tur, 23.023, 0.01, '12 shift tur'); ok(by('tur').ok === false && by('gunluk').ok === false && by('tur').sinir === 20, '23 h tur 20 h sınırını aşar');
  ok(by('kaynak').ok === true && !SY.uygunMu(L12), 'kaynak debisi uygun ama düzen bütünüyle uygun değil');
  ok(o12.feasible === false && by('tur').ok === o12.feasible, 'motorun ölçütüyle aynı');
  // Kullanıcı günlük süreyi 24 h girerse aynı 12 shift tur sınırına sığar
  const i24 = Object.assign({}, i12, { hours: 24 }), L24 = SY.uygunluk(ozP(i24, s18.opt), i24.Q, i24);
  ok(L24.find(x => x.k === 'tur').ok && L24.find(x => x.k === 'tur').sinir === 24 && !L24.varsayilan, '24 h girilince uygun');
  // Kapasite: günlük gereken hacim = toplam debi × süre ÷ aralık
  near(by('kapasite').deger, o12.Qtoplam * o12.dur / o12.aralik, 1e-9, 'günlük hacim'); near(by('kapasite').sinir, i12.Q * 20, 1e-9, 'kaynak kapasitesi');
  // Elle düzen kaynak debisini aşarsa 'kaynak' uygunsuz
  const r0 = E.design(s18.inp, null, s18.opt), tek = r0.units.map(() => 0);
  const om = ozP(s18.inp, Object.assign({ manual: { sig: r0.layout.sig, assign: tek } }, s18.opt));
  ok(SY.uygunluk(om, s18.inp.Q, s18.inp).find(x => x.k === 'kaynak').ok === false, 'tek shift kaynak debisini aşar');
  // Hedef debi: uygunluk ve özet hedeften bağımsız (fonksiyon hedef almaz; proje alanı hesaba girmez)
  ok(JSON.stringify(SY.uygunluk(o12, i12.Q, Object.assign({}, i12, { shiftHedef: 999 }))) === JSON.stringify(L12), 'hedef debi denetimi değiştirmez');
  ok(JSON.stringify(ozP(Object.assign({}, i12), s18.opt)) === JSON.stringify(o12), 'özet aynı');
  ok(SY.uygunluk(o12, null, i12).find(x => x.k === 'kaynak').ok === null, 'kaynak debisi yoksa denetim belirsiz (uygun sayılmaz/aşılmış sayılmaz)');
  const miss = []; for (const x of L12) for (const k of [x.ad, x.not, x.birim]) for (const l of ['en', 'de', 'es', 'ru', 'it', 'he', 'zh']) if (!['h', 'm³/h'].includes(k) && !(DICT[k] && DICT[k][l])) miss.push(l + ': ' + k);
  for (const l of ['en', 'de', 'es', 'ru', 'it', 'he', 'zh']) if (!(DICT['Günlük çalışma süresi girilmedi: varsayılan değer kullanıldı'] || {})[l]) miss.push(l);
  ok(!miss.length, miss.join('\n'));
});

// ---------- 1.0.1 hata düzeltmesi (cihaz testi, Hata 2): panelin uygunluk sonucu resmî değerlendirmeyle aynı olmalı ----------
const BUYUK = (() => { const lat = 37, lng = 35; return { inp: { crop: 'domates', geom: 'parsel', Q: 120, srcType: 'kuyu', depth: 40, region: 'akdeniz' },
  opt: { poly: [[lat, lng], [lat, lng + 0.0075], [lat + 0.0021, lng + 0.0078], [lat + 0.0027, lng + 0.0012], [lat + 0.0012, lng - 0.0006]], src: [lat - 0.0005, lng - 0.0005] } }; })();
const ozA = (i, opt) => { const r = E.design(i, null, opt); return SY.ozet(r, HV.build(r, { inp: i, Qsource: i.Q }), AS.forProject({ inp: i }, r)); };

test('SY-09 Uygunluk: resmî değerlendirmedeki uygunsuz bulgu (W-PN-02) ve işletme payı (W-KAP-02) panelde de görünür; eksik/varsayımlı veri "uygun" sayılmaz', () => {
  // 9 shift: tur 17,3 h ≤ 20 h ama W-PN-02 (pompa kapama basıncı > PN) uygunsuz → panel "uygun" diyemez
  const i9 = Object.assign({}, BUYUK.inp, { Ns: 9, hours: 20 }), o9 = ozA(i9, BUYUK.opt), L9 = SY.uygunluk(o9, i9.Q, i9);
  ok(!SY.uygunMu(L9) && L9.genel === 'uygun-degil' && (L9.bulgular || []).includes('W-PN-02'), `9 shift: genel=${L9.genel} bulgular=${L9.bulgular}`);
  // 10 shift: tur 19,2 h, planlama sınırı %90 × 20 = 18 h → W-KAP-02 'sınırda'
  const i10 = Object.assign({}, BUYUK.inp, { Ns: 10, hours: 20 }), L10 = SY.uygunluk(ozA(i10, BUYUK.opt), i10.Q, i10);
  ok(L10.find(x => x.k === 'tur').durum === 'sinirda', '10 shift tur sınırda: ' + L10.find(x => x.k === 'tur').durum);
  // 11 shift: W-KAP-01 → tur uygun değil
  const i11 = Object.assign({}, BUYUK.inp, { Ns: 11, hours: 20 }), L11 = SY.uygunluk(ozA(i11, BUYUK.opt), i11.Q, i11);
  ok(L11.find(x => x.k === 'tur').durum === 'uygun-degil' && L11.genel === 'uygun-degil', '11 shift tur uygun değil');
  // Kaynak debisi yok → doğrulanamadı (eskiden: uygun)
  const Lq = SY.uygunluk(o9, null, i9);
  ok(!SY.uygunMu(Lq) && Lq.find(x => x.k === 'kaynak').durum === 'veri-yok' && ['dogrulanamadi', 'uygun-degil'].includes(Lq.genel), 'kaynak debisi yok: ' + Lq.genel);
  // Günlük süre girilmemiş (motor varsayılanı 20 h) → varsayımla, "uygun" değil (eskiden: uygun)
  const SC = require('./golden/scenarios'), s18 = SC.find(x => x.id.startsWith('S18'));
  const L5 = SY.uygunluk(ozA(s18.inp, s18.opt), s18.inp.Q, s18.inp);
  ok(L5.genel !== 'uygun' && L5.find(x => x.k === 'gunluk').durum === 'varsayim', 'varsayılan günlük süre: ' + L5.genel);
  // Aynı proje günlük süre girilince ve başka uygunsuz bulgu yoksa uygun
  const s18h = Object.assign({}, s18.inp, { hours: 20 }), L5h = SY.uygunluk(ozA(s18h, s18.opt), s18h.Q, s18h);
  const A5 = AS.forProject({ inp: s18h }, E.design(s18h, null, s18.opt));
  ok(SY.uygunMu(L5h) === !A5.findings.some(x => x.seviye === 'uygunsuz'), 'girilmiş veride resmî değerlendirmeyle aynı: ' + L5h.genel);
});

test('SY-10 Uygunluk tutarlılığı: bütün altın senaryolar × bütün shift seçeneklerinde panel "uygun" ⇔ resmî değerlendirmede uygunsuz bulgu yok ve veri tam', () => {
  const SC = require('./golden/scenarios'); let n = 0;
  for (const sc of SC) {
    const r0 = E.design(sc.inp, null, sc.opt || {}); if (!r0.ok) continue;
    for (const a of r0.sectorAlts.filter(x => !x.manual)) {
      const i = Object.assign({}, sc.inp, { Ns: a.Ns }), r = E.design(i, null, sc.opt || {}); if (!r.ok) continue;
      const A = AS.forProject({ inp: i }, r), o = SY.ozet(r, HV.build(r, { inp: i, Qsource: i.Q }), A), L = SY.uygunluk(o, Number(i.Q) || null, i);
      const resmi = !A.findings.some(x => x.seviye === 'uygunsuz') && !!(Number(i.Q) > 0) && i.hours != null;
      ok(SY.uygunMu(L) === resmi || (L.genel === 'sinirda' && resmi), `${sc.id} Ns=${a.Ns}: panel ${L.genel}, resmî uygun=${resmi}`);
      ok(L.find(x => x.k === 'tur').durum !== 'uygun' || r.sel.feasible, `${sc.id} Ns=${a.Ns}: tur`);
      n++;
    }
  }
  ok(n > 50, 'denenen düzen ' + n);
});

test('SY-11 Uygunluk durum ve genel sonuç metinleri 7 dilde çevrili', () => {
  const src = require('fs').readFileSync(W('app.js'), 'utf8');
  const blok = src.slice(src.indexOf('const SM_DURUM'), src.indexOf('};', src.indexOf('const SM_GENEL')));
  const metin = [...blok.matchAll(/'([^']{3,})'/g)].map(m => m[1]).filter(x => !/^(ok|warn|na|bad|uygun-degil|veri-yok)$/.test(x));
  const sy = require('fs').readFileSync(W('shift-yonetimi.js'), 'utf8');
  for (const m of sy.matchAll(/satir\('\w+', '([^']+)'[^\n]*?'(Su kaynağı[^']+|En büyük[^']+|Günlük[^']+|Tur süresi ≤[^']+|Teknik olarak[^']+)'/g)) metin.push(m[1], m[2]);
  for (const m of sy.matchAll(/'(Su kaynağı debisi girilmedi: denetlenemedi|Teknik olarak uygun; işletme payı \(planlama sınırı\) aşıldı)'/g)) metin.push(m[1]);
  const miss = []; for (const k of new Set(metin)) for (const l of ['en', 'de', 'es', 'ru', 'it', 'he', 'zh']) if (!(DICT[k] && DICT[k][l])) miss.push(l + ': ' + k);
  ok(metin.length >= 15 && !miss.length, metin.length + ' metin; eksik: ' + miss.slice(0, 8).join(' | '));
});

test('SY-12 Shift paneli gerçek alanı: alt ünite poligonlarından; toplam parsel alanına eşit; debi oranlı değerle tutarlı', () => {
  const Gm = require('./_lib').Gm, SC = require('./golden/scenarios'); let n = 0;
  for (const sc of SC) {
    const r = E.design(sc.inp, null, sc.opt || {}); if (!r.ok) continue;
    const G = SY.geoAlan(r, Gm); ok(G, sc.id + ': geometri');
    const top = G.shift.reduce((a, b) => a + b, 0);
    // Σ alt ünite alanı ≤ parsel; fark yalnız sıra aralığına sığmayan kenar şeritleri (damlatıcısız)
    ok(top <= r.field.da + 0.01 && top >= 0.98 * r.field.da, `${sc.id}: Σ shift alanı ${top} / parsel ${r.field.da}`);
    G.shift.forEach((a, j) => { const qa = r.sel.Qj[j] / r.sectors.Qfield * r.field.da; ok(Math.abs(a - qa) <= 0.05 * qa + 0.05, `${sc.id} shift ${j + 1}: geometri ${a} / debi oranı ${qa}`); });
    const L = SY.birimLateral(r, 0); ok(L.n === r.units[0].nLat && (L.enUzun == null || L.enUzun <= r.lateral.maxLen + 1e-6), sc.id + ': lateral');
    n++;
  }
  ok(n >= 15 && SY.geoAlan({ ok: false }, Gm) === null, 'senaryo ' + n);
});

// ---------- 1.0.3 PR-2: bulgu farkı, iki ayrı alan, seçili shift satırları ----------
test('SY-13 Bulgu farkı: giderilen / yeni / devam eden yalnız hesap sonucundan; kullanıcı kararı bulguyu kaldırmaz', () => {
  const Gm = require('./_lib').Gm;
  const i0 = { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, srcType: 'kuyu', depth: 40, region: 'akdeniz', slopeLong: 0, slopeShort: 0, hours: 20 };
  const oz = (i, p) => { const r = E.design(i); return SY.ozet(r, HV.build(r, { inp: i, Qsource: i.Q }), AS.forProject(p || { inp: i }, r), Gm); };
  const a = oz(i0), b = oz(Object.assign({}, i0, { Ns: 12 })), f = SY.bulguFarki(a, b);
  const k = x => x.map(y => y.kod).sort().join();
  ok(f.giderilen.some(x => x.kod === 'W-HIZ-01') && f.giderilen.some(x => x.kod === 'W-POM-01') && f.yeni.some(x => x.kod === 'W-KAP-01'), `12 shift: W-HIZ-01/W-POM-01 giderildi, W-KAP-01 yeni (${k(f.giderilen)} / ${k(f.yeni)})`);
  ok(k(f.giderilen.concat(f.devam)) === k(a.bulguListe) && k(f.yeni.concat(f.devam)) === k(b.bulguListe), 'kümeler tam');
  // "Bilinerek kabul" kararı bulguyu kaldırmaz
  const i12 = Object.assign({}, i0, { Ns: 12 }), kabul = oz(i12, { inp: i12, akil: { onay: { 'W-KAP-01': 'kabul' } } });
  ok(kabul.bulguListe.some(x => x.kod === 'W-KAP-01' && x.seviye === 'uygunsuz') && SY.bulguFarki(b, kabul).giderilen.length === 0, 'onay bulguyu kaldırmaz');
  ok(SY.bulguFarki(a, null) === null, 'eksik özet');
});

test('SY-14 Alan: gerçek geometri ve hesap alan payı ayrı; seçili shift ve günlük su ihtiyacı satırları', () => {
  const Gm = require('./_lib').Gm, SC = require('./golden/scenarios'), s18 = SC.find(x => x.id.startsWith('S18'));
  const r = E.design(s18.inp, null, s18.opt), o = SY.ozet(r, HV.build(r, { inp: s18.inp, Qsource: s18.inp.Q }), AS.forProject({ inp: s18.inp }, r), Gm);
  ok(o.alanGeo && o.alanGeo.length === o.Ns && o.alanPay.length === o.Ns, 'iki alan dizisi');
  o.alanPay.forEach((x, j) => near(x, r.sel.Qj[j] / r.sectors.Qfield * r.field.da, 1e-9, 'alan payı = debi oranı'));
  near(o.alanGeo.reduce((t, x) => t + x, 0), r.field.da, 0.01 * r.field.da, 'geometri toplamı');
  near(o.gunlukSu, r.sectors.Qfield * r.schedule.t / r.schedule.interval, 1e-9, 'günlük su');
  const i2 = Object.assign({}, s18.inp, { Ns: 7 }), r2 = E.design(i2, null, s18.opt), o2 = SY.ozet(r2, HV.build(r2, { inp: i2, Qsource: i2.Q }), AS.forProject({ inp: i2 }, r2), Gm);
  const S = SY.secSatirlar(o, o2, 1);
  ok(S.map(x => x.k).join() === 'secAlan,secQ,gunlukSu' && Math.abs(S[0].once - o.alanGeo[1]) < 1e-12 && Math.abs(S[0].sonra - o2.alanGeo[1]) < 1e-12 && Math.abs(S[1].sonra - r2.sel.Qj[1]) < 1e-12, 'seçili shift satırları motor ve geometriden');
  ok(o.alanGeo.every(x => x > 0), 'alanlar pozitif');
  // Hiçbir alan alanı motor girdisine dönüşmez: tasarım aynı
  ok(JSON.stringify(E.design(s18.inp, null, s18.opt).sel.Qj) === JSON.stringify(r.sel.Qj), 'motor sonucu aynı');
});

test('SY-15 Shift başına hedef debi: yalnız aynı shift sayısında geçerli; raporda bilgi sütunu; hesaba girmez', () => {
  ok(SY.hedefler(null, 3) === null && SY.hedefler({ Ns: 4, deger: { 0: 50 } }, 3) === null, 'geçersiz kayıt');
  const h = SY.hedefler({ Ns: 3, deger: { 0: 50, 2: 60, 5: 70, 1: -3 } }, 3);
  ok(JSON.stringify(h) === JSON.stringify({ 0: 50, 2: 60 }), 'geçerli anahtarlar: ' + JSON.stringify(h));
  ok(SY.hedefOf(h, 40, 0) === 50 && SY.hedefOf(h, 40, 1) === 40 && SY.hedefOf(null, null, 1) === null, 'shift hedefi yoksa genel hedef');
  ok(SY.esit({ hedefler: { 0: 50 } }, { hedefler: null }) === false && SY.esit({ hedefler: {} }, { hedefler: null }) === true, 'taslak karşılaştırması');
  const r = E.design(inp), n = r.sel.groups.length;
  const p = proj({ shiftHedefler: { Ns: n, deger: { 0: 33.5 } }, shiftHedef: 40 }), T0 = RD.build(proj(), r), T1 = RD.build(p, r);
  ok(T0.sektor[0].length === 4 && T1.sektor[0].length === 5 && T1.sektor[1][4] === 33.5 && T1.sektor[2][4] === 40 && T1.sektorDec.length === 5 && T1.sektorPdf.w.length === 5, 'rapor sütunu (shift 1: 33,5; diğerleri genel 40)');
  ok(JSON.stringify(T0.hidrolik) === JSON.stringify(T1.hidrolik) && JSON.stringify(E.design(p.inp).sel.Qj) === JSON.stringify(r.sel.Qj), 'hesap aynı');
  // Revizyon taşır
  const q = proj({ id: 'h', rev: 0, revs: [], shiftHedefler: { Ns: 3, deger: { 0: 10 } } }); St.snapshot(q, 'a'); const r1 = q.rev; q.shiftHedefler = { Ns: 3, deger: { 0: 20 } }; St.snapshot(q, 'b');
  ok(St.restoreRev(q, r1) && q.shiftHedefler.deger[0] === 10, 'revizyon');
});

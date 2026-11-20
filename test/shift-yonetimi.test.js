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
  ok(SY.uygunMu(L5) && L5.varsayilan === true, '5 shift uygun; günlük süre varsayılan (20 h)');
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

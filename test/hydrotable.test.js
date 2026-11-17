// Hidrolik Hesap Tablosu: Excel dosyasındaki (AUTOCAD_PROMPT_1.xlsm) değerlerle birebir karşılaştırma
const { W, E, test, near, ok } = require('./_lib');
require(W('pipelib.js'));
const HT = require(W('hydro-table.js'));

// SİSTEM sayfası ekran görüntüsündeki iki tarla (Excel'in kendi hesapladığı değerler, gösterilen hassasiyetle)
const F1 = { crop: 'ŞEFTALİ', area: 442, et: 4.5, T: 22, Sr: 5, Sp: 2.5, nl: 2, q: 1.6, Sd: 0.5, shifts: 5, target: 38 };
const F2 = { ...F1, area: 282 };
const X1 = { rate: 1.28, Qp: 16, Tp: 3.52, maxShift: 6, totalTime: 17.6, totalQ: 565.8, shiftQ: 113.2, parcels: 15, parcelA: 29.47, parcelQ: 37.72, valves: 3, shiftMax: 113.15, shiftMin: 113.15 };
const X2 = { rate: 1.28, Qp: 16, Tp: 3.52, maxShift: 6, totalTime: 17.6, totalQ: 361.0, shiftQ: 72.2, parcels: 10, parcelA: 28.20, parcelQ: 36.10, valves: 2, shiftMax: 72.19, shiftMin: 72.19 };
const dec = v => { const s = String(v); return s.includes('.') ? s.split('.')[1].length : 0; };

test('SİSTEM: Field 1 (442 da şeftali) Excel değerleriyle aynı', () => {
  const r = HT.systemField(F1);
  for (const [k, v] of Object.entries(X1)) near(r[k], v, 0.5 * Math.pow(10, -dec(v)) + 1e-9, `Field 1 ${k}`);
  ok(r.overTime === false, 'toplam süre 22 saati aşmıyor');
});
test('SİSTEM: Field 2 (282 da şeftali) Excel değerleriyle aynı', () => {
  const r = HT.systemField(F2);
  for (const [k, v] of Object.entries(X2)) near(r[k], v, 0.5 * Math.pow(10, -dec(v)) + 1e-9, `Field 2 ${k}`);
});
test('SİSTEM: tam bölünen durumda YUKARIYUVARLA kayan nokta hatasına düşmez (3,0000 → 3)', () => {
  const r = HT.systemField(F1); ok(r.valves === 3 && r.parcels === 15, `${r.valves} ${r.parcels}`);
});
test('SİSTEM: boş/hatalı girişte Excel gibi boş sonuç (EĞERHATA), çökme yok', () => {
  const e = HT.systemField({}); ok(e.rate === null && e.Tp === null && e.totalQ === null, 'boş tarla');
  const b = HT.systemField({ ...F1, Sd: 'abc' }); ok(b.bad.includes('Sd') && b.n === null, 'hatalı giriş işaretlenmeli');
  const z = HT.systemField({ ...F1, shifts: 0 }); ok(z.shiftQ === null && z.totalQ !== null, 'shift=0 → shift debisi boş');
  const o = HT.systemField({ ...F1, shifts: 8 }); ok(o.overTime === true, '8 shift × 3,52 h > 22 h işaretlenmeli');
});

// IRRIFRICT sayfası: Excel'de kayıtlı örnek satır ve hesaplanmış değerleri
test('IRRIFRICT: Excel örnek satırı (HDPE100 110 PN6, 100 m, 45 m³/h, Submain) birebir', () => {
  const r = HT.friction([{ type: 'Submain', material: 'HDPE100 110 mm', pn: 6, L: 100, Q: 45, h1: 0, h2: 0, pmin: 15 }]);
  const a = r.rows[0];
  near(a.L, 101.6, 1e-9, 'iç çap (Tablo11)'); near(a.M, 149, 0, 'C');
  near(a.N, 0.0207, 1e-12, 'sürtünme m/m'); near(a.O, 0.73, 1e-12, 'toplam kayıp'); near(a.S, 1.54, 1e-12, 'hız');
  ok(a.R === 'DN, PN matched' && a.T === 'V matched', `${a.R} / ${a.T}`);
  near(r.rows[1].J, 15.73, 1e-9, 'J4 = J3 + Q3'); near(r.required, 15.73, 1e-9, 'gerekli basınç');
  ok(r.rows[1].R === '' && r.rows[1].S === 0, 'boş satır Excel gibi');
});
test('IRRIFRICT: Hazen-Williams bağıntısı, motorun hfHW fonksiyonuyla aynı (±%0,5)', () => {
  for (const [Q, D, C] of [[45, 101.6, 149], [120, 184.6, 149], [10, 44, 149], [300, 290.8, 150]]) {
    const excel = 1.131e12 * Math.pow(Q / C, 1.852) * Math.pow(D, -4.87) / 1000;
    const eng = E.hfHW(Q / 3600, D / 1000, 1, C);
    near(excel / eng, 1, 0.005, `Q=${Q} D=${D}`);
  }
});
test('IRRIFRICT: kot zinciri, eğim, Main/Submain farkı ve hız kontrolü', () => {
  const r = HT.friction([
    { type: 'Submain', material: 'HDPE100 90 mm', pn: 6, L: 80, Q: 30, h1: 100, h2: 102, pmin: 12 },
    { type: 'Main', material: 'UPVC 110 mm', pn: 6, L: 300, Q: 60, h1: 98 },
    { type: 'Main', material: 'UPVC 63 mm', pn: 10, L: 50, Q: 25, h1: 95 },
  ]);
  const [a, b, c] = r.rows;
  near(a.K, 2.5, 1e-9, 'eğim (102-100)/80'); near(a.P, 2, 1e-9, 'kot farkı');
  near(b.I, 100, 1e-9, 'I = önceki H'); near(b.P, 2, 1e-9, 'kot farkı 2');
  near(b.J, 12 + a.Qc, 1e-9, 'basınç zinciri');
  const sub = Math.round(a.N * 80 * 0.354 * 100) / 100, mainL = Math.round(b.N * 300 * 100) / 100;
  near(a.O, sub, 1e-12, 'Submain 0,354'); near(b.O, mainL, 1e-12, 'Main faktörsüz');
  ok(c.S > 1.8 && c.T === 'V control', `63 mm'de hız ${c.S}`);
  near(r.required, c.J + c.Qc, 1e-9, 'gerekli basınç son satır');
});
test('IRRIFRICT: kütüphanede olmayan malzeme/PN uyarı verir, çökmez', () => {
  const r = HT.friction([{ type: 'Main', material: 'UPVC 110 mm', pn: 99, L: 10, Q: 20 }]);
  ok(r.warnings.length === 1 && r.rows[0].L === null && r.rows[0].N === 0, 'uyarı');
});
test('Boru kütüphanesi Excel ile aynı: 395 kayıt, 95 malzeme, HDPE100 C=149, UPVC C=150', () => {
  const lib = globalThis.IRRI_PIPELIB;
  ok(lib.length === 395 && HT.MATERIALS.length === 95, `${lib.length} ${HT.MATERIALS.length}`);
  ok(HT.lookup('HDPE100 110 mm', 6)[3] === 149 && HT.lookup('UPVC 110 mm', 6)[3] === 150, 'C');
  near(HT.lookup('UPVC 110 mm', 10)[2], 101.6, 1e-9, 'UPVC 110 PN10');
});
test('Projeden doldurma: tablo, motorun sonuçlarıyla tutarlı (shift debisi ve süre)', () => {
  const r = E.design({ crop: 'domates', area_da: 50, L: 400, W: 125, Q: 60, srcType: 'kuyu', depth: 40, region: 'akdeniz' });
  const f = HT.fieldFromProject({}, r, 'Domates'); const s = HT.systemField(f);
  near(s.Tp / (r.schedule.gross * r.field.Sr * r.field.Sp / s.Qp), 1, 0.003, 'T bitki (ET 2 ondalığa yuvarlanarak aktarılır)');
  near(s.rate, r.schedule.AR, 1e-9, 'sulama hızı = uygulama hızı');
  const seg = HT.segmentsFromShift(r, 0), fr = HT.friction(seg);
  ok(seg.length === 2 && fr.rows[0].pipeFound && fr.rows[1].pipeFound, 'kütüphanede boru bulunmalı: ' + JSON.stringify(seg.map(x => x.material + ' ' + x.pn)));
  ok(fr.required > seg[0].pmin, 'gerekli basınç > lateral giriş basıncı');
});

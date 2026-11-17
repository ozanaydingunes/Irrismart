// Girdi doğrulama ve rastgele (fuzz) dayanıklılık testleri
const { E, Vd, D, test, ok } = require('./_lib');

test('Negatif değerler alan bazında reddedilir', () => {
  for (const k of ['area_da', 'L', 'W', 'Sr', 'Sp', 'q', 'Se', 'ne', 'hNom', 'et0', 'Q', 'depth', 'dSource', 'hours', 'slopeLong', 'slopeShort', 'interval', 'kc', 'Ea']) {
    const v = Vd.validate({ crop: 'domates', [k]: -1 });
    ok(!v.ok && /negatif/.test(v.errors[k]), `${k} negatif kabul edildi`);
  }
  ok(Vd.validate({ crop: 'domates', dZ: -20 }).ok, 'kot farkı negatif olabilmeli');
});

test('Sayı ayrıştırma: virgüllü ondalık, boşluk, geçersiz metin', () => {
  ok(Vd.parseNum('1,5') === 1.5 && Vd.parseNum(' 2 ') === 2 && Vd.parseNum('') === null && Vd.parseNum(null) === null, 'temel');
  for (const s of ['abc', '1.2.3', '1,2,3', 'Infinity', '--1', '1e999', {}, [], true]) ok(Number.isNaN(Vd.parseNum(s)), `${JSON.stringify(s)} geçersiz sayılmalı`);
  ok(Number.isNaN(Vd.parseNum(Infinity)) && Number.isNaN(Vd.parseNum(NaN)), 'sonsuz/NaN');
});

test('Aralık dışı, tam sayı ve seçim kontrolleri', () => {
  ok(Vd.validate({ crop: 'domates', hours: 25 }).errors.hours, 'günde 25 saat');
  ok(Vd.validate({ crop: 'domates', ne: 2.5 }).errors.ne, 'tam sayı');
  ok(Vd.validate({ crop: 'yok' }).errors.crop, 'bilinmeyen bitki');
  ok(Vd.validate({ crop: 'domates', srcType: 'nehir' }).errors.srcType, 'bilinmeyen kaynak');
  ok(Vd.validate({ crop: 'domates', emitter: 'pc', pcMin: 20, pcMax: 10 }).errors.pcMax, 'PC aralığı');
  ok(Vd.validate({ crop: 'domates', Ea: 1.2 }).errors.Ea, 'randıman > 1');
});

test('Hatalı girdide tasarım çalışmaz, ilgili alan hatası döner', () => {
  const r = E.design({ crop: 'domates', area_da: 'elli', Q: 60 });
  ok(!r.ok && r.fieldErrors.area_da, 'metin alan');
  const r2 = E.design(null); ok(!r2.ok, 'null girdi');
  const r3 = E.design({ crop: 'domates', area_da: 50, Q: 60, geom: 'parsel' }, null, { poly: [[1, 2]] }); ok(!r3.ok && /sınır/.test(r3.err[0]), 'eksik parsel');
});

// Tekrarlanabilir rastgele üreteç
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

test('Fuzz: 1500 rastgele girdi (geçersizler dahil) — çökme yok, geçerli sonuçlar fiziksel', () => {
  const R = rng(12345), crops = Object.keys(D.CROPS);
  const pickv = (good) => { const x = R(); if (x < 0.06) return -good * R(); if (x < 0.09) return 'x' + good; if (x < 0.11) return ''; if (x < 0.13) return good * 1e6; return +(good * (0.3 + 1.7 * R())).toFixed(2); };
  let okN = 0, errN = 0;
  for (let i = 0; i < 1500; i++) {
    const inp = {
      crop: R() < 0.02 ? 'yok' : crops[Math.floor(R() * crops.length)], area_da: pickv(40), Q: pickv(50), depth: pickv(30),
      srcType: ['kuyu', 'yuzey', 'sebeke'][Math.floor(R() * 3)], pAvail: pickv(3), region: 'akdeniz', soil: ['kumlu', 'tinli', 'killi'][Math.floor(R() * 3)],
      slopeLong: R() < 0.5 ? pickv(1.5) : '', slopeShort: R() < 0.5 ? pickv(1) : '', emitter: R() < 0.3 ? 'pc' : 'normal',
      q: R() < 0.5 ? pickv(2) : '', hNom: R() < 0.3 ? pickv(10) : '', interval: R() < 0.2 ? Math.ceil(R() * 6) : '', rowDir: R() < 0.5 ? 'uzun' : 'kisa',
      dSource: R() < 0.3 ? pickv(100) : '', hours: R() < 0.2 ? pickv(16) : '',
    };
    const r = E.design(inp);
    ok(r && typeof r.ok === 'boolean', 'sonuç nesnesi yok');
    ok(!(r.err || []).some(e => /Beklenmeyen/.test(e)), `#${i} beklenmeyen hata: ${r.err} ${JSON.stringify(inp)}`);
    if (!r.ok) { errN++; ok(r.err.length > 0, 'hata mesajı boş'); continue; }
    okN++;
    const s = r.schedule;
    ok(s.net > 0 && s.gross > 0 && s.t > 0 && s.seasonM3 > 0, `#${i} negatif/sıfır sulama ihtiyacı`);
    ok(s.monthly.every(m => m.gross > 0 && Number.isFinite(m.sure)), `#${i} aylık değer`);
    ok(r.sectors.Qsec <= Number(String(inp.Q).replace(',', '.')) + 1e-6, `#${i} sektör debisi kaynak debisini aşıyor`);
    ok([r.main.sel.Hmax, r.main.Lmain, r.lateral.len, r.cost.subtotal].every(Number.isFinite), `#${i} sonlu olmayan çıktı`);
    ok(r.bom.every(b => b.miktar >= 0 && Number.isFinite(b.miktar)), `#${i} malzeme miktarı`);
  }
  ok(okN > 300 && errN > 100, `dağılım uygunsuz: ${okN} başarılı, ${errN} hatalı`);
});

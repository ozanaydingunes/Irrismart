// Parsel yerleşimi: alan, sıra uzunluğu, döndürme bağımsızlığı, düzensiz şekiller
const { E, Gm, test, near, rel, ok } = require('./_lib');

// Yerel metre koordinatlı şekli enlem/boylama çevir (Antalya civarı)
const lat0 = 36.9, lng0 = 30.7;
const toLL = (pts, deg = 0) => pts.map(p => { const [x, y] = Gm.unrot(p, deg); return Gm.fromLocal(x, y, lat0, lng0); });
const base = { crop: 'domates', Q: 60, srcType: 'kuyu', depth: 40, region: 'akdeniz', geom: 'parsel' };

test('Poligon alanı: 400×125 m dikdörtgen = 50,0 da (±%0,2)', () => {
  const f = Gm.fieldFromPolygon(toLL([[0, 0], [400, 0], [400, 125], [0, 125]], 23));
  rel(f.A, 50000, 0.002, 'alan'); rel(f.box.len, 400, 0.005, 'uzun kenar'); rel(f.box.wid, 125, 0.005, 'kısa kenar');
});

test('Dikili uzunluk ≈ alan / sıra arası (dikdörtgen, üçgen, L, U şekli; ±%4)', () => {
  const shapes = {
    dikdortgen: [[0, 0], [400, 0], [400, 125], [0, 125]],
    ucgen: [[0, 0], [500, 0], [250, 300]],
    L: [[0, 0], [300, 0], [300, 80], [120, 80], [120, 250], [0, 250]],
    U: [[0, 0], [300, 0], [300, 200], [220, 200], [220, 60], [80, 60], [80, 200], [0, 200]],
  };
  for (const [ad, pts] of Object.entries(shapes)) {
    const r = E.design(base, null, { poly: toLL(pts, 15) });
    ok(r.ok, `${ad}: ${r.err}`);
    rel(r.lateral.planted, r.field.A / 1.4, 0.04, `${ad} dikili uzunluk`);
    ok(r.lateral.maxLen <= r.lateral.Lmax + 1e-6, `${ad} lateral boyu`);
    ok(r.lateral.maxDH <= r.emitter.allowLat * 1.0001, `${ad} lateral basınç farkı`);
  }
});

test('Döndürme bağımsızlığı: aynı parsel farklı yönde çizilince sonuç aynı (±%1)', () => {
  const pts = [[0, 0], [400, 0], [400, 125], [0, 125]];
  const a = E.design(base, null, { poly: toLL(pts, 0) }), b = E.design(base, null, { poly: toLL(pts, 57) });
  ok(a.ok && b.ok, 'tasarım');
  rel(b.lateral.planted, a.lateral.planted, 0.01, 'dikili'); rel(b.sectors.Qfield, a.sectors.Qfield, 0.01, 'debi');
  ok(a.lateral.count === b.lateral.count, `lateral sayısı ${a.lateral.count} ≠ ${b.lateral.count}`);
});

test('Parsel = dikdörtgen modu ile aynı geometri → aynı lateral sayısı ve debi', () => {
  const p = E.design(base, null, { poly: toLL([[0, 0], [400, 0], [400, 125], [0, 125]], 0) });
  const d = E.design({ ...base, geom: 'dikdortgen', area_da: 50, L: 400, W: 125 });
  ok(p.ok && d.ok, 'tasarım'); ok(p.lateral.count === d.lateral.count, 'lateral sayısı'); rel(p.sectors.Qfield, d.sectors.Qfield, 0.005, 'debi');
});

test('U şeklinde (boşluk manifold hizasında) kör lateral oluşur ve malzemeye yansır', () => {
  const r = E.design({ ...base, rowDir: 'kisa' }, null, { poly: toLL([[0, 0], [100, 0], [100, 200], [70, 200], [70, 60], [30, 60], [30, 200], [0, 200]], 0) });
  ok(r.ok, r.err); ok(r.lateral.lead > 0, 'kör boru yok');
  ok(r.bom.some(b => /Kör lateral/.test(b.kalem)), 'malzemede kör lateral yok');
});

test('Kendini kesen sınır ve çok küçük parsel açık hata verir', () => {
  const x = E.design(base, null, { poly: toLL([[0, 0], [100, 100], [100, 0], [0, 100]]) });
  ok(!x.ok && /kesiyor/.test(x.err[0]), 'kendini kesen');
  const s = E.design(base, null, { poly: toLL([[0, 0], [5, 0], [5, 5]]) }); ok(!s.ok, 'küçük parsel');
});

test('Eğim düzlemi: yükseklik verisinden doğru eğim ve yön', () => {
  const ll = toLL([[0, 0], [200, 0], [200, 100], [0, 100], [100, 50]]);
  const z = [[0, 0], [200, 0], [200, 100], [0, 100], [100, 50]].map(([x, y]) => 100 + 0.02 * x - 0.01 * y);
  const s = Gm.slopeFromPoints(ll, z, 0);
  near(s.gx, 0.02, 1e-4, 'gx'); near(s.gy, -0.01, 1e-4, 'gy'); near(s.alongLong, 2, 0.01, 'uzun kenar %');
});

test('Kaynak noktası verilince ana hat uzunluğu mesafeyle artar', () => {
  const ll = toLL([[0, 0], [400, 0], [400, 125], [0, 125]]);
  const near0 = E.design(base, null, { poly: ll, src: Gm.fromLocal(-200, 125, lat0, lng0) });
  const far = E.design(base, null, { poly: ll, src: Gm.fromLocal(-200, 600, lat0, lng0) });
  ok(near0.ok && far.ok, 'tasarım');
  // Kaynaktan başlık hattına düz bağlantı: fark = iki kaynağın en yakın başlık noktasına uzaklık farkı
  const d = r => { const H = r.layout.headerPts[r.layout.headerEntry], s = r.layout.src; return Math.hypot(H[0] - s[0], H[1] - s[1]); };
  near(far.main.Lmain - near0.main.Lmain, d(far) - d(near0), 1e-6, 'ek uzunluk');
  ok(d(far) - d(near0) > 250, 'uzak kaynak belirgin şekilde daha uzun bağlantı vermeli');
});

test('Alt üniteler tüm dikili alanı kapsar ve kaynak debisinin yarısını aşmaz', () => {
  const r = E.design(base, null, { poly: toLL([[0, 0], [500, 0], [250, 300]], 10) });
  ok(r.ok, r.err);
  const cap = 30, multi = r.units.filter(u => u.rows > 1);
  ok(multi.every(u => u.Q <= cap + 1e-9), 'alt ünite debisi');
  const latRows = new Set(r.layout.laterals.map(l => l.row + ':' + l.band));
  ok(r.units.reduce((t, u) => t + u.rows, 0) === latRows.size, 'her sıra/bant bir alt ünitede');
});

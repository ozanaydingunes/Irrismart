// Faz 2: çizilen ana hat güzergâhı, istasyon, manifold hattı sayısı, elle shift ataması, yerleşim alternatifleri
const { E, test, near, ok } = require('./_lib');
const poly = [[37.0, 35.0], [37.0, 35.004], [37.002, 35.005], [37.0025, 35.001], [37.0012, 34.9995]];
const inp = { crop: 'domates', geom: 'parsel', Q: 120, srcType: 'kuyu', depth: 30, region: 'akdeniz' };
const src = [36.9990, 34.9990], station = [36.9993, 34.9994];
const R = 6371008.8, K = Math.PI / 180;
const dist = (a, b) => Math.hypot((b[1] - a[1]) * K * R * Math.cos(37 * K), (b[0] - a[0]) * K * R);

test('Çizilen ana hat güzergâhı: uzunluk ana hatta eklenir, uzun güzergâh daha yüksek basma yüksekliği verir', () => {
  const route = [[36.9996, 34.9996], [37.0001, 35.0001]];
  const r = E.design(inp, null, { poly, src, station, route });
  ok(r.ok, r.err);
  const want = dist(src, station) + dist(station, route[0]) + dist(route[0], route[1]);
  near(r.layout.routeLen, want, want * 0.002, 'güzergâh uzunluğu');
  ok(r.main.Lmain >= r.layout.routeLen - 1e-6, 'ana hat uzunluğu güzergâhı içermeli');
  const far = E.design(inp, null, { poly, src: [36.990, 34.990], route });
  ok(far.ok && far.layout.routeLen > r.layout.routeLen + 500, 'uzak kaynak');
  ok(far.main.sel.Hmax > r.main.sel.Hmax || far.main.sel.od > r.main.sel.od, 'uzun güzergâh kayıpları artırmalı');
  ok(r.asm.some(a => /güzergâhı haritada çizildi/.test(a)), 'varsayım listesinde güzergâh');
});

test('Güzergâh yoksa önceki davranış korunur (kaynak noktası araziye bağlanır)', () => {
  const r = E.design(inp, null, { poly, src });
  ok(r.ok && !r.layout.route && r.layout.routeLen === 0, 'güzergâh olmamalı');
});

test('Manifold hattı sayısı elle artırılabilir; lateraller kısalır', () => {
  const a = E.design(inp, null, { poly }), b = E.design(Object.assign({}, inp, { nB: a.layout.nB + 2 }), null, { poly });
  ok(a.ok && b.ok, 'tasarım');
  ok(b.layout.nB === a.layout.nB + 2, `hat sayısı ${b.layout.nB}`);
  ok(b.lateral.maxLen < a.lateral.maxLen, 'lateraller kısalmalı');
  near(b.sectors.Qfield, a.sectors.Qfield, a.sectors.Qfield * 0.05, 'arazi debisi benzer kalmalı');
});

test('Elle shift ataması: geçerli atama uygulanır, toplamlar korunur; kaynak aşımı işaretlenir', () => {
  const a = E.design(inp, null, { poly }); ok(a.ok, a.err);
  const n = a.units.length, assign = a.units.map((u, k) => k % 2);           // dama tahtası: 2 shift
  const b = E.design(inp, null, { poly, manual: { sig: a.layout.sig, assign } });
  ok(b.sel.manual && b.sel.groups.length === 2, 'elle düzen seçilmedi');
  near(b.sel.Qj[0] + b.sel.Qj[1], b.sectors.Qfield, 1e-6, 'Σ shift debisi');
  ok(b.sel.overSource === (b.sel.Qmax > 120 + 1e-9), 'kaynak aşımı işareti');
  if (b.sel.overSource) ok(b.warn.some(w => /kaynak debisini/.test(w)), 'kaynak aşımı uyarısı');
  const one = E.design(inp, null, { poly, manual: { sig: a.layout.sig, assign: a.units.map((u, k) => k) } });
  ok(one.sel.manual && one.sel.groups.length === n && one.sel.overSource === false, 'her ünite ayrı shift');
});

test('Elle atama yerleşim değişince düşer ve uyarı verilir', () => {
  const a = E.design(inp, null, { poly });
  const b = E.design(Object.assign({}, inp, { Sr: 1.6 }), null, { poly, manual: { sig: a.layout.sig, assign: a.units.map(() => 0) } });
  ok(b.ok && !b.sel.manual && b.warn.some(w => /geçersiz kaldı/.test(w)), 'eski atama uygulanmamalı');
});

test('Yerleşim alternatifleri: 4 gerçek tasarım, üç seçim; fiyat eksikse metraj esaslı ve kesin değil', () => {
  const A = E.layoutAlternatives(inp, null, { poly, src });
  ok(A.list.length === 4 && A.list.every(v => v.ok), 'dört varyant');
  ok(A.picks.yatirim && A.picks.enerji && A.picks.dengeli, 'üç seçim');
  const okl = A.list.filter(v => v.feasible).length ? A.list.filter(v => v.feasible) : A.list;
  ok(A.picks.enerji.kWh === Math.min(...okl.map(v => v.kWh)), 'en düşük enerji');
  ok(!A.priced && A.basis === 'metraj', 'örnek fiyatlarda eksik kalem var: kesin ekonomik sıralama olmamalı');
  ok(A.picks.yatirim.pipeLen === Math.min(...okl.map(v => v.pipeLen)), 'metraj esaslı yatırım seçimi');
  ok(A.list.every(v => v.life === null), 'eksik fiyatla 5/10/15 yıllık maliyet verilmemeli');
  ok(new Set(A.list.map(v => v.rowDir + v.latD)).size === 4, 'varyantlar farklı');
});

test('Tüm fiyatlar girilince yatırım esaslı seçim ve 5/10/15 yıllık maliyet', () => {
  const r = E.design(inp, null, { poly });
  const items = {}; r.bom.forEach(b => { items[b.key] = 10; });
  const prices = Object.assign({}, require('../www/js/data.js').DEFAULT_PRICES, { items, edited: {} });
  // diğer varyantların kalemleri için de fiyat: tüm varyantları gez
  for (const rowDir of ['uzun', 'kisa']) for (const latD of ['16', '20']) E.design(Object.assign({}, inp, { rowDir, latD }), prices, { poly }).bom.forEach(b => { items[b.key] = 10; });
  const A = E.layoutAlternatives(inp, prices, { poly });
  ok(A.priced && A.basis === 'yatirim', 'tüm fiyatlar var');
  const v = A.list[0]; near(v.life[1], v.inv + v.energyCost * 10, 1e-6, '10 yıllık');
});

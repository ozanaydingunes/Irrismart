// Katalog yapısı, seçim kuralları ve fiyat önceliği
const { E, Ct, CAT, test, near, ok } = require('./_lib');

test('Varsayılan katalog yapısal olarak geçerli; boru iç çapı = dış çap − 2·et', () => {
  ok(Ct.checkCatalog(CAT).length === 0, Ct.checkCatalog(CAT).join('; '));
  for (const p of [...CAT.borular.pe, ...CAT.borular.pvc]) near(p.ic, p.od - 2 * p.et, 0.051, p.id);
  near(CAT.borular.pe.find(p => p.id === 'pe-110-pn6').ic, 101.6, 1e-9, 'PE100 SDR26 Ø110');
});

test('Hatalı katalog kayıtları yakalanır', () => {
  const e = Ct.checkCatalog({ pompa: [{ id: 'x', tip: 'roket', motorKw: -1, egri: [[1, 2]] }], filtre: [{ tip: 'disk', qMax: 0 }], vana: [{ id: 'v', qMax: 10 }], borular: { pe: [{ od: 50, ic: 60, pn: 6 }] } });
  ok(e.length >= 6, e.join('; '));
});

test('Pompa eğrisi ara değer (doğrusal)', () => {
  const c = Ct.curveAt([[0, 50, 0], [10, 45, 60], [20, 30, 70]], 15); near(c.H, 37.5, 1e-9, 'H'); near(c.eta, 65, 1e-9, 'η');
  ok(Ct.curveAt([[0, 50, 0], [10, 45, 60], [20, 30, 70]], 25) === null, 'eğri dışı null olmalı');
});

test('Pompa seçimi: tüm görev noktaları karşılanır; imkânsız görevde aday yok', () => {
  const duties = [{ Q: 40, H: 60, hours: 500 }, { Q: 30, H: 58, hours: 500 }];
  const s = Ct.selectPump(CAT, ['dalgic'], duties); ok(s.best, 'aday bulunamadı');
  for (const d of duties) ok(Ct.curveAt(s.best.p.egri, d.Q).H >= d.H, 'basınç yetersiz');
  ok(s.best.Pmax <= s.best.p.motorKw, 'motor');
  ok(Ct.selectPump(CAT, ['dalgic'], [{ Q: 5000, H: 500, hours: 1 }]).best === null, 'imkânsız görev');
});

test('Kullanıcı kataloğu: gerçek pompa eklenip yalnız o kullanılabilir', () => {
  const user = { yalnizKullanici: { pompa: true }, pompa: [{ id: 'abc-1', marka: 'Test', model: 'T1', tip: 'dalgic', motorKw: 30, fiyat: 100000, dogrulandi: true, egri: [[0, 120, 0], [30, 105, 70], [50, 90, 76], [70, 65, 70]] }] };
  const cat = Ct.mergeCatalog(CAT, user);
  ok(cat.pompa.length === 1, 'yalnız kullanıcı pompası kalmalı');
  const r = E.design({ crop: 'domates', area_da: 50, L: 400, W: 125, Q: 60, srcType: 'kuyu', depth: 40, region: 'akdeniz' }, null, { catalog: cat });
  ok(r.ok && r.pump.fromCatalog && r.pump.id === 'abc-1' && r.pump.verified, 'kullanıcı pompası seçilmedi');
  const row = r.bom.find(b => b.grup === 'Pompa'); ok(row.fiyat === 100000 && row.kaynak === 'katalog', 'katalog fiyatı');
});

test('Filtre: debiye göre adet, kum filtresi en az 2 tank, kayıp ∝ Q²', () => {
  const f = Ct.selectFilter(CAT, 'yuzey', '', 100);
  const kum = f.items.find(i => i.f.tip === 'kum'); ok(kum.n === 3, 'kum tank adedi');
  const f2 = Ct.selectFilter(CAT, 'yuzey', '', 10); ok(f2.items.find(i => i.f.tip === 'kum').n === 2, 'en az 2 tank');
  const d = Ct.selectFilter(CAT, 'kuyu', 'temiz', 25);
  near(d.loss(25) - d.loss(12.5), 3 * (1 - 0.25), 1e-9, 'kayıp ∝ Q²');
});

test('Vana: kapasiteye göre seçim, kayıp = 10,2·(Q/Kv)²', () => {
  const v = Ct.selectValve(CAT, 30); ok(v.v.cap === '3"', v.v.cap); near(v.loss(30), 10.2 * Math.pow(30 / 112, 2), 1e-9, 'kayıp');
});

test('Fiyat önceliği: kullanıcı > katalog > örnek ayar > yok', () => {
  const s = { pvc: { 110: 150 }, items: {}, edited: {} };
  ok(Ct.priceOf(s, 'pvc:110:6').src === 'ornek', 'örnek');
  ok(Ct.priceOf({ ...s, edited: { 'pvc.110': true } }, 'pvc:110:6').src === 'kullanici', 'düzenlenmiş');
  ok(Ct.priceOf({ ...s, items: { 'pvc:110:6': 99 } }, 'pvc:110:6').v === 99, 'kalem fiyatı');
  ok(Ct.priceOf(s, 'vana:x', { fiyat: 500 }).src === 'katalog', 'katalog');
  ok(Ct.priceOf(s, 'pvc:110:6', { fiyat: 170 }).v === 170, 'katalog fiyatı örnek ayarın önünde');
  ok(Ct.priceOf({ ...s, edited: { 'pvc.110': true } }, 'pvc:110:6', { fiyat: 170 }).v === 150, 'kullanıcı ayarı katalogun önünde');
  ok(Ct.priceOf(s, 'vana:x', { fiyat: null }).v === null, 'fiyat yok');
});

test('Malzeme: fiyatsız kalem varsa toplam verilmez; tüm fiyatlar girilince verilir', () => {
  const inp = { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 60, srcType: 'kuyu', depth: 40, region: 'akdeniz' };
  const r = E.design(inp); ok(r.cost.total === null && r.cost.missing > 0, 'eksik fiyatla toplam');
  const items = {}; r.bom.forEach(b => { items[b.key] = 10; });
  const r2 = E.design(inp, { ...globalThis.IRRI_DATA.DEFAULT_PRICES, items });
  ok(r2.cost.missing === 0 && r2.cost.total > 0, 'tam fiyatla toplam yok: ' + r2.bom.filter(b => b.fiyat == null).map(b => b.key));
  near(r2.cost.total, r2.bom.filter(b => !b.opsiyonel).reduce((t, b) => t + b.tutar, 0), 1e-6, 'toplam');
});

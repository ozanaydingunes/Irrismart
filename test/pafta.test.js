// A3 pafta yerleşimi: otomatik ölçek bütün geometriyi çizim alanına sığdırır, kırpmaz, ortalar; ölçek çubuğu dönüşümle tutarlı.
// Hata (düzeltme öncesi): ölçek listesi 1:5000'de bitiyordu; uzak su kaynağı/uzun ana hatta çizim sessizce 1:5000'de kalıyor,
// geometri merkezine ortalandığı için parsel kayıyor, ana hat ve kaynak çizim alanının dışına taşıp kırpılıyordu.
const { E, test, ok, W } = require('./_lib');
const Dr = require(W('drawing.js'));
const K = require(W('kml.js'));

const proje = (poly, src, extra = {}) => ({ name: 'Pafta testi', inp: Object.assign({ crop: 'domates', geom: 'parsel', Q: 120, srcType: 'kuyu', depth: 30, region: 'akdeniz' }, extra.inp || {}), poly, src, station: extra.station || null, route: extra.route || null });
function pafta(p, o = {}) {
  const r = E.design(p.inp, null, { poly: p.poly, src: p.src, station: p.station, route: p.route });
  ok(r.ok, 'hesap: ' + (r.err || []).join(' | '));
  const M = Dr.build(p, r), S = Dr.sheet(M, Object.assign({ format: 'A3', orient: 'yatay', scale: 'auto' }, o));
  return { r, M, S };
}
// Çizim alanı (kırpma dikdörtgeni) içinde mi: ana hat, parsel, kaynak, shift vanaları
function kritikNoktalar(M) {
  return [...M.parcel, ...M.main.filter(s => !s.virtual).flatMap(s => [s.a, s.b]), ...M.eq.filter(e => ['kaynak', 'pompa', 'shiftvana', 'filtre'].includes(e.type)).map(e => e.at), ...M.units.flatMap(u => [u.a, u.b])];
}
function denetle(ad, { M, S }) {
  const clip = S.prims.find(p => p.t === 'clip');
  const icinde = ([x, y]) => { const X = S.X(x), Y = S.Y(y); return X >= clip.x0 - 1e-6 && X <= clip.x1 + 1e-6 && Y >= clip.y0 - 1e-6 && Y <= clip.y1 + 1e-6; };
  const disari = kritikNoktalar(M).filter(q => !icinde(q));
  ok(!disari.length, `${ad}: ${disari.length} kritik nokta çizim alanı dışında (ölçek 1:${S.scale})`);
  ok(clip.x1 <= S.area.x1 && clip.x0 >= S.area.x0 && clip.y1 <= S.area.y1, `${ad}: çizim alanı bilgi panelinin üzerine taşıyor`);
  // En-boy oranı: x ve y aynı ölçekle (mm/m)
  const k = S.view.k; ok(Math.abs((S.X(100) - S.X(0)) - 100 * k) < 1e-9 && Math.abs((S.Y(0) - S.Y(100)) - 100 * k) < 1e-9 && Math.abs(k - 1000 / S.scale) < 1e-12, `${ad}: en-boy/ölçek dönüşümü`);
  // Ölçek çubuğu: dört parça toplamı = etiket (m) × k
  const bar = S.prims.filter(p => p.t === 'rect' && p.h === 1.2), etiket = S.prims.find(p => p.t === 'text' && / m$/.test(p.txt) && p.txt !== '0' && Math.abs(p.y - (bar[0] && bar[0].y - 0.8)) < 1);
  ok(bar.length === 4 && etiket, `${ad}: ölçek çubuğu yok`);
  const L = bar.reduce((t, b) => t + b.w, 0); ok(Math.abs(L - parseFloat(etiket.txt) * k) < 1e-6, `${ad}: ölçek çubuğu ${L} mm ≠ ${etiket.txt} × ${k}`);
  ok(S.prims.some(p => p.t === 'text' && p.txt.includes(`1:${S.scale}`)), `${ad}: pafta ölçek yazısı`);
  // Ortalama ve alan kullanımı
  const b = M.bbox, cx = (S.X(b.x0) + S.X(b.x1)) / 2, cy = (S.Y(b.y0) + S.Y(b.y1)) / 2;
  ok(Math.abs(cx - (clip.x0 + clip.x1) / 2) < 0.5 && Math.abs(cy - (clip.y0 + clip.y1) / 2) < 0.5, `${ad}: çizim ortalanmamış`);
  const doluluk = Math.max(b.w * k / (clip.x1 - clip.x0), b.h * k / (clip.y1 - clip.y0));
  ok(doluluk >= 0.45 && doluluk <= 1 + 1e-9, `${ad}: çizim alanı kullanımı %${Math.round(doluluk * 100)}`);
  return { scale: S.scale, doluluk };
}

const kare = (lat, lng, dLat, dLng) => [[lat, lng], [lat, lng + dLng], [lat + dLat, lng + dLng], [lat + dLat, lng]];
const SENARYO = {
  'dikdörtgen parsel': proje(kare(37.0, 35.0, 0.0025, 0.004), [36.9998, 34.9998]),
  'çok köşeli düzensiz parsel': proje([[37.0, 35.0], [37.0, 35.004], [37.002, 35.005], [37.0025, 35.001], [37.0018, 35.0004], [37.0012, 34.9995], [37.0006, 35.0002]], [36.999, 34.999], { station: [36.9993, 34.9994], route: [[36.9996, 34.9996], [37.0001, 35.0001]] }),
  'uzun ve dar parsel': proje(kare(37.0, 35.0, 0.0006, 0.012), [36.9998, 34.9999]),
  'parsel dışına uzanan kaynak ve ana hat': proje(kare(37.0, 35.0, 0.002, 0.003), [36.992, 35.012]),
  'çok shiftli büyük proje': proje(kare(37.0, 35.0, 0.006, 0.008), [36.9995, 34.9995], { inp: { Q: 60 } }),
};
const KML = `<kml><Placemark><name>Tarla</name><Polygon><outerBoundaryIs><LinearRing><coordinates>35,37 35.0035,37.0002 35.0042,37.0021 35.0019,37.0028 34.9998,37.0016 35,37</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>`;
SENARYO['KML ile içe aktarılan parsel'] = proje(K.oku(KML).parseller[0].halka, [36.9997, 34.9997]);

test('PF-01 Altı senaryoda A3 yatay pafta: kritik geometri çizim alanında, panel üzerine taşma yok, en-boy ve ölçek çubuğu tutarlı, ortalı', () => {
  for (const [ad, p] of Object.entries(SENARYO)) denetle(ad, pafta(p));
});

test('PF-02 Parselden çok uzak su kaynağı: ölçek 1:5000’in altına iner, hiçbir şey kırpılmaz, uzak kaynak bildirilir', () => {
  for (const [ad, src] of [['1,5 km', [36.99, 35.016]], ['4 km', [36.97, 35.03]], ['12 km', [36.92, 35.09]]]) {
    const R = pafta(proje(kare(37.0, 35.0, 0.002, 0.003), src));
    const d = denetle('uzak kaynak ' + ad, R);
    ok(R.S.scale > 5000 && R.S.uzakKaynak && R.S.parselOlcek && R.S.parselOlcek * 2.5 <= R.S.scale, `uzak kaynak ${ad}: 1:${d.scale}, parsel 1:${R.S.parselOlcek}, uzak=${R.S.uzakKaynak}`);
  }
  // Kaynak parsele yakınsa not yok
  ok(!pafta(SENARYO['dikdörtgen parsel']).S.uzakKaynak, 'yakın kaynakta uzak kaynak notu çıkmamalı');
});

test('PF-03 Dikey A3 ve A4/A1 biçimleri; elle seçilen ölçek ve çoklu pafta değişmedi', () => {
  for (const o of [{ orient: 'dikey' }, { format: 'A4' }, { format: 'A1' }]) denetle('uzak kaynak ' + JSON.stringify(o), pafta(proje(kare(37.0, 35.0, 0.002, 0.003), [36.992, 35.012]), o));
  const R = pafta(SENARYO['parsel dışına uzanan kaynak ve ana hat'], { scale: 1000 });
  ok(R.S.scale === 1000 && R.S.fits === false && R.S.need.w > R.S.area.x1 - R.S.area.x0, 'elle 1:1000 seçimi korunur ve sığmadığı bildirilir');
  const Rm = pafta(SENARYO['parsel dışına uzanan kaynak ve ana hat'], { scale: 1000, multi: true });
  ok(Rm.S.scale === 1000 && Rm.S.tiles.n > 1, 'çoklu pafta sayısı verilir');
  ok(Dr.SCALES.slice(0, 5).join() === '500,1000,2000,4000,5000', 'mevcut ölçekler aynı (altın kayıtlar değişmez)');
});

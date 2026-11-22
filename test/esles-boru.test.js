// Akıllı ekipman seçimi — boru eşleştirme aşama 1
const { E, Hy, test, ok, W } = require('./_lib');
const fs = require('fs');
const U = require(W('katalog-urun.js')), B = require(W('esles-boru.js'));
const inp = { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, srcType: 'kuyu', depth: 40, region: 'akdeniz' };
const K = s => ({ katalogId: 'kat_test', sayfa: s, hamMetin: 'test', yontem: 'elle' });
// Sentetik ürün (test verisi; gerçek katalog ürünü değil): değerler incelenmiş, ürün mühendislik denetiminden geçirilmiş
function boru(uretici, od, e, pn, malzeme, { dogrula = true, eksik = [] } = {}) {
  let u = U.yeniUrun({ uretici, model: `${malzeme} ${od}×${e} PN${pn}`, urunKodu: `${uretici}-${od}-${pn}`, katalogId: 'kat_test', kategori: 'boru' });
  const ds = [['dis_cap', od, 'mm'], ['et_kalinligi', e, 'mm'], ['pn', pn, 'bar'], ['malzeme', malzeme, '']].filter(x => !eksik.includes(x[0]))
    .map(([ad, deger, birim], i) => Object.assign(U.yeniDeger({ urunId: u.id, ad, deger, birim, kaynak: K(10 + i) }).deger, { inceleme: 'kullanici-onayladi' }));
  u = U.incele(u, 'kullanici-onayladi');
  if (dogrula) { const den = U.muhendislikDenetle(u, ds, []); if (!den.gecti) throw new Error('test ürünü denetimden geçmedi: ' + JSON.stringify(den.kurallar)); u = U.muhendislikOnayla(u, den, 'Test mühendisi'); }
  return { u, ds };
}
const topla = list => ({ urunler: list.map(x => x.u), degerler: list.flatMap(x => x.ds) });

test('EB-01 Segment gereksinimleri motor sonucundan aynen okunur; motor sonucu değişmez', () => {
  const r = E.design(inp), once = JSON.stringify(r), g = B.gereksinimler(r);
  ok(g && g.segmentler.length >= 1 && g.segmentler.every(s => s.Qmax > 0 && s.L > 0 && s.od > 0), 'segmentler');
  const s0 = r.main.net.find(s => s.id === g.segmentler[0].id);
  ok(g.segmentler[0].Qmax === s0.Qmax && g.segmentler[0].hf === s0.hf, 'aynı debi ve kayıp');
  ok(Math.abs(g.basincGerek_m - Math.max(1.25 * r.main.sel.Pop, r.main.sel.Pshut, r.pump.Pshut || 0)) < 1e-9, 'motorla aynı basınç ölçütü');
  ok(JSON.stringify(r) === once, 'motor sonucu değişmedi');
});

test('EB-02 İç çapla hız ve sürtünme kaybı motorla aynı işlevle; PN ve hız ölçütü motorla aynı', () => {
  const r = E.design(inp), g = B.gereksinimler(r), seg = g.segmentler[0];
  const veri = topla([boru('Üretici A', 90, 5.4, 10, 'PE100'), boru('Üretici B', 90, 4.3, 8, 'PE100')]);
  const al = B.alternatifler(r, veri.urunler, veri.degerler).segmentler[0];
  const x = [...al.uygun, ...al.uygunDegil].find(z => z.hesap && z.hesap.e === 5.4);
  ok(x && Math.abs(x.hesap.ic - 79.2) < 1e-9, 'iç çap = 90 − 2 × 5,4');
  ok(Math.abs(x.hesap.v - Hy.velocity(seg.Qmax, 79.2)) < 1e-12 && Math.abs(x.hesap.hf - Hy.hfHW(seg.Qmax / 3600, 0.0792, seg.L) * 1.10) < 1e-12, 'hız ve kayıp motor işleviyle');
  for (const z of [...al.uygun, ...al.uygunDegil]) {
    const pnOk = z.hesap.pn * 10.2 >= g.basincGerek_m - 1e-9, vOk = z.hesap.v <= 2.0 + 1e-9;
    ok((z.durum === 'uygun') === (pnOk && vOk), `${z.model}: sınıflandırma ölçütü (${z.durum})`);
  }
});

test('EB-03 Doğrulanmamış veya eksik verili ürün uygun listesine girmez; örnek veri hiç önerilmez', () => {
  const r = E.design(inp);
  const v = topla([boru('Doğrulanmış', 110, 6.6, 10, 'PE100'), boru('Yalnız kullanıcı onaylı', 110, 6.6, 10, 'PE100', { dogrula: false }), boru('Eksik', 110, 6.6, 10, 'PE100', { dogrula: false, eksik: ['et_kalinligi'] })]);
  const o = U.ornekVeri('kat_ornek'); v.urunler.push(...o.urunler); v.degerler.push(...o.degerler);
  const s = B.alternatifler(r, v.urunler, v.degerler).segmentler[0];
  ok(s.uygun.every(x => x.uretici === 'Doğrulanmış'), 'uygun yalnız doğrulanmış');
  ok(s.eksik.some(x => x.uretici === 'Yalnız kullanıcı onaylı' && x.neden.some(n => /kullanıcı incelemesi yeterli değildir/.test(n))), 'kullanıcı onayı yetmez');
  ok(s.eksik.some(x => x.uretici === 'Eksik' && x.neden.some(n => /et kalınlığı/.test(n))), 'eksik değer açıkça belirtilir');
  ok(![...s.uygun, ...s.eksik, ...s.uygunDegil].some(x => /ÖRNEK/.test(x.uretici)), 'örnek veri önerilmez');
});

test('EB-04 Farklı üreticilerin uygun alternatifleri; kaynak katalog ve sayfa; bağlantı ve su darbesi uyarıları', () => {
  const r = E.design(inp), seg = B.gereksinimler(r).segmentler[0];
  const v = topla([boru('Üretici A', 110, 6.6, 10, 'PE100'), boru('Üretici B', 110, 6.6, 10, 'PE100'), boru('Üretici C', 110, 5.3, 8, 'PE100')]);
  const s = B.alternatifler(r, v.urunler, v.degerler).segmentler[0];
  ok(s.uygun.length >= 1 && s.uygun.every(x => x.kaynakSayfalar.length >= 1 && x.kaynakSayfalar.every(k => /kat_test s\.\d+/.test(k))), 'kaynak katalog ve sayfa');
  if (s.uygun.length >= 2) ok(s.ureticiSayisi >= 2, 'birden çok üretici');
  ok([...s.uygun, ...s.uygunDegil].every(x => x.uyari.some(w => /Su darbesi/.test(w))), 'su darbesi ayrı uyarı');
  if (seg.malzeme !== 'PE100') ok(s.uygun.every(x => x.uyari.some(w => /malzeme geçişi/.test(w))), 'malzeme geçişi uyarısı');
});

test('EB-05 Basınç sınıfı yetersiz veya hız yüksek ürün nedenleriyle "uygun değil"', () => {
  const r = E.design(inp), g = B.gereksinimler(r);
  const v = topla([boru('Düşük PN', 110, 4.3, 6, 'PE100'), boru('Küçük çap', 32, 2.0, 10, 'PE100')]);
  const s = B.alternatifler(r, v.urunler, v.degerler).segmentler[0];
  const dpn = [...s.uygun, ...s.uygunDegil].find(x => x.uretici === 'Düşük PN'), kc = s.uygunDegil.find(x => x.uretici === 'Küçük çap');
  if (6 * 10.2 < g.basincGerek_m) ok(dpn.durum === 'uygun-degil' && dpn.neden.some(n => /PN 6/.test(n)), 'PN yetersiz → nedenli');
  ok(kc && kc.neden.some(n => /hız/.test(n)), 'hız yüksek → nedenli');
});

test('EB-06 Bağımsızlık: modül hesap motorunu çağırmaz / değiştirmez; ikinci bir ürün veri modeli tanımlamaz', () => {
  const s = fs.readFileSync(W('esles-boru.js'), 'utf8').replace(/\/\/.*$/gm, '');
  ok(!/E\.design|IrriEngine|localStorage/.test(s), 'motor çağrısı ve kayıt yok');
  ok(/IrriKatalogUrun/.test(s) && !/yeniUrun|function urun/.test(s), 'ürün modeli PR #41 modelinden');
});

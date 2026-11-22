// Akıllı ekipman seçimi — pompa, filtre, vana, bağlantı elemanı; motor kataloğu ile yeniden hesap
const { E, test, ok, W } = require('./_lib');
const fs = require('fs');
const U = require(W('katalog-urun.js')), X = require(W('esles-ekipman.js'));
const inp = { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, srcType: 'kuyu', depth: 40, region: 'akdeniz' };
const K = s => ({ katalogId: 'kat_test', sayfa: s, hamMetin: 'test', yontem: 'elle' });
// Sentetik test ürünü (gerçek katalog değildir): değerler ve eğriler incelenmiş, ürün mühendislik denetiminden geçirilmiş
function urun(kategori, uretici, model, degerler, egriler = [], { dogrula = true } = {}) {
  let u = U.yeniUrun({ uretici, model, urunKodu: model, katalogId: 'kat_test', kategori });
  const ds = degerler.map(([ad, deger, birim], i) => { const r = U.yeniDeger({ urunId: u.id, ad, deger, birim, kaynak: K(20 + i) }); if (r.hata) throw new Error(ad + ': ' + r.hata); return Object.assign(r.deger, { inceleme: 'kullanici-onayladi' }); });
  const es = egriler.map(o => { const r = U.yeniEgri(Object.assign({ urunId: u.id, kaynak: K(30) }, o)); if (r.hata) throw new Error(r.hata); return Object.assign(r.egri, { inceleme: 'kullanici-onayladi' }); });
  u = U.incele(u, 'kullanici-onayladi');
  if (dogrula) { const d = U.muhendislikDenetle(u, ds, es); if (!d.gecti) throw new Error('denetim: ' + JSON.stringify(d.kurallar)); u = U.muhendislikOnayla(u, d, 'Test mühendisi'); }
  return { urunler: [u], degerler: ds, egriler: es };
}
const birles = (...L) => ({ urunler: L.flatMap(x => x.urunler), degerler: L.flatMap(x => x.degerler), egriler: L.flatMap(x => x.egriler) });
const r0 = E.design(inp), req = X.gereksinim(r0, inp);
// Görev noktalarına göre ölçeklenen sentetik pompa eğrisi
const qh = (k, devir = 2900) => ({ tur: 'QH', birimX: 'm³/h', birimY: 'm', noktalar: [0, 0.4, 0.8, 1.2, 1.6].map(f => [+(req.Qd * f).toFixed(2), +(req.Hd * k * (1.3 - 0.3 * f * f)).toFixed(2)]), kosul: { devir } });
const verim = () => ({ tur: 'verim', birimX: 'm³/h', birimY: '%', noktalar: [0, 0.4, 0.8, 1.2, 1.6].map(f => [+(req.Qd * f).toFixed(2), [30, 55, 68, 66, 55][[0, 0.4, 0.8, 1.2, 1.6].indexOf(f)]]) });

test('EK-01 Gereksinimler motor sonucundan; motor sonucu değişmez', () => {
  const once = JSON.stringify(r0);
  ok(req.gorevler.length >= 1 && req.Qd > 0 && req.Hd > 0 && req.pompaTipleri.includes('dalgic'), 'pompa görev noktaları ve tip');
  ok(req.filtreAsamalari.length >= 1 && req.vanaQ > 0 && req.anaHat.length >= 1, 'filtre, vana, ana hat');
  ok(JSON.stringify(r0) === once, 'motor sonucu değişmedi');
});

test('EK-02 Pompa: gerçek Q–H eğrisi her görev noktasında; işletme noktası; verim, güç ve motor; farklı devir ayrı aday', () => {
  const iyi = urun('pompa', 'Üretici A', 'P-iyi', [['pompa_tipi', 'dalgic', ''], ['guc_motor', 30, 'kW']], [qh(1.1), qh(0.7, 1450), verim()]);
  const L = X.oneriler(r0, inp, iyi).pompa;
  const u = L.uygun.find(x => x.kosul === '2900 d/dk'), d = [...L.uygunDegil, ...L.eksik].find(x => x.kosul === '1450 d/dk');
  ok(u && u.hesap.noktalar.every(n => n.H >= n.Hgerek) && u.hesap.rezerv_m > 0 && u.hesap.Pmax_kW > 0, '2900 d/dk eğrisi uygun; rezerv ve güç');
  ok(u.hesap.isletme && u.hesap.isletme.Q >= req.Qd && u.hesap.isletme.H > 0, 'işletme noktası sistem eğrisiyle kesişimden');
  ok(d && d.durum === 'uygun-degil' && d.neden.some(n => /basma yüksekliği/.test(n)), '1450 d/dk eğrisi ayrı değerlendirildi, yetersiz');
  ok(u.uyari.some(w => /dalgıç pompa: NPSH/.test(w)), 'NPSH uyarısı (dalgıç)');
});

test('EK-03 Pompa: verim eğrisi yoksa "verisi eksik"; motor gücü yetersizse "uygun değil"; eğri dışı tahmin yok; doğrulanmamış önerilmez', () => {
  const verimsiz = urun('pompa', 'Üretici B', 'P-verimsiz', [['pompa_tipi', 'dalgic', ''], ['guc_motor', 30, 'kW']], [qh(1.1)]);
  const kucukMotor = urun('pompa', 'Üretici C', 'P-motor', [['pompa_tipi', 'dalgic', ''], ['guc_motor', 0.5, 'kW']], [qh(1.1), verim()]);
  const kisa = urun('pompa', 'Üretici D', 'P-kisa', [['pompa_tipi', 'dalgic', ''], ['guc_motor', 30, 'kW']], [{ tur: 'QH', birimX: 'm³/h', birimY: 'm', noktalar: [[0, 200], [1, 199], [2, 198], [3, 197]], kosul: { devir: 2900 } }, verim()]);
  const dogrulanmamis = urun('pompa', 'Üretici E', 'P-dogrulanmamis', [['pompa_tipi', 'dalgic', ''], ['guc_motor', 30, 'kW']], [qh(1.1), verim()], { dogrula: false });
  const L = X.oneriler(r0, inp, birles(verimsiz, kucukMotor, kisa, dogrulanmamis)).pompa;
  ok(L.eksik.some(x => x.model === 'P-verimsiz' && x.neden.some(n => /verim/.test(n))), 'verim yok → eksik');
  ok(L.uygunDegil.some(x => x.model === 'P-motor' && x.neden.some(n => /motor gücü/.test(n))), 'motor gücü yetersiz');
  ok(L.uygunDegil.some(x => x.model === 'P-kisa' && x.neden.some(n => /aralığı dışında.*tahmin edilmez/.test(n))), 'eğri dışı: tahmin yok');
  ok(L.eksik.some(x => x.model === 'P-dogrulanmamis') && !L.uygun.length, 'doğrulanmamış önerilmez');
});

test('EK-04 Pompa: doğrulanmış ürün motor kataloğuna çevrilir; motor aynı arayüzle yeniden hesaplar; seçilen ürün kullanılır', () => {
  const iyi = urun('pompa', 'Üretici A', 'P-iyi', [['pompa_tipi', 'dalgic', ''], ['guc_motor', 30, 'kW']], [qh(1.1), verim()]);
  const L = X.oneriler(r0, inp, iyi).pompa, s = L.uygun[0];
  const ek = X.motorKatalogu(iyi, { pompa: { urunId: s.urunId, egriId: s.egriId } });
  const r1 = E.design(inp, null, { catalog: X.katalogBirlestir(require(W('catalog-data.js')) || globalThis.IRRI_CATALOG, ek) });
  ok(r1.ok && r1.pump.fromCatalog && /^urun:/.test(r1.pump.id) && r1.pump.ad.includes('Üretici A'), `motor seçilen ürünü kullandı (${r1.pump.ad})`);
  ok(JSON.stringify(E.design(inp)) === JSON.stringify(r0), 'katalogsuz hesap değişmedi (altın sonuç)');
});

test('EK-05 Filtre: plan aşaması, filtrasyon, temiz/kirli kayıp ayrı; µm ↔ mesh tahmini yok; ΔH pompa uyarısı', () => {
  const asm = req.filtreAsamalari.find(a => a.mesh) || req.filtreAsamalari[0], tip = asm.tip, mesh = asm.mesh || 120;
  const kayip = { tur: 'kayip', birimX: 'm³/h', birimY: 'bar', noktalar: [[0, 0], [10, 0.05], [20, 0.12], [40, 0.3], [80, 0.6]] };
  const iyi = urun('filtre', 'Üretici F', 'F-iyi', [['filtre_tipi', tip, ''], ['dn', 80, 'mm'], ['debi_max', 80, 'm³/h'], ['filtrasyon_mesh', mesh, 'mesh'], ['kayip_kirli', 0.5, 'bar']], [kayip]);
  const mikron = urun('filtre', 'Üretici G', 'F-mikron', [['filtre_tipi', tip, ''], ['dn', 80, 'mm'], ['debi_max', 80, 'm³/h'], ['filtrasyon_mikron', 130, 'µm'], ['kayip_kirli', 0.5, 'bar']], [kayip]);
  const kirlisiz = urun('filtre', 'Üretici H', 'F-kirlisiz', [['filtre_tipi', tip, ''], ['dn', 80, 'mm'], ['debi_max', 80, 'm³/h'], ['filtrasyon_mesh', mesh, 'mesh']], [kayip]);
  const L = X.oneriler(r0, inp, birles(iyi, mikron, kirlisiz)).filtre;
  const f = L.uygun.find(x => x.model === 'F-iyi');
  ok(f && f.hesap.temiz_bar != null && f.hesap.kirli_bar === 0.5 && f.hesap.temiz_bar < f.hesap.kirli_bar, 'temiz ve kirli kayıp ayrı');
  ok(f.hesap.dH_m != null, 'motor varsayımıyla fark (ΔH) hesaplandı');
  if (asm.mesh) ok(L.eksik.some(x => x.model === 'F-mikron' && x.neden.some(n => /dönüşüm tahmini yapılmaz/.test(n))), 'µm ↔ mesh tahmini yok');
  ok(L.eksik.some(x => x.model === 'F-kirlisiz' && x.neden.some(n => /kirli filtre/.test(n))), 'kirli kayıp yoksa eksik');
  const ek = X.motorKatalogu(iyi, { filtre: { urunId: f.urunId } });
  ok(ek.filtre && ek.filtre[0].qMax === 80 && Math.abs(ek.filtre[0].hTemiz - 0.6 * 10.2) < 1e-9, 'motor biçimine çevrildi');
});

test('EK-06 Vana: PN, çalışma basıncı, Kv ile kayıp; Kv yoksa eksik', () => {
  const iyi = urun('vana', 'Üretici V', 'V-iyi', [['dn', 63, 'mm'], ['pn', 16, 'bar'], ['kv', 60, 'Kv'], ['debi_max', 40, 'm³/h']]);
  const kvsiz = urun('vana', 'Üretici W', 'V-kvsiz', [['dn', 63, 'mm'], ['pn', 16, 'bar']], [], { dogrula: false });   // Kv'siz vana mühendislik denetiminden geçemez
  const dusukPn = urun('vana', 'Üretici Y', 'V-pn', [['dn', 63, 'mm'], ['pn', 2.5, 'bar'], ['kv', 60, 'Kv']]);
  const L = X.oneriler(r0, inp, birles(iyi, kvsiz, dusukPn)).vana;
  const v = L.uygun.find(x => x.model === 'V-iyi');
  ok(v && Math.abs(v.hesap.kayip_m - 10.2 * Math.pow(req.vanaQ / 60, 2)) < 1e-12, 'Kv ile kayıp');
  ok(L.eksik.some(x => x.model === 'V-kvsiz'), 'Kv yoksa eksik');
  if (2.5 < req.calismaBasinci_bar) ok(L.uygunDegil.some(x => x.model === 'V-pn' && x.neden.some(n => /PN 2.5/.test(n))), 'PN yetersiz');
});

test('EK-07 Bağlantı elemanı: çap, malzeme, bağlantı türü ve PN uyumu; boru sistemine uymayan önerilmez', () => {
  const ana = req.anaHat[0];
  const fam = /^PE/.test(ana.malzeme) ? 'PE100' : 'PVC-U', tur = fam === 'PE100' ? 'elektrofuzyon' : 'yapistirma', yanlis = fam === 'PE100' ? 'yapistirma' : 'elektrofuzyon';
  const iyi = urun('baglanti', 'Üretici K', 'B-iyi', [['dis_cap', ana.od, 'mm'], ['pn', 16, 'bar'], ['malzeme', fam, ''], ['baglanti', tur, '']]);
  const tur2 = urun('baglanti', 'Üretici L', 'B-tur', [['dis_cap', ana.od, 'mm'], ['pn', 16, 'bar'], ['malzeme', fam, ''], ['baglanti', yanlis, '']]);
  const cap = urun('baglanti', 'Üretici M', 'B-cap', [['dis_cap', 999, 'mm'], ['pn', 16, 'bar'], ['malzeme', fam, ''], ['baglanti', tur, '']]);
  const L = X.oneriler(r0, inp, birles(iyi, tur2, cap)).baglanti;
  ok(L.uygun.some(x => x.model === 'B-iyi'), 'uyumlu bağlantı');
  ok(L.uygunDegil.some(x => x.model === 'B-tur') && L.uygunDegil.some(x => x.model === 'B-cap'), 'uyumsuz bağlantı türü ve çap önerilmez');
});

test('EK-08 Sonradan eklenen doğrulanmış ürün kod değişmeden otomatik değerlendirilir; yalnız PDF\'i olan ürün doğrulanmış sayılmaz', () => {
  const a = urun('vana', 'İlk Üretici', 'V1', [['dn', 63, 'mm'], ['pn', 16, 'bar'], ['kv', 60, 'Kv']]);
  const once = X.oneriler(r0, inp, a).vana.uygun.length;
  const b = urun('vana', 'Yeni Üretici', 'V2', [['dn', 63, 'mm'], ['pn', 16, 'bar'], ['kv', 80, 'Kv']]);
  const sonra = X.oneriler(r0, inp, birles(a, b)).vana;
  ok(sonra.uygun.length === once + 1 && sonra.uygun.some(x => x.uretici === 'Yeni Üretici'), 'yeni üretici otomatik dahil');
  const pdfOnly = { urunler: [U.yeniUrun({ uretici: 'Yalnız PDF', model: 'X', katalogId: 'kat_test', kategori: 'vana' })], degerler: [], egriler: [] };
  ok(X.oneriler(r0, inp, birles(a, pdfOnly)).vana.eksik.some(x => x.uretici === 'Yalnız PDF'), 'teknik verisi olmayan ürün "verisi eksik"');
});

test('EK-09 Bağımsızlık: modül motoru değiştirmez, ikinci ürün modeli tanımlamaz', () => {
  const s = fs.readFileSync(W('esles-ekipman.js'), 'utf8').replace(/\/\/.*$/gm, '');
  ok(!/E\.design|IrriEngine|localStorage/.test(s) && /IrriKatalogUrun/.test(s) && !/yeniUrun/.test(s), 'bağımsız');
});

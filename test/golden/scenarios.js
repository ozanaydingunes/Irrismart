// MH-0 — Altın referans senaryoları.
// Her senaryo, mevcut hesap motorunun (v0.6.x) sonucunu kayıt altına almak için kullanılır.
// Senaryo eklemek serbesttir; mevcut bir senaryonun girdisini değiştirmek altın kaydı değiştirir
// ve docs/hesap-degisiklik-kaydi.md'de gerekçe ister.
const poly = [[37.0, 35.0], [37.0, 35.004], [37.002, 35.005], [37.0025, 35.001], [37.0012, 34.9995]];
const parselOpt = { poly, src: [36.999, 34.999], station: [36.9993, 34.9994], route: [[36.9996, 34.9996]] };
const kuyu50 = { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, srcType: 'kuyu', depth: 40, region: 'akdeniz' };

module.exports = [
  { id: 'S01-duz-arazi', kapsam: 'Düz arazi, kuyu, şerit damla', inp: { ...kuyu50, slopeLong: 0, slopeShort: 0 } },
  { id: 'S02-yukari-egimli-lateral', kapsam: 'Eğim yönü bilinmiyor (%3 / %1): motor yukarı yönlü en kötü durumu alır', inp: { ...kuyu50, slopeLong: 3, slopeShort: 1 } },
  { id: 'S03-asagi-egimli-lateral', kapsam: 'Parsel, eğim yönü biliniyor (lateral yönünde aşağı). BİLİNEN SINIRLAMA: motor laterali yine |eğim| ile yukarı yönlü hesaplar (MH-3 konusu)',
    inp: { crop: 'domates', geom: 'parsel', Q: 120, srcType: 'kuyu', depth: 30, region: 'akdeniz', grad: { gx: -0.02, gy: -0.004 } }, opt: parselOpt },
  { id: 'S05-coklu-shift', kapsam: 'Büyük alan / sınırlı kaynak: çok sayıda shift', inp: { crop: 'domates', area_da: 200, Q: 80, srcType: 'kuyu', depth: 40, region: 'ege' } },
  { id: 'S06-dusuk-kaynak-debisi', kapsam: 'Kaynak debisi çok düşük: tur süresi sığmaz uyarısı', inp: { ...kuyu50, Q: 12 } },
  { id: 'S07-uzun-ana-hat', kapsam: 'Kaynaktan araziye 2000 m', inp: { ...kuyu50, dSource: 2000 } },
  { id: 'S08-yuksek-kot-farki-yukari', kapsam: 'Arazi kaynaktan 40 m yüksek', inp: { ...kuyu50, dZ: 40 } },
  { id: 'S09-yuksek-kot-farki-asagi', kapsam: 'Arazi kaynaktan 40 m alçak (cazibe, fazla basınç)', inp: { ...kuyu50, srcType: 'yuzey', depth: 2, dZ: -40 } },
  { id: 'S10-yetersiz-sebeke-basinci', kapsam: 'Hidrant 1,5 bar: booster pompa gerekir', inp: { crop: 'domates', area_da: 80, Q: 120, srcType: 'sebeke', pAvail: 1.5 } },
  { id: 'S11-yeterli-sebeke-basinci', kapsam: 'Hidrant 6 bar: pompa gerekmez, regülatör', inp: { crop: 'domates', area_da: 80, Q: 120, srcType: 'sebeke', pAvail: 6 } },
  { id: 'S12-lateral-20mm', kapsam: 'Farklı lateral çapı (Ø20)', inp: { ...kuyu50, latD: '20' } },
  { id: 'S13-ana-hat-zorunlu-cap', kapsam: 'Ana hat çapı kullanıcıdan (Ø160), kademesiz', inp: { ...kuyu50, mainOd: 160, teleskop: 'hayir' } },
  { id: 'S14-eksik-veri', kapsam: 'Yalnız alan ve debi: boyut, eğim, derinlik kabul edilir', inp: { crop: 'domates', area_da: 30, Q: 30 } },
  { id: 'S15-kullanici-egim-girdisi', kapsam: 'Parsel, DEM yok; eğim kullanıcı tarafından girildi (%2,5 / %0,8)', inp: { crop: 'domates', geom: 'parsel', Q: 120, srcType: 'kuyu', depth: 30, slopeLong: 2.5, slopeShort: 0.8 }, opt: parselOpt },
  { id: 'S16-pc-damlatici-egimli', kapsam: 'Basınç ayarlı damlatıcı, %5 eğim', inp: { ...kuyu50, emitter: 'pc', pcMin: 8, pcMax: 30, slopeLong: 5 } },
  { id: 'S17-zeytin-yuzey-suyu', kapsam: 'Ağaç (zeytin), yüzey suyu, kum+disk filtre', inp: { crop: 'zeytin', area_da: 200, Q: 90, srcType: 'yuzey', depth: 3, region: 'ege' } },
  { id: 'S18-parsel-elle-shift', kapsam: 'Parsel + güzergâh + elle düzenlenmiş shift ataması', inp: { crop: 'domates', geom: 'parsel', Q: 120, srcType: 'kuyu', depth: 30, region: 'akdeniz' }, opt: parselOpt, manual: 'reverse-pairs' },
  { id: 'S19-buyuk-hidrant', kapsam: '300 da, hidrant 3 bar, çok alt ünite', inp: { crop: 'domates', area_da: 300, Q: 400, srcType: 'sebeke', pAvail: 3 } },
];

// Bu motorda henüz modellenemeyen talep senaryoları (MH-3'te eklenecek):
module.exports.bekleyen = [
  { id: 'S04-degisken-egimli-guzergah', neden: 'Motor tek eğim düzlemi kullanıyor; güzergâh boyunca değişken kot MH-3 (arazi yüzeyi) ile gelecek.' },
  { id: 'S20-olculmus-kot-noktalari', neden: 'Elle ölçülmüş kot noktası girişi MH-2 ile gelecek.' },
];

module.exports.hydroTable = {
  fields: [{ crop: 'ŞEFTALİ', area: 442, et: 4.5, T: 22, Sr: 5, Sp: 2.5, nl: 2, q: 1.6, Sd: 0.5, shifts: 5, target: 38 },
    { crop: 'DOMATES', area: 120, et: 6.2, T: 20, Sr: 1.4, Sp: 1.4, nl: 1, q: 2, Sd: 0.33, shifts: 4, target: 30 }],
  fric: { 'Shift 1': [{ type: 'Submain', material: 'HDPE100 110 mm', pn: 6, L: 100, Q: 45, h1: 0, h2: 0, pmin: 15 },
    { type: 'Main', material: 'UPVC 110 mm', pn: 6, L: 350, Q: 45, h1: 0, h2: 3, pmin: 0 },
    { type: 'Main', material: 'UPVC 160 mm', pn: 6, L: 800, Q: 90, h1: 3, h2: 5, pmin: 0 }] },
};

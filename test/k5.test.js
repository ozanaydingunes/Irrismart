// K-5 — Veri kaynakları, atıflar ve kot verisinin sınırları (harita, Ayarlar, PDF/Excel aynı kaynaktan)
const fs = require('fs'), path = require('path');
const XLSX = require('xlsx');
const { E, W, test, ok } = require('./_lib');
const K = require(W('sources.js'));
const RD = require(W('report-data.js'));
const inp = { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, srcType: 'kuyu', depth: 40, region: 'akdeniz', slopeLong: 1.2, slopeShort: 0.4 };
const varsayim = p => { const wb = RD.workbook(XLSX, p, E.design(p.inp)); return XLSX.utils.sheet_to_json(wb.Sheets['Varsayımlar'], { header: 1 }); };
const ELEV = { zmin: 118.4, zmax: 124.6, total: 6.2, src: 'Open-Meteo (Copernicus DEM ~90 m)' };
const GK = { tur: 'kmz', dosya: 'ciftlik.kmz', icDosya: 'doc.kml', parsel: 'Büyük tarla', iceAktarma: '2026-11-19T10:00:00.000Z', yukseklikler: [120, 120, 120, 120], kotDogrulanmis: false };

test('K5-01 Atıf ve sınır metinleri: Esri ve Copernicus DEM (özgün lisans metni), 5 kot sınırı, KML notu, gizlilik', () => {
  ok(/Esri, Maxar, Earthstar Geographics/.test(K.KAYNAK.uydu.atif), 'Esri atfı');
  ok(/© DLR e\.V\. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA/.test(K.KAYNAK.kot.atif), 'Copernicus DEM atfı');
  ok(K.KAYNAK.kot.saglayici === 'Open-Meteo Elevation API' && K.KAYNAK.kot.model === 'Copernicus DEM GLO-90' && K.KAYNAK.kot.cozunurluk_m === 90, 'kot kaynağı');
  ok(K.KOT_SINIRLARI.length === 5 && /90 m/.test(K.KOT_SINIRLARI[0]) && /Yüzey modeli/.test(K.KOT_SINIRLARI[1]) && /doğrulanmış hidrolik kot değildir/.test(K.KOT_SINIRLARI[4]), 'sınırlar');
  ok(/hidrolik hesapta kullanılmaz/.test(K.KML_NOTU) && /yalnız bu cihazda/.test(K.GIZLILIK) && /Open-Meteo/.test(K.GIZLILIK) && /Esri/.test(K.GIZLILIK), 'KML/gizlilik');
  ok(Object.isFrozen(K) && Object.isFrozen(K.KAYNAK.kot) && Object.isFrozen(K.KOT_SINIRLARI), 'dondurulmuş');
  ok(K.haritaAtif(x => x) === 'Esri, Maxar, Earthstar Geographics | Kot: Open-Meteo · Copernicus DEM GLO-90', K.haritaAtif(x => x));
});

test('K5-02 Haritadan kot alınmamış, KML’siz projede rapor değişmez (altın kayıt korunur)', () => {
  ok(K.projeSatirlari({ name: 'a', inp }).length === 0, 'boş olmalı');
  ok(K.projeSatirlari(null).length === 0, 'null');
  const once = varsayim({ name: 'a', inp });
  ok(!once.some(r => r[0] === 'Veri kaynağı'), 'Varsayımlar sayfasına kaynak satırı eklenmemeli');
});

test('K5-03 Haritadan kot alınmış projede kaynak, aralık, 5 sınır ve Copernicus/Esri atfı (Excel Varsayımlar)', () => {
  const s = K.projeSatirlari({ inp, elev: ELEV });
  ok(/Open-Meteo Elevation API — Copernicus DEM GLO-90 \(≈ 90 m çözünürlük\)\. Parselde ölçülen kot aralığı 118–125 m\./.test(s[0]), s[0]);
  K.KOT_SINIRLARI.forEach(k => ok(s.includes(k), 'sınır eksik: ' + k));
  ok(s.includes(K.KAYNAK.kot.atif) && s.some(x => x.includes(K.KAYNAK.uydu.atif)), 'atıflar');
  const rows = varsayim({ name: 'b', inp, elev: ELEV }).filter(r => r[0] === 'Veri kaynağı').map(r => r[1]);
  ok(rows.length === s.length && rows[0].startsWith('Kot ve eğim kaynağı: Open-Meteo') && rows.includes(K.KAYNAK.kot.atif), 'Excel satırları: ' + rows.length);
});

test('K5-04 KML/KMZ ile içe aktarılmış projede parsel kaynağı ve "yükseklikler kullanılmaz" notu; eğim elle ise belirtilir', () => {
  const s = K.projeSatirlari({ inp, geoKaynak: GK });
  ok(s.includes('Parsel sınırı: KMZ dosyası “ciftlik.kmz”, parsel “Büyük tarla”, içe aktarma 2026-11-19.'), s.join(' | '));
  ok(s.includes(K.KML_NOTU) && s.some(x => /kullanıcı tarafından girildi/.test(x)), 'KML notu / elle eğim');
  ok(!s.some(x => /Copernicus/.test(x)), 'kot alınmadıysa Copernicus satırı olmamalı');
  const ikisi = K.projeSatirlari({ inp, geoKaynak: GK, elev: ELEV });
  ok(ikisi.some(x => /Copernicus DEM GLO-90/.test(x)) && ikisi.includes(K.KML_NOTU) && !ikisi.some(x => /kullanıcı tarafından girildi/.test(x)), 'kot + KML birlikte');
});

test('K5-05 Çeviri: metinler T() ile çevrilir; lisans metni çevrilmez; bütün metinlerin 7 dilde çevirisi var', () => {
  const T = (x, q) => '«' + x + '»' + (q ? JSON.stringify(q) : '');
  const s = K.projeSatirlari({ inp, elev: ELEV }, T);
  ok(s[0].startsWith('«Kot ve eğim kaynağı') && s.includes(K.KAYNAK.kot.atif), 'çeviri / lisans');
  const dict = fs.readFileSync(path.join(__dirname, '..', 'www', 'js', 'i18n-dict.js'), 'utf8');
  const anahtarlar = [K.KAYNAK.uydu.ad, K.KAYNAK.kot.ad, ...K.KOT_SINIRLARI, K.KML_NOTU, K.GIZLILIK, 'Kot', 'Veri kaynağı', 'Veri kaynakları ve sınırlamalar',
    'Kot ve eğim kaynağı: {a} — {b} (≈ {c} m çözünürlük). Parselde ölçülen kot aralığı {d}–{e} m.', 'Eğim değerleri kullanıcı tarafından girildi (harita yükseklik modeli kullanılmadı).',
    'Parsel sınırı: {a} dosyası “{b}”, parsel “{c}”, içe aktarma {d}.', 'Uydu görüntüsü: {a}'];
  for (const a of anahtarlar) ok(dict.includes('[' + JSON.stringify(a) + ','), 'çeviri satırı yok: ' + a);
});

test('K5-06 Tek kaynak: harita, Ayarlar ve raporlar sources.js’i kullanır; modül saf', () => {
  const rd = f => fs.readFileSync(path.join(__dirname, '..', 'www', f), 'utf8');
  ok(/IrriKaynak\.haritaAtif/.test(rd('js/app.js')) && /kaynakKarti\(\)/.test(rd('js/app.js')), 'harita / Ayarlar');
  ok(/IrriKaynak\.projeSatirlari/.test(rd('js/report.js')) && /IrriKaynak\.projeSatirlari/.test(rd('js/report-data.js')), 'PDF / Excel');
  ok(/js\/sources\.js/.test(rd('index.html')), 'index.html');
  ok(!/fetch\(|document\.|localStorage|innerHTML/.test(rd('js/sources.js')), 'saf değil');
});

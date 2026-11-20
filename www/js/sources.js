// IrriGrow — K-5: veri kaynakları, atıflar ve kot verisinin sınırları (tek kaynak).
// Harita, Ayarlar ve raporlar (PDF, Excel) aynı metni buradan alır. Saf modül: DOM, ağ ve depolama kullanmaz.
// Metinler Türkçe anahtarlardır; çağıran taraf T() ile çevirir. Lisans/atıf metinleri (İngilizce özgün) çevrilmez.
(function (g) {
  const KAYNAK = Object.freeze({
    uydu: Object.freeze({
      ad: 'Uydu görüntüsü',
      saglayici: 'Esri World Imagery',
      // Esri öğe sayfasındaki güncel 'accessInformation' (arcgis.com, World Imagery, 20.11.2026)
      atif: 'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community',
      kisaAtif: 'Esri, Vantor, Earthstar Geographics',
    }),
    kot: Object.freeze({
      ad: 'Kot ve eğim',
      saglayici: 'Open-Meteo Elevation API',
      model: 'Copernicus DEM GLO-90',
      cozunurluk_m: 90,
      atif: '© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved',
      kisaAtif: 'Open-Meteo · Copernicus DEM GLO-90',
      // Open-Meteo lisansı (open-meteo.com/en/licence): veri CC BY 4.0; verinin gösterildiği yerde Open-Meteo bağlantısı
      // ve Copernicus atfı zorunlu.
      url: 'https://open-meteo.com/',
      lisans: 'CC BY 4.0',
      lisansUrl: 'https://open-meteo.com/en/licence',
    }),
  });

  // Kot verisinin sınırları (sıra önemlidir: rapor ve Ayarlar aynı sırayla gösterir)
  const KOT_SINIRLARI = Object.freeze([
    'Çözünürlük yaklaşık 90 m: küçük parsellerde yalnız birkaç model hücresi düşer.',
    'Yüzey modelidir: ağaç, sera ve yapı yükseklikleri kota karışabilir.',
    'Düşey hata birkaç metreyi bulabilir; düz arazide eğim yönü bile yanılabilir.',
    'Eğim, parsel içindeki örnek noktalara düzlem uydurularak ortalama olarak bulunur; teras, kanal, yerel çukur ve tümsekler yakalanmaz.',
    'Bu veri doğrulanmış hidrolik kot değildir: uygulama projesinden önce arazide ölçüm (GNSS veya nivelman) yapılmalıdır.',
  ]);
  const KML_NOTU = 'KML/KMZ dosyasındaki yükseklikler saklanır, hidrolik hesapta kullanılmaz.';
  const GIZLILIK = 'Projeler yalnız bu cihazda saklanır. Harita görüntüsü için görüntülenen bölge Esri sunucularından, eğim ölçümü için parsel noktalarının koordinatları Open-Meteo’dan istenir; başka veri gönderilmez.';

  // Haritanın sağ alt köşesindeki atıf (Leaflet attribution; bağlantısız düz metin)
  // HTML (Leaflet atıf denetimi bağlantı gösterir; bağlantılar yeni sekmede / Android'de sistem tarayıcısında açılır)
  const bag = (url, metin) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${metin}</a>`;
  const haritaAtif = T => `${KAYNAK.uydu.kisaAtif} | ${T('Kot')}: ${bag(KAYNAK.kot.url, 'Open-Meteo.com')} (${bag(KAYNAK.kot.lisansUrl, KAYNAK.kot.lisans)}) · Copernicus DEM GLO-90`;

  // Projeye özgü kaynak satırları. Haritadan kot alınmamış ve KML ile içe aktarılmamış projelerde boş
  // (raporları ve altın kayıtları değiştirmez).
  function projeSatirlari(p, T = (x, q) => q ? x.replace(/\{(\w+)\}/g, (m, k) => q[k] ?? m) : x, fmt = (v, d) => Number(v).toFixed(d)) {
    if (!p) return [];
    const out = [], e = p.elev, gk = p.geoKaynak, inp = p.inp || {};
    if (e) {
      out.push(T('Kot ve eğim kaynağı: {a} — {b} (≈ {c} m çözünürlük). Parselde ölçülen kot aralığı {d}–{e} m.', {
        a: KAYNAK.kot.saglayici, b: KAYNAK.kot.model, c: KAYNAK.kot.cozunurluk_m,
        d: Number.isFinite(e.zmin) ? fmt(e.zmin, 0) : '?', e: Number.isFinite(e.zmax) ? fmt(e.zmax, 0) : '?' }));
      KOT_SINIRLARI.forEach(s => out.push(T(s)));
      out.push(KAYNAK.kot.atif);
      out.push(`Elevation data by Open-Meteo.com (${KAYNAK.kot.url}), ${KAYNAK.kot.lisans} (${KAYNAK.kot.lisansUrl})`);
    } else if (gk && (inp.slopeLong || inp.slopeShort)) out.push(T('Eğim değerleri kullanıcı tarafından girildi (harita yükseklik modeli kullanılmadı).'));
    if (gk) {
      out.push(T('Parsel sınırı: {a} dosyası “{b}”, parsel “{c}”, içe aktarma {d}.', {
        a: String(gk.tur || '').toUpperCase(), b: gk.dosya || '?', c: gk.parsel || '?', d: String(gk.iceAktarma || '').slice(0, 10) || '?' }));
      out.push(T(KML_NOTU));
    }
    if (out.length && (e || gk)) out.push(T('Uydu görüntüsü: {a}', { a: KAYNAK.uydu.atif }));
    return out;
  }

  const api = Object.freeze({ KAYNAK, KOT_SINIRLARI, KML_NOTU, GIZLILIK, haritaAtif, projeSatirlari, bag });
  g.IrriKaynak = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

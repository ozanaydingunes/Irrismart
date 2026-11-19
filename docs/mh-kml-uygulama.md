# MH-KML (K-4) — KML/KMZ ile arazi sınırı içe aktarma (uygulama notu)

Durum: **kod PR'ı; proje sahibinin onayı olmadan birleştirilmez (19.11.2026).** 1.0 Kapanış Planı K-4.
Hesap motoru, altın kayıtlar ve hidrolik denetimler değişmedi (hesap değişikliği yok → kayıt girdisi gerekmez).

## Akış

1. **Dosya seçimi:** Arazi ekranında `KML/KMZ` düğmesi (açık projeye) veya Projeler ekranında
   `KML/KMZ dosyasından yeni proje`. Masaüstünde dosya haritaya sürüklenip bırakılabilir.
   Android'de `accept` filtresi kaldırılır (KML'ler çoğu zaman `application/octet-stream` görünür); içerik okunurken denetlenir.
2. **Önizleme (proje değişmez):** adaylar alan (da), çevre, köşe sayısı ve uyarılarla listelenir; seçilen parsel haritada
   turuncu, diğerleri gri kesikli. Birden çok uygun parselde seçim kullanıcıya bırakılır; tek uygun parsel kendiliğinden seçilir.
   Hesaplanamayan parseller (kendini kesen, boşluklu, < 3 köşe, aralık dışı) seçilemez; nedeni yazılır.
3. **İptal:** hiçbir şey değişmez. "Yeni proje" yolunda önizleme için açılan boş geçici proje, İptal'de veya
   parsel uygulanmadan ekrandan çıkılınca silinir.
4. **Projeye uygula:** mevcut parsel varsa açık onay istenir (reddedilirse parsel aynen kalır). Önce revizyon alınır,
   sonra sınır yazılır ve bugünkü `Uygula` adımı (alan, boyutlar, Open-Meteo eğimi) çalışır.
5. **İçe aktarmayı geri al:** onayla, içe aktarmadan önceki revizyon ve önceki `geoKaynak`/`elev` geri gelir.

## Kaynak bilgisi (`proje.geoKaynak`)

`{tur:'kml'|'kmz', dosya, icDosya, parsel, iceAktarma, yukseklikler, irtifaModu, kotDogrulanmis:false, alan_m2}`.
Projeyle birlikte yedeğe yazılır ve yedekten okunur. **KML yükseklikleri saklanır ama hidrolik kot sayılmaz**;
motor bu alanı okumaz, eğim bugünkü gibi Open-Meteo'dan (veya elle) gelir.

## Güvenlik ve sınırlar (`www/js/kml.js`, `IrriKml.SINIR`)

| Sınır | Değer |
|---|---|
| Dosya | 10 MB |
| KMZ içindeki dosya sayısı | 200 |
| KMZ açılmış toplam boyut (merkezî dizinden, açmadan önce) | 30 MB |
| KML metni | 20 MB |
| Öğe (Placemark) | 500 |
| Sınır başına köşe | 5000 |

- XML ayrıştırıcı kullanılmaz (regex tabanlı, DOM yok); `DOCTYPE`/`ENTITY` içeren dosya reddedilir → dış varlık yok.
- `NetworkLink` izlenmez (not gösterilir); modül ağ isteği, `eval`, `innerHTML` kullanmaz (test KML-12).
- Adlar yalnız metin olarak gösterilir (`esc`); CDATA içindeki HTML/betik çalışmaz.
- KMZ: ZIP64 ve `..` yolları reddedilir; `doc.kml` öncelikli; bildirilen ve açılan boyut eşleşmezse reddedilir.
- WGS84 aralığı (|enlem| ≤ 90, |boylam| ≤ 180) denetlenir; KML `boylam,enlem` sırası `[enlem,boylam]`a çevrilir.
- Kapanmamış sınır kapatılır, ardışık yinelenen köşeler temizlenir (uyarı olarak gösterilir).
- Alan/çevre/kendini kesme, motorun kullandığı `geom.js` yerel izdüşümüyle hesaplanır.

## Bilinen sınırlar (bilerek, 1.1'e)

- İç sınırlı (boşluklu) parseller motor desteklemediği için alınmaz.
- Birden çok parseli tek projede birleştirme yok; her içe aktarma bir parsel.
- KML çizgileri (LineString) ana hat/güzergâh olarak alınmaz; yalnız not.

## Testler

- `test/kml.test.js` (KML-01…12): Google Earth biçimi ve bilinen alan, MultiGeometry/klasör, boşluk ve kendini kesme,
  kapanmamış/yinelenen/az köşe, DOCTYPE/NetworkLink/betik, ad alanı önekleri/yorum/CDATA/Türkçe adlar, WGS84,
  yükseklikler (kot sayılmaz), KMZ seçimi ve `..` yolu, zip bombası/dosya sayısı/boyut uyuşmazlığı/dosya boyutu,
  öğe ve köşe sınırları, modül saflığı.
- `test-ui/kml.ui.js` (42 kontrol, `npm run test:ui` içinde): 390 px'te önizleme, seçim, iptal, onay reddi, uygula,
  revizyon, yedekte `geoKaynak`, geri al, DOCTYPE reddi, dış istek yok, taşma yok; 1280 px'te proje yokken KMZ ile
  yeni proje, iptal/ekrandan çıkışta geçici projenin silinmesi, adın HTML olarak işlenmemesi.
- Kasıtlı hata denemeleri: DOCTYPE ve zip boyut denetimi kaldırılınca KML-05/KML-10, üzerine yazma onayı
  kaldırılınca iki arayüz kontrolü başarısız oluyor.
- Arayüz testi bir düzen hatası buldu ve düzeltildi: telefonda alt çubuk (panel) büyüyünce Leaflet katmanları onu
  örtüyor ve tıklamayı engelliyordu (`#map{z-index:0}`, `.mapbar{z-index:1}`).

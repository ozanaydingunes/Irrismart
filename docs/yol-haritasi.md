# IrriGrow — Geliştirme Yol Haritası

Son güncelleme: 18.11.2026 (MH-AKIL-1 tamamlandı). Bu belge proje sahibinin onayladığı geliştirme sırasını kayıt altına alır.
KML/KMZ içe aktarma, akıllı arazi bölme ve eğim analizi onaylanmış gereksinimlerdir; yol
haritasından çıkarılmaz.
Her madde **ayrı dal ve ayrı PR** olarak hazırlanır. Hiçbir PR, proje sahibinin açık onayı
olmadan `main` dalına birleştirilmez.

## Tamamlananlar

| Aşama | İçerik | Durum |
|---|---|---|
| Faz 0 | Depo düzeni, CI, APK doğrulama | `main` (PR #1) |
| PR-A | Capacitor 8, Android API 36, Node 22, veri koruma | `main` (PR #2) |
| MH-0 | Altın referans kayıtları, EPANET ile bağımsız doğrulama | `main` (PR #3) |
| MH-1 | Profesyonel hidrolik hesaplama paneli | `main` (PR #4) — gerçek Android cihaz testi 9/9 başarılı |
| MH-AKIL-1 | Yapılandırılmış mühendislik uyarıları ve çözüm önerileri | `main` (PR #6) — gerçek Android cihaz testi 11/11 başarılı |

## Onaylanmış sıra

| # | Aşama | Kapsam | Bağımlılık |
|---|---|---|---|
| 1 | ~~MH-AKIL-1~~ | **Tamamlandı** (PR #6) | — |
| 2 | **MH-AKIL-2** | Otomatik shift ve kaynak kapasitesi alternatifleri | MH-AKIL-1 (tamamlandı) — kodlama onaylandı |
| 3 | **MH-AKIL-5** | Su darbesi ön değerlendirmesi | MH-AKIL-1 |
| 4 | **MH-KML** | KML/KMZ ile arazi sınırı içe aktarma | — (veri modeli MH-AKIL-1 ile uyumlu) |
| 5 | **MH-AKIL-3** | Akıllı arazi bölme ve alternatif proje oluşturma | MH-AKIL-2, MH-KML |
| 6 | **MH-AKIL-4** | Teknik ve ekonomik alternatif karşılaştırması | MH-AKIL-2, MH-AKIL-3 |
| 7 | **MH-2** | Eğim ve kot analizi | MH-KML |
| 8 | **MH-3** | Arazi kotlarının hidrolik motorla entegrasyonu | MH-2 |

Bir aşamaya, önceki aşamanın PR'ı onaylanmadan kodlama olarak başlanmaz.
MH-KML, kendi aşaması gelmeden başka bir geliştirmenin içinde yarım ya da geçici olarak
kodlanmaz; ayrı teknik planı ve ayrı PR'ı olur.

## Bütün aşamalar için kurallar

1. Hesap motoru (`www/js/engine.js`) formülleri ve MH-0 altın kayıtları korunur. Bir hesap
   değişikliği gerekirse `docs/hesap-degisiklik-kaydi.md` kuralına göre mühendislik
   gerekçesiyle ayrıca belgelenir ve onaya sunulur.
2. Eski kullanıcı projeleri silinmez. Veri modeli değişikliği geriye dönük uyumlu olur ve
   `test/upgrade.test.js` ile sınanır.
3. Uyarılar, Sonuç ekranı, Hidrolik panel, PDF ve Excel aynı veri nesnesinden beslenir.
4. Gerekli kaynak debisi tur süresi oranlanarak hesaplanmaz. Önerilen her değer motor
   yeniden çalıştırılarak bulunur ve "kullanılan model ve tasarım kısıtlarının sonucu" olarak
   açıklanır; mutlak teorik minimum diye sunulmaz.
5. Uygun olmayan ya da verisi eksik bir alternatif, önerilen nihai çözüm olarak seçilmez.
6. Hesaplanmamış değerler örnek değerlerle karıştırılmaz; hesaplanmayan analiz (ör. kot,
   geçici rejim) yapılmış gibi gösterilmez.
7. Her yeni modülün otomatik testi olur. Gerçek cihazda doğrulanmamış davranış "başarılı"
   diye raporlanmaz.
8. Veri koruma testleri uygulamanın gerçek JSON proje yedeği ("Yedekle" / "Yedekten yükle")
   ile yapılır. Excel ve PDF raporları yedek değildir ve yedek yerine kullanılmaz.
9. İşletme güvenlik payı (W-KAP-02, proje ayarı, varsayılan %90) ile kritik kapasite kontrolü
   (W-KAP-01) ayrı değerlendirilir. Pay ayarı teknik uygunluğu değiştirmez.
10. Sulama aralığı seçenekleri; brüt ihtiyaç, toprak su kapasitesi, kök derinliği, RAW,
    kaynak kapasitesi, uygulama süresi, en büyük aralık ve su stresi riski açıklanmadan
    toplu olarak "uygunsuz" ilan edilmez. Veri eksikse "Veri gerekli" kullanılır.
11. Öneriler ve alternatifler ayrı taslak/revizyon olarak kaydedilir. Orijinal proje yalnız
   kullanıcının açık "Uygula" onayıyla değişir ve her zaman geri dönülebilir.

## MH-KML — KML/KMZ ile arazi sınırı içe aktarma (onaylanmış gereksinim)

Proje sahibi tarafından daha önce talep edilmiş, onaylanmış geliştirme gereksinimidir.

**Yeni arazi oluşturma:** iki seçenek sunulur:
- Haritada elle çizim (mevcut akış).
- KML/KMZ dosyasından içe aktarma.

**Kapsam:**
- Google Earth ve QGIS kaynaklı KML ile KMZ (zip içinde `doc.kml`) dosyaları.
- `Polygon`, `MultiGeometry` ve `Placemark` grupları. Çoklu parsel içeren dosyada kullanıcı
  hangi parsellerin alınacağını seçer.
- Poligon boşlukları (`innerBoundaryIs`): alan hesabından düşülür ve yerleşimde dikkate
  alınır. Motorun boşluk desteği yoksa bu açıkça uyarılır; boşluk yok sayılmaz.
- Koordinat doğruluğu: WGS84 boylam/enlem sırası, yükseklik bileşeninin ayrıştırılması,
  geçersiz/kendini kesen poligon, kapanmamış halka ve yinelenen nokta denetimi.
- Parsel sınırları içe aktarılınca haritada otomatik gösterilir ve harita sınırlara yaklaşır.
- Alan ve çevre hesabı: projeksiyonlu (yerel düzlem) alan ve çevre; dosyadaki ad/açıklama ile
  karşılaştırma.
- İçe aktarılan sınır haritada elle düzeltilebilir (köşe taşıma, ekleme, silme).
- Mevcut proje veri modeliyle uyum: sonuç `cur.poly` yapısına dönüşür, kaynak dosya bilgisi
  (`kaynak: 'kml'`, dosya adı, parsel adı) ayrıca saklanır.
- İçe aktarılan veriler projeye kaydedilir ve JSON proje yedeğine dahil olur.
- Mevcut "Haritada çiz" akışı ve elle çizilmiş eski projeler aynen korunur.
- İçe aktarılan araziler MH-AKIL-3 (Akıllı Arazi Bölme) ve MH-2 (Eğim Analizi) modüllerinde
  kullanılabilir.
- KML'deki yükseklik değerleri MH-2 tamamlanana kadar hesapta **kullanılmaz** ve
  kullanılmış gibi gösterilmez.

**Testler:** dosya doğrulama (bozuk zip, `doc.kml` olmayan KMZ, geçersiz XML, desteklenmeyen
geometri, boş dosya) ve geometri doğrulama (kapanmamış halka, kendini kesen poligon, yinelenen
nokta, boşluk, çoklu parsel, bilinen alan ve çevreli örnek dosyalar). Google Earth ve QGIS
çıktısı örnek dosyalarla sınanır.

**Teknik plan:** MH-KML aşaması başlamadan önce ayrı teknik plan hazırlanır ve onaya sunulur.

**Bu aşamada yapılmayacaklar:** GeoJSON, SHP ve diğer formatlar. Her biri ileride ayrı
aşama olarak planlanacak:
- MH-KML-2: GeoJSON
- MH-KML-3: Shapefile (SHP/DBF/PRJ, projeksiyon dönüşümü)

## Ayrıntılı planlar

- MH-AKIL-1: [docs/mh-akil-1-plan.md](mh-akil-1-plan.md)
- Tasarım önizlemeleri (masaüstü/mobil): proje sahibine iletilen tasarım tuvali.

# Firma Malzeme Katalogları — teknik plan (taslak, onay bekliyor)

Durum: plan + ekran önizlemesi (`docs/firma-katalog-onizleme.html`). Kod yazılmadı. Shift Yönetimi PR #38'den bağımsızdır. Onaysız main'e birleştirilmez.

## 1. Kapsam ve ilkeler
- Kullanıcı kendi PDF kataloglarını yükler. İnternetten katalog araştırması önceliği kaldırıldı.
- PDF'ler yalnız cihazda saklanır: Android'de uygulamanın özel alanı, web'de tarayıcının IndexedDB'si. Depoya, GitHub'a veya bir sunucuya gönderilmez.
- Katalog verisi (çap, PN, SDR, debi, ürün kodu) **hiçbir koşulda** hidrolik motora, `catalog.js`'e veya boru kütüphanesine aktarılmaz. Kullanıcının "onayladım" işareti de mühendislik doğrulaması sayılmaz.
- Mevcut Malzeme Listesi (`renderBom`) değişmez. Katalog bölümü ayrı bir görünüm (`v-katalog`) olarak eklenir.
- Proje JSON'u, yedek geri yükleme, altın kayıtlar ve 38 hidrolik denetim etkilenmez. Katalog kayıtları proje JSON'una girmez.

## 2. Erişim
- Malzeme ekranının üstünde iki sekme: **Proje malzeme listesi** (varsayılan, mevcut içerik) | **Firma katalogları**.
- Üst çubukta 📚 düğmesi. Kataloglar proje açmadan da açılır; `show()` içindeki "proje gerekli" kuralından muaf tutulur.
- Masaüstü web: üç sütun (firmalar | kataloglar | görüntüleyici), sürükle-bırak ile yükleme.

## 3. Veri modeli (`irrigrow.katalog.v1`, sürümlü)
```
Firma   { id, ad, notlar?, olusturma }
Katalog { id, firmaId, ad, belgeTuru: 'urun'|'fiyat'|'teknik'|'sertifika'|'diger',
          belgeTarihi: 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' | null,
          urunGruplari: ['boru','damla','vana','ekparca','pompa','filtre','gubre','otomasyon','diger'],
          kaynak: { tur: 'resmi-site'|'bayi'|'firma-temsilcisi'|'diger', aciklama?, url? },
          dosya: { ad, boyut, sha256, sayfa?, mime: 'application/pdf', depo: 'android-dosya'|'indexeddb', anahtar },
          yuklenme, guncelleme, oncekiSurumler: [{ dosya, belgeTarihi, degistirilme }],
          fiyatListesi?: { kdvDahil?: bool|null, paraBirimi?: 'TRY'|'USD'|'EUR'|null },
          cikarim: { durum: 'yok'|'calisiyor'|'bitti'|'hata', surum, satirlar: TeknikSatir[] } }
TeknikSatir { sayfa, urunKodu?, cap_mm?, pn?, sdr?, debi?{deger,birim}, hamMetin, durum: 'okundu'|'kullanici-onayladi'|'reddedildi' }
```
- Meta veri ayrı bir IndexedDB deposunda (`meta`); PDF baytları ayrı depoda veya dosyada. Meta veri küçük olduğundan ayrıca JSON olarak dışa aktarılabilir.
- Fiyat listeleri belge tarihiyle gösterilir; tarih bilinmiyorsa "tarih bilinmiyor" yazılır. Eski bir liste güncel fiyat gibi gösterilmez ("N gün/ay önce" etiketi).

## 4. Depolama
### Android (Capacitor 8, `@capacitor/filesystem` zaten bağımlılık)
- PDF, `Directory.Data/kataloglar/<id>.pdf` altına yazılır. Bu, uygulamanın özel dizinidir; WebView önbelleği temizlenince silinmez.
- **Büyük dosya riski:** Capacitor köprüsü veriyi base64 metin olarak taşır. 121 MB'lık bir PDF bellekte yaklaşık 160 MB'lık bir metin yapar ve bellek taşmasıyla uygulamayı çökertebilir. Bu yüzden dosya `Blob.slice` ile 1–2 MB'lık parçalar hâlinde `appendFile` ile yazılır. Yazım bitince boyut ve SHA-256 denetlenir; eksik dosya silinir, kayıt oluşturulmaz.
- Okuma: `Capacitor.convertFileSrc(uri)` adresi görüntüleyiciye verilir. Dosyanın tamamı JS belleğine alınmaz. Aralıklı (Range) okumanın Capacitor yerel sunucusunda çalıştığı uygulamada denenip doğrulanacak; çalışmazsa parça parça okuma kullanılacak.
- Boş alan: yüklemeden önce dosya boyutu gösterilir. Yazma "yer kalmadı" hatası verirse kayıt geri alınır ve kullanıcıya açık mesaj verilir.
### Masaüstü / mobil web
- PDF, IndexedDB'de `Blob` olarak saklanır (base64'e çevrilmez). İlk yüklemede `navigator.storage.persist()` istenir. Sonuç ve `navigator.storage.estimate()` ile kullanılan/kalan alan ekranda gösterilir.
- Kalıcılık izni verilmezse tarayıcı yer darlığında verileri silebilir. Bu, ekranda uyarı olarak gösterilir.
- Özel/gizli pencerede IndexedDB kapanınca silinir; bu algılanıp uyarı verilir.

## 5. Veri kaybı riskleri ve önlemler
| Risk | Etki | Önlem |
|---|---|---|
| Uygulamayı kaldırma / "Verileri temizle" | Android'deki PDF'ler ve meta veri silinir | Uyarı metni; "Katalog listesini dışa aktar" (meta JSON). PDF'lerin aslı kullanıcıda kalır; yeniden yüklemede SHA-256 ile eşleştirilir |
| Debug (`com.irrigrow.app.dev`) ve yayın paketi farkı | Ayrı depolar; dev sürümündeki kataloglar yayın sürümünde görünmez | Belgelenecek |
| Android Otomatik Yedekleme | 25 MB kotası büyük PDF'leri kapsamaz | PDF dizini yedekten hariç tutulur; yalnız meta veri yedeklenebilir |
| Tarayıcı silmesi (web) | IndexedDB silinebilir | `persist()`, alan göstergesi, meta JSON dışa aktarımı |
| Yazım sırasında kapanma | Yarım dosya | Önce geçici ada yazılır, doğrulandıktan sonra yeniden adlandırılır; açılışta sahipsiz dosyalar temizlenir |
| Bozuk veya PDF olmayan dosya | Görüntüleyici hatası | `%PDF-` imzası ve uzantı/MIME denetimi; reddedilen dosya kaydedilmez |

## 6. PDF görüntüleme
- Android WebView'da yerleşik PDF görüntüleyici yoktur. Uygulama içinde açmak için **pdf.js** (Mozilla, Apache-2.0) `www/lib/` altına yerel olarak eklenir; çevrimdışı çalışır, CDN kullanılmaz.
- Eski WebView'ları (Chrome 83) desteklemek için pdf.js'nin `legacy` derlemesi kullanılır. Ek boyut yaklaşık 2–3 MB; kesin değer ölçülecek.
- Özellikler: sayfa sayfa, yalnız görünen sayfalar çizilir (büyük PDF'de bellek koruması); yakınlaştırma; sayfaya git; belgede metin arama.
- Yedek yol: "Başka uygulamada aç" (`@capacitor-community/file-opener` zaten bağımlılık).

## 7. Teknik değer çıkarımı (genişletilebilir altyapı)
- `www/js/katalog-cikarim.js`: pdf.js `getTextContent` ile sayfa metnini okur. Ayrıştırıcılar eklenti biçimindedir: `{ ad, surum, eslesir(firma, metin), ayristir(sayfaMetni) → TeknikSatir[] }`.
- İlk sürümde genel ayrıştırıcı yalnız açık kalıpları okur: "Ø32", "PN 10", "SDR 17", "l/h", "m³/h" ve ürün kodu sütunları. Firmaya özel ayrıştırıcılar sonra eklenir.
- Çıkarım isteğe bağlıdır ve arka planda, sayfa sayfa çalışır; iptal edilebilir.
- Sonuçlar `okundu` durumunda saklanır. Kullanıcı satır satır onaylayabilir veya reddedebilir.
- Hiçbir satır hesap motoruna, BOM önerisine veya boru seçimine otomatik gitmez. Malzeme listesiyle eşleştirme ileride ayrı onaylı bir adım olarak tasarlanır.

## 8. İşlemler
- Yükleme (çoklu dosya); bilgi düzenleme; **güncelleme** (aynı kataloğun yeni PDF'i: eski dosya `oncekiSurumler`'e alınır ya da kullanıcı isterse silinir); **değiştirme** (dosyayı yenisiyle değiştir); silme (onaylı, geri alınamaz uyarısı); firma birleştirme/yeniden adlandırma.
- Filtreleme: firma, ürün grubu, belge türü, metin arama (ad/firma/not).
- Yinelenme denetimi: aynı SHA-256 yeniden yüklenirse uyarı verilir.

## 9. Testler
- Birim (Node): veri modeli doğrulama, sürüm geçişi, yinelenme, tarih biçimleri, ayrıştırıcı kalıpları; **motor ayrılığı**: katalog kaydı varken `E.design` çıktısının ve altın kayıtların bayt bayt aynı kalması.
- Arayüz (Playwright, 320/390/tablet/masaüstü): yükle → listele → aç → düzenle → güncelle → sil; sayfa yenilenince kalıcılık; Malzeme listesinin değişmediği (mevcut testler + ekran karşılaştırması); dokunuş öncesi görünürlük ölçümü (`shift-gorunur` yöntemi).
- Android emülatörü (API 30 ve 34, gerçek WebView): 1 MB ve 120 MB PDF ile yükleme, uygulamayı kapat/aç sonrası kalıcılık, bellek taşması olmadığı, görüntüleyicinin açıldığı.
- Test PDF'leri CI'da üretilir; gerçek firma katalogları depoya konmaz.

## 10. Aşamalar (her biri aynı PR dalında ayrı commit; birleştirme yalnız onayla)
1. Depolama katmanı (`katalog-depo.js`: Android dosya + web IndexedDB) ve veri modeli; birim testleri.
2. Firmalar / katalog listesi / yükleme formu ekranları; Malzeme sekmesi; masaüstü düzeni.
3. pdf.js görüntüleyici (legacy derleme), arama; "başka uygulamada aç".
4. Çıkarım altyapısı ve genel ayrıştırıcı; doğrulama ekranı.
5. Emülatörde büyük dosya ve kalıcılık testleri; belge.

## Açık sorular (onayınız gerekli)
1. Erişim: Malzeme sekmesi içinde ikinci sekme + üst çubukta 📚 düğmesi uygun mu?
2. pdf.js ile uygulama içi görüntüleyici (yaklaşık 2–3 MB ek APK boyutu) uygun mu?
3. Güncelleme yapıldığında eski PDF sürümü varsayılan olarak saklansın mı, silinsin mi?

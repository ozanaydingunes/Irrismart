# IrriGrow — Gizlilik Politikası (TASLAK)

> **Taslak.** Yayından önce: (1) geliştirici adı ve **iletişim e-posta adresi** eklenmeli, (2) harita/kot sağlayıcısı
> kararı (K-7 §4) sonrası §3 güncellenmeli, (3) hukuki gözden geçirme yapılmalı, (4) herkese açık bir adreste
> yayımlanmalı (ör. GitHub Pages). Bu metin uygulamanın 1.0.0 sürümündeki gerçek davranışına göre yazılmıştır.

Son güncelleme: [tarih] · Geliştirici: [ad] · İletişim: [e-posta]

## 1. Özet
IrriGrow, damla sulama ön projelendirmesi için bir hesap uygulamasıdır. **Hesap açma, reklam, analiz/izleme aracı ve
bulut eşitleme yoktur.** Projeleriniz cihazınızda saklanır.

## 2. Cihazda saklanan veriler
- Projeler (ad, girdiler, parsel sınırı koordinatları, kaynak/istasyon noktaları, hesap seçimleri), fiyat ayarları,
  dil/tema tercihleri ve yüklediğiniz ekipman kataloğu yalnız uygulamanın cihazdaki yerel depolamasında tutulur.
- Bu veriler geliştiriciye **gönderilmez**.
- **Android sistem yedeklemesi:** Telefonunuzda Google hesabıyla Android yedeklemesi açıksa, Android uygulama verilerini
  (projeler dahil) Google'ın yedekleme hizmetine kendisi yedekleyebilir. Bu, Android'in özelliğidir ve telefon
  ayarlarınızdan kapatılabilir.
- Uygulamayı kaldırdığınızda veya projeyi sildiğinizde veriler cihazdan silinir. Silmeden önce **Yedekle** ile JSON yedeği alabilirsiniz.

## 3. Üçüncü taraf hizmetlere giden bilgiler (yalnız internet bağlantısı varken)
| Hizmet | Ne zaman | Gönderilen |
|---|---|---|
| **Esri (World Imagery)** — uydu görüntüsü | Harita ekranı açıkken | Görüntülenen bölgenin karo koordinatları ve standart ağ bilgileri (IP adresi, tarayıcı/WebView bilgisi) |
| **Open-Meteo (Elevation API)** — yükseklik/eğim | Parselde **Uygula**'ya bastığınızda | Parsel sınırındaki ve içindeki örnek noktaların enlem/boylamı (en çok ~80 nokta) ve standart ağ bilgileri |

Proje adı, bitki, debi, maliyet gibi diğer bilgiler bu hizmetlere gönderilmez. Bu hizmetlerin kendi gizlilik politikaları geçerlidir.

## 4. Konum
- Uygulama konum iznini **yalnız haritadaki "◎" (konumum) düğmesine bastığınızda** ve yalnız haritayı bulunduğunuz yere
  getirmek için kullanır. Konum geliştiriciye gönderilmez; arka planda konum alınmaz.
- Harita o bölgeye gelince ilgili karolar §3'teki gibi Esri'den istenir.

## 5. Dosyalar
- KML/KMZ ve JSON yedek dosyaları yalnız sizin seçtiğiniz dosyalardır ve cihazda okunur; dosya içeriği hiçbir yere gönderilmez.
- PDF, Excel, DXF raporları cihazınıza (Belgeler/IrriGrow) kaydedilir; paylaşmak sizin seçiminizdir.

## 6. Çocuklar
Uygulama profesyonel kullanıcılara yöneliktir; çocuklara yönelik değildir ve çocuklardan bilerek veri toplamaz.

## 7. Güvenlik
Üçüncü taraf hizmetlere bağlantılar HTTPS ile şifrelenir. Cihazdaki verilerin korunması cihazın kendi güvenliğine bağlıdır.

## 8. Değişiklikler ve iletişim
Bu politika değişirse güncel sürüm aynı adreste yayımlanır. Sorular için: [e-posta].

---

# IrriGrow — Privacy Policy (DRAFT, English summary)
No accounts, ads, analytics or cloud sync. Projects are stored only on your device (Android's own system backup may
include app data if you enabled it). With an internet connection, map tile coordinates are requested from **Esri** and,
when you press **Apply**, sample coordinates of your parcel (up to ~80 points) are sent to **Open-Meteo** to obtain
elevation. Location permission is used only when you tap the "◎" button, to centre the map; it is not sent to the developer.
Files you open (KML/KMZ, JSON) are read on the device only. Contact: [e-mail].

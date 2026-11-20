# IrriGrow 1.0.0 — Gerçek Android cihaz test listesi

**Durum: Sürüm adayı (1.0.0, versionCode 12 — RC3, debug imzalı). Gerçek cihaz testleri tamamlanmadan yayına hazır değildir.**

APK: GitHub Actions → "APK derle" iş akışı → ilgili çalıştırma → *Artifacts* → `IrriGrow-1.0.0-debug-apk`
(zip içinde `IrriGrow-1.0.0-debug.apk` ve `.sha256`). Paket kimliği `com.irrigrow.app.dev`, en düşük Android 7.0 (API 24).

Her maddeyi **Geçti / Kaldı / Denenmedi** olarak işaretleyin; "Kaldı" için ekran görüntüsü ve kısa not yeterli.

## A. Kurulum ve güncelleme (önce bunlar)
| # | Adım | Beklenen |
|---|---|---|
| A-1 | Telefondaki eski IrriGrow'da (0.6.x) en az bir projenin **yedeğini alın** (Projeler → Yedekle) | JSON dosyası oluşur |
| A-2 | Eski sürümü **kaldırmadan** 1.0.0 APK'yı kurun | "Güncelle" olarak kurulur (imza aynı); hata yok |
| A-3 | Uygulamayı açın → Projeler | Eski projelerin hepsi duruyor, adlar ve parseller aynı |
| A-4 | Ayarlar'ın altı | "IrriGrow v1.0.0" yazıyor |
| A-5 | Eski bir projeyi açın → Sonuç | Hesap yapılıyor; eski elle shift ataması (varsa) duruyor |

## B. KML/KMZ ile proje
| # | Adım | Beklenen |
|---|---|---|
| B-1 | Projeler → "KML/KMZ dosyasından yeni proje" → telefonun **İndirilenler** klasöründen bir `.kml` seçin | Dosya listede seçilebilir (gri değil), önizleme açılır |
| B-2 | Aynısını WhatsApp/Drive'dan indirilmiş bir `.kmz` ile deneyin | Açılır |
| B-3 | Birden çok parselli dosyada | Parseller listelenir; seçilen turuncu görünür; kendini kesen parsel seçilemez |
| B-4 | "İptal" | Proje oluşmaz |
| B-5 | Parsel seçip "Projeye uygula" | Proje oluşur, alan (da) doğru; eğim ölçülür (internet varsa) |
| B-6 | Haritada parsel varken başka bir KML içe aktarın | Üzerine yazmadan önce onay sorulur |
| B-7 | "İçe aktarmayı geri al" | Önceki parsel geri gelir |
| B-8 | Haritanın altındaki bilgi satırı | "Kot: Copernicus DEM (≈ 90 m) — ön inceleme…" ve "ayrıntı" bağlantısı çalışır |

## C. Haritada çizim, hesap, PN ve shift
| # | Adım | Beklenen |
|---|---|---|
| C-1 | Yeni proje → haritada 4–6 köşe işaretleyin → Uygula | Alan ve eğim gelir; panel ve düğmeler parmakla rahat basılır |
| C-2 | Veriler → debi ve derinlik → Hesapla | Sonuç ekranı açılır |
| C-3 | Hidrolik → Boru seçimi → Elle: PE100, bir çap, SDR11 → Uygula; sonra SDR17 | Hesap kendiliğinden yenilenir; PN16 → PN10, iç çap büyür, hız düşer |
| C-4 | PVC-U ve PN6 | Seçilemez, "veri eksik" yazar |
| C-5 | Sonuç → bir alt ünitenin shift'ini elle değiştirin; sonra boru seçimini değiştirin | Elle shift ataması korunur |
| C-6 | Su darbesi satırı | Aşımda "Geçici rejim analizi gerekli" (kırmızı "uygunsuz" değil) |
| C-7 | (RC2) Haritada hesaplanmış parsel: shift kutuları ve köşeler | Kutular parseli örtmüyor ve üst üste binmiyor (yakınlaşınca ayrıntı açılıyor); köşeler kutuların altında kalmıyor, sürüklenebiliyor |
| C-8 | (RC3) Harita sağ alt köşesindeki atıfta **Open-Meteo.com** ve **CC BY 4.0** bağlantılarına dokunun | Bağlantı telefonun tarayıcısında açılır; uygulama kapanmaz, geri dönünce proje yerinde |

## D. Raporlar, paylaşım, dosya adları
| # | Adım | Beklenen |
|---|---|---|
| D-1 | PDF ve Excel raporu → Aç / Paylaş | Dosya açılır; WhatsApp/e-posta ile paylaşılır |
| D-2 | Teknik → A3 pafta PDF ve DXF | Oluşur ve açılır |
| D-3 | Türkçe adlı projede ("Büyük tarla") rapor | Dosya adı `IrriGrow_Buyuk_tarla-xxxx_…`; PDF/Excel içinde ad Türkçe |
| D-4 | Aynı raporu aynı dakikada iki kez alın; Dosyalar → Belgeler → IrriGrow | İki ayrı dosya (ikincisi `_2`); hiçbiri silinmez |
| D-5 | KML'li ve kotlu projenin PDF'i | "Veri kaynakları ve sınırlamalar" bölümü var |

## E. Yedek ve veri güvenliği
| # | Adım | Beklenen |
|---|---|---|
| E-1 | Projeler → Yedekle | JSON dosyası oluşur ve paylaşılabilir |
| E-2 | Bir projeyi değiştirip yedekten yükleyin | Mevcut proje silinmez; farklıysa "(yedekten)" kopyası eklenir |
| E-5 | (RC3) Aynı yedeği ikinci kez yükleyin | Yeni "(yedekten)" kopya oluşmaz; projeler çoğalmaz |
| E-3 | Uygulamayı tamamen kapatıp açın; telefonu yeniden başlatın | Projeler duruyor |
| E-4 | İnternetsiz (uçak modu) açın | Projeler açılır, hesap yapılır; harita/eğim için internet uyarısı çıkar |

## F. Genel
| # | Adım | Beklenen |
|---|---|---|
| F-1 | Yatay/dikey çevirme, koyu tema | Taşma ve okunmayan metin yok |
| F-2 | Geri tuşu | Uygulama beklenmedik biçimde kapanmıyor |

Sonuçları bu listeyle birlikte iletin. Yalnız **bütün A–E maddeleri "Geçti"** olduğunda K-7 (AAB ve Play Store) başlar.

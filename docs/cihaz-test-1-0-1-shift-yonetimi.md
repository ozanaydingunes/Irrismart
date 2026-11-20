# IrriGrow 1.0.1 — Android cihaz test listesi (Shift Yönetimi)

**Sürüm:** 1.0.1, versionCode 13, debug imzalı. Paket kimliği `com.irrigrow.app.dev`. Play Store üretim sürümü değildir.

**APK:** GitHub Actions → "APK derle" → main üzerindeki 1.0.1 çalıştırması → *Artifacts* → `IrriGrow-1.0.1-debug-apk`.
Zip içinde `IrriGrow-1.0.1-debug.apk` ve `.sha256` dosyası vardır.

Her maddeyi **Geçti / Kaldı / Denenmedi** olarak işaretleyin. "Kaldı" için ekran görüntüsü ve kısa bir not yeterli.
Önerilen proje: haritada çizilmiş bir parsel, su kaynağı ve debisi girilmiş, en az 4 shift'li.
Kendi büyük projenizi (ör. 225 da) önce **yedekleyin**.

## A. Güncelleme ve veri koruma (önce bunlar)
| # | Adım | Beklenen |
|---|---|---|
| A-1 | 1.0.0 yüklüyken Projeler → **Yedekle (JSON)** | Yedek dosyası oluşur |
| A-2 | 1.0.0'ı kaldırmadan 1.0.1 APK'yı kurun | "Güncelle" olarak kurulur; hata yok |
| A-3 | Projeler | Bütün projeler, adlar ve parseller aynı |
| A-4 | Ayarlar'ın altı | "IrriGrow v1.0.1" yazıyor |
| A-5 | Eski bir projede Sonuç ve Hidrolik ekranlarındaki shift sayısı, en büyük debi, H maks. ve pompa | 1.0.0'daki değerlerle aynı (ekran görüntüsüyle karşılaştırın) |
| A-6 | Elle shift ataması olan eski proje | Atama ve "elle düzenlendi" etiketi duruyor |

## B. Shift Yönetimi'ni açma
| # | Adım | Beklenen |
|---|---|---|
| B-1 | Hidrolik → üstte **Shift Yönetimi** | Panel tam ekran açılır; alt sekme çubuğu görünür |
| B-2 | Panel içeriği | Her shift için alan, **Debi (hesap)**, gerekli giriş basıncı (m ve bar), süre ve hacim, pompa görev noktası, açılacak vanalar (M1, M2…) |
| B-3 | Telefonu yan çevirin, sonra geri çevirin | Yatay kaydırma yok; düğmeler ekranda |
| B-4 | Sonuç → Mühendislik değerlendirmesi → W-HIZ-01 veya W-POM-01 kartı (varsa) → **Shiftleri Düzenle** | Aynı panel açılır |
| B-5 | Panelde **✕** veya **İptal** (değişiklik yokken) | Soru sorulmadan kapanır |

## C. Önizleme ve uygunluk
| # | Adım | Beklenen |
|---|---|---|
| C-1 | Shift sayısını bir artırın | "taslak" etiketi; **Önce / sonra** tablosu; en büyük debi azalır (yeşil fark) |
| C-2 | Bu aşamada uygulamayı kapatıp yeniden açın | Proje değişmemiş (önizleme kaydedilmez) |
| C-3 | **Uygunluk sınırları** bölümü | Kaynak debisi, kaynak günlük kapasitesi, günlük sulama süresi, tur süresi; her biri ✓ veya ✗, değer ve sınırla birlikte |
| C-4 | En yüksek shift sayısını seçin (✗ işaretli seçenek) | Tur süresi ✗; kırmızı "Bu düzen proje verisine göre uygun değil" notu |
| C-5 | Bu durumda **Uygula** → onay sorusunda **İptal** | Panel açık kalır; proje değişmez |
| C-6 | Veriler'de günlük çalışma süresi girilmemişse | "Günlük çalışma süresi girilmedi: varsayılan değer kullanıldı" notu görünür |

## D. Çalışma sırası ve hedef debi
| # | Adım | Beklenen |
|---|---|---|
| D-1 | Bir shift kartında ↓ veya ↑ | Kartların sırası ve "Sıra n" değişir; Önce/sonra tablosu **değişmez** |
| D-2 | **Hedef shift debisi** kutusuna bir değer girin (ör. 30) | Her kartta ayrı **Hedef debi (kullanıcı, bilgi)** satırı ve % fark görünür; "Debi (hesap)" değeri değişmez |
| D-3 | Hedef kutusuna `-5` veya harf girin | "Hedef debi pozitif bir sayı olmalı" uyarısı; değer kabul edilmez |
| D-4 | Hedef kutusunda ondalık için virgül kullanın (ör. `32,5`) | Kabul edilir |

## E. Harita vurgusu
| # | Adım | Beklenen |
|---|---|---|
| E-1 | Bir kartta **Haritada göster** | Arazi ekranı açılır; seçili shift belirgin renkte ve kalın kenarlı, diğerleri soluk; yalnız seçili shift'in kutusu görünür |
| E-2 | Üstteki "‹ Shift Yönetimi · Shift n" düğmesi | Panel aynı taslakla geri açılır |
| E-3 | Vurgu açıkken haritada yakınlaştırma/kaydırma | Akıcı; uygulama donmuyor |
| E-4 | Panel kapandıktan sonra harita | Bütün shift'ler normal renkte |

## F. Elle alt ünite taşıma
| # | Adım | Beklenen |
|---|---|---|
| F-1 | Kartta **Alt üniteleri taşı** → bir alt üniteyi "(yeni)" shift'e taşıyın | "elle düzenlendi" etiketi; shift sayısı ve kartlar güncellenir |
| F-2 | **İptal** → onayla | Proje değişmedi (Sonuç ekranında eski düzen) |
| F-3 | Aynı taşımayı yapıp **Uygula** | Panel kapanır; Sonuç'ta "elle düzenlendi"; Haritada Shift modunda yeni renkler |
| F-4 | Panelde **Otomatik düzene dön** → Uygula | Otomatik düzen gelir; elle atama kaybolmaz ("Elle atamayı geri getir" ile geri alınabilir) |

## G. Uygula, Geri Al, revizyon
| # | Adım | Beklenen |
|---|---|---|
| G-1 | Shift sayısını değiştirip, sırayı ve hedefi girip **Uygula** | "Shift düzeni uygulandı…" bildirimi |
| G-2 | Uygulamayı kapatıp açın | Yeni düzen, sıra ve hedef kayıtlı |
| G-3 | Hidrolik → **Son shift değişikliğini geri al** → onay | Önceki shift sayısı geri gelir; sıra ve hedef silinir |
| G-4 | Uygula'dan önce ve sonra Teknik Proje → pafta bilgisindeki revizyon numarası (R n) | Uygula sonrası revizyon numarası artmış (önceki hâl revizyon olarak saklandı) |

## H. Raporlar ve yedek
| # | Adım | Beklenen |
|---|---|---|
| H-1 | Çalışma sırası girilmiş projede **PDF rapor** | Shift'ler tablosu "Çalışma sırası" sütunuyla, girilen sırayla |
| H-2 | Aynı projede **Excel** | "Shift’ler" sayfası aynı sırayla; Özet'te "Hedef shift debisi (bilgi; hesabı değiştirmez)" |
| H-3 | Sıra girilmemiş projede PDF/Excel | Tablo 1.0.0'daki gibi (4 sütun) |
| H-4 | Projeler → Yedekle → yedeği başka cihazda/temiz kurulumda **Yedekten yükle** | Proje, elle atama, sıra ve hedef aynen gelir |
| H-5 | Aynı yedeği ikinci kez yükleyin | Yeni kopya oluşmaz |

## I. Genel
| # | Adım | Beklenen |
|---|---|---|
| I-1 | Dil İngilizce → Shift Yönetimi | Bütün panel metinleri İngilizce |
| I-2 | Koyu tema | Panel okunaklı |
| I-3 | Uçak modu → panel ve önizleme | Çalışıyor (harita görüntüsü hariç) |
| I-4 | Panel açıkken Veriler sekmesine geçin | "Shift Yönetimi taslağı kapatıldı (uygulanmadı)" bildirimi; proje değişmedi |

## Sonuç bildirimi
Kalan maddeler için madde numarası, cihaz modeli ve Android sürümü, ekran görüntüsü.

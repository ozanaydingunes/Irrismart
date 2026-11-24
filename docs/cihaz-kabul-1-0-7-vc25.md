# Gerçek cihaz kabul testi — IrriGrow 1.0.7 çoklu parsel düzeltmesi (versionCode 25)

- APK: `com.irrigrow.app.dev`, versionName 1.0.7, versionCode 25, commit b2f0f3e (PR #43), CI çalışması 45353267414
- APK dosyası SHA-256: `65f7ebe4a90af2b6334ad6295480e22dd51399608468cc4d4ac457b8cbe74880`
- İmza sertifikası SHA-256: `457741305275221a657c6594ff0e489316e2b1eef2c184bc4434c4e06bb20b2e` (depodaki debug anahtarı)
- Kurulum biçimi: telefondaki önceki 1.0.7 kurulumunun üzerine, uygulama kaldırılmadan
- Cihaz: kullanıcının Android telefonu (model bu kabul bildiriminde belirtilmedi)
- Testi yapan: proje sahibi (kullanıcı); sonuçlar kullanıcının bildirimidir

| # | Kontrol | Sonuç |
|---|---|---|
| 1 | APK kurulumu ve mevcut verilerin korunması | GEÇTİ |
| 2 | Belge + Damla katalog ikonu ve kataloglara erişim | GEÇTİ |
| 3 | KML/KMZ dosyalarından çoklu parsel aktarımı | GEÇTİ |
| 4 | Parsel değişimlerinde sınır, kaynak, Shift ve ekipman bilgilerinin korunması | GEÇTİ |
| 5 | Bağımsız hidrolik hesaplar ve ortak kaynak uyarısı | GEÇTİ |
| 6 | Parsel özeti, PDF/Excel ve JSON yedekleri | GEÇTİ |

**Sonuç: 6/6 GEÇTİ.** Bu sonuçla PR #43 (çoklu parsel düzeltmesi, masaüstü Arazi harita yerleşimi, Firma Katalogları ikonu) için birleştirme onayı verildi.

Emülatör güncelleme testi (çalışma 45353267414, API 30 / WebView 83 ve API 34 / WebView 113): versionCode 24 → 25 kaldırmadan kurulum, proje verisi bayt bayt korunması, katalog PDF'i ve ürün veritabanının korunması geçti; Android ve masaüstü parmak izi (iki parselli proje özeti dahil) aynı.

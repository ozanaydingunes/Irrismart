# Gerçek cihaz kabul testi — IrriGrow 1.0.5-test.18 (birleşik test APK)

- Tarih: 22.11.2026
- Cihaz: Samsung Galaxy S25 Ultra (SM-S938B), Android 17, WebView Chrome 157
- APK: `com.irrigrow.app.dev`, versionName 1.0.5-test.18, versionCode 18, commit 38becc3 (`claude/birlesik-test-1-0-5`)
- İmza sertifikası SHA-256: 457741305275221a657c6594ff0e489316e2b1eef2c184bc4434c4e06bb20b2e (depodaki debug anahtarı)
- Kurulum biçimi: mevcut 1.0.5 tanılama kurulumunun (versionCode 17) üzerine, uygulama kaldırılmadan
- Testi yapan: proje sahibi (kullanıcı); sonuçlar kullanıcının bildirimidir

| # | Kontrol | Sonuç |
|---|---|---|
| 1 | Kurulum (17 üzerine, kaldırmadan) | GEÇTİ |
| 2 | Proje verileri korundu | GEÇTİ |
| 3 | Shift Yönetimi | GEÇTİ |
| 4 | Shift kontrolleri (− / +, alt ünite ekleme, neden metinleri) | GEÇTİ |
| 5 | Firma Katalogları | GEÇTİ |
| 6 | Katalog kalıcılığı | GEÇTİ |

**Sonuç: 6/6 GEÇTİ.**

Önceki kayıt: 1.0.5 (versionCode 17) gerçek cihaz testinde Shift − / +, alt ünite ekleme ve uygunluk karşılaştırması başarısızdı; kök nedenler (panelin seçili karta kaydırılması, kısa ekranda çip satırının ezilmesi, eski WebView'da `inset` kısaltması, pasif düğmelerin nedensiz kalması) PR #38'de düzeltildi.

Bilinen sınırlama: 300 MB PDF Android 11'de gerçek dosya seçicisiyle denenmedi.

Emülatör güncelleme testi (çalışma 45002773289, API 30 ve 34): versionCode 17 → 18 kaldırmadan kurulum, proje verisi bayt bayt korunması, hesap sonuçlarının değişmemesi, JSON yedek uyumu ve katalog depolaması geçti.

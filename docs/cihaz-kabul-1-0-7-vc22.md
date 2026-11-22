# Gerçek cihaz kabul testi — IrriGrow 1.0.7 (versionCode 22)

- APK: `com.irrigrow.app.dev`, versionName 1.0.7, versionCode 22, commit 8516414 (`claude/surum-1-0-7`), CI çalışması 45041836368
- APK dosyası SHA-256: `7834202fd35a1e8cd0b9ed04942f5368512a1babc0c59a1e1ed41060c76afef8`
- İmza sertifikası SHA-256: `457741305275221a657c6594ff0e489316e2b1eef2c184bc4434c4e06bb20b2e` (depodaki debug anahtarı)
- Kurulum biçimi: telefondaki 1.0.7 (versionCode 21) kurulumunun üzerine, uygulama kaldırılmadan
- Cihaz: kullanıcının Android telefonu (model bu kabul bildiriminde belirtilmedi)
- Testi yapan: proje sahibi (kullanıcı); sonuçlar kullanıcının bildirimidir

| # | Kontrol | Sonuç |
|---|---|---|
| 1 | APK kurulumu; eski projelerin ve PDF kataloglarının korunması | GEÇTİ |
| 2 | Pompa, filtre, vana, boru ve bağlantı kategorilerinin teknik önerileri | GEÇTİ |
| 3 | Katalogda ürün olmadan teknik şartname oluşturulması | GEÇTİ |
| 4 | Sonradan eklenen doğrulanmış ürünün otomatik önerilmesi | GEÇTİ |
| 5 | Teknik şartname ve katalog ürününün malzeme listesine eklenmesi | GEÇTİ |
| 6 | Malzeme listesinin PDF ve Excel raporlarına doğru aktarılması | GEÇTİ |

**Sonuç: 6/6 GEÇTİ.** Bu sonuçla 1.0.7 son birleştirme onayı verildi (PR #41, PR #42 → main).

Önceki kayıt: 1.0.7 (versionCode 21) gerçek telefon testinde katalogda ürün yokken ekipman sekmeleri yalnız "Bu kategoride kayıtlı ürün yok" gösteriyordu; versionCode 22'de katalogdan bağımsız teknik şartname (Seviye 1) ve doğrulanmış ürün eşleştirmesi (Seviye 2) eklendi.

Emülatör güncelleme testi (çalışma 45041836368, API 30 / WebView 83 ve API 34 / WebView 113): versionCode 21 → 22 kaldırmadan kurulum, proje verisi bayt bayt korunması, katalog PDF'i (SHA-256 doğrulaması) ve ürün veritabanı korunması geçti; Android ve masaüstü parmak izi aynı (`656d1caf…`).

# Play Console — Veri güvenliği formu (öneri yanıtlar, IrriGrow 1.0.0)

> Yanıtlar uygulamanın 1.0.0 davranışına göredir (`docs/gizlilik-politikasi.md`). Harita/kot sağlayıcısı değişirse
> veya uygulamaya analiz, çökme raporu ya da reklam eklenirse form yeniden doldurulmalıdır. Son karar ve hukuki
> sorumluluk proje sahibindedir; belirsiz durumlarda **daha kapsayıcı (beyan eden)** yanıt önerilmiştir.

## Genel sorular
| Soru | Yanıt | Gerekçe |
|---|---|---|
| Uygulama gerekli kullanıcı veri türlerinden herhangi birini topluyor veya paylaşıyor mu? | **Evet** | Parsel koordinatları Open-Meteo'ya, harita bölgesi Esri'ye gider |
| Toplanan tüm veriler aktarım sırasında şifreleniyor mu? | **Evet** | Yalnız HTTPS uçları |
| Kullanıcılar verilerinin silinmesini isteyebilir mi? | **Evet** — uygulama içinden (proje sil / uygulamayı kaldır) | Geliştirici sunucusunda veri yok |

## Veri türleri
| Veri türü | Toplanıyor mu | Paylaşılıyor mu | Geçici işleme | Zorunlu mu | Amaç |
|---|---|---|---|---|---|
| **Konum → Kesin konum** | Evet (öneri) | Hayır* | Evet | İsteğe bağlı (yalnız "Uygula"/"◎") | Uygulama işlevi |
| Kişisel bilgiler (ad, e-posta…) | Hayır | Hayır | — | — | — |
| Finansal bilgiler | Hayır | Hayır | — | — | — |
| Dosyalar ve belgeler | Hayır (cihazda okunur, gönderilmez) | Hayır | — | — | — |
| Uygulama etkinliği, analiz, cihaz kimlikleri | Hayır | Hayır | — | — | — |
| Çökme kayıtları, tanılama | Hayır | Hayır | — | — | — |

\* Open-Meteo ve Esri, isteği yalnız yanıt üretmek için işleyen hizmet sağlayıcıları olarak değerlendirilmiştir;
Play'in tanımında hizmet sağlayıcıya aktarım "paylaşım" sayılmaz. Sağlayıcıların koşulları bunu karşılamıyorsa
"Paylaşılıyor: Evet" işaretlenmelidir (K-7 §4 lisans kararıyla birlikte gözden geçirin).

## İzinler (Play beyanı ile tutarlı olmalı)
- `INTERNET` — harita ve yükseklik verisi.
- `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` — yalnız ön planda, "◎" düğmesiyle haritayı ortalamak için.
- `READ/WRITE_EXTERNAL_STORAGE` — yalnız eski Android sürümlerinde (maxSdk 29/32) rapor kaydetme ve dosya seçme.

## Güvenlik uygulamaları
- Hesap yok; kimlik doğrulama yok. Reklam SDK'sı yok. Analiz SDK'sı yok.
- Bağımsız güvenlik incelemesi: yapılmadı (beyan "Hayır").

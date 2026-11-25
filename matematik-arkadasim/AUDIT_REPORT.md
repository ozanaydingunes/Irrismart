# Denetim Raporu — Matematik Arkadaşım

**Tarih:** 25.11.2026 · **Kapsam:** `matematik-arkadasim/` klasörü (dal `claude/matematik-arkadas-ai-app-xjrmfw`, ilk sürüm `cd86f28`)
**Yöntem:** Kaynak kodun satır satır incelenmesi, mevcut testlerin yeniden çalıştırılması, 117 soruluk yeni
doğruluk kümesiyle ölçüm, sahte HTTP yanıtlarıyla sağlayıcı testleri, Playwright ile tarayıcı testleri.

> **Doğrulanamayanlar (dürüst bildirim)**
> - **Gerçek yapay zekâ API'si:** Bu ortamda uygulama için Anthropic/OpenAI anahtarı yok. Hiçbir gerçek API
>   çağrısı yapılmadı; yapay zekâ entegrasyonu yalnızca sahte HTTP yanıtlarıyla test edildi.
> - **Model adları:** `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-opus-5-5` Anthropic'in güncel model
>   listesinde yer alıyor (geliştirme aracının belgelerine göre). OpenAI tarafında `gpt-4.1` / `gpt-4.1-mini`
>   **doğrulanamadı**; anahtar eklenince hesapta erişilebilir bir model adıyla değiştirilmeli.
> - **MEB 7. sınıf programı:** Resmî siteler (`tymm.meb.gov.tr`, `mufredat.meb.gov.tr`) bu ortamdan erişilemedi.
>   Konu listesi bilinen 7. sınıf konularına dayanıyor; güncel Maarif Modeli programıyla birebir uyumu
>   **doğrulanmadı**.
> - **Fiziksel cihazlar:** iPhone Safari ve Android Chrome'da ses ve kamera denenmedi (başsız Chromium kullanıldı).

## Özet

| Kategori | Bulunan | Düzeltilen | Kalan |
|---|---|---|---|
| Kritik hatalar | 4 | 4 | 0 (K3 için Upstash kurulumu gerekir) |
| Matematiksel doğruluk | 3 | 3 | 0 |
| Yapay zekâ entegrasyonu | 7 | 6 | 1 (gerçek API testi) |
| Güvenlik | 7 | 7 | 0 |
| Performans | 2 | 2 | 0 |
| Mobil uyumluluk | 5 | 5 | 0 (fiziksel cihaz testi bekliyor) |
| Kullanıcı deneyimi | 6 | 6 | 0 |
| Eksik testler | 6 | 4 | 2 (gerçek API, gerçek cihaz) |

## 1. Kritik hatalar

| No | Sorun | Etki | Durum |
|---|---|---|---|
| K1 | **Demo çözücü sözel problemlerde güvenle yanlış cevap veriyordu.** Sözcükleri silip kalan sayılarla işlem yapıyordu ("Ali parasının 2/5'i ile 60 TL'lik kitap aldı" → 150 yerine 24). Yeni test kümesinde 37 denemenin 12'si yanlıştı. | Öğrenciye yanlış öğretim | ✅ Düzeltildi: yalnızca saf işlem/denklem kalıpları çözülüyor (24/24 doğru, geri kalanı "kapsam dışı") |
| K2 | **Erişim kontrolü yoktu.** Yayınlanan adresi bilen herkes API kredisini harcayabilirdi. | Maliyet, kötüye kullanım | ✅ İsteğe bağlı aile PIN'i (imzalı HttpOnly çerez, deneme sınırı) + günlük harcama sınırı |
| K3 | **Kota ve hız sınırı bellekteydi.** Sunucusuz ortamda (Vercel) her örnek ayrı saydığı için sınırlar etkisizdi; yeniden başlatmada sıfırlanıyordu. | Maliyet kontrolü yok | ✅ Upstash Redis REST ile kalıcı depo (yapılandırılınca); yoksa üretimde uyarı |
| K4 | **Güvenlik reddinde başka modele geçiliyordu** (`fallbacks: "default"`). | Proje kuralına aykırı | ✅ Kaldırıldı; red nazik bir Türkçe mesajla bildiriliyor; testle güvence altında |

## 2. Matematiksel doğruluk

| No | Sorun | Durum |
|---|---|---|
| M1 | K1 ile aynı kök neden: "%25'i" gibi kalıpların cümle içinde gevşek eşleşmesi ("Bir sayının %40'ı 36 ise…" → yanlış) | ✅ Yüzde kalıbı artık sorunun tamamıyla eşleşmeli |
| M2 | "x/6 = 10/15 orantısında x kaçtır?" → sondaki "x" çarpan sanılıp `x = 0` bulunuyordu | ✅ Düzeltildi (sözel kalıp → kapsam dışı) |
| M3 | Birim sözcüklerinin (kuruş, öğrenci…) ayıklanmasında `\b` Türkçe harflerde çalışmıyordu | ✅ Harf sınırı düzenli ifadesi |

Ölçüm: 117 soruluk küme (`tests/data/questionBank.ts`). Her beklenen cevap, cevap metninden **bağımsız** bir
hesapla testte yeniden doğrulanıyor (117/117 tutarlı).

## 3. Yapay zekâ entegrasyonu

| No | Sorun | Durum |
|---|---|---|
| A1 | Varsayılan model en pahalısıydı (Opus) | ✅ Varsayılan `claude-sonnet-5-5`; cevap kontrolü/ipucu için `claude-haiku-5-5`; seçenekler `.env.example`'da |
| A2 | Zaman aşımı 120 sn ve 2 yeniden deneme → toplam süre sunucu fonksiyon sınırını (120 sn) aşabiliyordu | ✅ İstek başına 100 sn bütçe, deneme başına ≤55 sn, en fazla 1 yeniden deneme; onarım çağrısı yalnızca süre yetiyorsa |
| A3 | OpenAI'de yeniden deneme yoktu | ✅ 429/5xx/ağ hatasında 1 kez, gecikmeli |
| A4 | Bakiye/kota bitti, geçersiz anahtar ve geçici hatalar ayırt edilmiyordu | ✅ `auth`, `billing`, `rate`, `overloaded`, `timeout`, `network`, `refusal` türleri ve her biri için Türkçe mesaj |
| A5 | Fotoğrafta birden fazla soru durumu yoktu (model rastgele birini seçebilirdi) | ✅ `status: "multiple"` → öğrenciye seçim ekranı |
| A6 | Fotoğraftan okunan soru öğrenciye doğrulatılmıyordu | ✅ "Doğru okumuş muyum?" kartı, okuma notu (`readingNote`), düzeltip yeniden çözme |
| A7 | Gerçek API ile hiç denenmedi | ⏳ **Kalan:** anahtar gerekli (`npm run eval:ai`, maliyet onaylı) |

Yapılandırılmış çıktı: Yanıtlar JSON olarak isteniyor, Zod ile doğrulanıyor, geçersizse bir kez onarım isteniyor.
Anthropic'in `output_config.format` (JSON şeması) özelliği gerçek API'de denenemediği için kullanılmadı;
öneriler bölümüne eklendi.

## 4. Güvenlik

| No | Sorun | Durum |
|---|---|---|
| G1 | İstem enjeksiyonu: öğrenci metni `"""` ile sarılıyordu (kolayca kaçılabilir); istemciden gelen çözüm metni filtresiz isteme giriyordu | ✅ `<ogrenci_sorusu>` veri etiketleri, etiket kaçışı/kontrol karakteri temizliği, sistem isteminde "yalnızca veri" kuralı |
| G2 | Hata mesajları loglara maskelenmeden yazılıyordu | ✅ `logError` + `redact`: anahtar, Bearer ve görsel verisi maskelenir; istek gövdesi asla loglanmaz |
| G3 | CSP ve HSTS başlıkları yoktu | ✅ Sıkı CSP (harici kaynak yok, `frame-ancestors 'none'`), üretimde HSTS, COOP |
| G4 | 4 MB görsel + base64 şişmesi Vercel'in ~4,5 MB gövde sınırını aşıyordu | ✅ Varsayılan 3 MB |
| G5 | IP adresi sayaç anahtarında açık hâlde tutuluyordu | ✅ SHA-256 özetleniyor |
| G6 | TTS ucu yalnızca bellek içi sınıra sahipti, harcamaya dahil değildi | ✅ Kalıcı dakikalık sınır + günlük bütçeye dahil |
| G7 | IP başlığı seçimi taklit edilebilir `x-forwarded-for`'a öncelik veriyordu | ✅ Vercel'de platformun yazdığı `x-vercel-forwarded-for` / `x-real-ip` öncelikli |

Doğrulananlar: API anahtarları yalnızca sunucuda (`src/lib/server/config.ts`); `NEXT_PUBLIC_` önekli gizli değişken
yok; `/api/status` anahtar döndürmüyor (test); service worker `/api/*` ve POST isteklerini önbelleğe almıyor (test);
`.env*` dosyaları `.gitignore`'da; `npm audit` 0 açık.

## 5. Performans

| No | Sorun | Durum |
|---|---|---|
| P1 | A2 (zaman aşımı zinciri) | ✅ |
| P2 | Pahalı model her çağrıda (cevap kontrolü dahil) | ✅ Hafif görevler ucuz modelde; yerel karar verilebilen cevap kontrolleri hiç YZ'ye gitmiyor |

## 6. Mobil uyumluluk

| No | Sorun | Durum |
|---|---|---|
| U1 | Alt menüde 6 öğe ve 10,5 px yazı | ✅ 3 sayfa + "Diğer" menüsü, 12 px+ |
| U2 | Hız düğmeleri 36 px (44 px altı) | ✅ 44 px; e2e testi 40 px altı dokunma hedefi olmadığını doğruluyor |
| U3 | iOS Safari kullanıcı dokunuşu dışında başlayan konuşmayı yok sayar | ✅ "Soruyu çöz" dokunuşunda ses kilidi açılıyor (cihazda doğrulanmadı) |
| U4 | Android Chrome `cancel()`'dan hemen sonraki `speak()`'i yutabiliyor | ✅ 80 ms gecikme (cihazda doğrulanmadı) |
| U5 | Logo degrade kimliği çakışması mobilde logoyu soluk gösteriyordu | ✅ Benzersiz kimlik |

## 7. Kullanıcı deneyimi

| No | Sorun | Durum |
|---|---|---|
| X1 | Ana ekranda öncelik yoktu (tanıtım bloğu, çok sayıda kart) | ✅ Üç büyük işlem: Fotoğraf çek · Soru yükle · Soru yaz |
| X2 | Duraklatınca tahta animasyonları sürüyordu | ✅ Animasyonlar da duraklıyor, devamda kaldığı yerden sürüyor |
| X3 | Sayfa değişince sunucu sesi / tarayıcı sesi susmayabiliyordu; iki ses üst üste binebiliyordu | ✅ Tek ses kuralı (`stopAllSpeech`), sayfa ve soru değişiminde durdurma |
| X4 | "Kendini değerlendir" tekrar tıklanınca gelişim istatistiği şişiyordu | ✅ Ders başına tek kayıt |
| X5 | Defterden tekrar çözmede tekrar sayacı artmıyordu | ✅ |
| X6 | Sürekli yanıp sönen halka animasyonları dikkat dağıtıyordu; mod seçimi her zaman açıktı | ✅ Kaldırıldı; mod seçimi katlanabilir |

## 8. Öğretim kalitesi

- Demo çözücüde "Sabit terimi karşı tarafa geçirelim" gibi ezber dil vardı → "Her iki taraftan 5 çıkaralım";
  anlatım "Eşitliğin dengesini bozmamak için…" diye nedenini söylüyor (testle güvence).
- Sistem istemine 7 adımlı öğretim sırası, iyi/kötü anlatım örneği ve "küçümseme yok" kuralı eklendi.

## 9. Eksik testler

| Test | Durum |
|---|---|
| ≥100 soruluk doğruluk kümesi | ✅ 117 soru |
| Sağlayıcı hata/yeniden deneme testleri | ✅ Sahte HTTP yanıtlarıyla |
| Kalıcı kota, PIN, istem enjeksiyonu, log maskeleme | ✅ |
| Fotoğraf akışları (çoklu soru, doğrulatma, kesik soru) | ✅ Test sağlayıcısıyla uçtan uca |
| Gerçek API doğruluk ölçümü | ⏳ Anahtar gerekli |
| Gerçek cihazda ses/kamera | ⏳ Manuel liste: `FINAL_REPORT.md` |

# Son Rapor — Matematik Arkadaşım (sağlamlaştırma sürümü)

**Tarih:** 25.11.2026 · **Dal:** `claude/matematik-arkadas-ai-app-xjrmfw` · Tüm değişiklikler `matematik-arkadasim/` içinde;
IrriGrow ve depo kökü değiştirilmedi.

> **Önemli:** Bu ortamda gerçek bir yapay zekâ API anahtarı yoktu. **Hiçbir gerçek API çağrısı yapılmadı.**
> Aşağıdaki yapay zekâ sonuçları sahte (simüle) HTTP yanıtlarıyla yapılan testlere dayanır. Gerçek doğruluk
> oranı henüz ölçülmedi.

## 1. Tespit edilen sorunlar

Ayrıntı: `AUDIT_REPORT.md`. Toplam 40 sorun (4 kritik). En önemlileri:
1. **Demo çözücü sözel problemlerde güvenle yanlış cevap veriyordu** (37 denemede 12 yanlış).
2. **Erişim kontrolü yoktu**: adresi bilen herkes API kredisini harcayabilirdi.
3. **Kota/hız sınırı bellekteydi**: Vercel gibi sunucusuz ortamda etkisizdi.
4. **Güvenlik reddinde başka modele geçiliyordu** (proje kuralına aykırı).
5. Zaman aşımı zinciri sunucu fonksiyon süresini aşabiliyordu; OpenAI'de yeniden deneme yoktu; bakiye/kota hataları ayırt edilmiyordu.
6. İstem enjeksiyonuna açık sınırlayıcılar; maskelenmemiş loglar; CSP/HSTS yok.
7. Görsel boyutu Vercel gövde sınırını aşabiliyordu.
8. Fotoğrafta birden fazla soru ve okunan metni doğrulatma akışı yoktu.
9. Ses: duraklatınca animasyon sürüyordu; sayfa değişince ses susmayabiliyordu; iOS/Android farkları ele alınmamıştı.
10. Mobil: 6 öğeli alt menü, 36 px düğmeler, dağınık ana ekran, sürekli yanıp sönen animasyonlar.

## 2. Düzeltilen sorunlar

| Alan | Yapılan |
|---|---|
| Matematik | Demo çözücü yalnızca saf işlem/denklem kalıplarını çözer (24/24 doğru); sözel problemler "kapsam dışı" |
| YZ | `fallbacks` kaldırıldı; varsayılan `claude-sonnet-5-5`, hafif görevlerde `claude-haiku-5-5`; 100 sn istek bütçesi; sınırlı yeniden deneme (Anthropic SDK + OpenAI); 7 ayrı hata türü ve Türkçe mesajlar; çoklu soru (`multiple`); okuma notu ve öğrenciye doğrulatma |
| Öğretim | Sistem isteminde 7 adımlı öğretim sırası, iyi/kötü anlatım örneği, küçümseme yasağı; demo anlatımında "karşı tarafa geçir" yerine "eşitliğin dengesini bozmamak için her iki taraftan…" |
| Maliyet | Kalıcı sayaç deposu (Upstash REST), oturum + IP hız sınırı, günlük istek kotası, **günlük USD harcama sınırı**, TTS harcamaya dahil |
| Güvenlik | Aile PIN'i (HMAC imzalı HttpOnly/SameSite=Strict çerez, 15 dk'da 5 deneme), veri etiketleriyle istem enjeksiyonu koruması, log maskeleme, CSP + HSTS + COOP, IP'lerin özetlenmesi, 3 MB görsel sınırı |
| Ses / tahta | Duraklatınca animasyonlar da durur; tek ses kuralı; sayfa/soru değişiminde ses kesilir; iOS ses kilidi açma; Android cancel→speak gecikmesi |
| Mobil / UX | Ana ekranda 3 büyük işlem; alt menü 4 öğe + "Diğer"; ≥44 px dokunma hedefleri; katlanabilir mod seçimi; yanıp sönen animasyonlar kaldırıldı; logo hatası; `/gizlilik` sayfası |
| İstatistik | "Kendini değerlendir" tekrar tıklanınca şişme ve tekrar sayacı hataları |

## 3. Başarılı testler (bu ortamda gerçekten çalıştırıldı)

| Kontrol | Sonuç |
|---|---|
| `npm run typecheck` | ✅ Hatasız |
| `npm run lint` | ✅ Hatasız |
| `npm test` (Vitest) | ✅ **304 geçti**, 1 atlandı (ücretli gerçek YZ değerlendirmesi, bilerek) |
| `npm run build` | ✅ Başarılı (Next.js 16.4.6) |
| `npm run test:e2e` (Playwright, Chromium) | ✅ **18/18 senaryo** (demo + test sağlayıcısı/PIN sunucusu), konsol hatası yok |
| `npm audit` (tüm ve yalnızca üretim bağımlılıkları) | ✅ 0 açık |

Önemli test grupları: 117 soruluk doğruluk kümesi (beklenen cevaplar bağımsız hesapla doğrulanıyor), sağlayıcı
hata/yeniden deneme senaryoları (sahte HTTP), çoklu soru/okunamayan/kesik soru akışı, kalıcı kota ve harcama
sınırı, PIN çerezi, istem enjeksiyonu, log maskeleme, service worker'ın API yanıtlarını önbelleğe almaması,
güvenlik başlıkları, mobilde dokunma hedefleri, anlatım kalitesi.

## 4. Başarısız testler

Son çalıştırmada başarısız test yok. Geliştirme sırasında başarısız olan ve düzeltilen: doğruluk kümesindeki
demo çözücü testi (12 yanlış cevap → K1 düzeltmesi), bir kota testi beklentisi (test hatası, düzeltildi).

## 5. Gerçek API test sonuçları

**Yapılmadı.** Anthropic veya OpenAI anahtarı bu ortamda yoktu; sohbet yoluyla anahtar istenmedi.
Hazırlanan araç: `npm run eval:ai`. Önce yalnızca tahmini maliyeti yazar; `AI_EVAL_CONFIRM=1` ile soruları
gönderir ve sonuçları "doğru / yanlış / doğru sonuç ama adımlarda tutarsızlık / hata" olarak
`reports/ai-eval-*.md` dosyasına yazar. 117 soru için tahmini maliyet: Haiku ~0,30 USD, Sonnet ~6 USD, Opus ~12 USD.

Doğrulanmamış varsayımlar: Anthropic SDK 1.13.0 ile `thinking: {type: "adaptive"}` + `output_config.effort` +
akış (stream) parametrelerinin derlenmesi doğrulandı; sunucunun bu parametreleri seçilen modelle kabul ettiği
**gerçek çağrıyla doğrulanmadı**. OpenAI model adı (`gpt-4.1`) doğrulanmadı.

## 6. Matematiksel doğruluk oranı

| Çözücü | Denenen | Doğru | Yanlış | Kapsam dışı | Oran |
|---|---|---|---|---|---|
| Demo (kural tabanlı) — düzeltme öncesi | 37 | 25 | **12** | 80 | %67,6 |
| Demo (kural tabanlı) — düzeltme sonrası | 24 | 24 | 0 | 93 | **%100** (yalnızca kapsadığı sorularda) |
| Gerçek yapay zekâ | — | — | — | — | **Ölçülmedi** (anahtar yok) |

Demo çözücünün kapsamı bilinçli olarak dar: tam sayı/kesir/ondalık işlemleri, birinci dereceden denklemler ve
"N sayısının %P'si". Diğer her şey (problemler, geometri, veri) gerçek yapay zekâ gerektirir. Ayrıntılı satırlar:
`reports/demo-accuracy.json` (test sırasında üretilir).

## 7. Sesli anlatım test sonuçları

**Otomatik olarak doğrulananlar** (başsız Chromium, Türkçe ses yok → yazılı anlatım yolu):
- Adım kuyruğu: bir adımın sesi bitmeden sonraki adıma geçilmiyor; duraklat/devam aynı cümleden sürüyor;
  önceki/sonraki adım geçişinde eski kuyruk temizleniyor; hız değişimi; öğrenci sorusunda bekleme (birim testleri).
- Matematik → Türkçe konuşma çevirisi (x², 3/5, √25, 2x + 5 = 15, LaTeX kesirleri…).
- Türkçe ses yokken uyarı gösterilip yazılı anlatımla devam ediliyor (e2e).
- Duraklatınca tahtaya `board-paused` uygulanıyor.

**Gerçek cihazda test edilmesi gerekenler (manuel liste):**

| # | Cihaz | Adım | Beklenen |
|---|---|---|---|
| S1 | iPhone Safari | Türkçe ses yüklüyken "Soruyu çöz" | Çözüm gelince anlatım kendiliğinden başlar (başlamazsa Oynat'a dokununca başlamalı) |
| S2 | iPhone Safari | Oynatırken Duraklat → Devam | Aynı cümleden devam; tahta animasyonu da durup devam eder |
| S3 | iPhone Safari | Oynatırken uygulamayı arka plana al | Ses durur; geri gelince Oynat ile devam |
| S4 | Android Chrome | Hızlıca İleri/İleri/Geri | Tek ses; üst üste binme yok; doğru adım konuşulur |
| S5 | Android Chrome | 1,5x ve 0,75x hız | Hız değişir; adım atlanmaz |
| S6 | Masaüstü Chrome | 30 sn'den uzun anlatım | Kesilmeden sürer (cümle bölme) |
| S7 | Masaüstü Firefox | Sesle soru sor | "Desteklenmiyor" mesajı; yazarak devam |
| S8 | Hepsi | Ayarlar → Kadın/Erkek ses | Cihazda varsa değişir (ad tahminine dayalı) |
| S9 | Hepsi | Oynatırken başka sayfaya geç | Ses hemen susar |
| S10 | Hepsi | Oynatırken "Yeni soru" | Önceki anlatım iptal olur |
| S11 | Hepsi | Özel derste "Neden böyle yaptık?" | Ana anlatım durur, öğretmen yanıtı okunur; Oynat'a basınca yanıt susar |
| S12 | (TTS_PROVIDER=openai ise) | Ses kaynağı: Doğal ses | Sunucu sesi çalar; tarayıcı sesiyle çakışmaz |

**Fotoğraf senaryoları (gerçek YZ + gerçek fotoğrafla manuel):** net kitap fotoğrafı, hafif bulanık, eğik çekim,
el yazısı, geometri şekilli, grafik içeren, tablo içeren, çoktan seçmeli, aynı fotoğrafta iki soru, alt kısmı
kesik soru. Beklenen: kesik/okunamayan bilgide tahmin yerine "daha net fotoğraf" mesajı; iki soruda seçim
ekranı; her çözümde "Doğru okumuş muyum?" kartı. Test sağlayıcısıyla akışın kendisi doğrulandı; modelin bu
fotoğraflardaki gerçek davranışı **doğrulanmadı**.

## 8. Kalan sınırlamalar

- Gerçek yapay zekâ doğruluğu ve fotoğraf okuma kalitesi ölçülmedi.
- MEB 7. sınıf (Türkiye Yüzyılı Maarif Modeli) programının resmî metni doğrulanamadı; konu listesi bilinen 7. sınıf konularına dayanıyor.
- Konuşulan cümle vurgulanıyor; kelime/sayı düzeyinde eş zamanlı vurgu yok (Web Speech `boundary` olayı tarayıcılar arasında tutarsız).
- Kadın/erkek ses ayrımı ses adından tahmin ediliyor.
- Kota deposu yapılandırılmazsa (Upstash) sınırlar sunucusuz ortamda güvenilir değil (üretim logunda uyarı verilir).
- Harcama hesabı fiyat tablosuna dayalı tahmindir; kesin fatura sağlayıcı konsolundadır. Konsolda ayrıca aylık limit belirlenmeli.
- Yapılandırılmış çıktı için sağlayıcının JSON şeması özelliği (Anthropic `output_config.format`) gerçek API'de denenemediği için kullanılmadı; şu an istem + Zod + bir onarım denemesi kullanılıyor.
- Aile PIN'i tek ortak PIN'dir; kişi bazlı hesap yoktur (bilinçli: çocuk verisi toplamamak için).

## 9. Yayınlama için gerekli işlemler

Ayrıntı: `DEPLOYMENT_GUIDE.md`.
1. Anthropic (veya OpenAI) anahtarı oluştur, konsolda aylık harcama limiti koy.
2. Upstash Redis (ücretsiz) oluştur.
3. Vercel'de projeyi **Root Directory = `matematik-arkadasim`** ile içe aktar, Node 22.
4. Ortam değişkenlerini gir: `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `APP_ACCESS_PIN`, `APP_SESSION_SECRET` (32+ karakter), `UPSTASH_REDIS_REST_URL/TOKEN`, `DAILY_BUDGET_USD`.
5. Önce Preview dağıtımında 3.5'teki kontrol listesini uygula; sonra kendi kararınla Production'a al.

## 10. Senin manuel olarak yapman gerekenler

1. API anahtarını **yalnızca** `.env.local` dosyasına veya Vercel ortam değişkenlerine gir (sohbete/koda değil).
2. `npm run eval:ai` ile tahmini maliyeti gör; uygun bulursan `AI_EVAL_CONFIRM=1 AI_EVAL_LIMIT=10 npm run eval:ai` ile küçük bir gerçek test yap, sonra tamamını çalıştır ve `reports/ai-eval-*.md` sonucunu incele.
3. Gerçek telefonlarda 7. bölümdeki ses (S1–S12) ve fotoğraf senaryolarını dene.
4. MEB 7. sınıf güncel öğretim programını resmî siteden kontrol et; `src/lib/topics.ts` konu listesini gerekirse güncelle.
5. Upstash ve Vercel hesaplarını oluşturup yayınla (ücretli plan gerekip gerekmediğine sen karar ver).
6. Uygulamayı başka ailelere açacaksan gizlilik metni ve veli onayı süreçlerini hukuki açıdan değerlendir.
7. Bu dalı ana dala birleştirmek istersen bir Pull Request oluşturmamı isteyebilirsin (izinsiz oluşturulmadı).

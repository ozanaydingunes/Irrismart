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


---

# Ek: Son tasarım iyileştirmesi (25.11.2026)

## Yapılanlar
| Alan | Değişiklik |
|---|---|
| Alt menü çakışması | İçerik alt boşluğu artık `menü yüksekliği + safe-area-inset-bottom + 1,5 rem`; "Diğer" menüsü ev çubuğunun üstünde açılıyor; üst çubukta çentik için `safe-area-inset-top` |
| Odak çerçevesi | Alt menüde odak halkası içeride çiziliyor (ekran kenarından taşmıyor), klavyeyle görünür |
| Yatay taşma | `overflow-x: clip` + ders ızgarasında `min-w-0`; oynatıcı düğmeleri dar ekranda satır kırabiliyor |
| Logo kontrastı | Degrade koyulaştırıldı (beyaz çizgi kontrastı ≈3,6:1 → ≥4,7:1); PWA ikonları yeniden üretildi |
| Ana ekran | Kompakt karşılama kartı + özgün "Pi Hoca" maskotu (SVG), belirgin "Fotoğraf çek", yan yana "Soru yükle / Soru yaz", "Sesle sor", "Soru defterim / Gelişimim" kısayolları; üst çubukta logo + ayarlar; sahte istatistik yok |
| Demo uyarısı | İşlem düğmelerinin üstünde, hiçbir menünün arkasında değil (testle doğrulandı) |
| Sesli ders | Tahta merkezde; verilenler/istenen katlanabilir özet; mod seçimi katlanabilir; önceki adımlar formülleriyle okunur kalıyor; oynatıcıda belirgin **Anlamadım** ve **Tekrar dinle**; telefonda hız/ses ayarları katlanır; uzun formüller "⇒" noktalarından alt satıra geçebiliyor |
| Ses | Öğretmene yeni soru sorulunca önceki anlatım ve önceki yanıt susuyor |
| Kurulum | Sade, adım adım `KURULUM_REHBERI.md`; `npm run api:test` (1 soru, ücretli, ~0,05 USD) |

## Bu turda bulunup düzeltilen hatalar
1. **Duraklatılmışken adım değiştirilince formül ve çizim görünmez kalıyordu** (önceki turda eklenen "duraklatınca animasyon dursun" özelliğinin yan etkisi; animasyon ilk karede donuyordu). Artık animasyon yalnızca o adım oynarken duraklatılırsa donuyor. Yeni e2e testi opaklık ve kırpmayı kontrol ediyor.
2. **320 px genişlikte ders ekranı sağdan kesiliyordu** (oynatıcı düğmeleri ızgarayı genişletiyordu). İlk taşma testi `overflow-x: clip` yüzünden bunu göremiyordu; test artık ekran dışına taşan görünür öğeleri tek tek arıyor.
3. 320 px'de oynatıcı tahtanın yarısını kapatıyordu → kompakt oynatıcı.
4. Demo açıklamasında değişken adı cümle başında büyük harfe çevriliyordu ("X terimini").

## Bu turun gerçek test sonuçları
| Kontrol | Sonuç |
|---|---|
| Typecheck | ✅ |
| Lint | ✅ |
| Birim testleri | ✅ 304 geçti, 1 atlandı (ücretli gerçek YZ testi) |
| Uçtan uca (Playwright/Chromium) | ✅ **27/27** |
| Build | ✅ |
| `npm audit` | ✅ 0 açık |
| Ekran boyutu matrisi | ✅ 320×568, 360×800, 375×667, 390×844, 430×932, tablet 820×1180, masaüstü 1440×900 — her birinde ana ekran, soru yükleme, sesli ders, soru defteri, ayarlar: ekran dışına taşan öğe yok, alt menü son içeriği kapatmıyor, demo uyarısı açıkta, aktif adım oynatıcının altında kalmıyor |
| Gerçek YZ API | ⛔ Yapılmadı (anahtar yok) |
| Gerçek telefon (ses, kamera) | ⛔ Yapılmadı (manuel liste 7. bölümde) |

Güncel görüntüler: `docs/ekran-goruntuleri/` (ana ekran ve sesli ders, 390×844 ve 320×568, koyu tema).
Tüm ölçülerde görüntüler `npm run test:e2e` ile `e2e/screens/` klasörüne üretilir.

## Gerçek kullanım için yapman gerekenler (sırayla)
1. **Anthropic hesabı aç**, Billing'den küçük bir bakiye yükle, **Limits**'ten aylık harcama sınırı koy (ör. 10 USD).
2. **API anahtarı oluştur** (API Keys → Create Key). Anahtarı hiçbir yere yazma; 4. adımda doğrudan Vercel'e yapıştıracaksın.
3. **Vercel'de projeyi oluştur:** GitHub'daki `irrismart` deposunu içe aktar, **Root Directory = `matematik-arkadasim`**.
4. **Ortam değişkenlerini gir:** `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-sonnet-5-5`, `APP_ACCESS_PIN`, `APP_SESSION_SECRET` (32+ karakter rastgele), `DAILY_BUDGET_USD=1`.
5. **Upstash Redis ekle** (Vercel → Storage → Upstash, ücretsiz) ve projeye bağla.
6. **Deploy** et. Açılan adreste **DEMO** etiketi görünmemeli.
7. **Bağlantıyı test et:** PIN'i gir, `3/4 + 1/6 işleminin sonucu kaçtır?` yaz → rozet "Yapay zekâ çözümü", sonuç 11/12 olmalı. Sonra kitaptan bir soru fotoğrafı çek.
8. **Telefona ekle:** iPhone'da Safari → Paylaş → Ana Ekrana Ekle; Android'de Chrome → ⋮ → Ana ekrana ekle. Telefonun ayarlarından Türkçe metin okuma sesini indir.
9. **Öğrenciyle bir hafta dene:** 7. bölümdeki ses (S1–S12) ve fotoğraf senaryolarını gözlemle; yanlış çözülen soruları not et.
10. İstersen bilgisayarında `npm run eval:ai` ile önce maliyet tahminini gör, uygun bulursan 117 soruluk doğruluk ölçümünü çalıştır (Sonnet ile ~6 USD).

Ayrıntılı ve resimsiz sade anlatım: `KURULUM_REHBERI.md`. Teknik ayrıntılar: `DEPLOYMENT_GUIDE.md`.

**Bu aşamadan sonra yeni özellik geliştirilmedi.** Öncelik: gerçek API bağlantısı ve öğrenci kullanım testleri.

---

# Ek: Ücretsiz ev kurulumu ve çoklu cihaz (25.11.2026)

## Yapılanlar
- **Yerel yapay zekâ (Ollama)** varsayılan sağlayıcı oldu. 8 GB RAM için varsayılan model `gemma3:4b`,
  bağlam penceresi 8192. Ücretli API yalnızca `ALLOW_PAID_AI=1` ile açılır ve asla yedek olarak devreye girmez.
- **Tek seferde tek YZ isteği.** En fazla 2 istek sırada bekler. Fazlası "Pi Hoca şu an başka bir
  soruyu çözüyor" mesajı alır.
- **Günlük soru sınırı** varsayılan olarak 10'dur ve sunucuda uygulanır. Ebeveyn PIN'iyle Ayarlar ekranından değiştirilir.
- **Telefon ve tablet erişimi.** Uygulama 127.0.0.1'de dinler. Cihazlar Tailscale Serve ile HTTPS
  adresinden bağlanır, böylece mikrofon ve PWA çalışır. Port yönlendirme, güvenlik duvarı değişikliği
  veya Ollama'nın dışa açılması gerekmez. İsteğe bağlı `--wifi` modu da var (HTTP; mikrofon ve PWA sınırlı).
- **Bilgisayar kapalı uyarısı.** "Pi Hoca'nın bilgisayarına bağlanılamıyor…" mesajı gösterilir, 20 sn'de bir otomatik yeniden denenir.
- **Cihazlar arası eşitleme.** Soru defteri, cevaplar, dersler ve çalışma süresi yalnızca ev bilgisayarında
  (`.data/esitleme.json`) tutulur. Çakışmada son değişiklik geçerli olur. Silmeler diğer cihazlara yayılır.
  Fotoğraflar eşitlenmez. Aile PIN'i gerekir.
- **Tablet düzeni.** Yan menü (ray), xl altında tam genişlik tahta, md+ ekranda daha büyük formüller.
  Dikey ve yatay kullanım desteklenir.
- **Windows başlatıcıları:** `scripts/windows/PiHoca-Baslat.bat` ve `PiHoca-Baslat-WiFi.bat`.
- **Rehber:** `EV_KURULUMU.md` (teknik olmayan, Türkçe). Ücretli rehberler "önerilmez" olarak işaretlendi.
- **Düzeltme:** LAN üzerinden HTTP'de Secure çerez yüzünden PIN döngüsü oluşuyordu. Artık çerez yalnızca HTTPS'te Secure işaretleniyor.
- **Düzeltme:** mutlak `DATA_DIR` yolu proje klasörünün altına yazılıyordu. Artık doğru çözümleniyor.

## Kullanım şartları incelemesi (resmî metinler okundu)
| Servis | Bulgu | Karar |
|---|---|---|
| Google Gemini API | Kullanıcılar 18+ olmalı; API istemcileri "18 yaş altındaki kişilere yönelik veya onlarca erişilmesi muhtemel" olamaz. Ücretsiz katmanda veriler ürün geliştirmede kullanılır ve insanlarca incelenebilir. | **Entegre edilmedi** |
| Ollama | Hizmetleri kullanmak için 18+ gerekir. Yazılım MIT lisanslıdır. Yerel kullanımda istem ve veriler Ollama'ya gitmez. | Kurulum ve işletim **ebeveyn** tarafından yapılır |
| Gemma (model) | Gemma 3 kullanım şartları ve yasaklı kullanım politikası geçerli; Gemma 4 Apache 2.0. | Lisans sahibi ebeveyn |
| Tailscale | 16 yaş altına yönelik değil; reşit olmayanlar hesap açamaz/yönetemez. Kişisel plan ücretsiz (6 kullanıcı). Trafik uçtan uca şifreli; Tailscale meta veriyi görür. HTTPS açıkken cihaz adları herkese açık sertifika kayıtlarına girer. | Hesap ebeveynin; cihazlara çocuğun adı verilmez; Funnel kullanılmaz |

## Bu turun gerçek test sonuçları (bu ortamda çalıştırıldı)
- `npm run typecheck` ve `npm run lint`: hatasız.
- `npx vitest run`: **343 geçti, 1 atlandı**. Yeni testler: tek istek kuyruğu, meşgul mesajı,
  eşitleme deposu (son-yazan-kazanır, silme, sayfalama, kalıcılık, fotoğraf saklamama), eşitleme API'si
  (PIN, boyut sınırı, sunucusuz ortamda kapalı), çalışma süresi birleştirme, 8 GB varsayılanları.
- `npm run build`: başarılı.
- `npm run test:e2e`: **32/32 senaryo geçti**. Kapsam: 5 telefon ölçüsü, 4 tablet ölçüsü
  (820×1180, 1180×820, 1024×1366, 1366×1024; alt menü gizli, tahta geniş, taşma yok), masaüstü,
  bilgisayar kapalı uyarısı, iki ayrı tarayıcı bağlamı arasında PIN'li eşitleme (telefonda kaydedilen
  soru tablette görünür).

## Test EDİLMEYENLER (dürüst not)
- **Gerçek Ollama ve `gemma3:4b` ile hiç test yapılmadı.** Bu ortamda model indirilemedi.
  Hız, bellek kullanımı ve matematiksel doğruluk için **hiçbir garanti verilmiyor**. 8 GB RAM'de
  bir soru dakikalar sürebilir, model hata yapabilir. 4B boyutlu bir model fotoğraftaki soruyu yanlış okuyabilir.
- **Gerçek telefon ve tabletler** (iOS Safari, Android Chrome) ile test yapılmadı. Testler Chromium'da
  ekran ölçüsü taklidiyle yapıldı. iOS'ta Web Speech ile konuşma tanıma ve Türkçe ses, cihaza göre değişir.
- **Tailscale gerçek ortamda denenmedi.** `evde-baslat` betiği yalnızca `tailscale serve status` çıktısını okur.
- **Gizlilik notu:** Tarayıcıların konuşma tanıma özelliği (özellikle Android Chrome) sesi yazıya
  çevirmek için üreticinin (Google/Apple) sunucusunu kullanabilir. Bu uygulamanın denetimi dışındadır.
  Tam gizlilik için soru yazarak veya fotoğrafla sorulabilir. Seslendirme (TTS) cihazda çalışır.

## Senin yapman gerekenler
`EV_KURULUMU.md` dosyasını sırayla izle: Node.js + Ollama + `ollama pull gemma3:4b` → `npm install`
→ `npm run kurulum` → Tailscale (kendi hesabınla, HTTPS açık, nötr cihaz adı) → `tailscale serve --bg 3000`
→ `PiHoca-Baslat.bat` → her telefon/tablette Tailscale + adresi aç + ana ekrana ekle.
İlk hafta çözümleri birlikte kontrol edin.

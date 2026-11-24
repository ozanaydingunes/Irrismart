# Matematik Arkadaşım 🧮

7. sınıf öğrencileri için **yapay zekâ destekli, akıllı tahtalı ve sesli** kişisel matematik öğretmeni.
Sıradan bir soru çözücü değil: öğretmen soruyu tahtada adım adım yazar, her işlemin nedenini sesli anlatır;
öğrenci istediği an durdurup "Anlamadım", "Neden böyle yaptık?", "İpucu ver" diyebilir.

> Bu klasör, depodaki IrriGrow uygulamasından bağımsız bir Next.js projesidir.

## Özellikler

| Alan | Neler var |
|---|---|
| **Soru ekleme** | Kamera ile fotoğraf, galeri / ekran görüntüsü, klavye (matematik sembol tuşları), mikrofonla sesli soru, kırpma, döndürme, önizleme, otomatik sıkıştırma |
| **YZ öğretmen** | Türkçe, 12–13 yaş dili, MEB 7. sınıf müfredatı; verilenler / istenen / strateji / adımlar / kontrol / sık hatalar / benzer soru. Okunamayan fotoğrafta soru uydurmaz, daha net fotoğraf ister |
| **Akıllı tahta** | KaTeX ile adım adım "yazılan" işlemler, renkli vurgular, kesir şeritleri ve pastası, sayı doğrusu, yüzde ızgarası, geometri çizimleri (nokta/kenar/açı/çember), tablo, sütun ve çizgi grafiği, dönüşüm okları, denklem terazisi, kural kutuları |
| **Sesli öğretmen** | Web Speech API; kadın/erkek ses (cihazda varsa), oynat/duraklat/devam, baştan anlat, adımı tekrar anlat, ileri/geri, 0,75x–1,5x hız, konuşulan cümle vurgusu. Matematik doğal Türkçe okunur: `x²` → "iksin karesi", `3/5` → "beşte üç", `√25` → "yirmi beşin karekökü", `2x + 5 = 15` → "iki iks artı beş eşittir on beş". Türkçe ses yoksa yazılı anlatım sürer |
| **Özel ders** | Anlamadım · Daha basit anlat · Neden böyle yaptık? · Başka yöntemle çöz · Örnek ver · İpucu ver · Önceki adıma dön · Bu konuyu baştan anlat · yazılı/sesli serbest soru |
| **Öğrenme modları** | Tam çözüm · İpucu ile · Birlikte çözelim (öğrenciye işlem yaptırır, cevabı kontrol eder) · Sınav/alıştırma (önce cevap, sonra çözüm) |
| **Soru defteri** | İsteğe bağlı kayıt, favoriler, yanlışlar, konulara göre gruplama, tekrar zamanı, benzer soru üretme; çevrimdışı açılır |
| **Gelişim paneli** | Çözülen soru, doğru/yanlış, başarı oranı, konu bazlı gelişim, zorlanılan konular, günlük süre, haftalık grafik, tekrar edilecek konular. **Veri yoksa istatistik gösterilmez** |
| **PWA** | Ana ekrana eklenebilir, ikonlar, manifest, service worker, çevrimdışı uygulama kabuğu |
| **Tasarım** | Pastel mor-mavi, açık/koyu tema, mobilde alt menü, büyük dokunma hedefleri, AA kontrast, `prefers-reduced-motion` desteği, reklamsız |

## Kurulum

Gereksinim: **Node.js 20.9+** (22 önerilir).

```bash
cd matematik-arkadasim
npm install
cp .env.example .env.local     # API anahtarını buraya yaz (isteğe bağlı)
npm run dev                    # http://localhost:3000
```

Üretim için:

```bash
npm run build
npm start
```

### Yapay zekâ sağlayıcısı

`.env.local` içinde:

```ini
AI_PROVIDER=anthropic          # anthropic | openai | demo
ANTHROPIC_API_KEY=...          # Anthropic Claude
ANTHROPIC_MODEL=claude-opus-5-5
ANTHROPIC_EFFORT=medium        # low | medium | high (düşük = daha ucuz/hızlı)

# veya
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1
```

- Anahtarlar **yalnızca sunucuda** okunur (`src/lib/server/config.ts`); tarayıcıya gönderilmez.
- Seçilen sağlayıcının anahtarı yoksa uygulama **demo moduna** geçer (başka sağlayıcıya sessizce geçmez).
- Claude entegrasyonu resmî `@anthropic-ai/sdk` ile yapılır: akış (streaming), sistem istemi önbelleği
  (prompt caching) ve güvenlik reddinde sunucu tarafı yedek model (`fallbacks: "default"`) etkindir.
- Yeni sağlayıcı eklemek için `src/lib/ai/provider.ts` içindeki `AIProvider` arayüzünü uygulayıp
  `src/lib/ai/service.ts` → `getProvider` içine eklemek yeterlidir.

### Demo modu

API anahtarı yoksa uygulama **açıkça etiketlenmiş demo modunda** çalışır:
- Kural tabanlı çözücü (yapay zekâ değildir) kesin aritmetikle şunları çözer: kesir ve tam sayı işlemleri
  (işlem önceliği dahil), birinci dereceden bir bilinmeyenli denklemler, "bir sayının yüzdesi".
- Elle hazırlanmış 7 örnek: kesir problemi, denklem problemi, yüzde/indirim, üçgende açı (çoktan seçmeli),
  rasyonel sayı sıralama, doğru orantı, dairenin alanı.
- Demo çıktıları her yerde "DEMO — yapay zekâ çözümü değil" etiketiyle gösterilir; fotoğraflar demo modunda okunmaz.

### İsteğe bağlı doğal ses (sunucu TTS)

```ini
TTS_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_TTS_VOICE_FEMALE=nova
OPENAI_TTS_VOICE_MALE=onyx
```

Ayarlar → Sesli öğretmen → Ses kaynağı: **Doğal ses**. ElevenLabs gibi başka bir servis `src/app/api/tts/route.ts`
ve `src/lib/speech/browserEngines.ts` (`SpeechEngine` arayüzü) üzerinden eklenebilir.

## Kullanım

1. **Soru Çöz** → Fotoğraf çek / galeriden seç (gerekirse kırp, döndür), ya da yaz / sesle söyle.
2. Öğrenme modunu seç → **Soruyu çöz**.
3. Tahtada adımlar sırayla yazılır ve seslendirilir. Alttaki oynatıcıdan durdur, geri dön, hızı değiştir.
4. Sağdaki **Öğretmenine sor** panelinden hazır düğmeleri kullan ya da kendi sorunu sor.
5. Sonunda kendini değerlendir, soruyu deftere kaydet, benzer soruyu çöz.

## Güvenlik, gizlilik ve maliyet

- API çağrıları yalnızca sunucu katmanından (`src/app/api/*`) yapılır.
- **Hız sınırı** (dakikalık) ve **günlük kullanım limiti** (istemci başına + genel) yapılandırılabilir
  (`RATE_LIMIT_PER_MINUTE`, `DAILY_LIMIT_PER_CLIENT`, `DAILY_LIMIT_GLOBAL`). Sayaçlar bellek içidir;
  birden fazla sunucu örneğinde Redis gibi paylaşımlı depo önerilir.
- Görseller tarayıcıda küçültülür (≤1600 px, JPEG); sunucuda tür, **sihirli bayt** ve boyut kontrolü yapılır.
- Aynı soru için önbellek (SHA-256) — gereksiz API çağrısı yapılmaz. Yerel olarak kontrol edilebilen cevaplar YZ'ye gönderilmez.
- YZ çıktısı **Zod** ile doğrulanır, geçersizse bir kez onarım istenir. Bilinmeyen görsel türleri ayıklanır.
  YZ'den gelen HTML/JS hiçbir zaman çalıştırılmaz: metin React ile, matematik KaTeX `trust: false` ile, çizimler
  şema doğrulamalı SVG ile gösterilir.
- Sunucu tarafı **matematik doğrulayıcı**, adımlardaki sayısal eşitlikleri kesin rasyonel aritmetikle denetler;
  uyuşmazlık veya YZ'nin belirsizliği varsa öğrenciye açıkça gösterilir.
- Üyelik yok, kişisel bilgi istenmez (takma ad isteğe bağlı ve cihazda kalır). Fotoğraflar varsayılan olarak
  saklanmaz; ses kayıtları hiç saklanmaz. Kamera/mikrofon açıklama penceresinden sonra açılır.
- Veriler (defter, gelişim) yalnızca cihazdaki IndexedDB'de; Ayarlar'dan indirilebilir veya silinebilir.

## Testler

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # Vitest: 135 birim/entegrasyon testi
npm run build
npm run test:e2e    # Playwright: 13 uçtan uca senaryo (demo modunda, ekran görüntüleri e2e/screens/)
npm run check       # typecheck + lint + test + build
```

Test kapsamı: kesirler, tam sayılar ve işlem önceliği, rasyonel sayılar/ondalıklar, yüzdeler, denklemler,
problemler ve geometri örnekleri; Türkçe sayı okuma ve matematik→konuşma; seslendirme kuyruğu (ses bitmeden
ilerlememe, duraklat/devam, hız, bekleme); hız sınırı, günlük limit, görsel doğrulama, JSON onarımı, şema;
API uçları; gelişim istatistikleri (veri yokken sahte değer yok); KaTeX güvenliği.

## Proje yapısı

```
src/app/            Sayfalar ve API uçları (solve, tutor, check, practice, tts, status)
src/components/     board (akıllı tahta + SVG görseller), lesson, question, layout, ui (shadcn/ui)
src/lib/ai/         Sağlayıcılar (Anthropic, OpenAI), istemler, JSON ayrıştırma
src/lib/math/       Rasyonel aritmetik, ifade ayrıştırıcı, doğrulayıcı, cevap eşdeğerliği
src/lib/speech/     Türkçe sayılar, matematik→konuşma, ses motorları, anlatım denetleyicisi
src/lib/demo/       Kural tabanlı demo çözücü ve örnekler
src/lib/storage/    IndexedDB (defter, olaylar, çalışma süresi, önbellek)
src/lib/stats/      Gelişim paneli hesapları
tests/              Vitest testleri
e2e/                Playwright duman testi
```

Ayrıntılı mimari için `PROJECT_PLAN.md`, geliştirme kuralları için `CLAUDE.md`.

## Bilinen sınırlamalar

- Web Speech API'de Türkçe ses ve kadın/erkek ayrımı cihaza bağlıdır; ses adından tahmin edilir.
- Konuşma tanıma Firefox'ta desteklenmez (yazarak devam edilir).
- HEIC fotoğraflar yalnızca tarayıcı destekliyorsa açılır.
- Bellek içi limitler sunucu yeniden başlatılınca sıfırlanır.

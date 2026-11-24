# Matematik Arkadaşım — Proje Planı

7. sınıf öğrencileri için yapay zekâ destekli, akıllı tahtalı ve sesli kişisel matematik öğretmeni.

## 1. Mevcut durum incelemesi

Depo (`Irrismart`) başka bir ürünü (IrriGrow sulama uygulaması, Capacitor + düz JS) barındırıyor.
O ürünü bozmamak için Matematik Arkadaşım **`matematik-arkadasim/`** klasöründe bağımsız bir
Next.js projesi olarak geliştirildi. Kök dizindeki `package.json`, CI iş akışları ve `www/`
klasörüne dokunulmadı.

## 2. Teknoloji seçimleri (sürümler kilitli, `npm audit` = 0 açık)

| Katman | Seçim | Not |
|---|---|---|
| Çatı | Next.js 16.4 (App Router) + React 19.3 | Sunucu katmanı API anahtarlarını saklar |
| Dil | TypeScript 5.9 (strict) | |
| Stil | Tailwind CSS 3.4 + shadcn/ui deseni (Radix, CVA) | `components.json` mevcut |
| İkon | lucide-react | |
| Matematik | KaTeX 0.19 (`trust: false`) | YZ'nin LaTeX'i güvenli işlenir |
| Çizim | Kendi SVG görselleştirme motoru | Şema doğrulamalı, HTML/JS çalıştırmaz |
| Doğrulama | Zod 4 | Tüm YZ çıktıları ve API girdileri |
| Yerel veri | IndexedDB (`idb`) + localStorage (ayarlar) | Üyelik yok |
| YZ | Anthropic Claude (resmî SDK) / OpenAI (REST) / Demo | `AI_PROVIDER` ile seçilir |
| Ses | Web Speech API (TTS + konuşma tanıma), isteğe bağlı OpenAI TTS | Motor arayüzü değiştirilebilir |
| Test | Vitest (birim/entegrasyon) + Playwright (uçtan uca duman testi) | |
| PWA | Elle yazılmış service worker + manifest | Ek bağımlılık yok |

## 3. Mimari

```
src/
  app/                    Sayfalar (Ana Sayfa, Soru Çöz, Konular, Soru Defterim, Gelişimim, Ayarlar)
    api/solve             Soru çözümü (metin/görsel) → doğrulanmış Solution JSON
    api/tutor             Etkileşimli özel ders (Anlamadım, Neden?, İpucu, Örnek, serbest soru…)
    api/check             Öğrencinin cevabını kontrol (Birlikte çözme / Sınav modu)
    api/practice          Konuya göre alıştırma / benzer soru üretimi
    api/tts               İsteğe bağlı sunucu seslendirmesi
    api/status            YZ durumu (gerçek / demo), limitler
  lib/
    schema/               Zod şemaları (Solution, Step, VisualInstruction, TutorReply…)
    ai/                   Sağlayıcı arayüzü, Anthropic, OpenAI, istem (prompt) metinleri, JSON onarımı
    server/               Yapılandırma, hız sınırı, günlük limit, görsel doğrulama, istek işleme
    math/                 Kesin rasyonel aritmetik, LaTeX/metin ifade ayrıştırıcı, çözüm doğrulayıcı
    demo/                 Kural tabanlı demo çözücü + örnek sorular (açıkça "DEMO" etiketli)
    speech/               Türkçe sayı okuma, matematik→konuşma, ses motorları, anlatım denetleyicisi
    storage/              IndexedDB defter, deneme kayıtları, çalışma süresi, önbellek
    stats/                Gelişim paneli hesapları (veri yoksa istatistik yok)
    image/                Kırpma, döndürme, sıkıştırma
  components/
    ui/                   shadcn/ui bileşenleri
    board/                Akıllı tahta + görselleştirmeler (kesir, sayı doğrusu, geometri, tablo, grafik, terazi…)
    lesson/               Ders ekranı, oynatıcı kontrolleri, özel ders paneli, öğrenme modları
    question/             Soru yükleme (kamera, galeri, yazma, mikrofon, kırpma/döndürme)
    layout/               Uygulama kabuğu, alt/yan navigasyon, tema, demo/çevrimdışı uyarıları
```

### Veri akışı
1. Öğrenci soruyu girer → görsel istemcide döndürülür/kırpılır/sıkıştırılır (≤1600 px, JPEG).
2. Aynı soru için önbellek (SHA-256) kontrol edilir → gereksiz API çağrısı yapılmaz.
3. `/api/solve` → hız/günlük limit → girdi doğrulama (tür, boyut, sihirli bayt) → sağlayıcı.
4. YZ yanıtı JSON olarak ayrıştırılır, Zod ile doğrulanır; geçersizse bir kez onarım istenir.
5. Sunucu tarafı **matematiksel doğrulayıcı** adımlardaki sayısal eşitlikleri kesin aritmetikle
   denetler; uyuşmazlık varsa arayüzde uyarı gösterilir.
6. İstemcide ders: Akıllı tahta adım adım çizer, anlatım denetleyicisi sesi adım kuyruğuyla
   senkron oynatır (adımın sesi bitmeden sonraki adıma geçilmez).

### Ses–tahta senkronu
`NarrationController` saf TypeScript durum makinesidir (test edilebilir). Her adımın `narration`
metni cümlelere bölünür (Chrome'un uzun metin kesme hatasına karşı), sırayla motorla seslendirilir;
`onEnd` olayı gelmeden sonraki parçaya/adıma geçilmez. Türkçe ses yoksa `SilentEngine` okuma
süresini hesaplayarak yazılı anlatımı aynı olay akışıyla sürdürür.

## 4. Aşamalar

| # | Aşama | Durum |
|---|---|---|
| 1 | Mimari, PROJECT_PLAN.md, CLAUDE.md | ✅ |
| 2 | Temel altyapı: Next.js, Tailwind, shadcn/ui, tema, navigasyon | ✅ |
| 3 | Soru yükleme: kamera, galeri, ekran görüntüsü, yazma, mikrofon, kırpma, döndürme, önizleme | ✅ |
| 4 | YZ entegrasyonu: sağlayıcı soyutlaması, istemler, Zod, onarım, doğrulayıcı, demo modu | ✅ |
| 5 | Akıllı tahta: KaTeX, animasyon, vurgulama, SVG görseller, adım gezintisi | ✅ |
| 6 | Sesli öğretmen: Web Speech, matematik→Türkçe konuşma, kuyruk, hız, ses seçimi | ✅ |
| 7 | Etkileşimli özel ders ve 4 öğrenme modu | ✅ |
| 8 | Soru defteri ve gelişim paneli | ✅ |
| 9 | PWA: manifest, ikonlar, service worker, çevrimdışı sayfa | ✅ |
| 10 | Testler (birim + uçtan uca), hata düzeltme, README | ✅ |

### Sonraki sürümler için öneriler
- Sunucu tarafı limitler için Redis/Upstash (şu an bellek içi; tek sunucu örneği için uygun).
- ElevenLabs TTS sağlayıcısı (`TtsProvider` arayüzüne eklenebilir).
- Öğretmen/veli paylaşımı (isteğe bağlı, anonim rapor dışa aktarımı).
- Tekrar zamanlamasının aralıklı tekrar (SM-2) algoritmasıyla geliştirilmesi.

## 5. Test stratejisi
- **Matematik çekirdeği:** kesirler, rasyonel sayılar, tam sayılar, işlem önceliği, denklemler, yüzdeler.
- **Demo çözücü:** kesir işlemleri, denklemler, yüzde soruları; örnek problem ve geometri çözümlerinin
  şemaya ve doğrulayıcıya uygunluğu.
- **Seslendirme:** `x²`, `3/5`, `√25`, `2x + 5 = 15`, LaTeX kesirleri, yüzde, ondalık, negatif sayılar.
- **Anlatım denetleyicisi:** adım sırası, ses bitmeden ilerlememe, duraklat/devam, tekrar, hız.
- **Sunucu:** hız sınırı, günlük limit, görsel türü/boyutu, JSON çıkarma/onarım, API uçları (demo).
- **İstatistik:** veri yokken boş sonuç (sahte istatistik yok), konu bazlı oranlar.
- **Uçtan uca:** Playwright ile tüm sayfalar, demo çözüm, adım gezintisi, mobil/masaüstü, koyu tema.

# CLAUDE.md — Matematik Arkadaşım proje kuralları

Bu klasör, depodaki IrriGrow uygulamasından bağımsız bir Next.js projesidir. Kök dizindeki
dosyalara (www/, android/, kök package.json) bu proje için dokunma.

## Komutlar (bu klasörde çalıştır)
- `npm run dev` — geliştirme sunucusu
- `npm run typecheck` — TypeScript
- `npm run lint` — ESLint
- `npm test` — Vitest birim/entegrasyon testleri
- `npm run build` — üretim derlemesi
- `npm run test:e2e` — Playwright duman testi (önce `npm run build`; betik sunucuyu kendisi başlatır)
- `npm run check` — hepsi (typecheck + lint + test + build). Her değişiklikten sonra çalıştır.
- `npm run eval:ai` — GERÇEK (ücretli) YZ doğruluk ölçümü. Kullanıcı onayı olmadan `AI_EVAL_CONFIRM=1` ile çalıştırma.

## Ürün kuralları
- Tüm arayüz metinleri **Türkçe**. Hedef kitle 12–13 yaş, 7. sınıf MEB müfredatı.
- YZ yanıtı **asla doğrudan HTML/JS olarak çalıştırılmaz.** Metinler React ile metin olarak,
  matematik KaTeX ile (`trust: false`), çizimler yalnızca `src/lib/schema` içindeki doğrulanmış
  `VisualInstruction` türleriyle SVG olarak çizilir. Yeni görsel türü eklerken önce şemaya ekle.
- Tüm YZ çıktıları Zod şemasıyla doğrulanır (`src/lib/schema/solution.ts`). Şemayı değiştirirsen
  istem metnini (`src/lib/ai/prompts.ts`) ve demo örneklerini de güncelle; testler bunu yakalar.
- Demo modu her zaman **açıkça etiketlenir** (`source: "demo"`). Demo çıktısı gerçek YZ çözümü gibi gösterilmez.
- Görsel okunamıyorsa çözüm uydurulmaz: `status: "unreadable"` döner ve daha net fotoğraf istenir.
- Gelişim panelinde **sahte veri yok**. Veri yoksa boş durum gösterilir.
- Fotoğraf ve ses kayıtları varsayılan olarak saklanmaz. Kişisel bilgi istenmez, üyelik yok.
- Mikrofon ve kamera, açıklama içeren bir izin penceresinden sonra açılır.
- Seslendirmede LaTeX okunmaz: `narration` alanı düz Türkçe olmalı; yine de
  `src/lib/speech/mathToSpeech.ts` kalan sembolleri Türkçeye çevirir (x² → "iksin karesi").

- Model güvenlik nedeniyle reddederse başka modele geçilmez (`fallbacks` kullanma).
- Demo çözücü yalnızca saf işlem/denklem kalıplarını çözer; sözel problemi "kapsam dışı" saymalıdır.
  Yeni kalıp eklerken `tests/questionBank.test.ts` 0 yanlış cevabı korumalıdır.
- Anlatımda ezber dil ("karşıya at") yok; işlemin nedeni (eşitliğin dengesi vb.) anlatılır.
- Fotoğrafta birden fazla soru → `status: "multiple"`; eksik/kesik bilgi → `unreadable` (tahmin yok).

## Yayın ve yapay zekâ (varsayılan: ücretsiz bulut)
- Varsayılan: Vercel Hobby + Cloudflare Workers AI (`@cf/meta/llama-4-scout-17b-16e-instruct`, görsel destekli).
  Mistral Small 3.1 Cloudflare'de yalnızca metin alır. Rehber: `UCRETSIZ_BULUT_KURULUMU.md`.
- Ücretsiz zincir (`src/lib/ai/freeChain.ts`): birincil → ebeveynin onayladığı ücretsiz yedekler (`AI_FALLBACK_PROVIDERS`,
  yalnızca cloudflare/groq). Kota/geçici hata → sıradaki ücretsiz; **güvenlik reddi, yetki hatası, geçersiz çıktı başka
  sağlayıcıya gönderilmez**. Ücretli sağlayıcı (Anthropic/OpenAI) yalnızca `ALLOW_PAID_AI=1` ile birincil olabilir, asla yedek değil.
- Kapasite sayaçları kalıcı depoda, 00:00 UTC'de sıfırlanır, güvenlik paylı (Cloudflare 9.000/10.000 nöron).
  Kesin tüketim sayısı arayüzde gösterilmez (tahmindir).
- **Soru/süre/ipucu sınırı yok.** Günlük soru sınırı ve kalan hak göstergesi kaldırıldı; geri ekleme.
  Yalnızca dakikalık kötüye kullanım koruması ve PIN deneme sınırı var.
- Vercel'de aile PIN'i ve Upstash zorunlu (`deploymentProblem`). Bulutta soru defteri/eşitleme yok; veriler cihazda.
- Saf işlem/denklem ve kurallı alıştırmalar yerel motorla (`source: "local"`, "Yerel hesaplama" etiketi); yapay zekâ çağrılmaz.
- Llama 4 lisansı gereği arayüzde "Built with Llama" ibaresi korunur. Gemini entegre edilmez (18 yaş altı yasak).
- Alternatif ev kurulumu: `AI_PROVIDER=ollama` (tek seferde tek istek kuyruğu, dosya sayaçları, yerel eşitleme; `EV_KURULUMU.md`).
- Gerçek model testi yapılmadan performans/doğruluk garantisi verme.

## Kod kuralları
- API anahtarları yalnızca sunucuda (`src/lib/server/config.ts`). İstemci bileşenlerinde
  `process.env` gizli değişkenlerine erişme; `NEXT_PUBLIC_` önekiyle anahtar tanımlama.
- Yeni API ucu: `src/lib/server/handler.ts` içindeki `guardedJsonRoute` ile sar (aile PIN'i, kalıcı hız
  sınırı/kota/harcama sınırı, gövde boyutu, Zod girdi doğrulaması, Türkçe hata mesajları).
- Hata kaydı için yalnızca `logError` (`src/lib/server/log.ts`); istek gövdesi, soru metni, görsel loglanmaz.
- Öğrenci/istemci metni isteme yalnızca `sanitizeUserText` ile ve `<ogrenci_sorusu>` etiketi içinde girer.
- YZ servis fonksiyonları test için `ServiceDeps` ile sahte sağlayıcı alır; testlerde gerçek ağ çağrısı yok.
- Saf mantık (`lib/math`, `lib/speech`, `lib/stats`, `lib/demo`) tarayıcı API'si kullanmaz ve test edilir.
- Matematik hesapları kesin rasyonel aritmetikle (`lib/math/rational.ts`, BigInt) yapılır; kayan nokta yok.
- Erişilebilirlik: butonlarda `aria-label`, odak halkası, en az 44 px dokunma hedefi, AA kontrast.
- Bileşenler shadcn/ui desenini izler (`src/components/ui`), sınıf birleştirme için `cn()`.

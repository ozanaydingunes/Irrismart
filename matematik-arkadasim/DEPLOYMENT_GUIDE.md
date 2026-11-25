# Yayınlama Kılavuzu — Matematik Arkadaşım

> ⚠️ **İsteğe bağlı, ücretli yol — önerilmez.** Önerilen kurulum: **[UCRETSIZ_BULUT_KURULUMU.md](UCRETSIZ_BULUT_KURULUMU.md)** (ücretsiz Vercel Hobby + Cloudflare Workers AI). Bu rehberdeki günlük soru/istek sınırı ayarları artık varsayılan olarak kapalıdır.


Bu kılavuz uygulamayı **Vercel** üzerinde yayınlamayı adım adım anlatır. Hiçbir adım otomatik yapılmadı;
ücretli işlemleri ve yayını sen başlatırsın.

> **Güvenlik kuralı:** API anahtarını hiçbir zaman sohbet mesajına, koda veya Git'e yapıştırma.
> Anahtar yalnızca (a) bilgisayarındaki `.env.local` dosyasına veya (b) Vercel'in "Environment Variables"
> ekranına girilir.

---

## 1. Hazırlık: API anahtarını güvenle oluştur

### Anthropic (önerilen)
1. https://console.anthropic.com adresinde hesabına gir.
2. **Settings → Billing**: ödeme yöntemini ekle ve küçük bir bakiye yükle.
3. **Settings → Limits**: aylık harcama üst sınırı belirle (ör. 10 USD). Bu, uygulamadaki günlük sınıra ek bir güvencedir.
4. **API Keys → Create Key**: anahtara "matematik-arkadasim" gibi bir ad ver ve oluştur.
5. Anahtar yalnızca bir kez gösterilir. Kopyala ve hemen 2. veya 3. bölümdeki yere yapıştır.
   Not defterine, e-postaya veya sohbete kaydetme.
6. Anahtarın sızdığından şüphelenirsen konsoldan **sil** ve yenisini oluştur.

### OpenAI (alternatif)
https://platform.openai.com → **API keys → Create new secret key**. Kullanım sınırını **Limits** ekranından belirle.
`OPENAI_MODEL` değerini hesabında erişebildiğin, görsel destekli bir modelle değiştir (bu kurulumda doğrulanmadı).

---

## 2. Yerelde deneme (isteğe bağlı ama önerilir)

```bash
cd matematik-arkadasim
npm install
cp .env.example .env.local
```

`.env.local` dosyasını bir metin düzenleyiciyle aç ve doldur:
- `ANTHROPIC_API_KEY=` satırının sonuna anahtarı yapıştır (tırnak işareti kullanma).
- `APP_ACCESS_PIN=` aile PIN'ini yaz.
- `APP_SESSION_SECRET=` en az 32 karakterlik rastgele bir değer yaz. Üretmek için:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Sonra uygulamayı başlat:

```bash
npm run build && npm start      # http://localhost:3000
```

`.env.local` dosyası `.gitignore`'da olduğu için Git'e gönderilmez. Göndermeden önce `git status` ile kontrol et.

### Maliyet kontrollü doğruluk testi (önerilir)
```bash
npm run eval:ai                         # yalnızca tahmini maliyeti yazar, çağrı yapmaz
AI_EVAL_CONFIRM=1 AI_EVAL_LIMIT=10 npm run eval:ai   # önce 10 soruyla dene
AI_EVAL_CONFIRM=1 npm run eval:ai       # 117 sorunun tamamı
```

117 soru için yaklaşık maliyet (soru başına ~3.500 giriş + ~4.000 çıkış jetonu varsayımıyla; gerçek tutar farklı olabilir):

| Model | Tahmini toplam |
|---|---|
| `claude-haiku-5-5` | ~0,30 USD |
| `claude-sonnet-5-5` | ~6 USD |
| `claude-opus-5-5` | ~12 USD |

Sonuçlar `reports/ai-eval-*.md` dosyasına yazılır.

---

## 3. Vercel'de yayınlama

### 3.1 Kalıcı kota deposu (Upstash Redis) — ücretsiz katman yeterli
Sunucusuz ortamda bellek içi sayaçlar güvenilir değildir. Kota ve harcama sınırının çalışması için:
1. Vercel panelinde **Storage → Marketplace → Upstash (Redis)** ekle **veya** https://console.upstash.com'da bir Redis veritabanı oluştur.
2. **REST URL** ve **REST Token** değerlerini al. Marketplace entegrasyonu bunları projeye otomatik ekleyebilir; uygulama hem `UPSTASH_REDIS_REST_*` hem `KV_REST_API_*` adlarını okur.
3. Depoda yalnızca özetlenmiş (hash) sayaçlar tutulur; soru, fotoğraf veya kişisel veri tutulmaz.

### 3.2 Projeyi oluştur
1. https://vercel.com → **Add New → Project** → GitHub'daki `irrismart` deposunu içe aktar.
2. **Root Directory:** `matematik-arkadasim` (önemli: depo kökü değil).
3. **Framework Preset:** Next.js (otomatik algılanır). Build Command ve Output ayarlarına dokunma.
4. **Node.js Version:** 22.x (Settings → General).
5. Dal: önce `claude/matematik-arkadas-ai-app-xjrmfw` dalını **Preview** olarak dağıtıp dene. Kendi kararınla ana dala birleştirince Production'a geçer.

### 3.3 Ortam değişkenleri (Settings → Environment Variables)

| Değişken | Değer | Zorunlu |
|---|---|---|
| `AI_PROVIDER` | `anthropic` | ✔ |
| `ANTHROPIC_API_KEY` | (konsoldan aldığın anahtar) — **Sensitive** olarak işaretle | ✔ |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` (ucuz: `claude-haiku-5-5`) | |
| `ANTHROPIC_LIGHT_MODEL` | `claude-haiku-5-5` | |
| `APP_ACCESS_PIN` | aile PIN'i | ✔ (internette yayınlıyorsan) |
| `APP_SESSION_SECRET` | 32+ karakter rastgele değer — Sensitive | ✔ (PIN varsa) |
| `DAILY_BUDGET_USD` | ör. `2` | önerilir |
| `DAILY_LIMIT_PER_CLIENT` / `DAILY_LIMIT_GLOBAL` / `RATE_LIMIT_PER_MINUTE` | `40` / `300` / `8` | |
| `MAX_IMAGE_MB` | `3` (Vercel'de 3'ü geçme) | |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash'ten | ✔ (önerilir) |

`ALLOW_MOCK_PROVIDER` değişkenini **asla** tanımlama (yalnızca otomatik testler içindir).

### 3.4 Fonksiyon süresi
Çözüm uçları `maxDuration = 120` saniye kullanır. Vercel'in güncel planlarında (Fluid Compute açık) bu değer
desteklenir. Dağıtım "maxDuration" hatası verirse:
- **Settings → Functions → Fluid Compute**'u aç, veya
- `src/app/api/solve/route.ts` ve `practice/route.ts` içindeki `maxDuration` değerini planının sınırına düşür.
Uygulama yapay zekâ çağrılarını zaten 100 saniyelik bir bütçeyle sınırlar.

### 3.5 Dağıt ve doğrula
**Deploy**'a bas, ardından yayın adresinde şunları kontrol et:
- [ ] Ana sayfa açılıyor, "DEMO" etiketi **görünmüyor** (görünüyorsa anahtar okunmamıştır).
- [ ] Soru Çöz → aile PIN'i isteniyor; doğru PIN ile giriş yapılıyor.
- [ ] Yazılı bir soru (ör. `3/4 + 1/6`) çözülüyor; rozet "Yapay zekâ çözümü".
- [ ] Telefonla fotoğraf çekilip çözülüyor; "Doğru okumuş muyum?" kartı çıkıyor.
- [ ] Vercel → Logs: hata satırlarında anahtar veya soru metni görünmüyor.
- [ ] `https://ALAN-ADIN/manifest.webmanifest` ve `/sw.js` açılıyor.
- [ ] Tarayıcı geliştirici araçları → Application → Service Workers: etkin; Cache Storage'da `/api/` kaydı yok.

HTTPS: Vercel tüm alan adlarında otomatik HTTPS sağlar. Kamera, mikrofon, service worker ve PWA kurulumu
yalnızca HTTPS'te (veya localhost'ta) çalışır.

### Alternatif erişim kontrolü
PIN yerine (veya PIN'e ek olarak) **Vercel → Settings → Deployment Protection** ile siteyi yalnızca senin
hesabına/şifreye açabilirsin (bazı seçenekler ücretli plan gerektirir).

---

## 4. Telefonda ana ekrana ekleme

### iPhone / iPad (Safari)
1. Yayın adresini **Safari**'de aç (Chrome'da iOS bu seçeneği sunmayabilir).
2. Alttaki **Paylaş** düğmesine (yukarı ok olan kare) dokun.
3. **Ana Ekrana Ekle**'yi seç → **Ekle**.
4. İlk açılışta "Fotoğraf çek" dediğinde kamera izni ve "Sesle" dediğinde mikrofon izni iste. Reddedildiyse:
   **Ayarlar → Safari → Kamera / Mikrofon** veya **Ayarlar → (Uygulama adı)** üzerinden izin ver.
5. Türkçe ses için: **Ayarlar → Erişilebilirlik → Seslendirilen İçerik → Sesler → Türkçe** bölümünden bir ses indir
   (ör. "Yelda"). İndirilmemişse anlatım yazılı devam eder.

### Android (Chrome)
1. Yayın adresini **Chrome**'da aç.
2. Sağ üstteki **⋮** menüsü → **Ana ekrana ekle** (veya "Uygulamayı yükle").
3. Kamera/mikrofon izinlerini istenince ver; sonradan **Chrome → Ayarlar → Site ayarları** bölümünden değiştirebilirsin.
4. Türkçe ses için: **Ayarlar → Erişilebilirlik → Metin okuma çıkışı → Tercih edilen motor (Google) → Dil: Türkçe**;
   gerekirse ses verisini indir.

---

## 5. Veri saklama ve gizlilik (yetişkin için)

- Uygulama öğrenciden kişisel bilgi istemez; defter ve gelişim verileri **yalnızca cihazda** kalır.
- Sunucu soru metnini/fotoğrafını diske yazmaz ve loglamaz; yalnızca yapay zekâ sağlayıcısına iletir.
- Upstash'te yalnızca özetlenmiş sayaçlar (en fazla birkaç gün) tutulur.
- **Yapay zekâ sağlayıcılarının politikaları** (yayın öncesi güncel hâlini kontrol et; bu ortamdan doğrulanmadı):
  - Anthropic: ticari API koşulları ve gizlilik merkezi — https://www.anthropic.com/legal/commercial-terms ,
    https://privacy.anthropic.com
  - OpenAI: API veri kullanımı — https://openai.com/enterprise-privacy
- Çocuk verileri ile ilgili yerel mevzuat (ör. KVKK) kapsamında uygulamayı başkalarının çocuklarına
  açacaksan bir gizlilik metni yayınlamayı ve veli onayı almayı değerlendir. Uygulamada `/gizlilik` sayfası
  temel bir bilgilendirme içerir; hukuki metin yerine geçmez.

---

## 6. Sorun giderme

| Belirti | Olası neden / çözüm |
|---|---|
| Uygulama "DEMO" diyor | `ANTHROPIC_API_KEY` boş veya `AI_PROVIDER` yanlış; değişkeni düzeltip **Redeploy** |
| "API anahtarı geçersiz" | Anahtar yanlış kopyalanmış veya silinmiş; yenisini oluştur |
| "Bakiye veya kota dolmuş" | Sağlayıcı konsolunda bakiye/limit |
| "Bugünkü kullanım sınırı doldu" | `DAILY_BUDGET_USD` veya `DAILY_LIMIT_GLOBAL` doldu; ertesi gün (UTC) sıfırlanır |
| "Erişim ayarı eksik" | PIN tanımlı ama `APP_SESSION_SECRET` 32 karakterden kısa |
| "Kullanım sınırı şu an kontrol edilemedi" | Upstash'e ulaşılamıyor; URL/Token'ı kontrol et |
| Fotoğraf yüklenince "çok büyük" | Kırp; `MAX_IMAGE_MB`'yi 3'ün üzerine çıkarma |
| Ses yok | Cihazda Türkçe ses yüklü değil (4. bölüm) veya sessiz mod açık |

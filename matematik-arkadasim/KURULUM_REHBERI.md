# Kurulum Rehberi (sade anlatım)

> ⚠️ **İsteğe bağlı, ücretli yol — önerilmez.** Bu rehber ücretli API ve internette yayın içindir.
> Önerilen ücretsiz kurulum (Vercel Hobby + Cloudflare Workers AI) için **[UCRETSIZ_BULUT_KURULUMU.md](UCRETSIZ_BULUT_KURULUMU.md)** dosyasına bakın.


Bu rehber, Matematik Arkadaşım'ı **demo modundan gerçek yapay zekâ moduna** geçirmek için yapman
gerekenleri adım adım anlatır. Teknik bilgi gerekmez. Daha ayrıntılı bilgi: `DEPLOYMENT_GUIDE.md`.

> 🔒 **Altın kural:** API anahtarı bir şifre gibidir. Onu **asla** sohbete, e-postaya, uygulamanın
> ekranlarına veya kod dosyalarına yazma. Anahtar yalnızca iki yere girilir:
> **Vercel'in "Environment Variables" ekranı** (internette yayın için) veya bilgisayarındaki
> **`.env.local`** dosyası (yalnızca kendi bilgisayarında denemek için).

---

## Bölüm A — API anahtarını al (bir kez)

**Anthropic (önerilen):**
1. https://console.anthropic.com adresine git, hesap aç veya giriş yap.
2. Sol menüden **Billing** (Faturalandırma) → kart ekle → küçük bir bakiye yükle (ör. 5–10 USD).
3. **Limits** bölümünde **aylık harcama sınırı** koy (ör. 10 USD). Böylece fatura asla bunu aşmaz.
4. **API Keys** → **Create Key** → ad olarak `matematik-arkadasim` yaz → oluştur.
5. Görünen anahtarı kopyala. Bu pencere kapanınca anahtar bir daha gösterilmez; kaybedersen yenisini oluşturursun.
6. Anahtarı hemen Bölüm C'deki yere yapıştır. Başka hiçbir yere kaydetme.

**OpenAI (alternatif):** https://platform.openai.com → **API keys** → **Create new secret key**.
**Limits** bölümünden aylık sınır koy.

Anahtarın başkasının eline geçtiğinden şüphelenirsen: konsolda anahtarı **sil**, yenisini oluştur, Vercel'de değiştir.

---

## Bölüm B — Model seç (ne kadar akıllı, ne kadar ucuz?)

| Seçenek | `ANTHROPIC_MODEL` değeri | Ne zaman? | 1 soru yaklaşık |
|---|---|---|---|
| Ekonomik | `claude-haiku-5-5` | Bütçe çok kısıtlıysa; basit sorular | ~0,003 USD |
| **Önerilen** | `claude-sonnet-5-5` | Doğruluk ve maliyet dengesi | ~0,05 USD |
| En doğru | `claude-opus-5-5` | Zor geometri / uzun problemler | ~0,10 USD |

Bu tutarlar tahmindir; gerçek tutar sorunun uzunluğuna göre değişir. Önerim: **Sonnet** ile başla.
Cevap kontrolü ve ipucu gibi basit işler zaten otomatik olarak ucuz modelle (Haiku) yapılır.

---

## Bölüm C — Uygulamayı internette yayınla (Vercel + Upstash)

### C1. Upstash (kullanım sayacı, ücretsiz)
Günlük sınırların gerçekten çalışması için gerekir.
1. https://vercel.com'da hesabını aç (GitHub ile giriş yapabilirsin).
2. Vercel'de **Storage** → **Create** → **Upstash for Redis** → ücretsiz planı seç → oluştur.
3. Oluşturduktan sonra **Connect Project** ile projene bağla (C2'den sonra da yapabilirsin).
   Bağlayınca gereken iki değer projeye kendiliğinden eklenir.

### C2. Projeyi Vercel'e ekle
1. Vercel → **Add New** → **Project** → GitHub'daki `irrismart` deposunu seç → **Import**.
2. **Root Directory** kutusunda **Edit**'e bas ve `matematik-arkadasim` klasörünü seç. *(En önemli adım!)*
3. Henüz **Deploy**'a basma; önce C3'ü yap.

### C3. Ayarları gir (Environment Variables)
Aynı ekranda **Environment Variables** bölümünü aç ve her satırı tek tek ekle:

| Name (ad) | Value (değer) |
|---|---|
| `AI_PROVIDER` | `anthropic` |
| `ANTHROPIC_API_KEY` | Bölüm A'da kopyaladığın anahtar |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` |
| `APP_ACCESS_PIN` | Aile PIN'in (ör. 4–6 haneli, tahmin edilmesi zor bir sayı) |
| `APP_SESSION_SECRET` | En az 32 karakterlik rastgele bir metin (aşağıya bak) |
| `DAILY_BUDGET_USD` | Günlük harcama sınırı, ör. `1` |

**APP_SESSION_SECRET nasıl üretilir?** Rastgele bir metin üretmek için şu yollardan biri:
- Bilgisayarında Node.js varsa: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Veya bir şifre yöneticisinde "64 karakterlik rastgele şifre" oluştur.
Bu değeri kimseyle paylaşma; çocuğun bilmesine gerek yok.

Ardından **Deploy**'a bas. 1–2 dakika sonra sana bir adres verilir (ör. `matematik-arkadasim.vercel.app`).

### C4. Fonksiyon süresi uyarısı çıkarsa
Dağıtımda "maxDuration" ile ilgili bir hata görürsen: **Settings → Functions** bölümünde
**Fluid Compute**'u aç ve yeniden dağıt.

---

## Bölüm D — Demo modundan gerçek moda geçtiğini kontrol et

1. Yayın adresini aç. Sağ üstte veya kenar menüde **DEMO** etiketi **görünmemeli**.
   - Hâlâ "DEMO" yazıyorsa: `ANTHROPIC_API_KEY` boş/yanlış girilmiş ya da `AI_PROVIDER` yanlış.
     Vercel → **Settings → Environment Variables**'ta düzelt → **Deployments** → son dağıtımda **⋯ → Redeploy**.
2. **Ayarlar → Gizlilik ve veriler** bölümünde "Yapay zekâ durumu" satırında model adını görmelisin.

## Bölüm E — Bağlantıyı test et (tek soru, ~0,05 USD)

**En kolay yol (telefon veya bilgisayar):**
1. Uygulamada **Soru yaz**'a dokun → aile PIN'ini gir.
2. `3/4 + 1/6 işleminin sonucu kaçtır?` yaz → **Soruyu çöz**.
3. Rozet **"Yapay zekâ çözümü"** olmalı ve sonuç **11/12** çıkmalı.
4. Bir de kitaptan bir sorunun fotoğrafını çek ve çöz: "Doğru okumuş muyum?" kartı çıkmalı.

Hata mesajı çıkarsa:

| Mesaj | Anlamı | Ne yapmalı? |
|---|---|---|
| "API anahtarı geçersiz" | Anahtar yanlış kopyalanmış | Anahtarı yeniden oluştur, Vercel'de değiştir, Redeploy |
| "Bakiye veya kota dolmuş" | Konsolda bakiye/limit bitmiş | Bakiye yükle veya limiti artır |
| "Bugünkü kullanım sınırı doldu" | `DAILY_BUDGET_USD` doldu | Ertesi gün açılır veya değeri artır |
| "Erişim ayarı eksik" | `APP_SESSION_SECRET` 32 karakterden kısa | Daha uzun bir değer gir |
| "Kullanım sınırı kontrol edilemedi" | Upstash bağlı değil | C1'deki **Connect Project** adımını yap |

**Bilgisayarında komutla test (isteğe bağlı, geliştiriciler için):**
```bash
cd matematik-arkadasim
cp .env.example .env.local     # sonra .env.local içine anahtarı yaz
npm install
npm run api:test               # 1 soru gönderir (ÜCRETLİ, ~0,05 USD)
```

---

## Bölüm F — Günlük maliyet sınırı

- `DAILY_BUDGET_USD`: Uygulamanın bir günde harcayabileceği **yaklaşık** tutar. Dolunca o gün yeni çözüm yapılmaz;
  öğrenci Soru Defterim'deki kayıtlı soruları çalışmaya devam edebilir. Gün sayacı UTC'ye göre (Türkiye saatiyle 03:00'te) sıfırlanır.
- `DAILY_LIMIT_PER_CLIENT` (varsayılan 40): bir cihazın günlük soru sayısı.
- Asıl güvence: Anthropic/OpenAI konsolundaki **aylık harcama sınırı** (Bölüm A, adım 3). İkisini birlikte kullan.

Örnek: Günde 20 soru × Sonnet ≈ 1 USD/gün. `DAILY_BUDGET_USD=1` uygun bir başlangıçtır.

## Bölüm G — Aile PIN'i

- `APP_ACCESS_PIN` tanımlıysa, yapay zekâ kullanmak için PIN sorulur. Soru Defterim ve Konular PIN'siz açılır.
- PIN bir cihazda 30 gün hatırlanır. PIN'i değiştirmek için Vercel'de değeri değiştir ve Redeploy yap.
- 15 dakikada 5 yanlış denemeden sonra PIN girişi geçici olarak kilitlenir.
- Uygulamayı internette yayınlıyorsan PIN'i **mutlaka** tanımla; yoksa adresi bilen herkes bakiyeni kullanabilir.

## Bölüm H — Telefona uygulama gibi ekle
- **iPhone (Safari):** Paylaş → **Ana Ekrana Ekle**.
- **Android (Chrome):** ⋮ menü → **Ana ekrana ekle**.
- Türkçe ses için telefonun ayarlarından Türkçe metin okuma sesini indir (ayrıntı: `DEPLOYMENT_GUIDE.md` 4. bölüm).

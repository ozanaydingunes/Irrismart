# Pi Hoca'yı ücretsiz internet sitesi olarak kurma

Bu rehberin sonunda Pi Hoca'nın kendine ait bir **internet adresi** olur (ör. `https://pi-hoca-xxxx.vercel.app`).
Kızınız bu adresi **telefon, tablet veya bilgisayardan** açar; hiçbir program kurulmaz ve evdeki
bilgisayarın açık olması gerekmez. Teknik bilgi gerekmez. Hesapları **siz (ebeveyn)** açarsınız.

```
 Telefon / tablet (Safari, Chrome)
        │  https://…vercel.app   (aile PIN'iyle korunur)
        ▼
 Vercel (ücretsiz Hobby)  ──►  Cloudflare Workers AI (ücretsiz, fotoğraf + matematik)
        │                       └─ kapasite dolarsa ►  Groq (ücretsiz, isteğe bağlı yedek)
        └─ Upstash (ücretsiz, yalnızca güvenlik sayaçları)
```

> ⏱️ Toplam süre yaklaşık 30–45 dakika. Hiçbir adımda **kredi kartı girmeyin**.
> Kart istenen bir ekran çıkarsa o adımı atlayın: o ekran ücretli plana geçiş içindir.

---

## Önce bilmeniz gerekenler (dürüst özet)

- **Ücret:** Kullanılan dört hizmetin ücretsiz planları var: Vercel Hobby, Cloudflare Workers
  Free, Upstash Free ve Groq Free. Kart eklemediğiniz sürece fatura oluşmaz. Uygulama hiçbir koşulda
  kendiliğinden ücretli bir yapay zekâya geçmez.
- **Soru sınırı yok.** Uygulama kendisi soru, süre veya ipucu sınırı koymaz. Sınırlı olan yalnızca
  **sağlayıcıların ücretsiz günlük kapasitesidir**:
  - Cloudflare günde 10.000 "nöron" verir. Uygulamanın tahminine göre bu, günde aşağı yukarı
    20–30 fotoğraflı çözüme denk gelir. Bu sayı ölçülmedi; soruların uzunluğuna göre değişir.
  - Cloudflare dolarsa Groq'un ücretsiz kapasitesi devreye girer (kurduysanız).
  - İkisi de dolarsa ekranda "bugünkü ücretsiz kapasite doldu, yarın devam edebiliriz" yazar.
    Kapasite her gün saat **03:00'te** (Türkiye saati) yenilenir.
  - `3/4 + 1/6`, `2x + 5 = 15` gibi işlem ve denklemler ile kurallı alıştırmalar yapay
    zekâ kullanmadan, uygulamanın kendi hesaplama motoruyla çözülür. Bunlar kapasite harcamaz ve
    her zaman çalışır.
- **Doğruluk garantisi yok.** Fotoğraf okuma ve çözüm için Meta'nın ücretsiz **Llama 4 Scout**
  modeli kullanılır. Bu model gerçek bir hesapla henüz denenmedi. Pi Hoca'nın kesin hesap kontrolü
  bazı hataları yakalar ama hepsini yakalayamaz. İlk günlerde çözümlere birlikte bakın.
- **Veri:** Soru metni ve fotoğrafı çözülmek için Cloudflare'e (gerekirse Groq'a) gider. İki şirket
  de bu verileri saklamadığını ve model eğitiminde kullanmadığını yazıyor. Fotoğraflar ve ses
  kayıtları hiçbir yerde saklanmaz. Soru defteri ve gelişim bilgileri yalnızca her cihazın kendi
  hafızasında durur; buluta gönderilmez.
- **Yaş kuralları (resmî metinlerden):**
  - Cloudflare, Vercel (16+), Upstash (18+) ve Groq (18+) hesapları reşit kişiler içindir.
    Hesapları siz açarsınız; kızınız bu hizmetlere üye olmaz.
  - Cloudflare ve Groq, müşterinin (sizin) çocukların kullandığı bir uygulama yapmasını
    yasaklamıyor; yasalara uyma sorumluluğunu müşteriye bırakıyor.
  - Google Gemini ise 18 yaş altının erişebileceği uygulamaları yasakladığı için kullanılmıyor.

---

## 1. Cloudflare hesabı açın
1. https://dash.cloudflare.com/sign-up adresine gidin.
2. **Kendi** e-posta adresinizle ve güçlü bir parolayla kayıt olun, e-postanızı doğrulayın.
3. Bir alan adı (site) eklemeniz istenirse bu adımı **atlayın**. Gerek yok.

## 2. Workers AI'ı etkinleştirin
1. Cloudflare panelinde soldaki menüden **AI → Workers AI** sayfasını açın.
2. Ücretsiz planda ayrıca bir şey açmanız gerekmez. Sayfa açılıyorsa Workers AI kullanıma hazırdır.
3. "Upgrade", "Workers Paid" veya "Add payment method" düğmelerine **basmayın**.

## 3. API anahtarını (token) ve hesap kimliğini alın
1. Aynı **Workers AI** sayfasında **Use REST API** düğmesine basın.
2. **Create a Workers AI API Token** → hazır bilgileri değiştirmeden **Create API Token**.
3. **Copy API Token** ile kopyalayın. Bu sizin `CLOUDFLARE_API_TOKEN` değerinizdir.
4. Aynı sayfadaki **Account ID** değerini kopyalayın. Bu sizin `CLOUDFLARE_ACCOUNT_ID` değerinizdir.

> 🔒 Token bir şifre gibidir. Onu **yalnızca** 6. adımdaki Vercel ekranına yapıştırın.
> Sohbete, e-postaya, uygulamaya veya kod dosyalarına yazmayın.
> Bu ikisini bir kâğıda değil, geçici olarak bir not uygulamasına yazıp 6. adımdan sonra silin.

## 3b. (İsteğe bağlı) Groq yedeği
Cloudflare'in günlük ücretsiz kapasitesi dolunca Pi Hoca'nın Groq ile devam etmesini isterseniz:
1. https://console.groq.com adresinde **kendi** hesabınızla oturum açın.
2. **API Keys → Create API Key** ile bir anahtar oluşturup kopyalayın. Bu sizin `GROQ_API_KEY` değerinizdir.
3. "Upgrade to Developer" veya ödeme yöntemi ekleme ekranlarına **girmeyin**. Ücretsiz plan yeterli.

Not: Groq'un ücretsiz planında dakikalık jeton sınırı düşüktür. Uzun bir fotoğraflı soru Groq'a
sığmayabilir; o zaman "biraz sonra tekrar dene" uyarısı çıkar.

## 4. Vercel hesabı açın
1. https://vercel.com/signup → **Hobby** (ücretsiz, kişisel kullanım) seçin.
2. **Continue with GitHub** ile GitHub hesabınızla giriş yapın.

## 5. GitHub deposunu bağlayın
1. Vercel'de **Add New… → Project**.
2. Listeden **Irrismart** deposunu seçip **Import** deyin. Depo görünmüyorsa **Adjust GitHub App
   Permissions** ile Vercel'e bu depoya erişim verin.
3. **Root Directory** → **Edit** → `matematik-arkadasim` klasörünü seçin. Bu çok önemli: depodaki
   diğer uygulamaya (IrriGrow) dokunulmaz.
4. **Framework Preset**: Next.js (kendiliğinden seçilir). Diğer ayarlara dokunmayın.
5. **Henüz Deploy'a basmayın**, önce 6. ve 7. adımları yapın.

## 6. Ortam değişkenlerini ekleyin
Aynı ekrandaki **Environment Variables** bölümüne şunları tek tek ekleyin. Sol kutu ad, sağ kutu değerdir.

| Ad | Değer |
|---|---|
| `AI_PROVIDER` | `cloudflare` |
| `CLOUDFLARE_ACCOUNT_ID` | 3. adımda kopyaladığınız Account ID |
| `CLOUDFLARE_API_TOKEN` | 3. adımda kopyaladığınız token |
| `APP_ACCESS_PIN` | Aile PIN'i (7. adım) |
| `APP_SESSION_SECRET` | En az 32 karakterlik rastgele bir metin (7. adım) |
| `GROQ_API_KEY` | (isteğe bağlı) 3b. adımdaki Groq anahtarı |

`ALLOW_PAID_AI` değişkenini **eklemeyin**: eklenmediğinde ücretli yapay zekâ kapalıdır.

## 7. Aile PIN'ini belirleyin
- `APP_ACCESS_PIN`: Kızınızın her cihazda **bir kez** gireceği 4–8 haneli bir sayı (ör. doğum
  tarihi gibi tahmin edilebilir bir sayı **olmasın**). PIN girilmeden yapay zekâ özellikleri açılmaz.
  İnternette yayında bu değer **zorunludur**; tanımlanmazsa uygulama "kurulum tamamlanmamış" uyarısı verir.
- `APP_SESSION_SECRET`: Kimsenin bilmesine gerek olmayan uzun bir metin. Telefonunuzdaki parola
  yöneticisinin "parola oluştur" özelliğiyle **40 karakterlik** bir parola üretip yapıştırın.
- Yanlış PIN 15 dakikada en fazla 5 kez denenebilir.

## 8. Upstash'i bağlayın ve ücretsiz planları kontrol edin
Upstash, yalnızca güvenlik sayaçlarını tutar: hız sınırı, yanlış PIN denemeleri ve ücretsiz kapasite
tahmini. Soru, fotoğraf veya kişisel bilgi tutmaz. İnternette yayında **zorunludur**.
1. **Deploy**'a basın. İlk yayın birkaç dakika sürer. Bitince proje sayfasına geçin.
2. Proje sayfasında **Storage** sekmesi → **Upstash for Redis** (Marketplace) → **Free** planı seçin
   → projeye **Connect** deyin. Gerekli `KV_REST_API_URL` ve `KV_REST_API_TOKEN` değerleri
   kendiliğinden eklenir.
3. Ücretsiz planları kontrol edin:
   - **Vercel:** Settings → Billing → plan **Hobby** olmalı.
   - **Cloudflare:** Workers & Pages → Plans → **Free** olmalı. Ödeme yöntemi eklenmemiş olmalı.
   - **Upstash:** veritabanı planı **Free** olmalı.
   - **Groq** (kurduysanız): Settings → Billing → **Free** olmalı.

## 9. Yayınlayın
1. **Deployments** sekmesi → en üstteki yayının yanındaki **⋯ → Redeploy**. Böylece Upstash
   ayarları da devreye girer.
2. Uygulamanın kodu GitHub'da `claude/matematik-arkadas-ai-app-xjrmfw` dalındadır. Vercel varsayılan
   olarak `main` dalını yayınlar. İki seçenek var:
   - Bu dalı `main` ile birleştirmek (GitHub'da "pull request" açıp birleştirmek).
   - Ya da Vercel'de **Settings → Git → Production Branch** alanına
     `claude/matematik-arkadas-ai-app-xjrmfw` yazıp kaydetmek ve yeniden yayınlamak.

   Diğer dallardaki "önizleme" adresleri Vercel girişi ister; kızınız için **ana adresi**
   (Domains bölümündeki `…vercel.app`) kullanın.
3. Ana adresi bilgisayarda açın. **Ayarlar** ekranında "Ücretsiz yapay zekâ durumu" kartında
   "Cloudflare … Kullanılabilir" yazıyorsa kurulum tamamdır. "Kurulum tamamlanmamış" uyarısı varsa
   uyarıda hangi adımın eksik olduğu yazar.
4. **İlk deneme:** **Soru Çöz** ekranında aile PIN'ini girin. Defterden bir soru fotoğrafı çekin;
   bunun gerçek yapay zekâyla ilk denemeniz olacak. Çözümü siz de kontrol edin.

## 10. Telefon ve tabletten girin
- Adres **https://** ile başlar. Bu sayede kamera, mikrofon ve "ana ekrana ekle" çalışır.
- iPhone / iPad: **Safari** ile açın. Android telefon / tablet: **Chrome** ile açın.
- İlk açılışta **Soru Çöz** ekranında aile PIN'ini bir kez girin.
- İlk fotoğrafta **kamera**, ilk sesli soruda **mikrofon** izni sorulur; **İzin ver** deyin.
  - iPhone/iPad'de yanlışlıkla reddedildiyse: **Ayarlar → Safari → Kamera / Mikrofon → Sor**.
  - Android'de: adres çubuğundaki simge → **İzinler**.
- **Türkçe ses:** Anlatım cihazın kendi sesiyle okunur.
  - iPhone/iPad'de Türkçe ses yoksa: **Ayarlar → Erişilebilirlik → Seslendirilen İçerik → Sesler → Türkçe**.
  - Android'de: **Ayarlar → Metin okuma → Türkçe** sesini indirin.

## 11. Ana ekrana Pi Hoca'yı ekleyin
| Cihaz | Nasıl |
|---|---|
| iPhone / iPad (Safari) | Paylaş düğmesi □↑ → **Ana Ekrana Ekle** → **Ekle** |
| Android (Chrome) | Sağ üstteki ⋮ → **Ana ekrana ekle** veya **Uygulamayı yükle** |

Artık Pi Hoca simgesine dokunmak yeterli. Tabletlerde ekran dikey de yatay da kullanılabilir.

---

## Kızınıza söyleyebilecekleriniz
- Fotoğrafta **yalnızca soru** görünsün. Adı, okulu, bir yüz veya kişisel bilgi varsa önce **kırp**
  düğmesiyle kesin. Bu uyarı fotoğraf ekranında da yazar.
- Sesle soru sorarken telefonun konuşma tanıma özelliği sesi Google'a veya Apple'a gönderebilir.
  İstemezseniz soruyu yazarak veya fotoğrafla sorun.

## Sorun giderme
| Ne görüyorsunuz? | Ne yapmalı? |
|---|---|
| "Kurulum tamamlanmamış: Aile PIN'i tanımlanmamış" | 6–7. adımlardaki `APP_ACCESS_PIN` ve `APP_SESSION_SECRET` değerlerini ekleyip **Redeploy** yapın. |
| "Kurulum tamamlanmamış: … Upstash" | 8. adımı yapıp **Redeploy** yapın. |
| "API anahtarı geçersiz" | Cloudflare token'ı veya Account ID yanlış kopyalanmış. 3. adımla yeni token alıp Vercel'de değiştirin, **Redeploy** yapın. |
| "Bugünkü ücretsiz yapay zekâ kapasitesi doldu" | Normal: ücretsiz kapasite yarın 03:00'te yenilenir. Bu sırada işlem/denklem soruları ve alıştırmalar çalışır. Groq yedeğini kurmadıysanız 3b. adımı yapabilirsiniz. |
| "Pi Hoca şu an çok yoğun" | Birkaç dakika sonra tekrar deneyin. |
| "Pi Hoca'ya şu an ulaşılamıyor" | Cihazın internet bağlantısını kontrol edin. |
| Ana sayfada "DEMO" yazıyor | `AI_PROVIDER`, `CLOUDFLARE_ACCOUNT_ID` veya `CLOUDFLARE_API_TOKEN` eksik. 6. adımı kontrol edip **Redeploy** yapın. |

## Gerekirse
- **Token'ın başkasının eline geçtiğinden şüphelenirseniz:** Cloudflare → My Profile → API Tokens
  → ilgili token'ı **Roll** veya **Delete** edin. Yenisini Vercel'e girip Redeploy yapın.
- **Tüm veriyi silmek:** Her cihazda **Ayarlar → Tüm verilerimi sil**. Bulutta soru defteri tutulmadığı
  için başka bir şey gerekmez.
- **Evdeki bilgisayarla ücretsiz çalıştırma** (alternatif): `EV_KURULUMU.md`.

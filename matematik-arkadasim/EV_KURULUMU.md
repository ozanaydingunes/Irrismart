# Pi Hoca'yı evde ücretsiz kurma: bilgisayar, telefon ve tablet

> ℹ️ **Önerilen kurulum artık bulut:** ev bilgisayarı ve telefona program gerektirmeyen ücretsiz kurulum için
> **[UCRETSIZ_BULUT_KURULUMU.md](UCRETSIZ_BULUT_KURULUMU.md)**. Bu rehber, isterseniz evdeki bilgisayarla çalıştırma (alternatif) içindir.
> Ev kurulumunda `.env.local` içine `AI_PROVIDER=ollama` yazılmalıdır (`npm run kurulum` bunu yapar).

Bu rehber teknik bilgi gerektirmez. Sonunda kızınız **telefonundan veya tabletinden** Pi Hoca'ya
soru sorabilir. Yapay zekâ **evdeki Windows bilgisayarda** çalışır; telefon ve tabletlere model
kurulmaz. Hiçbir ücretli servis veya abonelik kullanılmaz.

```
 Telefon / tablet  ──(Tailscale: şifreli, özel bağlantı)──►  Ev bilgisayarı
 (kamera, mikrofon, ses,                                     ├─ Pi Hoca uygulaması
  tahta burada çalışır)                                      └─ Ollama + yapay zekâ modeli
```

**Bu kurulumda ne yapmıyoruz?** Windows güvenlik duvarını kapatmıyoruz. Modemde port
yönlendirme yapmıyoruz. Ollama'yı internete açmıyoruz. Çocuğun verilerini başka bir şirketin
sunucusuna göndermiyoruz.

> ⏱️ Toplam süre yaklaşık 45–60 dakikadır. En uzun kısım modelin indirilmesidir (≈3,4 GB).

---

## Önce bilmeniz gerekenler (dürüst özet)

- **Hesaplar ebeveynin adına açılır.** Ollama'nın kullanım şartları 18 yaş üstünü şart koşar.
  Tailscale ise 16 yaş altına yönelik değildir ve çocukların hesap açmasına izin vermez. Bu yüzden
  kurulumu **siz** yaparsınız, hesap **sizindir**, çocuğun cihazlarında da **siz** oturum açarsınız.
  Kızınız yalnızca Pi Hoca uygulamasını kullanır.
- **Google Gemini kullanılmıyor.** Gemini API şartları 18 yaş altının erişebileceği uygulamaları
  yasaklıyor. Ücretsiz katmanda gönderilen veriler de insanlarca okunabiliyor.
- **Performans ve doğruluk garantisi yok.** 8 GB RAM'li bilgisayar için en uygun model
  `gemma3:4b`. Bu model gerçek bilgisayarda henüz denenmedi. Bir soru 1–5 dakika sürebilir, cevaplar
  yanlış olabilir. Pi Hoca'nın kontrol adımları bazı hataları yakalar ama hepsini yakalayamaz.
  İlk günlerde çözümlere birlikte bakın.
- **Bilgisayar kapalıyken Pi Hoca soru çözemez.** Telefonda "Pi Hoca'nın bilgisayarına
  bağlanılamıyor" uyarısı çıkar. Soru defteri ve kayıtlı dersler yine açılır.

---

## Bölüm 1 — Ev bilgisayarı (bir kez)

### 1.1 Gerekli programlar
1. **Node.js**: https://nodejs.org adresinden **LTS** sürümünü indirip kurun. Tüm soruları
   "İleri" diyerek geçebilirsiniz.
2. **Ollama**: https://ollama.com/download adresinden Windows sürümünü kurun. Kurulumdan sonra saat
   yanında lama simgesi görünür. Ollama her açılışta kendiliğinden başlar ve **yalnızca bu
   bilgisayardan** erişilir.
3. **Modeli indirin**: Başlat menüsüne "Terminal" yazıp açın ve şunu yazın:
   ```
   ollama pull gemma3:4b
   ```
   İndirme bitince terminali kapatabilirsiniz.

### 1.2 Pi Hoca uygulaması
1. Uygulama klasörünü (`matematik-arkadasim`) bilgisayara indirin, örneğin `Belgeler` içine.
2. Klasörü açın, boş bir yere sağ tıklayın ve **"Terminalde aç"** seçin.
3. Sırayla şunları yazın (her biri birkaç dakika sürebilir):
   ```
   npm install
   npm run kurulum
   ```
   Kurulum sihirbazı birkaç soru sorar:
   - **RAM**: 8 GB için `gemma3:4b` önerilir.
   - **Aile PIN'i**: telefon ve tabletlerde bir kez girilir.

   Ayarlar bilgisayardaki `.env.local` dosyasına yazılır. Bu dosya hiçbir yere gönderilmez.

### 1.3 Bilgisayar uyumasın
**Ayarlar → Sistem → Güç** bölümünde "fişe takılıyken uyku" seçeneğini **Hiçbir zaman** yapın.
Ekranın kapanması sorun değil.

---

## Bölüm 2 — Tailscale: evde ve dışarıda güvenli bağlantı (bir kez)

Tailscale, cihazlarınız arasında **şifreli, özel** bir ağ kurar. Kişisel kullanım **ücretsizdir**
(6 kullanıcıya kadar, cihaz sınırı yok). Bağlantı uçtan uca şifrelidir. Tailscale sorularınızı veya
dersleri göremez. Yalnızca cihaz adları, IP adresleri ve bağlantı zamanları gibi teknik bilgileri görür.
Bu yöntemin üç faydası var:
- telefon ve tablette **HTTPS** adresi olur, böylece **mikrofon ve "ana ekrana ekle" çalışır**;
- evin dışında da (mobil veriyle) bağlanılabilir;
- modem veya güvenlik duvarı ayarı gerekmez.

### 2.1 Bilgisayarda
1. https://tailscale.com/download adresinden Windows sürümünü kurun.
2. **Kendi** Google, Microsoft veya Apple hesabınızla giriş yapın (çocuğun hesabıyla değil).
3. Tarayıcıda https://login.tailscale.com/admin adresini açın:
   - **DNS** sekmesinde **MagicDNS** açık olmalı. Aynı sayfada **HTTPS Certificates** → **Enable HTTPS**.
   - **Machines** sekmesinde bilgisayarın adını **nötr** bir adla değiştirin, örneğin
     `ev-bilgisayari` (… → Edit machine name).
     ⚠️ Cihazlara çocuğun adını **vermeyin**. HTTPS açıkken cihaz adları herkese açık sertifika
     kayıtlarında görünebilir.
4. Pi Hoca klasöründe açtığınız terminale **bir kez** şunu yazın:
   ```
   tailscale serve --bg 3000
   ```
   Ekranda `https://ev-bilgisayari.xxxx.ts.net` biçiminde bir adres çıkar. **Bu adresi not edin.**
   Bu ayar kalıcıdır, tekrar yazmanız gerekmez.

   ❌ `tailscale funnel` komutunu **kullanmayın**. O komut uygulamayı herkese, internete açar.

### 2.2 Pi Hoca'yı başlatma
- Klasördeki `scripts\windows\PiHoca-Baslat.bat` dosyasına çift tıklayın. Pencerede
  "Pi Hoca hazır!" ve telefon adresi yazar. Pencere açık kaldığı sürece Pi Hoca çalışır.
- **Bilgisayar açılınca kendiliğinden başlasın:** `Win + R` tuşlarına basın, `shell:startup` yazıp
  Enter'a basın. Açılan klasöre `PiHoca-Baslat.bat` dosyasının **kısayolunu** sürükleyin
  (sağ tıkla sürükleyip "Kısayol oluştur" seçin).

---

## Bölüm 3 — Telefon ve tabletler (her cihaz için bir kez)

| Cihaz | Tailscale uygulaması | Pi Hoca'yı açın | Ana ekrana ekleyin |
|---|---|---|---|
| Android telefon / tablet | Play Store → "Tailscale" | **Chrome** | ⋮ menü → **Ana ekrana ekle** veya **Uygulamayı yükle** |
| iPhone / iPad | App Store → "Tailscale" | **Safari** | Paylaş □↑ → **Ana Ekrana Ekle** |

Her cihazda:
1. Tailscale uygulamasını kurun. **Kendi hesabınızla** giriş yapın ve VPN iznine "İzin ver" deyin.
   Tailscale yalnızca ev cihazlarınız arasındaki bağlantıyı taşır; çocuğun diğer internet trafiği
   bundan etkilenmez.
2. Not ettiğiniz `https://ev-bilgisayari.xxxx.ts.net` adresini tarayıcıda açın.
3. **Soru Çöz** ekranında aile PIN'ini bir kez girin.
4. Ana ekrana ekleyin. Artık Pi Hoca simgesine dokunmak yeterli.
5. İlk fotoğraf veya sesli soruda **kamera** ve **mikrofon** izni sorulur; **İzin ver** deyin.
   - iPhone/iPad'de izin verilmediyse: **Ayarlar → Safari → Kamera / Mikrofon → Sor**.
   - Android'de: adres çubuğundaki kilit simgesi → **İzinler**.
6. **Ses:** Anlatım öğrencinin kendi cihazından okunur. Türkçe ses yoksa ekranda uyarı çıkar.
   - iPhone/iPad: **Ayarlar → Erişilebilirlik → Seslendirilen İçerik → Sesler → Türkçe** yolundan bir ses indirin.
   - Android: **Ayarlar → Metin okuma (TTS) → Google → Türkçe** sesini indirin.

**Tabletlerde** ekran dikey de yatay da kullanılabilir. Menü yanda durur, akıllı tahta geniş görünür.

---

## Bölüm 4 — Cihazlar arası eşitleme

Soru defteri ve gelişim bilgileri telefon, tablet ve bilgisayar arasında **otomatik** eşitlenir.
- Eşitleme **yalnızca evdeki bilgisayar üzerinden** olur. Veriler bilgisayardaki `.data` klasöründe
  tutulur; bulut veya başka bir şirket kullanılmaz.
- **Fotoğraflar eşitlenmez**, yalnızca soru metni ve çözüm eşitlenir.
- Bir cihazda silinen soru diğerlerinden de silinir. Aynı soru iki cihazda değiştirildiyse son
  yapılan değişiklik geçerli olur.
- **Ayarlar → Cihazlar arası eşitleme** bölümünde son eşitleme zamanı ve **Şimdi eşitle** düğmesi var.
- **Ayarlar → Tüm verilerimi sil** bilgisayardaki eşitleme kopyasını da siler.

---

## Bölüm 5 — Sadece ev Wi-Fi'ı ile (Tailscale olmadan, sınırlı)

Tailscale kurmak istemezseniz `PiHoca-Baslat-WiFi.bat` ile başlatın. Pencerede
`http://192.168.x.x:3000` gibi bir adres yazar; bu adresi aynı Wi-Fi'daki cihazlarda açın.

Bu yöntemin **sınırları** var:
- Adres HTTPS olmadığı için **mikrofonla soru sorma** ve **ana ekrana uygulama olarak ekleme**
  çoğu telefonda çalışmaz. Fotoğraf yükleme, yazılı soru ve sesli anlatım çalışır.
- Yalnızca evde çalışır.
- Windows ilk açılışta "Node.js'e izin verilsin mi?" diye sorar. Yalnızca **Özel ağlar**
  kutusunu işaretleyin, **Ortak ağlar** kutusunu işaretlemeyin. Güvenlik duvarını kapatmayın.

---

## Sorun giderme

| Ne görüyorsunuz? | Ne yapmalı? |
|---|---|
| "Pi Hoca'nın bilgisayarına bağlanılamıyor" | Bilgisayar açık mı ve uyku modunda değil mi? Siyah Pi Hoca penceresi açık mı? Ev dışındaysanız telefonda Tailscale açık mı? |
| "Pi Hoca şu an başka bir soruyu çözüyor" | Bilgisayar aynı anda tek soru çözer. 1–2 dakika sonra tekrar deneyin. |
| "Yapay zekâ modeli indirilmemiş" | Bilgisayarda `ollama pull gemma3:4b` komutunu çalıştırın. |
| Cevap çok geç geliyor / bilgisayar donuyor | Diğer programları (özellikle tarayıcı sekmelerini) kapatın. `.env.local` içinde `OLLAMA_NUM_CTX=4096` yapıp Pi Hoca'yı yeniden başlatın. |
| Mikrofon düğmesi çalışmıyor | Adres `https://` ile mi başlıyor? (Wi-Fi modunda mikrofon çalışmaz.) İzinleri kontrol edin. |
| Yeni cihaz eklemek | Bölüm 3'ü o cihazda tekrarlayın. |

---

## Hangi bilgi nereye gidiyor?

| Bilgi | Nerede kalır |
|---|---|
| Soru fotoğrafı | Telefondan **ev bilgisayarına** gider, çözülür ve **saklanmaz**. |
| Soru metni, çözümler, soru defteri | Cihazda ve ev bilgisayarının `.data` klasöründe |
| Ses (mikrofon) | Konuşma, cihazın kendi konuşma tanıma özelliğiyle yazıya çevrilir. Ses kaydı saklanmaz. Not: bazı telefonlar bu çeviri için kendi üreticisinin (Apple/Google) hizmetini kullanabilir. Bunu istemiyorsanız soruyu yazarak veya fotoğrafla sorun. |
| Tailscale | Yalnızca teknik bilgileri görür (cihaz adları, IP adresleri, bağlantı zamanları). İçerik uçtan uca şifrelidir. |
| Ollama / Google / başka şirket | Hiçbir şey gönderilmez; model tamamen bilgisayarınızda çalışır. |

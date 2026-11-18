# MH-MANUEL — Manuel Mühendislik Müdahalesi ve Senaryo Simülasyonu

Durum: **konsept ve tasarım yönü onaylandı (18.11.2026); bu revizyon proje sahibinin teknik
düzeltmelerini içerir. Kodlamaya, bu revizyon onaylanmadan başlanmaz.** Her alt aşama ayrı dal ve
ayrı PR'dır; proje sahibinin açık onayı olmadan `main`'e birleştirilmez. MH-MANUEL kodu PR #10
(MH-WEB-2) ve PR #8 (MH-AKIL-2) içine eklenmez.

Tasarım önizlemeleri (masaüstü ve Android, üç örnek): https://claude.ai/artifact/1Nb5xGgWwvjbxDLsfJqLiT
(özel; yalnız proje sahibi açabilir). Sayıların kaynağı her yerde ayrıca belirtilir:

- **Motor** — bugünkü `IrriEngine.design` + `IrriAssess.evaluate` ile, yalnız ilgili girdi
  değiştirilerek hesaplanmıştır (test2 örnek projesi: domates, 288,9 da, kuyu 40 m, Akdeniz,
  86,3 m³/h, eşdeğer dikdörtgen, ana hat 2 986 m).
- **Örnek** — yalnız ekran düzenini göstermek için yazılmıştır; hesaplanmamıştır.
- **Hesaplanmadı** — bugünkü motor bu girdiyi kabul etmiyor.

## 1. Amaç ve temel ayrım

Kullanıcı bir mühendislik uyarısını gördüğünde, uyarıya yol açan **gerçek fiziksel girdileri** bir
taslakta değiştirir; aynı motorla yeniden hesaplatır; eski ve yeni sonucu karşılaştırır; onaylarsa
değişikliği revizyon kaydıyla projeye uygular. Android ve masaüstünde aynı motor, aynı veri modeli.

| | Kullanıcı kararı (MH-AKIL-1, bugün var) | MH-MANUEL (yeni) |
|---|---|---|
| Neyi değiştirir | Yalnız uyarının değerlendirme durumunu | Proje **girdilerini** (debi, süre, çap…) |
| Teknik uygunluk | Değişmez | Motor yeniden hesaplar; uygunluk yeni sonuca göre belirlenir |
| Hesap | Yok | Gerçek motor, aynı formüller |

**Hesap sonuçları hiçbir zaman elle yazılmaz.** Basınç, hız, tur süresi, ΔH gibi değerler yalnız
onları belirleyen girdiler değiştirilerek yeniden hesaplanır.

## 2. Bugünkü kodda bulunan ve plana yön veren davranışlar

### 2.1 Hesap davranışları (test2 ile motorda denendi — hepsi Motor)

| Deneme | Sonuç | Plan için anlamı |
|---|---|---|
| Kaynak debisi 86,3 → 110 m³/h | Değişiklik yok: 16 shift, tur 30,7 h | Shift gruplaması basamaklıdır; ekran bunu açıkça söyler. |
| 86,3 → 130 m³/h | 11 shift, tur 21,1 h (sınır 20 h) — hâlâ uygunsuz | — |
| 130 m³/h + günlük 22 h | Tur 21,1 ≤ 22 h → W-KAP-01 çözüldü; **yeni** W-HIZ-01 (1,82 m/s), W-POM-01, W-KAP-02, W-SHF-01; motor 30 → 45 kW | "Çözülen / devam eden / yeni" ayrımı şart. |
| 140 veya 150 m³/h | 130 ile aynı sonuç | Basamak etkisi. |
| Günlük süre 24 h (debi aynı) | Tur 30,7 h > 24 h | Süre tek başına kapasiteyi çözmüyor; ekranda yazılır. |
| `Ns = 20` | Motor 16 shift kullandı; genel uyarı listesine "20 shift uygulanamıyor (alt ünite sayısı 32)" yazdı | Uyarı var ama **gerekçesi yanıltıcı** (20 ≤ 32). Asıl neden: motorun gruplama alternatifleri arasında 20'li düzen yok. Uyarı kartında da görünmüyor. |
| `mainOd = 110, 125` | Motor Ø160 kullandı; **hiçbir uyarı yok** | Ø110/125'te hız 2,0 m/s'yi aşıyor; motor bu çapları aday listesine almıyor. |
| `mainOd = 180` | Motor Ø160 kullandı; **hiçbir uyarı yok** | Ø180 PVC-U kataloğunda yok. |
| 130 + 22 h + Ø200 | Hız 1,82 → 1,17 m/s; gerekli H 76,9 → 67,5 m; kapama 64 → 44,5 m (W-PN-02 çözüldü); enerji 90 329 → 73 394 kWh; malzeme ara toplamı +405 765 ₺ (örnek fiyatlar) | Fark metni gerçek farklardan üretilebilir. |
| Ø140 (motor PN10 seçti) | Dalga hızı 300 → 385 m/s, ΔH 37,1 → 67,4 m, tepe 113 m > 102 m | PN yükseltmek su darbesini otomatik çözmez. |
| Ø200 PN6 (86,3 m³/h) | Tepe 52 m < 61,2 m → W-SD-01 "ön değerlendirme"ye döner, "uygun" olmaz | Su darbesi hiçbir manuel değişiklikle "güvenli" olmaz. |

Bir `design` çağrısı test2'de ~81 ms, çizilmiş parselde uyarı değerlendirmesiyle ~30 ms sürdü
(geliştirme sunucusu). Hesap bu yüzden kullanıcının **"Yeniden hesapla"** demesiyle çalışır (§9).

### 2.2 Veri güvenliği bulguları (`www/js/store.js`, `www/js/app.js`)

| No | Bulgu | Risk |
|---|---|---|
| D-1 | `snapshot` yalnız `inp, poly, src, hydro` saklıyor. `route` (ana hat güzergâhı), `station` (istasyon), `shiftEdit` (elle shift atamaları), `akil` (uyarı kararları, MH-AKIL-2 sonuçları), `techOpt` (teknik pafta ayarları), `meta`, `elev`, `drawPos` revizyona girmiyor. | Revizyona dönüşte bu alanlar geri gelmez. |
| D-2 | `restoreRev` de yalnız aynı dört alanı geri yüklüyor. | Aynı. |
| D-3 | 20 revizyon sınırı aşılınca en eski kayıtlar `splice` ile **sessizce siliniyor**. | Kullanıcıdan habersiz kayıp. |
| D-4 | `mergeBackup` aynı kimlikli projenin **üzerine sorulmadan yazıyor** (yerel kopya daha yeni olsa bile). | Eski bir yedeği yüklemek yeni çalışmayı siler. |
| D-5 | `restoreRev` için arayüzde düğme yok; revizyonlar kullanıcıya görünmüyor. | Geri dönüş olanağı fiilen yok. |
| D-6 | Revizyon yalnız başarılı hesap sonrası alınıyor (`snapshot(cur, 'hesap')`); harita düzenlemeleri hesaplanmadan kayboldu sayılmaz ama revizyona da girmez. | Ara durumlar geri alınamaz. |
| D-7 | Bütün projeler tek `localStorage` anahtarında; taslaklar ve tam revizyonlar boyutu büyütür. Kayıt hatası mesajı var, ama sınıra yaklaşırken taslak/revizyon için önlem yok. | Kota dolunca kayıt başarısız olabilir. |

Bu bulguların çözümü, proje sahibinin isteğiyle **MH-MANUEL-1'in ilk parçası (1A)** olmuştur (§13).

## 3. Değişecek dosyalar

| Dosya | Aşama | Değişiklik |
|---|---|---|
| `www/js/store.js` | **1A** | Şema 3: tam proje durumu listesi (`STATE_FIELDS`), tam anlık görüntü ve tam geri yükleme, sessiz silmenin kaldırılması, yedek birleştirmede çakışma koruması, taslak alanı ve göç |
| `www/js/app.js` | 1A–4 | Revizyon listesi ve geri dönüş ekranı (1A), yönlendirme, taslak önizlemesi (4) |
| `www/js/manual.js` (yeni) | 1B–3 | `IrriManual`: kaldıraç kaydı, seçim listeleri, doğrulama, `run(taslak)`, istenen–uygulanan denetimi, karşılaştırma, fark metinleri, uygulama |
| `www/js/manual-view.js` (yeni) | 1B–3 | Düzenleme ve karşılaştırma ekranı (Android ve masaüstü aynı bileşen, iki yerleşim) |
| `www/js/assess-view.js` | 1B | Uyarı kartına "Değerleri düzenle ve yeniden hesapla" düğmesi |
| `www/js/desk.js` | 1B | Masaüstünde düzenleme çalışma alanı |
| `www/js/report.js`, `report-data.js` | 4 | Manuel müdahale ve revizyon bölümü |
| `www/js/i18n-dict.js`, `www/css/app.css` | 1A–4 | Metinler (7 dil), bileşenler |
| `www/js/engine.js` | **yok** | MH-MANUEL-1…4 motoru değiştirmez. Motor girdileri ayrı planla (§5) |
| `test/store.test.js` (genişler), `test/manual.test.js`, `test-ui/manual.ui.js` | 1A–4 | §11 |

## 4. Düzenlenebilir girdiler ve seçim aşamasında engelleme

### 4.1 Bugünkü motorun kabul ettiği girdiler

| Uyarı | Girdi | Anahtar | Girdi biçimi (geçersiz seçenek seçilemez) |
|---|---|---|---|
| Tur/kapasite (W-KAP-01/02/03, W-SHF-01/02) | Kaynak debisi | `Q` | Sayı, 0,1–3000 m³/h |
| | Günlük çalışma | `hours` | Sayı, 1–24 h |
| | Sulama aralığı | `interval` | Tam sayı, 1–30 gün (MH-AKIL-2'deki `Imax` üstü uyarılı) |
| | Shift sayısı | `Ns` | **Yalnız motorun alternatif listesi** (`r.sectorAlts`) + "Otomatik" |
| | Elle shift ataması | `shiftEdit` | Harita fırçası, taslak kopyasında (MH-MANUEL-4) |
| | Damlatıcı debisi / aralığı / tipi / basıncı | `q`, `Se`, `emitter`, `hNom`, `pcMin/pcMax` | Sayı / liste, `IrriValidate` sınırları |
| | Sıra yönü, lateral çapı, manifold hattı | `rowDir`, `latD`, `nB` | Liste / tam sayı |
| Hız / basınç (W-HIZ-01, W-PN-01/02, W-POM-03) | Ana hat dış çapı | `mainOd` | **Yalnız motorun aday listesi** (`r.main.alts`): her satırda dış çap, PN, iç çap, et, hız, gerekli H |
| | Kaynak–arazi mesafesi, kot farkı | `dSource`, `dZ` | Sayı |
| | Güzergâh, istasyon | `route`, `station` | Harita (MH-MANUEL-4) |
| Pompa (W-POM-01/02) | Dinamik su seviyesi, mevcut basınç | `depth`, `pAvail` | Sayı |
| | Üretici kataloğu | Ayarlar → katalog | Doğrulanmış kayıt yoksa "temsili" etiketi kalır |

### 4.2 Motorun kabul etmediği istekler: istenen ve uygulanan değer

Geçersiz seçenekler **seçim aşamasında** listede gösterilmez; gösterilmeyenler için "neden yok"
satırı vardır. Yine de bir istek motorca değiştirilirse (eski proje, içe aktarma, başka girdinin
değişmesiyle listenin değişmesi) yeniden hesaptan sonra sarı satır çıkar:

| Alan | İstenen | Uygulanan | Neden (gerçek kurala göre) | Seçilebilir değerler |
|---|---|---|---|---|
| Shift sayısı | 20 | 16 | Motorun gruplama alternatifleri arasında 20 shift'li düzen yok | Motor listesi (ör. 16) |
| Ana hat | Ø110 / Ø125 | Ø160 | En büyük shift debisinde hız 2,0 m/s'yi aşıyor; motor aday almıyor | Ø160, 200, 225, 250, 315 (130 m³/h için) |
| Ana hat | Ø180 | Ø160 | PVC-U kataloğunda Ø180 yok | Aynı liste |

Kurallar:
- **Gösterilen sonuç her zaman uygulanan değerin sonucudur.** Kullanıcı tercihi uygulanmış gibi
  sunulmaz; karşılaştırma satırında "istenen Ø180 · uygulanan Ø160" yazar.
- Nedenler motorun kendi kurallarından türetilir (katalog üyeliği, `Hy.velocity` ile 2,0 m/s
  sınırı, motorun alternatif listesi). Ayrı tahmin kuralı yazılmaz.
- Motorun "20 shift uygulanamıyor (alt ünite sayısı 32)" metnindeki gerekçe yanıltıcıdır. Metni
  düzeltmek motor değişikliği sayılır; §5'teki motor planına "M-0: uyarı metni düzeltmesi" olarak
  eklenmiştir. O zamana kadar MH-MANUEL kendi doğru gerekçesini gösterir.

## 5. Gelecekteki motor girdileri — ön inceleme (ayrı plan, ayrı PR, ayrı onay)

MH-MANUEL-1…4'te bunlar ekranda **pasif** görünür ("Bu sürümde motor girdisi değil —
Hesaplanmadı"); değer girilse bile hesaba katılmaz ve hesaplanmış sonuç gibi gösterilmez.
Her biri için ayrı teknik plan, ayrı PR, bağımsız mühendislik doğrulaması ve
`docs/hesap-degisiklik-kaydi.md` kaydı gerekir. Ortak kural: **girdi verilmediğinde motor bugünkü
sonucu bit bit aynı üretir** (MH-0 altın kayıtları değişmez; testle kanıtlanır).

| Kod | Girdi | Bugünkü motor ve katalog | Önerilen yaklaşım | Bağımsız doğrulama |
|---|---|---|---|---|
| M-0 | Shift isteği uyarı metni | `inp.Ns` listede yoksa yanıltıcı gerekçe | Gerekçe: "gruplama alternatifleri arasında yok" | Metin testi; hesap değişmez |
| E-1 | Ana hat PN sınıfı (en az PN) | Her çap için PN'ler küçükten büyüğe deneniyor; koşulu sağlayan **ilk** PN seçiliyor (`1,25·Pop ≤ PN`, `Pshut ≤ PN`) | `mainPnMin`: daha düşük PN'ler atlanır. Kataloğun PN6/10/16 kayıtları (iç çap, et) zaten var | Elle hesap: iç çap, hız, sürtünme ve Joukowsky değerlerinin katalog et kalınlığıyla yeniden hesabı; EPANET ile iki senaryo |
| E-2 | Pompa modeli | Katalogda 273 pompa, eğrili (Q–H–verim); hepsi **"Jenerik — gerçek ürün değil"**. Motor pompayı kendisi seçiyor; kapama basıncı eğrinin en yüksek H'sinden | `pumpId`: seçilen eğride görev noktası, eğri dışı ise açık hata. Gerçek üretici kataloğu gelmeden "doğrulanmış" etiketi verilmez | Üretici eğrisiyle görev noktası ve güç karşılaştırması; eğri dışı testleri |
| E-3 | Ana hat malzemesi | Ana hat yalnız PVC-U kataloğundan; PE100 kaydı (28 adet) yalnız manifoldda. Su darbesinde E: PE 1,0 GPa, diğerleri 3,0 GPa | PE100 ana hat seçeneği; malzemeye göre sürtünme katsayısı ve E değeri kaynaklı olarak | E-modülü kaynakları (sıcaklık/süre etkisi), dalga hızı elle hesabı; EPANET sürtünme karşılaştırması |
| E-4 | Vana kapanma süresi/karakteristiği, pompa duruşu | Yalnız Joukowsky üst sınırı ve 2L/a | **MH-AKIL-5** kapsamında (§7) | Yayımlanmış geçici rejim örnekleri (karakteristikler yöntemi) ile karşılaştırma |
| E-5 | Basınç regülatörü, koruma ekipmanı | Modelde yok; uyarılarda "veri gerekli" | Regülatör: ayar basıncı + kayıp eğrisi; tahliye vanası: açma basıncı ve kapasite | Üretici verisi; EPANET PRV ile karşılaştırma |
| E-6 | Değişken devirli pompa | Modelde yok | Benzerlik yasaları (Q∝n, H∝n²), en düşük devir sınırı, verim düzeltmesi | Üretici değişken devir eğrileri |

Önerilen sıra (§13): M-0 ve E-1 ile E-3 birlikte ilk motor PR'ı olabilir (en düşük risk,
katalog verisi hazır); E-2 ve E-6 gerçek üretici kataloğu gerektirir; E-4 MH-AKIL-5 ile; E-5 en son.

## 6. Bağımlılık haritası (sonuçların hangi girdilerden türediği)

| Sonuç | Belirleyen girdiler |
|---|---|
| Brüt ihtiyaç, uygulama hacmi | iklim (`region`, `et0`), `crop`/`kc`, `Gc`, `Ea`, `interval`, alan |
| Shift debileri ve sayısı | yerleşim (`q`, `Se`, `Sr`, `rowDir`, `latD`, `nB`, geometri), `Q`, `Ns`, `shiftEdit` |
| Tur süresi, kapasite | yukarıdakiler + `hours`, `interval` |
| Ana hat çap/PN, hız, kayıp | shift debileri, `mainOd`, güzergâh, `dSource`, katalog |
| Gerekli basınç, pompa, güç, enerji | ana hat + manifold/lateral kayıpları, `hNom`, `dZ`, `depth`/`pAvail`, pompa kataloğu, `srcType` |
| Pompa kapama basıncı | seçilen pompa eğrisinin en yüksek H'si + mevcut basınç − en alçak nokta |
| Su darbesi (Joukowsky) | ana hat iç çapı, et, malzeme (dalga hızı), hız, ana hat uzunluğu, işletme basıncı |
| Malzeme ve maliyet | yerleşim, ana hat kesitleri, birim fiyatlar |

## 7. Su darbesi

- Ekran her durumda iki etiket taşır: **"Ön değerlendirme — ayrıntılı geçici rejim analizi
  gerekli"** ve **"Mühendislik doğrulaması gerekli"**. Bu etiketler; ayrıntılı geçici rejim,
  pompa duruşu, vakum ve negatif basınç kontrolleri yapılmadıkça hiçbir taslakta kalkmaz.
- PN yükseltmek (E-1 gelse bile), vana kapanma süresi girmek veya koruma ekipmanı işaretlemek
  otomatik "güvenli" kararı üretmez (§10-K6, test T-SD-1…4).
- Manuel veri altyapısı (MH-AKIL-5 girdisi): taslakta `veri.gecici = { kapanmaSuresi_s,
  kapanmaTipi: 'dogrusal'|'kademeli'|'bilinmiyor', pompaDurusu: { atalet_kgm2 },
  koruma: [{ tur: 'tahliye'|'hava-vakum'|'hidrofor', ... }], profilKaynak: null }`.
  Bu alanlar **motorca kullanılmaz**; "Veri girildi — MH-AKIL-5 ile değerlendirilecek" etiketi
  taşır. Kapanma süresi yalnız motorun 2L/a değeriyle **metin olarak** karşılaştırılır.
- **MH-AKIL-5 entegrasyonu:** MH-AKIL-5, `veri.gecici` alanlarını aynı adlarla girdi olarak
  okuyacak (ayrı onaylı motor/modül). O aşamada da sonuçlar ön değerlendirme olarak kalır; kesin
  onay için ayrıntılı analiz (karakteristikler yöntemi) ya da dış doğrulama gerekir.

## 8. Taslak, revizyon ve yedek veri modeli

```js
// Şema 3. Eski projelerde alan yoksa boş kabul edilir; hiçbir mevcut alan silinmez.
const STATE_FIELDS = ['inp', 'poly', 'src', 'route', 'station', 'shiftEdit', 'akil', 'techOpt',
                      'hydro', 'meta', 'elev', 'drawPos', 'name'];      // tek liste; testle denetlenir

project.revs[i] = {
  rev, t, note,
  data,            // STATE_FIELDS'in TAMAMININ JSON görüntüsü (şema 2 kayıtları okunabilir kalır)
  sabit: false,    // kullanıcı "sakla" dediyse sınırda bile silinmez
  degisiklik: {    // yalnız MH-MANUEL uygulamalarında
    kaynak: 'manuel' | 'akil2', taslak: 'd_…',
    parametreler: [{ k: 'Q', eski: 86.3, yeni: 130, birim: 'm³/h', uygulanan: 130 }],
    fark: { tur: [30.7, 21.1], H: [73.9, 76.9], kWh: [82608, 90329], uygunsuz: [3, 2] },
    uyarilar: { cozulen: ['W-KAP-01'], devam: ['W-PN-02', 'W-SD-01'], yeni: ['W-HIZ-01'] },
    hesaplanmayan: ['W-SD-01: ayrıntılı geçici rejim'],
  },
};

project.drafts = [{
  id: 'd_…', ad: 'Debi 130 + 22 saat', kaynak: 'manuel' | 'akil2', uyari: 'W-KAP-01',
  tabanRev: 7, tabanImza: '…',                    // hangi revizyondan türedi
  degisiklik: { inp: { Q: 130, hours: 22 }, geo: null, shiftEdit: null },   // yalnız farklar
  veri: { gecici: null },                         // §7
  sonHesap: { imza, motorSurum, tarih, ozet, kodlar, uygulanmayan: [{ k, istenen, uygulanan, neden }] },
  olusturma, guncelleme,
}];
```

Kurallar:
1. **Taslak orijinali değiştirmez.** Hesap `durum ⊕ degisiklik` kopyasıyla yapılır; proje nesnesine
   yazılmaz.
2. **Uygula** = (a) bugünkü tam durumun revizyonu, (b) farkların yazılması, (c) değişiklik kaydıyla
   yeni revizyon, (d) depoya yazma. Herhangi bir adım başarısız olursa önceki durum aynen geri
   konur (işlem bütün ya da hiç). Açık onay penceresi olmadan çalışmaz.
3. **Geri dönüş** bir revizyonu yeni revizyon olarak geri yükler; geçmiş silinmez; bütün
   `STATE_FIELDS` geri gelir.
4. **Sessiz silme yok.** Revizyon (20) veya taslak (10) sınırına gelindiğinde kullanıcıya sorulur:
   "JSON yedek al ve en eskiyi sil" / "En eskiyi sil" / "Vazgeç". Sabitlenmiş revizyonlar
   seçilmez. Kullanıcı vazgeçerse yeni revizyon/taslak oluşturulmaz ve bu açıkça yazılır.
5. **Yedekten yükleme çakışması:** aynı kimlikli proje yerelde farklıysa sorulur: "Yereli koru",
   "Yedektekiyle değiştir (yerel önce revizyona alınır)", "İkisini de tut (kopya)". Varsayılan
   ikisini de tutmaktır. Hiçbir durumda yerel veri sorulmadan kaybolmaz.
6. **Sonuçlar kalıcı gerçek değildir.** `sonHesap` yalnız özet + imzadır; imza (girdi + motor
   sürümü + katalog + fiyat) değiştiyse sonuç "Güncel değil — yeniden hesaplayın" olur ve uygula
   kapalıdır.
7. **Depolama payı:** kayıttan önce boyut tahmini; tarayıcı sınırına yaklaşınca (WEB-1'deki
   kullanım göstergesi) taslak ve revizyon oluşturmadan önce uyarı ve yedek önerisi.
8. **JSON yedek** taslakları, revizyonları ve sabitleme bilgisini taşır; Android ↔ web aynı dosya.

## 9. Yeniden hesaplama akışı

1. Girdi değişince yalnız doğrulama çalışır (sınır, tam sayı, liste üyeliği).
2. Sonuçlar "Hesaplanmadı — girdiler değişti" olur; eski sonuç soluk ve etiketli kalır.
3. "Yeniden hesapla": `IrriEngine.design` + `IrriAssess.evaluate` + `IrriHydroView.build`.
4. İstenen–uygulanan denetimi (§4.2).
5. Karşılaştırma ve uyarı farkı (çözülen / devam eden / yeni / hesaplanmayan).
6. Harita önizlemesi (MH-MANUEL-4).

## 10. Mühendislik doğrulama kuralları

| No | Kural |
|---|---|
| K1 | Hesap sonucu olan hiçbir değer girdi olarak düzenlenemez. |
| K2 | Bütün sayılar motordan gelir; oran/tahmin yöntemi yok. |
| K3 | Çap listesi katalog dış çaplarından; iç çap ve et katalogdan, ayrı gösterilir. |
| K4 | Uygulanmayan istek açıkça gösterilir; sonuç uygulanan değerin sonucudur. |
| K5 | Temsili (doğrulanmamış) pompa/boru kayıtlarıyla yapılan sonuçlar "temsili" etiketini korur. |
| K6 | "Teknik olarak uygun" yalnız: hiçbir uygunsuz uyarı yok **ve** hiçbir zorunlu kontrol "değerlendirilmedi / hesaplanmadı / ön değerlendirme / veri gerekli" değil. Bugün W-SD-01 her zaman ön değerlendirme olduğundan en iyi durum: "Hesaplanan kontrollerde uygunsuzluk yok — su darbesi için mühendislik doğrulaması gerekli". |
| K7 | Aynı kaynağı paylaşan alt projelerin debi payları toplamı kaynağı aşamaz. |
| K8 | Kullanıcı kararı teknik durumu değiştirmez. |
| K9 | Karşılaştırma metinleri yalnız hesaplanmış farklardan üretilir; fiyatı eksik kalemlerde "maliyet kesin değil" yazılır. |
| K10 | İmzası eskimiş taslak uygulanamaz. |

## 11. Otomatik (MH-AKIL-2) ve manuel alternatifler — ortak model

İki sistem ayrı kalmaz. MH-AKIL-2'nin her satırı (`IrriSolver` `row.inp`) ortak alternatif
biçimine dönüşür: `{ kaynak: 'akil2', degisiklik: { inp: farklar } }`. Kullanıcı "Bu alternatifi
taslak olarak aç" der, değiştirir, yeniden hesaplar, kendi alternatifi olarak kaydeder.

Karşılaştırma tablosu (otomatik ve manuel alternatifler yan yana, aynı alanlar):
kaynak debisi · shift sayısı · sulama turu ve sınırı · ana hat çap/PN (en büyük kesit ve kademeler) ·
gerekli pompa basıncı · pompa gücü · yıllık enerji ve maliyeti · malzeme miktarı · malzeme
maliyeti · çözülen uyarılar · devam eden uyarılar · yeni uygunsuzluklar · **hesaplanmayan
kontroller**.

MH-AKIL-2 alternatifleri bugün su darbesini alternatif başına ayrıca hesaplamıyor
(`ALT_KAPSAM` notu). Bu tür alanlar tabloda **"Hesaplanmadı"** yazar; boş, yeşil ya da "uygun"
görünmez. "Önerilen" etiketi yalnız K6'yı sağlayan alternatife verilir.

PR #8 birleşmeden MH-MANUEL `IrriSolver`'a bağlanmaz; ortak biçim MH-MANUEL-5'te bağlanır.

## 12. Ekranlar ve akışlar

Tasarım önizlemesindeki üç örnek (sulama süresi; ana hat hız/basınç; su darbesi ve PN) onaylandı.
Bileşenler: başlık ve taslak adı · mevcut değerler ve sınır · girdiler (geçerli seçenek listeleri ve
"neden yok" satırları) · pasif motor girdileri · eksik teknik bilgiler · Yeniden hesapla ·
karşılaştırma · fark açıklaması · uyarı farkı · harita etkisi (4) · İptal / Taslağı kaydet /
Projeye uygula. 1A ile ayrıca **revizyon listesi**: tarih, not, değişen parametreler, sabitle,
bu revizyona dön (onaylı).

**Masaüstü:** uyarı (sağ panel, alt panel, Sonuç) → orta alanda çalışma alanı; Tab ile alanlar,
Enter ile yeniden hesapla. **Android:** tam ekran sayfa, sabit "Yeniden hesapla", kaydırılabilir
"Önce → Sonra" kartları, altta Taslağı kaydet / Uygula.

## 13. Alt aşamalar ve geliştirme sırası

| Sıra | Aşama | Kapsam |
|---|---|---|
| 1 | **WEB-2 (PR #10)** | Masaüstü kullanıcı kabul testi, sonra birleştirme kararı |
| 2 | **MH-AKIL-2 (PR #8)** | Telefon testi; main ile çakışmaların çözülmesi (bugün `package.json`, `app.css`, `i18n-dict.js`; PR #10 birleşince `app.js` de); ayrı birleştirme onayı |
| 3 | **MH-MANUEL-1A — veri koruma** | Şema 3, `STATE_FIELDS`, tam anlık görüntü ve geri yükleme, sessiz silmenin kaldırılması, sabitleme, yedek çakışma koruması, revizyon listesi ve geri dönüş ekranı (§8, §14) |
| 3 | **MH-MANUEL-1B — taslak ve ekran** | Kaldıraç kaydı, seçim listeleri, taslak modeli, düzenleme ekranı, Taslağı kaydet / İptal. Sonuç alanı "Hesaplanmadı" |
| 4 | **MH-MANUEL-2** | Yeniden hesaplama, istenen–uygulanan, uyarı farkı, K6 etiketi |
| 5 | **MH-MANUEL-3** | Karşılaştırma ve fark metinleri, Projeye uygula (bütün ya da hiç), değişiklik kaydı |
| 6 | **MH-KML** | KML/KMZ içe aktarma (Android + masaüstü, sürükle-bırak) |
| 7 | **MH-MANUEL-4** | Harita önizlemesi, malzeme farkı, PDF/Excel bölümü |
| 8 | **MH-AKIL-5** | Su darbesi ileri ön değerlendirmesi (`veri.gecici` girdileriyle) |
| 9 | **MH-MANUEL-5** | MH-AKIL-2 satırından taslak, otomatik ↔ manuel karşılaştırma, MH-AKIL-5, MH-KML ve arazi bölme |
| ayrı | **MH-MOTOR-1** (M-0, E-1, E-3) | Ayrı plan/PR/doğrulama; MH-MANUEL-3'ten sonra herhangi bir noktada |
| ayrı | **MH-MOTOR-2** (E-2, E-6) | Gerçek üretici kataloğu geldiğinde |
| ayrı | **MH-MOTOR-3** (E-5) | Üretici verisiyle |
| korunur | MH-AKIL-3 (arazi bölme), MH-AKIL-4, MH-2 (kot/eğim), MH-3 (kot–hidrolik) | Onaylı yol haritasındaki yerleriyle |

**Sıranın değerlendirmesi.** Önerdiğiniz sıra teknik bağımlılıklarla uyumlu; üç küçük öneri:

1. **PR #10 önce, PR #8 sonra birleşsin.** İkisi `app.js`, `app.css`, `i18n-dict.js` ve
   `package.json` dosyalarına dokunuyor. PR #10 birleştikten sonra PR #8'in çakışmalarını bir kez
   çözmek, iki kez çözmekten güvenli.
2. **MH-MANUEL-1'i 1A ve 1B olarak iki PR'a bölelim.** 1A (veri koruma) bütün kullanıcıları
   etkiler ve MH-MANUEL'den bağımsız değer taşır; tek başına gözden geçirilip test edilmesi daha
   güvenli. 1A, MH-AKIL-2'nin `akil` alanını da revizyona aldığı için PR #8'den sonra gelmesi
   doğru.
3. **Motor girdileri (MH-MOTOR-1) MH-MANUEL-3'ten sonra** ayrı iz olarak ilerlesin: MH-MANUEL
   ekranı hazır olduğunda yeni girdi (ör. PN) doğrudan pasif satırdan etkin satıra geçer.

## 14. Veri güvenliği kabul kriterleri (1A ve sonrası)

Her kriter otomatik testle doğrulanır (`test/store.test.js`, `test/manual.test.js`,
`test-ui/manual.ui.js`); test kodu yanında verilmiştir.

| Kod | Kriter | Doğrulama |
|---|---|---|
| V-01 | Uygulamanın projeye yazdığı **her alan** `STATE_FIELDS` listesindedir. | Test, `app.js`/`desk.js`/`manual.js` içindeki `cur.<alan>` yazımlarını tarar; listede olmayan alan testi düşürür. |
| V-02 | Tam anlık görüntü → geri yükleme, bütün `STATE_FIELDS` için birebir aynı projeyi üretir (inp, parsel, kaynak, güzergâh, istasyon, elle shift atamaları, uyarı kararları, teknik ayarlar dahil). | Derin eşitlik; 19 altın senaryo + çizilmiş parsel + elle shift atamalı proje. |
| V-03 | Taslak oluşturma, düzenleme, hesaplama ve **iptal** projeyi bayt bayt değiştirmez. | İşlem öncesi/sonrası `JSON.stringify(project)` ve depolama metni eşitliği. |
| V-04 | Taslak kaydı yalnız `drafts` alanını değiştirir. | Diğer alanların eşitliği. |
| V-05 | "Uygula" bütün ya da hiç: yazma sırasında hata (ör. kota) olursa proje ve depo işlem öncesiyle aynıdır. | `localStorage.setItem` hatası taklit edilir. |
| V-06 | Uygulama öncesi tam durum revizyona alınır; uygulama sonrası değişiklik kaydı (parametre, eski, yeni, uygulanan, tarih, fark, uyarı durumu) vardır. | Alan alan kontrol. |
| V-07 | Herhangi bir revizyona dönüş, o andaki tam durumu geri getirir ve dönüş öncesi durumu yeni revizyon olarak saklar. | V-02 yöntemi + revizyon sayısı. |
| V-08 | Revizyon (20) ve taslak (10) sınırında **hiçbir kayıt sorulmadan silinmez**; kullanıcı vazgeçerse kayıt sayısı ve içerikleri değişmez. Sabitlenmiş revizyon hiçbir seçenekte silinmez. | Sınırda ekleme denemesi; arayüz testi onay penceresini doğrular. |
| V-09 | Yedekten yüklemede aynı kimlikli, farklı içerikli yerel proje sorulmadan değiştirilmez; varsayılan "ikisini de tut". | Yerel daha yeni / yedek daha yeni / içerik aynı senaryoları. |
| V-10 | JSON yedek → başka tarayıcıda (veya Android'de) geri yükleme: projeler, taslaklar, revizyonlar, sabitlemeler aynen gelir. | Gidiş-dönüş testi (web ve Capacitor taklidi). |
| V-11 | Şema 2 projeler (ve v0.6.0 örnekleri) şema 3'e veri kaybı olmadan göç eder; eski revizyonlar okunabilir; göç tekrar çalıştırılınca sonuç değişmez. | Eski fikstürler; idempotans testi. |
| V-12 | İmzası eskimiş taslak uygulanamaz; "Güncel değil" gösterilir. | Motor sürümü/katalog/girdi değiştirilerek. |
| V-13 | Depolama sınırına yaklaşınca taslak/revizyon oluşturmadan önce uyarı verilir; kayıt başarısızsa kullanıcıya söylenir ve bellek ile depo tutarlı kalır. | Kota taklidi. |
| V-14 | Bozuk depolama verisi bugünkü gibi kurtarma anahtarına ayrılır; taslak/revizyon alanı bozuksa proje yine açılır, bozuk parça kurtarma alanına alınır. | Bozuk fikstürler. |
| V-15 | Bütün bu davranışlar Android (Capacitor) ve web masaüstünde aynıdır. | Aynı testler iki ortamda. |
| V-16 | Hesap motoru ve MH-0 altın kayıtları değişmez. | Mevcut altın kayıt testi + hesap parmak izi. |

## 15. Hesap ve ekran testleri (MH-MANUEL-1B…4)

| Grup | Senaryo |
|---|---|
| Girdi | Sınır dışı / birim / tam sayı; Ns ve çap listeleri motor listesiyle aynı; listede olmayan değer seçilemez; eski projede listede olmayan değer → istenen/uygulanan satırı ve doğru neden |
| Hesap | Debi (86,3 → 110 aynı; → 130 değişir); süre; aralık; shift; çap (Ø200 → W-PN-02 çözülür); sonuçların `design` ile birebir eşitliği |
| Uyarı farkı | Çözülen / devam eden / yeni (130 + 22 h → W-HIZ-01 yeni) / hesaplanmayan |
| Su darbesi | T-SD-1 Ø140/PN10 → hâlâ aşar; T-SD-2 Ø200 → ön değerlendirme, "uygun" değil; T-SD-3 `veri.gecici` girilse de sonuç ve etiket değişmez; T-SD-4 hiçbir taslak "Mühendislik doğrulaması gerekli" etiketini kaldıramaz |
| Alternatifler | Otomatik ve manuel satırlar aynı alanlar; hesaplanmayan alan "Hesaplanmadı"; "Önerilen" yalnız K6 |
| Eşitlik | Android (390 px, Capacitor) ve web masaüstü aynı değerler; Node ile tarayıcı eşitliği |
| Rapor | PDF/Excel değişiklik bölümü ekranla aynı (4) |
| Koruma | MH-0 altın kayıtları, 38 hidrolik denetim, EPANET doğrulamaları değişmez |

## 16. Kabul kriterleri (özellik)

1. Kaldıracı olan her uyarıda düğme var; olmayanlarda yok.
2. Gösterilen her sonuç değeri aynı girdilerle `IrriEngine.design` sonucuna birebir eşit.
3. Hesaplanmamış sonuç güncel gibi görünmez.
4. Uygulanmayan istekler istenen / uygulanan / neden / seçilebilir değerlerle gösterilir.
5. Su darbesi için hiçbir taslak "uygun/güvenli" etiketi alamaz; "Mühendislik doğrulaması gerekli" kalır.
6. Otomatik ve manuel alternatifler aynı tabloda karşılaştırılır; hesaplanmayan özellik uygun görünmez.
7. §14'teki V-01…V-16'nın tamamı geçer.
8. Android ve masaüstünde aynı özellikler ve aynı JSON.
9. Yeni metinler 7 dilde; açık/koyu temada karşıtlık ≥ 4,5.
10. Bütün eski test takımları ve altın kayıtlar geçer; MH-MANUEL-1…4 hesap motorunu değiştirmez.

## 17. KML/KMZ ve akıllı arazi bölme

- Taslak `degisiklik.geo` (`poly`, `route`, `station`, `src`) MH-KML geometrisini aynı biçimde
  taşır; içe aktarma bir taslak olarak da açılabilir.
- MH-AKIL-3 sonrası "Araziyi böl" çalışma alanı: bölme çizgileri, bölme sayısı, alt projeler.
  Her alt proje kendi taslağıdır; **kaynak grubu** kaydı (`kaynakGrup: { id, Q }`) debi paylarını
  tutar; toplam kaynağı aşamaz (K7). Ortak kaynağı paylaşan alt projeler, kaynak büyümüş gibi
  değerlendirilmez.
- MH-2/MH-3 tamamlanınca `dZ` yerine kot profili kullanılır; taslakta kot kaynağı gösterilir.

## 18. Raporlama (MH-MANUEL-4)

PDF ve Excel'e "Manuel müdahale ve revizyonlar" bölümü: orijinal değerler, değişiklikler (istenen
ve uygulanan), yeni sonuçlar, çözülen / devam eden / yeni uyarılar, hesaplanmamış kontroller,
revizyon numarası ve tarihi. "Teknik olarak uygun" ifadesi yalnız K6 sağlanırsa kullanılır.

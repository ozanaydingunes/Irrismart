# Hesap değişiklik kaydı

IrriGrow hesap motorunun sonuçlarını değiştiren **her** değişiklik burada belgelenir.

`test/golden/kayit/` altındaki altın referans kaydının parmak izi (SHA-256) bu dosyada geçmiyorsa `npm test` başarısız olur. Kayıt yalnız `node tools/golden.js` ile yenilenir. Yöntem: `docs/dogrulama/README.md`.

Her girdi şunları içerir:
- tarih, PR ve aşama;
- yeni parmak izi;
- değişen büyüklükler ve etkilenen senaryolar;
- eski ve yeni örnek değerler;
- mühendislik gerekçesi ve kaynak;
- doğrulama sonucu (`test/dogrulama.test.js`).

---

## 2026-11-17 — MH-0: İlk altın referans kaydı

- **Parmak izi:** `46f22517b152d2412fd148aa292a72d13fd7feee2078de83a74509b49268f639`
- **Motor sürümü:** v0.6.0 hesap motoru (`www/js/*.js`, `main` @ `58f61bd`).
- **Değişiklik:** Yok. Bu kayıt mevcut sonuçların ilk dondurulmuş hâlidir; hiçbir hesap değiştirilmedi.
- **Kapsam:** 18 tasarım senaryosu (S01–S19; S04 ve S20 bekliyor) ve Hidrolik Hesap Tablosu örneği (H01).
- **Doğrulama:** Bütün bağımsız doğrulama testleri tolerans içinde. Ölçülen farklar `docs/dogrulama/README.md` bölüm 2.2'de.
- **Bilinen sınırlamalar** (bu kayıtta bilinçli olarak donduruldu):
  - S03: Aşağı eğimli lateral, yukarı eğimli gibi hesaplanıyor (MH-3).
  - Manifoldda v > 2 m/s'de Watters-Keller, Darcy-Weisbach'tan az kayıp veriyor (MH-4, uyarı).

---

## 2026-11-17 — MH-1: Hidrolik paneli için motor çıktısı eklendi (sonuç değişikliği yok)

- **Parmak izi:** `46f22517b152d2412fd148aa292a72d13fd7feee2078de83a74509b49268f639` (değişmedi).
- **Değişiklik:** `engine.js` yalnızca daha önce iç değişkende kalan iki ara sonucu dışarı veriyor:
  - `main.alts[].crit`: her shift'te gerekli H'yi belirleyen alt ünite ve bileşenleri (kot, ana hat sürtünmesi, vana, ünite girişi). H aynı ifadeyle hesaplanır; yalnız toplanmadan önce kaydedilir.
  - `pump.shiftKWh`: yıllık pompa enerjisinin shift'lere dağılımı (toplamı `pump.kWh` ile aynı ifade).
  - `CONST` (G, η pompa, η motor) yöntem açıklaması için.
- **Formül, katsayı veya seçim kuralı değişmedi.** Altın kayıt ve bağımsız doğrulama testleri aynı sonuçla geçiyor; `test/hydropanel.test.js` döküm toplamının motor H değerine ve shift enerjileri toplamının yıllık enerjiye eşitliğini sınıyor.

---

## 2026-11-18 — MH-AKIL-1: Excel raporuna "Uyarılar" sayfası eklendi (hesap değişikliği yok)

- **Parmak izi (tüm kayıt):** `9ebab7fcace22e9696fd5af46715b9ad55c913ed4abc99df0fa07d0f85ecb426`
- **Hesap parmak izi (Uyarılar sayfası hariç):** `86ce24bce78bf3d8b28733e6fe9e3f4d19f1b8cf06d46a091ae429595f2b3fa4` — MH-0 ilk kaydıyla (`46f22517…`) **aynı içerik**.
- **Değişiklik:** Excel raporuna yapılandırılmış mühendislik uyarılarını içeren yeni bir "Uyarılar" sayfası eklendi (MH-AKIL-1, `www/js/assess.js`). Kayıt bu sayfayı da içerdiği için tüm kaydın parmak izi değişti.
- **Değişmeyenler:** 19 kaydın hepsinde `design` (motor sonuçları ve `r.warn` metinleri), diğer bütün Excel sayfaları, A3 pafta, DXF ve Hidrolik Hesap Tablosu birebir aynı. Bu, eski ve yeni kayıtların "Uyarılar" sayfası çıkarılarak karşılaştırılmasıyla doğrulandı. Kalıcı olarak da `test/golden.test.js` içindeki "hesap bölümü MH-0’dan beri değişmedi" testi bunu denetler.
- **Formül, katsayı, eşik veya seçim kuralı değişmedi.** `www/js/engine.js` bu PR'da değiştirilmedi.
- **Doğrulama:** `test/dogrulama.test.js` (EPANET ve bağımsız bağıntılar) ve `tools/audit.js` (38/38) aynı sonuçla geçiyor.

## 2026-11-19 — PN-1: Standart tabanlı boru kütüphanesi eklendi (hesap değişikliği yok)

- **Altın kayıt parmak izi:** değişmedi (kayıt yenilenmedi).
- **Değişiklik:** yalnız veri ve doğrulama katmanı eklendi: `www/js/pipes-data.js`, `www/js/pipes.js`; `www/js/catalog.js` içinde isteğe bağlı `borular.kutuphane` bölümünün doğrulaması. Kütüphane hesap motoru, otomatik boru seçimi, ekranlar ve raporlar tarafından **kullanılmıyor**; `index.html` modülü yüklemiyor (test P1-10).
- **Değişmeyenler:** `engine.js`, `catalog-data.js` (otomatik seçim listesi), `layout.js`, `hydraulics.js`, `assess.js`, `mergeCatalog` davranışı. Eski katalog ile yeni tablo arasındaki farklar `docs/pn-1-karsilastirma.md`'de raporlandı; hiçbiri düzeltilmedi.
- **Formül, katsayı, eşik veya seçim kuralı değişmedi.**
- **Doğrulama:** `test/dogrulama.test.js` (EPANET ve bağımsız bağıntılar), `test/golden.test.js` ve `tools/audit.js` (38/38) aynı sonuçla geçiyor.

## 2026-11-19 — MH-AUTO-1: Akıllı Otomatik Tasarım veri modeli ve saf kurallar (hesap değişikliği yok)

- **Altın kayıt parmak izi:** değişmedi.
- **Değişiklik:** yeni bağımsız modül `www/js/auto.js` ve `test/auto.test.js`. Modül motoru çağırmaz, motor sonucunu ve projeleri değiştirmez; `index.html` yüklemez (test A1-14).
- **Formül, katsayı, eşik veya seçim kuralı değişmedi.** `engine.js`, `layout.js`, `catalog.js`, `assess.js`, `app.js` bu PR'da değiştirilmedi.
- **Doğrulama:** `test/dogrulama.test.js`, `test/golden.test.js` ve `tools/audit.js` (38/38) aynı sonuçla geçiyor.

## 2026-11-19 — PN-3a: Kullanıcının seçtiği ana hat borusu hesap motoruna aktarıldı (seçimsiz projelerde sonuç değişikliği yok)

- **Altın kayıt parmak izi:** değişmedi. 19 senaryonun hepsi bit bit aynı (test P3-01 ayrıca `boruSecimi: { ana: null }` ve alan yokken eşitliği denetler).
- **Değişiklik (`www/js/engine.js`, `www/js/validate.js`):**
  - Yeni isteğe bağlı girdi `inp.boruSecimi = { ana: { malzeme, od, sdr } }`. Yalnız PN-1 kütüphanesinin **etkin, doğrulanmış** satırları kabul edilir (`IrriPipes.bul`); aksi hâlde hesap yapılmaz ve gerekçe yazılır. Yapısal olarak hatalı seçim alan hatası verir.
  - Seçim varsa ana hat bu boruyla, **tüm uzunlukta tek çap** olarak hesaplanır: iç çap = dış çap − 2 × en küçük et; hız, Hazen-Williams kaybı (C = 150, %10 yerel kayıp payı), shift basınçları, pompa seçimi ve enerji, malzeme listesi ve su darbesi ön değerlendirmesi (PE için E = 1 GPa) aynı `design()` akışında yeniden hesaplanır.
  - Seçim reddedilmez; hız (> 2,0 m/s) veya PN yetersizliği (1,25 × işletme veya kapama basıncı > PN × 10,2) varsa sonuç hesaplanır ve "Bu seçim uygunsuz" uyarısı yazılır.
  - Otomatik seçimin kod yolu yeniden düzenlendi (aynı ifadeler bir işleve taşındı); sayısal sonuç değişmedi.
  - Kütüphane borusunun fiyat anahtarı `kutuphane:<malzeme>:<od>:<sdr>`; eski `pvc:<od>:<pn>` anahtarları aynen.
- **Formül, katsayı, eşik değişmedi.** Seçim yokken otomatik çap/PN seçim kuralı aynı.
- **Doğrulama:** `test/pn3a.test.js` P3-01…P3-07 — bağımsız hız ve Hazen-Williams hesabı, seçilen boruyla ana hat ağının **EPANET 2.3** (Hazen-Williams) çözümü (4 durum, bütün shift'ler, ≤ max(0,10 m; %0,2)). `test/dogrulama.test.js`, `test/golden.test.js`, `tools/audit.js` (38/38), arayüz (226 + 54), web (110) ve masaüstü (132) takımları aynı sonuçla geçiyor. Kasıtlı hata denemeleri (iç çap yerine dış çap, kademenin kapatılmaması, doğrulanmamış satırın kabulü) testlerce yakalandı.
- **Bilinen sınırlar:** manifold boru seçimi ve arayüz PN-3b'de; `index.html` kütüphaneyi henüz yüklemiyor (tarayıcıda seçim yapılamaz; seçim içeren bir yedek açılırsa "Boru kütüphanesi yüklü değil" gerekçesiyle hesap yapılmaz). Ekran ve rapor etiketlerinin malzemeye göre güncellenmesi PN-3b/PN-4'te.


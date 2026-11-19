# PN-1 — Boru veri modeli ve standart tabanlı katalog: uygulama planı

Durum: **uygulama planı onaylandı; PN-1 kodlaması başlatıldı (19.11.2026).** Ana plan:
`docs/mh-pn-plan.md` (D-1…D-13). Ayrı dal, ayrı kod PR'ı; onaysız birleştirilmez.

## 1. Kapsam

PN-1 **yalnız veri ve doğrulama** katmanıdır:
- üreticiden bağımsız, standart tabanlı boru kütüphanesi (PVC-U, PE80, PE100);
- kombinasyon kuralları (çap–SDR–PN), iç çap hesabı, sıcaklık katsayısı tablosu;
- üretici kataloglarının sonradan eklenebileceği genişletilebilir şema ve doğrulayıcı.

PN-1'de **hiçbir hesap sonucu değişmez**: motor, otomatik seçim, ekranlar ve raporlar bu
kütüphaneyi henüz kullanmaz. Kullanım PN-2 (PFA/PMA, değerlendirme) ve PN-3 (elle seçim) ile başlar.

## 2. Değişecek dosyalar

| Dosya | Değişiklik |
|---|---|
| `www/js/pipes.js` (yeni) | Saf modül `IrriPipes`: veri tabloları + işlevler (§3, §4). DOM'a ve motora dokunmaz; Node'da ve tarayıcıda aynı |
| `www/js/pipes-data.js` (yeni) | Standart boyut tabloları ve sıcaklık katsayıları; **her satırda kaynak alanı** (§5) |
| `www/js/catalog.js` | `checkCatalog`'a **isteğe bağlı** `borular.kutuphane` bölümü doğrulaması (yeni alan). Mevcut `pe`, `pvc`, `lateral` doğrulaması ve `mergeCatalog` davranışı **aynen** |
| `test/pipes.test.js` (yeni) | P-01 ve §6'daki testler (`test/run.js` `*.test.js` dosyalarını kendiliğinden bulur; değişmez) |
| `docs/pn-kaynaklar.md` (yeni) | Her tablo için kaynak, sürüm, erişim tarihi, karşılaştırma notları |
| `docs/hesap-degisiklik-kaydi.md` | "PN-1: hesap değişikliği yok" kaydı (MH-0 kuralı gereği) |

Değişmeyenler: `engine.js`, `catalog-data.js` (otomatik seçim listesi), `layout.js`,
`hydraulics.js`, `assess.js`, `app.js`, `desk.js`, `report*.js`, `index.html` (modül henüz
yüklenmez; PN-2'de eklenir), altın kayıtlar.

## 3. Veri modeli

```js
// pipes-data.js — standart tablo satırı (üreticiden bağımsız)
{ malzeme: 'PE100', standart: 'EN 12201-2', standartSurum: '…', od: 110, sdr: 17,
  enMin: 6.6,            // en küçük et kalınlığı (mm), standart tablosundan
  pn: 10,                // tablonun verdiği PN (C katsayısıyla birlikte)
  cTasarim: 1.25, mrs: 10,
  kaynak: 'pn-kaynaklar.md#pe100-sdr17', standartSurum: 'EN ISO 1452-2:2009', dogrulamaTarihi: '2026-11-19',
  dogrulama: 'iki-uretici-katalogu' | 'standart-metni' }   // çelişen/belirsiz satır dosyaya girmez

// Sıcaklık katsayısı tablosu
{ malzeme: 'PE100', standart: '…', noktalar: [[20, 1.0], [30, …], [40, …]], aralik: [0, 40],
  kaynak: '…', dogrulama: '…' }

// Üretici kaydı (ileride; aynı şema + üretici alanları, standart satırına bağlanır)
{ ...standartSatırı, uretici: 'Firma', katalogKodu: '…', katalogSurum: '…',
  enOrtalama: null, pnBilesen: null, hwC: null, eKisa: null }
```

- **İç çap:** `ic = od − 2·enMin` (nominal dış çap, en küçük et). Bugünkü katalog da `od − 2·et`
  kullanıyor; tutarlı. Bu iç çap, gerçek borudan biraz **büyüktür** (et toleransı nedeniyle):
  sürtünme kaybı biraz düşük, dalga hızı biraz düşük çıkar. Etki ekranda ve raporda "en küçük et
  kalınlığıyla hesaplandı" notuyla yazılır. Ortalama et (standart tolerans tablosundan) ile hesap
  ayrı karar ve hesap değişikliği kaydı ister.
- **Kombinasyon kuralı:** yalnız tabloda bulunan (malzeme, od, SDR) satırları geçerlidir.
  `pn` tablodan okunur; `20·MRS/(C·(SDR−1))` formülü yalnız **çapraz denetim** için kullanılır
  (tutarsızlık → test hatası, satır eklenmez).
- **Hat türü uygunluğu:** `hatTurleri` (ana, dagitim, manifold). Lateral ve damla bantları bu
  kütüphanede yoktur (`maxH` ile ayrı).
- **Doğrulama düzeyi:** yalnız `'iki-uretici-katalogu'` veya `'standart-metni'` satırlar etkin
  kütüphanededir. Çelişen veya kaynağı belirsiz satırlar etkin kütüphaneye **girmez**; yalnız
  karşılaştırma raporunda listelenir (D-4). `'standart-metni'` düzeyi yalnız standardın tam metniyle
  doğrudan karşılaştırılmış satırlarda kullanılır; iki katalog birbirini doğrulasa bile bu düzey
  **yazılmaz**.

## 4. İşlevler (`IrriPipes`)

| İşlev | Açıklama |
|---|---|
| `liste({malzeme, hatTuru, od})` | Geçerli kombinasyonlar (doğrulanmış) |
| `bul(malzeme, od, sdr)` | Tek satır veya `null` |
| `icCap(satir)` | `od − 2·enMin`, mm, bir ondalık |
| `pnDenetim(satir)` | Formülle çapraz denetim sonucu |
| `sicaklikKatsayisi(malzeme, T)` | Doğrusal ara değer; aralık dışı → `null` + "veri yok" (uydurma yok) |
| `esdeger(eskiKayit)` | Bugünkü katalog kaydının (`pe-110-pn10`, `pvc-110-pn6` …) standart tablosundaki karşılığı ve farkı (§7) |
| `dogrula(katalog)` | Üretici kataloğu içe aktarmada şema ve standartla tutarlılık |

## 5. Kaynak ve doğrulama yöntemi (D-4, D-9 kararı)

Standart metinleri (EN ISO 1452-2, ISO 4427-2, EN 12201-2) ücretli belgelerdir ve bu çalışma
ortamından erişilemiyor. Bu yüzden:

1. **Standart metni** (ileride, proje sahibinin erişimiyle) → `'standart-metni'`.
2. **Proje sahibi kararı (19.11.2026):** tam metne erişilemediği sürece her satır, **en az iki
   bağımsız üreticinin standart atıflı teknik kataloğuyla** karşılaştırılır; ISO ve EN
   standartlarının **resmî kayıtları** (iso.org, CEN/ulusal kurum katalog sayfaları) standart adı,
   sürümü ve yürürlük durumu için kullanılır. İki katalog aynı değeri veriyorsa
   `'iki-uretici-katalogu'`; farklıysa veya kaynak belirsizse satır **etkin kütüphaneye eklenmez**
   ve `pn-kaynaklar.md`'de "çelişki / belirsiz" olarak listelenir.
3. Her satırda: kaynak, standart sürümü, doğrulama tarihi, doğrulama düzeyi. Her kaynak için:
   belge adı, yayımcı, sürüm/tarih, tablo no, erişim tarihi.
4. Sıcaklık katsayıları da aynı kurala tabidir; doğrulanamazsa tablo eklenmez ve PN-2'de
   "Sıcaklık katsayısı doğrulanmadı — 20 °C değeri kullanıldı" uyarısı gösterilir.
5. Ekranda (PN-3/PN-4) doğrulama düzeyi görünür: "standart metniyle doğrudan doğrulandı" /
   "iki bağımsız üretici kataloğuyla karşılaştırıldı — standart metniyle doğrudan doğrulanmadı".
6. Sıcaklık katsayıları PE ve PVC-U için **ayrı kaynaklardan**; PE için ISO 4427-1:2019 Ek A
   incelenir. Doğrulanamayan katsayı eklenmez, "veri eksik" bildirilir.
7. Eski katalog ile yeni tablo arasındaki bütün farklar ayrı karşılaştırma raporunda
   (`docs/pn-1-karsilastirma.md`); hiçbiri izinsiz düzeltilmez.

İlk kapsam (doğrulandıkça eklenir): PVC-U Ø63–315 (PN6–PN16), PE100 Ø32–315 (PN6–PN16; SDR26,
21, 17, 13,6, 11), PE80 Ø32–160 (PN6–PN12,5). PN4 ve PN20 yalnız tabloda bulunursa.

## 6. Testler (`test/pipes.test.js`)

| Kod | Test |
|---|---|
| P1-01 | Her satır: `ic > 0`, `enMin > 0`, `od/enMin ≈ SDR` (tablo yuvarlaması içinde) |
| P1-02 | Formül çapraz denetimi: tablo PN'i `20·MRS/(C·(SDR−1))` ile tutarlı (PE: C = 1,25; PVC-U: satırdaki C) |
| P1-03 | Geçersiz kombinasyon (`bul('PE80', 110, 41)`) → `null`; `liste()` doğrulanmamış satır döndürmez |
| P1-04 | Her satırın `kaynak` alanı `pn-kaynaklar.md` içinde var |
| P1-05 | Sıcaklık katsayısı: 20 °C → 1,0; aralık dışı → `null` |
| P1-06 | `esdeger()`: bugünkü 33 PE ve 33 PVC katalog kaydının standart karşılığı ve farkı raporlanır (§7); test yalnız raporlar, kataloğu değiştirmez |
| P1-07 | `checkCatalog`: eski katalog JSON'ları (bugünkü varsayılan + `app.js` örneği) aynı sonucu verir; yeni `kutuphane` bölümü hatalı alanları yakalar |
| P1-08 | **Uyumluluk:** MH-0 altın kayıtları, 38 denetim (`tools/audit.js`), EPANET karşılaştırması ve bütün takımlar değişmez |

## 7. Mevcut hesaplarla uyumluluk

- Motor yeni modülü çağırmaz → **bütün sonuçlar bit bit aynı** (P1-08).
- Bugünkü `catalog-data.js` değişmez. `esdeger()` raporu, bugünkü katalog kayıtları ile standart
  tablosu arasındaki farkı (ör. PVC-U Ø110 PN6 et 3,2 mm, `mh-pn-plan.md` §1.1) belgeler.
  Fark bulunursa katalog **PN-1'de düzeltilmez**: ayrı karar, hesap değişikliği kaydı ve altın
  kayıt güncellemesi gerektirir.
- Kullanıcı katalog içe aktarımı (`borular.pe/pvc`) bugünkü gibi otomatik seçime girer; yeni
  `kutuphane` bölümü yalnız elle seçim içindir (D-3).

## 8. Bağımlılık ve sıra

- PN-0 (`docs/mh-pn-plan.md`) main'de olmalı.
- MH-2A, MH-3, PR #8 ve MH-MANUEL-1A'ya bağımlılık **yok**; yeni dosyalar olduğu için MH-KML ile
  paralel yürüyebilir.
- Sonraki: PN-2 (PR #8'den sonra) bu modülün `sicaklikKatsayisi` ve satır verisini kullanır.

## 9. Proje sahibinden gereken

- Mümkünse EN ISO 1452-2, ISO 4427-2 / EN 12201-2 tablolarına erişim (en güçlü doğrulama düzeyi).
- Erişim yoksa "iki bağımsız kamuya açık kaynak" yönteminin onayı.

# PN-1 — Boru kütüphanesi kaynakları ve doğrulama kaydı

Doğrulama tarihi: **19.11.2026**. Veri: `www/js/pipes-data.js`; işlevler: `www/js/pipes.js`;
eski katalog karşılaştırması: `docs/pn-1-karsilastirma.md`.

## 1. Doğrulama kuralı (proje sahibi kararı, 19.11.2026)

- Standart metinleri (EN ISO 1452-2, ISO 4427-2, EN 12201-2) ücretlidir; tam metne erişilemedi.
- Bir satır **etkin kütüphaneye** ancak **en az iki bağımsız üreticinin** standart atıflı teknik
  kataloğunda **aynı değerle** bulunuyorsa girer: düzey `iki-uretici-katalogu`.
- İki katalog birbirini doğrulasa bile **"standart metniyle doğrudan doğrulandı" yazılmaz**
  (`standart-metni` düzeyi hiçbir satırda yok).
- Çelişen, tek kaynaklı veya kaynağı belirsiz satırlar etkin kütüphaneye **girmez**; yalnız
  `ADAYLAR` listesinde ve karşılaştırma raporunda görünür.
- SDR → PN eşleşmesi de ayrıca iki kaynakla doğrulanır (`pnKaynak`). `20·MRS/(C·(SDR−1))` formülü
  yalnız çapraz denetimdir (test P1-02).

## 2. Kullanılan kaynaklar

| Kimlik | Yayımcı | Belge | Kullanılan tablo | Atıf yapılan standart | Belge tarihi | Erişim |
|---|---|---|---|---|---|---|
| `pl-ll` | Pipelife Norge AS | Marine Piping Solutions — Long Length Large Diameter PE Pipes, Product Technical Guide | Enclosure 1: Pipe production range (en küçük et, "EN 12201-2'ye göre"); Table 3 Pressure ratings (PE100: SDR17 = PN10, SDR11 = PN16; MRS 10, C 1,25); Table 4 sıcaklık katsayıları | EN 12201-2:2024; ISO 4427-2; Table 4: EN 12201-1:2024 ve ISO 13761:1996 | PDF 04.09.2026 | 19.11.2026 |
| `upo-pe100` | Uponor Infra Oy | PE100 pressure pipes — Technical factsheet | Table: Wall thickness PE100 (SDR17 PN10, SDR11 PN16; Ø32–1200) | EN 12201, EN 1555 (sürüm belirtilmemiş) | 09/2020 | 19.11.2026 |
| `upo-pe80` | Uponor Infra Oy | PE80 (PEM) pressure pipes — Technical factsheet | Table: Wall thickness PE80 (Ø20–63; "SDR11 = PN12,5") | EN 12201 (sürüm belirtilmemiş) | 09/2020 | 19.11.2026 |
| `ali-pe100` | Aliaxis UK (GPS) | GPS PE Black pipe (PE100) — Product data sheet | Range / pressure rating: SDR11 16 bar (Ø75–710), SDR17 10 bar (Ø75–1200), SDR21 8 bar, SDR26 6 bar, SDR33 5 bar (Ø160–1200). **Boyut tablosu yok** | BS EN 12201-2 (BSI Kitemark KM 508224; sürüm belirtilmemiş) | PDF 02.03.2023 | 19.11.2026 |
| `ali-pe80` | Aliaxis UK (GPS) | GPS PE Black pipe (PE80) — Product data sheet | Pipe dimensions — water applications (BS EN 12201-2), SDR 11, Min t (Ø25–63); SDR11 = 12,5 bar | BS EN 12201-2 (sürüm belirtilmemiş) | PDF 21.10.2020 | 19.11.2026 |

Bağlantılar `www/js/pipes-data.js` → `KAYNAKLAR` içinde. Belgeler depoya eklenmedi (üretici
telifi); her biri yayımcının sitesinden indirilebilir.

Bilgi notu (uygulanmadı): `ali-pe80` belgesi, BS EN 12201-2'ye göre üretilen GPS borularının
"anma basıncının iki katına kadar geçici darbe basınçlarına dayanabildiğini" belirtiyor. Bu, tek
üreticinin kendi ürünü için beyanıdır; `kGecici` için doğrulanmış genel tolerans sayılmaz
(`docs/mh-pn-plan.md` D-6). İleride o üreticinin kataloğu yüklenirse yalnız o ürüne uygulanabilir.

## 3. Standart sürümleri ve resmî kayıtlar

| Standart | Bilinen sürüm | Kaynak | Not |
|---|---|---|---|
| EN 12201-2 (PE boru boyutları) | EN 12201-2:2024 | `pl-ll` atfı; DIN listelemesinde DIN EN 12201-2:2025-03 | Uponor ve Aliaxis sürüm belirtmiyor; boyut değerleri sürümler arasında aynı çıktı (Ø32–315, SDR17/11) |
| EN 12201-1 (PE genel; Ek A sıcaklık) | EN 12201-1:2024 (31.01.2024'te yayımlandı; 2011 baskısı geri çekildi) | `pl-ll` atfı; ulusal standart listelemeleri | Ek A tam metni okunamadı |
| ISO 4427-2 (PE boru) | ISO 4427-2:2019 (+ Amd 1:2023 listeleniyor) | ISO listelemeleri | Bu çalışmada iso.org sayfası **HTTP 403** ile okunamadı |
| ISO 4427-1 (PE genel; Ek A sıcaklık) | ISO 4427-1:2019 | ISO listelemeleri (iso.org/standard/72183) | **Ek A metni okunamadı**; referans sıcaklığın 20 °C olduğu ve diğer sıcaklıklar için Ek A'ya yönlendirildiği listeleme özetlerinden |
| EN ISO 1452-2 (PVC-U boru) | EN ISO 1452-2:2009 (revizyon taslağı 2026'da başlatılmış) | Ulusal standart listelemeleri | Ek A, Şekil A.1: 25–45 °C sıcaklık katsayısı (değerler okunamadı) |

ISO ve EN resmî kayıt sayfalarına (iso.org) bu ortamdan erişilemedi (HTTP 403). Sürüm bilgisi
kataloglardaki atıflardan ve ulusal standart kuruluşlarının listeleme sayfalarından alınmıştır;
**resmî kayıttan doğrudan teyit edilmemiştir.**

## 4. Etkin kütüphane (35 satır)

| Malzeme | SDR | PN | Ø (mm) | Boyut kaynakları | PN kaynakları |
|---|---|---|---|---|---|
| PE100 | 17 | 10 | 32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 180, 200, 225, 250, 280, 315 | `pl-ll`, `upo-pe100` | `pl-ll`, `upo-pe100` (+ `ali-pe100` Ø75 ve üstü) |
| PE100 | 11 | 16 | aynı 16 çap | `pl-ll`, `upo-pe100` | `pl-ll`, `upo-pe100` (+ `ali-pe100` Ø75 ve üstü) |
| PE80 | 11 | 12,5 | 40, 50, 63 | `upo-pe80`, `ali-pe80`, `pl-ll` | `upo-pe80`, `ali-pe80` |

32 PE100 satırının hepsinde `pl-ll` ile `upo-pe100` değerleri birebir aynı.

## 5. Etkin kütüphaneye alınmayanlar (46 aday)

| Grup | Satır | Neden |
|---|---|---|
| PE100 SDR26 (PN6), SDR21 (PN8), SDR13,6 (PN12,5) — Ø32–315 | 45 | Boyut tablosu yalnız `pl-ll`'de (tek kaynak). PN eşleşmesi SDR26 ve SDR21 için `pl-ll` + `ali-pe100` ile iki kaynaklı, SDR13,6 için yalnız `pl-ll`; boyut doğrulanmadı |
| PE80 Ø32 SDR11 | 1 | **Çelişki:** `upo-pe80` 2,9 mm; `ali-pe80` ve `pl-ll` 3,0 mm |

## 6. Veri eksikleri

| Konu | Durum | Gereken |
|---|---|---|
| **PVC-U** (EN ISO 1452-2) | **Etkin satır yok.** İki bağımsız üretici kataloğuna erişilemedi: aday kaynakların (GF, FIP, Durapipe, Eupen) indirilmesi bu oturumda izin denetimine takıldı | İki bağımsız üretici kataloğu (ör. proje sahibinin sağlayacağı PDF'ler) veya standart metni |
| PE100 SDR26/21/13,6 | Tek kaynak | İkinci bağımsız üreticinin boyut tablosu |
| PE80 SDR13,6/17/21 ve Ø75 üstü SDR11 | PE80 belgeleri yalnız Ø63'e kadar SDR11 içeriyor | PE80 için iki bağımsız boyut tablosu |
| **Sıcaklık katsayıları** — PE100 | Tek kaynak (`pl-ll` Table 4, EN 12201-1:2024 atıflı: 20 °C 1,00; 25 °C 0,92; 30 °C 0,85; 35 °C 0,79; 40 °C 0,73; 45 °C 0,67; 50 °C 0,62). İkinci bağımsız kaynak (PE100+ Derneği sayfası) bu ortamdan okunamadı; ISO 4427-1:2019 Ek A metni okunamadı | İkinci kaynak veya standart metni. O zamana kadar `sicaklikKatsayisi()` **null** döner ("veri eksik") |
| Sıcaklık katsayıları — PE80, PVC-U | Kaynak yok | PE için ISO 4427-1/EN 12201-1 Ek A; PVC-U için EN ISO 1452-2 Ek A (Şekil A.1) |

## 7. PE80 Ø32 SDR11 çelişkisinin incelenmesi (19.11.2026)

| Kaynak | Değer | Ölçü tanımı (belgede yazan) |
|---|---|---|
| `upo-pe80` (Uponor veri sayfası, 09/2020) | **2,9 mm** | "Wall thickness" — en küçük mü, anma mı belirtilmemiş |
| `ali-pe80` (Aliaxis) | **3,0 mm** (en büyük 3,4 mm) | "Min t" — en küçük et; BS EN 12201-2 |
| `pl-ll` (Pipelife) | **3,0 mm** | "Minimum wall thickness … in accordance with EN 12201-2" |

Değerlendirme:
- EN 12201-2'de anma et kalınlığı en küçük et kalınlığına eşittir (e_n = e_min). Bu yüzden fark
  **"anma / en küçük" tanım farkıyla açıklanamaz**.
- 32 / 11 = 2,91 mm. Uponor değeri, SDR tanımından yuvarlamasız hesaplanmış değere (2,9) karşılık
  geliyor. Standart tablosu ise 3,0 mm veriyor. Bu bir **yuvarlama ya da veri sayfası hatası**
  olabilir. Aynı veri sayfasının diğer PE80 satırları (Ø25, 40, 50, 63) standartla uyumlu.
- Arama sonuçlarında Uponor'un kendi ürün sayfalarının bu boruyu **"32X3 … SDR11 PE80"** olarak
  listelediği görüldü. Bu sayfalar bu çalışmada açılıp okunmadı.
- Farklı ürün serisi olasılığı: Uponor'un PE80 (PEM) ürünleri Kuzey Avrupa onaylı (DK-VAND, FI,
  NPM). Aynı aramada bazı Kuzey Avrupa ürünlerinin SDR11 PE80'i **PN10** olarak sattığı görüldü
  (C = 1,6). Bu, PN eşleşmesinin tasarım katsayısına bağlı olduğunu gösterir; et kalınlığı farkını
  açıklamaz.
- **Sonuç: çelişki çözülmedi.** Satır etkinleştirilmedi. Çözüm için gereken: Uponor'un güncel PE80
  veri sayfası veya ürün belgesi (32 × 3,0 olduğunu yazılı gösteren) ya da standart tablosu.

## 8. PE100 sıcaklık katsayıları: 0,85 / 0,73 ile 0,87 / 0,74 karşılaştırması

| Değer kümesi | 30 °C | 40 °C | Kaynak | Durum |
|---|---|---|---|---|
| A | 0,85 | 0,73 | `pl-ll` Table 4, "EN 12201-1:2024 ve ISO 13761:1996"; 20–50 °C, 5 °C adım | Okundu, **tek kaynak** |
| B | 0,87 | 0,74 | Sıkça EN 12201-1:2011 / ISO 4427-1 Ek A'ya atfedilir | **Hiçbir belgede okunamadı** (önceki rapordaki "yaygın değer" ifadesi doğrulanmamış bir bilgiydi) |

Karşılaştırma ölçütleri:
- **Malzeme:** A, PE100 (PE100-RC ve HT dahil) için. B'nin malzeme kapsamı (PE80/PE100) doğrulanamadı.
- **Standart baskısı:** EN 12201-1:2011, 31.01.2024'te geri çekildi; 2024 baskısının Ek A'sı
  50 °C'ye kadar genişletildi (listeleme özetlerinden). A ile B'nin farkı bu baskı değişikliğinden
  kaynaklanıyor olabilir. **Doğrulanmadı.**
- **Referans ve tasarım koşulu:** A: 20 °C referansı, sabit işletme sıcaklığı, uzun süre (50 yıl).
  B'nin koşulları okunamadı.
- **Sonuç:** Katsayı üretilmiyor (`sicaklikKatsayisi()` → `null`). Belirsizlik `sicaklikDurumu()`
  ile kullanıcıya gösterilecek: "Sıcaklık katsayısı doğrulanmadı" ve iki değer kümesi (PN-2 ekranı).
- Çözüm için gereken: EN 12201-1:2024 Ek A veya ISO 4427-1:2019 Ek A metni ya da ikinci bağımsız
  üretici tablosu.

## 9. PVC-U için gereken belgeler ve doğrulama planı

### 9.1 Proje sahibinin temin edip yükleyebileceği belgeler (öncelik sırasıyla)

| No | Belge | Yayımcı | Nerede | Not |
|---|---|---|---|---|
| V-1 | **EN ISO 1452-2:2009** (veya TS EN ISO 1452-2) tam metni | CEN / TSE / ISO | TSE e-mağaza, ISO, DIN Media, BSI | Tek başına en güçlü doğrulama (`standart-metni` düzeyi). Tablo 1–2 (boyutlar), Ek A Şekil A.1 (25–45 °C katsayıları) |
| V-2 | ISO 1452-2:2009 resmî önizlemesi | SIS (İsveç Standart Enstitüsü) | `https://www.sis.se/api/document/preview/911827/` | Resmî önizleme; boyut tablosunu içerip içermediği bilinmiyor |
| V-3 | GF Piping Systems — PVC-U basınçlı boru teknik el kitabı / boru boyut tablosu (EN ISO 1452 atıflı) | Georg Fischer | gfps.com indirme merkezi; üçüncü taraf kopya: `https://steelsoft.rs/wp-content/uploads/2024/11/Katalog-GF.pdf` | Arama özeti: Ø110 için PN6 2,7 / PN8 3,4 / PN10 4,2 / PN12,5 5,3 / PN16 6,6 mm (C = 2,0) — **okunmadı, doğrulanmadı** |
| V-4 | FIP (Aliaxis) — "PVC-U PRESSURE PIPE" ve "PIPE ISO-UNI" katalogları | FIP / Aliaxis | `https://pdf.directindustry.com/pdf/fip-formatura-iniezione-polimeri/pvc-u-pressure-pipe/28091-1002162.html`; Aliaxis Çekya: `https://www.aliaxis.cz/_default_upload_bucket/PVC_U_tvarovky.pdf` | Boru tablosu içeriği doğrulanmadı |
| V-5 | Pipelife — PVC-U basınçlı boru (EN ISO 1452-2) ürün kataloğu | Pipelife | catalog.pipelife.com (ülke sayfası, ör. TR/PL) | PDF indirme bu ortamda 403 verdi |
| V-6 | Wavin — PVC-U basınçlı boru teknik kataloğu (EN ISO 1452-2) | Wavin | wavin.com | Erişilmedi |
| V-7 | Durapipe (Aliaxis) — PVC-U şartnamesi | Durapipe | `https://cdn.shopify.com/s/files/1/0816/2541/6009/files/Durapipe-PVC-U-Specification.pdf` | BS (inç) ölçüleri içerebilir; FIP ile aynı grup (Aliaxis) — **FIP ile birlikte bağımsız iki kaynak sayılmaz** |
| V-8 | Türk üreticilerin TS EN ISO 1452-2 atıflı katalogları (ör. Fırat, Pilsa, Kalde, Egeplast) | Üreticiler | Üretici siteleri | Yerel pazarda kullanılan ürünler; iki farklı üretici seçilmeli |

Bağımsızlık kuralı: FIP ve Durapipe aynı gruptandır (Aliaxis). En az iki **farklı grup**
gerekir; ör. GF + Pipelife, GF + FIP, Pipelife + bir Türk üretici.

### 9.2 Doğrulama planı (belgeler gelince)

1. Her belgeden PVC-U boyut tablosu satır satır okunur: dış çap, her PN/SDR sütunu için en küçük
   (anma) et, tasarım katsayısı C (2,0 veya 2,5) ve hangi çap aralığına uygulandığı.
2. **C katsayısı ayrı alan olarak tutulur.** C = 2,0 ve C = 2,5 tabloları aynı satırda
   karıştırılmaz; aynı (Ø, PN) için iki farklı et kalınlığı olabilir (`docs/mh-pn-plan.md` §1.1).
3. İki farklı gruptan üretici aynı (Ø, SDR, C) için aynı eti ve aynı PN'i veriyorsa satır
   `iki-uretici-katalogu` düzeyiyle etkinleşir. Aksi hâlde aday listesinde kalır.
4. Eski katalogdaki 33 PVC-U kaydı (`catalog-data.js`) yeni tabloyla karşılaştırılır. Farklar
   `docs/pn-1-karsilastirma.md`'de raporlanır; **otomatik seçim ve eski kayıtlar değişmez.**
5. PVC-U sıcaklık katsayıları (EN ISO 1452-2 Ek A, 25–45 °C) PE'den ayrı kaynaktan doğrulanır;
   doğrulanamazsa "veri eksik".
6. Testler: P1-01…P1-14'ün PVC-U karşılıkları, C katsayısına göre PN çapraz denetimi
   (`PN = 20·σs/(SDR−1)`, σs = MRS/C, MRS = 25 MPa), sınır çaplar.

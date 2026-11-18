# Teknik inceleme listesi

Geliştirme sırasında bulunan, **hemen düzeltilmeyen** ama izlenmesi gereken teknik konular. Burada
listelenmesi değişiklik yapılacağı anlamına gelmez: hesap motorunu veya altın kayıtları etkileyen
her madde ayrı plan, bağımsız doğrulama, `docs/hesap-degisiklik-kaydi.md` kaydı ve proje sahibinin
onayıyla ele alınır.

| Kod | Konu | Durum | Etki | Tarih |
|---|---|---|---|---|
| T-01 | Motor ↔ DXF uzunluk farkı (küresel yerel düzlem / WGS84 UTM) | Açık — inceleme | Çizilmiş parsellerde uzunluk ve alanda yöne bağlı ±%0,2 | 18.11.2026 |
| T-02 | `Ns` isteği uygulanamayınca motor uyarısının gerekçesi yanıltıcı | Açık — MH-MOTOR-1 (M-0) | Yalnız metin | 18.11.2026 |
| T-03 | Ana hat alternatifleri tablosundaki enerji ile seçili düzenin enerjisi farklı tanımlı | Açık — açıklama | Rapor okunurken karışıklık | 18.11.2026 |
| T-04 | `inp.Ns` kaynak sınırının altındaysa motor düzeni seçiyor; motor uyarı listesinde kaynak aşımı satırı yok | Açık — MH-MOTOR-1 (M-1) | W-KAP-03 "Uygunsuz" ile yakalanıyor; motor metni eksik | 18.11.2026 |
| T-05 | Yerleşim imzası değişince elle shift ataması sorulmadan siliniyor (`app.js:406`); fırça atamaları doğrudan projeye yazılıyor | Açık — MH-MANUEL-1A | Veri kaybı riski | 18.11.2026 |
| T-06 | Harita shift etiketleri yakınlaştırmaya göre seyrelmiyor, üst üste biniyor; etikette sabit "FIELD 1" metni | Açık — MH-SHIFT-1 | Okunabilirlik | 18.11.2026 |
| T-08 | Open-Meteo/Copernicus kot verisi için zorunlu atıf ekranda ve raporda yok; kot kaynağının düşey referansı (EGM2008) ve DSM olduğu kaydedilmiyor | Açık — MH-2A (veya onayla 1A/MH-KML) | Kullanım şartı; yanlış yorum riski | 18.11.2026 |
| T-07 | Motor parsel içi boşlukları (KML `innerBoundaryIs`) desteklemiyor; tek dış halka | Açık — MH-MOTOR (E-7) | Boşluklu parselde sulanan alan fazla görünür; MH-KML'de açık uyarı ve onaysız alınmaz | 18.11.2026 |

## T-01 — Motor ↔ DXF uzunluk farkı

**Bulgu (WEB-2 indirme doğrulaması, 18.11.2026).** Çizilmiş parsel projesinde DXF'teki ana hat
toplam uzunluğu 988,70 m, motorun ana hat uzunluğu 987,50 m (+%0,12); lateraller 59 555 m'ye karşı
59 666 m (−%0,18). Dikdörtgen projede (test2) fark yok.

**Neden.** `www/js/geom.js` parsel koordinatlarını yerel düzleme **küresel** Dünya ile çevirir
(R = 6 371 008,8 m; doğu-batı için `cos(lat0)` çarpanı). DXF ise aynı noktaları **WGS84 elipsoidi
üzerinde UTM** koordinatlarına çevirir (`www/js/drawing.js`, `utm`). 37° enlemde:

- Meridyen eğrilik yarıçapı M ≈ 6 358 400 m → motor kuzey-güney uzunluklarını ≈ **%0,20 fazla**,
- Birinci düşey eğrilik yarıçapı N ≈ 6 385 800 m → doğu-batı uzunluklarını ≈ **%0,23 eksik** hesaplar,
- UTM ölçek çarpanı (36. dilim, merkez meridyenden 2,3°) ≈ 1,0001.

Doğrulama: motorun yerel ana hat noktaları aynı dönüşümle UTM'ye çevrildiğinde 988,71 m çıkıyor;
DXF'teki 988,70 m ile aynı. **DXF koordinatları doğrudur; fark motorun küresel yaklaşımındandır.**
Alan etkisi iki yönün çarpımıdır (≈ −%0,03). Bu davranış WEB-2'den önce de vardı ve Android'de
aynıdır.

**Etki.** Boru metrajı ve hidrolik kayıplarda yöne bağlı ±%0,2 (1 km'de ±2 m). Malzeme listesindeki
%2–3 fire payının içinde kalır; hidrolik sonuçlara etkisi küçüktür ama sistematiktir.

**Olası çözüm (onay gerekir).** Yerel düzlemi elipsoit yarıçaplarıyla (M ve N·cosφ) kurmak veya
doğrudan UTM'de çalışmak. Bu bir motor değişikliğidir: dikdörtgen projelerin altın kayıtları
değişmez, çizilmiş parsel kayıtları değişir. MH-2 (kot/eğim, GIS) ile birlikte ele alınması
önerilir; ayrı plan, bağımsız doğrulama (ör. bilinen koordinatlı test parseli, GIS yazılımında ölçüm)
ve hesap değişiklik kaydı gerekir.

## T-02 — `Ns` uyarı metni

`inp.Ns` motorun gruplama alternatifleri arasında yoksa motor "N shift uygulanamıyor (alt ünite sayısı
X)" yazar; N ≤ X olduğunda gerekçe yanlıştır. Asıl neden: gruplama alternatifleri arasında N
shift'li düzen yoktur. Plan: `docs/mh-manuel-plan.md` §4.2 ve §5 (M-0). Hesap değişmez, uyarı
metni değişir.

## T-03 — İki farklı "enerji" değeri

Excel "Ana hat alternatifleri" sayfasında Ø160 için yıllık enerji 77 936 kWh; "Shift alternatifleri"
ve Özet'teki seçili düzen için 82 608 kWh (test2). Motor bunu varsayımlarda açıklıyor: ana hat
karşılaştırması genel pompa/motor verimleriyle, seçili düzen ise seçilen pompanın eğrisiyle
hesaplanır. Hesap hatası değildir; raporda iki değerin farklı tanımlı olduğu sütun başlığında veya
notta açıkça yazılmalıdır (rapor metni değişikliği; MH-MANUEL-4 rapor işiyle birlikte ele alınabilir).

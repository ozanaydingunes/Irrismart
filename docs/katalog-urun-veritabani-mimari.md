# Katalog teknik ürün veritabanı — teknik mimari

Durum: mimari ve aşama planı. Bağımsız PR. Mevcut Firma Katalogları (yükleme, depolama, sürüm, yedek) korunur. pdf.js görüntüleyici geliştirmesi durduruldu; aşağıdaki çıkarım için yalnız pdf.js'nin **metin okuma** çekirdeği gerekir (arayüzsüz).

## 1. Veri modeli (IndexedDB 'irrigrow-katalog' sürüm 2: yeni depolar `urunler`, `degerler`)
```
Urun   { id, katalogId, katalogSurumAnahtari, uretici, marka?, aile?, model?, urunKodu?, kategori: 'pompa'|'filtre'|'vana'|'boru'|'baglanti'|'damla'|'diger',
         olusturma, kaynak: 'cikarim'|'elle', inceleme: 'bekliyor'|'kullanici-onayladi'|'reddedildi',
         muhendislik: 'dogrulanmadi'|'dogrulandi'|'reddedildi', dogrulayan?, dogrulamaTarihi?, notlar? }
Deger  { id, urunId, ad: 'dis_cap'|'et_kalinligi'|'ic_cap'|'pn'|'sdr'|'malzeme'|'debi'|'kv'|'cv'|'filtrasyon_mesh'|'filtrasyon_mikron'
         |'kayip_temiz'|'kayip_kirli'|'baglanti'|'basinc_min'|'basinc_max'|'devir'|'cark_capi'|'guc'|...,
         deger: number|string, birim: string, siDeger?: number, siBirim?: string,
         kaynak: { katalogId, sayfa, hamMetin, konum?: [x,y,w,h], yontem: 'metin'|'tablo'|'goruntu-elle'|'elle' },
         inceleme, muhendislik }
Egri   { id, urunId, tur: 'QH'|'verim'|'guc'|'NPSHr'|'kayip', noktalar: [[Q, y], ...] (≥ 4 nokta), birimler, kosul: { devir?, carkCapi? }, kaynak, inceleme, muhendislik }
```
- **Her** değerde katalog, sayfa ve ham metin zorunlu; yoksa kayıt reddedilir.
- Bilinmeyen değer boş kalır; tahmin/aradeğerleme yapılmaz (eğri dışı Q için değer üretilmez).
- Birim dönüşümü SI'ya yapılır; özgün değer ve birim saklanır.
- Katalog güncellenince ürünler eski sürüme bağlı kalır; yeni sürümde yeniden çıkarım ve inceleme gerekir.

## 2. İki ayrı onay
| Durum | Kim | Anlamı | Hesaba girer mi? |
|---|---|---|---|
| `inceleme: kullanici-onayladi` | Kullanıcı | "Okunan değer PDF'teki değerle aynı" | **Hayır** |
| `muhendislik: dogrulandi` | Mühendislik doğrulaması (kurallar + doğrulayan adı/tarihi) | Birim, aralık, tutarlılık denetimleri geçti; değerler tutarlı (ör. SDR = OD / e, iç çap = OD − 2e) | Evet (yalnız ekipman seçiminde) |
Mühendislik doğrulaması otomatik tutarlılık kurallarını çalıştırır ve sonucu kaydeder; kural geçmezse "doğrulandı" yapılamaz.

## 3. Çıkarım mimarisi (eklenti biçiminde)
```
PDF (cihazdaki dosya) → sayfa sayfa
  ├─ Metin katmanı var mı? (pdf.js getTextContent; karakter sayısı/sayfa)
  │    ├─ evet → Tablo yeniden kurma (x/y kümeleme → satır/sütun) → Ayrıştırıcılar
  │    └─ hayır (görsel ağırlıklı) → "Görsel sayfa": otomatik okuma YOK; kullanıcı sayfa görüntüsü üzerinde
  │         değerleri elle girer (yontem: goruntu-elle), kaynak sayfa ve konum kaydedilir
  └─ Ayrıştırıcılar: { ad, surum, kategori, eslesir(firma, sayfaMetni), ayristir(tablo) → aday Urun/Deger/Egri }
       genel: boru tabloları (OD, e, PN, SDR), vana (DN, PN, Kv), filtre (debi, mesh, kayıp tablosu)
       firmaya özel: kullanıcı kataloglarına göre eklenir; her ayrıştırıcı sentetik PDF'lerle test edilir
```
- OCR şimdilik yok: cihazda güvenilir ve çevrimdışı OCR, sayfa başına yüksek bellek/süre ister; yanlış okunan sayı mühendislik riski taşır. Görsel sayfalar için **elle giriş + sayfa kaynağı** desteklenir; OCR ileride ayrı ve isteğe bağlı bir eklenti olarak değerlendirilebilir (çıktısı yine "bekliyor" durumunda).
- Pompa eğrileri görsel olduğundan eğri noktaları elle girilir (grafik üzerinde nokta işaretleme ileride); en az 4 nokta, Q artan sırada, kaynak sayfa zorunlu.
- Çıkarım arka planda, sayfa sayfa, iptal edilebilir; büyük PDF belleğe bütün alınmaz.

## 4. Ekranlar
Katalog → "Ürünler" sekmesi: çıkarım başlat, aday ürün listesi (sayfa no, ham metin), satır satır inceleme (onayla/düzelt/reddet), mühendislik doğrulaması (kural sonuçları), elle ürün/değer/eğri girişi.

## 5. Testler
Sentetik metin tabanlı PDF'ler (CI'da üretilir) ile ayrıştırıcı testleri; görsel sayfa algılama; birim dönüşümü; tutarlılık kuralları; "kaynaksız değer reddedilir"; motor ve altın kayıtlar değişmez.

## 6. Aşamalar
1. Veri modeli + IndexedDB sürüm 2 geçişi (mevcut katalog kayıtları korunur) + elle ürün/değer/eğri girişi + inceleme/doğrulama durumları.
2. pdf.js metin çekirdeği (arayüzsüz, çevrimdışı) + metin/görsel sayfa ayrımı + tablo yeniden kurma.
3. Genel ayrıştırıcılar (boru, vana, filtre) + inceleme ekranı.
4. Mühendislik doğrulama kuralları.

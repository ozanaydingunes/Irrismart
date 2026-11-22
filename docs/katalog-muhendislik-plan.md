# Katalog bazlı mühendislik malzeme seçimi — mimari ve aşamalı plan (taslak, onay bekliyor)

Kod yok. Firma Katalogları aşama 1 (depolama, kayıt, PDF yükleme/yeniden açma) tamamlandıktan sonra ayrı PR'larla geliştirilir. Hesap motoru (`engine.js`), altın kayıtlar ve 38 hidrolik denetim değiştirilmez.

## 1. Katmanlar
```
PDF (cihazda) ─► [Çıkarım]        katalog-cikarim.js   pdf.js metni → aday satırlar (durum: okundu)
               ─► [Doğrulama]     katalog-dogrulama.js kullanıcı/mühendis satır satır onayı, birim ve kaynak denetimi
               ─► [Ürün veritabanı] katalog-urun.js     yalnız 'dogrulandi' ürünler, kategori şemalarıyla
Motor sonucu ─► [Gereksinim]      gereksinim.js        E.design çıktısından salt okunur ihtiyaç listesi
               ─► [Eşleştirme]    esles-pompa/filtre/vana/boru/baglanti.js  her kategori ayrı modül, ayrı test
               ─► [Öneri ekranı]  uygun / eksik veri / uygun değil (+ neden, katalog sayfası bağlantısı)
               ─► [Projeye uygulama] taslak → (gerekirse) E.design yeniden → önce/sonra → Uygula / İptal / Geri Al
```
Eşleştirme modülleri motoru **çağırmaz**; yalnız motor sonucunu okur. Ürün seçimi hesabı etkiliyorsa (yalnız boru iç çapı) mevcut `opt.catalog` / boru seçimi yolu ile taslak hesap yapılır; bu yol bugün PN-3a ile vardır.

## 2. Ürün veri modeli (ortak)
`{ id, uretici, marka, aile, model, urunKodu, kategori, ozellikler: { ad: { deger, birim, kaynak: { katalogId, sayfa, hamMetin } } }, katalogId, katalogTarihi, durum: 'okundu'|'kullanici-onayladi'|'dogrulandi'|'reddedildi', dogrulayan?, fiyat?: { deger, paraBirimi, tarih, kdvDahil } }`
- Her teknik değerin kaynağı (katalog + sayfa + ham metin) zorunlu. Kaynaksız değer eşleştirmeye girmez.
- Birimler SI'ya çevrilirken özgün değer ve birim saklanır.
- Eksik alan boş kalır; tahminle doldurulmaz. Fiyat tarih ve para birimi olmadan kaydedilmez; güncel değilse "N gün önce" gösterilir.

## 3. Kategori kuralları
**Pompa:** Üretici Q–H eğrisi noktaları (en az 4 nokta, kaynak sayfasıyla), varsa verim, güç, NPSHr eğrileri. İşletme noktası, sistem eğrisinin (motorun H(Q) bileşenlerinden: statik yük + sürtünme ∝ Q^1.852) pompa eğrisiyle kesişimi olarak hesaplanır. Yalnız katalog en büyük Q / en büyük H değerleriyle seçim yapılmaz. Devir ve çark çapı ayrı ürün sayılır; doğrulanmadan birbirinin yerine kullanılmaz. NPSH verisi yoksa "NPSH doğrulanamadı" gösterilir. Çıktılar: işletme noktası, debi/yük rezervi, verim, mil gücü, BEP'e uzaklık.
**Filtre:** Debi kapasitesi, bağlantı ölçüsü, filtrasyon derecesi (mesh/mikron) ve su kalitesi uyumu; **temiz** ve **kirli** basınç kaybı ayrı alanlar. Yalnız en büyük debi yeterli diye "uygun" verilmez; temiz kayıp eğrisi ve geri yıkama ihtiyacı yoksa "eksik veri".
**Vana:** Çap, PN, bağlantı standardı, Kv/Cv veya üretici kayıp eğrisi; kayıp ΔP = (Q/Kv)²; çalışma basıncı aralığı ve en düşük basınç koşulu (ör. hidrolik kontrollü vanalar).
**Boru:** Malzeme (PE80/PE100/PVC-U), dış çap, PN, SDR → iç çap = DN − 2e (üretici et kalınlığı). Hız ve sürtünme kaybı iç çapla; yeni boru seçilirse motor taslak olarak yeniden çalıştırılır. PN sınıfı çalışma basıncı içindir; su darbesi (geçici rejim) analizi ayrı bir gereksinim olarak gösterilir, PN ile karıştırılmaz.
**Bağlantı elemanları:** Çap, bağlantı türü (elektrofüzyon, alın kaynak, kompresyon, yapıştırma, flanş, dişli), malzeme ve PN uyumu. Boru sistemine uymayan parça önerilmez.

## 4. Öneri ekranı
Her kategori için üç liste: **teknik olarak uygun**, **doğrulama için verisi eksik** (hangi alanın eksik olduğu yazılır), **uygun değil** (neden). Her modelde katalog PDF'si ve sayfa bağlantısı (pdf.js görüntüleyicide o sayfa). Uygunluğu karşılanmayan ürün yalnız kullanıcının açık onayıyla ve "kullanıcı kararı" etiketiyle seçilebilir; "uygun" olarak işaretlenmez.

## 5. Projeye uygulama
Seçim proje Malzeme Listesi'ne "katalog kalemi" olarak eklenir (mevcut BOM satırları değişmez). Hesabı etkileyen seçimlerde: taslak hesap → önce/sonra karşılaştırması → Uygula / İptal / Geri Al (Shift Yönetimi'ndeki revizyon/geri alma deseni).

## 6. Aşamalar (her biri ayrı PR, onaysız birleştirme yok)
1. **PR #39** — Katalog kütüphanesi: depolama, kayıt, PDF yükleme/yeniden açma (tamamlandı, Android cihazda doğrulanmadı) → pdf.js görüntüleyici ve arama.
2. Çıkarım altyapısı + doğrulama ekranı (ürün veri modeli, kaynak sayfası zorunlu).
3. Gereksinim modülü (motor sonucundan salt okunur) + altın kayıt eşitlik testleri.
4. Boru eşleştirme (iç çap, hız, kayıp; taslak hesap).
5. Bağlantı elemanları uyumu.
6. Vana eşleştirme (Kv/Cv, PN, basınç koşulları).
7. Filtre eşleştirme (temiz/kirli kayıp ayrı).
8. Pompa eşleştirme (eğri kesişimi, verim, NPSH).
9. Öneri ekranı + Malzeme Listesi'ne uygulama (önce/sonra, Uygula/İptal/Geri Al).
Her kategori için bağımsız test seti: sentetik katalog verisiyle bilinen el hesabı sonuçları, eksik veri → "eksik", yalnız en büyük değer verilmiş ürün → "uygun" verilmez, motor çıktısı bayt bayt aynı.

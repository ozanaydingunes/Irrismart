# Akıllı mühendislik ekipman seçimi — teknik mimari

Durum: mimari ve aşama planı. Bağımsız PR. Katalog teknik ürün veritabanına (ayrı PR) dayanır; yalnız `muhendislik: dogrulandi` ürün değerleri kullanılır. Hesap motoru ve altın kayıtlar değişmez.

## 1. Katmanlar
```
E.design sonucu ──► gereksinim.js (salt okunur)            Ürün veritabanı (doğrulanmış)
                        │                                          │
                        └──────────► esles-<kategori>.js ◄─────────┘   (pompa, filtre, vana, boru, baglanti)
                                        │  her ürün için: { durum: 'uygun'|'eksik-veri'|'uygun-degil', gerekceler[], hesap{}, kaynakSayfalar[] }
                                        ▼
                                  oneri ekranı → seçim → (gerekirse) taslak E.design → önce/sonra → Uygula / İptal / Geri Al
                                        ▼
                                  proje malzeme listesi: "katalog kalemi" (üretici, model, kod, katalog + sayfa)
```

## 2. Gereksinim (motor sonucundan, değiştirmeden)
Pompa: tasarım debisi (en büyük shift), gerekli toplam dinamik yük; sistem eğrisi H(Q) = Hstatik + k·Q^1.852 (motorun kayıp bileşenlerinden). Filtre: istasyon debisi, damlatıcının istediği filtrasyon, izin verilen kayıp payı. Vana: shift ve ana hat debileri, çaplar, çalışma basıncı aralığı. Boru: segment debileri, en büyük çalışma basıncı, mevcut seçilen çap/PN. Bağlantılar: malzeme listesindeki çap/malzeme/PN geçişleri.

## 3. Kategori kuralları (yalnız doğrulanmış verilerle)
- **Pompa:** Q–H eğrisi (≥ 4 nokta) ile sistem eğrisinin kesişimi (işletme noktası). Eğrinin ölçülen aralığı dışında değer üretilmez. Çıktı: işletme noktası, debi ve yük rezervi, verim (eğri varsa), mil gücü, NPSHr/NPSHa (veri varsa; yoksa "NPSH doğrulanamadı" → eksik veri). Farklı devir/çark çapı ayrı ürün; birbirinin yerine kullanılmaz. Yalnız en büyük Q / en büyük H ile "uygun" verilmez.
- **Filtre:** debi kapasitesi ≥ gereken; filtrasyon derecesi damlatıcı gereksinimini karşılar; **temiz** kayıp tasarım debisinde kayıp tablosu/eğrisinden; kirli kayıp ayrı (geri yıkama eşiği); bağlantı çapı. Kayıp verisi yoksa eksik veri.
- **Vana:** DN, PN ≥ çalışma basıncı (+ pay), ΔP = (Q/Kv)² (Cv → Kv dönüşümü), en düşük çalışma basıncı koşulu (hidrolik kontrollü vanalar), bağlantı standardı.
- **Boru:** iç çap = OD − 2e (üretici et kalınlığı); hız ve sürtünme kaybı motorun kullandığı Hazen-Williams ile **aynı işlevle**; PN çalışma basıncına göre; su darbesi değerlendirmesi ayrı uyarı (PN ile karıştırılmaz). Seçim hesap sonucunu değiştirir → taslak E.design (PN-3a boru seçimi yolu).
- **Bağlantı elemanları:** çap, bağlantı türü (elektrofüzyon, alın kaynak, kompresyon, yapıştırma, flanş, dişli), malzeme ve PN uyumu; boru sistemine uymayan parça önerilmez.

## 4. Sonuç sınıfları
Uygun / Verisi eksik (hangi alan, hangi sayfa gerekli) / Uygun değil (neden, sayısal fark). Her ürün kartında üretici, model, kod, katalog adı + sayfa. Kullanıcı "uygun değil" ürünü seçebilir ama yalnız açık onayla; durum değişmez, "kullanıcı kararı" etiketi raporda kalır.

## 5. Projeye uygulama
Malzeme listesine katalog kalemi olarak eklenir (mevcut BOM satırları ve fiyat girişleri değişmez). Hidrolik sonucu etkileyen seçimler (boru) taslak hesap + önce/sonra + Uygula/İptal/Geri Al ile; revizyon anlık görüntüsü alınır.

## 6. Testler
Her kategori için sentetik doğrulanmış ürün verisiyle el hesabı karşılaştırmaları; "eksik veri" ve "yalnız en büyük değer" senaryoları; doğrulanmamış veri kullanılmaz; motor çıktısı ve altın kayıtlar bayt bayt aynı.

## 7. Aşamalar
1. gereksinim.js + boru eşleştirme (ilk somut değer: iç çap, hız, kayıp).
2. Vana ve bağlantı elemanları.
3. Filtre.
4. Pompa (eğri kesişimi, verim, NPSH).
5. Öneri ekranı + malzeme listesine uygulama + taslak hesap.

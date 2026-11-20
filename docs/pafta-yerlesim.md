# A3 pafta yerleşimi — hata düzeltmesi ve tasarım önerisi

## Hatanın gerçek nedeni (`www/js/drawing.js`, `sheetLayout`)
- Otomatik ölçek yalnız `SCALES = [500, 1000, 2000, 4000, 5000]` listesinden seçiliyordu: bütün geometriyi
  (parsel, ana hat, ekipman/kaynak — `M.bbox`) çizim alanına sığdıran **ilk** ölçek.
- Su kaynağı parselden uzaksa veya proje büyükse 1:5000'de bile sığmıyordu. Bu durumda kod
  `auto || SCALES[SCALES.length - 1]` ile **sessizce 1:5000'i** kullanıyor, `fits=false` bilgisini tek paftada
  dikkate almıyordu.
- Görünüm `M.bbox` merkezine ortalandığı için uzak kaynak merkezi kaydırıyor; parsel yukarı/yana kayıyor
  (paftanın bir yanında büyük boşluk), ana hat ve kaynak çizim alanının dışına çıkıp bilgi paneli kenarında
  kırpılıyordu. Kullanıcının paylaştığı ekran görüntüsü (1:5000, kenarda kesilen kırmızı hat) bu durumdur.

## Düzeltme (en küçük güvenilir değişiklik)
1. Ölçek listesi 1:5000'den küçük standart ölçeklerle uzatıldı: 1:7500, 1:10000, 1:15000, 1:20000, 1:25000, 1:50000.
   Mevcut beş ölçek ve sırası aynı → bugün 1:5000 veya daha büyük ölçeğe sığan projelerin paftası değişmez
   (19 altın senaryonun hepsi bu durumda; altın kayıt değişmedi).
2. Liste de yetmezse sığan ilk 1-2-5 dizisi ölçeği hesaplanır: otomatik modda tek pafta **asla kırpılmaz**.
3. Ölçek çubuğu 5 ve 10 km bölmelerini de kullanır; çubuk uzunluğu = etiket (m) × 1000/ölçek (test PF-01).
4. Uzak kaynak bildirimi: yalnız parsel çizilseydi ölçek en az 2,5 kat büyük olabilecekse Teknik ekranında not:
   "Su kaynağı ve ana hat parselden uzak olduğu için bütün çizim 1:{s} ölçeğe sığdırıldı; yalnız parsel 1:{p} ile
   çizilebilirdi…" (8 dil).
5. Değişmeyenler: hidrolik hesap, proje verisi, DXF, Excel, elle seçilen ölçek, çoklu pafta, Android.

## Testler (`test/pafta.test.js`)
- PF-01: dikdörtgen, çok köşeli düzensiz, uzun-dar, parsel dışına uzanan kaynak/ana hat, çok shiftli büyük proje,
  KML ile içe aktarılan parsel — A3 yatay: parsel köşeleri, ana hat uçları, kaynak, pompa, filtre, shift vanaları ve
  manifold uçları çizim alanında; çizim alanı bilgi panelinin üzerine taşmıyor; x/y aynı ölçek (en-boy korunur);
  ölçek çubuğu ve yazısı dönüşümle tutarlı; çizim yatay ve düşey ortalı; alan kullanımı ≥ %45.
- PF-02: 1,5 km, 4 km ve 12 km uzak kaynak — ölçek 1:5000'in altına iner, kırpma yok, uzak kaynak bildirilir.
- PF-03: dikey A3, A4, A1; elle 1:1000 seçimi korunur ve sığmadığı bildirilir; çoklu pafta sayısı verilir.
- Eski kodla PF-01/02/03 başarısız (ör. "uzak kaynak 1,5 km: 18 kritik nokta çizim alanı dışında (ölçek 1:5000)").

## Tasarım önerisi (henüz uygulanmadı — onay sonrası, 1.1)
- **Paftaya sığdır** (varsayılan, bugünkü "Otomatik"): bütün geometri tek paftada, standart ölçek.
- **Ölçeği seç**: liste + "parsel ölçeği" kısayolu (yalnız parsel sığacak şekilde); sığmayan kısım için çoklu pafta.
- **Detay paftası (uzak kaynakta)**: 1. pafta genel yerleşim (1:7500 vb., kaynak + güzergâh), 2. pafta yalnız parsel
  ve shift'ler (1:2000 vb.); ana hat parsele girdiği noktada "Güzergâh: pafta 1" kesik oku. Aynı PDF'de iki sayfa,
  DXF değişmez. Kullanıcı "Detay paftası ekle" seçeneğiyle açar.

# IrriGrow 1.0.1 — Shift Yönetimi (A + B)

## Kapsam
- **Giriş noktaları:** Hidrolik ekranı ("Shift Yönetimi"), masaüstü üst çubuk ("⇄ Shift Yönetimi"), masaüstü sağ panel
  (shift seçiliyken), W-HIZ-01 / W-POM-01 çözüm kartlarında "Shiftleri Düzenle" (Sonuç ve Hidrolik özet).
- **Shift başına:** alan, hesaplanan debi, gerekli giriş basıncı (m/bar), süre ve hacim, pompa görev noktası,
  fazla basınç, açılacak vanalar. Hepsi motor sonucundan (`E.design` → `IrriHydroView.build`); tahmin yok.
- **Düzenleme (taslak):** shift sayısı, alt üniteyi başka/yeni shift'e taşıma, otomatik düzene dönme,
  çalışma sırası (↑/↓), hedef shift debisi.
- **Önizleme:** taslak aynı `E.design` çağrısıyla hesaplanır; önce/sonra tablosu (shift sayısı, en büyük/en küçük/kritik
  debi, ana hat hızı, H maks., kritik ana hat kaybı, pompa görev noktası ve motor, süre, tur, enerji, uygunsuz/uyarı sayısı).
- **Harita:** "Haritada göster" seçili shift'i (taslak düzende) vurgular; diğer shift'ler ve lateraller soluklaşır.
  Mobilde panel küçülür, üstte dönüş düğmesi; masaüstünde panel sağda açık kalır.
- **Uygula / İptal / Geri Al:** Uygula'dan önce revizyon alınır ("shift yönetimi öncesi") ve önceki shift durumu
  `shiftGeriAl` olarak saklanır; Geri Al onu birebir geri yazar. İptal hiçbir şey yazmaz.

## Veri (proje kaydı, geriye uyumlu)
| Alan | Anlam | Hesaba etkisi |
|---|---|---|
| `inp.Ns`, `shiftEdit` | mevcut alanlar (shift sayısı, elle atama) | var (değişmedi) |
| `shiftSira` | çalışma sırası, 0..n-1 permütasyonu | **yok** — yalnız program/rapor sırası |
| `shiftHedef` | hedef shift debisi (m³/h) | **yok** — yalnız bilgi |
| `shiftGeriAl` | son Uygula öncesi shift durumu | yok |

`shiftSira` ve `shiftHedef` revizyona girer (`REV_EXTRA`); eski revizyonlar bu alanları silmez. Eski projelerde alanlar
yoktur ve hiçbir çıktı değişmez.

## Raporlar
- `shiftSira` varsa (ve varsayılan sıra değilse) PDF/Excel "Shift’ler" tablosu çalışma sırasıyla ve "Çalışma sırası"
  sütunuyla yazılır; yoksa tablo aynen kalır (altın kayıtlar değişmedi).
- `shiftHedef` varsa özete "Hedef shift debisi (bilgi; hesabı değiştirmez)" satırı eklenir.

## Değişmeyenler
Hesap motoru, altın kayıtlar (19 senaryo), 38 hidrolik denetim, EPANET karşılaştırmaları, Android/web ortak kod.

## Sonraki sürümler (bu PR'da yok)
- 1.1: eşzamanlı shift'ler, shift başına farklı süre.
- 2.0: haritada serbest shift sınırları.

## Testler
- `test/shift-yonetimi.test.js` (SY-01…07): yardımcılar, motorla birebir özet, önizleme, hedef/sıranın hesabı
  değiştirmemesi, rapor sırası, revizyon/yedek, çeviriler, çözüm kartı düğmesi.
- `test-ui/shift.ui.js` (390 px ve 1280 px, 66 denetim): giriş, kartlar, taşma, önizleme, sıra, hedef, harita vurgusu,
  Uygula + PDF/Excel, Geri Al, elle taşıma, İptal, W-HIZ-01/W-POM-01 bağlantısı, yedek.

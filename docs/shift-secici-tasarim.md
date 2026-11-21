# Shift seçici ve manuel Shift Yönetimi — teknik inceleme ve tasarım planı (1.0.3)

## Mevcut manuel kontroller (1.0.2)
| İstenen | Durum |
|---|---|
| Shift sayısı artır/azalt | Var: Sonuç alternatif tablosu ve Shift Yönetimi açılır listesi. − / + düğmesi yok |
| Alt ünite taşıma | Var: Sonuç kartları, Shift Yönetimi, Arazi → Shift fırçası. Fırça önizlemesiz, doğrudan kaydediyor |
| Çalışma sırası, hedef debi | Shift Yönetimi'nde var |
| Shift detayı | Hidrolik → "Shift Analizi" sekmesinde; mobilde alttan erişilen seçici yok |
| Manifold / lateral | Manifold tablosu var; lateral yalnız sayı |
| Kontrol vanaları | Hesapta var (alt ünite başına); shift detayında yok |
| Kritik kayıplar | Basma yüksekliği dökümü var |
| Alan | Debi oranından (`hydro-view.js`); gerçek alt ünite geometrisinden değil |
| Haritadan panele | Yok; telefonda bilgi balonu açılıyor |
| Önce/sonra | Shift alanı, günlük su gereksinimi, "uyarı giderildi mi" yok |
| Uygunluk | Genel sonuç resmî değerlendirmeyle aynı (1.0.2); PN, hız ve pompa kontrolleri tek tek listelenmiyor |

## PR-1 (bu PR): alt Shift seçici, detay paneli, harita bağlantısı — yalnız gösterim
- **Tutamak:** Hidrolik ekranında, alt sekme çubuğunun hemen üstünde "▴ Shiftler (n)". Alttan açılan paneli açar; alt sekme çubuğu görünür kalır.
- **Çipler:** Bütün shift'ler yatay kaydırılabilir; seçili olan vurgulu ve görünür alana kayar; uygunsuz/sınırda shift'lerde işaret var.
- **Detay:**
  - alan (alt ünite geometrisinden), hesaplanan debi (motor sonucu, düzenlenemez), hedef debi (bilgi);
  - gerekli giriş basıncı (mSS ve bar), sulama süresi ve hacmi, pompa görev noktası;
  - kontrol vanaları (alt ünite başına motorun seçimi), kritik hidrolik kayıplar ve belirleyici ünite;
  - manifold ve lateral bağlantıları (Ø/PN, debi, lateral sayısı, en uzun lateral, giriş basıncı, alan);
  - shift ve proje uygunluğu.
  - Eksik değerde "Hesaplanamadı" / "Veri gerekli"; tahmin yok.
- **Düğmeler:** "Haritada göster" (salt okunur vurgu, dönüş düğmesi aynı shift'i açar); "Düzenle" (Shift Yönetimi o shift seçili açılır); kapatınca aynı ekran ve kaydırma konumu.
- **Haritadan panele:** Telefonda haritada bir shift'e (veya içindeki laterale) dokunmak bilgi balonu yerine paneli o shift ile açar. Masaüstünde sağ mühendislik paneli aynen kalır.
- **Masaüstü:** Panel sağ çekmece olarak açılır.
- **Alan:** `IrriShiftYonetimi.geoAlan`, motorun kullandığı aynı kırpma poligonlarından hesaplar. Toplam ≤ parsel alanı; aradaki fark yalnız sıra aralığına sığmayan kenar şeritleridir. Mevcut ekranlar, raporlar ve altın kayıtlar değişmez.

## PR-2 (sonraki): manuel düzenleme iş akışı
- **Shift Yönetimi'ne eklenecekler:** shift sayısı − / +; "Bu shift'e alt ünite ekle"; seçili shift'in gerçek alanı.
- **"Haritada düzenle":** Arazi'nin mevcut shift fırçası taslağa yazar (önizleme / Uygula / İptal / Geri Al); fırça seçili shift olarak başlar.
- **Arazi'de Görüntüle / Düzenle ayrımı:** Parsel tamamlanmışsa harita görüntüleme modunda açılır; sınıra köşe eklemek için "Düzenle" seçilmelidir. Bugün Sınır modunda parsel dışına dokunmak köşe ekliyor.
- **Sınır düzenleme:** Yerleşimi değiştirdiği için taslakla birleşmez; taslak uyarıyla kapanır.
- **Önce/sonra'ya eklenecekler:** seçili shift alanı, pompa debisi, günlük su gereksinimi; bütün resmî kontrollerin listesi; bulgu farkı (giderilen / yeni / devam eden).

## Kapsam dışı
Eşzamanlı shift grupları, shift başına farklı süre (1.1); serbest poligon bölme (2.0); hesap motoru değişikliği; Play Store.

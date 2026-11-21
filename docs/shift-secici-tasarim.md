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

## PR-2 (1.0.4): manuel düzenleme iş akışı
- **Shift sayısı:** − / + düğmeleri; yalnız motorun hesapladığı otomatik seçenekler arasında; uçlarda kapalı.
- **"Bu shift'e alt ünite ekle":** seçili shift'in kartında, başka shift'lerin alt üniteleri listelenir; seçilen ünite taslakta bu shift'e taşınır.
- **"Haritada düzenle":** Arazi'nin mevcut shift fırçası taslağa yazar.
  - Fırça seçili shift ile başlar; dokunulan alt ünite taslakta taşınır ve motorla yeniden hesaplanır.
  - Kayıtlı proje Uygula'ya kadar değişmez; Geri Al önceki atamayı getirir.
  - Arazi'de bağımsız kullanılan Shift fırçası (Shift Yönetimi açık değilken) bugünkü gibi çalışır.
- **Arazi modları:**
  - "Görüntüle": parsel tamamlanmışsa varsayılan; dokunuş hiçbir şeyi değiştirmez, köşe tutamağı yok, Geri/Temizle kapalı, sürükleme yok.
  - "Sınır / Kaynak / İstasyon / Ana hat": açık düzenleme.
  - "Shift": atama.
  - Yeni parsel (köşe < 3) bugünkü gibi Sınır modunda açılır.
- **Taslak kararı:** Açık taslak varken Sınır, Kaynak, İstasyon veya Ana hat düzenlemesine geçişte "Taslağı uygula / Taslağı iptal et / Vazgeç" penceresi çıkar.
- **Alan:**
  - "Gerçek alan (geometri)": alt ünite poligonları.
  - "Hesap alan payı (debi oranı)": mevcut raporlardaki değer, hesap girdisi değildir; yalnız farklıysa gösterilir.
  - İkisi de motor girdisi değildir. Debi, basınç ve kayıplar yalnız motordan gelir.
- **Önce/sonra:**
  - seçili shift alanı ve hesaplanan debisi;
  - maks./min./kritik debi, ana hat hızı, H maks., kritik ana hat kaybı;
  - pompa debisi, basma yüksekliği ve motor gücü;
  - süre, tur, enerji, günlük su ihtiyacı, teknik uygunluk.
- **Bulgu farkı:** giderilen / yeni oluşan / devam eden (seviye değişimiyle). Kullanıcı kararı bulguyu kaldırmaz.
- **Bütün mühendislik kontrolleri:** kaynak, kapasite, süre, tur, PN, hız, pompa vb. uygunluk bölümünde listelenir.
- **Düzeltme:** Shift vurgusu sırasında Arazi'nin gecikmeli "parsele sığdır" çağrısı vurgunun yakınlaştırmasını eziyordu; artık atlanır.

## Kapsam dışı
Eşzamanlı shift grupları, shift başına farklı süre (1.1); serbest poligon bölme (2.0); hesap motoru değişikliği; Play Store.

# IrriGrow Gizlilik Politikası

> **Yayın notu (bu kutu yayımlanan sayfaya konmaz):** Yayımlamadan önce yalnız köşeli parantezli üç alan doldurulur:
> `[GELİŞTİRİCİ ADI]`, `[İLETİŞİM E-POSTASI]`, `[YÜRÜRLÜK TARİHİ]`. Harita veya yükseklik sağlayıcısı değişirse
> (K-7 §4) 4. bölüm güncellenir. Metin, IrriGrow 1.0.0'ın gerçek davranışına göre yazılmıştır. Hukuki gözden geçirme önerilir.
> İngilizce sürüm: `docs/privacy-policy.md`.

**Yürürlük tarihi:** [YÜRÜRLÜK TARİHİ]
**Geliştirici:** [GELİŞTİRİCİ ADI]
**İletişim:** [İLETİŞİM E-POSTASI]

Bu politika, IrriGrow Android uygulamasının ve IrriGrow web uygulamasının (birlikte "Uygulama") hangi bilgileri
nasıl işlediğini açıklar.

## 1. Özet
- Hesap açmanız gerekmez. Ad, e-posta veya telefon numarası istenmez.
- Uygulamada reklam, kullanım analizi (analytics), çökme raporlama veya izleme aracı **yoktur**.
- Projeleriniz **cihazınızda** saklanır; geliştiriciye gönderilmez. Bulut eşitleme yoktur.
- İnternet bağlantısı varken yalnız iki dış hizmete istek yapılır: uydu görüntüsü için **Esri**, yükseklik için
  **Open-Meteo** (ayrıntı 4. bölümde).

## 2. Cihazınızda saklanan bilgiler
Uygulama aşağıdakileri yalnız cihazınızın yerel depolamasında (Android uygulama verisi veya tarayıcının yerel
depolaması) tutar:
- projeler: proje adı, girdiler (bitki, debi, toprak vb.), parsel sınırı koordinatları, kaynak/istasyon noktaları,
  boru ve shift seçimleri, hesap sonuçları için gerekli veriler;
- fiyat ayarları, dil ve tema tercihleri;
- isteğe bağlı olarak yüklediğiniz ekipman kataloğu.

Bu bilgiler geliştiriciye veya üçüncü kişilere gönderilmez.

**Android sistem yedeklemesi:** Telefonunuzda Google hesabınızla Android yedeklemesi açıksa, Android işletim sistemi
uygulama verilerini (projeler dahil) Google'ın yedekleme hizmetine kendisi yedekleyebilir. Bu işlem Android'in bir
özelliğidir, geliştirici bu yedeklere erişemez; telefonunuzun yedekleme ayarlarından (çoğu cihazda **Ayarlar → Sistem → Yedekleme** veya **Google → Yedekleme**)
kapatabilirsiniz.

**Web uygulaması:** Projeler tarayıcınızın yerel depolamasında kalır. Tarayıcı verilerini sildiğinizde projeler de silinir.

## 3. Konum
- Uygulama (Android ve web) konum iznini **yalnız haritadaki "◎" (konumum) düğmesine bastığınızda** ister ve kullanır.
- Konumunuz yalnız haritayı bulunduğunuz yere getirmek için cihazda kullanılır; geliştiriciye gönderilmez, saklanmaz
  ve arka planda konum alınmaz.
- Harita o bölgeye geldiğinde, ilgili uydu görüntüsü 4. bölümde açıklandığı gibi Esri'den istenir.

## 4. Üçüncü taraf hizmetler
Aşağıdaki istekler yalnız internet bağlantısı varken ve yalnız ilgili işlevi kullandığınızda yapılır. Bağlantılar
HTTPS ile şifrelenir. Bu hizmetler kendi gizlilik politikalarına tabidir.

| Hizmet | Ne zaman | Gönderilen bilgi | Amaç |
|---|---|---|---|
| **Esri** (World Imagery uydu görüntüsü) | Harita ekranı açıkken | Görüntülenen bölgenin harita karosu koordinatları; her internet isteğinde olduğu gibi IP adresi ve tarayıcı/WebView bilgisi | Haritada uydu görüntüsünü göstermek |
| **Open-Meteo** (Elevation API) | Parselde **Uygula**'ya bastığınızda | Parsel sınırındaki ve içindeki örnek noktaların enlem ve boylamı (en çok yaklaşık 80 nokta); IP adresi ve tarayıcı/WebView bilgisi | Yükseklik ve eğimi hesaplamak |

Proje adı, bitki, debi, fiyat, maliyet ve diğer proje bilgileri bu hizmetlere **gönderilmez**.

## 5. Dosyalar ve paylaşım
- Açtığınız KML/KMZ ve JSON yedek dosyaları yalnız sizin seçtiğiniz dosyalardır; cihazda okunur ve hiçbir yere gönderilmez.
- PDF, Excel ve DXF raporları cihazınıza (Android'de Belgeler/IrriGrow klasörüne) kaydedilir. Bir raporu e-posta
  veya mesajlaşma uygulamasıyla paylaşmak tamamen sizin seçiminizdir; paylaşım o uygulamanın koşullarına tabidir.

## 6. Verilerin saklanması ve silinmesi
- Projeyi uygulama içinden silebilir, uygulamayı kaldırarak bütün verileri cihazdan silebilirsiniz.
- Geliştiricinin sunucusunda sizinle ilgili bir veri bulunmadığından, silme için ayrıca başvurmanız gerekmez.
- Silmeden önce **Projeler → Yedekle** ile JSON yedeği alabilirsiniz.

## 7. Çocuklar
Uygulama profesyonel kullanıcılara (sulama tasarımı) yöneliktir; 13 yaşından küçük çocuklara yönelik değildir ve
çocuklardan bilerek bilgi toplamaz.

## 8. Güvenlik
Dış hizmetlere yapılan bütün istekler HTTPS ile şifrelenir. Cihazınızdaki verilerin korunması cihazınızın kilit ve
şifreleme ayarlarına bağlıdır.

## 9. Haklarınız
Kişisel verilerinizle ilgili sorularınız ve 6698 sayılı KVKK veya GDPR kapsamındaki talepleriniz için
[İLETİŞİM E-POSTASI] adresine yazabilirsiniz. Geliştirici sizinle ilgili veri saklamadığından, çoğu talep cihazınızdaki
verilerle ilgilidir ve uygulama içinden yönetilebilir.

## 10. Değişiklikler
Bu politika değişirse güncel sürüm aynı adreste yayımlanır ve yürürlük tarihi güncellenir. Önemli değişiklikler
uygulama güncellemesi notlarında da belirtilir.

# MH-WEB-2 — Masaüstü kullanıcı kabul testi

Amaç: PR #10'daki masaüstü düzenini, **canlı siteyi (`https://ozanaydingunes.github.io/Irrismart/`)
ve oradaki proje kayıtlarını değiştirmeden**, gerçek bir masaüstü tarayıcıda denemek. Canlı site
yalnız `main` dalından yayımlanır; PR #10 birleştirilmedikçe canlı site değişmez.

## 1. İzole önizleme: yerel test sunucusu (önerilen yöntem)

PR #10 dalında `tools/onizleme.js` adlı küçük bir sunucu var. Ek paket gerektirmez, yalnız
Node.js ister.

- Yalnız bu bilgisayardan açılır (`127.0.0.1`); ağa kapalıdır.
- `www/` klasörünü olduğu gibi sunar; uygulama kodunu değiştirmez.
- Sekme başlığında **"ÖNİZLEME ·"** yazar; canlı siteyle karışmaz.
- **Depolama yalıtımı:** tarayıcılar kayıtları adrese göre ayırır. `http://127.0.0.1:8090`
  adresindeki önizleme, `https://ozanaydingunes.github.io` adresindeki canlı sitenin kayıtlarını
  **göremez ve değiştiremez**; canlı site de önizlemenin kayıtlarını görmez.

### Kurulum (bir kez)

1. Node.js kurulu değilse https://nodejs.org adresinden **LTS** sürümünü kurun.
2. PR #10 dalının ZIP dosyasını indirin:
   `https://github.com/ozanaydingunes/Irrismart/archive/refs/heads/claude/mh-web-2.zip`
3. ZIP'i bir klasöre çıkarın (klasör adı: `Irrismart-claude-mh-web-2`).

### Başlatma

| Sistem | Yöntem |
|---|---|
| Windows | `tools\onizleme-windows.cmd` dosyasına çift tıklayın. Tarayıcı kendiliğinden açılır. |
| macOS | `tools/onizleme-mac.command` dosyasına çift tıklayın (ilk açılışta: sağ tık → Aç). |
| Her sistem (terminal) | Klasörde `node tools/onizleme.js` → `http://127.0.0.1:8090/` |

Sunucu penceresi açık kaldıkça önizleme çalışır; kapatmak için o pencerede **Ctrl+C**.
8090 portu doluysa: `node tools/onizleme.js 8091` (adres de 8091 olur).

**Chrome veya Edge** önerilir. Pencereyi en az **1200 px** genişliğe getirin (tam ekran önerilir);
daha dar pencerede uygulama mobil düzene döner.

### Projelerinizle test etmek

1. Canlı sitede (veya telefonda) **Yedekle (JSON)** ile bir yedek alın. Bu, canlı sitedeki kayıtları
   değiştirmez.
2. Önizlemede **Yedek ▾ → Yedekten yükle** ile o dosyayı seçin.
3. Önizlemede yaptığınız her değişiklik yalnız önizlemede kalır.

Not: Dosyayı doğrudan çift tıklayıp açmak (`file://`) da çalışır, ama bazı tarayıcılar yerel
dosyalarda depolamayı farklı yönetir. Kabul testi için yerel sunucu kullanın.

## 2. Adım adım kabul testi

Her adımı önce **1440 px** (tam ekran), sonra mümkünse **1280** ve **1920 px** genişlikte yapın.
Örnek veri için Projeler ekranındaki örnek projeyi ya da kendi yedeğinizi kullanın.

| No | Adım | Beklenen sonuç |
|---|---|---|
| UAT-01 | Önizlemeyi açın. | Sekme başlığı "ÖNİZLEME · IrriGrow". Üstte araç çubuğu, solda modül çubuğu, sağda mühendislik paneli. |
| UAT-02 | Üst çubuğa bakın. | Yeni proje, Projeler, "Yerel kayıt · eşitleme yok", "Yedek: …", Yedek ▾, Raporlar ▾, tema, ⚙. Hiçbiri üst üste binmiyor. |
| UAT-03 | Yedek ▾ → Yedekten yükle ile kendi yedeğinizi yükleyin. | Projeler listede; aynı kimlikli bir proje varsa üzerine yazıldığını unutmayın (bu davranış MH-MANUEL-1A'da düzeltilecek). |
| UAT-04 | Bir projeyi açın; Sonuç ekranına geçin. | Sonuçlar ve mühendislik uyarıları, telefondaki/canlı sitedeki değerlerle aynı. |
| UAT-05 | Arazi ekranında haritayı açın. | Uydu görüntüsü, parsel, ana hat, manifoldlar, lateraller, shift renkleri. |
| UAT-06 | Haritada bir **shift alanına** tıklayın. | Bilgi balonu yerine sağ panelde: Shift numarası, debi, gerekli basınç (m · bar), alan, sulama süresi, hacim, sezonluk çalışma ve enerji, pompa görev noktası, açılan manifoldlar, basınç dökümü, uyarılar. |
| UAT-07 | Aynı shift'in değerlerini Hidrolik → Shift Analizi ile karşılaştırın. | Değerler birebir aynı. |
| UAT-08 | Bir manifold, bir lateral ve bir ana hat parçasına tıklayın. | Sağ panelde her birinin kendi değerleri. |
| UAT-09 | "Sınır" modundayken plan üstündeki bir nesneye tıklayın. | Nesne seçilir; parsel sınırına **köşe eklenmez**. |
| UAT-10 | Alt panelde sırayla Shift'ler, Ana hat kesitleri, Malzeme, Mühendislik uyarıları sekmelerini açın. | Tablolar dolu; bir satıra tıklayınca sağ panel o nesneyi gösterir. |
| UAT-11 | Alt panelin üst kenarını yukarı sürükleyin; sonra "Alt paneli kapat". | Yükseklik değişir; kapatınca harita büyür. |
| UAT-12 | Uyarılar sekmesinde bir uyarıya tıklayın. | Sonuç ekranında o uyarının kartı açılır. |
| UAT-13 | Sağ paneli ✕ ile kapatın, "‹" ile açın; sol paneli "Daralt" ile daraltın. | Orta alan genişler/daralır; düzen bozulmaz. |
| UAT-14 | Haritada tam ekran düğmesine basın, sonra çıkın. | Tam ekranda paneller gizlenir; çıkınca geri gelir. |
| UAT-15 | Veriler, Hidrolik (8 bölüm), Malzeme, Proje, Projeler ekranlarını tek tek açın. | Hepsi geniş ekrana uygun; yatay kaydırma çubuğu yok. |
| UAT-16 | Raporlar ▾ → PDF, Excel, Hidrolik Excel, DXF, Teknik pafta. | Beş dosya iner ve açılır; değerler ekranla aynı. |
| UAT-17 | Yedek ▾ → Yedekle (JSON). | Dosya iner; üst çubukta "Yedek: bugün". |
| UAT-18 | Temayı Açık / Koyu / Sistem yapın. | Her temada yazılar okunaklı. |
| UAT-19 | Tab tuşuyla düğmeler ve alt panel satırları arasında gezin; Enter ile seçin; alt panel kenarında ↑/↓. | Klavyeyle çalışıyor. |
| UAT-20 | Pencereyi 1200 px'in altına daraltın. | Mobil düzen (alttaki sekme çubuğu) geri gelir; tekrar genişletince masaüstü düzeni döner. |
| UAT-21 | Geri al/yinele, sağ tık menüsü, koordinat girişi arayın. | **Görünmüyor** (bu sürümde yok; WEB-3 kapsamı). |
| UAT-22 | Canlı siteyi ayrı sekmede açın. | Canlı sitedeki projeler değişmemiş; önizlemede yaptığınız değişiklikler orada yok. |
| UAT-23 | (İsteğe bağlı) PR #10 APK'sını telefona kurun. | Telefon düzeni değişmemiş. |

## 3. Bu oturumda yapılan otomatik doğrulama

Önizleme sunucusu üzerinden (1440 px, Chromium) masaüstü düzeni, haritada shift seçimi → sağ panel,
alt panel shift tablosu, yedi modül ve beş rapor indirmesi denendi; sayfa hatası yok. Ayrıca
`test-ui/desk.ui.js` (132 kontrol) 1280/1440/1920 px'i, telefon ve Android'de masaüstü düzeninin
açılmadığını, değerlerin motorla birebir eşitliğini, yedek/geri yüklemeyi ve tema karşıtlığını
denetler. `test/onizleme.test.js`, sunucunun yalnız `127.0.0.1`'den ve yalnız `www/` içinden
sunduğunu doğrular.

## 4. Geri bildirim

Sorunları ekran görüntüsü, pencere genişliği ve adım numarasıyla birlikte PR #10'a yorum olarak ya
da sohbette iletebilirsiniz. Kabul sonrası birleştirme kararı proje sahibinindir.

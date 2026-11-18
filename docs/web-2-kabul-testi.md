# MH-WEB-2 — Masaüstü kullanıcı kabul testi

Amaç: PR #10'daki masaüstü düzenini, **canlı siteyi (`https://ozanaydingunes.github.io/Irrismart/`)
değiştirmeden**, gerçek bir masaüstü tarayıcıda denemek. Canlı site yalnız `main` dalından
yayımlanır; PR #10 birleştirilmedikçe canlı site değişmez.

## 1. Önizlemeyi açma

### Yol A — önerilen: dalı indirip doğrudan açmak (kurulum gerekmez)

1. Şu adresi açın; dalın ZIP dosyası iner:
   `https://github.com/ozanaydingunes/Irrismart/archive/refs/heads/claude/mh-web-2.zip`
2. ZIP'i bir klasöre çıkarın.
3. `Irrismart-claude-mh-web-2/www/index.html` dosyasını **Chrome veya Edge** ile açın (çift
   tıklayın ya da tarayıcı penceresine sürükleyin).
4. Pencereyi en az **1200 px** genişliğe getirin (tam ekran önerilir). Masaüstü düzeni bu
   genişlikte açılır; daraltınca mobil düzene döner.

Bu yöntem bu oturumda denendi: dosyadan açılan sayfada masaüstü düzeni etkinleşiyor, yerel kayıt
çalışıyor, sayfa hatası yok. Uydu haritası için internet bağlantısı gerekir.

### Yol B — yerel sunucu (isteğe bağlı, Node.js kuruluysa)

```
cd Irrismart-claude-mh-web-2
npx --yes http-server www -p 8080
```
Sonra `http://localhost:8080` adresini açın.

### Önemli: projeleriniz

- Önizleme, canlı siteden **ayrı bir tarayıcı deposu** kullanır; canlı sitedeki projeleri görmez
  ve onlara dokunmaz.
- Kendi projelerinizle denemek için: canlı sitede (veya telefonda) **Yedekle (JSON)** → önizlemede
  **Yedek ▾ → Yedekten yükle**.
- Önizlemede yaptığınız değişiklikler canlı siteye ve telefona geçmez (bulut eşitleme yoktur).
- Testten sonra önizleme klasörünü silebilirsiniz.

## 2. Kontrol listesi

Her satırı **1280, 1440 ve 1920 px** (veya ekranınızın genişliği) için işaretleyin.

| No | Kontrol | Beklenen |
|---|---|---|
| UAT-01 | Üst araç çubuğu | Yeni proje, Projeler, "Yerel kayıt · eşitleme yok", "Yedek: …", Yedek ▾, Raporlar ▾, tema, Ayarlar görünüyor; hiçbiri üst üste binmiyor |
| UAT-02 | Sol modül çubuğu | Projeler, Arazi, Veriler, Sonuç, Hidrolik, Malzeme, Proje açılıyor; "Daralt" ile simgelere iniyor, tekrar genişliyor |
| UAT-03 | Bütün modüller | Her ekran masaüstü genişliğinde düzgün; yatay kaydırma çubuğu yok |
| UAT-04 | Haritada shift seçimi | Arazi ekranında plan üstünde bir shift alanına tıklayınca sağ panelde Shift numarası, alan, debi, süre, hacim, gerekli basınç ve dökümü, pompa görev noktası, açılan manifoldlar, uyarılar |
| UAT-05 | Diğer nesneler | Manifold, lateral, ana hat parçası tıklanınca sağ panelde kendi değerleri |
| UAT-06 | Sınır korunuyor | Plan nesnesine tıklamak parsel sınırına köşe eklemiyor ("Sınır" modunda da) |
| UAT-07 | Değerlerin doğruluğu | Sağ paneldeki shift değerleri Hidrolik → Shift Analizi'ndeki değerlerle aynı |
| UAT-08 | Alt panel | Shift'ler / Ana hat kesitleri / Malzeme / Mühendislik uyarıları sekmeleri; aç-kapat; üst kenarından sürükleyerek yükseklik; satıra tıklayınca sağ panel |
| UAT-09 | Uyarıdan Sonuç'a | Alt paneldeki uyarıya tıklayınca Sonuç ekranında ilgili kart açılıyor |
| UAT-10 | Sağ panel kapat/aç | Kapatınca orta alan genişliyor; "‹" ile geri açılıyor |
| UAT-11 | Tam ekran harita | Paneller gizleniyor; çıkınca geri geliyor |
| UAT-12 | Raporlar | PDF, Excel, Hidrolik Excel, DXF, Teknik pafta iniyor ve açılıyor |
| UAT-13 | Yedek | Yedekle (JSON) iniyor; "Yedek: bugün" oluyor; başka tarayıcıda/telefonda Yedekten yükle ile projeler geliyor |
| UAT-14 | Tema | Açık / koyu / sistem; yazılar her temada okunaklı |
| UAT-15 | Eski projeler | Telefondan veya canlı siteden getirilen eski projeler açılıyor, sonuçları aynı |
| UAT-16 | Klavye | Tab ile düğmeler ve alt panel satırları geziliyor; Enter/Boşluk ile seçiliyor; alt panel kenarı ↑/↓ ile boyutlanıyor |
| UAT-17 | Dar pencere | 1200 px altında mobil düzen (alt sekme çubuğu) geri geliyor |
| UAT-18 | Olmayan işlevler | Geri al/yinele, sağ tık menüsü, koordinat girişi **görünmüyor** (WEB-3 kapsamı) |
| UAT-19 | Android | PR #10 APK'sında (Actions → APK derle → PR #10 çalıştırması) telefon düzeni değişmemiş |

## 3. Geri bildirim

Sorunları ekran görüntüsü ve pencere genişliğiyle birlikte PR #10'a yorum olarak ya da sohbette
iletebilirsiniz. Kabul sonrası birleştirme kararı proje sahibinindir.

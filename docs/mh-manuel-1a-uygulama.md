# MH-MANUEL-1A — Uygulama planı (kodlama öncesi son inceleme, 18.11.2026)

Durum: **hazır plan; kodlama PR #8 tamamlanınca ve proje sahibinin başlatma onayıyla.** Ayrı dal,
ayrı PR. Hesap motoru değişmez. Kapsam ve kabul kriterleri: `docs/mh-manuel-plan.md` §8, §14,
§14.0, §14.1 (V-01…V-19). Bu belge, mevcut koddaki **her yazma yolunu** ve her birinin nasıl
güvenli hâle geleceğini listeler.

## 1. Projeye yazan kod yolları (bugünkü `www/js/app.js`, main ef28f45)

| Alan / işlem | Yer | Bugünkü davranış | Risk | 1A'daki değişiklik |
|---|---|---|---|---|
| Kalıcı kayıt | `save(KEY, projects)` (satır 19), `persist()` (37) | Bütün projeler tek anahtara yazılır; hata olursa yalnız uyarı | Bellekteki değişiklik kalır, depo eski kalır → tutarsızlık | `St.commit(projects, değişiklik)`: önce yeni dizi hazırlanır, tek yazma; başarısızsa bellekteki nesne işlem öncesi kopyasına döner (V-05) |
| Revizyon | `St.snapshot(cur, 'hesap')` (405) | Yalnız başarılı hesaptan sonra; yalnız `inp, poly, src, hydro` | Güzergâh, istasyon, elle shift, kararlar, teknik ayarlar geri gelmez | `STATE_FIELDS` ile tam görüntü; sınırda sessiz silme yok (V-02, V-08) |
| Proje silme | `[data-del]` (73) | Onaydan sonra kalıcı silme | Geri alınamaz | "Silinenler"e taşı; kalıcı silme ayrı onay (V-17) |
| Yeniden adlandırma | `[data-ren]` (75) | `p.name` değişir | Düşük | `name` görünüm alanı: revizyon oluşturmaz ama tam görüntüde yer alır |
| Kopyalama | `[data-copy]` (74) | `St.duplicate`: revizyonlar boşaltılır | Bilinçli; kopya yeni proje | Aynen; kopyaya "kaynak proje + revizyon" notu |
| Yedekten yükleme | `#restoreFile` (83–93) → `St.mergeBackup` | Aynı kimlikli proje sayısı söylenir, onayla **üzerine yazılır** | Yeni yerel çalışma eski yedekle ezilebilir | Proje başına seçim: yereli koru / yedektekiyle değiştir (yerel önce revizyona) / **ikisini de tut (varsayılan)** (V-09) |
| Parsel ve kaynak temizleme | `#mClear` (284) | Onaydan sonra `poly, src, station, route, shiftEdit, inp.grad` silinir | Geri alınamaz | Önce tam revizyon; onay penceresinde neyin silineceği listelenir |
| Elle shift ataması | `assignUnit` (271–281), Sonuç seçim kutuları (521–527) | Doğrudan projeye yazılır ve hesaplanır | Taslaksız değişiklik | 1A'da: her değişiklikten önce revizyon. Taslak akışı 1B/MH-SHIFT'te |
| Elle atamanın silinmesi | `#mAuto` (135), `#bShiftAuto` (529), `app.js:406` (imza değişince) | **Onaysız / uyarısız silme** | Veri kaybı (T-05) | Silme yerine: koru / uyarla / ayrı taslak / onayla sıfırla; imza değişince atama `shiftEditEski` olarak saklanır ve kullanıcıya gösterilir |
| Girdi değişiklikleri | `Object.assign(cur.inp…)` (302, 308), Veriler formu, alternatif tabloları (`inp.Ns`, `inp.mainOd`, `rowDir`, `latD`) | Doğrudan | Önceki değer kaybolur | Hesaptan önce tam revizyon (hesap tetiklendiği için) |
| Eğim/kot | `cur.elev` (309), `inp.slopeLong/Short`, `inp.grad` | DEM özetinin üzerine yazılır | Düşük | Tam görüntüde; KML yükseklikleri ayrı alanda (`geoKaynak.yukseklikler`) |
| Uyarı kararları | `cur.akil.onay`, `planOrani` (MH-AKIL-1/2) | Doğrudan | Karar geçmişi yok | Tam görüntüde (`akil.onay`); türetilmiş `akil.alternatifler` revizyona girmez |
| Teknik pafta | `cur.techOpt`, `cur.meta`, `cur.drawPos` | Doğrudan | Düşük | Tam görüntüde; `drawPos` görünüm alanı |
| Hidrolik tablo | `cur.hydro` (`fields` + `ptab/tab/pshift`) | Doğrudan | Elle girilen tablo değerleri revizyona giriyor ama ekran durumu da karışık | `hydro.fields` mühendislik alanı; `ptab/tab/pshift` görünüm alanı |
| Yükleme ve göç | 22–31 | Bozuk kayıt kurtarma anahtarına; ilk göçte `irrigrow.premigration.v1` ham yedeği | **Anahtar adı sabit:** şema 3 göçünde yeni ham yedek alınmaz | Göç başına anahtar (`irrigrow.premigration.s3`); bir kez yazılır, kullanıcı istemedikçe silinmez (V-19) |

**Önceki raporda düzeltme:** §14.1 G-3'te "göç öncesi ham yedek alınmıyor" yazılmıştı. Kod ilk göç
için ham yedek alıyor; eksik olan, sonraki göçlerde yeni yedek alınmamasıdır (yukarıdaki son satır).

## 2. Dosya bazında değişiklikler

| Dosya | Değişiklik |
|---|---|
| `www/js/store.js` | `SCHEMA = 3`; `STATE_FIELDS` (mühendislik + görünüm grupları); `snapshot` tam görüntü + boyut bütçesi; `restoreRev` tam geri yükleme; sınırda soru (`limitState`) — sessiz `splice` kaldırılır; `trash`/`restoreFromTrash`; `mergeBackup` çakışma planı (`planMerge` → kullanıcı seçimi → `applyMerge`); `commit` (bütün ya da hiç); göç başına ham yedek |
| `www/js/app.js` | Yukarıdaki tablodaki her yazma yolu `St` işlevlerine bağlanır; revizyon listesi ekranı (Proje ekranında: tarih, not, değişen alanlar, sabitle, bu revizyona dön); "Silinenler" listesi; depolama doluluk göstergesi ve eşikler; elle shift ataması koruma seçenekleri |
| `www/js/desk.js` | Masaüstü sağ panelde revizyon özeti; ikinci sekme algılama uyarısı (`storage` olayı, V-18) |
| `www/js/i18n-dict.js`, `www/css/app.css` | Metinler (8 dil), bileşenler |
| `test/store.test.js` | V-01…V-19'un Node testleri |
| `test-ui/veri.ui.js` (yeni) | Onay pencereleri, iki sekme, kota taklidi, revizyon ekranı, Android (390 px, Capacitor) ve masaüstü |
| `www/js/engine.js` ve hesap modülleri | **Değişmez** |

## 3. Kabul kriterleri ↔ testler

| Kod | Kriter (özet) | Test yöntemi |
|---|---|---|
| V-01 | Yazılan her alan `STATE_FIELDS`'te | Statik tarama + arayüz testlerinde `Proxy` ile yazılan anahtarların kaydı |
| V-02 | Tam görüntü → geri yükleme birebir | 19 altın senaryo + parsel + elle shift + kararlar + teknik ayarlar |
| V-03 | İptal projeyi bayt bayt değiştirmez | İşlem öncesi/sonrası JSON ve depo metni |
| V-04 | Taslak kaydı yalnız `drafts`'ı değiştirir | Alan karşılaştırması (taslak 1B'de; 1A'da alan ve kural hazırlanır) |
| V-05 | Bütün ya da hiç | `setItem` hatası taklidi |
| V-06 | Değişiklik öncesi revizyon + değişiklik kaydı | Alan alan |
| V-07 | Revizyona dönüş tam durumu getirir, geçmiş silinmez | Gidiş-dönüş |
| V-08 | Sınırda sessiz silme yok; sabitlenmiş silinmez | 20/21. revizyon, vazgeç senaryosu |
| V-09 | Yedek çakışmasında varsayılan "ikisini de tut" | Yerel yeni / yedek yeni / aynı içerik |
| V-10 | JSON gidiş-dönüş (revizyon, sabitleme, silinenler dahil) | Web ↔ Capacitor taklidi |
| V-11 | Şema 2 → 3 kayıpsız ve tekrarlanabilir | v0.6.0 ve şema 2 fikstürleri; göç iki kez |
| V-12 | Eski imzalı taslak uygulanamaz | (1B ile) kural 1A'da |
| V-13 | Depolama eşikleri %70/%85/%95 | Kota taklidi |
| V-14 | Bozuk alanlar kurtarma alanına, proje açılır | Bozuk fikstürler |
| V-15 | Android ve masaüstünde aynı | Aynı testler iki ortamda |
| V-16 | Motor ve altın kayıtlar değişmez | Mevcut altın kayıt testi + parmak izi |
| V-17 | Silinen proje geri alınabilir | Sil → geri al → derin eşitlik |
| V-18 | İki sekmede ezme yok | İki sayfalı test (`storage` olayı) |
| V-19 | Göç başına ham yedek | Göç sırasında hata taklidi |
| V-20 | **Elle shift ataması hiçbir yoldan uyarısız silinmez** (girdi değişimi, Otomatiğe dön, parsel temizleme, yedekten yükleme) | Her yol için ayrı test; imza değişince `shiftEditEski` korunur |
| V-21 | Parsel geometrisi değişimi (çizim düzeltme, temizleme, ileride KML) önce revizyon alır | Geometri değişimi → geri dönüş → eski `poly`, `route`, `station`, `shiftEdit` aynen |

## 4. Uygulama sırası (tek PR içinde adımlar)

1. `store.js` saf işlevleri ve Node testleri (V-02, V-05, V-07, V-08, V-09, V-10, V-11, V-14, V-16, V-17, V-19).
2. `app.js` yazma yollarının bağlanması (tablo §1), elle shift atamalarının korunması (V-20), geometri revizyonu (V-21).
3. Revizyon listesi, "Silinenler", depolama göstergesi; masaüstü iki sekme uyarısı (V-13, V-18).
4. Arayüz testleri (Android + masaüstü), 8 dil çeviri, karşıtlık.
5. Bütün takımlar: `npm test`, `test:ui`, `test:web`, `test:desk`, `tools/audit.js`, altın kayıt.

Telefon testi için ayrı kontrol listesi PR ile birlikte hazırlanır (eski projelerle yükseltme, yedek
→ geri yükleme, revizyona dönüş).

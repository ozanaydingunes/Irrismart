# MH-AUTO-1 — Veri modeli ve saf uygunluk kuralları (uygulama notu)

Durum: **kod PR'ı; proje sahibinin onayı olmadan birleştirilmez (19.11.2026).** Plan:
`docs/mh-auto-plan.md` §3–§5, kararlar A-1…A-14.

## Kapsam

`www/js/auto.js` (`IrriAuto`) **bağımsız, saf** bir modüldür:
- hesap motorunu çağırmaz; motor sonucunu, projeyi, depolamayı ve DOM'u değiştirmez (test A1-14);
- `index.html` yüklemez; arayüz ve gerçek kilit entegrasyonu MH-MANUEL-1A'dan sonradır;
- bugünkü otomatik seçim (`design()`, `layoutAlternatives`) ve kayıtlı projeler aynen kalır.

| Bölüm | İşlevler | Not |
|---|---|---|
| Çalışma modu | `MODLAR`, `yeniTasarim`, `tasarimOku`, `tasarimDogrula` | `mevcut` (alanı olmayan eski proje, bugünkü davranış), `manuel`, `otomatik` |
| Ortak seçim boyutları | `BOYUTLAR` | Shift sayısı ve ataması, ana hat ve manifold borusu (malzeme, Ø, SDR, PN), lateral çapı, sıra yönü, pompa, filtre, vana, güzergâh |
| Kilitler | `kilitle`, `kilitAc` (açık onay ister), `kilitliMi`, `birlestir`, `kilitDurumu` | Yalnız kullanıcı kilitler. Kilitli alan öneriye her zaman üstün; çakışma raporlanır. Uygulanamayan kilit silinmez: koru / uyarla / kaldır |
| Zorunlu uygunluk | `uygunluk` → U-01…U-07 | Tekdüzelik, tur süresi, kaynak debisi, ana hat hızı (≤ 2,0 m/s), normal işletme basıncı/PN, lateral sınırı, pompa. **Eksik veri → `veri-eksik`, asla `uygun` değil** |
| Geçici rejim | `geciciRejim` | Joukowsky aşımı → `gecici-analiz-gerekli` (asla tek başına `uygunsuz`) |
| Doğrulanmış uygunluk | `degerlendir`, `veriNiteligi`, `YETENEK` | MH-3 ve MH-AKIL-5 yokken en yüksek durum **"Ön tasarım — mühendislik doğrulaması gerekli"** |
| Alternatifler | `alternatifSec`, `metrikCikar`, `agirlikDogrula`, `VARSAYILAN_AGIRLIK` | Zorunlu filtre puanlamadan önce. Uygun aday yoksa **"Uygun tasarım bulunamadı"** + sağlanamayan koşullar. Ekonomik (yıllık toplam), Dengeli (%35/%30/%20/%15, değiştirilebilir), Performans (enerji → kayıp → tekdüzelik → hız) |
| Kilitli tasarım gerekçesi | `kilitliTasarimGerekce` | Kilitli seçimlerle tasarım uygunsuz/eksik veriliyse kilitler korunur; sağlanamayan koşullar, değerleri, sınırları ve ilgili kilitler açıklanır |
| Aday uzayı | `adayUzayi` | Boyutların çarpımı; kilitli boyut sabit; geçersiz değer elenir; sınır aşılırsa "kısmi" |

## Güvenlik kuralları (değiştirilemez)

- Eksik veri hiçbir kuralda `uygun` sayılmaz (A1-05).
- `alternatifSec` yalnız `agirliklar` seçeneğini kabul eder; zorunlu filtreyi kapatmaya yönelik her seçenek reddedilir (A1-15).
- Modül API'si, kurallar ve `YETENEK` bayrakları dondurulmuştur: `uygunluk()` değiştirilemez, "kesin uygunluk" bayrağı açılamaz (A1-15).
- Doğrulanmamış sıcaklık katsayıları bu modülde hiç kullanılmaz (PN-1: `IrriPipes.sicaklikKatsayisi()` yalnız doğrulanmış tablo).

## Bilinen sınırlar (bilerek)

- U-05, PN-2 tamamlanana kadar motorun bugünkü kuralını kullanır (1,25 × işletme ≤ PN, kapama ≤ PN);
  sıcaklık ve PFA PN-2 ile eklenecek.
- Bakım maliyeti yalnız kullanıcıdan gelir; yoksa `null` ve "Bakım maliyeti hesaplanmadı".
- Fiyatlar eksikse Ekonomik seçim boru metrajıyla yapılır ve "sıralama kesin değil" yazılır.
- Hidrolik performans göstergesi: normalize en yüksek basınç, ana hat hızı ve tekdüzelik oranının
  ortalaması (küçük = iyi). Tanım MH-AUTO-5'te gözden geçirilecek.

## Testler (`test/auto.test.js`, A1-01…A1-16)

Mod modeli, kilitler ve değişmezlik, uygulanamayan kilit, 19 altın senaryoda kurallar ve motor
sonucunun değişmediği, eksik veri, geçici rejim ayrımı, "ön tasarım" sınırı, uygun tasarım yok,
uygunsuz adayın seçilmemesi, bakım/fiyat eksikliği, ağırlıklar, gerçek motor çıktısıyla uçtan uca,
aday uzayı ve kapsam. Kasıtlı hata denemeleri: zorunlu filtre kaldırılınca A1-08/A1-09, eksik veri
"uygun" sayılınca A1-05 başarısız oluyor.

# Hesap değişiklik kaydı

IrriGrow hesap motorunun sonuçlarını değiştiren **her** değişiklik burada belgelenir.

`test/golden/kayit/` altındaki altın referans kaydının parmak izi (SHA-256) bu dosyada geçmiyorsa `npm test` başarısız olur. Kayıt yalnız `node tools/golden.js` ile yenilenir. Yöntem: `docs/dogrulama/README.md`.

Her girdi şunları içerir:
- tarih, PR ve aşama;
- yeni parmak izi;
- değişen büyüklükler ve etkilenen senaryolar;
- eski ve yeni örnek değerler;
- mühendislik gerekçesi ve kaynak;
- doğrulama sonucu (`test/dogrulama.test.js`).

---

## 2026-11-17 — MH-0: İlk altın referans kaydı

- **Parmak izi:** `46f22517b152d2412fd148aa292a72d13fd7feee2078de83a74509b49268f639`
- **Motor sürümü:** v0.6.0 hesap motoru (`www/js/*.js`, `main` @ `58f61bd`).
- **Değişiklik:** Yok. Bu kayıt mevcut sonuçların ilk dondurulmuş hâlidir; hiçbir hesap değiştirilmedi.
- **Kapsam:** 18 tasarım senaryosu (S01–S19; S04 ve S20 bekliyor) ve Hidrolik Hesap Tablosu örneği (H01).
- **Doğrulama:** Bütün bağımsız doğrulama testleri tolerans içinde. Ölçülen farklar `docs/dogrulama/README.md` bölüm 2.2'de.
- **Bilinen sınırlamalar** (bu kayıtta bilinçli olarak donduruldu):
  - S03: Aşağı eğimli lateral, yukarı eğimli gibi hesaplanıyor (MH-3).
  - Manifoldda v > 2 m/s'de Watters-Keller, Darcy-Weisbach'tan az kayıp veriyor (MH-4, uyarı).

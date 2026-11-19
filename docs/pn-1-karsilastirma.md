# PN-1 — Eski katalog ile standart tabanlı kütüphane karşılaştırması

Üretim: `node tools/pn-karsilastirma.js` (kütüphane tarihi 2026-11-19). **Bu rapor hiçbir kaydı değiştirmez.**
Farklar proje sahibinin kararı olmadan düzeltilmez (docs/pn-1-uygulama.md §7); düzeltme ayrı karar,
hesap değişikliği kaydı ve altın kayıt güncellemesi ister.

Eski katalog kayıtları otomatik seçimde kullanılmaya devam eder (`catalog-data.js`, değişmedi).

## Özet

| Durum | Anlamı | Kayıt |
|---|---|---|
| ayni | Et ve iç çap kütüphaneyle aynı | 20 |
| fark | Kütüphanede karşılığı var, değer farklı | 0 |
| aday-tek-kaynak | Karşılık yalnız tek üretici tablosunda — etkin değil, karşılaştırma bilgi amaçlı | 8 |
| aday-celiski | Kaynaklar çelişiyor — etkin değil | 0 |
| karsilik-yok | Doğrulanmış karşılık yok (kaynak erişilemedi) | 33 |
| **Toplam** | | **61** |

## Kayıt kayıt

| Kimlik | Malzeme | Ø (mm) | PN | Eski et (mm) | Eski iç çap (mm) | Eski od/et | Kütüphane SDR | Kütüphane en küçük et (mm) | Kütüphane iç çap (mm) | Δ et | Δ iç çap | Durum |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pe-50-pn6 | PE100 | 50 | 6 | 2 | 46 | 26 | 26 | pl-ll: 2 | — | — | — | aday-tek-kaynak |
| pe-63-pn6 | PE100 | 63 | 6 | 2,5 | 58 | 26 | 26 | pl-ll: 2,5 | — | — | — | aday-tek-kaynak |
| pe-75-pn6 | PE100 | 75 | 6 | 2,9 | 69,2 | 26 | 26 | pl-ll: 2,9 | — | — | — | aday-tek-kaynak |
| pe-90-pn6 | PE100 | 90 | 6 | 3,5 | 83 | 26 | 26 | pl-ll: 3,5 | — | — | — | aday-tek-kaynak |
| pe-110-pn6 | PE100 | 110 | 6 | 4,2 | 101,6 | 26 | 26 | pl-ll: 4,2 | — | — | — | aday-tek-kaynak |
| pe-125-pn6 | PE100 | 125 | 6 | 4,8 | 115,4 | 26 | 26 | pl-ll: 4,8 | — | — | — | aday-tek-kaynak |
| pe-140-pn6 | PE100 | 140 | 6 | 5,4 | 129,2 | 26 | 26 | pl-ll: 5,4 | — | — | — | aday-tek-kaynak |
| pe-160-pn6 | PE100 | 160 | 6 | 6,2 | 147,6 | 26 | 26 | pl-ll: 6,2 | — | — | — | aday-tek-kaynak |
| pe-32-pn10 | PE100 | 32 | 10 | 2 | 28 | 17 | 17 | 2 | 28 | 0 | 0 | ayni |
| pe-40-pn10 | PE100 | 40 | 10 | 2,4 | 35,2 | 17 | 17 | 2,4 | 35,2 | 0 | 0 | ayni |
| pe-50-pn10 | PE100 | 50 | 10 | 3 | 44 | 17 | 17 | 3 | 44 | 0 | 0 | ayni |
| pe-63-pn10 | PE100 | 63 | 10 | 3,8 | 55,4 | 17 | 17 | 3,8 | 55,4 | 0 | 0 | ayni |
| pe-75-pn10 | PE100 | 75 | 10 | 4,5 | 66 | 17 | 17 | 4,5 | 66 | 0 | 0 | ayni |
| pe-90-pn10 | PE100 | 90 | 10 | 5,4 | 79,2 | 17 | 17 | 5,4 | 79,2 | 0 | 0 | ayni |
| pe-110-pn10 | PE100 | 110 | 10 | 6,6 | 96,8 | 17 | 17 | 6,6 | 96,8 | 0 | 0 | ayni |
| pe-125-pn10 | PE100 | 125 | 10 | 7,4 | 110,2 | 17 | 17 | 7,4 | 110,2 | 0 | 0 | ayni |
| pe-140-pn10 | PE100 | 140 | 10 | 8,3 | 123,4 | 17 | 17 | 8,3 | 123,4 | 0 | 0 | ayni |
| pe-160-pn10 | PE100 | 160 | 10 | 9,5 | 141 | 17 | 17 | 9,5 | 141 | 0 | 0 | ayni |
| pe-32-pn16 | PE100 | 32 | 16 | 3 | 26 | 11 | 11 | 3 | 26 | 0 | 0 | ayni |
| pe-40-pn16 | PE100 | 40 | 16 | 3,7 | 32,6 | 11 | 11 | 3,7 | 32,6 | 0 | 0 | ayni |
| pe-50-pn16 | PE100 | 50 | 16 | 4,6 | 40,8 | 11 | 11 | 4,6 | 40,8 | 0 | 0 | ayni |
| pe-63-pn16 | PE100 | 63 | 16 | 5,8 | 51,4 | 11 | 11 | 5,8 | 51,4 | 0 | 0 | ayni |
| pe-75-pn16 | PE100 | 75 | 16 | 6,8 | 61,4 | 11 | 11 | 6,8 | 61,4 | 0 | 0 | ayni |
| pe-90-pn16 | PE100 | 90 | 16 | 8,2 | 73,6 | 11 | 11 | 8,2 | 73,6 | 0 | 0 | ayni |
| pe-110-pn16 | PE100 | 110 | 16 | 10 | 90 | 11 | 11 | 10 | 90 | 0 | 0 | ayni |
| pe-125-pn16 | PE100 | 125 | 16 | 11,4 | 102,2 | 11 | 11 | 11,4 | 102,2 | 0 | 0 | ayni |
| pe-140-pn16 | PE100 | 140 | 16 | 12,7 | 114,6 | 11 | 11 | 12,7 | 114,6 | 0 | 0 | ayni |
| pe-160-pn16 | PE100 | 160 | 16 | 14,6 | 130,8 | 11 | 11 | 14,6 | 130,8 | 0 | 0 | ayni |
| pvc-63-pn6 | PVC-U | 63 | 6 | 1,9 | 59,2 | 33,2 | — | — | — | — | — | karsilik-yok |
| pvc-75-pn6 | PVC-U | 75 | 6 | 2,2 | 70,6 | 34,1 | — | — | — | — | — | karsilik-yok |
| pvc-90-pn6 | PVC-U | 90 | 6 | 2,7 | 84,6 | 33,3 | — | — | — | — | — | karsilik-yok |
| pvc-110-pn6 | PVC-U | 110 | 6 | 3,2 | 103,6 | 34,4 | — | — | — | — | — | karsilik-yok |
| pvc-125-pn6 | PVC-U | 125 | 6 | 3,7 | 117,6 | 33,8 | — | — | — | — | — | karsilik-yok |
| pvc-140-pn6 | PVC-U | 140 | 6 | 4,1 | 131,8 | 34,1 | — | — | — | — | — | karsilik-yok |
| pvc-160-pn6 | PVC-U | 160 | 6 | 4,7 | 150,6 | 34 | — | — | — | — | — | karsilik-yok |
| pvc-200-pn6 | PVC-U | 200 | 6 | 5,9 | 188,2 | 33,9 | — | — | — | — | — | karsilik-yok |
| pvc-225-pn6 | PVC-U | 225 | 6 | 6,6 | 211,8 | 34,1 | — | — | — | — | — | karsilik-yok |
| pvc-250-pn6 | PVC-U | 250 | 6 | 7,3 | 235,4 | 34,2 | — | — | — | — | — | karsilik-yok |
| pvc-315-pn6 | PVC-U | 315 | 6 | 9,2 | 296,6 | 34,2 | — | — | — | — | — | karsilik-yok |
| pvc-63-pn10 | PVC-U | 63 | 10 | 3 | 57 | 21 | — | — | — | — | — | karsilik-yok |
| pvc-75-pn10 | PVC-U | 75 | 10 | 3,6 | 67,8 | 20,8 | — | — | — | — | — | karsilik-yok |
| pvc-90-pn10 | PVC-U | 90 | 10 | 4,3 | 81,4 | 20,9 | — | — | — | — | — | karsilik-yok |
| pvc-110-pn10 | PVC-U | 110 | 10 | 5,3 | 99,4 | 20,8 | — | — | — | — | — | karsilik-yok |
| pvc-125-pn10 | PVC-U | 125 | 10 | 6 | 113 | 20,8 | — | — | — | — | — | karsilik-yok |
| pvc-140-pn10 | PVC-U | 140 | 10 | 6,7 | 126,6 | 20,9 | — | — | — | — | — | karsilik-yok |
| pvc-160-pn10 | PVC-U | 160 | 10 | 7,7 | 144,6 | 20,8 | — | — | — | — | — | karsilik-yok |
| pvc-200-pn10 | PVC-U | 200 | 10 | 9,6 | 180,8 | 20,8 | — | — | — | — | — | karsilik-yok |
| pvc-225-pn10 | PVC-U | 225 | 10 | 10,8 | 203,4 | 20,8 | — | — | — | — | — | karsilik-yok |
| pvc-250-pn10 | PVC-U | 250 | 10 | 11,9 | 226,2 | 21 | — | — | — | — | — | karsilik-yok |
| pvc-315-pn10 | PVC-U | 315 | 10 | 15 | 285 | 21 | — | — | — | — | — | karsilik-yok |
| pvc-63-pn16 | PVC-U | 63 | 16 | 4,7 | 53,6 | 13,4 | — | — | — | — | — | karsilik-yok |
| pvc-75-pn16 | PVC-U | 75 | 16 | 5,6 | 63,8 | 13,4 | — | — | — | — | — | karsilik-yok |
| pvc-90-pn16 | PVC-U | 90 | 16 | 6,7 | 76,6 | 13,4 | — | — | — | — | — | karsilik-yok |
| pvc-110-pn16 | PVC-U | 110 | 16 | 8,1 | 93,8 | 13,6 | — | — | — | — | — | karsilik-yok |
| pvc-125-pn16 | PVC-U | 125 | 16 | 9,2 | 106,6 | 13,6 | — | — | — | — | — | karsilik-yok |
| pvc-140-pn16 | PVC-U | 140 | 16 | 10,3 | 119,4 | 13,6 | — | — | — | — | — | karsilik-yok |
| pvc-160-pn16 | PVC-U | 160 | 16 | 11,8 | 136,4 | 13,6 | — | — | — | — | — | karsilik-yok |
| pvc-200-pn16 | PVC-U | 200 | 16 | 14,7 | 170,6 | 13,6 | — | — | — | — | — | karsilik-yok |
| pvc-225-pn16 | PVC-U | 225 | 16 | 16,6 | 191,8 | 13,6 | — | — | — | — | — | karsilik-yok |
| pvc-250-pn16 | PVC-U | 250 | 16 | 18,4 | 213,2 | 13,6 | — | — | — | — | — | karsilik-yok |
| pvc-315-pn16 | PVC-U | 315 | 16 | 23,2 | 268,6 | 13,6 | — | — | — | — | — | karsilik-yok |

## Notlar

- **PVC-U (33 kayıt):** EN ISO 1452-2 tablolarını içeren iki bağımsız üretici kataloğuna bu çalışmada
  erişilemedi; doğrulanmış karşılık yok. `docs/mh-pn-plan.md` §1.1'deki SDR/PN bulgusu (bütün çaplarda
  SDR ≈ 33/21/13,6 serisi; C = 2,0/2,5 sorusu) **açık** kalır.
- **PE100 PN6 (SDR26):** Pipelife tablosuyla karşılaştırılabildi (tek kaynak); etkin kütüphaneye alınmadı.
- Kütüphane iç çapı `od − 2 × en küçük et` ile hesaplanır (eski katalogla aynı yöntem). Pipelife
  kataloğu hidrolik tasarım için `1,07 × en küçük et` önerir; bu, ayrı karar konusudur (PN-3).

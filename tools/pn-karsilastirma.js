#!/usr/bin/env node
// PN-1: eski katalog (www/js/catalog-data.js) ile standart tabanlı boru kütüphanesi (www/js/pipes-data.js)
// arasındaki farkları docs/pn-1-karsilastirma.md olarak yazar. Kataloğu DEĞİŞTİRMEZ.
// Kullanım: node tools/pn-karsilastirma.js
const fs = require('fs'), path = require('path');
const CAT = require('../www/js/catalog-data.js');
const P = require('../www/js/pipes.js');
const D = P.veri;
const n = v => v == null ? '—' : String(v).replace('.', ',');
const rows = P.karsilastir(CAT);
const say = d => rows.filter(r => r.durum === d).length;
const ACIK = {
  ayni: 'Et ve iç çap kütüphaneyle aynı',
  fark: 'Kütüphanede karşılığı var, değer farklı',
  'aday-tek-kaynak': 'Karşılık yalnız tek üretici tablosunda — etkin değil, karşılaştırma bilgi amaçlı',
  'aday-celiski': 'Kaynaklar çelişiyor — etkin değil',
  'karsilik-yok': 'Doğrulanmış karşılık yok (kaynak erişilemedi)',
};
let md = `# PN-1 — Eski katalog ile standart tabanlı kütüphane karşılaştırması

Üretim: \`node tools/pn-karsilastirma.js\` (kütüphane tarihi ${D.TARIH}). **Bu rapor hiçbir kaydı değiştirmez.**
Farklar proje sahibinin kararı olmadan düzeltilmez (docs/pn-1-uygulama.md §7); düzeltme ayrı karar,
hesap değişikliği kaydı ve altın kayıt güncellemesi ister.

Eski katalog kayıtları otomatik seçimde kullanılmaya devam eder (\`catalog-data.js\`, değişmedi).

## Özet

| Durum | Anlamı | Kayıt |
|---|---|---|
${Object.keys(ACIK).map(d => `| ${d} | ${ACIK[d]} | ${say(d)} |`).join('\n')}
| **Toplam** | | **${rows.length}** |

## Kayıt kayıt

| Kimlik | Malzeme | Ø (mm) | PN | Eski et (mm) | Eski iç çap (mm) | Eski od/et | Kütüphane SDR | Kütüphane en küçük et (mm) | Kütüphane iç çap (mm) | Δ et | Δ iç çap | Durum |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
${rows.map(r => `| ${r.id} | ${r.malzeme} | ${r.od} | ${n(r.pn)} | ${n(r.etEski)} | ${n(r.icEski)} | ${n(r.sdrEski)} | ${n(r.sdr)} | ${n(r.enMin ?? (r.degerler ? Object.entries(r.degerler).map(([k, v]) => `${k}: ${v}`).join('; ') : null))} | ${n(r.ic)} | ${n(r.dEt)} | ${n(r.dIc)} | ${r.durum} |`).join('\n')}

## Notlar

- **PVC-U (33 kayıt):** EN ISO 1452-2 tablolarını içeren iki bağımsız üretici kataloğuna bu çalışmada
  erişilemedi; doğrulanmış karşılık yok. \`docs/mh-pn-plan.md\` §1.1'deki SDR/PN bulgusu (bütün çaplarda
  SDR ≈ 33/21/13,6 serisi; C = 2,0/2,5 sorusu) **açık** kalır.
- **PE100 PN6 (SDR26):** Pipelife tablosuyla karşılaştırılabildi (tek kaynak); etkin kütüphaneye alınmadı.
- Kütüphane iç çapı \`od − 2 × en küçük et\` ile hesaplanır (eski katalogla aynı yöntem). Pipelife
  kataloğu hidrolik tasarım için \`1,07 × en küçük et\` önerir; bu, ayrı karar konusudur (PN-3).
`;
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'pn-1-karsilastirma.md'), md);
console.log(`docs/pn-1-karsilastirma.md yazıldı: ${rows.length} kayıt (${Object.keys(ACIK).map(d => `${d} ${say(d)}`).join(', ')})`);

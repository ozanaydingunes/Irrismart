#!/usr/bin/env node
// MH-0 — Altın referans kaydı üretimi.
//   node tools/golden.js           → test/golden/kayit/*.json dosyalarını mevcut motorla YENİDEN yazar
//   node tools/golden.js --check   → yalnız karşılaştırır, dosya yazmaz (CI'daki test ile aynı)
//
// Kayıt yeniden yazıldığında parmak izi değişir; `npm test` ancak docs/hesap-degisiklik-kaydi.md
// dosyasına yeni parmak izi ve mühendislik gerekçesi eklendiğinde geçer.
const fs = require('fs'), path = require('path');
const G = require('../test/golden/snapshot.js');
const DIR = path.join(__dirname, '..', 'test', 'golden', 'kayit');

function all() {
  const out = G.scenarios.map(sc => G.snapScenario(sc));
  out.push(G.snapHydroTable());
  return out;
}
// Parmak izi: kayıtların JSON metninin SHA-256 özeti (dosya adı sırasıyla)
function fingerprint(files) { return G.sha(files.map(f => f.name + '\n' + f.text).join('\n')); }
function render(list) { return list.map(o => ({ name: o.id + '.json', text: JSON.stringify(o, null, 1) + '\n' })).sort((a, b) => a.name.localeCompare(b.name)); }

if (require.main === module) {
  const files = render(all());
  if (process.argv.includes('--check')) {
    const cur = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort().map(name => ({ name, text: fs.readFileSync(path.join(DIR, name), 'utf8') }));
    console.log('kayıtlı parmak izi:', fingerprint(cur));
    console.log('hesaplanan       :', fingerprint(files));
  } else {
    fs.mkdirSync(DIR, { recursive: true });
    for (const f of fs.readdirSync(DIR)) if (f.endsWith('.json')) fs.unlinkSync(path.join(DIR, f));
    for (const f of files) fs.writeFileSync(path.join(DIR, f.name), f.text);
    console.log(`${files.length} kayıt yazıldı. Parmak izi: ${fingerprint(files)}`);
    console.log('Bu parmak izini ve gerekçeyi docs/hesap-degisiklik-kaydi.md dosyasına ekleyin.');
  }
}
module.exports = { all, render, fingerprint, DIR };

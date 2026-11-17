// Tüm testleri çalıştırır: node test/run.js
const fs = require('fs'), path = require('path');
const lib = require('./_lib');
for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort()) { lib._cur = f; const before = lib.tests.length; require(path.join(__dirname, f)); lib.tests.slice(before).forEach(t => t.file = f); }
let pass = 0, fail = 0;
(async () => {
  for (const t of lib.tests) {
    try { await t.fn(); pass++; }
    catch (e) { fail++; console.log(`✗ [${t.file}] ${t.name}\n    ${e.message}`); }
  }
  console.log(`\n${pass} test geçti, ${fail} test başarısız (toplam ${lib.tests.length})`);
  process.exit(fail ? 1 : 0);
})();

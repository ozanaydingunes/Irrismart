// MH-0 — Altın referans testleri.
// Mevcut hesap motorunun bütün sayısal sonuçları, Excel sayfaları, hidrolik tablo formülleri,
// pafta ve DXF çıktıları test/golden/kayit/*.json dosyalarında kayıtlıdır. Bu testler, herhangi bir
// değişikliğin bu sonuçları habersizce değiştirmesini engeller.
// Bilinçli bir hesap değişikliğinde: `node tools/golden.js` ile kaydı yenileyin ve yeni parmak izini
// gerekçesiyle birlikte docs/hesap-degisiklik-kaydi.md dosyasına yazın.
const fs = require('fs'), path = require('path');
const { test, ok } = require('./_lib');
const GT = require('../tools/golden.js');

const REL = 1e-9, ABS = 1e-9;  // yalnız kayan nokta yuvarlama farkına izin verilir
function diff(a, b, p, out) {
  if (out.length >= 12) return;
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return;
    if (!(Math.abs(a - b) <= Math.max(ABS, REL * Math.max(Math.abs(a), Math.abs(b))))) out.push(`${p}: kayıt ${b} ≠ şimdi ${a}`);
    return;
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') { if (a !== b) out.push(`${p}: kayıt ${JSON.stringify(b)} ≠ şimdi ${JSON.stringify(a)}`); return; }
  if (Array.isArray(a) !== Array.isArray(b)) { out.push(`${p}: tür değişti`); return; }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (!(k in b)) { out.push(`${p}.${k}: kayıtta yok (yeni alan)`); continue; }
    if (!(k in a)) { out.push(`${p}.${k}: artık üretilmiyor`); continue; }
    diff(a[k], b[k], `${p}.${k}`, out);
  }
}

const now = GT.all();
const files = fs.existsSync(GT.DIR) ? fs.readdirSync(GT.DIR).filter(f => f.endsWith('.json')).sort() : [];

test('Altın kayıt: her senaryonun kaydı mevcut ve fazlası yok', () => {
  ok(files.length > 0, 'test/golden/kayit boş — `node tools/golden.js` ile oluşturun');
  const want = now.map(o => o.id + '.json').sort();
  ok(JSON.stringify(want) === JSON.stringify(files), `senaryo/kayıt uyumsuz: beklenen ${want.join(', ')} | bulunan ${files.join(', ')}`);
});

for (const o of now) {
  test(`Altın kayıt: ${o.id} sonuçları değişmedi`, () => {
    const f = path.join(GT.DIR, o.id + '.json');
    ok(fs.existsSync(f), 'kayıt yok');
    const ref = JSON.parse(fs.readFileSync(f, 'utf8')), cur = JSON.parse(JSON.stringify(o)), out = [];
    diff(cur, ref, o.id, out);
    ok(!out.length, 'hesap sonucu değişti (gerekçesiz değişiklik yapılamaz):\n      ' + out.join('\n      '));
  });
}

test('Altın kayıt: parmak izi hesap değişiklik kaydında belgelenmiş', () => {
  const fp = GT.fingerprint(files.map(name => ({ name, text: fs.readFileSync(path.join(GT.DIR, name), 'utf8') })));
  const log = fs.readFileSync(path.join(__dirname, '..', 'docs', 'hesap-degisiklik-kaydi.md'), 'utf8');
  ok(log.includes(fp), `altın kayıt parmak izi ${fp} docs/hesap-degisiklik-kaydi.md içinde yok — gerekçesiyle ekleyin`);
});

// MH-AKIL-1: Rapor eklemeleri (Excel "Uyarılar" sayfası) hesap değişikliğini gizleyemez. Kayıtlardan bu sayfa
// çıkarıldığında kalan her şey (motor sonuçları, diğer Excel sayfaları, pafta, DXF, hidrolik tablo) MH-0 ilk
// kaydıyla (46f22517…) aynı içeriği vermelidir. Bir hesap değişikliği bilinçli yapılırsa bu değer de
// gerekçesiyle docs/hesap-degisiklik-kaydi.md içinde güncellenir.
const HESAP_IZI = '86ce24bce78bf3d8b28733e6fe9e3f4d19f1b8cf06d46a091ae429595f2b3fa4';
function hesapIzi() {
  return GT.fingerprint(files.map(name => {
    const o = JSON.parse(fs.readFileSync(path.join(GT.DIR, name), 'utf8'));
    if (o.exports && o.exports.excel) delete o.exports.excel['Uyarılar'];
    return { name, text: JSON.stringify(o) };
  }));
}
test('Altın kayıt: hesap bölümü (rapor eklemeleri hariç) MH-0’dan beri değişmedi', () => {
  const fp = hesapIzi(), log = fs.readFileSync(path.join(__dirname, '..', 'docs', 'hesap-degisiklik-kaydi.md'), 'utf8');
  ok(fp === HESAP_IZI, `hesap parmak izi ${fp} ≠ ${HESAP_IZI}: motor sonuçları veya mevcut çıktılar değişti`);
  ok(log.includes(fp), 'hesap parmak izi docs/hesap-degisiklik-kaydi.md içinde yok');
});

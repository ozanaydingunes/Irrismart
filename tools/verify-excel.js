// Hidrolik tablonun Excel/LibreOffice ile bağımsız doğrulaması (CI dışında, LibreOffice gerektirir):
//   node tools/verify-excel.js <çalışma klasörü> [orijinal.xlsm]
// 1) Rastgele girdilerle uygulamanın formüllü Excel'ini üretir (önbellek değeri olmadan) → LibreOffice yeniden hesaplar
// 2) Orijinal .xlsm'in SİSTEM sayfasına aynı girdileri yazar → LibreOffice hesaplar
// 3) Her iki sonucu uygulamanın JS sonuçlarıyla karşılaştırır.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const W = f => path.join(__dirname, '..', 'www', 'js', f);
globalThis.IRRI_PIPELIB = require(W('pipelib.js'));
const HT = require(W('hydro-table.js')), RD = require(W('report-data.js')), XLSX = require('xlsx');
const dir = path.resolve(process.argv[2] || '.'), orig = process.argv[3];
fs.mkdirSync(dir, { recursive: true });
let seed = 7; const R = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = a => a[Math.floor(R() * a.length)];
const fields = Array.from({ length: 6 }, () => ({ crop: 'X', area: +(20 + R() * 800).toFixed(1), et: +(2 + R() * 6).toFixed(2), T: pick([16, 20, 22, 24]), Sr: pick([0.7, 1, 1.4, 3, 5, 6]), Sp: pick([0.3, 0.5, 1, 2.5, 4]),
  nl: pick([1, 2]), q: pick([1, 1.6, 2, 2.3, 4]), Sd: pick([0.2, 0.3, 0.4, 0.5, 1]), shifts: pick([2, 3, 4, 5, 8]), target: pick([20, 30, 38, 50]) }));
const mats = HT.MATERIALS.filter(m => !/LAY-FLAT/.test(m));
const fric = {};
for (const s of ['Shift 1', 'Shift 2', 'Shift 3']) {
  const n = 2 + Math.floor(R() * 8), rows = [];
  for (let i = 0; i < n; i++) { const m = pick(mats); rows.push({ type: pick(HT.TYPES), material: m, pn: pick(HT.pnsOf(m)), L: +(10 + R() * 400).toFixed(1), Q: +(2 + R() * 150).toFixed(1), h1: +(R() * 20).toFixed(2), ...(i === 0 ? { h2: +(R() * 20).toFixed(2), pmin: +(8 + R() * 20).toFixed(1) } : {}) }); }
  fric[s] = rows;
}
const hydro = { fields, fric };
XLSX.writeFile(RD.hydroWorkbook(XLSX, { hydro }, { noCache: true }), path.join(dir, 'app.xlsx'));
const lo = (f, out) => execFileSync('soffice', ['--headless', '--calc', '--convert-to', 'xlsx', '--outdir', out, f], { stdio: 'pipe' });
fs.mkdirSync(path.join(dir, 'lo'), { recursive: true });
lo(path.join(dir, 'app.xlsx'), path.join(dir, 'lo'));
const wb = XLSX.readFile(path.join(dir, 'lo', 'app.xlsx'));
let n = 0, bad = [];
const cmp = (sheet, ref, js, what) => { const c = wb.Sheets[sheet][ref], v = c ? c.v : undefined; n++;
  const ok = (js == null || js === '') ? (v === undefined || v === '' || v === '  ') : (typeof js === 'number' ? (typeof v === 'number' && Math.abs(v - js) <= 1e-9 * Math.max(1, Math.abs(js))) : String(v).trim() === String(js).trim());
  if (!ok) bad.push(`${sheet}!${ref} ${what}: LibreOffice=${v} JS=${js}`); };
const MAP = { n: 12, rate: 13, Qp: 14, Tp: 15, maxShift: 16, totalTime: 18, totalQ: 19, shiftQ: 20, parcels: 22, parcelA: 23, parcelQ: 24, valves: 25, shiftMax: 26, shiftMin: 27 };
fields.forEach((f, j) => { const o = HT.systemField(f), col = XLSX.utils.encode_col(2 + j); for (const [k, r] of Object.entries(MAP)) cmp('SİSTEM', col + r, o[k], k); });
for (const [s, rows] of Object.entries(fric)) {
  const o = HT.friction(rows), sh = 'IRRIFRICT ' + s;
  o.rows.forEach((x, i) => { const r = 3 + i; if (!x.used) return;
    for (const [c, k] of [['I', 'I'], ['J', 'J'], ['K', 'K'], ['L', 'L'], ['M', 'M'], ['N', 'N'], ['O', 'O'], ['P', 'P'], ['Q', 'Qc'], ['R', 'R'], ['S', 'S'], ['T', 'T']]) if (!(i === 0 && (c === 'I' || c === 'J'))) cmp(sh, c + r, x[k], k); });
}
console.log(`Uygulamanın formüllü Excel'i — LibreOffice yeniden hesabı: ${n - bad.length}/${n} hücre aynı`);
bad.slice(0, 15).forEach(b => console.log('  ✗', b));
// Orijinal dosya (SİSTEM sayfası) — python/openpyxl ile girdiler yazılır
if (orig) {
  fs.writeFileSync(path.join(dir, 'fields.json'), JSON.stringify(fields));
  execFileSync('python3', ['-I', '-W', 'ignore', '-c', `
import openpyxl, json, sys
wb = openpyxl.load_workbook(sys.argv[1], keep_vba=True)
ws = wb['SİSTEM']; F = json.load(open(sys.argv[2]))
rows = {'crop':3,'area':4,'et':5,'T':6,'Sr':7,'Sp':8,'nl':9,'q':10,'Sd':11,'shifts':17,'target':21}
for j, f in enumerate(F):
  for k, r in rows.items(): ws.cell(r, 3 + j).value = f[k]
wb.save(sys.argv[3])`, orig, path.join(dir, 'fields.json'), path.join(dir, 'orig_filled.xlsm')]);
  lo(path.join(dir, 'orig_filled.xlsm'), path.join(dir, 'lo'));
  const ow = XLSX.readFile(path.join(dir, 'lo', 'orig_filled.xlsx'));
  let m = 0, ob = [];
  fields.forEach((f, j) => { const o = HT.systemField(f), col = XLSX.utils.encode_col(2 + j);
    for (const [k, r] of Object.entries(MAP)) { const c = ow.Sheets['SİSTEM'][col + r], v = c ? c.v : undefined; m++;
      if (!(typeof v === 'number' && o[k] != null && Math.abs(v - o[k]) <= 1e-9 * Math.max(1, Math.abs(o[k])))) ob.push(`SİSTEM!${col}${r} ${k}: Excel(orijinal, LibreOffice)=${v} JS=${o[k]}`); } });
  console.log(`Orijinal Excel (SİSTEM) — LibreOffice hesabı ile uygulama: ${m - ob.length}/${m} hücre aynı`);
  ob.slice(0, 15).forEach(b => console.log('  ✗', b));
}
process.exit(bad.length ? 1 : 0);

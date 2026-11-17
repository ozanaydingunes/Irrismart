// Excel raporu: sayısal değerler gerçek sayı hücresi olarak kaydedilir
const XLSX = require('xlsx');
const { E, W, test, near, ok } = require('./_lib');
const RD = require(W('report-data.js'));
const proj = { name: 'Test', inp: { crop: 'domates' } };
const inp = { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, srcType: 'kuyu', depth: 40, region: 'akdeniz' };

function roundTrip(r) {
  const buf = XLSX.write(RD.workbook(XLSX, proj, r), { bookType: 'xlsx', type: 'buffer' });
  return XLSX.read(buf, { type: 'buffer', cellNF: true });
}

test('Excel: özet ve hidrolik değerleri sayı hücresi, birim ayrı sütunda', () => {
  const r = E.design(inp), wb = roundTrip(r);
  const ws = wb.Sheets['Özet'], rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const alanRow = rows.findIndex(x => x[0] === 'Alan');
  const cell = ws[XLSX.utils.encode_cell({ r: alanRow, c: 1 })];
  ok(cell.t === 'n', `Alan hücresi sayı değil (${cell.t})`); near(cell.v, 50, 1e-9, 'alan değeri'); ok(rows[alanRow][2] === 'da', 'birim sütunu');
  ok(/0\.00/.test(cell.z || ''), `sayı biçimi yok: ${cell.z}`);
  const h = wb.Sheets['Hidrolik'], hr = XLSX.utils.sheet_to_json(h, { header: 1 });
  const Hrow = hr.findIndex(x => x[0] === 'Gerekli basma yüksekliği (maks.)');
  ok(h[XLSX.utils.encode_cell({ r: Hrow, c: 1 })].t === 'n', 'H sayı değil');
  near(hr[Hrow][1], r.main.sel.Hmax, 1e-9, 'H değeri tam hassasiyetle');
});

test('Excel: malzeme miktar/fiyat/tutar ve aylık program sayısal; formül hesaplanabilir', () => {
  const r = E.design(inp), wb = roundTrip(r);
  const ws = wb.Sheets['Malzeme (fiyatlı)'], rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  ok(rows.length > 1, 'fiyatlı kalem yok');
  for (let i = 1; i < rows.length; i++) for (const c of [2, 4, 5]) ok(ws[XLSX.utils.encode_cell({ r: i, c })].t === 'n', `satır ${i} sütun ${c} sayı değil`);
  const sum = rows.slice(1).filter(x => !/opsiyonel/.test(x[1])).reduce((t, x) => t + x[5], 0);
  near(sum, r.cost.subtotal, 1e-6, 'ara toplam');
  const p = wb.Sheets['Aylık program'];
  ok(p['B2'].t === 'n' && p['D2'].t === 'n' && p['G2'].t === 'n', 'aylık program sayısal değil');
});

test('Excel: fiyatsız kalemler ayrı sayfada; eksik fiyatla toplam sayı olarak yazılmaz', () => {
  const r = E.design(inp), wb = roundTrip(r);
  const u = XLSX.utils.sheet_to_json(wb.Sheets['Malzeme (fiyatsız)'], { header: 1 });
  ok(u.length - 1 === r.bom.filter(b => b.fiyat == null).length, 'fiyatsız kalem sayısı');
  const m = XLSX.utils.sheet_to_json(wb.Sheets['Maliyet'], { header: 1 });
  const t = m.find(x => x[0] === 'TOPLAM MALZEME BEDELİ');
  ok(typeof t[1] === 'string' && /Hesaplanmadı/.test(t[1]), 'eksik fiyatla toplam yazıldı');
});

test('Formüllü Hidrolik Excel: SİSTEM ve IRRIFRICT hücreleri Excel formülü + doğru önbellek değeri taşır', () => {
  require(W('pipelib.js')); const HT = require(W('hydro-table.js'));
  const hydro = { fields: [{ crop: 'ŞEFTALİ', area: 442, et: 4.5, T: 22, Sr: 5, Sp: 2.5, nl: 2, q: 1.6, Sd: 0.5, shifts: 5, target: 38 }], fric: { 'Shift 1': [{ type: 'Submain', material: 'HDPE100 110 mm', pn: 6, L: 100, Q: 45, h1: 0, h2: 0, pmin: 15 }, { type: 'Main', material: 'UPVC 110 mm', pn: 6, L: 300, Q: 45, h1: -2 }] } };
  const buf = XLSX.write(RD.hydroWorkbook(XLSX, { hydro }), { bookType: 'xlsx', type: 'buffer' });
  const wb = XLSX.read(buf, { type: 'buffer', cellFormula: true });
  const s = wb.Sheets['SİSTEM'];
  ok(s.C13.f === 'IFERROR((C12*C10)/(C8*C7),"")' && Math.abs(s.C13.v - 1.28) < 1e-9, 'C13 sulama hızı formülü');
  ok(s.C25.f === 'IFERROR((ROUNDUP(C20/C24,0)),"")' && s.C25.v === 3, 'C25 vana formülü');
  ok(s.C4.v === 442 && !s.C4.f, 'girdi hücresi formülsüz sayı');
  const f = wb.Sheets['IRRIFRICT Shift 1'];
  ok(/^ROUND\(IFERROR\(\(\(1\.131\*10\^12\)/.test(f.N3.f) && f.N3.v === 0.0207, 'N3 Hazen-Williams');
  ok(f.J4.f === 'J3+Q3' && Math.abs(f.J4.v - 15.73) < 1e-9, 'J4 basınç zinciri');
  ok(/INDEX\('ANA BORULAR'/.test(f.L3.f) && f.L3.v === 101.6, 'L3 iç çap arama');
  ok(wb.Sheets['ANA BORULAR'].A2.v === 'UPVC 20 mm' && wb.SheetNames.includes('ANA BORULAR'), 'boru kütüphanesi sayfası');
  near(HT.friction(hydro.fric['Shift 1']).required, f.I23.v, 1e-9, 'gerekli basınç hücresi (I23)');
});

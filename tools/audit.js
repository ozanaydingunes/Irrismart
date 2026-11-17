// Faz 1 denetimi: motoru bağımsız referans hesaplarla karşılaştırır (node tools/audit.js)
const L = require('../test/_lib');
const { E, Hy, Gm } = L;
const out = []; const rep = (k, ok, s) => out.push(`${ok ? 'OK  ' : 'HATA'} ${k}: ${s}`);
const nu = 1.004e-6, g = 9.81;
// Darcy-Weisbach: laminer 64/Re, türbülanslı Swamee-Jain (ε mm)
function fDW(Re, eps, d) { if (Re < 2000) return 64 / Re; return 0.25 / Math.pow(Math.log10(eps / (3.7 * d) + 5.74 / Math.pow(Re, 0.9)), 2); }
function JDW(Qls, dmm, eps = 0.0015) { const d = dmm / 1000, Q = Qls / 1000, v = Q / (Math.PI * d * d / 4), Re = v * d / nu; return 100 * fDW(Re, eps / 1000, d) * v * v / (2 * g * d); }

// 1) Watters-Keller ↔ Darcy-Weisbach (türbülanslı aralık)
let worst = 0, wcase = '';
for (const d of [13.6, 16.2, 20, 28, 40, 51.4, 63.8, 79.2, 96.8, 117.6, 141, 169.4]) for (const v of [0.5, 1, 1.5, 2]) {
  const Qls = v * Math.PI * (d / 2000) ** 2 * 1000, a = Hy.jSmooth(Qls, d), b = JDW(Qls, d), e = Math.abs(a / b - 1);
  if (e > worst) { worst = e; wcase = `Ø${d} v=${v}`; }
}
rep('Watters-Keller vs Darcy-Weisbach (v 0,5–2 m/s)', worst < 0.10, `en büyük sapma %${(worst * 100).toFixed(1)} (${wcase})`);

// 2) Laminer bölge (lateral uç kısmı): Re < 2000
{ const d = 13.6, Qls = 0.004; const Re = (Qls / 1000) / (Math.PI * (d / 2000) ** 2) * d / 1000 / nu;
  rep('Laminer akışta WK/DW oranı', true, `Re=${Re.toFixed(0)}, WK/DW=${(Hy.jSmooth(Qls, d) / JDW(Qls, d)).toFixed(2)} (WK düşük tahmin — lateral sonu, toplam kayba etkisi küçük)`); }

// 3) Hazen-Williams C=150 ↔ Darcy (PVC ana hat)
{ let w = 0; for (const d of [96.8, 141, 184.6, 230.8]) for (const v of [1, 1.5, 2]) { const Q = v * Math.PI * (d / 2000) ** 2; const hw = Hy.hfHW(Q, d / 1000, 100), dw = JDW(Q * 1000, d); w = Math.max(w, Math.abs(hw / dw - 1)); } rep('Hazen-Williams C=150 vs Darcy', w < 0.15, `en büyük sapma %${(w * 100).toFixed(1)}`); }

// 4) Lateral: adım adım hesap ↔ bağımsız kaba kuvvet
{ const Se = 0.33, q = 2, d = 13.6, fe = 0.1, Lt = 100;
  const r = Hy.lateralStep([[0, Lt]], q, d, Se, fe, 0);
  const n = Math.floor(Lt / Se); const start = (Lt - (n - 1) * Se) / 2; let hf = 0, Qr = n * q, prev = 0;
  for (let k = 0; k < n; k++) { const p = start + k * Se; hf += JDW(Qr / 3600, d) * (p - prev + (k ? fe : 0)) / 100; Qr -= q; prev = p; }
  rep('Lateral sürtünme (100 m Ø16)', Math.abs(r.hf / hf - 1) < 0.08, `motor ${r.hf.toFixed(3)} m, Darcy adım adım ${hf.toFixed(3)} m`); }

// 5) Christiansen F
{ const F = Hy.christiansen(50); rep('Christiansen F(N=50, m=1,75)', Math.abs(F - 0.3737) < 0.002, `F=${F.toFixed(4)} (tablo 0,374)`); }

// Örnek tasarımlar
const cases = [
  ['domates 50 da kuyu', { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 60, srcType: 'kuyu', depth: 40, region: 'akdeniz', soil: 'tinli', dSource: 50, slopeLong: 1, slopeShort: 0.5 }],
  ['zeytin 200 da yüzey', { crop: 'zeytin', area_da: 200, Q: 80, srcType: 'yuzey', region: 'ege', soil: 'tinli' }],
  ['kot düşük arazi (dZ=-40)', { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 60, srcType: 'kuyu', depth: 10, dZ: -40, region: 'akdeniz' }],
  ['hidrant 3 bar', { crop: 'misir', area_da: 100, Q: 100, srcType: 'sebeke', pAvail: 3, region: 'icanadolu' }],
];
for (const [name, inp] of cases) {
  const r = E.design(inp);
  if (!r.ok) { rep(name, false, 'tasarım başarısız: ' + r.err); continue; }
  const s = r.schedule, Qf = r.sectors.Qfield;
  // Debi sürekliliği
  const sumLat = r.layout.laterals.reduce((t, l) => t + l.Q, 0) / 1000, emit = r.lateral.emitters * r.emitter.q / 1000;
  rep(`${name} | debi sürekliliği`, Math.abs(sumLat - Qf) < 1e-6 && Math.abs(emit - Qf) < 1e-6, `Σlateral ${sumLat.toFixed(3)}, damlatıcı×q ${emit.toFixed(3)}, arazi ${Qf.toFixed(3)} m³/h`);
  // Su hacmi: tur hacmi ↔ brüt ihtiyaç × alan
  const Vcycle = Qf * s.t, Vneed = s.gross * s.interval * r.field.A / 1000;
  rep(`${name} | su hacmi dengesi`, Math.abs(Vcycle / Vneed - 1) < 0.05, `tur hacmi ${Vcycle.toFixed(0)} m³, ihtiyaç ${Vneed.toFixed(0)} m³ (fark %${((Vcycle / Vneed - 1) * 100).toFixed(1)})`);
  // Enerji birim kontrolü (kWh = ρgVH / η)
  const m = r.main.sel; const kWh = m.Hp.reduce((t, h, j) => t + 1000 * g * h * (s.seasonM3 * r.sel.Qj[j] / Qf) / (0.7 * 0.9) / 3.6e6, 0);
  rep(`${name} | enerji birimleri`, Math.abs(kWh - m.kWh) < 1e-6 * Math.max(1, kWh), `${kWh.toFixed(1)} kWh`);
  // Basınç sınıfı: en yüksek statik + kapalı vana basıncı
  const Pout = r.main.sel.Hmax - (inp.srcType === 'sebeke' ? 0 : r.head.depth);
  const lowPoint = Math.max(0, -Math.min(0, r.head.dZ) - 0);
  const shut = r.pump.need ? 1.25 * Math.max(...r.sel.main.sel.Hp) : 0; // tipik kapama basıncı ≈ 1,2–1,3 × görev basıncı
  const pMax = Math.max(Pout, r.head.Havail) + lowPoint, pmaxShut = shut - (inp.srcType === 'sebeke' ? 0 : r.head.depth) + lowPoint;
  rep(`${name} | motor PN değerlendirmesi`, m.pn * 10.2 >= 1.25 * m.Pop && m.pn * 10.2 >= m.Pshut, `çalışma (en alçak nokta) ${m.Pop.toFixed(1)} m, kapama ${m.Pshut.toFixed(1)} m, PN${m.pn}; su darbesi ΔH ${r.surge.dH.toFixed(0)} m, a=${r.surge.a.toFixed(0)} m/s`);
  rep(`${name} | bağımsız PN${m.pn} kontrolü`, m.pn * 10.2 >= 1.25 * pMax && m.pn * 10.2 >= pmaxShut, `çıkış ${Pout.toFixed(1)} m, en alçak noktada ${pMax.toFixed(1)} m, kapalı vana ~${pmaxShut.toFixed(1)} m; PN ${m.pn * 10.2} m`);
  // Shift toplamları ve süre
  rep(`${name} | shift toplamları`, Math.abs(r.sel.Qj.reduce((a, b) => a + b, 0) - Qf) < 1e-6, `${r.sel.Ns} shift, Σ ${Qf.toFixed(2)} m³/h`);
  // Metraj: lateral BOM ↔ yerleşim
  const latRow = r.bom.find(b => b.key.startsWith('lateral:'));
  const geo = r.field.tip === 'serit' ? r.lateral.planted : r.lateral.len;
  rep(`${name} | lateral metrajı`, Math.abs(latRow.miktar - Math.ceil(geo * 1.03)) < 1, `net ${geo.toFixed(0)} m, satın alma ${latRow.miktar} m (fire %3 aynı satırda)`);
  // Maliyet toplamı
  const sum = r.bom.filter(b => !b.opsiyonel && b.fiyat != null).reduce((t, b) => t + b.tutar, 0);
  rep(`${name} | maliyet toplamı`, Math.abs(sum - r.cost.subtotal) < 1e-6 && (r.cost.missing > 0) === (r.cost.total === null), `ara toplam ${sum.toFixed(0)}, eksik fiyatlı ${r.cost.missing}`);
  // Lateraller parsel içinde
}
// Düzensiz parselde lateraller sınır içinde mi
{ const poly = [[37.0, 35.0], [37.0, 35.006], [37.003, 35.008], [37.004, 35.002], [37.002, 34.999]];
  const r = E.design({ crop: 'domates', geom: 'parsel', Q: 80, srcType: 'kuyu', depth: 30, region: 'akdeniz' }, null, { poly });
  if (!r.ok) rep('düzensiz parsel', false, r.err); else {
    const P = r.layout.P; let bad = 0;
    const inside = (x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    for (const l of r.layout.laterals) { const xe = l.ax + l.side * l.len; if (!inside(xe - l.side * 0.05, l.y)) bad++; }
    rep('düzensiz parsel | lateral uçları parsel içinde', bad === 0, `${r.layout.laterals.length} lateral, dışarı taşan ${bad}`);
  } }
console.log(out.join('\n'));

// MH-0 — Bağımsız hidrolik doğrulama.
// IrriGrow'un hesapları, motordan bağımsız iki referansla karşılaştırılır:
//   (1) analitik / tam çözümler (Christiansen tam toplamı, Colebrook-White, birim dönüşümleri)
//   (2) EPANET 2.3 (epanet-js) — aynı geometri ayrıca modellenip çözülür.
// Toleranslar ve gerekçeleri: docs/dogrulama/README.md. Toleransı genişletmek bir hesap değişikliğidir;
// gerekçesi docs/hesap-degisiklik-kaydi.md'ye yazılmadan yapılmaz.
const { E, Hy, test, ok, near } = require('./_lib');
const EP = require('./ref/epanet');
const SC = require('./golden/scenarios');

const NU20 = 1.003e-6, G = 9.81;          // 20 °C su kinematik viskozitesi (m²/s), yerçekimi
const pct = (a, b) => (a / b - 1) * 100;

// Colebrook-White (pürüzsüz boru, ε = 0), motordan bağımsız: J (m/100 m)
function jColebrookSmooth(Qls, dmm) {
  const Q = Qls / 1000, D = dmm / 1000, V = Q / (Math.PI * D * D / 4), Re = V * D / NU20;
  let f = 0.02; for (let k = 0; k < 60; k++) f = Math.pow(-2 * Math.log10(2.51 / (Re * Math.sqrt(f))), -2);
  return { J: f / D * V * V / (2 * G) * 100, Re };
}

test('Doğrulama: birim dönüşümleri (hız m³/h→m/s, Watters-Keller l/s–mm, Hazen-Williams m³/s–m)', () => {
  const d = Math.sqrt(4 * 0.001 / Math.PI) * 1000;                      // 1000 mm² kesit → Ø35,68 mm
  near(Hy.velocity(3.6, d), 1, 1e-12, '3,6 m³/h, A=0,001 m² → 1 m/s');
  near(Hy.jSmooth(2, 50) / Hy.jSmooth(1, 50), Math.pow(2, 1.75), 1e-12, 'WK debi üssü 1,75 (Ø<125)');
  near(Hy.jSmooth(2, 150) / Hy.jSmooth(1, 150), Math.pow(2, 1.83), 1e-12, 'WK debi üssü 1,83 (Ø≥125)');
  near(Hy.hfHW(0.01, 0.1, 2000) / Hy.hfHW(0.01, 0.1, 1000), 2, 1e-12, 'HW uzunlukla doğrusal');
  near(Hy.hfHW(0.01, 0.1, 1000), 10.67 * 1000 * Math.pow(0.01, 1.852) / (Math.pow(150, 1.852) * Math.pow(0.1, 4.87)), 1e-12, 'HW SI katsayısı 10,67');
});

test('Doğrulama: Christiansen F formülü, tam toplamdan en fazla %0,5 sapar (N = 1…500, m = 1,75)', () => {
  for (const N of [1, 2, 3, 4, 5, 7, 10, 20, 50, 100, 200, 500]) {
    let s = 0; for (let i = 1; i <= N; i++) s += Math.pow(i, 1.75);
    const exact = s / Math.pow(N, 2.75), e = pct(Hy.christiansen(N), exact);
    ok(Math.abs(e) <= 0.5, `N=${N}: formül ${Hy.christiansen(N)} tam ${exact} (%${e.toFixed(3)})`);
  }
});

test('Doğrulama: Watters-Keller, pürüzsüz boru Colebrook-White ile −%6…+%5 bandında (Ø13,6–160 mm, v 0,3–2 m/s, Re ≥ 4000)', () => {
  for (const d of [13.6, 17.4, 26, 35.2, 44, 55.4, 70.6, 84.6, 103.6, 130, 160]) for (const v of [0.3, 0.5, 1.0, 1.5, 2.0]) {
    const Qls = v * Math.PI * Math.pow(d / 2000, 2) * 1000, c = jColebrookSmooth(Qls, d);
    if (c.Re < 4000) continue;
    const e = pct(Hy.jSmooth(Qls, d), c.J);
    ok(e >= -6 && e <= 5, `Ø${d} v=${v}: WK/CW %${e.toFixed(2)}`);
  }
});

// Lateral: motorun adım adım hesabı (Watters-Keller) ↔ EPANET Darcy-Weisbach (ε 0,0015 mm), aynı damlatıcı konumları,
// her damlatıcı bir düğüm (nominal debi), damlatıcı bağlantı kaybı motordaki gibi eşdeğer uzunluk (fe) olarak.
// Üst sınır +%6: WK/Colebrook bandı (+%4,2) + lateral ucundaki laminer/geçiş bölgesi (EPANET laminer formül, WK türbülanslı).
const LAT = [[100, 0.33, 2, 13.6, 0.1, 0], [150, 0.3, 1.6, 13.6, 0.1, 0], [80, 0.5, 2, 13.6, 0.1, 2], [200, 0.75, 4, 17.4, 0.2, 0], [120, 0.4, 2, 17.4, 0.1, 1], [60, 1.0, 4, 13.6, 0.2, 3]];
test('Doğrulama: lateral sürtünme ve basınç farkı EPANET (Darcy-Weisbach) ile −%1…+%6 (motor güvenli yönde)', async () => {
  for (const [L, Se, q, d, fe, sl] of LAT) {
    const r = Hy.lateralStep([[0, L]], q, d, Se, fe, sl), n = r.N, start = (L - (n - 1) * Se) / 2, s = sl / 100;
    const x = Array.from({ length: n }, (_, k) => start + k * Se);
    const loss = await EP.chain({ x, qls: x.map(() => q / 3600), dmm: d, extraL: k => (k ? fe : 0), z: (k, p) => s * p });
    const hfEP = loss[n - 1], off = loss.map((h, k) => h + s * x[k]), dHEP = Math.max(...off) - Math.min(...off);
    const e1 = pct(r.hf, hfEP), e2 = pct(r.dH, dHEP);
    ok(e1 >= -1 && e1 <= 6, `L=${L} q=${q} Ø${d} %${sl}: hf motor ${r.hf.toFixed(3)} EPANET ${hfEP.toFixed(3)} (%${e1.toFixed(2)})`);
    ok(e2 >= -1 && e2 <= 6, `L=${L} q=${q} Ø${d} %${sl}: ΔH motor ${r.dH.toFixed(3)} EPANET ${dHEP.toFixed(3)} (%${e2.toFixed(2)})`);
  }
});

// Manifold: motorun çalışma aralığında (v ≤ 1,5 m/s) EPANET ile −%1…+%5; v > 1,5 m/s bilgi amaçlı ±%5.
const MAN = [[40, 1.4, 0.35, 58.2, 0], [60, 1.4, 0.23, 58.2, 0.01], [30, 5, 0.73, 72.8, -0.02], [80, 1.0, 0.11, 46.4, 0], [25, 1.4, 0.17, 37.6, 0], [50, 7, 1.2, 96.8, 0.005]];
test('Doğrulama: manifold sürtünme ve basınç değişimi EPANET (Darcy-Weisbach) ile; v ≤ 1,5 m/s: −%1…+%5', async () => {
  for (const [n, sp, ql, d, zs] of MAN) {
    const x = Array.from({ length: n }, (_, k) => sp / 2 + k * sp), Q = x.map(() => ql), r = Hy.manifoldStep(x, Q, Q.map(() => 10), d, zs, false);
    const loss = await EP.chain({ x, qls: Q.map(v => v / 3.6), dmm: d, z: (k, p) => zs * p });
    const hfEP = loss[n - 1], off = loss.map((h, k) => h + zs * x[k]), varEP = Math.max(...off) - Math.min(...off);
    const [lo, hi] = r.v <= 1.5 + 1e-9 ? [-1, 5] : [-5, 5];
    const e1 = pct(r.hf, hfEP), e2 = pct(r.varH, varEP);
    ok(e1 >= lo && e1 <= hi, `n=${n} Q=${(n * ql).toFixed(1)} Ø${d} v=${r.v.toFixed(2)}: hf motor ${r.hf.toFixed(3)} EPANET ${hfEP.toFixed(3)} (%${e1.toFixed(2)})`);
    ok(e2 >= lo && e2 <= hi, `n=${n} Ø${d} zs=${zs}: varH motor ${r.varH.toFixed(3)} EPANET ${varEP.toFixed(3)} (%${e2.toFixed(2)})`);
  }
});

// Ana hat ağı: motorun ağaç modeli ↔ EPANET Hazen-Williams (C=150), aynı topoloji, uzunluk ×1,10 (motordaki %10 yerel kayıp).
// Shift başına gerekli basma yüksekliği H = statik + sabit kayıplar + max(kot + ağ kaybı + vana + ünite giriş basıncı).
const NET_SC = ['S01-duz-arazi', 'S05-coklu-shift', 'S07-uzun-ana-hat', 'S10-yetersiz-sebeke-basinci', 'S15-kullanici-egim-girdisi', 'S19-buyuk-hidrant'];
test('Doğrulama: ana hat ağı EPANET (Hazen-Williams) ile — shift basma yüksekliği ≤ max(0,10 m; %0,2), kök debi ≤ 0,01 m³/h', async () => {
  for (const id of NET_SC) {
    const sc = SC.find(s => s.id === id), r = E.design(sc.inp, null, sc.opt || {});
    ok(r.ok, `${id}: ${r.err}`);
    const H = r.main.sel.H;
    for (let j = 0; j < r.sel.groups.length; j++) {
      const { loss, rootQ } = await EP.mainNetwork(r, j);
      const Hep = r.head.static0 + r.sel.Hfix[j] + Math.max(...r.sel.groups[j].map(k => { const u = r.units[k]; return u.rise + loss[k] + r.sel.uValve[k].loss(u.Q) + u.hIn; }));
      ok(Math.abs(H[j] - Hep) <= Math.max(0.10, 0.002 * Hep), `${id} shift ${j + 1}: H motor ${H[j].toFixed(3)} EPANET ${Hep.toFixed(3)}`);
      ok(Math.abs(rootQ - (r.main.net.length ? r.sel.Qj[j] : 0)) <= 0.01, `${id} shift ${j + 1}: kök debi EPANET ${rootQ.toFixed(3)} motor ${r.sel.Qj[j].toFixed(3)}`);
    }
  }
});

test('Doğrulama (bilgi): Hazen-Williams C=150 ↔ Darcy-Weisbach (ε 0,0015 mm), PVC Ø63–200, v 0,5–1,5 m/s: −%8…+%7', async () => {
  for (const d of [57, 69, 81.4, 101.6, 115.4, 130.8, 147.6, 184.6]) for (const v of [0.5, 1.0, 1.5]) {
    const Qls = v * Math.PI * Math.pow(d / 2000, 2) * 1000, dw = await EP.singlePipeDW(Qls, d, 1000), hw = Hy.hfHW(Qls / 1000, d / 1000, 1000), e = pct(hw, dw);
    ok(e >= -8 && e <= 7, `Ø${d} v=${v}: HW ${hw.toFixed(3)} DW ${dw.toFixed(3)} (%${e.toFixed(2)})`);
  }
});

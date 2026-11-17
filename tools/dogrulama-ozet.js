#!/usr/bin/env node
// MH-0 — Bağımsız doğrulamada ölçülen farkların özeti (docs/dogrulama/README.md tablosu bu çıktıdan alınır).
//   node tools/dogrulama-ozet.js
const path = require('path');
const lib = require('../test/_lib');
const { E, Hy } = lib;
const EP = require('../test/ref/epanet');
const SC = require('../test/golden/scenarios');
const pct = (a, b) => (a / b - 1) * 100;
const rng = a => `${Math.min(...a).toFixed(2)} … ${Math.max(...a).toFixed(2)}`;
(async () => {
  const chr = [1, 2, 3, 4, 5, 7, 10, 20, 50, 100, 200, 500].map(N => { let s = 0; for (let i = 1; i <= N; i++) s += Math.pow(i, 1.75); return pct(Hy.christiansen(N), s / Math.pow(N, 2.75)); });
  console.log('Christiansen formül / tam toplam − 1, %:', rng(chr));
  const NU = 1.003e-6, wk = [];
  for (const d of [13.6, 17.4, 26, 35.2, 44, 55.4, 70.6, 84.6, 103.6, 130, 160]) for (const v of [0.3, 0.5, 1.0, 1.5, 2.0]) {
    const Q = v * Math.PI * Math.pow(d / 2000, 2), D = d / 1000, Re = v * D / NU; if (Re < 4000) continue;
    let f = 0.02; for (let k = 0; k < 60; k++) f = Math.pow(-2 * Math.log10(2.51 / (Re * Math.sqrt(f))), -2);
    wk.push(pct(Hy.jSmooth(Q * 1000, d), f / D * v * v / 19.62 * 100));
  }
  console.log('Watters-Keller / Colebrook-White (pürüzsüz) − 1, %:', rng(wk));
  const lat = [];
  for (const [L, Se, q, d, fe, sl] of [[100, 0.33, 2, 13.6, 0.1, 0], [150, 0.3, 1.6, 13.6, 0.1, 0], [80, 0.5, 2, 13.6, 0.1, 2], [200, 0.75, 4, 17.4, 0.2, 0], [120, 0.4, 2, 17.4, 0.1, 1], [60, 1.0, 4, 13.6, 0.2, 3]]) {
    const r = Hy.lateralStep([[0, L]], q, d, Se, fe, sl), n = r.N, st = (L - (n - 1) * Se) / 2, s = sl / 100, x = Array.from({ length: n }, (_, k) => st + k * Se);
    const loss = await EP.chain({ x, qls: x.map(() => q / 3600), dmm: d, extraL: k => (k ? fe : 0), z: (k, p) => s * p });
    lat.push(pct(r.hf, loss[n - 1]));
  }
  console.log('Lateral hf motor / EPANET-DW − 1, %:', rng(lat));
  const man = [], manHi = [];
  for (const [n, sp, ql, d, zs] of [[40, 1.4, 0.35, 58.2, 0], [60, 1.4, 0.23, 58.2, 0.01], [30, 5, 0.73, 72.8, -0.02], [80, 1.0, 0.11, 46.4, 0], [25, 1.4, 0.17, 37.6, 0], [50, 7, 1.2, 96.8, 0.005]]) {
    const x = Array.from({ length: n }, (_, k) => sp / 2 + k * sp), Q = x.map(() => ql), r = Hy.manifoldStep(x, Q, Q.map(() => 10), d, zs, false);
    const loss = await EP.chain({ x, qls: Q.map(v => v / 3.6), dmm: d, z: (k, p) => zs * p });
    (r.v <= 1.5 ? man : manHi).push(pct(r.hf, loss[n - 1]));
  }
  console.log('Manifold hf motor / EPANET-DW − 1, % (v ≤ 1,5):', rng(man), '| (v > 1,5):', rng(manHi));
  let dH = 0, dHp = 0, dQ = 0, nS = 0;
  for (const id of ['S01-duz-arazi', 'S05-coklu-shift', 'S07-uzun-ana-hat', 'S10-yetersiz-sebeke-basinci', 'S15-kullanici-egim-girdisi', 'S19-buyuk-hidrant']) {
    const sc = SC.find(s => s.id === id), r = E.design(sc.inp, null, sc.opt || {});
    for (let j = 0; j < r.sel.groups.length; j++) {
      const { loss, rootQ } = await EP.mainNetwork(r, j); nS++;
      const Hep = r.head.static0 + r.sel.Hfix[j] + Math.max(...r.sel.groups[j].map(k => { const u = r.units[k]; return u.rise + loss[k] + r.sel.uValve[k].loss(u.Q) + u.hIn; }));
      dH = Math.max(dH, Math.abs(r.main.sel.H[j] - Hep)); dHp = Math.max(dHp, Math.abs(pct(r.main.sel.H[j], Hep))); dQ = Math.max(dQ, Math.abs(rootQ - r.sel.Qj[j]));
    }
  }
  console.log(`Ana hat ağı (${nS} shift): en büyük |ΔH| ${dH.toFixed(4)} m (%${dHp.toFixed(3)}), en büyük |ΔQ kök| ${dQ.toFixed(5)} m³/h`);
  const hw = [];
  for (const d of [57, 69, 81.4, 101.6, 115.4, 130.8, 147.6, 184.6]) for (const v of [0.5, 1.0, 1.5]) { const Qls = v * Math.PI * Math.pow(d / 2000, 2) * 1000; hw.push(pct(Hy.hfHW(Qls / 1000, d / 1000, 1000), await EP.singlePipeDW(Qls, d, 1000))); }
  console.log('Hazen-Williams C=150 / Darcy-Weisbach (ε 0,0015 mm) − 1, %:', rng(hw));
})();

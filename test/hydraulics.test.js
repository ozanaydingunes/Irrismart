// Hidrolik bağıntıların bağımsız referanslarla doğrulanması
const { Hy, test, near, rel, ok } = require('./_lib');
const g = 9.81, nu = 1.004e-6; // 20 °C su kinematik viskozitesi (m²/s)

// Bağımsız referans: Darcy-Weisbach
function dwBlasius(Qm3h, dmm) { // düz boru, Blasius f = 0,3164·Re^-0,25 — m/100 m
  const D = dmm / 1000, v = Qm3h / 3600 / (Math.PI * D * D / 4), Re = v * D / nu;
  return { j: 0.3164 * Math.pow(Re, -0.25) / D * v * v / (2 * g) * 100, Re };
}
function dwSwameeJain(Qm3h, dmm, eps = 0.0015e-3) { // m/100 m
  const D = dmm / 1000, v = Qm3h / 3600 / (Math.PI * D * D / 4), Re = v * D / nu;
  const f = 0.25 / Math.pow(Math.log10(eps / (3.7 * D) + 5.74 / Math.pow(Re, 0.9)), 2);
  return f / D * v * v / (2 * g) * 100;
}

test('Watters-Keller, Blasius Darcy-Weisbach ile ±%6 uyumlu (D<125 mm, 4000<Re<1e5)', () => {
  let n = 0;
  for (const d of [13.8, 17.4, 28, 44, 55.4, 79.2, 96.8]) for (let v = 0.2; v <= 2.0; v += 0.15) {
    const Q = v * Math.PI * Math.pow(d / 1000, 2) / 4 * 3600, ref = dwBlasius(Q, d);
    if (ref.Re < 4000 || ref.Re > 1e5) continue;
    rel(Hy.jSmooth(Q / 3.6, d), ref.j, 0.06, `d=${d} v=${v.toFixed(2)}`); n++;
  }
  ok(n > 30, 'yeterli nokta test edilmedi');
});

test('Hazen-Williams C=150, Darcy-Weisbach (Swamee-Jain, PVC) ile ±%20 uyumlu', () => {
  for (const d of [59.2, 84.6, 103.6, 150.6, 188.2, 296.6]) for (const v of [0.5, 1.0, 1.5, 2.0]) {
    const Q = v * Math.PI * Math.pow(d / 1000, 2) / 4 * 3600;
    const hw = Hy.hfHW(Q / 3600, d / 1000, 100), dw = dwSwameeJain(Q, d);
    rel(hw, dw, 0.20, `d=${d} v=${v}`);
  }
});

test('Hazen-Williams elle hesap: 50 m³/h, Ø103,6 mm, 100 m → 2,257 m', () => near(Hy.hfHW(50 / 3600, 0.1036, 100), 2.2566, 0.002, 'hf'));

test('Christiansen F formülü, kesin toplam Σi^m / N^(m+1) ile |fark| < 0,003 (N=1…300)', () => {
  const m = 1.75;
  for (let N = 1; N <= 300; N++) {
    let s = 0; for (let i = 1; i <= N; i++) s += Math.pow(i, m);
    near(Hy.christiansen(N, m), s / Math.pow(N, m + 1), 0.003, `N=${N}`);
  }
});

test('Adım adım lateral = Christiansen lateral (düzgün lateral, ±%3)', () => {
  for (const [L, Se, q, d] of [[40, 0.33, 2, 13.8], [77, 0.33, 2, 17.4], [150, 1.5, 4, 17.4], [20, 0.2, 1.6, 13.8]]) {
    const a = Hy.lateralCalc(L, Se, q, d, 0, 0.1), b = Hy.lateralStep([[0, L]], q, d, Se, 0.1, 0);
    ok(a.N === b.N, `N farklı ${a.N} ${b.N}`);
    rel(b.hf, a.hf, 0.03, `L=${L}`);
  }
});

// Bağımsız lateral simülasyonu: damlatıcı denklemi q = k·h^x ile basınç-debi etkileşimi (sabit nokta iterasyonu)
function simulate(L, Se, qn, hNom, x, d, fe, slope, hIn) {
  const N = Math.floor(L / Se + 1e-9), k = qn / Math.pow(hNom, x), pos = [];
  const start = (L - (N - 1) * Se) / 2; for (let i = 0; i < N; i++) pos.push(start + i * Se);
  let q = new Array(N).fill(qn), h = new Array(N).fill(hNom);
  for (let it = 0; it < 200; it++) {
    let Qrem = q.reduce((a, b) => a + b, 0), hp = hIn, prev = 0;
    for (let i = 0; i < N; i++) {
      const D = Math.PI * Math.pow(d / 1000, 2) / 4, v = Qrem / 3.6e6 / D, Re = v * d / 1000 / nu;
      const f = Re < 2000 ? 64 / Math.max(Re, 1) : 0.3164 * Math.pow(Re, -0.25);
      hp -= f / (d / 1000) * v * v / (2 * g) * ((pos[i] - prev) + (i ? fe : 0)) + slope / 100 * (pos[i] - prev);
      h[i] = hp; Qrem -= q[i]; prev = pos[i];
    }
    const qn2 = h.map(hh => k * Math.pow(Math.max(hh, 0), x));
    const diff = Math.max(...qn2.map((v, i) => Math.abs(v - q[i]))); q = qn2; if (diff < 1e-7) break;
  }
  const mean = q.reduce((a, b) => a + b, 0) / N;
  return { qmin: Math.min(...q), qmax: Math.max(...q), mean };
}

test('Tasarlanan en uzun lateralde gerçek debi farkı ≤ %10, ortalama debi nominale ±%3 (bağımsız simülasyon)', () => {
  for (const [q, d, slope] of [[2, 13.8, 0], [2, 13.8, 1], [2, 17.4, 2], [1.6, 13.8, 0.5], [4, 17.4, 0]]) {
    const hNom = 10, x = 0.5, Se = 0.33, fe = 0.1, allow = hNom * (1 - Math.pow(0.9, 1 / x)) * 0.55;
    const Lmax = Hy.lateralMax(Se, q, d, slope, fe, allow);
    const st = Hy.lateralStep([[0, Lmax]], q, d, Se, fe, slope);
    const hIn = hNom + st.meanOff;
    const s = simulate(Lmax, Se, q, hNom, x, d, fe, slope, hIn);
    ok(s.qmin / s.qmax >= 0.90, `q=${q} d=${d} eğim=${slope}: qmin/qmax=${(s.qmin / s.qmax).toFixed(3)}`);
    rel(s.mean, q, 0.03, `q=${q} d=${d} eğim=${slope} ortalama debi`);
  }
});

test('Adım adım manifold (eşit çıkışlar, ilk çıkış yarım aralıkta) = düzeltilmiş Christiansen F_a ile ±%3', () => {
  for (const [N, sp, Qo, d] of [[20, 1.4, 0.48, 79.2], [60, 1.4, 0.3, 96.8], [8, 6, 0.4, 44]]) {
    const dist = [], Q = [], hr = [];
    for (let i = 0; i < N; i++) { dist.push(sp / 2 + i * sp); Q.push(Qo); hr.push(10); }
    const r = Hy.manifoldStep(dist, Q, hr, d, 0, false);
    const Lc = sp / 2 + (N - 1) * sp;
    const Fa = (N * Hy.christiansen(N) - 0.5) / (N - 0.5); // a = 0,5 (Keller & Bliesner)
    const ref = Hy.jSmooth(N * Qo / 3.6, d) * Lc / 100 * Fa;
    rel(r.hf, ref, 0.03, `N=${N}`);
    ok(Math.abs(r.Q - N * Qo) < 1e-9, 'kütle dengesi');
  }
});

test('Manifold: eğim aşağı yönlü olunca basınç farkı azalır, yukarı yönlü olunca artar', () => {
  const dist = [], Q = [], hr = []; for (let i = 0; i < 30; i++) { dist.push(0.7 + i * 1.4); Q.push(0.5); hr.push(10); }
  const flat = Hy.manifoldStep(dist, Q, hr, 66, 0, false), up = Hy.manifoldStep(dist, Q, hr, 66, 0.01, false), dn = Hy.manifoldStep(dist, Q, hr, 66, -0.005, false);
  ok(up.varH > flat.varH && dn.varH < flat.varH, `${up.varH} ${flat.varH} ${dn.varH}`);
});

test('Monotonluk: çap ↑ → kayıp ↓; debi ↑ → kayıp ↑; eğim ↑ → maks. lateral ↓', () => {
  let prev = Infinity; for (const d of [13.8, 17.4, 28, 44, 79.2]) { const j = Hy.jSmooth(1, d); ok(j < prev, 'çap'); prev = j; }
  prev = 0; for (const Q of [0.1, 0.5, 1, 2, 5]) { const j = Hy.jSmooth(Q, 44); ok(j > prev, 'debi'); prev = j; }
  prev = Infinity; for (const s of [0, 0.5, 1, 2, 3]) { const L = Hy.lateralMax(0.33, 2, 13.8, s, 0.1, 1.04); ok(L <= prev, 'eğim'); prev = L; }
});

test('Hız ve birim dönüşümleri', () => {
  near(Hy.velocity(36, 100), 1.2732, 1e-4, 'v');
  near(Hy.velocity(3600 * Math.PI * 0.25 * 0.01, 100), 1, 1e-9, 'v=1');
  near(9.81 * (36 / 3600) * 50, 4.905, 1e-9, 'hidrolik güç (kW) ρgQH');
});

test('Sıfır/negatif debi ve çap güvenli: kayıp 0, NaN yok', () => {
  for (const [Q, d] of [[0, 20], [-1, 20], [1, 0], [NaN, 20]]) ok(Hy.jSmooth(Q, d) === 0, `${Q},${d}`);
  ok(Hy.hfHW(0, 0.1, 100) === 0 && Hy.hfHW(0.01, 0, 100) === 0, 'HW');
  ok(Hy.lateralStep([[0, 0.01]], 2, 13.8, 0.33, 0.1, 0) === null, 'boş lateral null olmalı');
});

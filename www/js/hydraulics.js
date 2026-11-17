// IrriGrow — temel hidrolik bağıntılar
// Watters-Keller düz plastik boru (Keller & Bliesner 1990), Hazen-Williams, Christiansen F.
(function (g) {
  // Sürtünme eğimi, m/100 m. Q: l/s, d: mm
  function jSmooth(Qls, dmm) {
    if (!(Qls > 0) || !(dmm > 0)) return 0;
    return dmm < 125 ? 7.89e7 * Math.pow(Qls, 1.75) / Math.pow(dmm, 4.75)
      : 9.58e7 * Math.pow(Qls, 1.83) / Math.pow(dmm, 4.83);
  }
  // Hazen-Williams kayıp (m). Q: m³/s, d: m, L: m
  function hfHW(Qm3s, dm, L, C = 150) {
    if (!(Qm3s > 0) || !(dm > 0) || !(L > 0)) return 0;
    return 10.67 * L * Math.pow(Qm3s, 1.852) / (Math.pow(C, 1.852) * Math.pow(dm, 4.87));
  }
  // Christiansen çoklu çıkış faktörü (ilk çıkış tam aralıkta)
  function christiansen(N, m = 1.75) {
    if (N <= 1) return 1;
    return 1 / (m + 1) + 1 / (2 * N) + Math.sqrt(m - 1) / (6 * N * N);
  }
  function velocity(Qm3h, dmm) { return dmm > 0 ? (Qm3h / 3600) / (Math.PI * Math.pow(dmm / 2000, 2)) : 0; }

  // Düzgün lateral (Christiansen ile), eğim yukarı yönlü en kötü durum
  function lateralCalc(L, Se, q, dmm, slopePct, fe) {
    const N = Math.max(1, Math.floor(L / Se + 1e-9));
    const Qlph = N * q;
    const J = jSmooth(Qlph / 3600, dmm) * (Se + fe) / Se;
    const hf = J * L / 100 * christiansen(N);
    const dz = Math.abs(slopePct) / 100 * L;
    return { N, Qlph, hf, dz, dH: hf + dz, v: velocity(Qlph / 1000, dmm) };
  }
  function lateralMax(Se, q, dmm, slopePct, fe, allow) {
    let best = 0;
    for (let k = 1; k * Se <= 800; k++) { if (lateralCalc(k * Se, Se, q, dmm, slopePct, fe).dH <= allow) best = k * Se; else break; }
    return best;
  }

  // Damlatıcı konumları: her dikili aralık [d1,d2] (girişten uzaklık) içine Se aralıklı, ortalanmış
  function emitterCount(len, Se) { const n = Math.floor(len / Se + 1e-9); return n > 0 ? n : (len >= Se / 2 ? 1 : 0); }

  // Adım adım lateral: aralıklar girişten uzaklık olarak [[d1,d2],...] (artan). Nominal debiyle.
  // off_i = girişten i. damlatıcıya sürtünme + kot (yukarı yönlü en kötü durum).
  function lateralStep(intervals, q, dmm, Se, fe, slopePct) {
    let N = 0; for (const [a, b] of intervals) N += emitterCount(b - a, Se);
    if (!N) return null;
    const s = Math.abs(slopePct) / 100;
    let Qrem = N * q, prev = 0, hf = 0, sum = 0, mx = -Infinity, mn = Infinity, first = true, last = 0;
    for (const [a, b] of intervals) {
      const n = emitterCount(b - a, Se); if (!n) continue;
      const start = a + ((b - a) - (n - 1) * Se) / 2;
      for (let k = 0; k < n; k++) {
        const p = start + k * Se;
        hf += jSmooth(Qrem / 3600, dmm) * ((p - prev) + (first ? 0 : fe)) / 100;
        const off = hf + s * p; sum += off; if (off > mx) mx = off; if (off < mn) mn = off;
        Qrem -= q; prev = p; first = false; last = p;
      }
    }
    return { N, Qlph: N * q, hf, dz: s * last, Lfar: last, meanOff: sum / N, maxOff: mx, minOff: mn, dH: mx - mn, v: velocity(N * q / 1000, dmm) };
  }

  // Adım adım manifold: çıkış uzaklıkları (artan), debiler m³/h, gerekli lateral giriş basınçları (m)
  // zs: manifold boyunca girişten itibaren kot artışı (m/m; + yukarı)
  function manifoldStep(dist, Q, hreq, dmm, zs, pc) {
    let tot = 0; for (const x of Q) tot += x;
    let Qrem = tot, prev = 0, hf = 0, mx = -Infinity, mn = Infinity, wsum = 0, need = -Infinity;
    for (let i = 0; i < dist.length; i++) {
      hf += jSmooth(Qrem / 3.6, dmm) * (dist[i] - prev) / 100;
      const off = hf + zs * dist[i];
      if (off > mx) mx = off; if (off < mn) mn = off;
      wsum += Q[i] * (hreq[i] + off); need = Math.max(need, hreq[i] + off);
      Qrem -= Q[i]; prev = dist[i];
    }
    return { Q: tot, hf, varH: mx - mn, hIn: pc ? need : wsum / tot, hInMax: need, v: velocity(tot, dmm), L: dist.length ? dist[dist.length - 1] : 0 };
  }

  g.IrriHyd = { jSmooth, hfHW, christiansen, velocity, lateralCalc, lateralMax, lateralStep, manifoldStep, emitterCount };
  if (typeof module !== 'undefined') module.exports = g.IrriHyd;
})(typeof window !== 'undefined' ? window : globalThis);

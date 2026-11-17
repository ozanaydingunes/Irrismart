// IrriGrow — parsel (veya dikdörtgen) üzerinde sıra, lateral, manifold ve alt ünite yerleşimi
// Koordinatlar "çerçeve" sistemindedir: sıralar x eksenine paralel, birim metre.
(function (g) {
  const Hy = g.IrriHyd || require('./hydraulics.js');
  const Gm = g.IrriGeom || require('./geom.js');

  // o: { P, Sr, Se, q, fe, latId, Lmax, sLat, allowLat, allowMan, pc, hNom, pcMin, pipes, Qs, Qcap, maxOd, zFn, sMan, header, maxRows }
  // Qcap: alt ünite debisi üst sınırı (shift esnekliği için), maxOd: manifold için tercih edilen en büyük çap
  function buildLayout(o) {
    const bb = Gm.bbox(o.P), Wx = bb.x1 - bb.x0;
    const rowsY = [];
    for (let y = bb.y0 + o.Sr / 2; y < bb.y1 - 1e-9; y += o.Sr) rowsY.push(y);
    if (!rowsY.length) return { error: 'Parsel, bir sıra aralığından dar; sıra arası veya sınırı kontrol edin.' };
    if (rowsY.length > (o.maxRows || 20000)) return { error: `Sıra sayısı çok fazla (${rowsY.length}). Alanı parçalara bölün.` };
    const segs = rowsY.map(y => Gm.rowSegments(o.P, y));

    let nB = Math.max(1, Math.ceil(Wx / (2 * o.Lmax) - 1e-9), Number.isInteger(o.nBmin) ? o.nBmin : 0), L = null;
    for (let attempt = 0; attempt < 8; attempt++, nB++) {
      L = lateralsFor(o, bb, rowsY, segs, nB);
      if (L.maxDH <= o.allowLat * 1.0001) break;
    }
    if (L.maxDH > o.allowLat * 1.0001) return { error: 'Lateral basınç farkı sınır içinde tutulamadı; lateral çapını büyütün veya PC damlatıcı seçin.' };
    if (!L.laterals.length) return { error: 'Parsel içinde lateral oluşturulamadı (alan sıra aralığına göre çok küçük).' };

    // Alt üniteler: her bantta manifold, başlık tarafından içeri doğru, ardışık sıralar
    const top = o.header !== 'bottom';
    const units = [];
    for (let b = 0; b < nB; b++) {
      const rows = L.outlets.filter(r => r.band === b).sort((p, q) => top ? q.y - p.y : p.y - q.y);
      if (!rows.length) continue;
      const ax = L.bands[b].ax;
      const feas = (a, e, k0) => groupCheck(o, rows, a, e, ax, top, k0);
      if (!feas(0, 0)) return { error: 'Tek bir sıranın debisi kaynak debisini veya manifold kapasitesini aşıyor. Kaynak debisini kontrol edin ya da lateral boyunu kısaltın.' };
      // açgözlü gruplama → grup sayısı m; sonra debiye göre dengeli bölme
      const greedy = []; let a = 0;
      while (a < rows.length) { let e = a, k0 = 0, c; while (e + 1 < rows.length && (c = feas(a, e + 1, k0))) { e++; k0 = c.k; } greedy.push([a, e]); a = e + 1; }
      let groups = null;
      for (let m = greedy.length; m <= greedy.length + 3 && !groups; m++) groups = balanced(rows, m, feas);
      if (!groups) groups = greedy;
      for (const [s, e] of groups) {
        const c = feas(s, e), rs = rows.slice(s, e + 1);
        const yIn = top ? rs[0].y + o.Sr / 2 : rs[0].y - o.Sr / 2;
        const yEnd = top ? rs[rs.length - 1].y - o.Sr / 2 : rs[rs.length - 1].y + o.Sr / 2;
        units.push({ band: b, ax, rows: rs.length, nLat: rs.reduce((t, r) => t + r.nLat, 0), Q: c.r.Q, Lm: c.r.L, pipe: c.pipe, hf: c.r.hf, varH: c.r.varH, v: c.r.v, hIn: c.r.hIn + 0.3, hInMax: c.r.hInMax + 0.3, hLatMax: Math.max(...rs.map(r => r.hreq)), yIn, yEnd, y0: Math.min(yIn, yEnd), y1: Math.max(yIn, yEnd) });
      }
    }
    return { nB, bands: L.bands, laterals: L.laterals, units, header: top ? 'top' : 'bottom', yHeader: top ? bb.y1 : bb.y0, bb, rowsCount: rowsY.length, stats: L.stats };
  }

  function lateralsFor(o, bb, rowsY, segs, nB) {
    const B = (bb.x1 - bb.x0) / nB, bands = [];
    for (let b = 0; b < nB; b++) bands.push({ x0: bb.x0 + b * B, x1: bb.x0 + (b + 1) * B, ax: bb.x0 + (b + 0.5) * B });
    const laterals = [], outlets = [];
    let maxDH = 0, latLen = 0, planted = 0, emitters = 0, lead = 0, Qfield = 0, maxLen = 0, vMax = 0, hreqMax = 0, hreqMin = Infinity, hfMax = 0;
    rowsY.forEach((y, ri) => {
      const sg = segs[ri]; if (!sg.length) return;
      for (let b = 0; b < nB; b++) {
        const { x0, x1, ax } = bands[b];
        let Qo = 0, hreq = 0, nLat = 0;
        for (const side of [-1, 1]) {
          const iv = [];
          for (const [s1, s2] of sg) {
            const lo = Math.max(s1, side < 0 ? x0 : ax), hi = Math.min(s2, side < 0 ? ax : x1);
            if (hi - lo > 1e-6) iv.push(side < 0 ? [ax - hi, ax - lo] : [lo - ax, hi - ax]);
          }
          if (!iv.length) continue;
          iv.sort((p, q) => p[0] - q[0]);
          const r = Hy.lateralStep(iv, o.q, o.latId, o.Se, o.fe, o.sLat);
          if (!r) continue;
          const len = iv[iv.length - 1][1], pl = iv.reduce((t, [p, q]) => t + q - p, 0);
          const h = o.pc ? o.pcMin + r.maxOff : o.hNom + r.meanOff;
          laterals.push({ y, ax, side, len, lead: iv[0][0], N: r.N, Q: r.Qlph, hf: r.hf, dH: r.dH, hreq: h, row: ri, band: b });
          Qo += r.Qlph / 1000; hreq = Math.max(hreq, h); nLat++;
          maxDH = Math.max(maxDH, r.dH); latLen += len; planted += pl; emitters += r.N; lead += iv[0][0]; maxLen = Math.max(maxLen, len);
          vMax = Math.max(vMax, r.v); hreqMax = Math.max(hreqMax, h); hreqMin = Math.min(hreqMin, h); hfMax = Math.max(hfMax, r.hf);
        }
        if (nLat) { outlets.push({ y, band: b, Q: Qo, hreq, nLat }); Qfield += Qo; }
      }
    });
    return { bands, laterals, outlets, maxDH, stats: { count: laterals.length, latLen, planted, emitters, lead, Qfield, maxLen, vMax, hreqMax, hreqMin, hfMax, maxDH } };
  }

  // a..e sıraları tek manifoldda: debi ≤ kaynak, hız ≤ 1,5 m/s, basınç farkı ≤ izin
  function groupCheck(o, rows, a, e, ax, top, k0 = 0) {
    const rs = rows.slice(a, e + 1);
    let Q = 0; for (const r of rs) Q += r.Q;
    if (Q > (o.Qcap || o.Qs) + 1e-9 && rs.length > 1) return null;
    if (Q > o.Qs + 1e-9) return null;
    const yIn = top ? rs[0].y + o.Sr / 2 : rs[0].y - o.Sr / 2;
    const dist = rs.map(r => Math.abs(r.y - yIn));
    const Lm = dist[dist.length - 1];
    let zs;
    if (o.zFn) { const yEnd = top ? yIn - Lm : yIn + Lm; zs = Lm > 0 ? (o.zFn(ax, yEnd) - o.zFn(ax, yIn)) / Lm : 0; }
    else zs = Math.abs(o.sMan) / 100; // yön bilinmiyor: yukarı yönlü en kötü durum
    const Qs = rs.map(r => r.Q), hr = rs.map(r => r.hreq);
    for (let k = k0; k < o.pipes.length; k++) {
      const pipe = o.pipes[k];
      if (o.maxOd && pipe.od > o.maxOd && rs.length > 1) break;
      const r = Hy.manifoldStep(dist, Qs, hr, pipe.ic, zs, o.pc);
      if (r.v <= 1.5 && r.varH <= o.allowMan + 1e-9) return { pipe, r, zs, k };
    }
    return null;
  }

  // Sıraları m ardışık gruba debiye göre dengeli böl; hepsi uygunsa döndür
  function balanced(rows, m, feas) {
    const tot = rows.reduce((t, r) => t + r.Q, 0), out = [];
    let a = 0, acc = 0;
    for (let k = 1; k <= m; k++) {
      if (a >= rows.length) return null;
      if (k === m) { out.push([a, rows.length - 1]); break; }
      const target = tot * k / m; let e = a; acc += rows[a].Q;
      while (e + 1 < rows.length - (m - k) && acc + rows[e + 1].Q / 2 <= target) { e++; acc += rows[e].Q; }
      out.push([a, e]); a = e + 1;
    }
    return out.every(([s, e]) => feas(s, e)) ? out : null;
  }

  // Ardışık alt üniteleri en çok n shift’e böl: en büyük shift debisini en aza indir
  function partition(Q, n) {
    const greedy = cap => { const gr = []; let cur = [], s = 0; Q.forEach((q, i) => { if (s + q > cap + 1e-9 && cur.length) { gr.push(cur); cur = []; s = 0; } cur.push(i); s += q; }); if (cur.length) gr.push(cur); return gr; };
    let lo = Math.max(...Q), hi = Q.reduce((a, b) => a + b, 0);
    if (greedy(lo).length <= n) return greedy(lo);
    for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; if (greedy(mid).length <= n) hi = mid; else lo = mid; }
    return greedy(hi);
  }
  function minSectors(Q, cap) { let n = 0, s = 0; for (const q of Q) { if (q > cap + 1e-9) return Infinity; if (s + q > cap + 1e-9) { n++; s = 0; } s += q; } return n + (s > 0 ? 1 : 0); }

  g.IrriLayout = { buildLayout, partition, minSectors };
  if (typeof module !== 'undefined') module.exports = g.IrriLayout;
})(typeof window !== 'undefined' ? window : globalThis);

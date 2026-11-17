// IrriGrow — geometri yardımcıları (yerel metrik koordinat, döndürme, kesişim, kırpma)
(function (g) {
  const R = 6371008.8, K = Math.PI / 180;
  function toLocal(latlngs) {
    const lat0 = latlngs.reduce((s, p) => s + p[0], 0) / latlngs.length;
    const lng0 = latlngs.reduce((s, p) => s + p[1], 0) / latlngs.length;
    return { lat0, lng0, pts: latlngs.map(p => [(p[1] - lng0) * K * R * Math.cos(lat0 * K), (p[0] - lat0) * K * R]) };
  }
  function fromLocal(x, y, lat0, lng0) { return [lat0 + y / (K * R), lng0 + x / (K * R * Math.cos(lat0 * K))]; }
  function polyArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; }
  // deg: x eksenini bu açıya getirmek için noktaları -deg döndür (u = x cos + y sin, v = -x sin + y cos)
  function rot(p, deg) { const t = deg * K, c = Math.cos(t), s = Math.sin(t); return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c]; }
  function unrot(p, deg) { const t = deg * K, c = Math.cos(t), s = Math.sin(t); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }
  function minBox(pts) {
    let best = null;
    for (let deg = 0; deg < 180; deg += 0.5) {
      let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
      for (const p of pts) { const [u, v] = rot(p, deg); mnx = Math.min(mnx, u); mxx = Math.max(mxx, u); mny = Math.min(mny, v); mxy = Math.max(mxy, v); }
      const a = (mxx - mnx) * (mxy - mny);
      if (!best || a < best.a - 1e-9) best = { a, deg, len: mxx - mnx, wid: mxy - mny };
    }
    if (best.wid > best.len) { [best.len, best.wid] = [best.wid, best.len]; best.deg = (best.deg + 90) % 180; }
    return best;
  }
  function segX(a, b, c, d) { // kesişiyor mu (uç noktalar hariç)
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  }
  function selfIntersects(pts) {
    const n = pts.length;
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segX(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
    return false;
  }
  function fieldFromPolygon(latlngs) {
    const { pts, lat0, lng0 } = toLocal(latlngs);
    const A = polyArea(pts), box = minBox(pts);
    const L = Math.sqrt(A * box.len / box.wid), W = A / L;
    return { A, L, W, box, fill: A / box.a, selfX: selfIntersects(pts), lat0, lng0 };
  }
  // Yükseklik noktalarına düzlem: z = a + gx·x + gy·y (x doğu, y kuzey, m/m)
  function planeFit(latlngs, elev) {
    const { pts } = toLocal(latlngs); const n = pts.length; if (n < 3) return null;
    let sx = 0, sy = 0, sz = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
    for (let i = 0; i < n; i++) { const [x, y] = pts[i], z = elev[i]; if (!Number.isFinite(z)) return null; sx += x; sy += y; sz += z; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; }
    const mx = sx / n, my = sy / n, mz = sz / n;
    const cxx = sxx / n - mx * mx, cyy = syy / n - my * my, cxy = sxy / n - mx * my, cxz = sxz / n - mx * mz, cyz = syz / n - my * mz;
    const det = cxx * cyy - cxy * cxy; if (Math.abs(det) < 1e-9) return null;
    return { gx: (cxz * cyy - cyz * cxy) / det, gy: (cyz * cxx - cxz * cxy) / det, zmin: Math.min(...elev), zmax: Math.max(...elev) };
  }
  function slopeFromPoints(latlngs, elev, axisDeg) {
    const p = planeFit(latlngs, elev); if (!p) return null;
    const [along, across] = rot([p.gx, p.gy], axisDeg);
    return { total: 100 * Math.hypot(p.gx, p.gy), alongLong: 100 * along, alongShort: 100 * across, gx: p.gx, gy: p.gy, zmin: p.zmin, zmax: p.zmax };
  }
  // Yatay doğru y ile poligon kesişimi → [[x1,x2],...]
  function rowSegments(P, y) {
    const xs = [];
    for (let i = 0, n = P.length; i < n; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % n];
      if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) xs.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
    }
    xs.sort((a, b) => a - b);
    const out = []; for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 1e-6) out.push([xs[i], xs[i + 1]]);
    return out;
  }
  // Sutherland-Hodgman: poligonu eksene paralel dikdörtgenle kırp
  function clipRect(P, x0, x1, y0, y1) {
    const edges = [[p => p[0] >= x0, (a, b) => { const t = (x0 - a[0]) / (b[0] - a[0]); return [x0, a[1] + t * (b[1] - a[1])]; }],
      [p => p[0] <= x1, (a, b) => { const t = (x1 - a[0]) / (b[0] - a[0]); return [x1, a[1] + t * (b[1] - a[1])]; }],
      [p => p[1] >= y0, (a, b) => { const t = (y0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y0]; }],
      [p => p[1] <= y1, (a, b) => { const t = (y1 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y1]; }]];
    let out = P;
    for (const [inside, cut] of edges) {
      const inp = out; out = [];
      for (let i = 0; i < inp.length; i++) {
        const a = inp[i], b = inp[(i + 1) % inp.length];
        if (inside(b)) { if (!inside(a)) out.push(cut(a, b)); out.push(b); } else if (inside(a)) out.push(cut(a, b));
      }
      if (!out.length) break;
    }
    return out;
  }
  function bbox(P) { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const [x, y] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1 }; }

  g.IrriGeom = { toLocal, fromLocal, polyArea, rot, unrot, minBox, selfIntersects, fieldFromPolygon, planeFit, slopeFromPoints, rowSegments, clipRect, bbox };
  if (typeof module !== 'undefined') module.exports = g.IrriGeom;
})(typeof window !== 'undefined' ? window : globalThis);

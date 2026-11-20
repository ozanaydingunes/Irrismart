// IrriGrow — ortak proje çizim modeli. Harita, Teknik Proje (SVG), PDF pafta ve DXF aynı modelden üretilir.
// Model koordinatları: yerel metrik (x doğu, y kuzey, m), başlangıç noktası parselin ağırlık merkezi (lat0, lng0).
(function (g) {
  const req = n => (typeof require !== 'undefined' ? require(n) : null);
  const Gm = g.IrriGeom || req('./geom.js');
  const Hy = g.IrriHyd || req('./hydraulics.js');
  const VER = '1';
  const SHIFT_COL = ['#8fd19e', '#7cc5e8', '#f5c26b', '#e99aa8', '#b8a6e8', '#9fe0d3', '#d9d47a', '#f0a875', '#a3c2f0', '#c9e39a', '#e0b0d5', '#b5d99c'];
  const SHIFT_HEAD = ['#2e8b57', '#1f78b4', '#c98a00', '#c2405a', '#6f4fc2', '#1a9c8a', '#8f8a00', '#c8641e', '#3d6fc4', '#6b9a1f', '#a2479a', '#4f8f2f'];
  const DN = { '1"': 25, '1¼"': 32, '1½"': 40, '2"': 50, '2½"': 65, '3"': 80, '4"': 100, '5"': 125, '6"': 150, '8"': 200, '10"': 250 };
  const pad2 = n => String(n).padStart(2, '0');
  const f = (v, d = 1) => (v == null || !Number.isFinite(+v)) ? '—' : (+v).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });

  // ---------- Model ----------
  // r: motor sonucu; p: proje {name, inp, meta, drawPos, rev}; T: çeviri fonksiyonu
  function build(p, r, opts = {}) {
    const T = opts.t || (x => x);
    const Ly = r.layout, ang = Ly.angle;
    const E = q => Gm.unrot(q, ang);                     // çerçeve → yerel ENU
    const geo = Ly.mode === 'parsel' && Number.isFinite(Ly.lat0);
    const toLL = q => geo ? Gm.fromLocal(q[0], q[1], Ly.lat0, Ly.lng0) : null;
    function localOf(ll) { const K = Math.PI / 180, R = 6371008.8; return [(ll[1] - Ly.lng0) * K * R * Math.cos(Ly.lat0 * K), (ll[0] - Ly.lat0) * K * R]; }
    const pos = (key, def) => { const o = p.drawPos && p.drawPos[key]; if (!o) return def; if (o.xy) return o.xy; return geo && Array.isArray(o) ? localOf(o) : def; };
    const secOf = []; r.sel.groups.forEach((gr, j) => gr.forEach(k => { secOf[k] = j; }));
    const s = r.schedule, m = r.main.sel;

    const parcel = Ly.P.map(E);
    // Alt ünite alanları ve shift'ler
    const units = r.units.map((u, k) => {
      const b = Ly.bands[u.band];
      const poly = Gm.clipRect(Ly.P, b.x0, b.x1, u.y0, u.y1).map(E);
      const uv = r.sel.uValve ? r.sel.uValve[k] : r.valve;
      return { k, code: 'MF-' + pad2(k + 1), shift: secOf[k], poly, a: E([u.ax, u.yIn]), b: E([u.ax, u.yEnd]), od: u.pipe.od, pn: u.pipe.pn, ic: u.pipe.ic, mat: u.pipe.malzeme || 'PE100',
        L: Math.abs(u.yEnd - u.yIn), Q: u.Q, v: u.v, hf: u.hf, varH: u.varH, hIn: u.hIn, nLat: u.nLat, valve: uv && uv.v ? uv.v : null };
    });
    const A_tot = r.sectors.Qfield;
    const shifts = r.sel.groups.map((gr, j) => {
      const A = gr.reduce((x, k) => x + r.units[k].Q, 0) / A_tot * r.field.da;
      const big = gr.reduce((a, b) => (polyArea(units[b].poly) > polyArea(units[a].poly) ? b : a), gr[0]);
      const c = centroid(units[big].poly.length >= 3 ? units[big].poly : [units[big].a, units[big].b]);
      // kutuyu manifold hattından yana kaydır (boru etiketini kapatmasın)
      const U = units[big], dir = norm(sub(U.b, U.a)), nrm = [-dir[1], dir[0]];
      const w = polyWidth(U.poly, nrm);
      const def = add(c, mul(nrm, Math.min(w * 0.25, 40)));
      return { j, no: j + 1, units: gr.slice(), A, Q: r.sel.Qj[j], t: s.t, H: m.H[j], Hp: m.Hp[j], color: SHIFT_COL[j % SHIFT_COL.length], head: SHIFT_HEAD[j % SHIFT_HEAD.length],
        box: pos('S' + (j + 1), def), boxDef: def, userPos: !!(p.drawPos && p.drawPos['S' + (j + 1)]), field: 1, parcelNo: 1 };
    });
    // Lateraller (yerel ENU)
    const laterals = Ly.laterals.map(l => [E([l.ax, l.y]), E([l.ax + l.side * l.len, l.y])]);
    // Ana hat segmentleri
    const main = r.main.net.map(sg => ({ ...(sg.pipe && sg.pipe.kutuphane ? { mat: sg.pipe.malzeme, sdr: sg.pipe.sdr } : {}), id: sg.id, kind: sg.kind, a: E(sg.a), b: E(sg.b), L: sg.L, od: sg.od, pn: sg.pn, ic: sg.ic, Qmax: sg.Qmax, v: sg.v, hf: sg.hf, parent: sg.parent, virtual: sg.kind === 'kaynak' }));
    // Bağlantı elemanları: redüksiyon (çap değişimi), te (kol ayrımı), dirsek (güzergâh kırılması)
    const fittings = [];
    main.forEach((sg, i) => {
      if (sg.virtual) return;
      const pa = sg.parent >= 0 ? main[sg.parent] : null;
      if (pa && pa.od > sg.od) fittings.push({ type: 'reduksiyon', at: sg.a, text: `Ø${pa.od}×Ø${sg.od}`, dir: norm(sub(sg.b, sg.a)) });
      const kids = main.filter(o => o.parent === i);
      if (kids.length >= 2) fittings.push({ type: 'te', at: sg.b });
      else if (kids.length === 1 && !pa?.virtual) { const d1 = norm(sub(sg.b, sg.a)), d2 = norm(sub(kids[0].b, kids[0].a)); if (Math.abs(d1[0] * d2[0] + d1[1] * d2[1]) < 0.97 && kids[0].od === sg.od) fittings.push({ type: 'dirsek', at: sg.b }); }
    });
    // Ekipman: kaynak, pompa, istasyon (filtre, gübreleme, kontrol, ana vana, çekvalf), shift vanaları, hava, yıkama, regülatör
    const srcPt = Ly.route ? E(Ly.route[0]) : E(Ly.src);
    const stPt = Ly.route && p.station ? (localOf(p.station) || srcPt) : srcPt;
    const eq = [];
    const addEq = (code, type, at, text, extra) => eq.push(Object.assign({ code, type, at: pos(code, at), atDef: at, text }, extra || {}));
    const srcAd = { kuyu: 'Kuyu', yuzey: 'Yüzey suyu', sebeke: 'Şebeke / hidrant' }[(p.inp || {}).srcType || 'kuyu'] || 'Su kaynağı';
    addEq('K-01', 'kaynak', srcPt, `K-01 — ${T(srcAd)}`);
    if (r.pump.need) addEq('P-01', 'pompa', srcPt, `P-01 — ${T('Pompa')} — ${f(r.pump.Q, 1)} m³/h — ${f(r.pump.H, 1)} mSS${r.pump.motor ? ' — ' + f(r.pump.motor, 1) + ' kW' : ''}`, { offset: 1 });
    let fi = 0;
    (r.filter.items || []).forEach(({ f: ft, n }) => { for (let q = 0; q < n; q++) { fi++; addEq('F-' + pad2(fi), 'filtre', stPt, `F-${pad2(fi)} — ${T(ft.ad)} — ${f(ft.qMax, 0)} m³/h`, { offset: 1 + fi }); } });
    addEq('G-01', 'gubre', stPt, `G-01 — ${T('Gübreleme ünitesi')}`, { offset: 2 + fi });
    addEq('KI-01', 'kontrol', stPt, `KI-01 — ${T('Kontrol istasyonu')}`, { offset: 3 + fi });
    addEq('CV-01', 'cekvalf', stPt, `CV-01 — ${T('Çekvalf')} Ø${m.od}`, { offset: 4 + fi });
    addEq('ANV-01', 'kesme', stPt, `ANV-01 — ${T('Ana kesme vanası')} Ø${m.od}`, { offset: 5 + fi });
    units.forEach(u => {
      const dn = u.valve ? (DN[u.valve.cap] || null) : null;
      addEq('V-' + pad2(u.k + 1), 'shiftvana', u.a, `V-${pad2(u.k + 1)} — Shift ${u.shift + 1}${dn ? ' — DN' + dn : ''}`, { shift: u.shift, unit: u.k });
      addEq('HV-' + pad2(u.k + 1), 'hava', u.a, `HV-${pad2(u.k + 1)}`, { unit: u.k, small: true, offset: 1 });
      addEq('YV-' + pad2(u.k + 1), 'yikama', u.b, `YV-${pad2(u.k + 1)}`, { unit: u.k, small: true });
      if (m.surplus && m.surplus[u.shift] > 5) addEq('BR-' + pad2(u.k + 1), 'regulator', u.a, `BR-${pad2(u.k + 1)} — ${T('Basınç regülatörü')}`, { unit: u.k, small: true, offset: 2 });
    });
    // Ana hat sonu yıkama vanası: çocuğu olmayan segment uçları
    let ye = 0; main.forEach((sg, i) => { if (!sg.virtual && !main.some(o => o.parent === i) && sg.kind !== 'guzergah') { ye++; addEq('YA-' + pad2(ye), 'yikama', sg.b, `YA-${pad2(ye)} — ${T('Ana hat sonu yıkama vanası')}`, { small: true }); } });

    const bbox = bboxOf([parcel, main.filter(x => !x.virtual).flatMap(x => [x.a, x.b]), eq.map(e => e.at)].flat());
    return { ver: VER, geo, lat0: Ly.lat0, lng0: Ly.lng0, toLL, localOf: geo ? localOf : null, parcel, units, shifts, laterals, main, fittings, eq, bbox, r, p,
      lateral: { d: r.lateral.d, q: r.emitter.q, Se: r.emitter.Se, pc: r.emitter.pc, tip: r.field.tip } };
  }

  // ---------- geometri yardımcıları ----------
  function pip(P, x, y) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
  function polyArea(P) { let a = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; }
  function centroid(P) { if (P.length < 3) return [(P[0][0] + P[P.length - 1][0]) / 2, (P[0][1] + P[P.length - 1][1]) / 2]; let a = 0, cx = 0, cy = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length], c = x1 * y2 - x2 * y1; a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c; } return Math.abs(a) < 1e-9 ? P[0] : [cx / (3 * a), cy / (3 * a)]; }
  function polyWidth(P, n) { if (!P.length) return 0; const d = P.map(q => q[0] * n[0] + q[1] * n[1]); return Math.max(...d) - Math.min(...d); }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
  const norm = a => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
  function bboxOf(pts) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; }

  // ---------- Etiket metinleri (hesaptan) ----------
  function pipeLabel(sg) { return `${sg.id} ${sg.mat || 'PVC-U'} Ø${sg.od}${sg.sdr ? ` SDR${sg.sdr}` : ''} PN${sg.pn} — ${f(sg.L, 0)} m`; }
  function manLabel(u) { return `${u.code} ${u.mat} Ø${u.od} PN${u.pn} — ${f(u.L, 0)} m`; }
  function latLabel(M) { return `LATERAL Ø${M.lateral.d} — ${f(M.lateral.q, 1)} l/h — ${Math.round(M.lateral.Se * 100)} cm${M.lateral.pc ? ' PC' : ''}`; }
  function shiftLines(M, sh, T) {
    return [[T('Parsel'), String(sh.parcelNo)], [T('Alan'), f(sh.A, 2) + ' da'], [T('Debi'), f(sh.Q, 2) + ' m³/h'], [T('Sulama süresi'), f(sh.t, 2) + ' ' + T('saat')], [T('Gerekli basınç'), f(sh.H, 1) + ' mSS']];
  }

  // ---------- Etiket yerleşimi (çakışma önleme, sayfa/ekran birimlerinde) ----------
  // Yönlü dikdörtgenler (merkez, en, boy, açı) — ayırıcı eksen testi ile çakışma
  function obb(c) { const t = (c.rot || 0) * Math.PI / 180, ux = [Math.cos(t), Math.sin(t)], uy = [-Math.sin(t), Math.cos(t)]; const bb = rotBox(c); return { cx: c.x, cy: c.y, hw: c.w / 2, hh: c.h / 2, ux, uy, bb }; }
  function obbHit(A, B) {
    if (A.bb.x0 >= B.bb.x1 || A.bb.x1 <= B.bb.x0 || A.bb.y0 >= B.bb.y1 || A.bb.y1 <= B.bb.y0) return false;
    const d = [B.cx - A.cx, B.cy - A.cy];
    for (const ax of [A.ux, A.uy, B.ux, B.uy]) {
      const pr = o => o.hw * Math.abs(o.ux[0] * ax[0] + o.ux[1] * ax[1]) + o.hh * Math.abs(o.uy[0] * ax[0] + o.uy[1] * ax[1]);
      if (Math.abs(d[0] * ax[0] + d[1] * ax[1]) >= pr(A) + pr(B)) return false;
    }
    return true;
  }
  function placer() {
    const list = [];
    return {
      block(r) { list.push(r.x0 != null ? obb({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2, w: r.x1 - r.x0, h: r.y1 - r.y0, rot: 0 }) : obb(r)); },
      tryPlace(cands) {
        for (const c of cands) { const o = obb(c); if (!list.some(q => obbHit(o, q))) { list.push(o); return c; } }
        return null;
      },
      list,
    };
  }
  function rotBox({ x, y, w, h, rot = 0 }) { const t = rot * Math.PI / 180, c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t)); const W = (w * c + h * s) / 2, H = (w * s + h * c) / 2; return { x0: x - W, x1: x + W, y0: y - H, y1: y + H }; }
  const textW = (txt, size) => txt.length * size * 0.6;

  // ---------- Pafta ----------
  const PAPER = { A1: [841, 594], A2: [594, 420], A3: [420, 297], A4: [297, 210] };
  const FONT = { A1: 3.0, A2: 2.5, A3: 2.0, A4: 1.6 };
  // Standart ölçekler. 1:5000'den küçükleri (uzak su kaynağı / uzun ana hat) eklenmeden önce, 1:5000'e sığmayan çizim
  // sessizce 1:5000'de bırakılıyor, geometrinin merkezine ortalandığı için parsel kayıyor ve ana hat/kaynak kırpılıyordu.
  const SCALES = [500, 1000, 2000, 4000, 5000, 7500, 10000, 15000, 20000, 25000, 50000];
  // Listedeki ölçekler de yetmezse sığan ilk 1-2-5 dizisi ölçeği (tek paftada çizim asla kırpılmaz)
  const sigdir = (gw, gh, aw, ah) => { const ham = Math.max(gw * 1000 / aw, gh * 1000 / ah); let u = Math.pow(10, Math.floor(Math.log10(ham))); for (;;) { for (const m of [1, 2, 5]) if (m * u >= ham) return m * u; u *= 10; } };

  // Pafta yerleşimi ve ölçek kontrolü
  function sheetLayout(M, o) {
    const [a, b] = PAPER[o.format] || PAPER.A3, land = o.orient !== 'dikey';
    const W = land ? a : b, H = land ? b : a, fs = FONT[o.format] || 2, mg = o.format === 'A4' ? 6 : 10;
    const blocks = panelBlocks(M, o, fs, land ? null : (W - 2 * mg) / 2 - 0.6);
    // Bilgi paneli: yatayda sağda sütun(lar), dikeyde altta satır(lar)
    const frame = { x0: mg, y0: mg, x1: W - mg, y1: H - mg };
    let area, place = [];
    if (land) {
      let colX = frame.x1, colW = 0, y = frame.y1;
      for (const bl of blocks) {
        if (y - bl.h < frame.y0 + 0.5) { colX -= colW; colW = 0; y = frame.y1; }
        colW = Math.max(colW, bl.w); place.push({ bl, x: colX - bl.w, y: y - bl.h, colX }); y -= bl.h;
      }
      const minX = Math.min(...place.map(q => q.x));
      area = { x0: frame.x0, y0: frame.y0, x1: minX, y1: frame.y1 };
      place.forEach(q => { q.x = q.colX - Math.max(...place.filter(z => z.colX === q.colX).map(z => z.bl.w)); });
    } else {
      let rowY = frame.y1, rowH = 0, x = frame.x1;
      for (const bl of blocks) {
        if (x - bl.w < frame.x0 + 0.5) { rowY -= rowH; rowH = 0; x = frame.x1; }
        rowH = Math.max(rowH, bl.h); place.push({ bl, x: x - bl.w, y: rowY - bl.h, rowY }); x -= bl.w;
      }
      const minY = Math.min(...place.map(q => q.rowY - Math.max(...place.filter(z => z.rowY === q.rowY).map(z => z.bl.h))));
      area = { x0: frame.x0, y0: frame.y0, x1: frame.x1, y1: minY };
      place.forEach(q => { q.y = q.rowY - Math.max(...place.filter(z => z.rowY === q.rowY).map(z => z.bl.h)); });
    }
    const aw = area.x1 - area.x0 - 8, ah = area.y1 - area.y0 - 8;
    const bb = M.bbox, need = s => ({ w: bb.w * 1000 / s, h: bb.h * 1000 / s });
    const fitsAt = s => need(s).w <= aw && need(s).h <= ah;
    const auto = SCALES.find(fitsAt) || (bb.w > 0 || bb.h > 0 ? sigdir(bb.w, bb.h, aw, ah) : SCALES[0]);
    const scale = o.scale === 'auto' || !o.scale ? auto : +o.scale;
    // Uzak kaynak: yalnız parsel çizilseydi ölçek en az 2,5 kat büyük olabilirdi → kullanıcıya not (detay paftası önerisi)
    const pb = M.parcel && M.parcel.length >= 3 ? bboxOf(M.parcel) : null;
    const parselOlcek = pb ? (SCALES.find(s2 => pb.w * 1000 / s2 <= aw && pb.h * 1000 / s2 <= ah) || sigdir(pb.w, pb.h, aw, ah)) : null;
    const uzakKaynak = !!(parselOlcek && auto >= 2.5 * parselOlcek);
    const nd = need(scale), fits = nd.w <= aw && nd.h <= ah;
    const nx = Math.max(1, Math.ceil(nd.w / aw)), ny = Math.max(1, Math.ceil(nd.h / ah));
    return { W, H, fs, mg, frame, area, aw, ah, place, scale, fits, auto, parselOlcek, uzakKaynak, tiles: { nx, ny, n: nx * ny }, need: nd };
  }

  // Bilgi paneli blokları: antet, proje parametreleri, shift özeti, boru özeti, semboller
  function panelBlocks(M, o, fs, wOverride) {
    const T = o.t || (x => x), r = M.r, p = M.p, s = r.schedule, rh = fs * 1.75, W = wOverride ? Math.min(fs * 64, wOverride) : fs * 64, meta = p.meta || {};
    const blocks = [];
    const table = (title, head, rows, colFr) => ({ w: W, h: rh * (rows.length + (head ? 2 : 1)) + 1.5, title, head, rows, colFr });
    const ad = (D, k) => (D && D[k] ? D[k].ad : k);
    const crop = r.cropName || (p.inp && p.inp.crop) || '—';
    const srcAd = { kuyu: 'Kuyu', yuzey: 'Göl/kanal/havuz', sebeke: 'Şebeke/hidrant' }[(p.inp || {}).srcType || 'kuyu'];
    const e = r.emitter, L = r.lateral;
    const params = [
      [T('Bitki türü'), '—', T(o.cropName || crop)], [T('Sulanan net alan'), 'da', f(r.field.da, 2)], [T('Su kaynağı'), '—', T(srcAd)],
      [T('Bitki aralığı'), 'm × m', `${f(r.field.Sr, 2)} × ${f(r.field.Sp, 2)}`], [T('Sulama sistemi'), '—', T('Damla sulama')],
      [T('Damlatıcı tipi'), '—', (e.pc ? T('Basınç ayarlı (PC)') : T('Normal')) + (r.field.tip === 'serit' ? ' / ' + T('damla borusu') : ' / ' + T('ağaç')) ],
      [T('Damlatıcı debisi'), 'l/h', f(e.q, 2)], [T('Damlatıcı aralığı'), 'm', f(e.Se, 2)], [T('Lateral aralığı'), 'm', f(r.field.Sr, 2)],
      [T('Sıra başına lateral sayısı'), T('adet'), '1'], [T('Sulama hızı'), 'mm/h', f(s.AR, 2)], [T('Maksimum günlük su tüketimi'), 'mm', f(s.net, 2)],
      [T('Sulama aralığı'), T('gün'), String(s.interval)], [T('Sulama grubu çalışma süresi'), T('saat'), f(s.t, 2)], [T('Shift sayısı'), T('adet'), String(r.sectors.Ns)],
      [T('Maksimum Shift debisi'), 'm³/h', f(r.sectors.Qsec, 2)], [T('Minimum Shift debisi'), 'm³/h', f(r.sectors.Qmin, 2)], [T('Maksimum günlük çalışma süresi'), T('saat'), f(s.hoursPerDay, 1)],
    ];
    const today = new Date();
    const antet = [
      [T('Proje adı'), p.name || '—'], [T('Müşteri / işletme'), meta.musteri || '—'], [T('İl / ilçe / mevki'), [meta.il, meta.ilce, meta.mevki].filter(Boolean).join(' / ') || '—'],
      [T('Proje mühendisi'), meta.muhendis || '—'], [T('Proje tarihi'), meta.tarih || today.toLocaleDateString('tr-TR')], [T('Revizyon'), 'R' + (p.rev || 1)],
      [T('Pafta no'), (meta.pafta || '1') + (o.tileText ? ' (' + o.tileText + ')' : '')], [T('Ölçek'), o.scaleText || '—'], [T('Proje alanı'), f(r.field.da, 2) + ' da'],
      [T('Sulama sistemi tipi'), T('Damla sulama')],
    ];
    blocks.push(Object.assign(table('IrriGrow — ' + T('SULAMA PROJESİ'), null, antet, [0.38, 0.62]), { antet: true }));
    blocks.push(table(T('PROJE PARAMETRELERİ'), [T('Parametre'), T('Birim'), 'FIELD 1'], params, [0.55, 0.15, 0.3]));
    const sumRows = M.shifts.map(sh => [`SHIFT ${sh.no}`, f(sh.A, 2), f(sh.Q, 2), f(sh.t, 2), f(sh.H, 1)]);
    blocks.push(table(T('SHIFT ÖZETİ'), ['Shift', 'da', 'm³/h', T('saat'), 'mSS'], sumRows, [0.28, 0.18, 0.2, 0.16, 0.18]));
    const byD = new Map(); M.main.forEach(sg => { const k = `${sg.mat || 'PVC-U'} Ø${sg.od}${sg.sdr ? ` SDR${sg.sdr}` : ''} PN${sg.pn}`; byD.set(k, (byD.get(k) || 0) + sg.L); });
    const byM = new Map(); M.units.forEach(u => { const k = `${u.mat} Ø${u.od} PN${u.pn}`; byM.set(k, (byM.get(k) || 0) + u.L); });
    const pipeRows = [...[...byD].map(([k, l]) => [T('Ana hat'), k, f(l, 0) + ' m']), ...[...byM].map(([k, l]) => ['Manifold', k, f(l, 0) + ' m']), ['Lateral', `Ø${L.d}`, f(L.len, 0) + ' m']];
    blocks.push(table(T('BORU ÖZETİ'), null, pipeRows, [0.25, 0.5, 0.25]));
    blocks.push(Object.assign(table(T('SEMBOLLER'), null, legendRows(M, T), [0.22, 0.78]), { legend: true }));
    return blocks;
  }
  function legendRows(M, T) {
    const used = new Set(M.eq.map(e => e.type)); if (M.fittings.some(x => x.type === 'reduksiyon')) used.add('reduksiyon');
    const rows = [['L:parsel', T('Parsel sınırı')], ['L:shift', T('Shift sınırı')], ['L:main', T('Ana hat (PVC-U)')], ['L:man', T('Manifold (PE100)')], ['L:lat', 'Lateral']];
    const SYM = [['kaynak', 'Su kaynağı'], ['pompa', 'Pompa istasyonu'], ['filtre', 'Filtre istasyonu'], ['gubre', 'Gübreleme ünitesi'], ['kontrol', 'Kontrol istasyonu'], ['kesme', 'Ana kesme vanası'], ['cekvalf', 'Çekvalf'], ['shiftvana', 'Shift (parsel) vanası'], ['regulator', 'Basınç regülatörü'], ['hava', 'Hava tahliye / vakum kırıcı'], ['yikama', 'Yıkama vanası'], ['reduksiyon', 'Redüksiyon (çap değişimi)']];
    for (const [k, l] of SYM) if (used.has(k)) rows.push(['S:' + k, T(l)]);
    return rows;
  }

  // ---------- Semboller (sayfa mm, merkez x,y, boyut s) ----------
  function symbol(type, x, y, s, col) {
    const P = [], k = s / 2, red = col ? '#c62828' : '#000', blu = col ? '#1565c0' : '#000', tq = col ? '#00acc1' : '#000';
    const bow = (fill) => { P.push({ t: 'poly', pts: [[x - k, y - k * 0.7], [x, y], [x - k, y + k * 0.7]], fill, stroke: '#000', lw: 0.15 }); P.push({ t: 'poly', pts: [[x + k, y - k * 0.7], [x, y], [x + k, y + k * 0.7]], fill, stroke: '#000', lw: 0.15 }); };
    switch (type) {
      case 'kaynak': P.push({ t: 'circle', x, y, r: k, fill: tq, stroke: '#000', lw: 0.2 }, { t: 'circle', x, y, r: k * 0.55, fill: '#fff', stroke: '#000', lw: 0.15 }); break;
      case 'pompa': P.push({ t: 'circle', x, y, r: k, fill: '#fff', stroke: red, lw: 0.3 }, { t: 'poly', pts: [[x - k * 0.55, y + k * 0.45], [x + k * 0.6, y], [x - k * 0.55, y - k * 0.45]], fill: red, stroke: red, lw: 0.1 }); break;
      case 'filtre': P.push({ t: 'poly', pts: [[x, y - k], [x + k, y], [x, y + k], [x - k, y]], fill: '#fff', stroke: '#000', lw: 0.25 }, { t: 'line', pts: [[x - k * 0.7, y], [x + k * 0.7, y]], c: '#000', lw: 0.2, dash: [0.5, 0.4] }); break;
      case 'gubre': P.push({ t: 'rect', x: x - k, y: y - k, w: s, h: s, fill: '#fff', stroke: '#000', lw: 0.25 }, { t: 'text', x, y: y + k * 0.45, s: k * 1.2, txt: 'G', anchor: 'middle', bold: true }); break;
      case 'kontrol': P.push({ t: 'rect', x: x - k * 1.2, y: y - k * 0.8, w: s * 1.2, h: s * 0.8, fill: '#fff', stroke: '#000', lw: 0.25 }, { t: 'text', x, y: y + k * 0.35, s: k * 0.9, txt: 'KI', anchor: 'middle', bold: true }); break;
      case 'kesme': bow('#000'); break;
      case 'cekvalf': bow('#fff'); P.push({ t: 'poly', pts: [[x - k, y - k * 0.7], [x, y], [x - k, y + k * 0.7]], fill: '#000', stroke: '#000', lw: 0.1 }, { t: 'line', pts: [[x + k * 0.15, y - k * 0.8], [x + k * 0.15, y + k * 0.8]], c: '#000', lw: 0.3 }); break;
      case 'shiftvana': bow(blu); P.push({ t: 'line', pts: [[x, y], [x, y - k]], c: '#000', lw: 0.2 }, { t: 'rect', x: x - k * 0.35, y: y - k * 1.35, w: k * 0.7, h: k * 0.4, fill: '#000', stroke: '#000', lw: 0.1 }); break;
      case 'regulator': bow('#fff'); P.push({ t: 'line', pts: [[x - k * 0.8, y + k * 0.9], [x + k * 0.8, y - k * 0.9]], c: '#000', lw: 0.25 }); break;
      case 'hava': P.push({ t: 'poly', pts: [[x - k * 0.7, y + k * 0.6], [x + k * 0.7, y + k * 0.6], [x, y - k * 0.7]], fill: '#fff', stroke: '#000', lw: 0.2 }, { t: 'text', x, y: y + k * 0.45, s: k * 0.75, txt: 'A', anchor: 'middle', bold: true }); break;
      case 'yikama': P.push({ t: 'rect', x: x - k * 0.6, y: y - k * 0.6, w: k * 1.2, h: k * 1.2, fill: '#000', stroke: '#000', lw: 0.1 }); break;
      case 'reduksiyon': P.push({ t: 'poly', pts: [[x - k * 0.7, y - k * 0.6], [x + k * 0.7, y - k * 0.25], [x + k * 0.7, y + k * 0.25], [x - k * 0.7, y + k * 0.6]], fill: '#fff', stroke: '#000', lw: 0.2 }); break;
      case 'te': P.push({ t: 'circle', x, y, r: k * 0.35, fill: '#000', stroke: '#000', lw: 0.1 }); break;
      case 'dirsek': P.push({ t: 'circle', x, y, r: k * 0.3, fill: '#fff', stroke: '#000', lw: 0.15 }); break;
    }
    return P;
  }

  // ---------- Çizim ilkelleri (sayfa mm; y aşağı) ----------
  // o: { format, orient, scale|'auto', color, layers, tile:{i,j}|null, t, logo }
  function sheet(M, o = {}) {
    const T = o.t || (x => x), col = o.color !== false, Ly = Object.assign({ parsel: true, shift: true, lateral: true, manifold: true, main: true, eq: true, labels: true, boxes: true, panel: true }, o.layers || {});
    const L0 = sheetLayout(M, Object.assign({}, o));
    const scale = L0.scale, k = 1000 / scale;
    const tiles = o.multi ? L0.tiles : { nx: 1, ny: 1, n: 1 };
    const ti = o.tile || { i: 0, j: 0 };
    const tileText = tiles.n > 1 ? `${ti.j * tiles.nx + ti.i + 1}/${tiles.n}` : '';
    const L = sheetLayout(M, Object.assign({}, o, { scaleText: '1:' + scale, tileText }));
    L.tileText = tileText;
    const bb = M.bbox, aw = L.aw, ah = L.ah;
    // Görünüm penceresi (model m)
    const vw = aw / k, vh = ah / k;
    let vx0, vy1;
    if (tiles.n > 1) { vx0 = bb.x0 + ti.i * vw; vy1 = bb.y1 - ti.j * vh; }
    else { const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2; vx0 = cx - vw / 2; vy1 = cy + vh / 2; }
    const ox = L.area.x0 + 4, oy = L.area.y0 + 4;
    const X = x => ox + (x - vx0) * k, Y = y => oy + (vy1 - y) * k, PT = q => [X(q[0]), Y(q[1])];
    const prims = [], fs = L.fs;
    // Kollar (manifold boyunca giden ana hat), manifoldla çakışmasın diye paralel kaydırılarak çizilir
    const KOL = 0.9;
    const mainPts = sg => { const a = PT(sg.a), b = PT(sg.b); if (sg.kind !== 'kol') return [a, b]; const d = norm([b[0] - a[0], b[1] - a[1]]); const n = [-d[1] * KOL, d[0] * KOL]; return [[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]]]; };
    const C = (c, bw) => col ? c : (bw || '#000');
    const clip = { x0: ox, y0: oy, x1: ox + aw, y1: oy + ah };
    prims.push({ t: 'clip', ...clip });
    // Shift taraması ve sınırları
    if (Ly.shift) {
      M.units.forEach(u => { if (u.poly.length >= 3) prims.push({ t: 'poly', pts: u.poly.map(PT), fill: col ? M.shifts[u.shift].color : '#f2f2f2', opacity: col ? 0.28 : 0.6, stroke: null }); });
      // Shift sınırları: komşu farklı shift'e ait ünite kenarları kesikli
      M.units.forEach(u => { if (u.poly.length >= 3) prims.push({ t: 'poly', pts: u.poly.map(PT), fill: null, stroke: C('#333'), lw: 0.25, dash: [2.4, 1.2] }); });
    }
    if (Ly.lateral) {
      const step = Math.max(1, Math.ceil(1.0 / Math.max(M.r.field.Sr * k, 1e-6)));  // çizgiler arası en az 1 mm (okunabilirlik)
      const segs = [], LL = M.r.layout.laterals; for (let i = 0; i < M.laterals.length; i++) if (LL[i].row % step === 0) segs.push(M.laterals[i].map(PT));
      prims.push({ t: 'multiline', segs, c: C('#7cc576', '#9a9a9a'), lw: 0.09 });
    }
    if (Ly.parsel) prims.push({ t: 'poly', pts: M.parcel.map(PT), fill: null, stroke: '#000', lw: 0.5 });
    if (Ly.manifold) M.units.forEach(u => prims.push({ t: 'line', pts: [PT(u.a), PT(u.b)], c: C('#1565c0'), lw: 0.45, dash: col ? null : [3, 0.8, 0.6, 0.8] }));
    if (Ly.main) {
      M.main.forEach(sg => { if (!sg.virtual) { const [a, b] = mainPts(sg); prims.push({ t: 'line', pts: [a, b], c: C('#d32f2f'), lw: sg.od >= 160 ? 0.9 : sg.od >= 110 ? 0.7 : 0.55 }); } });
      M.fittings.forEach(ft => { const [x, y] = PT(ft.at); prims.push(...symbol(ft.type, x, y, fs * 1.1, col)); });
    }
    // Etiket yerleşimi; boru hatları engel olarak işaretlenir (etiket boruların üstüne binmez)
    const pl = placer();
    const blockLine = (a, b, hw) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) return; pl.block({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, w: L + hw * 2, h: hw * 2, rot: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI }); };
    if (Ly.main) M.main.forEach(sg => { if (!sg.virtual) { const [a, b] = mainPts(sg); blockLine(a, b, 0.45); } });
    if (Ly.manifold) M.units.forEach(u => blockLine(PT(u.a), PT(u.b), 0.35));
    const lab = [];
    const fsL = fs * 0.72;
    // Shift kutuları (önce yerleşir; diğer etiketler bunlardan kaçar)
    if (Ly.boxes) M.shifts.forEach(sh => {
      const lines = shiftLines(M, sh, T), hdr = `FIELD ${sh.field} — SHIFT ${sh.no}`;
      const bs = fs * 0.78, rh = bs * 1.45, w = Math.max(textW(hdr, bs) * 1.08 + 3, ...lines.map(([a, b]) => textW(a + ': ' + b, bs) * 1.08 + 4)), h = rh * (lines.length + 1) + 1;
      let [cx, cy] = PT(sh.box);
      if (!sh.userPos) { // otomatik konum: shift alanının içinde, boru hatlarına binmeyen yer (önce varsayılan, sonra ünite merkezleri çevresi)
        const polys = sh.units.map(k => M.units[k].poly.map(PT)).filter(q => q.length >= 3);
        const inside = (x, y) => polys.some(P => pip(P, x, y));
        const seeds = [[cx, cy], ...sh.units.map(k => centroid(M.units[k].poly.length >= 3 ? M.units[k].poly : [M.units[k].a, M.units[k].b])).map(PT)];
        const cands = [];
        for (const [sx, sy] of seeds) for (const rr of [0, 1, 2, 3]) for (const [dx, dy] of rr ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] : [[0, 0]]) { const x = sx + dx * rr * w * 0.3, y = sy + dy * rr * h * 0.4; if (inside(x, y)) cands.push({ x, y, w: w + 1.5, h: h + 1.5, rot: 0 }); }
        let got = pl.tryPlace(cands);
        if (!got) { // alan içinde yer yoksa: shift'e en yakın boş yer (kutular üst üste binmez)
          const c2 = []; for (const [sx, sy] of seeds.slice(0, 3)) for (let rr = 1; rr <= 8; rr++) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) c2.push({ x: sx + dx * rr * w * 0.3, y: sy + dy * rr * h * 0.4, w: w + 1.5, h: h + 1.5, rot: 0 });
          got = pl.tryPlace(c2);
        }
        if (got) { cx = got.x; cy = got.y; } else pl.block({ x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 });
      } else pl.block({ x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 });
      lab.push({ t: 'box', key: 'S' + sh.no, x: cx - w / 2, y: cy - h / 2, w, h, rh, bs, hdr, lines, head: col ? sh.head : '#000' });
    });
    // Ekipman sembolleri
    if (Ly.eq) {
      const sz = fs * 1.5;
      M.eq.forEach(e => {
        let [x, y] = PT(e.at); if (e.offset && e.at === e.atDef) { x += e.offset * sz * 1.25; if (e.small) y -= sz * 0.9; }
        const s = e.small ? sz * 0.7 : sz;
        prims.push(...symbol(e.type, x, y, s, col));
        pl.block({ x0: x - s / 2, x1: x + s / 2, y0: y - s / 2, y1: y + s / 2 });
        e._sheet = [x, y];
      });
    }
    if (Ly.labels) {
      if (Ly.main) M.main.forEach(sg => {
        if (sg.virtual) return;
        const [a, b] = mainPts(sg), len = Math.hypot(b[0] - a[0], b[1] - a[1]); const txt = pipeLabel(sg), w = textW(txt, fsL), h = fsL * 1.25;
        if (len < 4) return;
        let rot = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; if (rot > 90) rot -= 180; if (rot < -90) rot += 180;
        const d = norm([b[0] - a[0], b[1] - a[1]]), n = [-d[1], d[0]];
        const cands = [];
        for (const tpos of [0.5, 0.3, 0.7, 0.15, 0.85]) for (const side of [1, -1]) { const c = [a[0] + (b[0] - a[0]) * tpos + n[0] * side * (h * 0.78), a[1] + (b[1] - a[1]) * tpos + n[1] * side * (h * 0.78)]; cands.push({ x: c[0], y: c[1], w, h, rot }); }
        let got = pl.tryPlace(cands), tx = txt, sz = fsL;
        if (!got) { tx = `${sg.id} Ø${sg.od} — ${f(sg.L, 0)} m`; sz = fsL * 0.85; const w2 = textW(tx, sz); got = pl.tryPlace(cands.map(c => Object.assign({}, c, { w: w2, h: sz * 1.2 }))); }
        if (got) lab.push({ t: 'text', x: got.x, y: got.y + sz * 0.35, s: sz, txt: tx, rot: got.rot, c: C('#b71c1c'), anchor: 'middle', bold: true, halo: true });
      });
      if (Ly.manifold) M.units.forEach(u => {
        const a = PT(u.a), b = PT(u.b), txt = manLabel(u), w = textW(txt, fsL * 0.92), h = fsL * 1.15;
        let rot = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; if (rot > 90) rot -= 180; if (rot < -90) rot += 180;
        const d = norm([b[0] - a[0], b[1] - a[1]]), n = [-d[1], d[0]], cands = [];
        for (const tpos of [0.5, 0.35, 0.65, 0.2, 0.8]) for (const side of [1, -1]) cands.push({ x: a[0] + (b[0] - a[0]) * tpos + n[0] * side * h * 0.85, y: a[1] + (b[1] - a[1]) * tpos + n[1] * side * h * 0.85, w, h, rot });
        const got = pl.tryPlace(cands); if (got) lab.push({ t: 'text', x: got.x, y: got.y + fsL * 0.3, s: fsL * 0.92, txt, rot: got.rot, c: C('#0d47a1'), anchor: 'middle', halo: true });
      });
    }
    if (Ly.labels) {
      if (Ly.eq) M.eq.forEach(e => {
        if (e.small || !e._sheet) return;
        const [x, y] = e._sheet, txt = e.text, w = textW(txt, fsL * 0.85), h = fsL * 1.1, s = fs * 1.5;
        const cands = [[x + s * 0.7 + w / 2, y], [x - s * 0.7 - w / 2, y], [x, y - s - h / 2], [x, y + s + h / 2], [x + s * 0.7 + w / 2, y - h * 1.2], [x + s * 0.7 + w / 2, y + h * 1.2]].map(([cx, cy]) => ({ x: cx, y: cy, w, h, rot: 0 }));
        const got = pl.tryPlace(cands); if (got) lab.push({ t: 'text', x: got.x, y: got.y + fsL * 0.3, s: fsL * 0.85, txt, c: '#000', anchor: 'middle', halo: true });
      });
      if (Ly.lateral && M.laterals.length) {
        // her manifold hattı için bir lateral etiketi
        const txt = latLabel(M), w = textW(txt, fsL * 0.85), h = fsL * 1.1;
        const seen = new Set();
        M.r.layout.laterals.forEach((l, i) => {
          if (seen.has(l.band) || l.len < 5) return;
          const ab = M.laterals[i], a = PT(ab[0]), b = PT(ab[1]);
          let rot = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; if (rot > 90) rot -= 180; if (rot < -90) rot += 180;
          const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          const got = pl.tryPlace([{ x: mid[0], y: mid[1], w, h, rot }]); if (got) { seen.add(l.band); lab.push({ t: 'text', x: got.x, y: got.y + fsL * 0.3, s: fsL * 0.85, txt, rot: got.rot, c: C('#2e7d32', '#333'), anchor: 'middle', halo: true }); }
        });
      }
    }
    for (const q of lab) {
      if (q.t === 'box') {
        prims.push({ t: 'rect', x: q.x, y: q.y, w: q.w, h: q.h, fill: '#fff', stroke: '#000', lw: 0.2, opacity: 0.92 });
        prims.push({ t: 'rect', x: q.x, y: q.y, w: q.w, h: q.rh + 0.5, fill: q.head, stroke: '#000', lw: 0.2, key: q.key, cx: q.x + q.w / 2, cy: q.y + q.h / 2, bw: q.w, bh: q.h });
        prims.push({ t: 'text', x: q.x + q.w / 2, y: q.y + q.rh * 0.78, s: q.bs, txt: q.hdr, anchor: 'middle', c: '#fff', bold: true, key: q.key });
        q.lines.forEach(([a, b], i) => { prims.push({ t: 'text', x: q.x + 1, y: q.y + q.rh * (i + 1.85), s: q.bs, txt: a + ':', c: '#000' }); prims.push({ t: 'text', x: q.x + q.w - 1, y: q.y + q.rh * (i + 1.85), s: q.bs, txt: b, c: '#000', anchor: 'end', bold: true }); });
      } else prims.push(q);
    }
    prims.push({ t: 'unclip' });
    // Pafta çerçevesi, kuzey oku, ölçek çubuğu
    prims.push({ t: 'rect', x: L.frame.x0, y: L.frame.y0, w: L.frame.x1 - L.frame.x0, h: L.frame.y1 - L.frame.y0, fill: null, stroke: '#000', lw: 0.6 });
    prims.push({ t: 'rect', x: L.area.x0, y: L.area.y0, w: L.area.x1 - L.area.x0, h: L.area.y1 - L.area.y0, fill: null, stroke: '#000', lw: 0.3 });
    { const nx = L.area.x1 - fs * 5, ny = L.area.y0 + fs * 5, a = fs * 2.6; prims.push({ t: 'poly', pts: [[nx, ny - a], [nx + a * 0.45, ny + a * 0.6], [nx, ny + a * 0.25]], fill: '#000', stroke: '#000', lw: 0.15 }, { t: 'poly', pts: [[nx, ny - a], [nx - a * 0.45, ny + a * 0.6], [nx, ny + a * 0.25]], fill: '#fff', stroke: '#000', lw: 0.15 }, { t: 'text', x: nx, y: ny - a - fs * 0.6, s: fs * 1.3, txt: 'K', anchor: 'middle', bold: true }); }
    { const target = 40 / k, nice = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000].reduce((b, v) => (v <= target ? v : b), 5), bl = nice * k, bx = L.area.x0 + 6, by = L.area.y1 - 6;
      for (let q = 0; q < 4; q++) prims.push({ t: 'rect', x: bx + q * bl / 4, y: by - 1.2, w: bl / 4, h: 1.2, fill: q % 2 ? '#fff' : '#000', stroke: '#000', lw: 0.15 });
      prims.push({ t: 'text', x: bx, y: by - 2, s: fs * 0.75, txt: '0', anchor: 'middle' }, { t: 'text', x: bx + bl, y: by - 2, s: fs * 0.75, txt: nice + ' m', anchor: 'middle' }, { t: 'text', x: bx + bl / 2, y: by + fs * 1.1, s: fs * 0.8, txt: `${T('Ölçek')} 1:${scale} (${o.format || 'A3'})`, anchor: 'middle', bold: true }); }
    // Bilgi paneli
    if (Ly.panel) for (const { bl, x, y } of L.place) drawBlock(prims, bl, x, y, fs, col, o);
    const cb = { x0: X(bb.x0) - 6, y0: Y(bb.y1) - 6, x1: X(bb.x1) + 6, y1: Y(bb.y0) + 6 };
    return { W: L.W, H: L.H, prims, scale, content: cb, fits: L.fits, auto: L.auto, parselOlcek: L.parselOlcek, uzakKaynak: L.uzakKaynak, tiles, tileText, need: L.need, area: L.area, view: { x0: vx0, y1: vy1, k }, X, Y, ox, oy };
  }
  function drawBlock(P, bl, x, y, fs, col, o) {
    const rh = fs * 1.75, w = bl.w;
    P.push({ t: 'rect', x, y, w, h: bl.h, fill: '#fff', stroke: '#000', lw: 0.35 });
    P.push({ t: 'rect', x, y, w, h: rh, fill: col ? (bl.antet ? '#0f5132' : '#e8efe9') : '#fff', stroke: '#000', lw: 0.25 });
    P.push({ t: 'text', x: x + w / 2, y: y + rh * 0.72, s: fs * 0.95, txt: bl.title, anchor: 'middle', bold: true, c: bl.antet && col ? '#fff' : '#000' });
    let yy = y + rh;
    const cols = bl.colFr.reduce((a, fr) => (a.push(a[a.length - 1] + fr * w), a), [x]);
    if (bl.head) { bl.head.forEach((h, i) => P.push({ t: 'text', x: (cols[i] + cols[i + 1]) / 2, y: yy + rh * 0.7, s: fs * 0.78, txt: h, anchor: 'middle', bold: true })); P.push({ t: 'line', pts: [[x, yy + rh], [x + w, yy + rh]], c: '#000', lw: 0.2 }); yy += rh; }
    bl.rows.forEach((row, ri) => {
      if (bl.legend) {
        const [kind, label] = row, cx = (cols[0] + cols[1]) / 2, cy = yy + rh / 2;
        if (kind.startsWith('L:')) {
          const ty = kind.slice(2), st = { parsel: ['#000', 0.5, null], shift: ['#333', 0.25, [2.4, 1.2]], main: [col ? '#d32f2f' : '#000', 0.7, null], man: [col ? '#1565c0' : '#000', 0.45, col ? null : [3, 0.8, 0.6, 0.8]], lat: [col ? '#7cc576' : '#999', 0.12, null] }[ty];
          P.push({ t: 'line', pts: [[cols[0] + 1.5, cy], [cols[1] - 1.5, cy]], c: st[0], lw: st[1], dash: st[2] });
        } else P.push(...symbol(kind.slice(2), cx, cy, fs * 1.1, col));
        P.push({ t: 'text', x: cols[1] + 1, y: yy + rh * 0.7, s: fs * 0.75, txt: label });
      } else row.forEach((c, i) => {
        const al = bl.antet ? (i === 0 ? 'start' : 'start') : (i === 0 ? 'start' : 'middle');
        const tx = al === 'start' ? cols[i] + 1 : (cols[i] + cols[i + 1]) / 2;
        P.push({ t: 'text', x: tx, y: yy + rh * 0.7, s: fs * (bl.antet && i === 1 ? 0.8 : 0.72), txt: String(c), anchor: al, bold: bl.antet && i === 1 });
      });
      yy += rh;
      if (ri < bl.rows.length - 1) P.push({ t: 'line', pts: [[x, yy], [x + w, yy]], c: '#bbb', lw: 0.1 });
    });
    for (let i = 1; i < cols.length - 1; i++) P.push({ t: 'line', pts: [[cols[i], y + rh], [cols[i], y + bl.h]], c: '#000', lw: 0.15 });
  }

  // ---------- SVG çıktısı ----------
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function toSVG(S, opts = {}) {
    const n = v => (+v).toFixed(2);
    let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S.W} ${S.H}" width="${S.W}mm" height="${S.H}mm" font-family="DejaVu Sans Condensed, DejaVu Sans, Arial, sans-serif"><rect width="${S.W}" height="${S.H}" fill="#fff"/>`;
    let clipN = 0, open = 0;
    for (const p of S.prims) {
      const dash = p.dash ? ` stroke-dasharray="${p.dash.join(' ')}"` : '';
      const key = p.key ? ` data-key="${p.key}"${p.cx != null ? ` data-cx="${n(p.cx)}" data-cy="${n(p.cy)}" data-bw="${n(p.bw)}" data-bh="${n(p.bh)}"` : ''} style="cursor:move"` : '';
      switch (p.t) {
        case 'clip': out += `<clipPath id="c${++clipN}"><rect x="${n(p.x0)}" y="${n(p.y0)}" width="${n(p.x1 - p.x0)}" height="${n(p.y1 - p.y0)}"/></clipPath><g clip-path="url(#c${clipN})">`; open++; break;
        case 'unclip': if (open) { out += '</g>'; open--; } break;
        case 'line': out += `<polyline points="${p.pts.map(q => n(q[0]) + ',' + n(q[1])).join(' ')}" fill="none" stroke="${p.c}" stroke-width=\"${p.lw}\"${dash} stroke-linecap="round"/>`; break;
        case 'multiline': out += `<path d="${p.segs.map(sg => 'M' + n(sg[0][0]) + ' ' + n(sg[0][1]) + 'L' + n(sg[1][0]) + ' ' + n(sg[1][1])).join('')}" fill="none" stroke="${p.c}" stroke-width="${p.lw}"/>`; break;
        case 'poly': out += `<polygon points="${p.pts.map(q => n(q[0]) + ',' + n(q[1])).join(' ')}" fill="${p.fill || 'none'}"${p.opacity != null && p.fill ? ` fill-opacity="${p.opacity}"` : ''} stroke="${p.stroke || 'none'}" stroke-width="${p.lw || 0}"${dash}/>`; break;
        case 'rect': out += `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" fill="${p.fill || 'none'}"${p.opacity != null ? ` fill-opacity="${p.opacity}"` : ''} stroke="${p.stroke || 'none'}" stroke-width="${p.lw || 0}"${key}/>`; break;
        case 'circle': out += `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(p.r)}" fill="${p.fill || 'none'}" stroke="${p.stroke || 'none'}" stroke-width="${p.lw || 0}"/>`; break;
        case 'text': {
          const a = p.anchor === 'middle' ? 'middle' : p.anchor === 'end' ? 'end' : 'start', tr = p.rot ? ` transform="rotate(${n(p.rot)} ${n(p.x)} ${n(p.y - p.s * 0.35)})"` : '';
          out += `<text x="${n(p.x)}" y="${n(p.y)}" font-size="${n(p.s)}" text-anchor="${a}" fill="${p.c || '#000'}"${p.bold ? ' font-weight="bold"' : ''}${p.halo ? ` stroke="#fff" stroke-width="${n(p.s * 0.22)}" paint-order="stroke"` : ''}${tr}${key}>${esc(p.txt)}</text>`;
          break;
        }
      }
    }
    while (open--) out += '</g>';
    return out + '</svg>';
  }

  // ---------- PDF (jsPDF, vektörel) ----------
  function toPDF(doc, S, fontName) {
    const rgb = c => { if (!c) return [0, 0, 0]; const h = c.replace('#', ''); const v = h.length === 3 ? h.split('').map(x => x + x).join('') : h; return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]; };
    const GS = doc.GState ? (o) => { try { doc.setGState(new doc.GState(o)); } catch (e) { } } : () => { };
    const setDash = d => { try { doc.setLineDashPattern(d || [], 0); } catch (e) { } };
    let clipped = false;
    for (const p of S.prims) {
      switch (p.t) {
        case 'clip': doc.saveGraphicsState(); doc.rect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0, null); doc.clip(); doc.discardPath(); clipped = true; break;
        case 'unclip': if (clipped) { doc.restoreGraphicsState(); clipped = false; } break;
        case 'line': case 'multiline': {
          doc.setDrawColor(...rgb(p.c)); doc.setLineWidth(p.lw); setDash(p.dash);
          const segs = p.t === 'line' ? [p.pts] : p.segs;
          for (const sg of segs) { const rel = []; for (let i = 1; i < sg.length; i++) rel.push([sg[i][0] - sg[i - 1][0], sg[i][1] - sg[i - 1][1]]); doc.lines(rel, sg[0][0], sg[0][1], [1, 1], 'S', false); }
          setDash(null); break;
        }
        case 'poly': {
          const rel = []; for (let i = 1; i < p.pts.length; i++) rel.push([p.pts[i][0] - p.pts[i - 1][0], p.pts[i][1] - p.pts[i - 1][1]]);
          const st = p.fill && p.stroke ? 'FD' : p.fill ? 'F' : 'S';
          if (p.fill) doc.setFillColor(...rgb(p.fill)); if (p.stroke) { doc.setDrawColor(...rgb(p.stroke)); doc.setLineWidth(p.lw || 0.1); }
          setDash(p.dash); if (p.opacity != null && p.fill) GS({ opacity: p.opacity });
          doc.lines(rel, p.pts[0][0], p.pts[0][1], [1, 1], st, true);
          if (p.opacity != null && p.fill) GS({ opacity: 1 }); setDash(null); break;
        }
        case 'rect': {
          const st = p.fill && p.stroke ? 'FD' : p.fill ? 'F' : 'S';
          if (p.fill) doc.setFillColor(...rgb(p.fill)); if (p.stroke) { doc.setDrawColor(...rgb(p.stroke)); doc.setLineWidth(p.lw || 0.1); }
          if (p.opacity != null && p.fill) GS({ opacity: p.opacity });
          doc.rect(p.x, p.y, p.w, p.h, st);
          if (p.opacity != null && p.fill) GS({ opacity: 1 }); break;
        }
        case 'circle': { const st = p.fill && p.stroke ? 'FD' : p.fill ? 'F' : 'S'; if (p.fill) doc.setFillColor(...rgb(p.fill)); if (p.stroke) { doc.setDrawColor(...rgb(p.stroke)); doc.setLineWidth(p.lw || 0.1); } doc.circle(p.x, p.y, p.r, st); break; }
        case 'text': {
          doc.setFont(fontName, p.bold ? 'bold' : 'normal'); doc.setFontSize(p.s / 0.3528); doc.setTextColor(...rgb(p.c));
          const o = { align: p.anchor === 'middle' ? 'center' : p.anchor === 'end' ? 'right' : 'left' };
          if (p.rot) o.angle = -p.rot;
          if (p.halo && !p.rot) { const w = doc.getTextWidth(p.txt), x0 = o.align === 'center' ? p.x - w / 2 : o.align === 'right' ? p.x - w : p.x; doc.setFillColor(255, 255, 255); GS({ opacity: 0.8 }); doc.rect(x0 - 0.3, p.y - p.s * 0.85, w + 0.6, p.s * 1.1, 'F'); GS({ opacity: 1 }); }
          if (p.rot && o.align === 'center') { const w = doc.getTextWidth(p.txt), t = p.rot * Math.PI / 180; doc.text(p.txt, p.x - Math.cos(t) * w / 2, p.y - Math.sin(t) * w / 2, { angle: -p.rot }); }
          else doc.text(p.txt, p.x, p.y, o);
          break;
        }
      }
    }
  }

  // ---------- UTM (WGS84) ----------
  function utm(lat, lng, zone) {
    const a = 6378137, f0 = 1 / 298.257223563, k0 = 0.9996, e2 = f0 * (2 - f0), ep2 = e2 / (1 - e2);
    const z = zone || Math.floor((lng + 180) / 6) + 1, lon0 = ((z - 1) * 6 - 180 + 3) * Math.PI / 180;
    const phi = lat * Math.PI / 180, lam = lng * Math.PI / 180;
    const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2), Tt = Math.tan(phi) ** 2, Cc = ep2 * Math.cos(phi) ** 2, A = Math.cos(phi) * (lam - lon0);
    const Mm = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi) + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
    const x = k0 * N * (A + (1 - Tt + Cc) * A ** 3 / 6 + (5 - 18 * Tt + Tt ** 2 + 72 * Cc - 58 * ep2) * A ** 5 / 120) + 500000;
    let y = k0 * (Mm + N * Math.tan(phi) * (A ** 2 / 2 + (5 - Tt + 9 * Cc + 4 * Cc ** 2) * A ** 4 / 24 + (61 - 58 * Tt + Tt ** 2 + 600 * Cc - 330 * ep2) * A ** 6 / 720));
    if (lat < 0) y += 10000000;
    return { x, y, zone: z };
  }

  // ---------- DXF (AutoCAD R12 ASCII, katmanlı, metre) ----------
  const CP1254 = { 'ğ': 0xF0, 'Ğ': 0xD0, 'ı': 0xFD, 'İ': 0xDD, 'ş': 0xFE, 'Ş': 0xDE, 'ç': 0xE7, 'Ç': 0xC7, 'ö': 0xF6, 'Ö': 0xD6, 'ü': 0xFC, 'Ü': 0xDC, 'Ø': 0xD8, '×': 0xD7, '—': 0x97, '³': 0xB3, '²': 0xB2, '·': 0xB7, '½': 0xBD, '¼': 0xBC, '’': 0x92, '“': 0x93, '”': 0x94 };
  function encode1254(str) { const out = new Uint8Array(str.length); let n = 0; for (const ch of str) { const c = ch.charCodeAt(0); out[n++] = c < 128 ? c : (CP1254[ch] || 0x3F); } return out.slice(0, n); }
  function toDXF(M, o = {}) {
    const T = o.t || (x => x);
    let z = null, X = q => q[0], Y = q => q[1];
    if (M.geo) { const c = utm(M.lat0, M.lng0); z = c.zone; X = q => { const ll = M.toLL(q); return utm(ll[0], ll[1], z).x; }; Y = q => { const ll = M.toLL(q); return utm(ll[0], ll[1], z).y; }; }
    const LAYERS = [['PARSEL', 7], ['SHIFT', 8], ['SHIFT_ETIKET', 3], ['ANA_HAT', 1], ['MANIFOLD', 5], ['LATERAL', 3], ['EKIPMAN', 6], ['BORU_ETIKET', 2], ['BAGLANTI', 4]];
    const L = []; const w = (c, v) => { L.push(String(c)); L.push(String(v)); };
    const num = v => (+v).toFixed(3);
    w(0, 'SECTION'); w(2, 'HEADER'); w(9, '$ACADVER'); w(1, 'AC1009'); w(9, '$DWGCODEPAGE'); w(3, 'ANSI_1254'); w(9, '$INSBASE'); w(10, '0.0'); w(20, '0.0'); w(30, '0.0'); w(0, 'ENDSEC');
    w(0, 'SECTION'); w(2, 'TABLES');
    w(0, 'TABLE'); w(2, 'LTYPE'); w(70, 2);
    w(0, 'LTYPE'); w(2, 'CONTINUOUS'); w(70, 0); w(3, 'Solid line'); w(72, 65); w(73, 0); w(40, '0.0');
    w(0, 'LTYPE'); w(2, 'DASHED'); w(70, 0); w(3, '__ __ __'); w(72, 65); w(73, 2); w(40, '3.0'); w(49, '2.0'); w(49, '-1.0');
    w(0, 'ENDTAB');
    w(0, 'TABLE'); w(2, 'LAYER'); w(70, LAYERS.length);
    for (const [n, c] of LAYERS) { w(0, 'LAYER'); w(2, n); w(70, 0); w(62, c); w(6, n === 'SHIFT' ? 'DASHED' : 'CONTINUOUS'); }
    w(0, 'ENDTAB'); w(0, 'ENDSEC');
    w(0, 'SECTION'); w(2, 'ENTITIES');
    const line = (lay, a, b) => { w(0, 'LINE'); w(8, lay); w(10, num(X(a))); w(20, num(Y(a))); w(30, '0.0'); w(11, num(X(b))); w(21, num(Y(b))); w(31, '0.0'); };
    const pline = (lay, pts, closed) => { w(0, 'POLYLINE'); w(8, lay); w(66, 1); w(10, '0.0'); w(20, '0.0'); w(30, '0.0'); w(70, closed ? 1 : 0); for (const q of pts) { w(0, 'VERTEX'); w(8, lay); w(10, num(X(q))); w(20, num(Y(q))); w(30, '0.0'); } w(0, 'SEQEND'); w(8, lay); };
    const text = (lay, q, h, s, rot = 0, center = false) => { w(0, 'TEXT'); w(8, lay); w(10, num(X(q))); w(20, num(Y(q))); w(30, '0.0'); w(40, num(h)); w(1, s.replace(/\n/g, ' ')); if (rot) w(50, num(rot)); if (center) { w(72, 1); w(11, num(X(q))); w(21, num(Y(q))); w(31, '0.0'); } };
    const circ = (lay, q, r) => { w(0, 'CIRCLE'); w(8, lay); w(10, num(X(q))); w(20, num(Y(q))); w(30, '0.0'); w(40, num(r)); };
    const th = (o.textH || 2.0);  // metin yüksekliği (m) — 1:1000'de 2 mm
    pline('PARSEL', M.parcel, true);
    M.units.forEach(u => { if (u.poly.length >= 3) pline('SHIFT', u.poly, true); });
    M.laterals.forEach(([a, b]) => line('LATERAL', a, b));
    M.units.forEach(u => { line('MANIFOLD', u.a, u.b); const d = norm(sub(u.b, u.a)), ang = Math.atan2(d[1], d[0]) * 180 / Math.PI; const mid = mul(add(u.a, u.b), 0.5); text('BORU_ETIKET', add(mid, mul([-d[1], d[0]], th)), th * 0.8, manLabel(u), ((ang + 270) % 180) - 90 + 90 * 0, true); });
    M.main.forEach(sg => { if (sg.virtual) return; line('ANA_HAT', sg.a, sg.b); const d = norm(sub(sg.b, sg.a)); let ang = Math.atan2(d[1], d[0]) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180; text('BORU_ETIKET', add(mul(add(sg.a, sg.b), 0.5), mul([-d[1], d[0]], th)), th, pipeLabel(sg), ang, true); });
    M.fittings.forEach(ft => { circ('BAGLANTI', ft.at, th * 0.4); if (ft.text) text('BAGLANTI', add(ft.at, [th, th]), th * 0.7, 'RED ' + ft.text); });
    M.eq.forEach(e => { circ('EKIPMAN', e.at, e.small ? th * 0.5 : th); text('EKIPMAN', add(e.at, [th * 1.3, -th * 0.4]), th * (e.small ? 0.6 : 0.9), e.text); });
    M.shifts.forEach(sh => { const lines = [`FIELD ${sh.field} - SHIFT ${sh.no}`, ...shiftLines(M, sh, T).map(([a, b]) => a + ': ' + b)]; lines.forEach((s, i) => text('SHIFT_ETIKET', add(sh.box, [0, -i * th * 1.5]), th, s, 0, true)); });
    w(0, 'ENDSEC'); w(0, 'EOF');
    const txt = L.join('\r\n') + '\r\n';
    return { text: txt, bytes: encode1254(txt), zone: z, geo: M.geo };
  }

  const api = { build, sheet, sheetLayout, toSVG, toPDF, toDXF, utm, symbol, PAPER, SCALES, FONT, SHIFT_COL, SHIFT_HEAD, pipeLabel, manLabel, latLabel, shiftLines, placer, textW, encode1254 };
  g.IrriDrawing = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

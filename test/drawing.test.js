// Ana hat ağı (kademeli çap), ortak çizim modeli, ölçekli pafta, DXF ve UTM
const { E, test, near, ok, W } = require('./_lib');
const Dr = require(W('drawing.js'));
const poly = [[37.0, 35.0], [37.0, 35.004], [37.002, 35.005], [37.0025, 35.001], [37.0012, 34.9995]];
const P = { name: 'Test', inp: { crop: 'domates', geom: 'parsel', Q: 120, srcType: 'kuyu', depth: 30, region: 'akdeniz' }, poly, src: [36.999, 34.999], station: [36.9993, 34.9994], route: [[36.9996, 34.9996], [37.0001, 35.0001]], rev: 2 };
const design = (extra = {}) => E.design(Object.assign({}, P.inp, extra), null, { poly, src: P.src, station: P.station, route: P.route });

test('Ana hat ağı: Σ segment uzunluğu = ana hat uzunluğu; her alt ünitenin yolu = segmentlerinin toplamı', () => {
  const r = design(); ok(r.ok, r.err);
  const net = r.main.net;
  near(net.reduce((t, s) => t + s.L, 0), r.main.Lmain, 0.05 * net.length + 1e-6, 'Σ L');
  r.units.forEach((u, k) => near(net.filter(s => s.down.includes(k)).reduce((t, s) => t + s.L, 0), u.path, 0.05 * 12, `ünite ${k + 1} yolu`));
  ok(new Set(net.map(s => s.id)).size === net.length && net.every(s => /^AH-\d{2,}$/.test(s.id)), 'benzersiz AH kodları');
});

test('Ana hat ağı: debi sürekliliği (ebeveyn = çocuklar + o düğümde ayrılan üniteler), her shift için', () => {
  const r = design(), net = r.main.net, sel = r.sel;
  sel.groups.forEach((gr, j) => {
    net.forEach((s, i) => {
      const kids = net.filter(o => o.parent === i), leaving = s.down.filter(k => !kids.some(o => o.down.includes(k)) && gr.includes(k));
      const want = kids.reduce((t, o) => t + o.Q[j], 0) + leaving.reduce((t, k) => t + r.units[k].Q, 0);
      near(s.Q[j], want, 1e-6, `${s.id} shift ${j + 1}`);
    });
    near(net[0].Q[j], sel.Qj[j], 1e-6, 'ilk segment = shift debisi');
  });
});

test('Kademeli çap: akış yönünde çap küçülür ya da aynı kalır; küçültülen segmentlerde hız ≤ 1,5 m/s', () => {
  const r = design(), net = r.main.net, base = r.main.sel;
  net.forEach(s => { if (s.parent >= 0) ok(s.od <= net[s.parent].od, `${s.id} çapı ebeveynden büyük`); ok(s.od <= base.od, 'ana çapı aşmamalı'); if (s.od < base.od) ok(s.v <= 1.5 + 1e-9, `${s.id} hızı ${s.v}`); });
  ok(net.some(s => s.od < base.od), 'bu örnekte en az bir çap küçültmesi beklenir');
  const one = design({ teleskop: 'hayir' }); ok(one.main.net.every(s => s.od === one.main.sel.od), 'tek çap seçeneği');
  ok(one.main.sel.Hmax <= r.main.sel.Hmax + 1e-9 || one.main.sel.od !== base.od, 'tek çapta kayıp kademeliden büyük olamaz (aynı ana çapta)');
});

test('Malzeme: ana hat çap başına metrajı segmentlerle tutarlı; redüksiyon ve manifold başına vana', () => {
  const r = design(), byD = {};
  r.main.net.forEach(s => { byD[`pvc:${s.od}:${s.pn}`] = (byD[`pvc:${s.od}:${s.pn}`] || 0) + s.L; });
  for (const [k, L] of Object.entries(byD)) ok(r.bom.find(b => b.key === k).miktar === Math.ceil(L * 1.02), `${k} metrajı`);
  const nRed = r.main.net.filter(s => s.parent >= 0 && r.main.net[s.parent].od > s.od).length;
  ok(r.bom.filter(b => b.key.startsWith('fitting:pvc-red:')).reduce((t, b) => t + b.miktar, 0) === nRed, 'redüksiyon adedi');
  ok(r.bom.filter(b => b.key.startsWith('vana:gen-sv') || b.key === 'vana:sektor').reduce((t, b) => t + b.miktar, 0) === r.units.length, 'her manifold girişinde bir shift vanası');
});

test('Çizim modeli: shift kutuları kendi shift alanı içinde, ekipman kodları benzersiz, değerler hesaptan', () => {
  const r = design(), M = Dr.build(P, r);
  ok(M.shifts.length === r.sectors.Ns, 'shift sayısı');
  const pip = (Q, x, y) => { let c = false; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) { const [xi, yi] = Q[i], [xj, yj] = Q[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  M.shifts.forEach(sh => { ok(sh.units.some(k => pip(M.units[k].poly, sh.box[0], sh.box[1])), `S${sh.no} kutusu alan dışında`); near(sh.Q, r.sel.Qj[sh.j], 1e-9, 'debi'); near(sh.H, r.main.sel.H[sh.j], 1e-9, 'basınç'); });
  const codes = M.eq.map(e => e.code); ok(new Set(codes).size === codes.length, 'ekipman kodları benzersiz');
  ok(codes.filter(c => /^V-\d+$/.test(c)).length === r.units.length && codes.includes('K-01') && codes.includes('P-01') && codes.includes('ANV-01'), 'ekipman listesi');
  ok(Dr.pipeLabel(M.main[1]) === `${M.main[1].id} PVC-U Ø${r.main.net[1].od} PN${r.main.net[1].pn} — ${Math.round(r.main.net[1].L)} m`, 'boru etiketi hesaptan');
});

test('Shift sayısı değişince model, çizim, vana ve tablolar birlikte güncellenir', () => {
  const a = design(), Ns2 = a.sectorAlts[a.sectorAlts.length - 1].Ns, b = design({ Ns: Ns2 });
  ok(b.sectors.Ns === Ns2 && Ns2 !== a.sectors.Ns, 'shift sayısı değişmedi');
  const Mb = Dr.build(P, b), S = Dr.sheet(Mb, { format: 'A2', scale: 'auto' });
  ok(Mb.shifts.length === Ns2, 'model shift sayısı');
  const svg = Dr.toSVG(S);
  ok((svg.match(/FIELD 1 — SHIFT \d+/g) || []).length === Ns2, 'pafta kutuları');
  ok((svg.match(/>SHIFT \d+</g) || []).length === Ns2, 'shift özet tablosu satırları');
  ok(!/NaN|undefined/.test(svg), 'SVG içinde NaN/undefined');
  ok(svg.includes(`>${Ns2}<`), 'proje parametrelerinde shift sayısı');
});

test('Pafta ölçeği: gereken boyut = model × 1000 / ölçek; otomatik ölçek sığan en küçük standart ölçek; sığmazsa çoklu pafta', () => {
  const r = design(), M = Dr.build(P, r);
  for (const fm of ['A1', 'A2', 'A3', 'A4']) for (const orient of ['yatay', 'dikey']) {
    const L = Dr.sheetLayout(M, { format: fm, orient, scale: 'auto' });
    if (L.auto) { ok(L.fits, `${fm} ${orient} otomatik ölçek sığmalı`); const smaller = Dr.SCALES.filter(s => s < L.auto); for (const s of smaller) ok(!Dr.sheetLayout(M, { format: fm, orient, scale: s }).fits, 'daha büyük ölçek sığmamalı'); }
    near(L.need.w, M.bbox.w * 1000 / L.scale, 1e-9, 'gereken genişlik');
  }
  const S = Dr.sheet(M, { format: 'A4', scale: 500, multi: true });
  ok(!S.fits && S.tiles.n > 1, 'A4 1:500 sığmamalı ve çoklu pafta önermeli');
  ok(S.tiles.nx * Dr.sheetLayout(M, { format: 'A4', scale: 500 }).aw >= M.bbox.w * 2, 'paftalar genişliği kapsamalı');
  const S2 = Dr.sheet(M, { format: 'A3', scale: 2000 });
  const bar = S2.prims.find(p => p.t === 'text' && / m$/.test(p.txt) && /^\d+ m$/.test(p.txt)); ok(bar, 'ölçek çubuğu');
  const xs = S2.prims.filter(p => p.t === 'rect' && p.h === 1.2); const len = xs.reduce((t, p) => t + p.w, 0);
  near(len, parseInt(bar.txt) * 1000 / 2000, 1e-6, 'ölçek çubuğu uzunluğu (mm) = metre × 1000 / ölçek');
});

test('UTM dönüşümü (WGS84) bağımsız referansla (pyproj) mm düzeyinde uyumlu', () => {
  for (const [lat, lng, z, x, y] of [[37, 35, 36, 677962.190, 4096742.059], [39.9, 32.85, 36, 487177.384, 4416669.059], [41.0, 28.97, 35, 665684.626, 4540626.155], [36.2, 36.16, 37, 244653.526, 4009871.129]]) {
    const u = Dr.utm(lat, lng); ok(u.zone === z, 'dilim'); near(u.x, x, 0.002, 'Doğu'); near(u.y, y, 0.002, 'Kuzey');
  }
});

test('DXF: R12 yapısı, katmanlar, UTM koordinatları, Türkçe karakterler ANSI 1254', () => {
  const r = design(), M = Dr.build(P, r), D = Dr.toDXF(M), s = D.text;
  ok(/^0\r\nSECTION\r\n2\r\nHEADER/.test(s) && /0\r\nEOF\r\n$/.test(s), 'bölüm yapısı');
  ok(s.includes('AC1009') && s.includes('ANSI_1254'), 'sürüm ve kod sayfası');
  for (const L of ['PARSEL', 'SHIFT', 'ANA_HAT', 'MANIFOLD', 'LATERAL', 'EKIPMAN', 'BORU_ETIKET']) ok(new RegExp(`\\r\\n8\\r\\n${L}\\r\\n`).test(s), `${L} katmanı varlıkları`);
  ok((s.match(/\r\n0\r\nLINE\r\n8\r\nANA_HAT/g) || []).length === M.main.filter(x => !x.virtual).length, 'ana hat çizgileri');
  const xs = [...s.matchAll(/\r\n10\r\n([\d.]+)\r\n20\r\n([\d.]+)/g)].map(m => [+m[1], +m[2]]).filter(([x]) => x > 0);
  ok(xs.length > 100 && xs.every(([x, y]) => x > 160000 && x < 840000 && y > 4000000 && y < 4200000), 'UTM aralığı');
  ok(D.zone === 36 && D.bytes.includes(0xD8), 'Ø karakteri 1254 kodunda');
});

test('Pafta: otomatik yerleşen shift kutuları birbirinin üstüne binmez (tüm pafta boyutlarında)', () => {
  for (const extra of [{}, { Ns: 12 }]) {
    const r = design(extra), M = Dr.build(P, r);
    for (const format of ['A1', 'A2', 'A3', 'A4']) {
      const S = Dr.sheet(M, { format, scale: 'auto' });
      const boxes = S.prims.filter(p => p.t === 'rect' && p.key && p.bw).map(p => ({ x0: p.cx - p.bw / 2, x1: p.cx + p.bw / 2, y0: p.cy - p.bh / 2, y1: p.cy + p.bh / 2 }));
      ok(boxes.length === r.sectors.Ns, 'kutu sayısı');
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; ok(!(a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.y0 < b.y1 - 1e-6 && a.y1 > b.y0 + 1e-6), `${format}: S${i + 1} ve S${j + 1} çakışıyor`); }
    }
  }
});

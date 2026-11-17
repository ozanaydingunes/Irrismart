// IrriGrow — Hidrolik Hesap Tablosu. Kullanıcının Excel dosyasındaki (AUTOCAD_PROMPT_1.xlsm) iki sayfanın birebir karşılığı:
//   SİSTEM    : tarla bazında sulama hızı, bitki debisi, shift sayısı ve debileri
//   IRRIFRICT : boru segmentlerinde Hazen-Williams sürtünme kaybı, kot ve basınç zinciri
// Excel kuralları korunur: boş hücre = 0, hata (sıfıra bölme / metin) = "" (burada null), ROUND / ROUNDUP / ROUNDDOWN aynı.
(function (g) {
  const LIB = g.IRRI_PIPELIB || (typeof require !== 'undefined' ? require('./pipelib.js') : []);

  // ---- Excel yardımcıları ----
  const fix = x => Number(Number(x).toPrecision(15)); // Excel 15 anlamlı basamakla çalışır
  const ok = x => typeof x === 'number' && Number.isFinite(x);
  const num = v => { if (v === undefined || v === null || v === '') return 0; if (typeof v === 'number') return Number.isFinite(v) ? v : null; const s = String(v).trim().replace(',', '.'); if (s === '') return 0; const n = Number(s); return Number.isFinite(n) ? n : null; };
  const ROUND = (x, n) => { if (!ok(x)) return null; const p = Math.pow(10, n), r = Math.round(fix(Math.abs(x) * p)) / p; return x < 0 ? -r : r; };
  const ROUNDUP = (x, n = 0) => { if (!ok(x)) return null; const p = Math.pow(10, n), r = Math.ceil(fix(Math.abs(x) * p)) / p; return x < 0 ? -r : r; };
  const ROUNDDOWN = (x, n = 0) => { if (!ok(x)) return null; const p = Math.pow(10, n), r = Math.floor(fix(Math.abs(x) * p)) / p; return x < 0 ? -r : r; };
  const DIV = (a, b) => (ok(a) && ok(b) && b !== 0) ? a / b : null;
  const MUL = (...a) => a.every(ok) ? a.reduce((s, x) => s * x, 1) : null;

  // ---- SİSTEM ----
  // Girdiler (Excel satırı): crop(3), area(4) da, et(5) mm/gün, T(6) h, Sr(7) m, Sp(8) m, nl(9) lateral/sıra, q(10) l/h, Sd(11) m, shifts(17), target(21) m³/h
  const FIELD_IN = ['crop', 'area', 'et', 'T', 'Sr', 'Sp', 'nl', 'q', 'Sd', 'shifts', 'target'];
  function systemField(f) {
    f = f || {};
    const A = num(f.area), ET = num(f.et), T = num(f.T), Sr = num(f.Sr), Sp = num(f.Sp), NL = num(f.nl), q = num(f.q), Sd = num(f.Sd), S = num(f.shifts), TG = num(f.target);
    const n = MUL(DIV(Sp, Sd), NL);                      // C12 =(C8/C11)*C9           (IFERROR yok → hata = null)
    const rate = DIV(MUL(n, q), MUL(Sp, Sr));             // C13 sulama hızı mm/h
    const Qp = MUL(n, q);                                 // C14 bitki debisi l/h
    const Tp = DIV(MUL(Sp, Sr, ET), Qp);                  // C15 bitki başına sulama süresi h/gün
    const maxShift = ROUNDDOWN(DIV(T, Tp), 0);            // C16
    const totalTime = MUL(Tp, S);                         // C18
    const totalQ = DIV(MUL(A, ET), Tp);                   // C19 m³/h (da·mm = m³)
    const shiftQ = DIV(MUL(DIV(A, S), ET), Tp);           // C20
    const parcels = ROUNDUP(DIV(totalQ, TG), 0);          // C22
    const parcelA = DIV(A, parcels);                      // C23
    const parcelQ = DIV(totalQ, parcels);                 // C24
    const valves = ROUNDUP(DIV(shiftQ, parcelQ), 0);      // C25
    const shiftMax = MUL(valves, parcelQ);                // C26
    const shiftMin = MUL(ROUNDDOWN(DIV(shiftQ, parcelQ), 0), parcelQ); // C27
    const used = FIELD_IN.some(k => k !== 'crop' && f[k] !== undefined && f[k] !== null && f[k] !== '');
    const bad = FIELD_IN.filter(k => k !== 'crop' && num(f[k]) === null);
    return { n, rate, Qp, Tp, maxShift, totalTime, totalQ, shiftQ, parcels, parcelA, parcelQ, valves, shiftMax, shiftMin,
      overTime: ok(totalTime) && ok(T) && totalTime > T, used, bad };
  }

  // ---- IRRIFRICT ----
  const TYPES = ['Submain', 'Main', 'Transmission'];
  const MATERIALS = [...new Set(LIB.map(r => r[0]))];
  const pnsOf = m => LIB.filter(r => r[0] === m).map(r => r[1]);
  const lookup = (m, pn) => LIB.find(r => r[0] === m && String(r[1]) === String(pn)) || null;
  const cOf = m => { const r = LIB.find(x => x[0] === m); return r ? r[3] : null; };

  // rows: [{type, material, pn, L, Q, h1 (başlangıç kotu), h2 (yalnız ilk satır: bitiş kotu), pmin (yalnız ilk satır)}] — Excel satır 3..17
  function friction(rows) {
    rows = (rows || []).slice(0, 15);
    while (rows.length < 15) rows.push({});
    const out = [];
    for (let i = 0; i < 15; i++) {
      const r = rows[i] || {}, prev = out[i - 1];
      const F = num(r.L), G = num(r.Q), H = num(r.h1);
      const I = i === 0 ? num(r.h2) : (prev ? prev.H : 0);           // I4 = H3
      const J = i === 0 ? num(r.pmin) : (ok(prev.J) && ok(prev.Qc) ? prev.J + prev.Qc : null); // J4 = J3 + Q3
      const K = (ok(I) && ok(H) && F) ? ROUND((I - H) / F * 100, 2) : null;  // eğim %
      const pipe = r.material ? lookup(r.material, r.pn) : null;
      const L = pipe ? pipe[2] : null, M = r.material ? cOf(r.material) : null;
      let N = (ok(G) && ok(M) && M && ok(L) && L) ? (1.131e12 * Math.pow(G / M, 1.852) * Math.pow(L, -4.87)) / 1000 : 0; // IFERROR(...,0)
      N = ROUND(N, 4);
      const O = ok(F) ? ROUND(r.type === 'Submain' ? N * F * 0.354 : N * F, 2) : null;
      const P = ok(I) && ok(H) ? I - H : null;
      const Qc = ok(O) && ok(P) ? O + P : null;
      const S = (ok(G) && ok(L) && L) ? ROUND((4 * (G / 3600)) / (3.14 * Math.pow(L / 1000, 2)), 2) : 0;
      out.push({ i, type: r.type || '', material: r.material || '', pn: r.pn ?? '', F, G, H, I, J, K, L, M, N, O, P, Qc, S, pipeFound: !!pipe, used: !!(r.material || F || G) });
    }
    // R ve T kontrolleri (Excel: SUM(Q_i : Q_i+14) — tablo dışı hücreler boş = 0)
    out.forEach((o, i) => {
      const sum = out.slice(i, i + 15).reduce((s, x) => s + (ok(x.Qc) ? x.Qc : 0), 0);
      o.R = o.G > 1 ? ((o.Qc > o.F * 10 || -o.Qc > o.F * 10 || sum > o.F * 10) ? 'DN, PN control' : 'DN, PN matched') : '';
      o.T = o.G > 1 ? (o.S > 1.8 ? 'V control' : 'V matched') : '';
    });
    const usedRows = out.filter(o => o.used);
    const last = usedRows[usedRows.length - 1];
    const required = last && ok(last.J) && ok(last.Qc) ? last.J + last.Qc : null; // en yukarı akış ucundaki gerekli basınç
    return { rows: out, required, totalLoss: usedRows.reduce((s, o) => s + (ok(o.O) ? o.O : 0), 0), totalDz: usedRows.reduce((s, o) => s + (ok(o.P) ? o.P : 0), 0),
      warnings: usedRows.filter(o => o.material && !o.pipeFound).map(o => o.i) };
  }

  // Projeden önerilen değerler (kullanıcı düzenleyebilir)
  function fieldFromProject(p, r, cropName) {
    const s = r.schedule, e = r.emitter, tree = r.field.tip === 'agac';
    return { crop: cropName, area: +r.field.da.toFixed(2), et: +s.gross.toFixed(2), T: s.hoursPerDay, Sr: r.field.Sr, Sp: r.field.Sp,
      nl: 1, q: e.q, Sd: +(tree ? r.field.Sp / e.ne : e.Se).toFixed(3), shifts: r.sectors.Ns, target: +r.manifold.Qmax.toFixed(1) };
  }
  // Seçilen shift için segmentler: en debili alt ünitenin manifoldu (Submain) + ana hat yolu (Main)
  function segmentsFromShift(r, j) {
    const gr = r.sel.groups[j]; if (!gr) return [];
    const u = gr.map(k => r.units[k]).reduce((a, b) => (b.path > a.path ? b : a));
    const pe = r.manifold.byPipe.find(b => b.pipe.od === u.pipe.od) || { pipe: u.pipe };
    const peMat = `HDPE100 ${u.pipe.od} mm`, pvcMat = `UPVC ${r.main.sel.od} mm`;
    const pick = (m, pn) => { const list = pnsOf(m); if (!list.length) return { material: '', pn: '' }; const best = list.filter(x => +x >= pn).sort((a, b) => a - b)[0] ?? list[list.length - 1]; return { material: m, pn: best }; };
    const sub = pick(peMat, pe.pipe.pn), main = pick(pvcMat, r.main.sel.pn);
    return [
      { type: 'Submain', ...sub, L: +u.Lm.toFixed(1), Q: +u.Q.toFixed(2), h1: 0, h2: 0, pmin: +u.hLatMax.toFixed(2) },
      { type: 'Main', ...main, L: +u.path.toFixed(1), Q: +r.sel.Qj[j].toFixed(2), h1: +(-u.rise).toFixed(2) },
    ];
  }

  const api = { systemField, friction, FIELD_IN, TYPES, MATERIALS, pnsOf, lookup, fieldFromProject, segmentsFromShift, ROUND, ROUNDUP, ROUNDDOWN };
  g.IrriHydroTable = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

// IrriGrow — MH-AKIL-2: otomatik shift ve kaynak kapasitesi alternatifleri
//
// Her alternatif GERÇEK hesap motoruyla (IrriEngine.design) yalnız ilgili girdi değiştirilerek hesaplanır;
// motorun formülleri, katsayıları ve seçim kuralları değişmez. Oran yöntemi kullanılmaz.
// Gerekli kaynak debisi, motorun kendi shift gruplama kuralından (layout.js partition/minSectors) bulunur,
// motorla doğrulanır ve 0,1 m³/h altının motorla uygun OLMADIĞI ayrıca denetlenir. Bulunan değer "motorun
// gruplama kuralı ve bu yerleşim için en küçük değer"dir; mutlak teorik minimum değildir.
//
// Üç hacim ayrı tutulur (docs/mh-akil-2-plan.md §3):
//   ihtiyac   = brüt ihtiyaç (mm/gün) × sulanması hedeflenen alan        (bitkinin gerçek ihtiyacı)
//   uygulanan = Σ damlatıcı debisi × shift süresi ÷ aralık                (motorun tur hesabı)
//   kaynak    = Q × günlük çalışma süresi
// Eksik damlatıcı yerleşimi ihtiyacı azaltmaz: kapasite uygunluğu için hem motorun tur denetimi hem de
// kaynak ≥ ihtiyaç koşulu gerekir.
(function (g) {
  const VER = 1, EPS = 1e-9, STEP = 0.1;
  const E = () => g.IrriEngine || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const Ly = () => g.IrriLayout || (typeof require !== 'undefined' ? require('./layout.js') : null);
  const AS = () => g.IrriAssess || (typeof require !== 'undefined' ? require('./assess.js') : null);
  const r1 = x => Math.round(x * 10) / 10;
  const up1 = x => Math.ceil(x * 10 - 1e-6) / 10;

  // Proje + motor sonucu imzası: girdiler veya sonuç değişince kayıtlı alternatifler geçersiz olur
  function sig(p, r) {
    const b = r && r.ok ? [r.sectors.Qfield, r.schedule.t, r.sel.cycleHours, r.sel.Ns, r.main.sel.Hmax, r.pump.kWh || 0, r.field.A] : null;
    const s = JSON.stringify({ inp: p && p.inp, poly: p && p.poly, src: p && p.src, station: p && p.station, route: p && p.route, edit: p && p.shiftEdit || null, b });
    let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0') + ':' + s.length;
  }

  // Hacimler (motor sonucundan; yalnız aritmetik)
  function volumes(r, Q, H) {
    const s = r.schedule, A = r.field.A;
    const ihtiyac = s.gross * A / 1000;                         // m³/gün
    const uygulanan = r.sectors.Qfield * s.t / s.interval;      // m³/gün
    return { ihtiyac, uygulanan, kaynak: Q * H, kapsama: uygulanan / ihtiyac };
  }
  // Bir motor sonucunun kapasite açısından durumu
  function capacityOk(r, Q, H) {
    if (!r || !r.ok) return false;
    const v = volumes(r, Q, H);
    return r.sel.feasible && v.kaynak + EPS >= v.ihtiyac;
  }

  // Motor çalıştırması → saklanabilir satır (yalnız sayılar ve kodlar)
  function row(id, aile, inp, r, extra) {
    const Q = Number(inp.Q), H = Number(inp.hours) || r.schedule.hoursPerDay, I = r.schedule.interval;
    const A = AS().evaluate(r, { inp, k: extra && extra.k });
    const acik = A.findings.filter(x => x.seviye === 'uygunsuz' && x.kod !== 'W-KAP-01').map(x => x.kod);
    const v = volumes(r, Q, H), kapOk = capacityOk(r, Q, H), m = r.main.sel, p = r.pump;
    const durum = !kapOk ? 'uygunsuz' : acik.length ? 'kapasite-uygun' : 'uygun';
    return Object.assign({
      id, aile, girdi: { Q, H, I, Ns: inp.Ns ? Number(inp.Ns) : null },
      Ns: r.sel.Ns, Qmax: r.sel.Qmax, cycle: r.sel.cycleHours, avail: r.sel.avail, feasible: r.sel.feasible,
      Hmax: m.Hmax, motor: p.need ? p.motor : 0, pompa: !!p.need, kWh: p.kWh || 0, energyCost: r.schedule.energyCost || 0,
      od: m.od, pn: m.pn, v: m.v, hacim: v, kapasiteUygun: kapOk, acik, durum,
    }, extra || {});
  }

  // Motorun gruplama kuralıyla Nmax shift'e sığmak için gereken en küçük debi
  function qForShifts(Qu, nmax) {
    if (nmax < 1) return Infinity;
    const gr = Ly().partition(Qu, nmax).filter(x => x.length);
    if (gr.length > nmax) return Infinity;
    return Math.max(...gr.map(x => x.reduce((a, k) => a + Qu[k], 0)));
  }

  // Çözümleyici: üreteç; her adımda bir motor çalıştırması yapar (arayüz parça parça yürütür)
  function* steps(base, inp0, prices, opt0, ctx = {}) {
    const des = E().design, opt = Object.assign({}, opt0 || {}, { manual: null });
    const s = base.schedule, t = s.t, I0 = s.interval, H0 = s.hoursPerDay, Q0 = Number(inp0.Q);
    const rows = [], notes = [];
    const run = function* (inp) { const r = des(inp, prices, opt); yield 1; return r; };
    const withInp = o => Object.assign({}, inp0, o);
    const v0 = volumes(base, Q0, H0);

    // A. Mevcut durum
    rows.push(row('mevcut', 'mevcut', inp0, base, { k: ctx.k }));

    // B. Shift sayısı (motorun hesapladığı sectorAlts; ayrı çalıştırma gerekmez)
    const auto = base.sectorAlts.filter(a => !a.manual);
    const nsLB = Math.ceil(base.sectors.Qfield / Q0 - EPS);
    const shift = auto.map(a => ({ Ns: a.Ns, Qmax: a.Qmax, cycle: a.cycleHours, avail: a.avail, feasible: a.feasible, fails: AS().altChecks(a, Q0).length }));
    const shiftOzet = { nsLB, cycLB: nsLB * t, avail: base.sel.avail, kanit: nsLB * t > base.sel.avail + EPS, liste: shift };

    // C/E. Kaynak debisi (verilen H için)
    function* findQ(H, aile, id) {
      const nmax = Math.floor(H * I0 / t + EPS);
      const qNeed = v0.ihtiyac / H;                              // brüt ihtiyaç koşulu (gerekli)
      let Qu = base.units.map(u => u.Q), Q = null, r = null, tries = 0, iters = 0;
      if (nmax < 1) return { id, aile, H, imkansiz: true, nmax };
      for (; iters < 6; iters++) {
        const q = Math.max(qForShifts(Qu, nmax), qNeed, Q0 + STEP);
        if (!Number.isFinite(q)) return { id, aile, H, imkansiz: true, nmax };
        const Qn = Math.max(up1(q), Q != null ? Q : 0);
        r = yield* run(withInp({ Q: Qn, hours: H })); Q = Qn;
        if (capacityOk(r, Q, H)) break;
        const nu = r.ok ? r.units.map(u => u.Q) : Qu;
        if (JSON.stringify(nu) === JSON.stringify(Qu)) break;   // yerleşim değişmedi: adım adım artır
        Qu = nu;
      }
      while (!capacityOk(r, Q, H) && tries < 30) { Q = r1(Q + STEP); r = yield* run(withInp({ Q, hours: H })); tries++; }
      if (!capacityOk(r, Q, H)) return { id, aile, H, bulunamadi: true, Q, nmax };
      const rb = Q - STEP > Q0 ? yield* run(withInp({ Q: r1(Q - STEP), hours: H })) : null;
      const altUygun = rb ? capacityOk(rb, r1(Q - STEP), H) : false;
      const out = row(id, aile, withInp({ Q, hours: H }), r, { k: ctx.k, nmax, qPartition: qForShifts(r.units.map(u => u.Q), nmax), qNeed, enKucuk: !altUygun, altQ: rb ? r1(Q - STEP) : null, altCycle: rb && rb.ok ? rb.sel.cycleHours : null, altFeasible: altUygun });
      return out;
    }
    const kay = yield* findQ(H0, 'kaynak', 'kaynak');
    rows.push(kay);

    // D. Günlük çalışma süresi (Q aynı)
    {
      const hNeed = Math.max(base.sel.cycleHours / I0, v0.ihtiyac / Q0);
      if (hNeed > 24 + EPS) {
        const H = 24, r = H0 < 24 ? yield* run(withInp({ hours: H })) : base;
        rows.push(row('sure', 'sure', withInp({ hours: H }), r, { k: ctx.k, hNeed, kanit: true }));
      } else if (hNeed > H0 + EPS) {
        let H = Math.min(24, Math.ceil(hNeed * 2 - 1e-6) / 2), r = yield* run(withInp({ hours: H }));
        while (!capacityOk(r, Q0, H) && H < 24) { H = Math.min(24, H + 0.5); r = yield* run(withInp({ hours: H })); }
        rows.push(row('sure', 'sure', withInp({ hours: H }), r, { k: ctx.k, hNeed, kanit: false }));
      }
    }

    // E. Kaynak + süre (en çok 3 ek süre değeri)
    const Hs = [...new Set([H0 + 2, H0 + 4, 24].map(h => Math.min(24, h)).filter(h => h > H0 + EPS))];
    for (const H of Hs) rows.push(yield* findQ(H, 'kaynak-sure', 'kaynak-sure-' + H));

    // F. Sulama aralığı (1…Imax, mevcut hariç; Imax üstünü motor düşürdüğü için hesaplanmaz)
    for (let I = 1; I <= Math.min(s.Imax, 7); I++) {
      if (I === I0) continue;
      const r = yield* run(withInp({ interval: I }));
      if (r.ok && r.schedule.interval === I) rows.push(row('aralik-' + I, 'aralik', withInp({ interval: I }), r, { k: ctx.k }));
    }
    if (s.Imax < 7) notes.push({ kod: 'aralik-imax', Imax: s.Imax });

    return { surum: VER, tarih: ctx.tarih || null, Q0, H0, I0, t, hacim0: v0, shift: shiftOzet, rows, notes };
  }

  function runSync(base, inp, prices, opt, ctx) { const it = steps(base, inp, prices, opt, ctx); let x; let n = 0; do { x = it.next(); if (!x.done) n++; } while (!x.done); x.value.calistirma = n; return x.value; }
  async function run(base, inp, prices, opt, ctx = {}) {
    const it = steps(base, inp, prices, opt, ctx); let x, n = 0;
    do { x = it.next(); if (!x.done) { n++; if (ctx.onProgress) ctx.onProgress(n); await new Promise(res => setTimeout(res, 0)); } } while (!x.done);
    x.value.calistirma = n; return x.value;
  }
  // Projeye saklanacak özet (yalnız sayılar ve kodlar)
  const pack = (p, r, res) => Object.assign({ sig: sig(p, r) }, res);
  const valid = (p, r) => !!(p && p.akil && p.akil.alternatifler && r && r.ok && p.akil.alternatifler.sig === sig(p, r) && p.akil.alternatifler.surum === VER);

  const api = { VER, sig, volumes, capacityOk, qForShifts, steps, runSync, run, pack, valid };
  g.IrriSolver = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

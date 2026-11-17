// IrriGrow — katalogdan ekipman seçimi ve fiyat çözümleme
(function (g) {
  const G = 9.81;
  const MOTOR_KW = [0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250, 315];

  // Katalog doğrulama: içe aktarılan JSON için yapısal kontrol
  function checkCatalog(c) {
    const e = [];
    if (!c || typeof c !== 'object') return ['Katalog bir JSON nesnesi olmalı'];
    const num = (v, f, i, s) => { if (!(typeof v === 'number' && Number.isFinite(v) && v > 0)) e.push(`${s}[${i}].${f} pozitif sayı olmalı`); };
    (c.pompa || []).forEach((p, i) => {
      if (!p.id) e.push(`pompa[${i}].id eksik`);
      if (!['dalgic', 'santrifuj', 'booster', 'dikey'].includes(p.tip)) e.push(`pompa[${i}].tip dalgic/santrifuj/booster/dikey olmalı`);
      num(p.motorKw, 'motorKw', i, 'pompa');
      if (!Array.isArray(p.egri) || p.egri.length < 3) e.push(`pompa[${i}].egri en az 3 nokta [Q m³/h, H m, verim %] içermeli`);
      else p.egri.forEach((pt, k) => { if (!Array.isArray(pt) || pt.length < 3 || pt.some(x => typeof x !== 'number' || !Number.isFinite(x) || x < 0)) e.push(`pompa[${i}].egri[${k}] geçersiz`); });
    });
    (c.filtre || []).forEach((f, i) => { if (!f.id) e.push(`filtre[${i}].id eksik`); if (!['disk', 'elek', 'hidrosiklon', 'kum'].includes(f.tip)) e.push(`filtre[${i}].tip geçersiz`); num(f.qMax, 'qMax', i, 'filtre'); num(f.hTemiz, 'hTemiz', i, 'filtre'); });
    (c.vana || []).forEach((v, i) => { if (!v.id) e.push(`vana[${i}].id eksik`); num(v.qMax, 'qMax', i, 'vana'); num(v.kv, 'kv', i, 'vana'); });
    const b = c.borular || {};
    for (const k of ['pe', 'pvc']) (b[k] || []).forEach((p, i) => { num(p.od, 'od', i, k); num(p.ic, 'ic', i, k); num(p.pn, 'pn', i, k); if (p.ic >= p.od) e.push(`${k}[${i}] iç çap dış çaptan küçük olmalı`); });
    (b.lateral || []).forEach((p, i) => { num(p.od, 'od', i, 'lateral'); num(p.ic, 'ic', i, 'lateral'); num(p.maxH, 'maxH', i, 'lateral'); });
    return e;
  }
  // Varsayılan katalog + kullanıcı kataloğu (aynı id'ler kullanıcınınkiyle değişir; bölüm 'yalnizKullanici' ise jenerikler çıkarılır)
  function mergeCatalog(base, user) {
    if (!user) return base;
    const out = JSON.parse(JSON.stringify(base));
    const merge = (dst, src, only) => { if (!Array.isArray(src)) return dst; const m = new Map((only ? [] : dst).map(x => [x.id || `${x.od}-${x.pn}`, x])); for (const x of src) m.set(x.id || `${x.od}-${x.pn}`, x); return [...m.values()]; };
    const only = user.yalnizKullanici || {};
    out.pompa = merge(out.pompa, user.pompa, only.pompa); out.filtre = merge(out.filtre, user.filtre, only.filtre); out.vana = merge(out.vana, user.vana, only.vana);
    for (const k of ['pe', 'pvc', 'lateral']) out.borular[k] = merge(out.borular[k], (user.borular || {})[k], only[k]);
    return out;
  }

  function curveAt(egri, Q) {
    const pts = [...egri].sort((a, b) => a[0] - b[0]);
    if (Q < pts[0][0] - 1e-9 || Q > pts[pts.length - 1][0] + 1e-9) return null;
    for (let i = 0; i < pts.length - 1; i++) {
      const [q1, h1, e1] = pts[i], [q2, h2, e2] = pts[i + 1];
      if (Q >= q1 - 1e-9 && Q <= q2 + 1e-9) { const t = q2 > q1 ? (Q - q1) / (q2 - q1) : 0; return { H: h1 + t * (h2 - h1), eta: e1 + t * (e2 - e1) }; }
    }
    return { H: pts[pts.length - 1][1], eta: pts[pts.length - 1][2] };
  }

  // duties: [{Q m³/h, H m, hours}] — pompa her shift debisinde gerekli basıncı vermeli
  function selectPump(cat, tips, duties) {
    const cands = [];
    for (const p of (cat.pompa || [])) {
      if (!tips.includes(p.tip)) continue;
      let ok = true, E = 0, Pmax = 0, over = 1, pts = [];
      for (const d of duties) {
        const c = curveAt(p.egri, d.Q);
        if (!c || c.H < d.H - 1e-9 || !(c.eta > 5)) { ok = false; break; }
        const P = G * d.Q / 3600 * c.H / (c.eta / 100);
        Pmax = Math.max(Pmax, P); E += P * d.hours; over = Math.max(over, c.H / Math.max(d.H, 0.1)); pts.push({ Q: d.Q, Hreq: d.H, H: c.H, eta: c.eta, P });
      }
      if (!ok || Pmax > p.motorKw * 1.0001) continue;
      cands.push({ p, E, Pmax, over, pts });
    }
    cands.sort((a, b) => a.E - b.E || a.p.motorKw - b.p.motorKw);
    return { best: cands[0] || null, count: cands.length, list: cands.slice(0, 5) };
  }
  function genericPump(Q, H) {
    const Phyd = G * Q / 3600 * H, shaft = Phyd / 0.70;
    return { Phyd, shaft, motor: MOTOR_KW.find(k => k >= shaft * 1.10) || MOTOR_KW[MOTOR_KW.length - 1] };
  }

  function filterPlan(srcType, waterQ) {
    if (srcType === 'yuzey') return ['kum', 'disk'];
    if (srcType === 'kuyu' && waterQ !== 'temiz') return ['hidrosiklon', 'disk'];
    return ['disk'];
  }
  function selectFilter(cat, srcType, waterQ, Q) {
    const items = [], missing = [];
    for (const tip of filterPlan(srcType, waterQ)) {
      const list = (cat.filtre || []).filter(f => f.tip === tip).sort((a, b) => a.qMax - b.qMax);
      if (!list.length) { missing.push(tip); continue; }
      let f = list.find(x => x.qMax >= Q) || list[list.length - 1];
      let n = Math.ceil(Q / f.qMax - 1e-9);
      if (tip === 'kum') n = Math.max(2, n); // ters yıkama için en az 2 tank
      items.push({ f, n });
    }
    const loss = Qx => items.reduce((t, { f, n }) => t + f.hTemiz * Math.pow(Qx / (n * f.qMax), 2) + (f.kirlenme || 0), 0) + missing.length * 5;
    return { items, missing, loss, text: items.map(({ f, n }) => `${n} × ${f.ad}${f.mesh ? ` (${f.mesh} mesh)` : ''}`).join(' + ') || '—' };
  }
  function selectValve(cat, Q) {
    const list = (cat.vana || []).filter(v => !v.tip || v.tip === 'sektor').sort((a, b) => a.qMax - b.qMax);
    if (!list.length) return { v: null, loss: () => 1.5, text: 'Katalogda vana yok (1,5 m kayıp kabul edildi)' };
    const v = list.find(x => x.qMax >= Q) || list[list.length - 1];
    return { v, over: v.qMax < Q, loss: Qx => 10.2 * Math.pow(Qx / v.kv, 2), text: v.ad };
  }

  // Fiyat: kullanıcı (kalem fiyatı veya düzenlenmiş ayar) > katalog > örnek ayar değeri > yok
  function priceOf(settings, key, catItem) {
    const s = settings || {}, items = s.items || {}, ed = s.edited || {};
    if (items[key] != null && Number.isFinite(+items[key])) return { v: +items[key], src: 'kullanici' };
    const [a, b, c] = key.split(':');
    const legacy = (lk, v, mult = 1) => (v != null && Number.isFinite(+v)) ? { v: +v * mult, src: ed[lk] && mult === 1 ? 'kullanici' : 'ornek' } : null;
    let r = null;
    if (a === 'lateral') r = legacy('lateral' + b, s['lateral' + b]);
    else if (a === 'damlatici') r = legacy('damlatici', s.damlatici);
    else if (a === 'startKonnektor') r = legacy('startKonnektor', s.startKonnektor);
    else if (a === 'lateralSonu') r = legacy('laterlSonu', s.laterlSonu);
    else if (a === 'korLateral') r = legacy('lateral' + b, s['lateral' + b], 0.8);
    else if (a === 'pe' && s.pe) r = legacy('pe.' + b, s.pe[b], ({ 10: 1.45, 16: 2.0 })[c] || 1);
    else if (a === 'pvc' && s.pvc) r = legacy('pvc.' + b, s.pvc[b], ({ 10: 1.5, 16: 2.2 })[c] || 1);
    if (r && r.src === 'kullanici') return r;
    if (catItem && catItem.fiyat != null && catItem.fiyat !== '' && Number.isFinite(+catItem.fiyat)) return { v: +catItem.fiyat, src: 'katalog' };
    if (r) return r;
    return { v: null, src: null };
  }

  g.IrriCatalog = { checkCatalog, mergeCatalog, curveAt, selectPump, genericPump, selectFilter, selectValve, priceOf, MOTOR_KW };
  if (typeof module !== 'undefined') module.exports = g.IrriCatalog;
})(typeof window !== 'undefined' ? window : globalThis);

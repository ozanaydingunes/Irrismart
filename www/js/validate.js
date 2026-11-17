// IrriGrow — girdi doğrulama. Hesaplama yalnızca temizlenmiş değerlerle yapılır.
(function (g) {
  const D = g.IRRI_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);

  const RULES = {
    area_da: { lab: 'Alan', unit: 'da', min: 0.1, max: 100000 },
    L: { lab: 'Uzun kenar', unit: 'm', min: 1, max: 20000 },
    W: { lab: 'Kısa kenar', unit: 'm', min: 1, max: 20000 },
    slopeLong: { lab: 'Uzun kenar eğimi', unit: '%', min: 0, max: 30 },
    slopeShort: { lab: 'Kısa kenar eğimi', unit: '%', min: 0, max: 30 },
    Sr: { lab: 'Sıra arası', unit: 'm', min: 0.2, max: 20 },
    Sp: { lab: 'Sıra üzeri', unit: 'm', min: 0.05, max: 20 },
    q: { lab: 'Damlatıcı debisi', unit: 'l/h', min: 0.3, max: 30 },
    Se: { lab: 'Damlatıcı aralığı', unit: 'm', min: 0.1, max: 3 },
    ne: { lab: 'Ağaç başına damlatıcı', unit: 'adet', min: 1, max: 24, int: true },
    hNom: { lab: 'Çalışma basıncı', unit: 'm', min: 3, max: 40 },
    x: { lab: 'Akış üssü x', unit: '', min: 0.05, max: 1 },
    pcMin: { lab: 'PC min. basınç', unit: 'm', min: 3, max: 40 },
    pcMax: { lab: 'PC maks. basınç', unit: 'm', min: 5, max: 60 },
    et0: { lab: 'Tepe ET0', unit: 'mm/gün', min: 0.5, max: 15 },
    kc: { lab: 'Kc', unit: '', min: 0.1, max: 1.5 },
    Gc: { lab: 'Örtü oranı', unit: '', min: 0.05, max: 1 },
    Ea: { lab: 'Uygulama randımanı', unit: '', min: 0.5, max: 1 },
    interval: { lab: 'Sulama aralığı', unit: 'gün', min: 1, max: 30, int: true },
    Q: { lab: 'Kaynak debisi', unit: 'm³/h', min: 0.1, max: 3000 },
    depth: { lab: 'Dinamik seviye / emme', unit: 'm', min: 0, max: 500 },
    pAvail: { lab: 'Mevcut basınç', unit: 'bar', min: 0, max: 16 },
    dSource: { lab: 'Kaynak–arazi mesafesi', unit: 'm', min: 0, max: 20000 },
    dZ: { lab: 'Kot farkı', unit: 'm', min: -300, max: 300, signed: true },
    hours: { lab: 'Günlük çalışma', unit: 'saat', min: 1, max: 24 },
    mainOd: { lab: 'Ana hat çapı', unit: 'mm', min: 20, max: 1000 },
    Ns: { lab: 'Shift sayısı', unit: '', min: 1, max: 1000, int: true },
    nB: { lab: 'Manifold hattı sayısı', unit: '', min: 1, max: 60, int: true },
  };
  const ENUMS = {
    crop: () => Object.keys(D.CROPS), region: () => Object.keys(D.REGIONS), soil: () => Object.keys(D.SOILS),
    srcType: () => ['kuyu', 'yuzey', 'sebeke'], rowDir: () => ['uzun', 'kisa'], emitter: () => ['normal', 'pc'],
    latD: () => ['', '16', '20'], teleskop: () => ['', 'evet', 'hayir'], waterQ: () => ['', 'temiz'], geom: () => ['dikdortgen', 'parsel'],
  };

  // "1,5", " 2 ", 3 → sayı; boş → null; geçersiz ("1.2.3", "abc", Infinity) → NaN
  function parseNum(v) {
    if (v === undefined || v === null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    if (typeof v !== 'string') return NaN;
    let s = v.trim().replace(/\s+/g, '');
    if (s === '') return null;
    s = s.replace(',', '.'); // Türkçe ondalık virgül
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
    const n = Number(s); return Number.isFinite(n) ? n : NaN;
  }
  const fmt = v => String(v).replace('.', ',');
  const T = (x, p) => g.IrriI18n ? g.IrriI18n.t(x, p) : x.replace(/\{(\w+)\}/g, (m, k) => (p && p[k] !== undefined ? p[k] : m));

  function validate(inp) {
    inp = inp && typeof inp === 'object' ? inp : {};
    const clean = {}, errors = {}, warnings = [];
    for (const [k, r] of Object.entries(RULES)) {
      const v = parseNum(inp[k]);
      if (v === null) continue;
      const u = r.unit ? ' ' + T(r.unit) : '', lab = T(r.lab);
      if (Number.isNaN(v)) errors[k] = T('{l}: geçerli bir sayı girin', { l: lab });
      else if (v < 0 && !r.signed) errors[k] = T('{l} negatif olamaz', { l: lab });
      else if (v < r.min) errors[k] = T('{l} en az {v} olmalı', { l: lab, v: fmt(r.min) + u });
      else if (v > r.max) errors[k] = T('{l} en fazla {v} olabilir', { l: lab, v: fmt(r.max) + u });
      else if (r.int && !Number.isInteger(v)) errors[k] = T('{l} tam sayı olmalı', { l: lab });
      else clean[k] = v;
    }
    for (const [k, list] of Object.entries(ENUMS)) {
      const v = inp[k];
      if (v === undefined || v === null || v === '') { if (k !== 'crop') continue; }
      if (list().includes(String(v ?? ''))) clean[k] = String(v);
      else if (k === 'crop') errors.crop = T('Bitki türü seçilmedi');
      else errors[k] = T('Geçersiz seçim');
    }
    if (Array.isArray(inp.months)) clean.months = inp.months.filter(m => Number.isInteger(m) && m >= 1 && m <= 12);
    if (inp.grad && Number.isFinite(inp.grad.gx) && Number.isFinite(inp.grad.gy) && Math.hypot(inp.grad.gx, inp.grad.gy) < 0.5) clean.grad = { gx: inp.grad.gx, gy: inp.grad.gy };

    // Alanlar arası kontroller
    if (clean.pcMin != null && clean.pcMax != null && clean.pcMin >= clean.pcMax) errors.pcMax = T('PC maks. basınç, min. basınçtan büyük olmalı');
    if (clean.Se != null && clean.Sp != null && D.CROPS[clean.crop] && D.CROPS[clean.crop].tip === 'serit' && clean.Se > 3 * clean.Sp) warnings.push(T('Damlatıcı aralığı sıra üzeri mesafenin 3 katından büyük; ıslatma şeridi kesintili olabilir.'));
    if (clean.L != null && clean.W != null && clean.area_da != null) {
      const r = clean.L * clean.W / (clean.area_da * 1000);
      if (r < 0.5 || r > 2) warnings.push(T('Girilen en × boy, alanla uyumsuz; en-boy alana göre ölçeklenecek.'));
    }
    if ((clean.slopeLong || 0) > 15 || (clean.slopeShort || 0) > 15) warnings.push(T('Eğim %15 üzerinde: teraslama ve basınç ayarlı damlatıcı değerlendirilmelidir.'));
    if (clean.emitter !== 'pc' && clean.hNom != null && clean.hNom > 25) warnings.push(T('Normal damlatıcı için çalışma basıncı yüksek; ürün kataloğunu kontrol edin.'));
    if (clean.Q != null && clean.area_da != null && clean.Q / clean.area_da < 0.05) warnings.push(T('Kaynak debisi alana göre çok düşük; shift sayısı ve sulama süresi çok artabilir.'));
    if (clean.srcType === 'yuzey' && clean.depth != null && clean.depth > 7) warnings.push(T('Emme yüksekliği 7 m üzerinde: yüzey santrifüj pompa emme yapamaz, dalgıç/dikey pompa gerekir.'));
    return { ok: Object.keys(errors).length === 0, clean, errors, warnings };
  }

  g.IrriValidate = { validate, parseNum, RULES, ENUMS };
  if (typeof module !== 'undefined') module.exports = g.IrriValidate;
})(typeof window !== 'undefined' ? window : globalThis);

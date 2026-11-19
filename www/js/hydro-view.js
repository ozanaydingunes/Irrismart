// IrriGrow — Profesyonel hidrolik paneli: görünüm modeli (MH-1)
// Motorun (engine.js) tasarım sonucunu, panelin 8 sekmesi için düzenler. HİÇBİR hidrolik hesap yapmaz:
// her sayı motor sonucundan okunur ya da yalnızca birim dönüşümü / toplama / oran (ör. m → bar, Q·t = hacim)
// ile türetilir. Henüz motorda olmayan büyüklükler (Darcy-Weisbach, düğüm basıncı, pompa BEP) üretilmez.
// Masaüstü ve mobil aynı modelden çizilir (hydro-panel.js).
(function (g) {
  const BAR = 10.2;                       // 1 bar ≈ 10,2 m su sütunu (motorla aynı)
  const V_OK = 1.5, V_MAX = 2.0;          // ana hat hız sınırları (motor: seçimde ≤ 2,0; öneri ≤ 1,5 m/s)

  // Değer kaynağı etiketleri
  const SRC = { girdi: 'Girdi', varsayilan: 'Varsayılan', hesap: 'Hesap', katalog: 'Katalog', jenerik: 'Jenerik (temsili)', ornek: 'Örnek fiyat', kullanici: 'Kullanıcı fiyatı', harita: 'Harita (DEM)', otomatik: 'Otomatik', elle: 'Elle' };
  const given = (inp, k) => inp && inp[k] !== undefined && inp[k] !== null && String(inp[k]).trim() !== '';
  const srcOf = (inp, ...keys) => keys.some(k => given(inp, k)) ? 'girdi' : 'varsayilan';

  const row = (label, v, d, unit, src, extra) => Object.assign({ label, v, d, unit: unit || '', src: src || 'hesap' }, extra || {});
  const lvl = (ok, warn) => ok ? 'ok' : warn ? 'warn' : 'bad';
  const T = x => ({ t: x });              // çevrilecek metin (kodlar, katalog adları ve sayılar çevrilmez)
  const PUMP = { dalgic: 'Dalgıç pompa', santrifuj: 'Yatay santrifüj pompa', booster: 'Hat üstü (booster) pompa', dikey: 'Dikey türbin pompa' };
  const SOURCE = { kuyu: 'Kuyu', yuzey: 'Göl/kanal/havuz', sebeke: 'Şebeke/hidrant' };
  const FILTER = { disk: 'Disk', elek: 'Elek', hidrosiklon: 'Hidrosiklon', kum: 'Kum-çakıl' };
  const vStatus = v => v <= V_OK + 1e-9 ? 'ok' : v <= V_MAX + 1e-9 ? 'warn' : 'bad';

  function build(r, ctx = {}) {
    if (!r || !r.ok) return { ok: false, err: r ? r.err : [] };
    const inp = ctx.inp || {}, Qsrc = Number(ctx.Qsource) || null;
    const f = r.field, e = r.emitter, lat = r.lateral, s = r.schedule, sel = r.sel, ms = r.main.sel, p = r.pump, h = r.head;
    const Ns = sel.groups.length, units = r.units, net = r.main.net;
    const shiftOf = []; sel.groups.forEach((gr, j) => gr.forEach(k => { shiftOf[k] = j; }));
    const crit = ms.crit || [];
    const shiftA = j => sel.Qj[j] / r.sectors.Qfield * f.da;          // alan payı debi oranından (mevcut uygulamayla aynı)
    const pumpTemsili = p.need && (!p.fromCatalog || !p.verified);
    // ---------- Mühendislik kontrolleri: MH-AKIL-1 uyarı katmanından (Sonuç, PDF ve Excel ile aynı kaynak) ----------
    const AS = g.IrriAssess || (typeof require !== 'undefined' ? require('./assess.js') : null);
    const assess = ctx.assess || AS.evaluate(r, { inp, Qsource: Qsrc, k: ctx.k });
    const checks = assess.checks.slice();
    const vMain = Math.max(...net.map(x => x.v), 0), vMainSt = vStatus(vMain);
    const count = { bad: checks.filter(c => c.level === 'bad').length, warn: checks.filter(c => c.level === 'warn').length, ok: checks.filter(c => c.level === 'ok').length };

    // ---------- Kritik güzergâh (seçili düzende en yüksek H'li shift) ----------
    const jCrit = ms.H.indexOf(Math.max(...ms.H));
    const pathOf = j => { const c = crit[j]; if (!c) return null; const u = units[c.k]; return { j, unit: c.k, segs: u.segs.map(i => net[i].id), L: u.path, H: ms.H[j] }; };
    const critPath = pathOf(jCrit);

    // ---------- 1. Sistem Özeti ----------
    const dailyM3 = s.gross * f.A / 1000;              // mm × m² / 1000 = m³
    const latLen = lat.len, manLen = units.reduce((t, u) => t + Math.abs(u.yEnd - u.yIn), 0);
    const ozet = {
      kpis: [
        row('Arazi alanı', f.da, 2, 'da', f.mode === 'parsel' ? 'harita' : srcOf(inp, 'area_da', 'L', 'W'), { sub: [f.da / 10, 2, 'ha'] }),
        row('Sistem debisi', r.sectors.Qfield, 2, 'm³/h', 'hesap', { sub: [lat.emitters, 0, 'damlatıcı'] }),
        row('Eşzamanlı debi', sel.Qmax, 2, 'm³/h', 'hesap', { sub: Qsrc ? [Qsrc, 2, 'm³/h kaynak'] : null }),
        row('Shift sayısı', Ns, 0, '', sel.manual ? 'elle' : 'otomatik', { sub: [s.t, 2, 'h / shift'] }),
        row('Görev noktası', p.need ? p.H : ms.Hmax, 1, 'm', p.need ? (pumpTemsili ? 'jenerik' : 'katalog') : 'hesap', { sub: [p.need ? p.Q : sel.Qmax, 2, 'm³/h'] }),
        row('Yıllık enerji', p.kWh || 0, 0, 'kWh', s.epSrc === 'kullanici' ? 'kullanici' : 'ornek', { sub: [(p.kWh || 0) * (s.energyCost / Math.max(s.kWh || 1e-9, 1e-9)), 0, '₺'] }),
      ],
      water: [
        row('Tepe ET₀', s.et0, 2, 'mm/gün', srcOf(inp, 'et0')), row('Bitki katsayısı Kc', s.kc, 2, '', srcOf(inp, 'kc')), row('Örtü katsayısı Kr', s.Kr, 2, '', srcOf(inp, 'Gc')),
        row('Uygulama randımanı Ea', s.Ea, 2, '', srcOf(inp, 'Ea')),
        row('Net ihtiyaç', s.net, 2, 'mm/gün'), row('Brüt ihtiyaç', s.gross, 2, 'mm/gün'),
        row('Günlük hacim (tepe)', dailyM3, 0, 'm³'), row('Sezonluk hacim', s.seasonM3, 0, 'm³'),
        row('Sulama aralığı', s.interval, 0, 'gün', srcOf(inp, 'interval')), row('Shift süresi', s.t, 2, 'h'),
        row('Tur süresi', s.cycleHours, 1, 'h', 'hesap', { status: lvl(sel.feasible), sub: [s.hoursPerDay * s.interval, 0, 'h kullanılabilir'] }),
      ],
      lengths: [
        row('Ana hat', r.field.Lmain, 0, 'm'), row('Manifold', manLen, 0, 'm', 'hesap', { sub: [units.length, 0, 'adet'] }),
        row('Lateral', latLen, 0, 'm', 'hesap', { sub: [lat.count, 0, 'adet'] }), row('Damlatıcı', lat.emitters, 0, 'adet'),
      ],
      pressure: [
        row('En düşük gerekli H', Math.min(...ms.H), 2, 'm', 'hesap', { bar: Math.min(...ms.H) / BAR }),
        row('En yüksek gerekli H', Math.max(...ms.H), 2, 'm', 'hesap', { bar: Math.max(...ms.H) / BAR }),
        row('Manifold giriş basıncı', Math.max(...units.map(u => u.hIn)), 2, 'm', 'hesap', { bar: Math.max(...units.map(u => u.hIn)) / BAR }),
        row('Lateral giriş basıncı', lat.hreqMax, 2, 'm', 'hesap', { bar: lat.hreqMax / BAR }),
      ],
      shiftBars: ms.H.map((H, j) => ({ j, H, Hd: ms.Hd[j], Q: sel.Qj[j], pumpH: p.need && p.fromCatalog ? p.pts[j].H : null })),
      critPath,
      engineWarn: r.warn, otherWarn: assess.other,
    };

    // ---------- 2. Lateral ----------
    const lats = (r.layout.laterals || []).slice().sort((a, b) => b.dH - a.dH || b.len - a.len).slice(0, 10);
    const lateral = {
      emitter: [
        row('Damlatıcı tipi', T(e.pc ? 'Basınç ayarlı (PC)' : 'Normal'), null, '', srcOf(inp, 'emitter')),
        row('Damlatıcı debisi q', e.q, 2, 'l/h', srcOf(inp, 'q')),
        row(f.tip === 'agac' ? 'Ağaç başına damlatıcı' : 'Damlatıcı aralığı', f.tip === 'agac' ? e.ne : e.Se, 2, f.tip === 'agac' ? 'adet' : 'm', srcOf(inp, f.tip === 'agac' ? 'ne' : 'Se')),
        e.pc ? row('PC en düşük basınç', e.pcMin, 1, 'm', srcOf(inp, 'pcMin')) : row('Nominal basınç hₙ', e.hNom, 1, 'm', srcOf(inp, 'hNom')),
        e.pc ? row('PC en yüksek basınç', e.pcMax, 1, 'm', srcOf(inp, 'pcMax')) : null,
        e.pc ? null : row('Akış üssü x', e.x, 2, '', srcOf(inp, 'x')),
        row('İzin verilen basınç farkı', e.dHallow, 2, 'm', 'hesap', { note: e.pc ? 'PC aralığı' : 'debi farkı %10' }),
      ].filter(Boolean),
      pipe: [
        row('Lateral dış çapı', lat.d, 0, 'mm', srcOf(inp, 'latD')), row('Lateral iç çapı', lat.ic, 1, 'mm', 'katalog'),
        row('Lateralin payı (%55)', e.allowLat, 2, 'm'), row('Azami lateral boyu', lat.Lmax, 1, 'm'),
        row('En uzun lateral', lat.maxLen, 1, 'm'), row('Lateral sayısı', lat.count, 0, 'adet'),
        row('Toplam lateral', lat.len, 0, 'm'), row('Kör (damlatıcısız) boy', lat.lead, 0, 'm'),
        row('Damlatıcı sayısı', lat.emitters, 0, 'adet'),
      ],
      hyd: [
        row('En büyük basınç farkı ΔH', lat.maxDH, 2, 'm', 'hesap', { status: lvl(lat.maxDH <= e.allowLat + 1e-9), ratio: lat.maxDH / e.allowLat }),
        row('En büyük sürtünme', lat.hfMax, 2, 'm'), row('En büyük giriş hızı', lat.vMax, 2, 'm/s'),
        row('Gerekli giriş basıncı', lat.hreqMax, 2, 'm', 'hesap', { bar: lat.hreqMax / BAR }),
        row('Eğim (lateral yönü)', f.sLat, 2, '%', f.gradKnown ? 'harita' : srcOf(inp, 'slopeLong', 'slopeShort')),
      ],
      table: { cols: [['Bant', '', 0], ['Yön', '', null], ['Uzunluk', 'm', 1], ['Damlatıcı', 'adet', 0], ['Debi', 'l/h', 0], ['Sürtünme', 'm', 2], ['ΔH', 'm', 2], ['Gerekli basınç', 'm', 2]],
        rows: lats.map(l => ({ status: lvl(l.dH <= e.allowLat + 1e-9), cells: [l.band + 1, l.side < 0 ? '◀' : '▶', l.len, l.N, l.Q, l.hf, l.dH, l.hreq] })) },
      slopeNote: !f.gradKnown && f.sLat > 0,
    };

    // ---------- 3. Manifold ----------
    const manifold = {
      summary: [
        row('Manifold sayısı', units.length, 0, 'adet'), row('Toplam uzunluk', manLen, 0, 'm'),
        row('En büyük debi', r.manifold.Qmax, 2, 'm³/h'), row('En büyük hız', r.manifold.vMax, 2, 'm/s', 'hesap', { status: lvl(r.manifold.vMax <= 1.5 + 1e-9) }),
        row('En büyük basınç değişimi', r.manifold.varMax, 2, 'm', 'hesap', { status: lvl(r.manifold.varMax <= e.allowMan + 1e-9), ratio: r.manifold.varMax / e.allowMan }),
        row('İzin verilen (%45)', e.allowMan, 2, 'm'),
      ],
      byPipe: r.manifold.byPipe.map(b => ({ pipe: `PE100 Ø${b.pipe.od} PN${b.pipe.pn}`, ic: b.pipe.ic, len: b.len, n: b.count })),
      table: { cols: [['Kod', '', null], ['Shift', '', 0], ['Sıra', 'adet', 0], ['Lateral', 'adet', 0], ['Debi', 'm³/h', 2], ['Boru', '', null], ['İç çap', 'mm', 1], ['Uzunluk', 'm', 1], ['Hız', 'm/s', 2], ['Sürtünme', 'm', 2], ['Basınç değişimi', 'm', 2], ['Giriş basıncı', 'm', 2], ['Kot farkı', 'm', 2]],
        rows: units.map((u, k) => ({ id: 'M' + (k + 1), status: lvl(u.varH <= e.allowMan + 1e-9 && u.v <= 1.5 + 1e-9 && !(u.hInMax * 1.25 > u.pipe.pn * BAR)),
          cells: ['M' + (k + 1), shiftOf[k] + 1, u.rows, u.nLat, u.Q, `Ø${u.pipe.od} PN${u.pipe.pn}`, u.pipe.ic, u.Lm, u.v, u.hf, u.varH, u.hIn, u.rise] })) },
    };

    // ---------- 4. Ana Boru Şebekesi ----------
    const node = i => i < 0 ? 'K0' : 'D' + String(i + 1).padStart(2, '0');
    const KIND = { guzergah: 'güzergâh', kaynak: 'kaynak hattı', baglanti: 'bağlantı', baslik: 'başlık', kol: 'kol' };
    const critSet = new Set(critPath ? critPath.segs : []);
    const sizes = new Map(); net.forEach(x => { const k = `PVC-U Ø${x.od} PN${x.pn}`; sizes.set(k, (sizes.get(k) || 0) + x.L); });
    const anahat = {
      summary: [
        row('Toplam uzunluk', r.field.Lmain, 0, 'm'), row('Kesit sayısı', net.length, 0, 'adet'),
        row('Ana çap', `PVC-U Ø${ms.od} PN${ms.pn}`, null, '', given(inp, 'mainOd') ? 'girdi' : 'otomatik'),
        row('Kademeli çap', T(r.main.teleskop ? 'Evet' : 'Hayır'), null, '', srcOf(inp, 'teleskop')),
        row('En büyük hız', vMain, 2, 'm/s', 'hesap', { status: vMainSt }),
        row('En uzun yol (kritik)', r.main.Lcrit, 0, 'm'),
      ],
      sizes: [...sizes].map(([k, L]) => ({ pipe: k, L })),
      critPath,
      table: { cols: [['Kod', '', null], ['Tür', '', null], ['Düğüm', '', null], ['Uzunluk', 'm', 1], ['Boru', '', null], ['İç çap', 'mm', 1], ['Debi (en büyük)', 'm³/h', 2], ['Hız', 'm/s', 2], ['Kayıp (HW ×1,10)', 'm', 2], ['Açık olduğu shift', '', null]],
        rows: net.map((x, i) => ({ id: x.id, crit: critSet.has(x.id), status: vStatus(x.v),
          cells: [x.id, KIND[x.kind] ? T(KIND[x.kind]) : x.kind, `${node(x.parent)} → ${node(i)}`, x.L, `PVC-U Ø${x.od} PN${x.pn}`, x.ic, x.Qmax, x.v, x.hf, x.Q.map((q, j) => q > 0 ? j + 1 : null).filter(Boolean).join(', ')] })) },
      alts: r.main.alts.map(a => ({ sel: a === ms, od: a.od, pn: a.pn, v: a.v, Hmax: a.Hmax, kWh: a.kWh, pipeCost: a.pipeCost, annual: a.annual, tags: a.tags })),
      allPriced: r.main.allPriced,
    };

    // ---------- 5. Shift'ler ----------
    const hoursSeason = s.pumpHours;
    const shiftDetail = j => {
      const gr = sel.groups[j], c = crit[j] || null, u = c ? units[c.k] : null, kWh = p.need ? (p.shiftKWh || [])[j] : 0;
      return {
        j, no: j + 1, units: gr.map(k => 'M' + (k + 1)), Q: sel.Qj[j], A: shiftA(j),
        nLat: gr.reduce((t, k) => t + units[k].nLat, 0), dur: s.t, vol: sel.Qj[j] * s.t, seasonH: hoursSeason,
        H: ms.H[j], Hbar: ms.H[j] / BAR, Hd: ms.Hd[j], Hp: ms.Hp[j], surplus: ms.surplus[j], regulator: ms.surplus[j] > 5,
        overSource: Qsrc ? sel.Qj[j] > Qsrc + 1e-9 : false,
        breakdown: c ? [
          row('Statik yükseklik (su seviyesi + kot)', h.static0, 2, 'm', srcOf(inp, 'depth', 'dZ')),
          row('Arazide kot artışı', c.rise, 2, 'm', f.gradKnown ? 'harita' : srcOf(inp, 'slopeLong', 'slopeShort')),
          row('İstasyon kayıpları (filtre + 2 m)', sel.Hfix[j], 2, 'm'),
          row('Ana hat sürtünmesi (HW ×1,10)', c.hf, 2, 'm'),
          row('Shift vanası', c.valve, 2, 'm', !sel.valve.v ? 'varsayilan' : sel.valve.v.dogrulandi ? 'katalog' : 'jenerik'),
          row('Ünite giriş basıncı', c.hIn, 2, 'm'),
        ] : [],
        breakdownSum: c ? h.static0 + c.rise + sel.Hfix[j] + c.hf + c.valve + c.hIn : null,   // = motorun H değeri (testle doğrulanır)
        critUnit: u ? { id: 'M' + (c.k + 1), segs: u.segs.map(i => net[i].id), L: u.path } : null,
        pump: p.need ? (p.fromCatalog ? { Q: p.pts[j].Q, Hreq: p.pts[j].Hreq, H: p.pts[j].H, curveSur: p.pts[j].H - p.pts[j].Hreq, curveRatio: p.pts[j].H / Math.max(p.pts[j].Hreq, 0.1), eta: p.pts[j].eta, P: p.pts[j].P, src: pumpTemsili ? 'jenerik' : 'katalog' }
          : { Q: sel.Qj[j], Hreq: ms.Hp[j], H: null, eta: null, P: null, src: 'jenerik' }) : null,
        kWh, cost: kWh * (s.energyCost / Math.max(s.kWh || 1e-9, 1e-9)),
        unitRows: gr.map(k => ({ id: 'M' + (k + 1), Q: units[k].Q, nLat: units[k].nLat, pipe: `Ø${units[k].pipe.od}`, hIn: units[k].hIn, hf: units[k].hf, varH: units[k].varH })),
      };
    };
    const shift = {
      list: sel.groups.map((gr, j) => ({ j, no: j + 1, Q: sel.Qj[j], H: ms.H[j], A: shiftA(j), n: gr.length, status: lvl(!(Qsrc && sel.Qj[j] > Qsrc + 1e-9) && ms.surplus[j] <= 5, ms.surplus[j] > 5 && !(Qsrc && sel.Qj[j] > Qsrc + 1e-9)) })),
      details: sel.groups.map((_, j) => shiftDetail(j)),
      manual: !!sel.manual, recBasis: r.recBasis,
      alts: r.sectorAlts.map(a => ({ Ns: a.Ns, manual: !!a.manual, rec: !!a.recommended, sel: a === sel, Qmax: a.Qmax, cycle: a.cycleHours, feasible: a.feasible, main: `Ø${a.main.sel.od} PN${a.main.sel.pn}`, Hmax: a.main.sel.Hmax, motor: a.pump.need ? a.pump.motor : 0, kWh: a.kWh, compare: a.missing.length ? null : a.compare })),
    };

    // ---------- 6. Pompa ve Filtrasyon ----------
    const pompa = {
      need: p.need, text: p.text, fromCatalog: !!p.fromCatalog, temsili: pumpTemsili,
      info: p.need ? [
        row('Pompa', p.fromCatalog ? p.ad : T('Katalog dışı gereksinim'), null, '', pumpTemsili ? 'jenerik' : 'katalog'),
        row('Tip', PUMP[p.tip] ? T(PUMP[p.tip]) : p.tip, null, ''),
        row('Görev noktası debisi', p.Q, 2, 'm³/h'), row('Görev noktası basıncı', p.H, 2, 'm', 'hesap', { bar: p.H / BAR }),
        row('Motor gücü', p.motor, 1, 'kW', pumpTemsili ? 'jenerik' : 'katalog'),
        p.fromCatalog ? row('En büyük mil gücü', p.Pmax, 2, 'kW') : row('Hidrolik güç', p.Phyd, 2, 'kW'),
        p.fromCatalog ? row('Basınç fazlası oranı', p.over, 2, '×', 'hesap', { status: lvl(p.over <= 1.3, true) }) : row('Mil gücü (η %70)', p.shaft, 2, 'kW', 'varsayilan'),
        p.fromCatalog && p.Hshut != null ? row('Kapama basıncı (eğri)', p.Hshut, 1, 'm', pumpTemsili ? 'jenerik' : 'katalog') : null,
        p.fromCatalog ? row('Uygun katalog kaydı', p.count, 0, 'adet') : null,
      ].filter(Boolean) : [],
      duty: p.need ? sel.groups.map((_, j) => {
        const x = p.fromCatalog ? p.pts[j] : null;
        return { no: j + 1, Q: sel.Qj[j], Hreq: ms.Hp[j], H: x ? x.H : null, sur: x ? x.H - x.Hreq : null, eta: x ? x.eta : null, P: x ? x.P : null, kWh: (p.shiftKWh || [])[j] };
      }) : [],
      filter: sel.filter.items.map(({ f: fi, n }) => ({ n, ad: fi.ad, tip: FILTER[fi.tip] ? T(FILTER[fi.tip]) : fi.tip, mesh: fi.mesh || null, qMax: fi.qMax, src: fi.dogrulandi ? 'katalog' : 'jenerik' })),
      filterMissing: sel.filter.missing, filterText: sel.filter.text,
      filterLoss: h.filter, valveLoss: h.valve, valve: sel.valve.text, valveOver: !!sel.valve.over, valveSrc: !sel.valve.v ? 'varsayilan' : sel.valve.v.dogrulandi ? 'katalog' : 'jenerik',
      water: [row('Su kaynağı', T(SOURCE[inp.srcType || 'kuyu']), null, '', srcOf(inp, 'srcType')), (inp.srcType || 'kuyu') === 'kuyu' ? row('Su kalitesi', T(inp.waterQ === 'temiz' ? 'Temiz' : 'Bilinmiyor/kumlu'), null, '', srcOf(inp, 'waterQ')) : null].filter(Boolean),
    };

    // ---------- 7. Basınç ve Enerji ----------
    const ratio = s.energyCost / Math.max(s.kWh || 1e-9, 1e-9);
    const basinc = {
      head: sel.groups.map((_, j) => { const c = crit[j] || {}; return { no: j + 1, static0: h.static0, rise: c.rise, Hfix: sel.Hfix[j], hf: c.hf, valve: c.valve, hIn: c.hIn, H: ms.H[j], Hd: ms.Hd[j], Hp: ms.Hp[j], sur: ms.surplus[j] }; }),
      pn: [
        row('Ana hat basınç sınıfı', `PN${ms.pn}`, null, '', 'otomatik'),
        row('İzin verilen', ms.pn * BAR, 1, 'm', 'hesap', { bar: ms.pn }),
        row('En alçak noktada işletme', ms.Pop, 1, 'm', 'hesap', { bar: ms.Pop / BAR }),
        row('1,25 × işletme', 1.25 * ms.Pop, 1, 'm', 'hesap', { status: lvl(1.25 * ms.Pop <= ms.pn * BAR + 1e-9) }),
        p.need && p.Pshut != null ? row('Pompa kapama (en alçak nokta)', p.Pshut, 1, 'm', p.fromCatalog && !pumpTemsili ? 'katalog' : 'jenerik', { status: lvl(p.Pshut <= ms.pn * BAR + 1e-9) })
          : row('Kapama basıncı (tasarım kuralı)', ms.Pshut, 1, 'm', 'hesap', { status: lvl(ms.Pshut <= ms.pn * BAR + 1e-9) }),
      ],
      surge: [
        row('Dalga hızı a', r.surge.a, 0, 'm/s'), row('Joukowsky ΔH', r.surge.dH, 1, 'm'),
        row('Kritik kapanma süresi 2L/a', r.surge.Tc, 1, 's'), row('Pratik kural 5 × 2L/a (gerekli, yeterli değil)', r.surge.tClose, 0, 's'),
        row('Teorik tepe basınç (üst sınır)', r.surge.peak, 1, 'm', 'hesap', { status: r.surge.exceeds ? 'warn' : 'ok', bar: r.surge.peak / BAR }),   // K-2: aşım → 'Geçici rejim analizi gerekli', kesin uygunsuz değil
      ],
      energy: [
        row('Sezonluk pompa enerjisi', p.kWh || 0, 0, 'kWh'),
        row('Elektrik fiyatı', ratio, 2, '₺/kWh', s.epSrc === 'kullanici' ? 'kullanici' : 'ornek'),
        row('Sezonluk enerji gideri', s.energyCost, 0, '₺', s.epSrc === 'kullanici' ? 'kullanici' : 'ornek'),
        row('Shift başına sezonluk çalışma', hoursSeason, 0, 'h'),
        row('Bir tur enerji gideri', (p.kWh || 0) / Math.max(hoursSeason, 1e-9) * s.t * ratio, 0, '₺'),
      ],
      monthly: s.monthly.map(m => ({ m: m.m, ay: m.ay, kc: m.kc, et0: m.et0, gross: m.gross, interval: m.interval, sure: m.sure, m3da: m.m3da })),
    };

    return { ok: true, Ns, jCrit, checks, count, assess, ozet, lateral, manifold, anahat, shift, pompa, basinc, SRC, consts: { BAR, V_OK, V_MAX } };
  }

  // Görünüm modelindeki bütün sayısal değerler (aynı veri testi ve tutarlılık kontrolü için)
  function numbers(vm) {
    const out = [];
    const walk = (x, p) => {
      if (typeof x === 'number' && Number.isFinite(x)) out.push([p, x]);
      else if (Array.isArray(x)) x.forEach((y, i) => walk(y, p + '[' + i + ']'));
      else if (x && typeof x === 'object') for (const k of Object.keys(x)) walk(x[k], p + '.' + k);
    };
    walk(vm, 'vm'); return out;
  }

  g.IrriHydroView = { build, numbers, SRC, BAR, V_OK, V_MAX };
  if (typeof module !== 'undefined') module.exports = g.IrriHydroView;
})(typeof window !== 'undefined' ? window : globalThis);

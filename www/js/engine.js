// IrriGrow — tasarım motoru (doğrulama → yerleşim → shift alternatifleri → ekipman → malzeme)
// Formüller: FAO-56, Keller & Bliesner, Watters-Keller, Hazen-Williams (C=150). Ayrıntı: hydraulics.js
(function (g) {
  const req = n => (typeof require !== 'undefined' ? require(n) : null);
  const D = g.IRRI_DATA || req('./data.js');
  const CAT0 = g.IRRI_CATALOG || req('./catalog-data.js');
  const Hy = g.IrriHyd || req('./hydraulics.js');
  const Gm = g.IrriGeom || req('./geom.js');
  const Ly = g.IrriLayout || req('./layout.js');
  const Ct = g.IrriCatalog || req('./catalog.js');
  const Vd = g.IrriValidate || req('./validate.js');
  const G = 9.81, ETA_P = 0.70, ETA_M = 0.90;
  const tr = (v, d = 1) => Number(v).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });

  function pick(v, def, label, asm, unit = '') {
    if (v === undefined || v === null || v === '') { asm.push(`${label}: ${String(def).replace('.', ',')}${unit ? ' ' + unit : ''} kabul edildi`); return def; }
    return Number(v);
  }

  function design(inpRaw, prices, opt = {}) {
    try { return designInner(inpRaw, prices || D.DEFAULT_PRICES, opt); }
    catch (e) { return { ok: false, err: ['Beklenmeyen hesap hatası (' + (e && e.message) + '). Verileri kontrol edin; sorun sürerse bildirin.'], asm: [], warn: [], fieldErrors: {} }; }
  }

  function designInner(inpRaw, prices, opt) {
    const V = Vd.validate(inpRaw);
    const asm = [], warn = [...V.warnings], err = [];
    if (!V.ok) return { ok: false, err: Object.values(V.errors), fieldErrors: V.errors, asm, warn };
    const inp = V.clean, cat = opt.catalog || CAT0, crop = D.CROPS[inp.crop];
    const fail = m => ({ ok: false, err: [].concat(m), fieldErrors: {}, asm, warn });

    // ---------- Geometri ----------
    const mode = inp.geom === 'parsel' ? 'parsel' : 'dikdortgen';
    let A, Pl, boxDeg = 0, lat0 = null, lng0 = null;
    if (mode === 'parsel') {
      const poly = opt.poly;
      if (!Array.isArray(poly) || poly.length < 3) return fail('Parsel modunda haritada en az 3 köşeli sınır çizilmeli.');
      if (poly.some(p => !Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 90 || Math.abs(p[1]) > 180)) return fail('Parsel köşe koordinatları geçersiz.');
      const f = Gm.fieldFromPolygon(poly);
      if (f.selfX) return fail('Parsel sınırı kendini kesiyor; köşe sırasını düzeltin.');
      if (!(f.A >= 100)) return fail('Parsel alanı 100 m²\'den küçük.');
      if (f.A > 1e8) return fail('Parsel alanı çok büyük (100.000 da üzeri).');
      A = f.A; boxDeg = f.box.deg; lat0 = f.lat0; lng0 = f.lng0; Pl = Gm.toLocal(poly).pts;
      if (inp.area_da && Math.abs(inp.area_da * 1000 - A) / A > 0.02) warn.push(`Girilen alan (${tr(inp.area_da)} da) parsel alanından (${tr(A / 1000)} da) farklı; parsel alanı kullanıldı.`);
      if (f.fill < 0.6) warn.push('Parsel şekli düzensiz: kenar sıralarda kısa lateraller ve kör boru payı oluşur.');
    } else {
      A = inp.area_da > 0 ? inp.area_da * 1000 : NaN;
      let L = inp.L, W = inp.W;
      if (!(A > 0) && L > 0 && W > 0) A = L * W;
      if (!(A > 0)) return fail('Arazi alanı (veya en-boy) girilmedi.');
      if (!(L > 0 && W > 0)) { L = Math.sqrt(A * 2); W = A / L; asm.push('Arazi boyutları girilmedi: uzun kenarı kısa kenarın 2 katı olan dikdörtgen kabul edildi'); }
      if (Math.abs(L * W - A) / A > 0.02) { const k = Math.sqrt(A / (L * W)); L *= k; W *= k; asm.push('En-boy, girilen alana uyacak şekilde orantılı ölçeklendi'); }
      if (W > L) [L, W] = [W, L];
      Pl = [[0, 0], [L, 0], [L, W], [0, W]];
    }
    const rowsAlongLong = inp.rowDir !== 'kisa';
    const angle = boxDeg + (rowsAlongLong ? 0 : 90);
    const P = Pl.map(p => Gm.rot(p, angle));

    // Eğim
    let sLat, sMan, zFn = null;
    if (mode === 'parsel' && inp.grad) {
      const [gx, gy] = Gm.rot([inp.grad.gx, inp.grad.gy], angle);
      sLat = Math.abs(gx) * 100; sMan = Math.abs(gy) * 100; zFn = (x, y) => gx * x + gy * y;
      asm.push('Eğim yönü ve büyüklüğü harita yükseklik verisinden (düzlem uydurma) alındı');
    } else {
      const sLong = pick(inp.slopeLong, 0, 'Uzun kenar eğimi', asm, '%'), sShort = pick(inp.slopeShort, 0, 'Kısa kenar eğimi', asm, '%');
      sLat = rowsAlongLong ? sLong : sShort; sMan = rowsAlongLong ? sShort : sLong;
      if (sLat > 0 || sMan > 0) asm.push('Eğim yönü bilinmiyor: lateral, manifold ve ana hatta yukarı yönlü en kötü durum alındı');
    }

    if (!(inp.Q > 0)) return { ok: false, err: ['Su kaynağı debisi (m³/h) girilmedi — shift, boru çapı ve pompa hesaplanamaz.'], fieldErrors: { Q: 'Zorunlu' }, asm, warn };
    const Qs = inp.Q;

    // ---------- Damlatıcı ----------
    const tip = crop.tip;
    const Sr = pick(inp.Sr, crop.Sr, 'Sıra arası', asm, 'm'), Sp = pick(inp.Sp, crop.Sp, 'Sıra üzeri', asm, 'm');
    let q, Se, fe, ne = null;
    if (tip === 'serit') { q = pick(inp.q, 2.0, 'Damlatıcı debisi', asm, 'l/h'); Se = pick(inp.Se, 0.33, 'Damlatıcı aralığı', asm, 'm'); fe = 0.10; }
    else { ne = pick(inp.ne, crop.ne || 4, 'Ağaç başına damlatıcı', asm, 'adet'); q = pick(inp.q, 4.0, 'Damlatıcı debisi', asm, 'l/h'); Se = Sp / ne; fe = 0.20; }
    const pc = inp.emitter === 'pc';
    const hNom = pc ? null : pick(inp.hNom, 10, 'Damlatıcı çalışma basıncı', asm, 'm');
    const x = pc ? 0 : pick(inp.x, 0.5, 'Damlatıcı akış üssü x', asm);
    const pcMin = pc ? pick(inp.pcMin, 10, 'PC min. basınç', asm, 'm') : null;
    const pcMax = pc ? pick(inp.pcMax, 30, 'PC maks. basınç', asm, 'm') : null;
    if (pc && pcMin >= pcMax) return fail('PC maks. basınç, min. basınçtan büyük olmalı.');
    const dHallow = pc ? (pcMax - pcMin) : hNom * (1 - Math.pow(0.9, 1 / x));
    const allowLat = dHallow * 0.55, allowMan = dHallow * 0.45;
    asm.push(pc ? `PC damlatıcı: izin verilen basınç aralığı ${tr(dHallow)} m (%55 lateral, %45 manifold)` : `Kabul edilebilir basınç farkı ${tr(dHallow)} m (debi farkı %10); %55 lateral, %45 manifold`);

    const latD = Number(opt.latD || inp.latD || (tip === 'agac' ? 20 : 16));
    const latC = (cat.borular.lateral || []).find(l => l.od === latD) || (cat.borular.lateral || [])[0];
    if (!latC) return fail('Katalogda lateral borusu yok.');
    const Lmax = Hy.lateralMax(Se, q, latC.ic, sLat, fe, allowLat);
    if (Lmax < Se * 3) return fail('Bu damlatıcı/eğim/basınç ile lateral kurulamıyor. Daha geniş çaplı lateral veya basınç ayarlı (PC) damlatıcı seçin.');

    // Manifold boruları: her çap için en düşük PN
    const peByOd = new Map();
    for (const p of (cat.borular.pe || [])) if (!peByOd.has(p.od) || p.pn < peByOd.get(p.od).pn) peByOd.set(p.od, p);
    const pipes = [...peByOd.values()].sort((a, b) => a.ic - b.ic);
    if (!pipes.length) return fail('Katalogda PE manifold borusu yok.');

    // Kaynak noktası ve başlık (ana dağıtım) tarafı
    const bb = Gm.bbox(P);
    let src = null, route = null, routeLen = 0;
    const okLL = p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;
    const toFrame = ll => Gm.rot([(ll[1] - lng0) * Math.PI / 180 * 6371008.8 * Math.cos(lat0 * Math.PI / 180), (ll[0] - lat0) * Math.PI / 180 * 6371008.8], angle);
    if (mode === 'parsel') {
      // Ana hat güzergâhı: kaynak → (pompa/filtre istasyonu) → kullanıcının çizdiği noktalar → araziye giriş
      const chain = [opt.src, opt.station, ...(Array.isArray(opt.route) ? opt.route : [])].filter(okLL);
      if (chain.length) {
        const F = chain.map(toFrame).filter((p, k, a) => !k || Math.hypot(p[0] - a[k - 1][0], p[1] - a[k - 1][1]) > 0.01);
        src = F[F.length - 1];
        if (F.length >= 2) { route = F; for (let k = 1; k < F.length; k++) routeLen += Math.hypot(F[k][0] - F[k - 1][0], F[k][1] - F[k - 1][1]); }
      }
    }
    let header = 'top';
    if (src) header = src[1] >= (bb.y0 + bb.y1) / 2 ? 'top' : 'bottom';
    else if (zFn) header = zFn((bb.x0 + bb.x1) / 2, bb.y1) >= zFn((bb.x0 + bb.x1) / 2, bb.y0) ? 'top' : 'bottom';
    const yH = header === 'top' ? bb.y1 : bb.y0;
    const dSrc = route ? routeLen : src ? 0 : pick(inp.dSource, 0, 'Kaynaktan araziye mesafe', asm, 'm');
    if (route) asm.push(`Ana hat güzergâhı haritada çizildi: kaynak/istasyondan araziye ${tr(routeLen, 0)} m (güzergâh boyunca kot farkı “Kaynak→arazi kot farkı” girdisinden alınır)`);
    if (!src) { src = [bb.x0, yH]; if (mode === 'parsel') asm.push('Kaynak noktası işaretlenmedi: başlık kenarının köşesinde kabul edildi'); }
    if (zFn) asm.push(`Manifoldlar ${header === 'top' ? 'üst' : 'alt'} kenardaki başlık hattından beslenir`);

    // Alt ünite debisi ≤ kaynak debisinin yarısı ve manifold ≤ Ø110: farklı shift sayılarının birleştirilebilmesi için
    const lay = Ly.buildLayout({ P, Sr, Se, q, fe, latId: latC.ic, Lmax, sLat, allowLat, allowMan, pc, hNom, pcMin, pipes, Qs, Qcap: Qs / 2, maxOd: 110, zFn, sMan, header, nBmin: inp.nB });
    if (inp.nB && lay.nB > inp.nB) warn.push(`${inp.nB} manifold hattıyla lateral boyu sınırı aşılıyor; ${lay.nB} hat kullanıldı.`);
    asm.push('Alt ünite debisi kaynak debisinin en fazla yarısı, manifold çapı tercihen en fazla Ø110 alınarak bölümlendi');
    if (lay.error) return fail(lay.error);
    const units = lay.units, nU = units.length, st = lay.stats;
    const Qfield = units.reduce((t, u) => t + u.Q, 0);
    if (latC.maxH && Math.max(...units.map(u => u.hInMax)) > latC.maxH) warn.push(`Lateral giriş basıncı, lateral borusunun izin verilen basıncını (${tr(latC.maxH, 0)} m) aşabilir; regülatör veya daha dayanıklı boru gerekir.`);
    if (pc && Math.max(...units.map(u => u.hInMax)) > pcMax + 2) warn.push('Manifold girişi PC üst sınırının üzerinde; alt ünite girişine basınç regülatörü önerilir.');

    // ---------- Sulama programı ----------
    const plants = st.planted / Sp;
    const sch = schedule(inp, crop, { A, Sr, Sp, q, Se, ne, tip }, asm, warn);
    if (!(sch.net > 0) || !Number.isFinite(sch.t)) return fail('Sulama ihtiyacı hesaplanamadı; iklim ve bitki verilerini kontrol edin.');

    // ---------- Ana hat yolları ----------
    const srcType = inp.srcType || 'kuyu';
    const depth = srcType === 'kuyu' ? pick(inp.depth, 30, 'Kuyu dinamik su seviyesi', asm, 'm') : (srcType === 'yuzey' ? pick(inp.depth, 2, 'Emme yüksekliği', asm, 'm') : 0);
    const dZ = pick(inp.dZ, 0, 'Kaynak-arazi kot farkı', asm, 'm');
    let Havail = 0;
    if (srcType === 'sebeke') { if (inp.pAvail > 0) Havail = inp.pAvail * 10.2; else asm.push('Şebeke/hidrant basıncı bilinmiyor: tüm basınç pompa ile karşılanır kabul edildi'); }
    const static0 = depth + dZ;
    // Başlık (dağıtım) hattı: her manifold bandının başlık tarafındaki en uç girişinden geçer → parsel sınırını izler
    const axes = [...new Set(units.map(u => u.ax))].sort((a, b) => a - b), topH = header !== 'bottom';
    const Hpt = axes.map(ax => { const ys = units.filter(u => u.ax === ax).map(u => u.yIn); return [ax, topH ? Math.max(...ys) : Math.min(...ys)]; });
    const cum = Hpt.map((p, k) => 0); for (let k = 1; k < Hpt.length; k++) cum[k] = cum[k - 1] + Math.hypot(Hpt[k][0] - Hpt[k - 1][0], Hpt[k][1] - Hpt[k - 1][1]);
    let hE = 0; Hpt.forEach((p, k) => { if (Math.hypot(p[0] - src[0], p[1] - src[1]) < Math.hypot(Hpt[hE][0] - src[0], Hpt[hE][1] - src[1])) hE = k; });
    const conn = Math.hypot(Hpt[hE][0] - src[0], Hpt[hE][1] - src[1]);
    units.forEach(u => {
      const b = axes.indexOf(u.ax);
      u.path = dSrc + conn + Math.abs(cum[b] - cum[hE]) + Math.abs(Hpt[b][1] - u.yIn);
      u.rise = zFn ? zFn(u.ax, u.yIn) - zFn(src[0], src[1]) : sLat / 100 * Math.abs(u.ax - src[0]) + sMan / 100 * Math.abs(u.yIn - src[1]);
    });
    const header_len = cum[cum.length - 1];
    const risers = axes.reduce((t, ax, b) => t + Math.max(...units.filter(u => u.ax === ax).map(u => Math.abs(Hpt[b][1] - u.yIn))), 0);
    const Lmain = dSrc + conn + header_len + risers;
    const Lcrit = Math.max(...units.map(u => u.path));
    // ---------- Ana hat ağı: güzergâh → bağlantı → başlık → kollar; her segment, akış yönünde beslediği alt üniteleri bilir ----------
    const NET = [], allU = units.map((u, k) => k);
    const addSeg = (kind, a, b, down, L) => { const l = L != null ? L : Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > 0.05) NET.push({ kind, a, b, L: l, down: new Set(down) }); };
    if (route) for (let k = 1; k < route.length; k++) addSeg('guzergah', route[k - 1], route[k], allU);
    else if (dSrc > 0) addSeg('kaynak', src, src, allU, dSrc);
    addSeg('baglanti', src, Hpt[hE], allU);
    const bandOf = u => axes.indexOf(u.ax);
    for (let k = hE + 1; k < Hpt.length; k++) addSeg('baslik', Hpt[k - 1], Hpt[k], allU.filter(q => bandOf(units[q]) >= k));
    for (let k = hE - 1; k >= 0; k--) addSeg('baslik', Hpt[k + 1], Hpt[k], allU.filter(q => bandOf(units[q]) <= k));
    axes.forEach((ax, b) => {
      const H0 = Hpt[b], mine = allU.filter(q => bandOf(units[q]) === b);
      const ds = [...new Set(mine.map(q => Math.abs(units[q].yIn - H0[1])))].sort((x, y) => x - y);
      let prev = H0;
      for (const d of ds) { if (d < 0.05) continue; const y = H0[1] + Math.sign(mine.map(q => units[q].yIn - H0[1]).find(v => Math.abs(v) > 0.05) || 1) * d; const pt = [ax, y]; addSeg('kol', prev, pt, mine.filter(q => Math.abs(units[q].yIn - H0[1]) >= d - 1e-6)); prev = pt; }
    });
    // Her segmentin besleyen (yukarı akış) segmenti: başlangıç noktası, bir önceki segmentin bitişi
    units.forEach(u => { u.segs = []; });
    NET.forEach((sg, i) => { sg.id = 'AH-' + String(i + 1).padStart(2, '0'); for (const k of sg.down) units[k].segs.push(i); });
    const parent = NET.map(() => -1); units.forEach(u => { for (let t = 1; t < u.segs.length; t++) parent[u.segs[t]] = u.segs[t - 1]; });
    NET.forEach((sg, i) => { sg.parent = parent[i]; });
    const teleskop = inp.teleskop !== 'hayir';
    asm.push(teleskop ? 'Ana hat kademeli: her segment, taşıdığı en büyük shift debisinde hız ≤ max(seçilen ana çaptaki hız, 0,9) ve ≤ 1,5 m/s olacak en küçük çapla; çap ana çapı geçmez, basınç sınıfı ana hatla aynı' : 'Ana hat tüm uzunlukta tek çap');
    // Su yüzeyine göre en alçak nokta: kapalı vanada en yüksek statik basınç burada oluşur
    const zMin = Math.min(...units.map(u => (srcType === 'sebeke' ? 0 : depth) + dZ + u.rise), (srcType === 'sebeke' ? 0 : depth) + Math.min(0, dZ));

    const ep = Number(prices.elektrik), i = Number(prices.faiz), n = Number(prices.omur);
    const crf = i > 0 && n > 0 ? i * Math.pow(1 + i, n) / (Math.pow(1 + i, n) - 1) : (n > 0 ? 1 / n : 0.1);
    const epSrc = prices.edited && prices.edited.elektrik ? 'kullanici' : 'ornek';
    asm.push(`Ana hat karşılaştırmasında pompa verimi %${ETA_P * 100}, motor verimi %${ETA_M * 100}; ana hatta %10 yerel kayıp payı; gübreleme + sayaç + çekvalf + sürgülü vana kaybı 2 m`);
    asm.push('Boru basınç sınıfı: (a) en alçak noktadaki çalışma basıncının 1,25 katı ≤ PN, (b) pompa kapama basıncı (jenerik eğri: görev basıncının 1,3 katı) + statik kot farkı ≤ PN; sürtünme kaybı ihmal edilir (güvenli yönde)');

    const pvcByOd = {}; for (const p of (cat.borular.pvc || [])) (pvcByOd[p.od] = pvcByOd[p.od] || []).push(p);
    Object.values(pvcByOd).forEach(a => a.sort((x, y) => x.pn - y.pn));
    const ODS = Object.keys(pvcByOd).map(Number).sort((a, b) => a - b);
    const pumpTips = srcType === 'kuyu' ? ['dalgic'] : srcType === 'yuzey' ? (depth > 6 ? ['dalgic', 'dikey'] : ['santrifuj']) : ['booster', 'santrifuj'];
    const hoursSeason = sch.seasonM3 / Qfield; // her shift aynı süre çalışır

    const uValve0 = units.map(u => Ct.selectValve(cat, u.Q));            // her manifold girişinde bir shift vanası
    function evalAlt(groups) {
      const Qj = groups.map(gr => gr.reduce((t, k) => t + units[k].Q, 0));
      const Qmax = Math.max(...Qj), Qmin = Math.min(...Qj);
      const filt = Ct.selectFilter(cat, srcType, inp.waterQ, Qmax), valve = Ct.selectValve(cat, Math.max(...units.map(u => u.Q)));
      const Hfix = Qj.map(Q => filt.loss(Q) + 2.0);
      const gOf = []; groups.forEach((gr, j) => gr.forEach(k => { gOf[k] = j; }));
      // Segment debileri ağaçtan: yaprak segmentine alt ünite debisi, sonra çocuklardan ebeveyne (ters sıra)
      const Qseg = NET.map(() => new Float64Array(Qj.length));
      units.forEach((u, k) => { if (u.segs.length) Qseg[u.segs[u.segs.length - 1]][gOf[k]] += u.Q; });
      for (let i = NET.length - 1; i >= 0; i--) if (parent[i] >= 0) for (let j = 0; j < Qj.length; j++) Qseg[parent[i]][j] += Qseg[i][j];
      const QsegMax = Qseg.map(a => Math.max(...a));
      const active = Qj.map((_, j) => { const l = []; for (let i = 0; i < NET.length; i++) if (Qseg[i][j] > 0) l.push(i); return l; });
      const uValve = uValve0;
      const sizeNet = base => {
        const vlim = Math.min(1.5, Math.max(Hy.velocity(Qmax, base.ic), 0.9));
        const ladder = ODS.filter(od => od < base.od).map(od => pvcByOd[od].find(x => x.pn >= base.pn)).filter(Boolean);
        return NET.map((sg, i) => {
          if (!teleskop || QsegMax[i] >= Qmax - 1e-9) return base;
          for (const p of ladder) { if (Hy.velocity(QsegMax[i], p.ic) <= vlim) return p; }
          return base;
        });
      };
      const reqH = (pipe) => {
        const sz = sizeNet(pipe); let hfMax = 0;
        const H = groups.map((gr, j) => {
          const to = new Float64Array(NET.length);   // girişten segment sonuna kümülatif sürtünme (ağaç sırası: ebeveyn < çocuk)
          for (const i of active[j]) to[i] = (parent[i] >= 0 ? to[parent[i]] : 0) + Hy.hfHW(Qseg[i][j] / 3600, sz[i].ic / 1000, NET[i].L) * 1.10;
          return Math.max(...gr.map(k => { const u = units[k]; const hf = u.segs.length ? to[u.segs[u.segs.length - 1]] : 0; hfMax = Math.max(hfMax, hf); return static0 + u.rise + hf + Hfix[j] + uValve[k].loss(u.Q) + u.hIn; }));
        });
        return { H, sz, hfMax };
      };
      const alts = [];
      for (const od of Object.keys(pvcByOd).map(Number).sort((a, b) => a - b)) {
        for (const pipe of pvcByOd[od]) {
          const v = Hy.velocity(Qmax, pipe.ic);
          if (v > 2.0) break;
          if (v < 0.3 && alts.length) break; // en küçük çap düşük hızda da kabul
          const RH = reqH(pipe), H = RH.H, sz = RH.sz;
          // Verilen basınç: kuyuda su en az yüzeye + istasyon kayıplarına kadar basılır; şebekede mevcut basınç düşürülemez
          const Hd = H.map((h, j) => srcType === 'sebeke' ? Math.max(h, Havail) : srcType === 'kuyu' ? Math.max(h, depth + Hfix[j]) : Math.max(h, 0));
          const Hp = Hd.map(h => Math.max(0, h - Havail));
          const surplus = Hd.map((h, j) => h - H[j]);
          const Pout = Math.max(...Hd) - (srcType === 'sebeke' ? 0 : depth);
          const Pop = Math.max(...Hd) - zMin;                         // en alçak noktada, sürtünmesiz (güvenli yön)
          const Hp0 = Math.max(...Hp), Pshut = (Hp0 > 0.5 ? 1.3 * Hp0 : 0) + Havail - zMin;
          if (pipe.pn * 10.2 < Math.max(1.25 * Pop, Pshut)) continue; // daha yüksek PN dene
          const kWh = Hp.reduce((t, h, j) => t + G * h * (sch.seasonM3 * Qj[j] / Qfield) / 3600 / (ETA_P * ETA_M), 0);
          let pipeCost = 0, prSrc = null;
          sz.forEach((p, i) => { const pr = Ct.priceOf(prices, `pvc:${p.od}:${p.pn}`, p); if (pr.v == null || pipeCost == null) pipeCost = null; else { pipeCost += pr.v * NET[i].L; prSrc = prSrc || pr.src; } });
          const pr = { src: prSrc };
          alts.push({ od, pn: pipe.pn, ic: pipe.ic, pipe, v, sz, Hd, surplus, Pout, Pop, Pshut, hf: RH.hfMax, H, Hp, Hmax: Math.max(...H), kWh, energyCost: kWh * ep, pipeCost, priceSrc: pr.src, annual: pipeCost != null ? pipeCost * crf + kWh * ep : null });
          break; // bu çap için uygun en düşük PN bulundu
        }
      }
      if (!alts.length) return null;
      const allPriced = alts.every(a => a.annual != null);
      const byAnnual = allPriced ? [...alts].sort((a, b) => a.annual - b.annual)[0] : (alts.find(a => a.v <= 1.5) || alts[alts.length - 1]);
      const user = inp.mainOd ? alts.find(a => a.od === inp.mainOd) : null;
      const sel = user || byAnnual;
      alts.forEach(a => { a.tags = []; });
      byAnnual.tags.push(allPriced ? 'En düşük yıllık maliyet' : 'Önerilen (v ≤ 1,5 m/s)');
      const priced = alts.filter(a => a.pipeCost != null);
      if (priced.length) { const c = priced.reduce((m, a) => a.pipeCost < m.pipeCost ? a : m); if (c !== byAnnual) c.tags.push('Düşük yatırım'); }
      const eff = alts.filter(a => a.od > byAnnual.od)[0]; if (eff) eff.tags.push('Enerji verimli');

      // Pompa
      const duties = Qj.map((Q, j) => ({ Q, H: sel.Hp[j], hours: hoursSeason }));
      let pump;
      const needPump = duties.some(d => d.H > 0.5);
      if (!needPump) pump = { need: false, text: srcType === 'sebeke' ? `Pompa gerekmez (mevcut ${tr(Havail / 10.2, 2)} bar ≥ gerekli ${tr(sel.Hmax / 10.2, 2)} bar)` : `Pompa gerekmez: kot farkı (cazibe) gerekli basıncı karşılıyor (gerekli ${tr(sel.Hmax, 1)} m)`, kWh: 0 };
      else {
        const sp = Ct.selectPump(cat, pumpTips, duties);
        const dQ = Qmax, dH = Math.max(...duties.map(d => d.H));
        if (sp.best) {
          const b = sp.best, p = b.p;
          const kWh = b.pts.reduce((t, x) => t + x.P / ETA_M * hoursSeason, 0);
          pump = { need: true, fromCatalog: true, p, id: p.id, ad: `${p.marka} ${p.model}`, tip: p.tip, motor: p.motorKw, Q: dQ, H: dH, pts: b.pts, Pmax: b.Pmax, over: b.over, verified: !!p.dogrulandi, kaynak: p.kaynak, count: sp.count, kWh,
            text: `${p.marka} ${p.model} (${tipAd(p.tip)}), ${tr(p.motorKw, 1)} kW — görev noktası ${tr(dQ)} m³/h @ ${tr(dH)} m` };
        } else {
          const gp = Ct.genericPump(dQ, dH);
          const kWh = duties.reduce((t, d) => t + G * d.Q / 3600 * d.H / (ETA_P * ETA_M) * d.hours, 0);
          pump = { need: true, fromCatalog: false, tip: pumpTips[0], Q: dQ, H: dH, Phyd: gp.Phyd, shaft: gp.shaft, motor: gp.motor, kWh,
            text: `Katalogda uygun pompa yok — gereksinim: ${tipAd(pumpTips[0])}, ${tr(dQ)} m³/h @ ${tr(dH)} m, ~${tr(gp.motor, 1)} kW motor` };
        }
      }
      if (pump.need && pump.fromCatalog) { const hs = Math.max(...pump.p.egri.map(e => e[1])); pump.Hshut = hs; pump.Pshut = hs + Havail - zMin; }
      const Ns = groups.length;
      const cycleHours = Ns * sch.t, avail = sch.hoursPerDay * sch.interval;
      const energyCost = pump.kWh * ep;
      // Karşılaştırma maliyeti (yıllık): ana hat taksiti + enerji + fiyatı bilinen vana/pompa taksiti
      const basis = [], missing = [];
      let compare = 0;
      if (sel.pipeCost != null) { compare += sel.pipeCost * crf; basis.push('ana hat'); } else missing.push('ana hat borusu');
      compare += energyCost; basis.push('enerji');
      let vsum = 0; for (const uv of uValve) { const vp = uv.v ? Ct.priceOf(prices, `vana:${uv.v.id}`, uv.v) : { v: null }; if (vp.v == null) { vsum = null; break; } vsum += vp.v; }
      if (vsum != null) { compare += vsum * crf; basis.push('shift vanaları'); } else missing.push('shift vanası');
      const pp = pump.need && pump.fromCatalog ? Ct.priceOf(prices, `pompa:${pump.id}`, pump.p) : { v: pump.need ? null : 0 };
      if (pp.v != null) { if (pp.v) { compare += pp.v * crf; basis.push('pompa'); } } else missing.push('pompa');
      return { Ns, groups, Qj, Qmax, Qmin, Hfix, Qseg, filter: filt, valve, uValve, main: { alts, sel, allPriced }, pump, cycleHours, avail, feasible: cycleHours <= avail + 1e-9, energyCost, kWh: pump.kWh, compare, basis, missing };
    }

    const Qu = units.map(u => u.Q);
    const NsMin = Ly.minSectors(Qu, Qs);
    if (!Number.isFinite(NsMin)) return fail('Bir alt ünitenin debisi kaynak debisini aşıyor.');
    const cand = new Set(); for (let k = NsMin; k <= Math.min(nU, NsMin + 7); k++) cand.add(k);
    if (inp.Ns && inp.Ns <= nU) cand.add(inp.Ns);
    const sig = `${nU}:${Qfield.toFixed(3)}:${lay.nB}`;
    const altList = [];
    let manualAlt = null;
    const man = opt.manual;
    if (man && man.sig === sig && Array.isArray(man.assign) && man.assign.length === nU && man.assign.every(v => Number.isInteger(v) && v >= 0 && v < nU)) {
      const ids = [...new Set(man.assign)].sort((a, b) => a - b), groups = ids.map(j => man.assign.map((v, k) => v === j ? k : -1).filter(k => k >= 0));
      manualAlt = evalAlt(groups);
      if (manualAlt) { manualAlt.manual = true; manualAlt.overSource = manualAlt.Qmax > Qs + 1e-9; }
    } else if (man && man.sig && man.sig !== sig) warn.push('Elle düzenlenen shift ataması yerleşim değiştiği için geçersiz kaldı; otomatik shift’ler kullanıldı.');
    for (const k of [...cand].sort((a, b) => a - b)) {
      const groups = Ly.partition(Qu, k).filter(gr => gr.length);
      if (groups.length !== k || altList.some(a => a.Ns === k)) continue;
      const a = evalAlt(groups); if (a) altList.push(a);
    }
    if (!altList.length) return fail('Ana hat için uygun PVC çapı bulunamadı (debi standart çap aralığı dışında veya basınç sınıfı yetersiz).');
    const feas = altList.filter(a => a.feasible);
    const pool = feas.length ? feas : altList;
    // Tüm kalemler fiyatlıysa en düşük yıllık karşılaştırma maliyeti; değilse kaynağı en iyi kullanan (en az shift’li) uygun düzen
    const allCmp = pool.every(a => !a.missing.length);
    const rec = [...pool].sort((a, b) => allCmp ? (a.compare - b.compare || a.Ns - b.Ns) : a.Ns - b.Ns)[0];
    rec.recommended = true;
    if (manualAlt) altList.push(manualAlt);
    const recBasis = (allCmp ? 'en düşük yıllık maliyet (ana hat + enerji + vana + pompa)' : 'fiyatı eksik kalemler olduğundan, kaynak debisini en iyi kullanan (en az shift’li) düzen') + (feas.length ? '; yalnız süreye sığan düzenler arasından' : '; hiçbir düzen süreye sığmıyor');
    const sel = manualAlt || (inp.Ns && altList.find(a => a.Ns === inp.Ns && !a.manual)) || rec;
    if (manualAlt && manualAlt.overSource) warn.push(`Elle düzenlenen shift’lerden en az birinin debisi (${tr(manualAlt.Qmax)} m³/h) kaynak debisini (${tr(Qs)} m³/h) aşıyor: bu düzen uygulanamaz.`);
    if (inp.Ns && !altList.find(a => a.Ns === inp.Ns)) warn.push(`${inp.Ns} shift uygulanamıyor (alt ünite sayısı ${nU}); önerilen alternatif kullanıldı.`);
    if (!feas.length) warn.push(`Hiçbir shift alternatifinde tepe dönem turu (${tr(altList[0].cycleHours)} saat) ${sch.interval} günlük aralıktaki ${tr(altList[0].avail, 0)} saatlik çalışma süresine sığmıyor. Kaynak debisini artırın veya alanı bölün.`);
    else if (!sel.feasible) warn.push(`Seçilen ${sel.Ns} shift’li düzende tepe dönem turu ${tr(sel.cycleHours)} saat; mevcut ${tr(sel.avail, 0)} saati aşıyor.`);
    if (sel.Qmin < 0.7 * sel.Qmax && sel.Ns > 1) warn.push(`Shift debileri dengesiz (${tr(sel.Qmin)}–${tr(sel.Qmax)} m³/h): pompa küçük shift’lerde fazla basınç üretir.`);
    if (sel.filter.missing.length) warn.push(`Katalogda ${sel.filter.missing.join(', ')} filtresi yok; her biri için 5 m kayıp kabul edildi.`);
    if (sel.valve.over) warn.push('Katalogdaki en büyük vana shift debisi için yetersiz; vana paralel bağlanmalı.');
    if (!sel.main.allPriced) warn.push('Bazı ana hat çaplarının fiyatı yok: çap, ekonomik karşılaştırma yerine hız ölçütüyle (≤ 1,5 m/s) seçildi.');
    if (sel.pump.need && sel.pump.fromCatalog && sel.pump.over > 1.3) warn.push(`Seçilen pompa bazı shift’lerde gerekenden %${tr((sel.pump.over - 1) * 100, 0)} fazla basınç üretiyor; basınç regülatörü veya frekans konvertörü önerilir.`);
    if (sel.pump.need && srcType === 'sebeke' && sel.pump.H < 5) warn.push(`Hidrant basıncı yalnızca ${tr(sel.pump.H)} m yetersiz: pompa yerine bir üst ana hat çapı değerlendirilmeli.`);
    if (Qs > sel.Qmax * 1.6 && sel.Ns > 1) warn.push(`Kaynak debisinin bir kısmı kullanılmıyor (en büyük shift ${tr(sel.Qmax)} m³/h).`);
    {
      const ms = sel.main.sel, sp = Math.max(...ms.surplus);
      if (sp > 5) warn.push(`Bazı shift’lerde ${tr(sp)} m fazla basınç var (kot farkı / sabit kaynak basıncı): shift vanalarında basınç düşürücü (regülatör) gerekir.`);
      if (sel.pump.Pshut != null && sel.pump.Pshut > ms.pn * 10.2) warn.push(`Seçilen pompanın kapama basıncı (${tr(sel.pump.Pshut)} m, en alçak noktada) ana hat PN${ms.pn} sınıfını aşıyor: emniyet (tahliye) vanası veya bir üst PN gerekir.`);
      const pe = units.filter(u => u.hInMax * 1.25 > u.pipe.pn * 10.2);
      if (pe.length) warn.push(`${pe.length} manifoldun giriş basıncı PN${pe[0].pipe.pn} sınıfı için yüksek; bir üst PN veya regülatör gerekir.`);
    }
    if (epSrc === 'ornek') asm.push('Elektrik fiyatı örnek değerdir (Ayarlar\'dan güncelleyin)');

    const m = sel.main.sel;
    const res = {
      ok: true, asm, warn, err, fieldErrors: {},
      field: { A, da: A / 1000, mode, angle, plants: Math.round(plants), Sr, Sp, tip, sLat, sMan, gradKnown: !!zFn, header, Lmain, Lcrit },
      emitter: { q, Se, pc, hNom, pcMin, pcMax, x, ne, dHallow, allowLat, allowMan },
      lateral: { d: latC.od, ic: latC.ic, cat: latC, Lmax, count: st.count, len: st.latLen, planted: st.planted, lead: st.lead, emitters: st.emitters, maxLen: st.maxLen, maxDH: st.maxDH, hfMax: st.hfMax, vMax: st.vMax, hreqMax: st.hreqMax, hreqMin: st.hreqMin },
      units,
      manifold: summarizeManifold(units),
      layout: { route, routeLen, sig, headerPts: Hpt, headerEntry: hE, P, bands: lay.bands, laterals: lay.laterals, units, yH, src, srcGiven: !!opt.src && mode === 'parsel', nB: lay.nB, bb: lay.bb, angle, lat0, lng0, mode, header },
      sectorAlts: altList, sel, recBasis,
      sectors: { Ns: sel.Ns, Qsec: sel.Qmax, Qmin: sel.Qmin, Qfield, units: nU, groups: sel.groups, Qj: sel.Qj },
      inlet: { hLatIn: st.hreqMax, hManIn: Math.max(...units.map(u => u.hIn)) },
      main: { Lcrit, Lmain, sel: m, alts: sel.main.alts, allPriced: sel.main.allPriced, teleskop,
        net: NET.map((sg, i) => { const p = m.sz[i], Qa = Array.from(sel.Qseg[i]), Qx = Math.max(...Qa); return { id: sg.id, kind: sg.kind, a: sg.a, b: sg.b, L: sg.L, parent: sg.parent, down: [...sg.down], od: p.od, pn: p.pn, ic: p.ic, pipe: p, Q: Qa, Qmax: Qx, v: Hy.velocity(Qx, p.ic), hf: Hy.hfHW(Qx / 3600, p.ic / 1000, sg.L) * 1.10 }; }) },
      head: { depth, dZ, Havail, static0, filter: sel.filter.loss(sel.Qmax), valve: sel.valve.loss(sel.Qmax), fixed: sel.Hfix[sel.Qj.indexOf(sel.Qmax)], riseMax: Math.max(...units.map(u => u.rise)) },
      filter: sel.filter, valve: sel.valve, pump: sel.pump,
      schedule: Object.assign(sch, { cycleHours: sel.cycleHours, pumpHours: hoursSeason, kWh: sel.kWh, energyCost: sel.energyCost, epSrc }),
    };
    res.surge = surge(m, Lmain);
    warn.push(`Su darbesi ayrıntılı analiz edilmedi. Ani kapanmada (kritik süre ${tr(res.surge.Tc, 1)} s'den kısa) Joukowsky üst sınırı ΔH ≈ ${tr(res.surge.dH, 0)} m (dalga hızı ${tr(res.surge.a, 0)} m/s); ${res.surge.exceeds ? `bu durumda PN${m.pn} sınıfı aşılır. ` : ''}Vanalar en az ${tr(res.surge.tClose, 0)} s'de kapanmalı; tasarım, su darbesi analizi yapılmadan kesin onaylı sayılmaz.`);
    res.bom = bom(res, prices, cat);
    res.cost = costSummary(res.bom);
    return res;
  }

  // Joukowsky üst sınırı (ani kapanma): a = √(K/ρ / (1 + K·D/(E·e))), ΔH = a·v/g, kritik süre 2L/a
  function surge(m, Lm) {
    const K = 2.19e9, rho = 998, E = /PE/i.test(m.pipe.malzeme || '') ? 1.0e9 : 3.0e9;
    const e = m.pipe.et || (m.pipe.od - m.pipe.ic) / 2, D = m.pipe.ic;
    const a = Math.sqrt(K / rho / (1 + K * D / (E * e))), dH = a * m.v / G, Tc = 2 * Lm / a;
    const Pline = Math.max(0, m.Pop);
    return { a, dH, Tc, tClose: Math.max(5, Math.ceil(5 * Tc)), E, Pline, peak: Pline + dH, pnH: m.pn * 10.2, exceeds: Pline + dH > m.pn * 10.2 };
  }

  function tipAd(t) { return { dalgic: 'dalgıç pompa', santrifuj: 'yatay santrifüj pompa', booster: 'hat üstü (booster) pompa', dikey: 'dikey türbin pompa' }[t] || t; }

  function summarizeManifold(units) {
    const byPipe = {};
    for (const u of units) { const k = u.pipe.id; (byPipe[k] = byPipe[k] || { pipe: u.pipe, len: 0, count: 0 }); byPipe[k].len += Math.abs(u.yEnd - u.yIn); byPipe[k].count++; }
    return { count: units.length, byPipe: Object.values(byPipe).sort((a, b) => a.pipe.od - b.pipe.od), Qmax: Math.max(...units.map(u => u.Q)), hfMax: Math.max(...units.map(u => u.hf)), varMax: Math.max(...units.map(u => u.varH)), vMax: Math.max(...units.map(u => u.v)), LmMax: Math.max(...units.map(u => u.Lm)) };
  }

  function schedule(inp, crop, s, asm, warn) {
    const reg = D.REGIONS[inp.region];
    let et0 = inp.et0;
    if (!(et0 > 0)) { et0 = reg ? reg.et0 : 6.5; asm.push(`Tepe ET0 ${String(et0).replace('.', ',')} mm/gün (${reg ? reg.ad + ' bölgesi ortalaması' : 'genel değer'})`); }
    const sera = !!crop.sera;
    if (sera) asm.push('Sera içi ET0, açık alanın %75\'i kabul edildi');
    const kc = pick(inp.kc, crop.kc, 'Kc (orta dönem, FAO-56)', asm);
    const Gc = pick(inp.Gc, crop.Gc, 'Bitki örtü oranı', asm);
    const Kr = s.tip === 'agac' ? Math.min(1, Gc + 0.15 * (1 - Gc)) : 1;
    const Ea = pick(inp.Ea, 0.90, 'Uygulama randımanı', asm);
    const soil = D.SOILS[inp.soil] || D.SOILS.tinli; if (!D.SOILS[inp.soil]) asm.push('Toprak tınlı kabul edildi');
    const etP = et0 * (sera ? D.SERA_FACTOR : 1);
    const net = etP * kc * Kr, gross = net / Ea;
    const RAW = soil.aw * crop.Zr * crop.p * crop.Pw;
    const Imax = Math.max(1, Math.floor(RAW / net));
    let interval = inp.interval || (s.tip === 'agac' ? Math.min(2, Imax) : 1);
    if (interval > Imax) { warn.push(`Girilen sulama aralığı (${interval} gün) toprağın kolay alınabilir suyuna göre fazla; ${Imax} güne düşürüldü.`); interval = Imax; }
    const area = s.Sr * s.Sp;
    const AR = s.tip === 'agac' ? (s.ne * s.q) / area : s.q / (s.Se * s.Sr);
    const t = gross * interval / AR;
    const hoursPerDay = pick(inp.hours, 20, 'Günlük pompa çalışma süresi', asm, 'saat');
    const aylar = (inp.months && inp.months.length) ? inp.months : crop.aylar;
    const AYAD = ['', 'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const gun = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const kcIni = crop.tip === 'serit' ? Math.min(0.6, kc) : kc, kcEnd = crop.tip === 'serit' ? 0.8 * kc : kc;
    const kcOf = k => { const nn = aylar.length; if (crop.tip !== 'serit' || nn < 3) return kc; if (k === 0) return kcIni; if (k === 1) return (kcIni + kc) / 2; if (k === nn - 1) return kcEnd; return kc; };
    const monthly = aylar.map((mm, k) => {
      const kcm = kcOf(k), e = etP * D.ET0_FACTOR[mm], nt = e * kcm * Kr, gr = nt / Ea;
      const iv = Math.min(Math.max(1, Math.floor(RAW / nt)), interval + (D.ET0_FACTOR[mm] < 0.6 ? 1 : 0));
      return { ay: AYAD[mm], m: mm, kc: kcm, et0: e, net: nt, gross: gr, interval: iv, sure: gr * iv / AR, m3da: gr * gun[mm], lt_bitki: gr * area };
    });
    if (crop.tip === 'serit') asm.push('Aylık Kc: ilk ay 0,60, ikinci ay ara değer, son ay orta dönemin %80\'i (FAO-56 eğrisine yaklaşık)');
    const seasonMm = monthly.reduce((a, r) => a + r.gross * gun[r.m], 0);
    return { et0: etP, kc, Kr, Ea, net, gross, RAW, Imax, interval, AR, t, hoursPerDay, monthly, seasonMm, seasonM3: seasonMm * s.A / 1000, lpPlant: gross * area, soil: soil.ad };
  }

  function bom(r, pr, cat) {
    const rows = [];
    const add = (key, grup, kalem, miktar, birim, catItem, opsiyonel) => {
      const p = Ct.priceOf(pr, key, catItem);
      rows.push({ key, grup, kalem, miktar, birim, fiyat: p.v, kaynak: p.src, tutar: p.v != null ? p.v * miktar : null, opsiyonel: !!opsiyonel });
    };
    const f = r.field, lat = r.lateral, s = r.sel, e = r.emitter;
    const planted = Math.ceil(lat.planted * 1.03), lead = Math.ceil(lat.lead * 1.03);
    if (f.tip === 'serit') {
      add(`lateral:${lat.d}`, 'Lateral', `Damla borusu Ø${lat.d}, ${tr(e.q)} l/h, ${Math.round(e.Se * 100)} cm${e.pc ? ' (PC)' : ''}`, planted, 'm');
      if (lead > 0) add(`korLateral:${lat.d}`, 'Lateral', `Kör lateral (damlatıcısız) PE Ø${lat.d}`, lead, 'm');
    } else {
      add(`lateral:${lat.d}`, 'Lateral', `PE lateral boru Ø${lat.d}`, Math.ceil(lat.len * 1.03), 'm');
      add('damlatici', 'Lateral', `Damlatıcı ${tr(e.q)} l/h${e.pc ? ' (PC)' : ''}`, Math.ceil(lat.emitters * 1.02), 'adet');
    }
    add('startKonnektor', 'Lateral', `Start konnektör Ø${lat.d} (contalı)`, Math.ceil(lat.count * 1.02), 'adet');
    add('lateralSonu', 'Lateral', `Lateral sonu (kör tapa) Ø${lat.d}`, Math.ceil(lat.count * 1.02), 'adet');
    for (const b of r.manifold.byPipe) {
      add(`pe:${b.pipe.od}:${b.pipe.pn}`, 'Manifold', `PE100 boru Ø${b.pipe.od} PN${b.pipe.pn}`, Math.ceil(b.len * 1.03), 'm', b.pipe);
      add(`fitting:pe-son:${b.pipe.od}`, 'Manifold', `Manifold sonu yıkama vanası / tapa Ø${b.pipe.od}`, b.count, 'adet');
      add(`fitting:pe-giris:${b.pipe.od}`, 'Manifold', `Manifold giriş bağlantısı (PVC×PE geçiş + T) Ø${b.pipe.od}`, b.count, 'adet');
    }
    const m = r.main.sel;
    // Ana hat: çap/PN başına net uzunluk (kademeli çap)
    const byD = new Map(); for (const sg of r.main.net) { const k = `${sg.od}:${sg.pn}`; const o = byD.get(k) || { pipe: sg.pipe, L: 0 }; o.L += sg.L; byD.set(k, o); }
    [...byD.values()].sort((a, b) => b.pipe.od - a.pipe.od).forEach(({ pipe, L }) => add(`pvc:${pipe.od}:${pipe.pn}`, 'Ana hat', `PVC-U boru Ø${pipe.od} PN${pipe.pn}`, Math.ceil(L * 1.02), 'm', pipe));
    const red = new Map(); for (const sg of r.main.net) { const pa = sg.parent >= 0 ? r.main.net[sg.parent] : null; if (pa && pa.od > sg.od) { const k = `${pa.od}x${sg.od}`; red.set(k, (red.get(k) || 0) + 1); } }
    for (const [k, n] of red) add(`fitting:pvc-red:${k}`, 'Ana hat', `PVC redüksiyon Ø${k.replace('x', '×Ø')}`, n, 'adet');
    add(`fitting:pvc-dirsek:${m.od}`, 'Ana hat', `PVC dirsek Ø${m.od}`, 2 + r.layout.nB, 'adet');
    add(`fitting:pvc-te:${m.od}`, 'Ana hat', `PVC te / redüksiyonlu te Ø${m.od}`, r.layout.nB + r.units.length, 'adet');
    add(`fitting:pvc-tapa:${m.od}`, 'Ana hat', `PVC kör tapa Ø${m.od}`, r.layout.nB, 'adet');
    // Shift vanaları: her manifold girişinde bir vana (shift'ler bu vanaların birlikte açılmasıyla oluşur)
    const vv = new Map(); (s.uValve || []).forEach(uv => { const k = uv.v ? uv.v.id : 'sektor'; const o = vv.get(k) || { v: uv.v, n: 0 }; o.n++; vv.set(k, o); });
    for (const [k, o] of vv) add(`vana:${k}`, 'Vana', (o.v ? o.v.ad : 'Shift vanası') + ' (manifold girişi)', o.n, 'adet', o.v);
    add('vana:hava-1', 'Vana', 'Hava tahliye vanası (vakum kırıcı) 1"', r.units.length + 1, 'adet');
    const nReg = s.groups.reduce((t, gr, j) => t + (r.main.sel.surplus[j] > 5 ? gr.length : 0), 0);
    if (nReg) add('vana:regulator', 'Vana', 'Basınç regülatörü (shift vanasında)', nReg, 'adet');
    add(`vana:surgulu:${m.od}`, 'Vana', `Ana sürgülü vana (Ø${m.od} hatta)`, 1, 'adet');
    add(`vana:cekvalf:${m.od}`, 'Vana', `Çekvalf (Ø${m.od} hatta)`, 1, 'adet');
    for (const { f: fi, n } of s.filter.items) add(`filtre:${fi.id}`, 'Filtre', fi.ad + (fi.mesh ? ` (${fi.mesh} mesh)` : ''), n, 'adet', fi);
    add('kontrol:manometre', 'Kontrol', 'Manometre (filtre giriş-çıkış)', 2, 'adet');
    add('kontrol:sayac', 'Kontrol', 'Su sayacı', 1, 'adet');
    add('kontrol:gubre', 'Kontrol', 'Gübre tankı / venturi', 1, 'takım', null, true);
    const p = r.pump;
    if (p.need) {
      if (p.fromCatalog) add(`pompa:${p.id}`, 'Pompa', `${p.ad} (${tipAd(p.tip)}), ${tr(p.motor, 1)} kW`, 1, 'takım', p.p);
      else add(`pompa:gen:${Math.round(p.Q)}:${Math.round(p.H)}`, 'Pompa', `${tipAd(p.tip)} ${tr(p.Q)} m³/h @ ${tr(p.H, 0)} m, ~${tr(p.motor, 1)} kW (katalog dışı)`, 1, 'takım');
    }
    return rows;
  }

  function costSummary(rows) {
    const reqd = rows.filter(r => !r.opsiyonel);
    const missing = reqd.filter(r => r.fiyat == null);
    const priced = rows.filter(r => r.fiyat != null);
    const subtotal = priced.filter(r => !r.opsiyonel).reduce((t, r) => t + r.tutar, 0);
    return { total: missing.length ? null : subtotal, subtotal, missing: missing.length, example: priced.filter(r => r.kaynak === 'ornek').length, priced: priced.length };
  }

  // Yerleşim alternatifleri: sıra yönü × lateral çapı varyantları gerçek tasarımla hesaplanır.
  // Seçimler: en düşük ilk yatırım, en düşük enerji, dengeli. Fiyat eksikse yatırım yerine boru metrajı kullanılır ve sıralama kesin değildir.
  function layoutAlternatives(inp, prices, opt = {}) {
    const list = [];
    for (const rowDir of ['uzun', 'kisa']) for (const latD of ['16', '20']) {
      const i2 = Object.assign({}, inp, { rowDir, latD }); delete i2.Ns; delete i2.mainOd;
      const r = design(i2, prices, Object.assign({}, opt, { manual: null, latD: null }));
      if (!r.ok) { list.push({ rowDir, latD, ok: false, err: r.err[0] }); continue; }
      const pipeLen = r.lateral.len + r.manifold.byPipe.reduce((t, b) => t + b.len, 0) + r.main.Lmain;
      list.push({ rowDir, latD, ok: true, r, Ns: r.sectors.Ns, feasible: r.sel.feasible, inv: r.cost.total, invPart: r.cost.subtotal, missing: r.cost.missing,
        kWh: r.schedule.kWh, energyCost: r.schedule.energyCost, pipeLen, motor: r.pump.need ? r.pump.motor : 0, H: r.main.sel.Hmax,
        margin: Math.max(r.lateral.maxDH / r.emitter.allowLat, r.manifold.varMax / r.emitter.allowMan) });
    }
    const okl = list.filter(v => v.ok), pool = okl.filter(v => v.feasible).length ? okl.filter(v => v.feasible) : okl;
    if (!pool.length) return { list, picks: {}, priced: false };
    const priced = pool.every(v => v.inv != null);
    const invOf = v => priced ? v.inv : v.pipeLen;
    const mn = f => Math.min(...pool.map(f));
    const i0 = mn(invOf), e0 = Math.max(mn(v => v.kWh), 1e-9);
    const by = f => [...pool].sort((a, b) => f(a) - f(b) || a.margin - b.margin)[0];
    const picks = {
      yatirim: by(invOf),
      enerji: by(v => v.kWh),
      dengeli: by(v => invOf(v) / i0 + v.kWh / e0 + 0.2 * v.margin),
    };
    // 5/10/15 yıllık toplam maliyet (yatırım + enerji), yalnız tüm fiyatlar biliniyorsa
    for (const v of okl) v.life = v.inv != null ? [5, 10, 15].map(n => v.inv + v.energyCost * n) : null;
    return { list, picks, priced, basis: priced ? 'yatirim' : 'metraj' };
  }

  const api = { design, layoutAlternatives, schedule, tipAd, fieldFromPolygon: Gm.fieldFromPolygon, slopeFromPoints: Gm.slopeFromPoints, jSmooth: Hy.jSmooth, hfHW: Hy.hfHW, christiansen: Hy.christiansen, lateralCalc: Hy.lateralCalc, velocity: Hy.velocity };
  g.IrriEngine = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

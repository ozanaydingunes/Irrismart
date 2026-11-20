// IrriGrow — arayüz
(function () {
  const D = window.IRRI_DATA, E = window.IrriEngine, V = window.IrriValidate, Ct = window.IrriCatalog, Gm = window.IrriGeom, HT = window.IrriHydroTable, I = window.IrriI18n;
  const t = I.t;
  const HV = window.IrriHydroView, HP = window.IrriHydroPanel, AS = window.IrriAssess, AV = window.IrriAssessView;
  // MH-AKIL-1: uyarı katmanı. Sonuç, Hidrolik, PDF ve Excel aynı çağrıyı kullanır (IrriAssess.forProject).
  const assessOf = r => AS.forProject(cur, r);
  const $ = s => document.querySelector(s);
  const KEY = 'irrismart.projects.v1', SKEY = 'irrismart.settings.v1', CKEY = 'irrismart.catalog.v1';
  const fmt = (v, d = 1) => (v == null || !Number.isFinite(Number(v))) ? '—' : Number(v).toLocaleString(I.locale, { minimumFractionDigits: d, maximumFractionDigits: d });
  const tl = v => v == null ? '—' : fmt(v, 0) + ' ₺';
  // Giriş kutusunda sayıyı seçili dilin ondalık işaretiyle göster (ayrıştırıcı nokta ve virgülü kabul eder)
  const inVal = v => typeof v === 'number' ? String(v).replace('.', (1.5).toLocaleString(I.locale).charAt(1)) : (v ?? '');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SRC = () => ({ kullanici: t('kullanıcı'), katalog: t('katalog'), ornek: t('örnek') });

  // ---------- Depolama ----------
  function load(k, def) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch (e) { return def; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast(t('Kayıt hatası: ') + e.message); return false; } }
  // Projeler: bozuk veya geçersiz kayıtlar silinmez, kurtarma anahtarına taşınır; şema değişiminden önce ham yedek alınır
  const St = window.IrriStore;
  let projects = (() => {
    let raw = null; try { raw = localStorage.getItem(KEY); } catch (e) { }
    const r = St.parseProjects(raw);
    try {
      if (r.rescue) localStorage.setItem('irrigrow.rescue.' + Date.now(), r.rescue);
      if (r.migrated && raw && !localStorage.getItem('irrigrow.premigration.v1')) localStorage.setItem('irrigrow.premigration.v1', raw);
    } catch (e) { }
    if (r.corrupt) setTimeout(() => toast(t('Proje kaydı okunamadı; ham veri kurtarma alanına kopyalandı.')), 500);
    return r.projects;
  })();
  let settings = Object.assign(JSON.parse(JSON.stringify(D.DEFAULT_PRICES)), { items: {}, edited: {} }, load(SKEY, {}));
  settings.items = settings.items || {}; settings.edited = settings.edited || {};
  let userCat = load(CKEY, null);
  let catalog = Ct.mergeCatalog(window.IRRI_CATALOG, userCat);
  let cur = null, lastRes = null, altCache = null;
  const persist = () => { if (cur) cur.updated = Date.now(); save(KEY, projects); };
  const saveSettings = () => { save(SKEY, settings); lastRes = null; };

  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 3000); }
  function safely(fn, where) { try { return fn(); } catch (e) { console.error(e); toast(`${where}: ${t('beklenmeyen hata')} (${e.message})`); } }

  // ---------- Gezinme ----------
  let kmlSonuc = null, kmlKatman = null, kmlGecici = null, kmlYeni = false;   // MH-KML durumu (show() kullandığı için burada)
  function show(v) {
    if (v !== 'arazi') kmlGeciciSil();
    if (v !== 'projeler' && v !== 'ayarlar' && !cur) { toast(t('Önce bir proje açın veya oluşturun')); v = 'projeler'; }
    if (v !== 'arazi') document.body.classList.remove('mapfull');
    document.querySelectorAll('.view').forEach(e => e.classList.toggle('on', e.id === 'v-' + v));
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    safely(() => ({ projeler: renderProjects, arazi: openMap, veri: renderForm, sonuc: renderResult, malzeme: renderBom, ayarlar: renderSettings, hidrolik: renderHydro, teknik: renderTech })[v](), t('Ekran'));
    if (window.IrriDesk) window.IrriDesk.refresh();
  }
  document.querySelectorAll('nav.tabs button[data-v]').forEach(b => b.onclick = () => show(b.dataset.v));
  $('#btnBack').onclick = () => show('projeler');
  $('#btnSettings').onclick = () => show('ayarlar');

  // ---------- Projeler ----------
  function newProject() {
    const name = (prompt(t('Proje adı:'), t('Yeni proje') + ' ' + (projects.length + 1)) || '').trim();
    if (!name) return;
    const p = { id: Date.now().toString(36), name: name.slice(0, 80), created: Date.now(), updated: Date.now(), poly: [], src: null, inp: { crop: 'domates', srcType: 'kuyu', region: 'akdeniz', soil: 'tinli', rowDir: 'uzun', emitter: 'normal', geom: 'dikdortgen' } };
    projects.unshift(p); persist(); openProject(p.id); show('arazi');
  }
  function openProject(id) { cur = projects.find(p => p.id === id) || null; lastRes = null; overlayRes = null; if (window.IrriDesk) window.IrriDesk.projectChanged(); $('#projName').textContent = cur ? cur.name : t('Proje seçilmedi'); }
  function renderProjects() {
    const el = $('#projList');
    if (!projects.length) { el.innerHTML = `<div class="card center muted">${t('Henüz proje yok.')}<br>${t('“Yeni proje” ile başlayın.')}</div>`; return; }
    el.innerHTML = projects.map(p => {
      const c = D.CROPS[p.inp.crop]; const a = V.parseNum(p.inp.area_da); const da = a > 0 ? fmt(a, 1) + ' da' : t('alan yok');
      return `<div class="proj"><div class="t" data-open="${p.id}"><b>${esc(p.name)}</b><span class="muted small">${c ? t(c.ad) : ''} · ${da}${p.inp.geom === 'parsel' ? ' · ' + t('parsel') : ''} · ${new Date(p.updated).toLocaleDateString(I.locale)}</span></div>
      <button class="btn sm" data-ren="${p.id}" aria-label="${t('Yeniden adlandır')}">✎</button><button class="btn sm" data-copy="${p.id}" aria-label="${t('Kopyala')}">⧉</button><button class="btn sm danger" data-del="${p.id}" aria-label="${t('Sil')}">✕</button></div>`;
    }).join('');
    el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { openProject(b.dataset.open); show(cur.inp.Q ? 'sonuc' : 'arazi'); });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const p = projects.find(x => x.id === b.dataset.del); if (confirm(t('“{n}” silinsin mi?', { n: p.name }))) { projects = projects.filter(x => x !== p); if (cur === p) { cur = null; $('#projName').textContent = t('Proje seçilmedi'); } persist(); renderProjects(); } });
    el.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { const p = projects.find(x => x.id === b.dataset.copy); const c = St.duplicate(p, t('kopya')); projects.unshift(c); persist(); renderProjects(); });
    el.querySelectorAll('[data-ren]').forEach(b => b.onclick = () => { const p = projects.find(x => x.id === b.dataset.ren); const nm = (prompt(t('Yeni ad:'), p.name) || '').trim(); if (nm) { p.name = nm.slice(0, 80); persist(); if (cur === p) $('#projName').textContent = p.name; renderProjects(); } });
  }
  $('#btnNew').onclick = newProject;
  // Yedekleme: tüm projeler + ayarlar + kullanıcı kataloğu tek JSON dosyasında
  $('#btnBackup').onclick = () => {
    if (!projects.length) return toast(t('Yedeklenecek proje yok'));
    window.IrriReport.json('IrriGrow_yedek', St.backupPayload(projects, settings, userCat)).then(() => { if (window.IrriDesk) window.IrriDesk.noteBackup(); }).catch(e => toast(t('Yedek alınamadı: ') + e.message));
  };
  $('#restoreFile').onchange = async ev => {
    const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
    try {
      let j; try { j = St.readBackup(await f.text()); } catch (e) { throw new Error(e.i18n ? t(e.message) : e.message); }
      const valid = j.valid;
      const plan = St.planBackup(projects, valid);
      if (!confirm(t('{n} proje yüklenecek.', { n: valid.length }) + (plan.farkli ? ' ' + t('{n} tanesi mevcut projelerle aynı kimlikte ama farklı: mevcut projeler korunacak, yedektekiler “(yedekten)” adıyla ayrı proje olarak eklenecek.', { n: plan.farkli }) : '') + (plan.ayni ? ' ' + t('{n} tanesi zaten aynı; değişmeyecek.', { n: plan.ayni }) : '') + ' ' + t('Devam edilsin mi?'))) return;
      St.mergeBackup(projects, valid);
      if (j.settings && confirm(t('Yedekteki fiyat ayarları da yüklensin mi?'))) { settings = Object.assign(JSON.parse(JSON.stringify(D.DEFAULT_PRICES)), { items: {}, edited: {} }, j.settings); saveSettings(); }
      if (j.catalog && !Ct.checkCatalog(j.catalog).length) { userCat = j.catalog; save(CKEY, userCat); catalog = Ct.mergeCatalog(window.IRRI_CATALOG, userCat); }
      persist(); cur = null; $('#projName').textContent = t('Proje seçilmedi'); renderProjects(); toast(t('{n} proje yüklendi', { n: valid.length }));
    } catch (e) { alert(t('Yedek yüklenemedi: ') + e.message); }
  };

  // ---------- Harita ----------
  // Renkler: ana hat kırmızı, manifold mavi, lateral yeşil, shift bölgeleri yarı saydam, su kaynağı turkuaz
  const COL = { main: '#d32f2f', man: '#1565c0', lat: '#2e9d4f', src: '#00bcd4', edge: '#ffd400' };
  let map, poly, markers = [], extra = [], planLayer = null, mapMode = 'sinir', overlayRes = null, showPlan = true, brush = 0, legend = null;
  function openMap() {
    if (!map) {
      map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([38.5, 33.5], 6);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: window.IrriKaynak ? IrriKaynak.haritaAtif(t) : 'Esri, Maxar' }).addTo(map);   // K-5: uydu ve kot atfı
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, opacity: .8 }).addTo(map);
      map.on('click', e => {
        const ll = [e.latlng.lat, e.latlng.lng];
        if (mapMode === 'shift') return;
        if (mapMode === 'kaynak') { cur.src = ll; setMode('sinir'); }
        else if (mapMode === 'istasyon') { cur.station = ll; setMode('sinir'); }
        else if (mapMode === 'anahat') (cur.route = cur.route || []).push(ll);
        else cur.poly.push(ll);
        invalidateDesign(); persist(); drawPoly();
      });
      legend = L.DomUtil.create('div', 'mlegend'); legend.innerHTML = `<div><i style="background:${COL.main}"></i>${t('Ana hat')}</div><div><i style="background:${COL.man}"></i>Manifold</div><div><i style="background:${COL.lat}"></i>Lateral</div><div><i style="background:${COL.src};height:8px;width:8px;border-radius:50%"></i>${t('Kaynak')}</div>`;
      $('#map').appendChild(legend);
      const zc = () => { const z = map.getZoom(), el = $('#map'); el.classList.toggle('zsmall', z < 17); el.classList.toggle('ztiny', z < 15); el.classList.toggle('znoeq', z < 17); }; map.on('zoomend', () => { zc(); mapLabels(); }); zc();
    }
    setMode(mapMode);
    if (showPlan && !overlayRes && cur.inp.geom === 'parsel' && cur.poly.length >= 3) safely(() => compute(), 'Plan');
    setTimeout(() => { map.invalidateSize(); drawPoly(true); }, 50);
  }
  function invalidateDesign() { lastRes = null; overlayRes = null; altCache = null; }
  function setMode(m) {
    mapMode = m;
    document.querySelectorAll('#mModes button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    const bar = $('#mShiftBar');
    if (m === 'shift') {
      const r = overlayRes && overlayRes.ok ? overlayRes : null;
      const n = r ? r.sel.groups.length : 0;
      bar.style.display = 'flex';
      bar.innerHTML = r ? `<span class="small">${t('Atanacak shift')}:</span> ${Array.from({ length: n + 1 }, (_, j) => `<button class="btn sm ${brush === j ? 'primary' : ''}" data-b="${j}" style="flex:none;min-width:38px"><span class="dot" style="background:${PALETTE[j % PALETTE.length]}"></span>${j + 1}${j === n ? '+' : ''}</button>`).join('')} <button class="btn sm" id="mAuto" style="flex:none">${t('Otomatik')}</button>${cur.shiftEditYedek ? ` <button class="btn sm" id="mGeri" style="flex:none">${t('Elle atamayı geri getir')}</button>` : ''}`
        : `<span class="small">${t('Önce “Uygula” ile parsel planını oluşturun.')}</span>`;
      bar.querySelectorAll('[data-b]').forEach(x => x.onclick = () => { brush = +x.dataset.b; setMode('shift'); });
      const au = $('#mAuto'); if (au) au.onclick = () => { if (!otomatigeDon()) return; compute(); setMode('shift'); drawPoly(); toast(t('Otomatik shift’lere dönüldü')); };
      const gg = $('#mGeri'); if (gg) gg.onclick = () => { elleAtamayiGeriGetir(); compute(); setMode('shift'); drawPoly(); };
    } else bar.style.display = 'none';
    document.documentElement.style.setProperty('--mapbar', (m === 'shift' ? 196 : 150) + 'px');
    if (map) setTimeout(() => map.invalidateSize(), 30);
    drawInfo();
  }
  document.querySelectorAll('#mModes button').forEach(b => b.onclick = () => { setMode(mapMode === b.dataset.m && b.dataset.m !== 'sinir' ? 'sinir' : b.dataset.m); drawPoly(); });
  function vtx(ll, cls, onMove, html, size = 16) {
    const m = L.marker(ll, { draggable: true, icon: L.divIcon({ className: cls, html: html || '', iconSize: [size, size] }) }).addTo(map);
    m.on('dragend', ev => { const p = ev.target.getLatLng(); onMove([p.lat, p.lng]); invalidateDesign(); persist(); drawPoly(); });
    extra.push(m); return m;
  }
  function drawPoly(fit) {
    kmlGeriDurum();
    if (poly) map.removeLayer(poly); poly = null;
    [...markers, ...extra].forEach(m => map.removeLayer(m)); markers = []; extra = [];
    const pts = cur.poly;
    if (pts.length) {
      poly = (pts.length >= 3 ? L.polygon(pts, { color: COL.edge, weight: 2, fillOpacity: .08, interactive: false }) : L.polyline(pts, { color: COL.edge, weight: 2, interactive: false })).addTo(map);
      if (mapMode === 'sinir') pts.forEach((p, i) => markers.push(vtx(p, 'vtx', q => { cur.poly[i] = q; })));
      if (fit && pts.length >= 2) map.fitBounds(poly.getBounds(), { padding: [30, 30], maxZoom: 18 });
    }
    // Ana hat güzergâhı (kullanıcı çizimi): kaynak → istasyon → noktalar
    const chain = [cur.src, cur.station, ...(cur.route || [])].filter(Boolean);
    if ((cur.route || []).length && chain.length >= 2) extra.push(L.polyline(chain, { color: COL.main, weight: 4, dashArray: mapMode === 'anahat' ? '8 6' : null, interactive: false }).addTo(map));
    if (mapMode === 'anahat') (cur.route || []).forEach((p, i) => vtx(p, 'rtv', q => { cur.route[i] = q; }, '', 14));
    if (cur.src) vtx(cur.src, 'srcm', q => { cur.src = q; }, 'K', 22).bindTooltip(t('Su kaynağı'));
    if (cur.station) vtx(cur.station, 'stam', q => { cur.station = q; }, 'P+F', 30).bindTooltip(t('Pompa ve filtre istasyonu'));
    drawPlan();
    drawInfo();
  }
  function drawInfo() {
    const pts = cur ? cur.poly : [], el = $('#mapInfo'); if (!el || !cur) return;
    const hint = { kaynak: t('Kaynak (kuyu/pompa) noktasına dokunun.'), istasyon: t('Pompa ve filtre istasyonunun yerine dokunun.'), anahat: t('Ana hat güzergâhını kaynaktan araziye doğru noktalarla çizin. Noktalar sürüklenebilir.'), shift: t('Bir alt üniteye dokunarak seçili shift’e atayın.') }[mapMode];
    if (hint) { el.textContent = hint + ((cur.route || []).length && mapMode === 'anahat' ? ' · ' + t('{n} nokta', { n: cur.route.length }) : ''); return; }
    if (pts.length >= 3) {
      const f = Gm.fieldFromPolygon(pts);
      el.innerHTML = `<b>${fmt(f.A / 1000, 2)} ${t('dekar')}</b> (${fmt(f.A / 10000, 2)} ha) · ${t('{n} köşe', { n: pts.length })}${cur.src ? ' · ' + t('kaynak işaretli') : ''}${f.selfX ? ' · <span class="bad">' + t('sınır kendini kesiyor') + '</span>' : f.fill < 0.8 ? ' · ' + t('düzensiz şekil') : ''}`
        + (cur.elev ? `<br><span class="small muted" id="kotNotu">${t('Kot: {a} (≈ 90 m) — ön inceleme, ölçülmüş kot değil', { a: 'Copernicus DEM' })} · <a href="#" id="kotBilgi">${t('ayrıntı')}</a></span>` : '');
      const kb = $('#kotBilgi'); if (kb) kb.onclick = ev => { ev.preventDefault(); show('ayarlar'); setTimeout(() => { const c = $('#kaynakKarti'); if (c) { c.open = true; c.scrollIntoView({ block: 'start' }); } }, 60); };
    } else el.textContent = pts.length ? t('{n} köşe — en az 3 köşe gerekli.', { n: pts.length }) : t('Haritada arazinin köşelerine sırayla dokunun. Köşeler sürüklenebilir.');
  }
  const tbl = rows => `<table>${rows.map(([a, b]) => `<tr><td>${a}</td><td><b>${b}</b></td></tr>`).join('')}</table>`;
  // Tasarım planını harita üzerinde göster; borulara dokununca bilgi kartı
  // MH-WEB-2: masaüstünde haritada tıklanan nesne sağ mühendislik panelinde açılır (balon yerine).
  // Android ve telefon genişliğinde IrriDesk etkin değildir; davranış aynen kalır (bilgi balonu).
  function deskPick(e, sel) {
    const D = window.IrriDesk; if (!D || !D.active) return;
    // Seçim tıklaması haritaya geçmesin: aksi halde “Sınır” modunda aynı tıklama sınıra köşe ekler.
    if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
    if (e && e.target && e.target.closePopup) setTimeout(() => e.target.closePopup(), 0);
    D.select(sel);
  }
  function drawPlan() {
    if (planLayer) { map.removeLayer(planLayer); planLayer = null; }
    const r = overlayRes;
    if (!showPlan || !r || !r.ok || r.layout.mode !== 'parsel') return;
    const Ly = r.layout, ll = p => { const [x, y] = Gm.unrot(p, Ly.angle); return Gm.fromLocal(x, y, Ly.lat0, Ly.lng0); };
    const g = L.layerGroup(), rend = L.canvas({ padding: 0.3, tolerance: 8 });
    const secOf = sectorIndex(r), pal = PALETTE, m = r.main.sel, s = r.schedule;
    r.units.forEach((u, k) => {
      const b = Ly.bands[u.band]; const c = Gm.clipRect(Ly.P, b.x0, b.x1, u.y0, u.y1); if (c.length < 3) return;
      const pg = L.polygon(c.map(ll), { renderer: rend, stroke: mapMode === 'shift', color: '#fff', weight: 1, fillColor: pal[secOf[k] % pal.length], fillOpacity: .38 }).addTo(g);
      if (mapMode === 'shift') pg.on('click', () => assignUnit(r, k));
      else pg.on('click', e => deskPick(e, { type: 'shift', j: secOf[k] })).bindPopup(() => `<b>Shift ${secOf[k] + 1}</b> · ${t('alt ünite')} ${k + 1}` + tbl([[t('Debi'), fmt(u.Q, 2) + ' m³/h'], [t('Lateral'), fmt(u.nLat, 0)], [t('Giriş basıncı'), fmt(u.hIn, 1) + ' m']]));
    });
    const step = Math.max(1, Math.ceil(Ly.laterals.length / 2500));
    for (let i = 0; i < Ly.laterals.length; i += step) {
      const l = Ly.laterals[i];
      L.polyline([ll([l.ax, l.y]), ll([l.ax + l.side * l.len, l.y])], { renderer: rend, color: COL.lat, weight: 1.2, opacity: .85, interactive: mapMode !== 'shift' }).addTo(g)
        .on('click', e => deskPick(e, { type: 'lateral', l, k: r.units.findIndex(u => u.band === l.band && l.y >= Math.min(u.y0, u.y1) - 1e-6 && l.y <= Math.max(u.y0, u.y1) + 1e-6) }))
        .bindPopup(() => `<b>Lateral Ø${r.lateral.d}</b>` + tbl([[t('İç çap'), fmt(r.lateral.ic, 1) + ' mm'], [t('Uzunluk'), fmt(l.len, 1) + ' m'], [t('Damlatıcı'), fmt(l.N, 0)], [t('Debi'), fmt(l.Q, 0) + ' l/h'], [t('Sürtünme kaybı'), fmt(l.hf, 2) + ' m'], [t('Basınç farkı'), fmt(l.dH, 2) + ' m'], [t('Giriş basıncı'), fmt(l.hreq, 1) + ' m'], [t('Malzeme'), 'PE']]));
    }
    r.units.forEach((u, k) => L.polyline([ll([u.ax, u.yIn]), ll([u.ax, u.yEnd])], { renderer: rend, color: COL.man, weight: 4, interactive: mapMode !== 'shift' }).addTo(g)
      .on('click', e => deskPick(e, { type: 'manifold', k }))
      .bindPopup(() => `<b>Manifold Ø${u.pipe.od} PN${u.pipe.pn}</b> · Shift ${secOf[k] + 1}` + tbl([[t('İç çap'), fmt(u.pipe.ic, 1) + ' mm'], [t('Uzunluk'), fmt(u.Lm, 1) + ' m'], [t('Debi'), fmt(u.Q, 2) + ' m³/h'], [t('Hız'), fmt(u.v, 2) + ' m/s'], [t('Sürtünme kaybı'), fmt(u.hf, 2) + ' m'], [t('Basınç farkı'), fmt(u.varH, 2) + ' m'], [t('Giriş basıncı'), fmt(u.hIn, 1) + ' m'], [t('Malzeme'), u.pipe.malzeme || 'PE100']])));
    // Ana hat: her segment kendi çapıyla (kademeli), kimlik kodu ve bilgi kartıyla
    r.main.net.forEach((sg, si) => {
      if (sg.kind === 'kaynak') return;
      L.polyline([ll(sg.a), ll(sg.b)], { renderer: rend, color: COL.main, weight: sg.od >= 160 ? 7 : sg.od >= 110 ? 6 : 5, interactive: mapMode !== 'shift' }).addTo(g)
        .on('click', e => deskPick(e, { type: 'anahat', i: si }))
        .bindPopup(() => `<b>${sg.id} · ${t('Ana hat')} ${sg.pipe && sg.pipe.kutuphane ? `${sg.pipe.malzeme} Ø${sg.od} SDR${sg.pipe.sdr}` : `PVC-U Ø${sg.od}`} PN${sg.pn}</b>` + tbl([[t('İç çap'), fmt(sg.ic, 1) + ' mm'], [t('Uzunluk'), fmt(sg.L, 1) + ' m'], [t('Debi (en büyük shift)'), fmt(sg.Qmax, 1) + ' m³/h'], [t('Hız'), fmt(sg.v, 2) + ' m/s'], [t('Sürtünme kaybı'), fmt(sg.hf, 2) + ' m'], [t('Malzeme'), 'PVC-U']]) + `<div class="small muted">Hazen-Williams C=150, +%10 ${t('yerel kayıp')}</div>`);
    });
    const M = drawModel(r);
    // Shift bilgi kutuları (sürüklenebilir; başlık shift rengiyle)
    M.shifts.forEach(sh => {
      const html = `<div class="sbox"><div class="sh" style="background:${sh.head}">FIELD ${sh.field} — SHIFT ${sh.no}</div><div class="bd">${window.IrriDrawing.shiftLines(M, sh, t).map(([a, b], i) => `<div class="${i === 2 ? 'k' : ''}"><span>${a}</span><b>${b}</b></div>`).join('')}</div></div>`;
      const mk = L.marker(M.toLL(sh.box), { draggable: mapMode !== 'shift', zIndexOffset: 500, icon: L.divIcon({ className: 'sboxw', html, iconSize: null }) }).addTo(g);
      mk.on('dragend', ev => { const q = ev.target.getLatLng(); (cur.drawPos = cur.drawPos || {})['S' + sh.no] = [q.lat, q.lng]; persist(); drawModelCache = null; });
    });
    // Ekipman sembolleri (sürüklenebilir; konum hidrolik hesabı değiştirmez)
    M.eq.forEach(e => {
      const big = !e.small, sz = big ? 22 : 15, off = e.offset && e.at === e.atDef ? e.offset * (sz + 2) : 0;
      const mk = L.marker(M.toLL(e.at), { draggable: true, zIndexOffset: 400, icon: L.divIcon({ className: 'eqm' + (e.small ? ' eqs' : ''), html: symSVG(e.type, sz), iconSize: [sz, sz], iconAnchor: [sz / 2 - off, sz / 2 + (e.small ? sz * 0.8 : 0)] }) }).addTo(g);
      mk.bindTooltip(esc(e.text), { direction: 'top' });
      mk.on('dragend', ev => { const q = ev.target.getLatLng(); (cur.drawPos = cur.drawPos || {})[e.code] = [q.lat, q.lng]; persist(); drawModelCache = null; drawPoly(); });
    });
    M.fittings.forEach(ft => { if (ft.type === 'reduksiyon') L.marker(M.toLL(ft.at), { interactive: true, icon: L.divIcon({ className: 'eqm eqs', html: symSVG('reduksiyon', 14), iconSize: [14, 14] }) }).bindTooltip(t('Redüksiyon') + ' ' + ft.text).addTo(g); });
    planLayer = g.addTo(map);
    mapLabels();
  }
  // Ortak çizim modeli (harita, Teknik Proje, PDF ve DXF aynı modeli kullanır)
  let drawModelCache = null;
  function drawModel(r) {
    if (drawModelCache && drawModelCache.r === r && drawModelCache.pos === JSON.stringify(cur.drawPos || {})) return drawModelCache.M;
    const M = window.IrriDrawing.build(cur, r, { t });
    drawModelCache = { r, M, pos: JSON.stringify(cur.drawPos || {}) }; return M;
  }
  function symSVG(type, px) {
    const Dr = window.IrriDrawing, P = Dr.symbol(type, 8, 8, 13, true);
    return Dr.toSVG({ W: 16, H: 16, prims: P }).replace(/width="16mm" height="16mm"/, `width="${px}" height="${px}"`).replace('<rect width="16" height="16" fill="#fff"/>', '');
  }
  // Boru etiketleri: ekran pikselinde çakışma önleyici yerleşim, her yakınlaştırmada yeniden
  let labelLayer = null;
  function mapLabels() {
    if (labelLayer) { map.removeLayer(labelLayer); labelLayer = null; }
    const r = overlayRes; if (!showPlan || !r || !r.ok || r.layout.mode !== 'parsel' || !map) return;
    const z = map.getZoom(); if (z < 15) return;
    const M = drawModel(r), Dr = window.IrriDrawing, pl = Dr.placer(), g = L.layerGroup();
    const P = q => { const p = map.latLngToLayerPoint(M.toLL(q)); return [p.x, p.y]; };
    // engeller: shift kutuları ve ekipman
    document.querySelectorAll('#map .sboxw').forEach(el => { const b = el.getBoundingClientRect(), m0 = map.getContainer().getBoundingClientRect(), o = map.containerPointToLayerPoint([b.left - m0.left, b.top - m0.top]); pl.block({ x0: o.x, y0: o.y, x1: o.x + b.width, y1: o.y + b.height }); });
    const fsz = z >= 18 ? 12 : z >= 17 ? 11 : 10;
    const put = (a, b, txt, cls) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), w = Dr.textW(txt, fsz) * 0.95, h = fsz * 1.3; if (len < 30) return;
      let rot = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; if (rot > 90) rot -= 180; if (rot < -90) rot += 180;
      const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], n = [-d[1], d[0]], c = [];
      for (const tp of [0.5, 0.3, 0.7]) for (const sd of [1, -1]) c.push({ x: a[0] + (b[0] - a[0]) * tp + n[0] * sd * h * 0.75, y: a[1] + (b[1] - a[1]) * tp + n[1] * sd * h * 0.75, w, h, rot });
      const got = pl.tryPlace(c); if (!got) return;
      const q = map.layerPointToLatLng([got.x, got.y]);
      L.marker(q, { interactive: false, icon: L.divIcon({ className: 'plab ' + cls, html: `<span style="transform:translate(-50%,-50%) rotate(${got.rot.toFixed(1)}deg);font-size:${fsz}px">${esc(txt)}</span>`, iconSize: [0, 0] }) }).addTo(g);
    };
    M.main.forEach(sg => { if (!sg.virtual) put(P(sg.a), P(sg.b), Dr.pipeLabel(sg), 'pm'); });
    if (z >= 16) M.units.forEach(u => put(P(u.a), P(u.b), Dr.manLabel(u), 'pf'));
    if (z >= 17) { const seen = new Set(); r.layout.laterals.forEach((l, i) => { if (seen.has(l.band)) return; const [a, b] = M.laterals[i]; const n0 = pl.list.length; put(P(a), P(b), Dr.latLabel(M), 'pl'); if (pl.list.length > n0) seen.add(l.band); }); }
    labelLayer = g.addTo(map);
  }
  function assignUnit(r, k) {
    const cur0 = sectorIndex(r);
    const assign = cur.shiftEdit && cur.shiftEdit.sig === r.layout.sig ? cur.shiftEdit.assign.slice() : cur0.slice();
    assign[k] = brush;
    // boş kalan shift numaralarını sıkıştır
    const ids = [...new Set(assign)].sort((a, b) => a - b); const map2 = new Map(ids.map((v, i) => [v, i]));
    cur.shiftEdit = { sig: r.layout.sig, assign: assign.map(v => map2.get(v)) };
    brush = Math.min(brush, ids.length);
    invalidateDesign(); persist(); const r2 = compute();
    if (r2.ok && r2.sel.overSource) toast(t('Bu shift kaynak debisini aşıyor'));
    setMode('shift'); drawPoly();
  }
  $('#mUndo').onclick = () => { if (mapMode === 'anahat') (cur.route || []).pop(); else if (mapMode === 'istasyon') cur.station = null; else cur.poly.pop(); invalidateDesign(); persist(); drawPoly(); };
  $('#mClear').onclick = () => {
    if (mapMode === 'anahat') { if (confirm(t('Ana hat güzergâhı silinsin mi?'))) { cur.route = []; invalidateDesign(); persist(); drawPoly(); } return; }
    if (confirm(t('Sınır ve kaynak noktası silinsin mi?') + (cur.shiftEdit ? ' ' + t('Elle yapılan shift ataması da kaldırılacak.') : '') + ' ' + t('Önceki hâl revizyon olarak saklanır.'))) { St.snapshot(cur, 'temizleme öncesi'); cur.poly = []; cur.src = null; cur.station = null; cur.route = []; delete cur.shiftEdit; delete cur.inp.grad; invalidateDesign(); persist(); drawPoly(); }
  };
  $('#mFull').onclick = () => { document.body.classList.toggle('mapfull'); setTimeout(() => map && map.invalidateSize(), 60); };
  $('#mPlan').onclick = () => { showPlan = !showPlan; if (showPlan) { const r = overlayRes || compute(); if (!r.ok) toast(t('Plan çizilemedi: ') + r.err[0]); else if (r.layout.mode !== 'parsel') toast(t('Harita planı için önce “Uygula” deyin (gerçek parsel modu)')); } $('#mPlan').classList.toggle('primary', showPlan && !!overlayRes); drawPoly(); };
  $('#mGps').onclick = async () => {
    try {
      const native = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
      let pos;
      const Geo = native ? window.IrriReport.plugin('Geolocation') : null;
      if (Geo) { try { await Geo.requestPermissions(); } catch (e) { } pos = await Geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 }); }
      else pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 }));
      map.setView([pos.coords.latitude, pos.coords.longitude], 17);
    } catch (e) { toast(t('Konum alınamadı: ') + (e.message || e)); }
  };
  $('#mApply').onclick = async () => {
    const pts = cur.poly; if (pts.length < 3) return toast(t('En az 3 köşe işaretleyin'));
    const f = Gm.fieldFromPolygon(pts);
    if (f.selfX) return toast(t('Sınır kendini kesiyor; köşeleri düzeltin'));
    Object.assign(cur.inp, { area_da: +(f.A / 1000).toFixed(2), L: +f.L.toFixed(1), W: +f.W.toFixed(1), geom: 'parsel' });
    invalidateDesign(); persist();
    toast(t('Parsel aktarıldı. Eğim ölçülüyor…'));
    try {
      const s = await measureSlope(pts, f.box.deg);
      if (s) {
        Object.assign(cur.inp, { slopeLong: +Math.abs(s.alongLong).toFixed(2), slopeShort: +Math.abs(s.alongShort).toFixed(2), grad: { gx: s.gx, gy: s.gy } });
        cur.elev = { zmin: s.zmin, zmax: s.zmax, total: s.total, src: 'Open-Meteo (Copernicus DEM ~90 m)' }; persist();
        toast(t('Eğim: uzun kenar %{a}, kısa kenar %{b} (kot {c}–{d} m)', { a: fmt(Math.abs(s.alongLong), 2), b: fmt(Math.abs(s.alongShort), 2), c: fmt(s.zmin, 0), d: fmt(s.zmax, 0) }));
      }
    } catch (e) { toast(t('Eğim alınamadı (internet?) — Veriler ekranından elle girin.')); }
    setTimeout(() => show('veri'), 1400);
  };
  // ---------- MH-KML: KML/KMZ ile arazi sınırı (K-4) ----------
  // Akış: dosya → önizleme (proje değişmez) → parsel seçimi → onay (mevcut parsel varsa) → revizyon + uygula →
  // "Uygula" ile aynı alan/eğim adımları. "İçe aktarmayı geri al" önceki hâle döner. Yükseklikler kot sayılmaz.
  // "KML/KMZ dosyasından yeni proje": önizleme için boş geçici proje açılır; parsel uygulanmazsa (İptal, ekrandan çıkış) silinir.
  function kmlGeciciSil() {
    if (!kmlGecici) return;
    const id = kmlGecici; kmlGecici = null; kmlSonuc = null; kmlPanel();
    const p = projects.find(x => x.id === id);
    if (p && !(p.poly && p.poly.length)) { projects = projects.filter(x => x !== p); if (cur === p) { cur = null; $('#projName').textContent = t('Proje seçilmedi'); } persist(); }
  }
  const kmlMetin = (m, p) => t(m, p);
  async function kmlAc(f) {
    try {
      const K = window.IrriKml; if (!K) throw new Error(t('KML okuyucu yüklenemedi.'));
      if (f.size > K.SINIR.dosyaBayt) throw Object.assign(new Error('Dosya çok büyük ({n} MB; en çok {m} MB).'), { kod: 'dosya-buyuk', p: { n: Math.round(f.size / 1048576), m: K.SINIR.dosyaBayt / 1048576 } });
      const buf = new Uint8Array(await f.arrayBuffer());
      const sonuc = K.oku(buf, f.name);
      if (kmlYeni || !cur) {
        kmlGeciciSil();
        const np = { id: Date.now().toString(36), name: (String(f.name).replace(/\.(kml|kmz)$/i, '').trim() || t('KML projesi')).slice(0, 80), created: Date.now(), updated: Date.now(), poly: [], src: null, inp: { crop: 'domates', srcType: 'kuyu', region: 'akdeniz', soil: 'tinli', rowDir: 'uzun', emitter: 'normal', geom: 'dikdortgen' } };
        projects.unshift(np); persist(); openProject(np.id); kmlGecici = np.id;
      }
      kmlSonuc = sonuc;
      show('arazi'); setTimeout(kmlPanel, 50);
    } catch (e) { kmlSonuc = null; kmlPanel(); kmlGeciciSil(); alert(t('KML/KMZ açılamadı: ') + (e.kod ? kmlMetin(e.message, e.p) : e.message)); }
  }
  function kmlOnizle(sec) {
    if (!map) return;
    if (kmlKatman) { map.removeLayer(kmlKatman); kmlKatman = null; }
    if (!kmlSonuc) return;
    kmlKatman = L.layerGroup().addTo(map);
    const hep = [];
    kmlSonuc.parseller.filter(p => p.halka && p.halka.length >= 3).forEach(p => {
      const on = sec && p.id === sec.id;
      L.polygon(p.halka, { color: on ? '#ff6f00' : '#9e9e9e', weight: on ? 3 : 1.5, dashArray: on ? null : '6 4', fillOpacity: on ? 0.15 : 0.04, interactive: false }).addTo(kmlKatman);
      hep.push(...p.halka);
    });
    const b = sec && sec.halka ? sec.halka : hep;
    if (b.length) map.fitBounds(L.latLngBounds(b), { padding: [24, 24] });
  }
  function kmlPanel() {
    const P = $('#kmlPanel'); if (!P) return;
    const s = kmlSonuc;
    if (!s) { P.style.display = 'none'; P.innerHTML = ''; kmlOnizle(null); return; }
    const satir = p => {
      const not = [];
      if (p.hata) not.push(`<span class="warn">${esc(kmlMetin(p.hata, p.hataP))}</span>`);
      if ((p.uyarilar || []).includes('kapanmamis')) not.push(esc(t('kapanmamış sınır kapatıldı')));
      if ((p.uyarilar || []).includes('yinelenen')) not.push(esc(t('yinelenen köşeler temizlendi')));
      if (p.yukseklikler) not.push(esc(t('yükseklik değerleri saklanacak; hidrolik kot verisi sayılmaz')));
      return `<label class="kml-row" style="display:block;padding:4px 0;${p.hesaplanabilir ? '' : 'opacity:.7'}"><input type="radio" name="kmlP" value="${esc(p.id)}" ${p.hesaplanabilir ? '' : 'disabled'}> <b>${esc(p.ad)}</b>${p.alan_m2 != null ? ` — ${fmt(p.alan_m2 / 1000, 2)} da · ${t('çevre')} ${fmt(p.cevre_m, 0)} m · ${p.halka.length} ${t('köşe')}` : ''}${not.length ? `<br><span class="small">${not.join(' · ')}</span>` : ''}</label>`;
    };
    P.innerHTML = `<b>${t('KML/KMZ içe aktarma')}</b> <span class="small muted">${esc(s.kaynak.dosya)}</span>
      <p class="small muted" style="margin:4px 0">${t('Önizleme — proje henüz değişmedi. Parseli seçip “Projeye uygula” deyin.')}</p>
      <div id="kmlListe">${s.parseller.map(satir).join('')}</div>
      ${s.notlar.map(n => `<p class="small muted" style="margin:2px 0">${esc(kmlMetin(n.mesaj, n.p))}</p>`).join('')}
      <div class="row" style="gap:6px;margin-top:6px"><button class="btn sm" id="kmlIptal">${t('İptal')}</button><button class="btn sm primary" id="kmlUygula" disabled>${t('Projeye uygula')}</button></div>`;
    P.style.display = 'block';
    const secilen = () => { const r = P.querySelector('input[name=kmlP]:checked'); return r ? s.parseller.find(x => x.id === r.value) : null; };
    P.querySelectorAll('input[name=kmlP]').forEach(r => r.onchange = () => { $('#kmlUygula').disabled = !secilen(); kmlOnizle(secilen()); });
    const uygunlar = s.parseller.filter(p => p.hesaplanabilir);
    if (uygunlar.length === 1) { const r = P.querySelector(`input[name=kmlP][value="${uygunlar[0].id}"]`); r.checked = true; $('#kmlUygula').disabled = false; kmlOnizle(uygunlar[0]); }
    else kmlOnizle(null);
    if (!uygunlar.length) P.insertAdjacentHTML('beforeend', `<p class="warn small">${t('Dosyada hesaplanabilir parsel yok.')}</p>`);
    $('#kmlIptal').onclick = () => { const gec = !!kmlGecici; kmlSonuc = null; kmlPanel(); if (gec) { kmlGeciciSil(); show('projeler'); } toast(t('İçe aktarma iptal edildi; hiçbir şey değişmedi')); };
    $('#kmlUygula').onclick = () => { const p = secilen(); if (p && p.hesaplanabilir) kmlUygula(p); };
  }
  function kmlUygula(p) {
    if (!cur) return;
    if (cur.poly && cur.poly.length >= 3 && !confirm(t('Bu projede çizilmiş bir parsel var. KML/KMZ parseli ile değiştirilsin mi? Önceki parsel revizyon olarak saklanır ve “İçe aktarmayı geri al” ile geri getirilebilir.'))) return;
    if (kmlGecici === cur.id) { kmlGecici = null; if (p.ad) { cur.name = String(p.ad).slice(0, 80); $('#projName').textContent = cur.name; } }
    St.snapshot(cur, 'KML/KMZ öncesi');
    const geri = { rev: cur.rev, geoKaynak: cur.geoKaynak || null, elev: cur.elev || null, t: Date.now() };
    cur.poly = p.halka.map(x => [x[0], x[1]]);
    cur.geoKaynak = window.IrriKml.geoKaynak(kmlSonuc, p);
    cur.kmlGeriAl = geri;
    delete cur.inp.grad; delete cur.elev;            // önceki parselin eğimi bu parsele ait değil; "Uygula" yeniden ölçer
    invalidateDesign(); persist();
    kmlSonuc = null; kmlPanel(); drawPoly(true);
    toast(t('Parsel içe aktarıldı: {a} ({b} da)', { a: p.ad, b: fmt(p.alan_m2 / 1000, 2) }));
    $('#mApply').onclick();
  }
  function kmlGeriDurum() { const b = $('#mKmlGeri'); if (b) b.style.display = cur && cur.kmlGeriAl ? '' : 'none'; }
  $('#mKml').onclick = () => { kmlYeni = false; $('#kmlFile').click(); };
  $('#btnKmlYeni').onclick = () => { kmlYeni = true; $('#kmlFile').click(); };
  // Android'de accept MIME filtresine çevrilir; KML'ler çoğu zaman application/octet-stream görünür ve seçilemez olur.
  // İçerik okunurken zaten denetlendiği için Android'de bütün dosyalar gösterilir.
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) $('#kmlFile').removeAttribute('accept');   // platform.js app.js’ten sonra yüklenir
  $('#kmlFile').onchange = async ev => { const f = ev.target.files[0]; ev.target.value = ''; if (f) await kmlAc(f); kmlYeni = false; };
  $('#mKmlGeri').onclick = () => {
    const g0 = cur && cur.kmlGeriAl; if (!g0) return;
    if (!confirm(t('KML/KMZ içe aktarması geri alınsın mı? Proje içe aktarmadan önceki hâline döner.'))) return;
    St.restoreRev(cur, g0.rev);
    if (g0.geoKaynak) cur.geoKaynak = g0.geoKaynak; else delete cur.geoKaynak;
    if (g0.elev) cur.elev = g0.elev; else delete cur.elev;
    delete cur.kmlGeriAl; invalidateDesign(); persist(); drawPoly(true); toast(t('İçe aktarma geri alındı'));
  };
  {
    const me = $('#map');
    if (me) {
      me.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
      me.addEventListener('drop', async e => {
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
        e.preventDefault();
        if (/\.(kml|kmz)$/i.test(f.name)) await kmlAc(f); else toast(t('Haritaya yalnız KML veya KMZ dosyası bırakılabilir'));
      });
    }
  }

  async function measureSlope(pts, deg) {
    const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1]);
    const inside = (x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [yi, xi] = pts[i], [yj, xj] = pts[j]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c; } return c; };
    const sample = pts.slice(0, 40);
    const [a, b, c, d] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    for (let i = 1; i < 7; i++) for (let j = 1; j < 7; j++) { const y = a + (b - a) * i / 7, x = c + (d - c) * j / 7; if (inside(x, y)) sample.push([y, x]); }
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${sample.map(p => p[0].toFixed(6)).join(',')}&longitude=${sample.map(p => p[1].toFixed(6)).join(',')}`;
    const r = await fetch(url); if (!r.ok) throw new Error(r.status);
    const j = await r.json(); if (!Array.isArray(j.elevation) || j.elevation.length !== sample.length) throw new Error('yükseklik verisi eksik');
    return Gm.slopeFromPoints(sample, j.elevation, deg);
  }

  // ---------- Veri formu ----------
  const opts = o => Object.entries(o).map(([k, v]) => [k, v.ad]);
  const FORM = [
    ['Arazi', [
      ['geom', 'Tasarım geometrisi', [['dikdortgen', 'Eşdeğer dikdörtgen'], ['parsel', 'Gerçek parsel sınırı']], null, 'one'],
      ['area_da', 'Alan (dekar)', 'num', null, null, (c, i) => i.geom === 'parsel'], ['rowDir', 'Sıra yönü', [['uzun', 'Uzun kenara paralel'], ['kisa', 'Kısa kenara paralel']]],
      ['L', 'Uzun kenar (m)', 'num', null, null, (c, i) => i.geom === 'parsel'], ['W', 'Kısa kenar (m)', 'num', null, null, (c, i) => i.geom === 'parsel'],
      ['slopeLong', 'Uzun kenar eğimi (%)', 'num', '0'], ['slopeShort', 'Kısa kenar eğimi (%)', 'num', '0'],
      ['nB', 'Manifold hattı sayısı', 'num', 'otomatik'],
      ['teleskop', 'Ana hat çap düzeni', [['', 'Kademeli (debiye göre)'], ['hayir', 'Tek çap']]],
    ]],
    ['Bitki ve iklim', [
      ['crop', 'Bitki', opts(D.CROPS), null, 'one'],
      ['Sr', 'Sıra arası (m)', 'num', c => c.Sr], ['Sp', 'Sıra üzeri (m)', 'num', c => c.Sp],
      ['region', 'Bölge', opts(D.REGIONS)], ['et0', 'Tepe ET0 (mm/gün)', 'num', (c, i) => (D.REGIONS[i.region] || {}).et0],
      ['soil', 'Toprak', opts(D.SOILS)], ['interval', 'Sulama aralığı (gün)', 'num', 'otomatik'],
    ]],
    ['Damla sistemi', [
      ['emitter', 'Damlatıcı tipi', [['normal', 'Normal'], ['pc', 'Basınç ayarlı (PC)']]], ['latD', 'Lateral çapı', [['', 'Otomatik'], ['16', 'Ø16 mm'], ['20', 'Ø20 mm']]],
      ['q', 'Damlatıcı debisi (l/h)', 'num', c => c.tip === 'agac' ? 4 : 2], ['Se', 'Damlatıcı aralığı (m)', 'num', '0,33', null, c => c.tip === 'agac'],
      ['ne', 'Ağaç başına damlatıcı', 'num', c => c.ne, null, c => c.tip !== 'agac'],
      ['hNom', 'Çalışma basıncı (m)', 'num', '10', null, (c, i) => i.emitter === 'pc'],
      ['pcMin', 'PC min. basınç (m)', 'num', '10', null, (c, i) => i.emitter !== 'pc'], ['pcMax', 'PC maks. basınç (m)', 'num', '30', null, (c, i) => i.emitter !== 'pc'],
    ]],
    ['Su kaynağı', [
      ['srcType', 'Kaynak', [['kuyu', 'Kuyu'], ['yuzey', 'Göl/kanal/havuz'], ['sebeke', 'Şebeke/hidrant']]],
      ['Q', 'Debi (m³/h) *', 'num', 'zorunlu'],
      ['depth', 'Dinamik seviye / emme (m)', 'num', (c, i) => i.srcType === 'kuyu' ? 30 : 2, null, (c, i) => i.srcType === 'sebeke'],
      ['pAvail', 'Mevcut basınç (bar)', 'num', 'bilinmiyor', null, (c, i) => i.srcType !== 'sebeke'],
      ['waterQ', 'Su kalitesi', [['', 'Bilinmiyor/kumlu'], ['temiz', 'Temiz']], null, null, (c, i) => i.srcType !== 'kuyu'],
      ['dSource', 'Kaynak–arazi mesafesi (m)', 'num', '0', null, (c, i) => i.geom === 'parsel' && cur && cur.src],
      ['dZ', 'Kaynak→arazi kot farkı (m)', 'num', '0'],
      ['hours', 'Günlük çalışma (saat)', 'num', '20'],
    ]],
  ];
  function renderForm() {
    const i = cur.inp, c = D.CROPS[i.crop] || {};
    const val = V.validate(i);
    const nErr = Object.keys(val.errors).length;
    const pa = i.geom === 'parsel' && (cur.poly || []).length >= 3 ? Gm.fieldFromPolygon(cur.poly) : null;
    $('#form').innerHTML = (pa ? `<div class="note" style="background:var(--pri2)">${t('Parsel alanı')} <b>${fmt(pa.A / 1000, 2)} da</b> — ${t('tasarım haritadaki gerçek sınır üzerinde yapılır.')}</div>` : '') + (nErr ? `<div class="note err">${t('{n} alanda hata var. Düzeltilmeden hesaplama yapılmaz.', { n: nErr })}</div>` : '') +
      FORM.map(([title, fields]) => `<fieldset><legend>${t(title)}</legend><div class="f">${fields.map(([k, lab, type, ph, cls, hide]) => {
        if (hide && hide(c, i)) return '';
        let phv = typeof ph === 'function' ? ph(c, i) : ph; if (typeof phv === 'string' && !/^[\d.,]+$/.test(phv)) phv = t(phv);
        const bad = val.errors[k];
        const field = Array.isArray(type)
          ? `<select name="${k}">${type.map(([v, tx]) => `<option value="${v}" ${String(i[k] ?? '') === v ? 'selected' : ''}>${t(tx)}</option>`).join('')}</select>`
          : `<input name="${k}" type="text" inputmode="decimal" value="${esc(i[k] ?? '')}" placeholder="${esc(String(phv ?? '').replace('.', ','))}" class="${bad ? 'bad' : ''}">`;
        return `<label ${cls === 'one' ? 'style="grid-column:1/-1"' : ''}>${t(lab)}${field}${bad ? `<span class="ferr">${esc(bad)}</span>` : ''}</label>`;
      }).join('')}</div></fieldset>`).join('') +
      (i.geom === 'parsel' && (cur.poly || []).length < 3 ? `<div class="note warn">${t('Gerçek parsel modu için Arazi ekranında sınır çizin.')}</div>` : '') +
      (i.grad && i.geom === 'parsel' ? `<p class="muted small">${t('Eğim yönü harita yükseklik verisinden alındı. Eğim alanlarını değiştirirseniz bu veri silinir.')}</p>` : '') +
      (val.warnings.length ? `<div class="note warn"><ul>${val.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '') +
      `<fieldset><legend>${t('Proje ayarları')}</legend><div class="f"><label>${t('Planlama oranı (%)')}<input name="__planOrani" id="planOrani" type="text" inputmode="decimal" value="${cur.akil && cur.akil.planOrani != null ? esc(String(Math.round(cur.akil.planOrani * 100))) : ''}" placeholder="${Math.round(AS.K_DEF * 100)}"></label></div>
       <p class="muted small">${t('Kullanılabilir çalışma süresinin planlamada kullanılacak oranı (%50–%100). Yalnız işletme payı uyarısını (W-KAP-02) etkiler; hesap sonucunu ve teknik uygunluğu değiştirmez.')}</p></fieldset>` +
      `<p class="muted small">${t('Boş alanlarda gri değer varsayım olarak kullanılır ve raporda listelenir. Ondalık için virgül kullanabilirsiniz.')}</p>
       <div class="sticky"><button type="button" class="btn primary block" id="btnCalc" ${nErr ? 'disabled' : ''}>${t('Hesapla')}</button></div>`;
    $('#form').querySelectorAll('input,select').forEach(el => el.onchange = () => {
      const v = el.value.trim();
      if (el.name === '__planOrani') {   // proje ayarı: motor girdisi DEĞİL (cur.inp'e yazılmaz)
        cur.akil = cur.akil || {};
        const x = V.parseNum(v);
        if (v === '' || !Number.isFinite(x)) delete cur.akil.planOrani; else cur.akil.planOrani = AS.clampK(x / 100);
        persist(); renderForm(); return;
      }
      if (v === '') delete i[el.name]; else i[el.name] = v;
      if (el.name === 'area_da') { delete i.L; delete i.W; }
      if (el.name === 'slopeLong' || el.name === 'slopeShort') delete i.grad;
      if (el.name === 'Ns' || el.name === 'crop') delete i.Ns;
      invalidateDesign(); persist(); renderForm();
    });
    $('#btnCalc').onclick = () => show('sonuc');
  }

  // K-1: "Otomatiğe dön" onay ister; elle atama 'shiftEditYedek' olarak saklanır ve geri getirilebilir
  function otomatigeDon() {
    const e = cur.shiftEdit || cur.shiftEditEski;
    if (e && !confirm(t('Elle yapılan shift ataması kaldırılıp otomatik shift’lere dönülsün mü? Atama saklanır; “Elle atamayı geri getir” ile geri alabilirsiniz.'))) return false;
    if (e) cur.shiftEditYedek = Object.assign({}, e, { t: Date.now() });
    delete cur.shiftEdit; delete cur.shiftEditEski; invalidateDesign(); persist();
    return true;
  }
  function elleAtamayiGeriGetir() {
    if (!cur.shiftEditYedek) return;
    cur.shiftEdit = cur.shiftEditYedek; delete cur.shiftEditYedek; invalidateDesign(); persist();
    toast(t('Elle yapılan shift ataması geri getirildi'));
  }

  // ---------- Hesap ----------
  function compute() {
    const opt = designOpt();
    // K-1: elle shift ataması hiçbir zaman uyarısız silinmez. Yerleşim değişirse 'shiftEditEski' olarak saklanır;
    // yerleşim aynı imzaya dönerse kendiliğinden geri gelir.
    const r = E.design(cur.inp, settings, Object.assign({ manual: cur.shiftEdit || cur.shiftEditEski || null }, opt));
    if (r.ok && !cur.shiftEdit && cur.shiftEditEski && cur.shiftEditEski.sig === r.layout.sig) { cur.shiftEdit = cur.shiftEditEski; delete cur.shiftEditEski; persist(); toast(t('Elle yapılan shift ataması geri yüklendi')); }
    if (r.ok && cur.shiftEdit && cur.shiftEdit.sig !== r.layout.sig) { cur.shiftEditEski = Object.assign({}, cur.shiftEdit, { t: Date.now() }); delete cur.shiftEdit; persist(); toast(t('Yerleşim değiştiği için elle shift ataması şu an uygulanamıyor; atama saklandı (yerleşim eski hâline dönerse geri gelir).')); }
    if (r.ok) { const before = cur.rev; St.snapshot(cur, 'hesap'); if (cur.rev !== before) save(KEY, projects); }
    // Kayıtlı shift sayısı artık mümkün değilse (veriler değişti) seçimi sıfırla
    if (r.ok && cur.inp.Ns && !r.sectorAlts.some(a => a.Ns === Number(V.parseNum(cur.inp.Ns)))) { delete cur.inp.Ns; persist(); return compute(); }
    lastRes = r; overlayRes = r; return r;
  }
  const mainSizes = r => { const m = new Map(); r.main.net.forEach(sg => m.set(`Ø${sg.od} PN${sg.pn}`, (m.get(`Ø${sg.od} PN${sg.pn}`) || 0) + sg.L)); return [...m].map(([k, L]) => `${k} ${fmt(L, 0)} m`).join(', '); };
  const designOpt = () => ({ poly: cur.poly, src: cur.src, station: cur.station, route: cur.route, catalog });
  const PALETTE = ['#8fd19e', '#7cc5e8', '#f5c26b', '#e99aa8', '#b8a6e8', '#9fe0d3', '#d9d47a', '#f0a875', '#a3c2f0', '#c9e39a', '#e0b0d5', '#b5d99c'];
  function sectorIndex(r) { const m = []; r.sel.groups.forEach((gr, j) => gr.forEach(k => { m[k] = j; })); return m; }
  // Ana hat: kaynak → başlık → bant eksenleri boyunca en uzak alt ünite girişine
  function mainLines(r) {
    const Ly = r.layout, src = Ly.src, H = Ly.headerPts, segs = [];
    if (Ly.route) segs.push(Ly.route);
    segs.push([src, H[Ly.headerEntry]]);
    if (H.length > 1) segs.push(H);
    H.forEach(([ax, y]) => { const far = r.units.filter(u => u.ax === ax).reduce((m, u) => Math.abs(u.yIn - y) > Math.abs(m - y) ? u.yIn : m, y); if (far !== y) segs.push([[ax, y], [ax, far]]); });
    return segs;
  }


  // Shift kartları: alan, lateral/manifold sayısı, debi, giriş basıncı, süre, hacim, enerji, çalışan vanalar; içinde alt ünite ataması
  function shiftCards(r) {
    const sel = r.sel, m = r.main.sel, s = r.schedule, n = sel.groups.length;
    return sel.groups.map((gr, j) => {
      const A = gr.reduce((x, k) => x + r.units[k].Q, 0) / r.sectors.Qfield * r.field.da;
      const nLat = gr.reduce((x, k) => x + r.units[k].nLat, 0), V = sel.Qj[j] * s.t;
      const kWh = 9.81 * m.Hp[j] * (s.seasonM3 * sel.Qj[j] / r.sectors.Qfield) / 3600 / 0.63;
      const over = sel.Qj[j] > (V0(cur.inp.Q) || Infinity) + 1e-9;
      return `<details class="ucard"><summary><span class="dot" style="background:${PALETTE[j % PALETTE.length]}"></span><b>Shift ${j + 1}</b><span>${fmt(A, 1)} da</span><span class="${over ? 'bad' : ''}">${fmt(sel.Qj[j], 1)} m³/h${over ? ' ✗' : ''}</span><span>${fmt(m.H[j], 1)} m</span><span>${fmt(s.t, 1)} h</span></summary><div class="in"><div class="kv">
        <div>${t('Lateral sayısı')}</div><div>${fmt(nLat, 0)}</div><div>${t('Manifold sayısı')}</div><div>${gr.length}</div>
        <div>${t('Gerekli giriş basıncı')}</div><div>${fmt(m.H[j], 1)} m (${t('pompa')} ${fmt(m.Hp[j], 1)} m)</div>
        <div>${t('Su hacmi (bir sulama)')}</div><div>${fmt(V, 1)} m³</div><div>${t('Sezonluk enerji')}</div><div>${fmt(kWh, 0)} kWh</div>
        <div>${t('Açılacak manifoldlar')}</div><div>${gr.map(k => 'M' + (k + 1)).join(', ')}</div></div>
        <div class="scroll"><table><tr><th>${t('Alt ünite')}</th><th>${t('Debi')} m³/h</th><th>Lateral</th><th>Manifold</th><th>Shift</th></tr>${gr.map(k => { const u = r.units[k]; return `<tr><td>M${k + 1}</td><td>${fmt(u.Q, 2)}</td><td>${u.nLat}</td><td>Ø${u.pipe.od}</td><td><select data-unit="${k}">${Array.from({ length: n + 1 }, (_, q) => `<option value="${q}" ${q === j ? 'selected' : ''}>${q + 1}${q === n ? ' (' + t('yeni') + ')' : ''}</option>`).join('')}</select></td></tr>`; }).join('')}</table></div></div></details>`;
    }).join('');
  }
  const V0 = v => { const x = V.parseNum(v); return Number.isFinite(x) ? x : null; };
  const ROWD = { uzun: 'Uzun kenara paralel', kisa: 'Kısa kenara paralel' };
  function altHtml(A) {
    const P = A.picks, tagOf = v => [[P.yatirim, A.priced ? 'En düşük yatırım' : 'En az boru metrajı'], [P.enerji, 'En düşük enerji'], [P.dengeli, 'Dengeli']].filter(([x]) => x === v).map(([, l]) => `<span class="tag">${t(l)}</span>`).join(' ');
    return `${A.priced ? '' : `<div class="note warn small">${t('Bazı kalemlerin fiyatı eksik: yatırım karşılaştırması boru metrajıyla yapıldı, ekonomik sıralama kesin değildir.')}</div>`}
      <div class="scroll"><table><tr><th>${t('Sıra yönü')}</th><th>Lateral</th><th>Shift</th><th>${t('Boru')} m</th><th>${t('Motor')} kW</th><th>${t('Enerji')} kWh/${t('yıl')}</th><th>${t('Yatırım')} ₺</th><th>5 / 10 / 15 ${t('yıl')} ₺</th></tr>
      ${A.list.map((v, i) => v.ok ? `<tr class="click ${String(cur.inp.rowDir || 'uzun') === v.rowDir && String(cur.inp.latD || '') === v.latD ? 'sel' : ''}" data-alt="${i}"><td>${t(ROWD[v.rowDir])}${tagOf(v) ? '<br>' + tagOf(v) : ''}</td><td>Ø${v.latD}</td><td class="${v.feasible ? '' : 'bad'}">${v.Ns}${v.feasible ? '' : ' ✗'}</td><td>${fmt(v.pipeLen, 0)}</td><td>${v.motor ? fmt(v.motor, 1) : '—'}</td><td>${fmt(v.kWh, 0)}</td><td>${v.inv != null ? fmt(v.inv, 0) : `<span class="muted">${t('fiyat eksik')}</span>`}</td><td>${v.life ? v.life.map(x => fmt(x / 1000, 0)).join(' / ') + ' bin' : '—'}</td></tr>` : `<tr><td>${t(ROWD[v.rowDir])}</td><td>Ø${v.latD}</td><td colspan="6" class="bad small">${esc(v.err)}</td></tr>`).join('')}</table></div>
      <p class="muted small">${t('Satıra dokunarak bu yerleşimi uygulayın (sıra yönü ve lateral çapı Veriler ekranına yazılır). ✗: tur süresi mevcut çalışma süresine sığmıyor.')}</p>`;
  }
  function bindAlt(el) {
    const b = $('#bAlt'); if (b) b.onclick = () => { b.disabled = true; b.textContent = t('Hesaplanıyor…'); setTimeout(() => safely(() => { altCache = E.layoutAlternatives(cur.inp, settings, designOpt()); $('#altBody').innerHTML = altHtml(altCache); bindAlt(el); }, t('Alternatifler')), 30); };
    el.querySelectorAll('tr[data-alt]').forEach(x => x.onclick = () => { const v = altCache.list[+x.dataset.alt]; const keep = altCache; cur.inp.rowDir = v.rowDir; cur.inp.latD = v.latD; delete cur.inp.Ns; delete cur.inp.mainOd; if (cur.shiftEdit) { cur.shiftEditEski = Object.assign({}, cur.shiftEdit, { t: Date.now() }); delete cur.shiftEdit; } invalidateDesign(); altCache = keep; persist(); renderResult(); toast(t('Yerleşim uygulandı')); });
  }

  function renderResult() {
    const r = compute(), el = $('#result');
    const notes = (r.err.length ? `<div class="note err"><b>${t('Kesin sonuç verilemiyor')}</b><ul>${r.err.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : '') +
      (!r.ok && r.warn.length ? `<div class="note warn"><b>${t('Uyarılar')}</b><ul>${r.warn.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : '');
    if (!r.ok) { el.innerHTML = notes + `<button class="btn block" id="bBack">${t('Verilere dön')}</button>`; $('#bBack').onclick = () => show('veri'); return; }
    const s = r.schedule, m = r.main.sel, sel = r.sel;
    const A = assessOf(r);
    const akil = AV.make({ t, fmt, esc }).render(A) + (I.lang !== 'tr' && (A.other.length || r.asm.length) ? `<p class="muted small">${t('Hesap notları (uyarılar ve varsayımlar) şu an yalnız Türkçe gösterilir.')}</p>` : '');
    el.innerHTML = `
    <div class="big">
      <div><b>${fmt(r.field.da, 1)} da</b><span>${esc(t(D.CROPS[cur.inp.crop].ad))} · ${r.field.mode === 'parsel' ? t('parsel') : t('dikdörtgen')}</span></div>
      <div><b>${r.sectors.Ns}</b><span>Shift · ${t('en büyük')} ${fmt(r.sectors.Qsec, 1)} m³/h</span></div>
      <div><b>${fmt(s.gross, 1)} ${t('mm/gün')}</b><span>${t('Tepe brüt su ihtiyacı')}</span></div>
      <div><b>${fmt(s.t, 1)} ${t('saat')}</b><span>${t('Shift başına / {n} günde bir', { n: s.interval })}</span></div>
    </div>
    ${notes}${akil}
    <div class="card"><h3>${t('Yerleşim planı')}</h3><div class="layout">${layoutSvg(r)}</div>
      <p class="muted small">${r.field.mode === 'parsel' ? t('Gerçek parsel sınırı üzerinde. Haritada görmek için Arazi ekranındaki “Plan” düğmesini kullanın.') : t('Eşdeğer dikdörtgen üzerinde. Gerçek sınır için Arazi ekranında parsel çizin ve “Uygula” deyin.')} ${t('Renkler shift’leri gösterir; lateraller seyreltilerek çizilmiştir.')}</p></div>
    <div class="card"><h3>${t('Shift planlaması alternatifleri')}</h3><p class="muted small">${t('Kaynak debisi')} ${fmt(cur.inp.Q ? V.parseNum(cur.inp.Q) : 0, 1)} m³/h. ${I.lang === 'tr' ? 'Öneri ölçütü: ' + esc(r.recBasis) + '. ' : ''}${t('Satıra dokunarak seçin.')}</p>
      <div class="scroll"><table><tr><th>Shift</th><th>${t('Maks. debi')} m³/h</th><th>${t('Tur')} h</th><th>${t('Ana hat')}</th><th>H m</th><th>${t('Motor')} kW</th><th>${t('Enerji')} kWh/${t('yıl')}</th><th>${t('Yıllık')} ₺</th></tr>
      ${r.sectorAlts.map(a => `<tr class="click ${a === sel ? 'sel' : ''}" data-ns="${a.Ns}"><td>${a.Ns}${a.recommended ? `<br><span class="tag">${t('Önerilen')}</span>` : ''}</td><td>${fmt(a.Qmax, 1)}</td><td class="${a.feasible ? '' : 'bad'}">${fmt(a.cycleHours, 1)}${a.feasible ? '' : ' ✗'}</td><td>Ø${a.main.sel.od}</td><td>${fmt(a.main.sel.Hmax, 1)}</td><td>${a.pump.need ? fmt(a.pump.motor, 1) : '—'}</td><td>${fmt(a.kWh, 0)}</td><td>${a.missing.length ? `<span class="muted">${t('fiyat eksik')}</span>` : fmt(a.compare, 0)}</td></tr>`).join('')}
      </table></div><p class="muted small">${t('Tur süresi, {d} günlük aralıkta mevcut {h} saatle karşılaştırılır (✗ sığmaz).', { d: s.interval, h: fmt(sel.avail, 0) })}</p></div>
    <div class="card"><h3>${t('Shift’ler')}${sel.manual ? ` <span class="tag warn">${t('elle düzenlendi')}</span>` : ''}</h3>${shiftCards(r)}
      <div class="row" style="margin-top:8px"><button class="btn sm" id="bShiftMap" style="flex:1">${t('Haritada düzenle')}</button>${sel.manual ? `<button class="btn sm" id="bShiftAuto" style="flex:1">${t('Otomatik')}</button>` : ''}</div>
      <p class="muted small">${t('Shift alanı, debi oranından hesaplanır.')} <a href="#" id="toHydro">${t('Hidrolik Hesap Tablosu')} →</a></p></div>
    <div class="card"><h3>${t('Hidrolik')}</h3><div class="kv">
      <div>Lateral</div><div>Ø${r.lateral.d} · ${t('en uzun')} ${fmt(r.lateral.maxLen, 1)} m (${t('izin')} ${fmt(r.lateral.Lmax, 1)} m)</div>
      <div>${t('Lateral adedi / toplam')}</div><div>${fmt(r.lateral.count, 0)} · ${fmt(r.lateral.len, 0)} m</div>
      ${r.lateral.lead > 1 ? `<div>${t('Kör lateral')}</div><div>${fmt(r.lateral.lead, 0)} m</div>` : ''}
      <div>${t('Lateral basınç farkı')}</div><div>${fmt(r.lateral.maxDH, 2)} / ${fmt(r.emitter.allowLat, 2)} m</div>
      <div>${t('Alt ünite (manifold)')}</div><div>${r.manifold.count} · ${r.manifold.byPipe.map(b => `Ø${b.pipe.od} PN${b.pipe.pn} ×${b.count}`).join(', ')}</div>
      <div>${t('Manifold maks. debi / hız')}</div><div>${fmt(r.manifold.Qmax, 1)} m³/h · ${fmt(r.manifold.vMax, 2)} m/s</div>
      <div>${t('Manifold basınç farkı')}</div><div>${fmt(r.manifold.varMax, 2)} / ${fmt(r.emitter.allowMan, 2)} m</div>
      <div>${t('Lateral / manifold giriş')}</div><div>${fmt(r.inlet.hLatIn, 1)} / ${fmt(r.inlet.hManIn, 1)} m</div>
      <div>${t('Ana hat')}</div><div>${r.main.sel.pipe && r.main.sel.pipe.kutuphane ? r.main.sel.pipe.malzeme + ' SDR' + r.main.sel.pipe.sdr : 'PVC'} ${mainSizes(r)} · ${fmt(r.main.Lmain, 0)} m</div>
      ${r.layout.route ? `<div>${t('Çizilen güzergâh')}</div><div>${fmt(r.layout.routeLen, 0)} m</div>` : ''}
      <div>${t('Ana hat hız / kayıp')}</div><div>${fmt(m.v, 2)} m/s · ${fmt(m.hf, 1)} m</div>
      <div>${t('Filtre / vana kaybı')}</div><div>${fmt(r.head.filter, 1)} / ${fmt(r.head.valve, 1)} m</div>
      <div>${t('Gerekli basma yüksekliği')}</div><div>${fmt(m.Hmax, 1)} mSS</div>
    </div></div>
    <div class="card"><h3>${t('Ekipman')}</h3><div class="kv">
      <div>${t('Pompa')}</div><div style="text-align:end">${esc(r.pump.need ? (r.pump.fromCatalog ? `${r.pump.ad}, ${fmt(r.pump.motor, 1)} kW — ${fmt(r.pump.Q, 1)} m³/h @ ${fmt(r.pump.H, 1)} m` : `${t('Katalogda uygun pompa yok')} — ${fmt(r.pump.Q, 1)} m³/h @ ${fmt(r.pump.H, 1)} m, ~${fmt(r.pump.motor, 1)} kW`) : t('Pompa gerekmez'))}${r.pump.fromCatalog && !r.pump.verified ? `<br><span class="tag warn">${t('doğrulanmamış katalog')}</span>` : ''}</div>
      ${r.pump.fromCatalog ? `<div>${t('Çalışma noktaları')}</div><div style="text-align:end">${r.pump.pts.map(x => `${fmt(x.Q, 1)} m³/h: ${fmt(x.H, 1)} m (${t('gerekli')} ${fmt(x.Hreq, 1)}), η %${fmt(x.eta, 0)}`).join('<br>')}</div>` : ''}
      <div>${t('Filtrasyon')}</div><div style="text-align:end">${esc(r.filter.items.map(({ f, n }) => `${n} × ${t(f.ad)}`).join(' + ') || '—')}</div>
      <div>${t('Shift vanası')}</div><div>${esc(r.valve.v ? r.valve.v.cap : '—')} × ${r.units.length} (${t('manifold girişi')})</div>
    </div><p class="muted small">${t('Pompa, her shift debisinde eğrisi gerekli basıncı karşılayan ve sezonluk enerjisi en düşük katalog kaydıdır. Jenerik kayıtlar gerçek ürün değildir; gerçek kataloğu ⚙ Ayarlar\'dan yükleyin.')}</p></div>
    <div class="card"><h3>${t('Ana hat alternatifleri')} (${sel.Ns} shift)</h3><p class="muted small">${r.main.allPriced ? t('Yıllık = boru yatırımının {n} yıllık taksiti + enerji.', { n: settings.omur }) : t('Bazı çapların fiyatı yok: çap hız ölçütüyle seçildi.')} ${t('Satıra dokunarak seçin.')}</p>
      <div class="scroll"><table><tr><th>${t('Çap')}</th><th>${t('Hız')}</th><th>${t('Kayıp')} m</th><th>H m</th><th>${t('Boru')} ₺</th><th>${t('Enerji')} ₺/${t('yıl')}</th><th>${t('Yıllık')} ₺</th></tr>
      ${r.main.alts.map(a => `<tr class="click ${a === m ? 'sel' : ''}" data-od="${a.od}"><td>Ø${a.od} PN${a.pn}${a.tags.map(x => `<br><span class="tag">${t(x)}</span>`).join('')}</td><td>${fmt(a.v, 2)}</td><td>${fmt(a.hf, 1)}</td><td>${fmt(a.Hmax, 1)}</td><td>${a.pipeCost != null ? fmt(a.pipeCost, 0) : '—'}</td><td>${fmt(a.energyCost, 0)}</td><td><b>${a.annual != null ? fmt(a.annual, 0) : '—'}</b></td></tr>`).join('')}
      </table></div></div>
    <div class="card" id="altCard"><h3>${t('Yerleşim alternatifleri')}</h3><div id="altBody">${altCache ? altHtml(altCache) : `<p class="muted small">${t('Sıra yönü ve lateral çapının 4 birleşimi tam tasarımla hesaplanır; en düşük yatırım, en düşük enerji ve dengeli seçenek işaretlenir.')}</p><button class="btn sm" id="bAlt">${t('Alternatifleri hesapla')}</button>`}</div></div>
    <div class="card"><h3>${t('Sulama programı')}</h3><div class="kv">
      <div>ET0 (${t('tepe')})</div><div>${fmt(s.et0, 2)} ${t('mm/gün')}</div><div>Kc · Kr</div><div>${fmt(s.kc, 2)} · ${fmt(s.Kr, 2)}</div>
      <div>${t('Net / brüt ihtiyaç')}</div><div>${fmt(s.net, 2)} / ${fmt(s.gross, 2)} ${t('mm/gün')}</div>
      <div>${t('Bitki başına (tepe)')}</div><div>${fmt(s.lpPlant, 1)} ${t('l/gün')}</div>
      <div>${t('Uygulama hızı')}</div><div>${fmt(s.AR, 2)} mm/h</div><div>${t('Maks. aralık (toprak)')}</div><div>${s.Imax} ${t('gün')}</div>
      <div>${t('Bir tur (tüm shift’ler)')}</div><div>${fmt(s.cycleHours, 1)} ${t('saat')}</div>
      <div>${t('Sezonluk su')}</div><div>${fmt(s.seasonM3, 0)} m³ (${fmt(s.seasonM3 / r.field.da, 0)} m³/da)</div>
      <div>${t('Sezonluk enerji')}</div><div>${fmt(s.kWh, 0)} kWh · ${tl(s.energyCost)}${s.epSrc === 'ornek' ? ' (' + t('örnek fiyat') + ')' : ''}</div>
    </div>
    <div class="scroll" style="margin-top:10px"><table><tr><th>${t('Ay')}</th><th>Kc</th><th>ET0</th><th>${t('Brüt')} mm</th><th>${t('Aralık')}</th><th>${t('Süre')} h</th><th>m³/da</th></tr>
      ${s.monthly.map(x => `<tr><td>${monthName(x.m)}</td><td>${fmt(x.kc, 2)}</td><td>${fmt(x.et0, 1)}</td><td>${fmt(x.gross, 1)}</td><td>${x.interval}</td><td>${fmt(x.sure, 1)}</td><td>${fmt(x.m3da, 0)}</td></tr>`).join('')}</table></div></div>
    <div class="card"><details><summary>${t('Varsayımlar')} (${r.asm.length})</summary><ul class="small">${r.asm.map(a => `<li>${esc(a)}</li>`).join('')}</ul></details></div>
    <div class="row"><button class="btn primary" style="flex:1" id="bPdf">${t('PDF rapor')}</button><button class="btn" style="flex:1" id="bXls">Excel</button></div>`;
    el.querySelectorAll('tr[data-ns]').forEach(x => x.onclick = () => { const k = Number(x.dataset.ns); if (r.sectorAlts.find(a => a.recommended).Ns === k) delete cur.inp.Ns; else cur.inp.Ns = k; delete cur.inp.mainOd; persist(); renderResult(); });
    el.querySelectorAll('tr[data-od]').forEach(x => x.onclick = () => { cur.inp.mainOd = Number(x.dataset.od); persist(); renderResult(); });
    bindAlt(el);
    el.querySelectorAll('select[data-unit]').forEach(x => x.onchange = () => {
      const assign = sectorIndex(r).slice(); assign[+x.dataset.unit] = +x.value;
      const ids = [...new Set(assign)].sort((p, q) => p - q), mp = new Map(ids.map((v, i) => [v, i]));
      cur.shiftEdit = { sig: r.layout.sig, assign: assign.map(v => mp.get(v)) }; invalidateDesign(); persist(); renderResult();
    });
    $('#bShiftMap').onclick = () => { if (r.layout.mode !== 'parsel') return toast(t('Harita planı için önce “Uygula” deyin (gerçek parsel modu)')); show('arazi'); setMode('shift'); drawPoly(); };
    const sa = $('#bShiftAuto'); if (sa) sa.onclick = () => { if (otomatigeDon()) renderResult(); };
    $('#toHydro').onclick = e => { e.preventDefault(); show('hidrolik'); };
    bindExport('#bPdf', '#bXls', r);
    el.querySelectorAll('select[data-onay]').forEach(x => x.onchange = () => {
      cur.akil = cur.akil || {}; cur.akil.onay = cur.akil.onay || {};
      if (x.value === 'yok') delete cur.akil.onay[x.dataset.onay]; else cur.akil.onay[x.dataset.onay] = x.value;
      persist(); toast(t('Kaydedildi'));
    });
    if (pendingFocus) { const c = document.getElementById('ak-' + pendingFocus); pendingFocus = null; if (c) { c.open = true; c.scrollIntoView({ block: 'start' }); } }
  }
  let pendingFocus = null;
  // ---------- MH-WEB-2: masaüstü düzeni için uygulama API'si ----------
  // IrriDesk yalnız web'de ve ≥ 1200 px'te etkinleşir. Buradaki işlevlerin hepsi uygulamanın mevcut işlevleridir.
  const deskExport = async kind => {
    if (!cur) return toast(t('Önce bir proje açın veya oluşturun'));
    const r = lastRes && lastRes.ok ? lastRes : compute();
    if (!r.ok) return toast(t('Kesin sonuç verilemiyor'));
    try {
      if (kind === 'pdf') await window.IrriReport.pdf(cur, r, layoutSvg(r));
      else if (kind === 'xlsx') await window.IrriReport.xlsx(cur, r);
      else if (kind === 'hxlsx') await window.IrriReport.hydroXlsx(cur);
      else {
        const M = drawModel(r), o = techOpt();
        if (kind === 'dxf') { if (!M.geo) toast(t('DXF yerel koordinatlarla (m) üretildi; gerçek koordinat için parsel modunu kullanın.')); await window.IrriReport.dxf(cur, M); }
        else await window.IrriReport.sheetPdf(cur, M, Object.assign({}, o, { cropName: t(D.CROPS[cur.inp.crop].ad) }));
      }
    } catch (e) { toast(t('Hata: ') + (e && e.message || e)); }
  };
  if (window.IrriDesk) window.IrriDesk.init({
    t, fmt, esc, I,
    isNative: () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()),
    cur: () => cur,
    result: () => (cur ? (lastRes && lastRes.ok ? lastRes : (cur.inp.Q ? compute() : null)) : null),
    assess: r => assessOf(r),
    hv: r => HV.build(r, { inp: cur.inp, Qsource: V0(cur.inp.Q), assess: assessOf(r) }),
    show: v => show(v),
    openHydro: (tab, j) => { const h = hydroState(); h.ptab = tab; if (j != null) h.pshift = j; persist(); show('hidrolik'); },
    focusFinding: kod => { pendingFocus = kod; show('sonuc'); },
    newProject: () => newProject(),
    backup: () => $('#btnBackup').click(),
    restore: () => $('#restoreFile').click(),
    export: kind => deskExport(kind),
    themeOf: () => themeOf(), setTheme: v => setTheme(v),
    mapResize: () => setTimeout(() => { if (map) map.invalidateSize(); }, 80),
  });
  const monthName = m => new Date(2026, m - 1, 1).toLocaleDateString(I.locale, { month: 'short' });
  function bindExport(a, b, r) {
    const run = (btn, label, fn) => { const el = $(btn); el.onclick = async () => { if (el.disabled) return; el.disabled = true; const old = el.textContent; el.textContent = t('{x} hazırlanıyor…', { x: label }); try { await fn(); } catch (e) { toast(t('{x} hatası: ', { x: label }) + (e && e.message || e)); } finally { el.disabled = false; el.textContent = old; } }; };
    run(a, 'PDF', () => window.IrriReport.pdf(cur, r, layoutSvg(r)));
    run(b, 'Excel', () => window.IrriReport.xlsx(cur, r));
  }

  // Yerleşim planı (SVG, çerçeve koordinatları; y yukarı)
  function layoutSvg(r) {
    const Ly = r.layout, P = Ly.P, src = Ly.src;
    const RT = Ly.route || [src];
    const xs = P.map(p => p[0]).concat(RT.map(p => p[0])), ys = P.map(p => p[1]).concat(RT.map(p => p[1]));
    const ex0 = Math.min(...xs), ex1 = Math.max(...xs), ey0 = Math.min(...ys), ey1 = Math.max(...ys);
    const VW = 680, pad = 36, sc = Math.min((VW - 2 * pad) / Math.max(ex1 - ex0, 1), 440 / Math.max(ey1 - ey0, 1));
    const VH = (ey1 - ey0) * sc + 2 * pad + 30;
    const X = x => (pad + (x - ex0) * sc).toFixed(1), Y = y => (pad + (ey1 - y) * sc).toFixed(1);
    const path = pts => 'M' + pts.map(p => X(p[0]) + ',' + Y(p[1])).join('L') + 'Z';
    const secOf = sectorIndex(r);
    let s = `<svg viewBox="0 0 ${VW} ${VH.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" font-family="DejaVu Sans, sans-serif"><rect width="${VW}" height="${VH.toFixed(0)}" fill="#f7faf8"/>`;
    s += `<path d="${path(P)}" fill="#eef3ef"/>`;
    r.units.forEach((u, k) => { const b = Ly.bands[u.band], c = Gm.clipRect(P, b.x0, b.x1, u.y0, u.y1); if (c.length >= 3) s += `<path d="${path(c)}" fill="${PALETTE[secOf[k] % PALETTE.length]}" stroke="#fff" stroke-width="1"/>`; });
    const step = Math.max(1, Math.ceil(Ly.laterals.length / 500));
    for (let i = 0; i < Ly.laterals.length; i += step) { const l = Ly.laterals[i]; s += `<line x1="${X(l.ax)}" y1="${Y(l.y)}" x2="${X(l.ax + l.side * l.len)}" y2="${Y(l.y)}" stroke="#2e7d4f" stroke-width=".5" opacity=".75"/>`; }
    r.units.forEach(u => { s += `<line x1="${X(u.ax)}" y1="${Y(u.yIn)}" x2="${X(u.ax)}" y2="${Y(u.yEnd)}" stroke="#1565c0" stroke-width="2.2"/>`; });
    mainLines(r).forEach(seg => { s += `<polyline points="${seg.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}" fill="none" stroke="#c62828" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`; });
    r.units.forEach((u, k) => { const cx = +X(u.ax), cy = (+Y(u.yIn) + +Y(u.yEnd)) / 2; if (Math.abs(u.yEnd - u.yIn) * sc > 16) s += `<text x="${cx + 4}" y="${cy + 4}" font-size="10" fill="#15231c">S${secOf[k] + 1}</text>`; });
    s += `<path d="${path(P)}" fill="none" stroke="#15231c" stroke-width="1.3"/>`;
    const s0 = RT[0];
    s += `<circle cx="${X(s0[0])}" cy="${Y(s0[1])}" r="6" fill="#00bcd4" stroke="#fff"/><text x="${+X(s0[0]) + 8}" y="${+Y(s0[1]) - 6}" font-size="10" fill="#007c8c">${t('Kaynak')}</text>`;
    // ölçek çubuğu
    const target = (ex1 - ex0) / 5, nice = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000].find(v => v >= target) || 5000, bx = pad, by = VH - 14;
    s += `<g font-size="10" fill="#15231c"><line x1="${bx}" y1="${by}" x2="${bx + nice * sc}" y2="${by}" stroke="#15231c" stroke-width="2"/><line x1="${bx}" y1="${by - 4}" x2="${bx}" y2="${by + 2}" stroke="#15231c"/><line x1="${bx + nice * sc}" y1="${by - 4}" x2="${bx + nice * sc}" y2="${by + 2}" stroke="#15231c"/><text x="${bx + nice * sc + 6}" y="${by + 4}">${nice} m</text></g>`;
    // kuzey oku (yalnız parsel modunda gerçek yön)
    if (Ly.mode === 'parsel') { const [nx, ny] = Gm.rot([0, 1], Ly.angle), cx = VW - 26, cy = 26; s += `<g><line x1="${cx - nx * 12}" y1="${cy + ny * 12}" x2="${cx + nx * 12}" y2="${cy - ny * 12}" stroke="#15231c" stroke-width="2" marker-end="url(#ar)"/><text x="${cx + nx * 20 - 4}" y="${cy - ny * 20 + 4}" font-size="11" font-weight="bold">${t('K')}</text></g><defs><marker id="ar" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0L6,3L0,6Z" fill="#15231c"/></marker></defs>`; }
    const lx = VW - 300, ly = VH - 10;
    s += `<g font-size="10" fill="#15231c"><line x1="${lx}" x2="${lx + 16}" y1="${ly - 3}" y2="${ly - 3}" stroke="#c62828" stroke-width="3"/><text x="${lx + 20}" y="${ly}">${t('Ana hat')} Ø${r.main.sel.od}</text>
      <line x1="${lx + 105}" x2="${lx + 121}" y1="${ly - 3}" y2="${ly - 3}" stroke="#1565c0" stroke-width="2"/><text x="${lx + 125}" y="${ly}">Manifold</text>
      <line x1="${lx + 185}" x2="${lx + 201}" y1="${ly - 3}" y2="${ly - 3}" stroke="#2e7d4f"/><text x="${lx + 205}" y="${ly}">Lateral Ø${r.lateral.d}</text></g>`;
    return s + '</svg>';
  }

  // ---------- Malzeme ----------
  function renderBom() {
    const r = lastRes && lastRes.ok ? lastRes : compute();
    if (!r.ok) { $('#bom').innerHTML = `<div class="note err">${t('Malzeme listesi için önce hesaplamanın tamamlanması gerekir. Sonuç ekranındaki eksikleri giderin.')}</div>`; return; }
    const priced = r.bom.filter(b => b.fiyat != null), unpriced = r.bom.filter(b => b.fiyat == null);
    const row = (x, withPrice) => `<tr><td>${esc(x.kalem)}${x.opsiyonel ? ` <span class="muted small">(${t('opsiyonel')})</span>` : ''}<br><span class="muted small">${esc(t(x.grup))}</span></td><td>${fmt(x.miktar, 0)} ${t(x.birim)}</td>
      <td><input class="price" data-key="${esc(x.key)}" type="text" inputmode="decimal" value="${x.fiyat != null && x.kaynak === 'kullanici' ? String(x.fiyat).replace('.', ',') : ''}" placeholder="${x.fiyat != null ? fmt(x.fiyat, 2) : t('fiyat')}">${withPrice && x.kaynak !== 'kullanici' ? `<span class="tag ${x.kaynak === 'ornek' ? 'warn' : ''}">${SRC()[x.kaynak]}</span>` : ''}</td><td>${x.tutar != null ? fmt(x.tutar, 0) : '—'}</td></tr>`;
    const c = r.cost, head = `<tr><th>${t('Kalem')}</th><th>${t('Miktar')}</th><th>${t('Birim')} ₺</th><th>${t('Tutar')}</th></tr>`;
    $('#bom').innerHTML = `
      <div class="card"><h3>${t('Maliyet')}</h3>
        ${c.total != null ? `<div class="big"><div style="grid-column:1/-1"><b>${tl(c.total)}</b><span>${t('Toplam malzeme bedeli')}${c.example ? ' · ' + t('{n} kalem örnek fiyatlı', { n: c.example }) : ''}</span></div></div>`
        : `<div class="note err"><b>${t('Toplam proje maliyeti hesaplanmadı:')}</b> ${t('{n} zorunlu kalemin fiyatı eksik. Fiyatları aşağıdaki listeye girin.', { n: c.missing })}</div>
           <div class="kv"><div>${t('Fiyatlı kalemler ara toplamı')}</div><div>${tl(c.subtotal)}</div></div><p class="muted small">${t('Ara toplam eksik kalemleri içermez; proje bedeli olarak kullanılamaz.')}</p>`}
        ${c.example ? `<p class="muted small"><span class="tag warn">${t('örnek')}</span> ${t('işaretli fiyatlar uygulamanın varsayılan örnek değerleridir; güncel tedarikçi fiyatı girin.')}</p>` : ''}
      </div>
      ${unpriced.length ? `<div class="card"><h3>${t('Fiyatı eksik kalemler')} (${unpriced.length})</h3><div class="scroll"><table>${head}${unpriced.map(x => row(x, false)).join('')}</table></div></div>` : ''}
      <div class="card"><h3>${t('Fiyatlı kalemler')} (${priced.length})</h3><div class="scroll"><table>${head}${priced.map(x => row(x, true)).join('')}</table></div>
      <p class="muted small">${t('Miktarlara %2–3 fire payı eklidir. Girdiğiniz birim fiyatlar tüm projelerde kullanılır.')}</p></div>
      <div class="row"><button class="btn primary" style="flex:1" id="bPdf2">${t('PDF rapor')}</button><button class="btn" style="flex:1" id="bXls2">Excel</button></div>`;
    $('#bom').querySelectorAll('input.price').forEach(inp => inp.onchange = () => {
      const k = inp.dataset.key, v = V.parseNum(inp.value);
      if (inp.value.trim() === '') delete settings.items[k];
      else if (Number.isNaN(v) || v < 0) { toast(t('Geçerli, negatif olmayan bir fiyat girin')); inp.value = ''; return; }
      else settings.items[k] = v;
      saveSettings(); lastRes = null; renderBom();
    });
    bindExport('#bPdf2', '#bXls2', r);
  }

  // ---------- Hidrolik Hesap Tablosu (Excel SİSTEM + IRRIFRICT) ----------
  const SYS_ROWS = [
    ['crop', 'Bitki', '', 'txt'], ['area', 'Alan', 'da', 'in'], ['et', 'ET', 'mm/gün', 'in'], ['T', 'T', 'h', 'in'], ['Sr', 'Sıra Arası', 'm', 'in'], ['Sp', 'Sıra Üzeri', 'm', 'in'],
    ['nl', 'Lateral Sayısı', 'adet', 'in'], ['q', 'q', 'l/h', 'in'], ['Sd', 'Sd', 'm', 'in'], ['n', 'n', 'adet/bitki', 2], ['rate', 'Sulama hızı', 'mm/h', 2], ['Qp', 'Q bitki', 'l/h', 2],
    ['Tp', 'T bitki', 'h/gün', 2], ['maxShift', 'Max Shift (h)', 'adet', 0], ['shifts', 'Shift #', 'adet', 'in'], ['totalTime', 'Toplam Sulama Süresi', 'h', 1], ['totalQ', 'Toplam Debi', 'm³/h', 1],
    ['shiftQ', 'Shift Debi', 'm³/h', 1], ['target', 'Parsel Hedef Debi', 'm³/h', 'in'], ['parcels', 'Parsel Sayısı', 'adet', 0], ['parcelA', 'Ort. Parsel Alanı', 'da', 2], ['parcelQ', 'Ort. Parsel Debi', 'm³/h', 2],
    ['valves', 'Aynı Anda Çal. Vana', 'adet', 0], ['shiftMax', 'Shift Debi MAX', 'm³/h', 2], ['shiftMin', 'Shift Debi MIN', 'm³/h', 2],
  ];
  function hydroState() {
    cur.hydro = cur.hydro || {};
    const h = cur.hydro;
    h.fields = Array.isArray(h.fields) ? h.fields : []; while (h.fields.length < 6) h.fields.push({});
    h.fric = h.fric && typeof h.fric === 'object' ? h.fric : {};
    h.tab = h.tab || 'sys';
    return h;
  }
  let hydroSave = null;
  const persistSoon = () => { clearTimeout(hydroSave); hydroSave = setTimeout(persist, 400); };
  // Profesyonel hidrolik paneli (MH-1): 8 sekme; son sekme mevcut Hidrolik Hesap Tablosu
  function renderHydro() {
    const h = hydroState(), el = $('#hydro');
    const r = lastRes && lastRes.ok ? lastRes : (cur.inp.Q ? compute() : null);
    const vm = r && r.ok ? HV.build(r, { inp: cur.inp, Qsource: V0(cur.inp.Q), assess: assessOf(r) }) : (r ? { ok: false, err: r.err } : { ok: false, err: [t('Su kaynağı debisi (m³/h) girilmedi — shift, boru çapı ve pompa hesaplanamaz.')] });
    h.ptab = h.ptab || 'ozet';
    el.innerHTML = boruKarti(r) + HP.make({ t, locale: I.locale }).render(vm, { tab: h.ptab, shift: h.pshift || 0 });
    el.classList.add('hp');
    baglaBoruKarti();
    const go = (tab, j) => { h.ptab = tab; if (j != null) h.pshift = j; persist(); renderHydro(); const v = $('#v-hidrolik'); if (v) v.scrollTop = 0; };
    el.querySelectorAll('[data-ptab]').forEach(b => b.onclick = () => go(b.dataset.ptab));
    el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
    el.querySelectorAll('[data-kod]').forEach(b => b.onclick = () => { pendingFocus = b.dataset.kod; show('sonuc'); });
    el.querySelectorAll('[data-shift]').forEach(b => b.onclick = () => go('shift', +b.dataset.shift));
    if (h.ptab === 'tablo') renderHydroTable(h, r);
  }
  // ---------- K-3: Ana hat borusu seçimi (malzeme, çap, SDR/PN) ----------
  // Yalnız doğrulanmış kütüphane satırları seçilebilir. PVC-U ve PN6 (SDR26) doğrulanmış katalog olmadığı için
  // gösterilir ama SEÇİLEMEZ (veri eksik). Seçim değişince hesap aynı design() çağrısıyla yenilenir.
  function boruKarti(r) {
    const P = window.IrriPipes, sec = cur.inp.boruSecimi && cur.inp.boruSecimi.ana;
    const kart = icerik => `<div class="card" id="boruKarti" style="margin-bottom:12px"><h3 style="margin:0 0 8px">${t('Ana hat borusu')}</h3>${icerik}</div>`;
    if (!P) return kart(`<p class="warn">${t('Boru kütüphanesi yüklenemedi; elle boru seçimi kullanılamıyor.')}</p>`
      + (sec ? `<p class="warn">${t('Projede elle seçilmiş boru var; kütüphane yüklenmeden hesap yapılamaz.')}</p>` : ''));
    const malz = sec ? sec.malzeme : (r && r.ok && r.main.sel.pipe.kutuphane ? r.main.sel.pipe.malzeme : 'PE100');
    const satir = P.liste({ malzeme: malz, hatTuru: 'ana' });
    const odlar = [...new Set(satir.map(x => x.od))].sort((a, b) => a - b);
    const od = sec && odlar.includes(sec.od) ? sec.od : (r && r.ok ? (odlar.find(o => o >= r.main.sel.od) || odlar[odlar.length - 1]) : odlar[0]);
    const sdrler = satir.filter(x => x.od === od);
    const eksik = [];
    if (!P.liste({ malzeme: 'PVC-U' }).length) eksik.push(t('PVC-U: doğrulanmış katalog verisi yok — seçilemez'));
    if (malz === 'PE100' && !satir.some(x => x.sdr === 26)) eksik.push(t('PE100 PN6 (SDR26): iki bağımsız kaynakla doğrulanmadı — seçilemez'));
    const ms = r && r.ok ? r.main.sel : null;
    const durum = ms && ms.secim === 'kullanici'
      ? `<p class="small">${t('Seçili')}: <b>${esc(ms.pipe.malzeme)} Ø${ms.od} SDR${ms.pipe.sdr} PN${ms.pn}</b> · ${t('et')} ${fmt(ms.pipe.et, 1)} mm · ${t('iç çap')} ${fmt(ms.ic, 1)} mm · ${t('hız')} ${fmt(ms.v, 2)} m/s</p>`
        + (!ms.hizUygun || !ms.pnYeterli ? `<p class="warn" id="boruUygunsuz">${!ms.hizUygun ? t('Akış hızı 2,0 m/s sınırını aşıyor.') + ' ' : ''}${!ms.pnYeterli ? t('Basınç sınıfı (PN) işletme basıncı için yetersiz.') + ' ' : ''}${t('Bu seçim uygunsuz; seçiminiz silinmedi, hesap bu boruyla yapıldı.')}</p>` : '')
      : ms ? `<p class="small">${t('Otomatik seçim')}: <b>${ms.pipe.kutuphane ? esc(ms.pipe.malzeme) : 'PVC-U'} Ø${ms.od} PN${ms.pn}</b> · ${t('iç çap')} ${fmt(ms.ic, 1)} mm</p>` : '';
    const opt = (v, txt, on, dis) => `<option value="${v}" ${on ? 'selected' : ''} ${dis ? 'disabled' : ''}>${txt}</option>`;
    return kart(`<div class="seg" style="margin-bottom:8px"><button data-boru="oto" class="${sec ? '' : 'on'}">${t('Otomatik (önerilen)')}</button><button data-boru="elle" class="${sec ? 'on' : ''}">${t('Elle seçim')}</button></div>
      <div class="f" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">
        <label>${t('Malzeme')}<select id="boruMalz">${['PE100', 'PE80', 'PVC-U'].map(m => opt(m, m + (P.liste({ malzeme: m }).length ? '' : ' — ' + t('veri eksik')), m === malz, !P.liste({ malzeme: m }).length)).join('')}</select></label>
        <label>${t('Dış çap')}<select id="boruOd">${odlar.map(o => opt(o, 'Ø' + o, o === od)).join('')}</select></label>
        <label>${t('SDR / PN')}<select id="boruSdr">${sdrler.map(x => opt(x.sdr, `SDR${String(x.sdr).replace('.', ',')} · PN${String(x.pn).replace('.', ',')} · ${t('iç çap')} ${fmt(P.icCap(x), 1)} mm`, sec ? x.sdr === sec.sdr : false)).join('')}</select></label>
      </div>
      <p class="small" style="margin:6px 0 0"><button class="btn sm primary" id="boruUygula">${t('Bu boruyu uygula')}</button></p>
      ${durum}
      ${eksik.map(x => `<p class="small muted">${x}</p>`).join('')}
      <p class="small muted">${t('Kaynak: iki bağımsız üretici kataloğu (EN 12201-2 atıflı); standart metniyle doğrudan doğrulanmadı. İç çap = dış çap − 2 × en küçük et.')}</p>`);
  }
  function baglaBoruKarti() {
    const k = $('#boruKarti'); if (!k || !window.IrriPipes) return;
    const yenile = () => { invalidateDesign(); persist(); renderHydro(); };
    const secim = () => ({ malzeme: $('#boruMalz').value, od: Number($('#boruOd').value), sdr: Number($('#boruSdr').value) });
    k.querySelector('[data-boru=oto]').onclick = () => { if (!cur.inp.boruSecimi) return; if (!confirm(t('Elle seçilen boru kaldırılıp otomatik seçime dönülsün mü?'))) return; delete cur.inp.boruSecimi; yenile(); };
    k.querySelector('[data-boru=elle]').onclick = () => { cur.inp.boruSecimi = { ana: secim() }; yenile(); };
    $('#boruUygula').onclick = () => { cur.inp.boruSecimi = { ana: secim() }; yenile(); toast(t('Boru seçimi uygulandı; hesap yenilendi')); };
    $('#boruMalz').onchange = () => { const P = window.IrriPipes, m = $('#boruMalz').value, ods = [...new Set(P.liste({ malzeme: m, hatTuru: 'ana' }).map(x => x.od))].sort((a, b) => a - b);
      $('#boruOd').innerHTML = ods.map(o => `<option value="${o}">Ø${o}</option>`).join(''); $('#boruOd').onchange(); };
    $('#boruOd').onchange = () => { const P = window.IrriPipes, rows = P.liste({ malzeme: $('#boruMalz').value, od: Number($('#boruOd').value), hatTuru: 'ana' });
      $('#boruSdr').innerHTML = rows.map(x => `<option value="${x.sdr}">SDR${String(x.sdr).replace('.', ',')} · PN${String(x.pn).replace('.', ',')} · ${t('iç çap')} ${fmt(P.icCap(x), 1)} mm</option>`).join(''); };
  }
  function renderHydroTable(h, r) {
    const el = $('#hpTable');
    el.innerHTML = `<div class="seg"><button data-tab="sys" class="${h.tab === 'sys' ? 'on' : ''}">${t('Sistem')} (SİSTEM)</button><button data-tab="fric" class="${h.tab === 'fric' ? 'on' : ''}">${t('Sürtünme')} (IRRIFRICT)</button></div>
      <div id="hBody"></div>
      <p class="muted small"><span class="cell-in legend"></span> ${t('Açık kahverengi: elle girilen değer')} · <span class="cell-out legend"></span> ${t('Beyaz: otomatik hesap')}. ${t('Formüller kullanıcının Excel dosyasından birebir alınmıştır.')}</p>
      <div class="row"><button class="btn primary" style="flex:1" id="hXls">${t('Excel (formüllü)')}</button></div>`;
    el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { h.tab = b.dataset.tab; persist(); renderHydro(); });
    (h.tab === 'sys' ? renderSys : renderFric)(h, r);
    $('#hXls').onclick = async () => { const b = $('#hXls'); b.disabled = true; try { await window.IrriReport.hydroXlsx(cur); } catch (e) { toast(t('{x} hatası: ', { x: 'Excel' }) + e.message); } finally { b.disabled = false; } };
  }
  function renderSys(h, r) {
    const res = h.fields.map(f => HT.systemField(f));
    const cell = (k, j, kind) => {
      const f = h.fields[j], o = res[j];
      if (kind === 'txt' || kind === 'in') { const bad = kind === 'in' && o.bad.includes(k); return `<td class="cell-in ${bad ? 'badcell' : ''}"><input data-f="${j}" data-k="${k}" type="text" ${kind === 'in' ? 'inputmode="decimal"' : ''} value="${esc(inVal(f[k]))}"></td>`; }
      const v = o[k], red = k === 'totalTime' && o.overTime;
      return `<td class="cell-out ${red ? 'redcell' : ''}" id="s-${k}-${j}">${v == null ? '' : fmt(v, kind)}</td>`;
    };
    $('#hBody').innerHTML = `<div class="card"><div class="row wrap" style="justify-content:space-between"><h3 style="margin:0">${t('Arazi')}</h3>
      <div class="row">${r ? `<button class="btn sm" id="sysFill">${t('Field 1’i projeden doldur')}</button>` : ''}<button class="btn sm" id="sysClear">${t('Temizle')}</button></div></div>
      <div class="scroll xl"><table class="xltab"><tr><th>${t('Bölge')}</th>${h.fields.map((f, j) => `<th>Field ${j + 1}</th>`).join('')}<th></th></tr>
      ${SYS_ROWS.map(([k, lab, unit, kind]) => `<tr><th class="rl">${t(lab)}</th>${h.fields.map((f, j) => cell(k, j, kind)).join('')}<td class="unit">${t(unit)}</td></tr>`).join('')}
      </table></div>
      ${res.some(o => o.overTime) ? `<div class="note warn">${t('Kırmızı: toplam sulama süresi günlük çalışma süresini (T) aşıyor.')}</div>` : ''}
      ${r ? `<p class="muted small">${t('“Projeden doldur”: ET = projenin tepe brüt ihtiyacı, T = günlük çalışma, Shift # = seçili shift sayısı, hedef debi = en büyük alt ünite debisi.')}</p>` : ''}</div>`;
    $('#hBody').querySelectorAll('input[data-k]').forEach(inp => inp.oninput = () => {
      const j = +inp.dataset.f, k = inp.dataset.k, f = h.fields[j];
      if (inp.value.trim() === '') delete f[k]; else f[k] = inp.value.trim();
      const o = HT.systemField(f);
      SYS_ROWS.forEach(([kk, , , kind]) => { if (typeof kind === 'number') { const c = $(`#s-${kk}-${j}`); if (c) { c.textContent = o[kk] == null ? '' : fmt(o[kk], kind); c.classList.toggle('redcell', kk === 'totalTime' && o.overTime); } } });
      inp.parentElement.classList.toggle('badcell', o.bad.includes(k));
      persistSoon();
    });
    const fill = $('#sysFill'); if (fill) fill.onclick = () => { h.fields[0] = HT.fieldFromProject(cur, r, t(D.CROPS[cur.inp.crop].ad)); persist(); renderHydro(); };
    $('#sysClear').onclick = () => { if (confirm(t('SİSTEM tablosu temizlensin mi?'))) { h.fields = [{}, {}, {}, {}, {}, {}]; persist(); renderHydro(); } };
  }
  function renderFric(h, r) {
    const names = new Set(Object.keys(h.fric));
    if (r) for (let j = 1; j <= r.sectors.Ns; j++) names.add('Shift ' + j);
    if (!names.size) names.add('Shift 1');
    const list = [...names].sort((a, b) => (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0));
    if (!h.sel || !list.includes(h.sel)) h.sel = list[0];
    const rows = h.fric[h.sel] = h.fric[h.sel] || [];
    const res = HT.friction(rows);
    const n = Math.min(15, Math.max(rows.length + 1, 2));
    const shiftIdx = parseInt(h.sel.replace(/\D/g, '')) - 1;
    const canFill = r && shiftIdx >= 0 && shiftIdx < r.sectors.Ns;
    const inp = (i, k, v, kind) => `<td class="cell-in"><input data-i="${i}" data-k="${k}" type="text" ${kind === 'num' ? 'inputmode="decimal"' : ''} value="${esc(inVal(v))}"></td>`;
    const sel = (i, k, v, opts) => `<td class="cell-in"><select data-i="${i}" data-k="${k}"><option value=""></option>${opts.map(o => `<option ${String(o) === String(v ?? '') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></td>`;
    const out = (v, d, cls = '') => `<td class="cell-out ${cls}">${v == null || v === '' ? '' : typeof v === 'number' ? fmt(v, d) : esc(v)}</td>`;
    $('#hBody').innerHTML = `<div class="card"><div class="chips">${list.map(x => `<button class="chip ${x === h.sel ? 'on' : ''}" data-s="${esc(x)}">${esc(x)}</button>`).join('')}<button class="chip" id="fAdd">＋</button></div>
      <div class="row wrap" style="margin:8px 0">${canFill ? `<button class="btn sm" id="fFill">${t('Bu shift’i projeden doldur')}</button>` : ''}<button class="btn sm" id="fCopy">${t('Kopyala')}</button><button class="btn sm danger" id="fDel">${t('Temizle')}</button></div>
      <div class="scroll xl"><table class="xltab fr"><tr><th>#</th><th>${t('Tip')}</th><th>${t('Malzeme')}</th><th>PN</th><th>${t('Uzunluk')}, m</th><th>${t('Debi')}, m³/h</th><th>${t('Başlangıç kotu')}, m</th><th>${t('Bitiş kotu')}, m</th><th>${t('Vana min. basınç')}, mSS</th><th>${t('Eğim')}, %</th><th>ID, mm</th><th>C</th><th>${t('Sürtünme')}, m/m</th><th>${t('Sürtünme toplam')}, m</th><th>${t('Kot farkı')}, m</th><th>${t('Toplam kayıp')}, mSS</th><th>${t('Çap/basınç kontrol')}</th><th>${t('Hız')}, m/s</th><th>${t('Hız kontrol')}</th></tr>
      ${res.rows.slice(0, n).map((o, i) => { const rw = rows[i] || {}; return `<tr><th>${i + 1}</th>${sel(i, 'type', rw.type, HT.TYPES)}${sel(i, 'material', rw.material, HT.MATERIALS)}${sel(i, 'pn', rw.pn, rw.material ? HT.pnsOf(rw.material) : [])}${inp(i, 'L', rw.L, 'num')}${inp(i, 'Q', rw.Q, 'num')}${inp(i, 'h1', rw.h1, 'num')}${i === 0 ? inp(i, 'h2', rw.h2, 'num') : out(o.I, 2, 'grey')}${i === 0 ? inp(i, 'pmin', rw.pmin, 'num') : out(o.J, 2, 'grey')}${out(o.K, 2)}${out(o.L, 1)}${out(o.M, 0)}${out(o.N, 4)}${out(o.O, 2)}${out(o.P, 2)}${out(o.Qc, 2)}${out(o.R ? t(o.R) : '', 0, o.R === 'DN, PN control' ? 'redcell' : '')}${out(o.S, 2)}${out(o.T ? t(o.T) : '', 0, o.T === 'V control' ? 'redcell' : '')}</tr>`; }).join('')}
      </table></div>
      <div class="kv" style="margin-top:10px"><div>${t('Toplam sürtünme kaybı')}</div><div>${fmt(res.totalLoss, 2)} m</div><div>${t('Toplam kot farkı')}</div><div>${fmt(res.totalDz, 2)} m</div><div>${t('Gerekli giriş basıncı')}</div><div><b>${res.required == null ? '—' : fmt(res.required, 2) + ' mSS (' + fmt(res.required / 10.2, 2) + ' bar)'}</b></div></div>
      ${res.warnings.length ? `<div class="note warn">${t('Kütüphanede bulunmayan malzeme/PN: satır {n}', { n: res.warnings.map(i => i + 1).join(', ') })}</div>` : ''}
      <p class="muted small">${t('Satırlar akış yönünün tersine sıralanır: 1. satır en uç (vana) segmentidir; her satırın gerekli basıncı bir öncekinin basıncı + kaybıdır. Submain satırında Christiansen F = 0,354 (200’den fazla çıkış) uygulanır.')}</p></div>`;
    const body = $('#hBody');
    body.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { h.sel = b.dataset.s; persist(); renderHydro(); });
    $('#fAdd').onclick = () => { let k = list.length + 1; while (names.has('Shift ' + k)) k++; h.sel = 'Shift ' + k; h.fric[h.sel] = []; persist(); renderHydro(); };
    body.querySelectorAll('[data-i]').forEach(c => c.onchange = () => {
      const i = +c.dataset.i, k = c.dataset.k; rows[i] = rows[i] || {};
      if (c.value === '') delete rows[i][k]; else rows[i][k] = c.value;
      if (k === 'material') { const p = HT.pnsOf(c.value); if (!p.map(String).includes(String(rows[i].pn))) rows[i].pn = p.includes(6) ? 6 : p[0]; }
      while (rows.length && !Object.keys(rows[rows.length - 1] || {}).length) rows.pop();
      persist(); renderHydro();
    });
    const fill = $('#fFill'); if (fill) fill.onclick = () => { h.fric[h.sel] = HT.segmentsFromShift(r, shiftIdx); persist(); renderHydro(); };
    $('#fCopy').onclick = () => { let k = list.length + 1; while (names.has('Shift ' + k)) k++; const nm = 'Shift ' + k; h.fric[nm] = JSON.parse(JSON.stringify(rows)); h.sel = nm; persist(); renderHydro(); };
    $('#fDel').onclick = () => { if (confirm(t('{s} tablosu temizlensin mi?', { s: h.sel }))) { delete h.fric[h.sel]; persist(); renderHydro(); } };
  }

  // ---------- Ayarlar ----------
  function langSelect(id) { return `<select id="${id}">${Object.entries(I.LANGS).map(([k, v]) => `<option value="${k}" ${k === I.lang ? 'selected' : ''}>${v.ad}</option>`).join('')}</select>`; }
  function bindLang(id) { const s = $('#' + id); if (s) s.onchange = () => { I.setLang(s.value); lastRes = null; $('#projName').textContent = cur ? cur.name : t('Proje seçilmedi'); const v = document.querySelector('nav.tabs button.on'); show(document.querySelector('.view.on').id.slice(2) || (v && v.dataset.v) || 'projeler'); }; }
  // ---------- Teknik Proje (CAD görünümü, pafta, PDF, DXF) ----------
  const techOpt = () => Object.assign({ format: 'A3', orient: 'yatay', scale: 'auto', color: true, multi: false, layers: {} }, cur.techOpt || {});
  let techView = null, techTile = { i: 0, j: 0 };
  function renderTech() {
    const el = $('#tech'), r = lastRes && lastRes.ok ? lastRes : compute();
    if (!r.ok) { el.innerHTML = `<div class="note err">${t('Kesin sonuç verilemiyor')}<ul>${r.err.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`; return; }
    const Dr = window.IrriDrawing, o = techOpt(), M = drawModel(r), meta = cur.meta = cur.meta || {};
    const cropName = t(D.CROPS[cur.inp.crop].ad);
    const S = Dr.sheet(M, Object.assign({}, o, { t, cropName, tile: o.multi ? techTile : null }));
    const LAY = [['parsel', 'Parsel'], ['shift', 'Shift'], ['lateral', 'Lateral'], ['manifold', 'Manifold'], ['main', 'Ana hat'], ['eq', 'Ekipman'], ['labels', 'Etiketler'], ['boxes', 'Shift kutuları'], ['panel', 'Tablolar']];
    const sel = (k, opts) => `<select data-o="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(o[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    let warn = '';
    if (!S.fits && !o.multi) warn = `<div class="note warn small">${t('Proje seçilen ölçekte paftaya sığmıyor (gereken {w} × {h} mm).', { w: fmt(S.need.w, 0), h: fmt(S.need.h, 0) })} ${S.auto ? t('Uygun ölçek: 1:{s}.', { s: S.auto }) : t('Hiçbir standart ölçekte sığmıyor: daha büyük pafta veya çoklu pafta seçin.')} ${t('Çoklu pafta ile {n} sayfa gerekir.', { n: S.tiles.n })}</div>`;
    if (!M.geo) warn += `<div class="note warn small">${t('Eşdeğer dikdörtgen tasarımı: çizimde gerçek koordinat yok. Harita üzerinde parsel çizip “Uygula” deyin.')}</div>`;
    el.innerHTML = `<div class="techwrap"><div class="techbar"><button class="btn sm" id="tzIn">+</button><button class="btn sm" id="tzOut">−</button><button class="btn sm" id="tzFit">⤢</button></div><div id="techSvg"></div></div>
      ${warn}<div class="card"><div class="f techf">
        <label>${t('Pafta')}${sel('format', [['A1', 'A1'], ['A2', 'A2'], ['A3', 'A3'], ['A4', 'A4']])}</label>
        <label>${t('Yön')}${sel('orient', [['yatay', t('Yatay')], ['dikey', t('Dikey')]])}</label>
        <label>${t('Ölçek')}${sel('scale', [['auto', t('Otomatik') + (S.auto ? ' (1:' + S.auto + ')' : '')], ...Dr.SCALES.map(x => [x, '1:' + x])])}</label>
        <label>${t('Renk')}${sel('color', [['true', t('Renkli')], ['false', t('Siyah-beyaz')]])}</label>
        <label>${t('Pafta düzeni')}${sel('multi', [['false', t('Tek pafta')], ['true', t('Çoklu pafta')]])}</label>
      </div>
      <div class="chips">${LAY.map(([k, l]) => `<label class="chip"><input type="checkbox" data-l="${k}" ${o.layers[k] === false ? '' : 'checked'}> ${t(l)}</label>`).join('')}</div>
      ${warn}
      ${o.multi && S.tiles.n > 1 ? `<div class="row wrap" style="gap:4px;margin-top:6px">${Array.from({ length: S.tiles.n }, (_, q) => { const i = q % S.tiles.nx, j = Math.floor(q / S.tiles.nx); return `<button class="btn sm ${techTile.i === i && techTile.j === j ? 'primary' : ''}" data-tile="${i},${j}" style="flex:none">${q + 1}/${S.tiles.n}</button>`; }).join('')}</div>` : ''}
      <div class="row" style="margin-top:8px"><button class="btn primary" style="flex:1" id="tPdf">${t('PDF pafta')}</button><button class="btn" style="flex:1" id="tDxf">DXF</button></div>
      <p class="muted small">${t('Çizim, haritadaki tasarımla aynı geometriden üretilir; ölçek 1:{s}, {f} {o}. Shift kutularını sürükleyerek taşıyabilirsiniz.', { s: S.scale, f: o.format, o: o.orient === 'dikey' ? t('dikey') : t('yatay') })}</p></div>
      <details class="card"><summary>${t('Antet bilgileri')}</summary><div class="f" style="margin-top:8px">
        ${[['musteri', 'Müşteri / işletme'], ['il', 'İl'], ['ilce', 'İlçe'], ['mevki', 'Mevki'], ['muhendis', 'Proje mühendisi'], ['tarih', 'Proje tarihi'], ['pafta', 'Pafta no']].map(([k, l]) => `<label>${t(l)}<input data-m="${k}" value="${esc(meta[k] || '')}"></label>`).join('')}
      </div><p class="muted small">${t('Proje adı, revizyon ({r}), ölçek ve alan otomatik yazılır.', { r: 'R' + (cur.rev || 1) })}</p></details>`;
    const box = $('#techSvg');
    box.innerHTML = Dr.toSVG(S).replace(/width="[\d.]+mm" height="[\d.]+mm"/, '');
    const svg = box.querySelector('svg');
    const fitContent = () => { const c = S.content, b = box.getBoundingClientRect(), ar = (b.height || 1) / (b.width || 1); let w = Math.max(c.x1 - c.x0, (c.y1 - c.y0) / ar), h = w * ar; return { x: (c.x0 + c.x1) / 2 - w / 2, y: (c.y0 + c.y1) / 2 - h / 2, w, h, W: S.W, H: S.H }; };
    if (!techView || techView.W !== S.W || techView.H !== S.H) techView = fitContent();
    const apply = () => svg.setAttribute('viewBox', `${techView.x} ${techView.y} ${techView.w} ${techView.h}`); apply();
    const zoom = (k, cx, cy) => { cx = cx ?? techView.x + techView.w / 2; cy = cy ?? techView.y + techView.h / 2; const w = Math.min(S.W * 1.5, Math.max(S.W / 60, techView.w * k)), h = w * techView.h / techView.w; techView.x = cx - (cx - techView.x) * w / techView.w; techView.y = cy - (cy - techView.y) * h / techView.h; techView.w = w; techView.h = h; apply(); };
    $('#tzIn').onclick = () => zoom(0.7); $('#tzOut').onclick = () => zoom(1 / 0.7); $('#tzFit').onclick = () => { const full = techView.w >= S.W * 0.98; techView = full ? fitContent() : { x: 0, y: 0, w: S.W, h: S.H, W: S.W, H: S.H }; apply(); };
    const toSvgPt = (ev) => { const b = svg.getBoundingClientRect(); const sx = techView.w / b.width, sy = techView.h / b.height, k = Math.max(sx, sy); const ox = (b.width * k - techView.w) / 2, oy = (b.height * k - techView.h) / 2; return [techView.x + (ev.clientX - b.left) * k - ox, techView.y + (ev.clientY - b.top) * k - oy]; };
    svg.addEventListener('wheel', ev => { ev.preventDefault(); const [x, y] = toSvgPt(ev); zoom(ev.deltaY > 0 ? 1.15 : 1 / 1.15, x, y); }, { passive: false });
    const pts = new Map(); let drag = null, pinch0 = null, ghost = null;
    svg.addEventListener('pointerdown', ev => {
      svg.setPointerCapture(ev.pointerId); pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
      const key = ev.target.getAttribute && ev.target.getAttribute('data-key');
      if (key && pts.size === 1) { const p0 = toSvgPt(ev), cx = +ev.target.getAttribute('data-cx') || p0[0], cy = +ev.target.getAttribute('data-cy') || p0[1], bw = +ev.target.getAttribute('data-bw') || 20, bh = +ev.target.getAttribute('data-bh') || 10; drag = { key, p0, c0: [cx, cy] }; ghost = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); Object.entries({ x: cx - bw / 2, y: cy - bh / 2, width: bw, height: bh, fill: 'none', stroke: '#c62828', 'stroke-width': 0.4, 'stroke-dasharray': '1.5 1' }).forEach(([a, v]) => ghost.setAttribute(a, v)); svg.appendChild(ghost); drag.bw = bw; drag.bh = bh; }
      else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), w: techView.w }; drag = null; }
      else drag = { pan: true, last: [ev.clientX, ev.clientY] };
    });
    svg.addEventListener('pointermove', ev => {
      if (!pts.has(ev.pointerId)) return; pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (pinch0 && pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom((pinch0.w * pinch0.d / d) / techView.w); return; }
      if (!drag) return;
      if (drag.pan) { const b = svg.getBoundingClientRect(), k = Math.max(techView.w / b.width, techView.h / b.height); techView.x -= (ev.clientX - drag.last[0]) * k; techView.y -= (ev.clientY - drag.last[1]) * k; drag.last = [ev.clientX, ev.clientY]; apply(); }
      else if (ghost) { const p = toSvgPt(ev); ghost.setAttribute('x', drag.c0[0] + p[0] - drag.p0[0] - drag.bw / 2); ghost.setAttribute('y', drag.c0[1] + p[1] - drag.p0[1] - drag.bh / 2); drag.p1 = p; }
    });
    const end = ev => {
      pts.delete(ev.pointerId); if (pts.size < 2) pinch0 = null;
      if (drag && drag.key && drag.p1) {
        const c = [drag.c0[0] + drag.p1[0] - drag.p0[0], drag.c0[1] + drag.p1[1] - drag.p0[1]];
        const mx = S.view.x0 + (c[0] - S.ox) / S.view.k, my = S.view.y1 - (c[1] - S.oy) / S.view.k;
        (cur.drawPos = cur.drawPos || {})[drag.key] = M.geo ? M.toLL([mx, my]) : { xy: [mx, my] };
        drawModelCache = null; persist(); drag = null; renderTech(); return;
      }
      if (ghost) { ghost.remove(); ghost = null; } drag = null;
    };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
    el.querySelectorAll('select[data-o]').forEach(x => x.onchange = () => { const k = x.dataset.o; let v = x.value; if (k === 'color' || k === 'multi') v = v === 'true'; cur.techOpt = Object.assign(techOpt(), { [k]: v }); techTile = { i: 0, j: 0 }; persist(); renderTech(); });
    el.querySelectorAll('input[data-l]').forEach(x => x.onchange = () => { const oo = techOpt(); oo.layers = Object.assign({}, oo.layers, { [x.dataset.l]: x.checked }); cur.techOpt = oo; persist(); renderTech(); });
    el.querySelectorAll('[data-tile]').forEach(x => x.onclick = () => { const [i, j] = x.dataset.tile.split(',').map(Number); techTile = { i, j }; renderTech(); });
    el.querySelectorAll('input[data-m]').forEach(x => x.onchange = () => { meta[x.dataset.m] = x.value.trim(); persist(); renderTech(); });
    const run = (id, fn) => { const b = $(id); b.onclick = async () => { if (b.disabled) return; b.disabled = true; const old = b.textContent; b.textContent = t('Hazırlanıyor…'); try { await fn(); } catch (e) { toast(t('Hata: ') + (e && e.message || e)); } finally { b.disabled = false; b.textContent = old; } }; };
    run('#tPdf', () => window.IrriReport.sheetPdf(cur, M, Object.assign({}, o, { cropName })));
    run('#tDxf', () => { if (!M.geo) toast(t('DXF yerel koordinatlarla (m) üretildi; gerçek koordinat için parsel modunu kullanın.')); return window.IrriReport.dxf(cur, M); });
  }

  // K-5: veri kaynakları, atıflar ve kot verisinin sınırları (Ayarlar)
  function kaynakKarti() {
    const K = window.IrriKaynak; if (!K) return '';
    const li = a => `<li>${esc(a)}</li>`;
    return `<details class="card" id="kaynakKarti"><summary><b>${t('Veri kaynakları ve sınırlamalar')}</b></summary>
      <p class="small"><b>${t(K.KAYNAK.uydu.ad)}:</b> ${esc(K.KAYNAK.uydu.saglayici)}<br><span class="muted">${esc(K.KAYNAK.uydu.atif)}</span></p>
      <p class="small"><b>${t(K.KAYNAK.kot.ad)}:</b> ${esc(K.KAYNAK.kot.saglayici)} — ${esc(K.KAYNAK.kot.model)} (≈ ${K.KAYNAK.kot.cozunurluk_m} m)<br><span class="muted">${esc(K.KAYNAK.kot.atif)}</span></p>
      <p class="small"><b>${t('Kot verisinin sınırları')}</b></p><ul class="small">${K.KOT_SINIRLARI.map(s => li(t(s))).join('')}${li(t(K.KML_NOTU))}</ul>
      <p class="small muted">${esc(t(K.GIZLILIK))}</p></details>`;
  }
  function renderSettings() {
    const s = settings, inp = (k, v, lab) => `<label>${lab}<input data-k="${k}" type="text" inputmode="decimal" value="${String(v ?? '').replace('.', ',')}">${s.edited[k] ? '' : `<span class="muted small">${t('örnek değer')}</span>`}</label>`;
    const cnt = (a, f) => t('{n} kayıt ({m} doğrulanmış)', { n: a.length, m: a.filter(f || (x => x.dogrulandi)).length });
    $('#settings').innerHTML = `<div class="card"><h3>${t('Dil')} / Language</h3>${langSelect('langSet')}
      <label style="margin-top:10px">${t('Görünüm')}<select id="themeSet">${[['acik', 'Açık'], ['koyu', 'Koyu'], ['sistem', 'Sistem ayarı']].map(([k, l]) => `<option value="${k}" ${themeOf() === k ? 'selected' : ''}>${t(l)}</option>`).join('')}</select></label>
      ${['he', 'zh'].includes(I.lang) ? `<p class="muted small">${t('PDF raporu bu dilde İngilizce üretilir (yazı tipi ve yazım yönü kısıtı); Excel raporu seçili dildedir.')}</p>` : ''}</div>
      <div class="card"><h3>${t('Birim fiyatlar')} (₺)</h3><p class="muted small">${t('Varsayılanlar yalnızca örnektir. Diğer kalemlerin fiyatları Malzeme ekranından girilir.')}</p>
      <div class="f">${inp('lateral16', s.lateral16, t('Damla borusu') + ' Ø16 (₺/m)')}${inp('lateral20', s.lateral20, t('Damla borusu') + ' Ø20 (₺/m)')}${inp('damlatici', s.damlatici, t('Damlatıcı') + ' (₺/' + t('adet') + ')')}${inp('startKonnektor', s.startKonnektor, t('Start konnektör') + ' (₺)')}${inp('laterlSonu', s.laterlSonu, t('Lateral sonu') + ' (₺)')}${inp('elektrik', s.elektrik, t('Elektrik') + ' (₺/kWh)')}${inp('faiz', s.faiz, t('Faiz oranı (0,10 = %10)'))}${inp('omur', s.omur, t('Ekonomik ömür (yıl)'))}</div>
      <h3 style="margin-top:14px">${t('PE manifold')} PN6 (₺/m)</h3><div class="f">${Object.entries(s.pe).map(([d, v]) => inp('pe.' + d, v, 'Ø' + d)).join('')}</div>
      <h3 style="margin-top:14px">${t('PVC ana hat')} PN6 (₺/m)</h3><div class="f">${Object.entries(s.pvc).map(([d, v]) => inp('pvc.' + d, v, 'Ø' + d)).join('')}</div>
      <p class="muted small">${t('PN10 fiyatı girilmezse PN6 fiyatının PE için 1,45, PVC için 1,5 katı (örnek) alınır.')}</p></div>
      <button class="btn block" id="bReset">${t('Varsayılan fiyatlara dön')}</button>
      <div class="card"><h3>${t('Ekipman kataloğu')}</h3><div class="kv">
        <div>${t('Pompa')}</div><div>${cnt(catalog.pompa)}</div><div>${t('Filtre')}</div><div>${cnt(catalog.filtre)}</div><div>${t('Vana')}</div><div>${cnt(catalog.vana)}</div>
        <div>PE / PVC / lateral</div><div>${catalog.borular.pe.length} / ${catalog.borular.pvc.length} / ${catalog.borular.lateral.length}</div>
        <div>${t('Kullanıcı kataloğu')}</div><div>${userCat ? esc(userCat.meta && userCat.meta.ad || t('yüklü')) : t('yok')}</div></div>
        <p class="muted small">${t('Varsayılan pompa/filtre/vana kayıtları jeneriktir (gerçek ürün değil). Üretici verilerini aynı JSON yapısında yükleyin; "dogrulandi": true kayıtlar raporda doğrulanmış görünür. "yalnizKullanici": {"pompa": true} jenerik pompaları devre dışı bırakır.')}</p>
        <div class="row wrap"><label class="btn sm" style="flex-direction:row">${t('Katalog yükle (JSON)')}<input type="file" id="catFile" accept=".json,application/json" style="display:none"></label>
        <button class="btn sm" id="catTpl">${t('Şablon indir')}</button>${userCat ? `<button class="btn sm danger" id="catDel">${t('Kullanıcı kataloğunu kaldır')}</button>` : ''}</div></div>
      ${kaynakKarti()}
      <div class="card small muted"><b>IrriGrow v${esc(window.IRRI_SURUM || "")}</b><br>${t('Hesaplar: FAO-56, Keller & Bliesner, Watters-Keller, Hazen-Williams. Sonuçlar ön projelendirme içindir; uygulama projesi bir sulama mühendisince kontrol edilmelidir.')}</div>`;
    bindLang('langSet');
    $('#themeSet').onchange = ev => { setTheme(ev.target.value); };
    $('#settings').querySelectorAll('input[data-k]').forEach(el => el.onchange = () => {
      const [a, b] = el.dataset.k.split('.'); const v = V.parseNum(el.value);
      if (v === null || Number.isNaN(v) || v < 0) { toast(t('Geçerli, negatif olmayan bir sayı girin')); renderSettings(); return; }
      if (a === 'omur' && v < 1) { toast(t('Ömür en az 1 yıl olmalı')); renderSettings(); return; }
      if (b) settings[a][b] = v; else settings[a] = v; settings.edited[el.dataset.k] = true; saveSettings(); renderSettings();
    });
    $('#bReset').onclick = () => { if (confirm(t('Fiyatlar (kalem fiyatları dahil) sıfırlansın mı?'))) { settings = Object.assign(JSON.parse(JSON.stringify(D.DEFAULT_PRICES)), { items: {}, edited: {} }); saveSettings(); renderSettings(); } };
    $('#catFile').onchange = async ev => {
      const f = ev.target.files[0]; if (!f) return;
      try {
        const j = JSON.parse(await f.text()); const e = Ct.checkCatalog(j);
        if (e.length) { alert(t('Katalog yüklenemedi:') + '\n' + e.slice(0, 12).join('\n') + (e.length > 12 ? `\n… +${e.length - 12}` : '')); return; }
        userCat = j; if (!save(CKEY, userCat)) return; catalog = Ct.mergeCatalog(window.IRRI_CATALOG, userCat); lastRes = null; toast(t('Katalog yüklendi')); renderSettings();
      } catch (err) { alert(t('JSON okunamadı: ') + err.message); }
    };
    $('#catTpl').onclick = () => window.IrriReport.json('irrigrow-katalog-sablon', {
      meta: { ad: 'Firma kataloğu', tarih: new Date().toISOString().slice(0, 10) }, yalnizKullanici: { pompa: false },
      pompa: [{ id: 'firma-model-1', marka: 'Marka', model: 'Model', tip: 'dalgic', motorKw: 15, fiyat: null, dogrulandi: true, kaynak: 'Katalog sayfa no', egri: [[0, 95, 0], [20, 88, 62], [35, 76, 72], [45, 64, 70], [55, 48, 60]] }],
      filtre: [{ id: 'firma-disk-3', tip: 'disk', ad: 'Disk filtre 3"', mesh: 120, qMax: 50, hTemiz: 2.5, kirlenme: 3, fiyat: null, dogrulandi: true }],
      vana: [{ id: 'firma-vana-3', tip: 'sektor', ad: 'Hidrolik vana 3"', cap: '3"', qMax: 50, kv: 110, fiyat: null, dogrulandi: true }],
      borular: { pe: [{ id: 'firma-pe-90-6', od: 90, pn: 6, ic: 83, fiyat: null }], pvc: [{ id: 'firma-pvc-110-6', od: 110, pn: 6, ic: 103.6, fiyat: null }], lateral: [{ id: 'lat16', od: 16, ic: 13.8, maxH: 25 }] },
    }).catch(e => toast(e.message));
    const del = $('#catDel'); if (del) del.onclick = () => { if (confirm(t('Kullanıcı kataloğu kaldırılsın mı?'))) { userCat = null; try { localStorage.removeItem(CKEY); } catch (e) { } catalog = window.IRRI_CATALOG; lastRes = null; renderSettings(); } };
  }

  // Görünüm (tema): cihaz tercihi; varsayılan açık tema (mevcut görünüm)
  const TKEY = 'irrigrow.theme';
  function themeOf() { try { return localStorage.getItem(TKEY) || 'acik'; } catch (e) { return 'acik'; } }
  function applyTheme(v) {
    const dark = v === 'koyu' || (v === 'sistem' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', dark ? '#121a16' : '#ffffff');
  }
  function setTheme(v) { try { localStorage.setItem(TKEY, v); } catch (e) { } applyTheme(v); }
  applyTheme(themeOf());
  if (window.matchMedia) { const mq = window.matchMedia('(prefers-color-scheme: dark)'); const f = () => { if (themeOf() === 'sistem') applyTheme('sistem'); }; if (mq.addEventListener) mq.addEventListener('change', f); }

  window.IrriApp = { toast };
  window.addEventListener('error', e => toast(t('Hata: ') + (e.message || '?')));
  window.addEventListener('unhandledrejection', e => toast(t('Hata: ') + ((e.reason && e.reason.message) || '?')));
  I.apply();
  const hl = $('#heroLang'); if (hl) { hl.outerHTML = langSelect('heroLang'); bindLang('heroLang'); }
  $('#projName').textContent = t('Proje seçilmedi');
  show('projeler');
  setTimeout(() => { const s = $('#splash'); if (s) { s.classList.add('off'); setTimeout(() => s.remove(), 400); } }, 900);
})();

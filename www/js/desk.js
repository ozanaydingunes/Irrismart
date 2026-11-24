// IrriGrow — MH-WEB-2: profesyonel masaüstü düzeni
//
// Yalnız WEB sürümünde ve geniş ekranda (≥ 1200 px) etkinleşir; Android (Capacitor) ve telefon genişliğinde
// hiçbir şey değişmez. Uygulamanın bütün modülleri (Projeler, Arazi, Veriler, Sonuç, Hidrolik, Malzeme, Proje,
// Ayarlar) aynı kodla çalışır; bu modül yalnız yerleşimi ekler:
//   • üst araç çubuğu: yeni proje, projeler, yedekle, yedekten yükle, raporlar, tema, ayarlar, kayıt durumu
//   • sol modül çubuğu: mevcut sekme çubuğu dikey; adlı ya da yalnız simgeli
//   • sağ mühendislik paneli: haritada (ya da alt paneldeki tablodan) seçilen shift, manifold, lateral, ana hat
//     kesiti veya su kaynağının GERÇEK hesap değerleri (motor sonucu ve MH-1 görünüm modeli; hesap yapılmaz)
//   • alt panel: shift'ler, ana hat kesitleri, malzeme, mühendislik uyarıları; açılır/kapanır, yüksekliği ayarlanır
// Bu sürümde OLMAYAN işlevler (sağ tık menüsü, koordinatla nokta ekleme, geri al/yinele geçmişi, klavye
// kısayolları, lateral/manifold düzenleme) gösterilmez; WEB-3 kapsamındadır.
(function (g) {
  const MAP_MIN = 320;   // 1.0.7 düzeltme: Arazi'de haritanın en küçük yüksekliği (px); alt panel bunun altına indiremez
  const MIN_W = 1200, KEY = 'irrigrow.desk', BKEY = 'irrigrow.lastBackup';
  let api = null, on = false, built = false;
  const st = { left: true, right: true, drawer: false, tab: 'shift', drawerH: 260, sel: null, rightBos: false };
  const doc = () => g.document;
  const $ = s => doc().querySelector(s);
  const load = () => { try { Object.assign(st, JSON.parse(g.localStorage.getItem(KEY) || '{}'), { sel: null, rightBos: false }); } catch (e) { /* varsayılanlar */ } };
  const save = () => { try { const { left, right, drawer, tab, drawerH } = st; g.localStorage.setItem(KEY, JSON.stringify({ left, right, drawer, tab, drawerH })); } catch (e) { /* depolama yok */ } };
  const eligible = () => !!api && !api.isNative() && g.innerWidth >= MIN_W;

  function init(a) {
    api = a; load();
    g.addEventListener('resize', update);
    update();
  }
  function update() {
    const e = eligible();
    if (e && !built) build();
    if (e !== on) { on = e; doc().documentElement.classList.toggle('desk', on); kmlYeri(); applyVars(); if (on) refresh(); api.mapResize(); }
    else if (on && applyVars()) api.mapResize();
  }
  // KML/KMZ içe aktarma paneli: masaüstünde haritanın üzerinde yüzen kart (harita küçülmez); telefonda alt çubukta (değişmedi)
  function kmlYeri() {
    const P = $('#kmlPanel'), ar = $('#v-arazi'), mb = $('#v-arazi .mapbar'); if (!P || !ar || !mb) return;
    if (on && P.parentNode !== ar) ar.appendChild(P);
    else if (!on && P.parentNode !== mb) mb.insertBefore(P, $('#mShiftBar'));
  }
  // Hesap sonucu yokken boş mühendislik paneli haritadan yer almaz (ince şerit); kullanıcı açarsa açık kalır
  const bosPanel = () => { if (!api || !api.cur()) return true; const r = api.result(); return !r || !r.ok; };
  const sagAcik = () => st.right && (st.rightBos || !bosPanel());
  // Arazi ekranında alt panel, haritayı MAP_MIN'in altına indirecek kadar yükselemez (küçük dizüstü ekranları)
  function cekmeceH() {
    if (!st.drawer) return 40;
    const ar = doc().querySelector('#v-arazi.on'); if (!ar) return st.drawerH;
    const mb = ar.querySelector('.mapbar'), mbH = mb ? mb.offsetHeight : 150, top = 56;
    return Math.round(Math.max(120, Math.min(st.drawerH, g.innerHeight - top - mbH - MAP_MIN)));
  }
  function applyVars() {
    const r = doc().documentElement.style, once = [r.getPropertyValue('--right'), r.getPropertyValue('--drawer')].join();
    r.setProperty('--rail', on ? (st.left ? '216px' : '64px') : '0px');
    r.setProperty('--right', on && sagAcik() ? '380px' : (on ? '28px' : '0px'));
    r.setProperty('--drawer', on ? cekmeceH() + 'px' : '0px');
    doc().documentElement.classList.toggle('desk-rail-min', on && !st.left);
    return once !== [r.getPropertyValue('--right'), r.getPropertyValue('--drawer')].join();
  }

  // ---------- DOM (bir kez) ----------
  function build() {
    built = true;
    const t = api.t;
    const tools = doc().createElement('div'); tools.id = 'deskTools'; tools.className = 'desk-only';
    $('header.top').insertBefore(tools, $('#btnSettings'));
    const rail = doc().createElement('button'); rail.id = 'deskRail'; rail.className = 'desk-only'; rail.type = 'button';
    $('nav.tabs').insertBefore(rail, $('nav.tabs').firstChild);
    rail.onclick = () => { st.left = !st.left; save(); applyVars(); renderRail(); api.mapResize(); };
    const right = doc().createElement('aside'); right.id = 'deskRight'; right.className = 'desk-only'; right.setAttribute('aria-label', t('Mühendislik paneli'));
    const bottom = doc().createElement('section'); bottom.id = 'deskBottom'; bottom.className = 'desk-only'; bottom.setAttribute('aria-label', t('Alt panel'));
    doc().body.appendChild(right); doc().body.appendChild(bottom);
  }

  // ---------- Üst araç çubuğu ----------
  function renderTools() {
    const t = api.t, esc = api.esc, cur = api.cur(), lb = lastBackup();
    const ago = lb ? Math.floor((Date.now() - lb) / 86400000) : null;
    const bk = lb == null ? t('Yedek: hiç') : ago < 1 ? t('Yedek: bugün') : t('Yedek: {n} gün önce', { n: ago });
    const bkTip = lb == null ? t('Bu tarayıcıda henüz JSON yedek alınmadı. Tarayıcı verileri silinirse projeler kaybolur; Yedek ▾ menüsünden yedek alın.') : t('Son JSON yedek: {d}', { d: new Date(lb).toLocaleString(api.I ? api.I.locale : 'tr-TR') });
    const warnBk = lb == null || ago >= 7;
    $('#deskTools').innerHTML = `
      <button type="button" class="dt-btn" data-dt="new">＋ ${esc(t('Yeni proje'))}</button>
      <button type="button" class="dt-btn" data-dt="open">▤ ${esc(t('Projeler'))}</button>
      <span class="dt-status dt-sync" title="${esc(t('Projeler yalnız bu tarayıcıda saklanır. Otomatik bulut eşitlemesi yoktur; telefon ile bilgisayar arasında projeleri JSON yedekle taşıyın (Yedekle / Yedekten yükle).'))}">${esc(t('Yerel kayıt · eşitleme yok'))}</span>
      <span class="dt-status ${warnBk ? 'dt-warn' : ''}" title="${esc(bkTip)}">${esc(bk)}</span>
      <span class="dt-gap"></span>
      <button type="button" class="dt-btn" data-dt="shift" ${cur ? '' : 'disabled'}>⇄ ${esc(t('Shift Yönetimi'))}</button>
      <details class="dt-menu"><summary class="dt-btn">${esc(t('Yedek'))} ▾</summary><div class="dt-pop" role="menu">
        <button type="button" role="menuitem" data-dt="backup">⤓ ${esc(t('Yedekle'))} (JSON)</button>
        <button type="button" role="menuitem" data-dt="restore">⤒ ${esc(t('Yedekten yükle'))}</button>
      </div></details>
      <details class="dt-menu"><summary class="dt-btn dt-pri">${esc(t('Raporlar'))} ▾</summary><div class="dt-pop" role="menu">
        ${[['pdf', 'PDF proje raporu'], ['xlsx', 'Excel hesap raporu'], ['hxlsx', 'Hidrolik Excel'], ['dxf', 'DXF çizim'], ['sheet', 'Teknik pafta (PDF)']].map(([k, l]) => `<button type="button" role="menuitem" data-dt="${k}" ${cur ? '' : 'disabled'}>${esc(t(l))}</button>`).join('')}
      </div></details>
      <label class="dt-theme"><span class="sr">${esc(t('Görünüm'))}</span><select data-dt="theme" aria-label="${esc(t('Görünüm'))}">${[['acik', 'Açık'], ['koyu', 'Koyu'], ['sistem', 'Sistem ayarı']].map(([k, l]) => `<option value="${k}" ${api.themeOf() === k ? 'selected' : ''}>${esc(t(l))}</option>`).join('')}</select></label>`;
    const act = {
      new: () => api.newProject(), open: () => api.show('projeler'), shift: () => api.shiftYonetimi && api.shiftYonetimi(),
      backup: () => { api.backup(); }, restore: () => api.restore(),
      pdf: () => api.export('pdf'), xlsx: () => api.export('xlsx'), hxlsx: () => api.export('hxlsx'), dxf: () => api.export('dxf'), sheet: () => api.export('sheet'),
    };
    $('#deskTools').querySelectorAll('button[data-dt]').forEach(b => b.onclick = () => { const m = b.closest('details'); if (m) m.open = false; act[b.dataset.dt](); });
    $('#deskTools select[data-dt=theme]').onchange = e => api.setTheme(e.target.value);
  }
  const lastBackup = () => { try { const v = Number(g.localStorage.getItem(BKEY)); return v > 0 ? v : null; } catch (e) { return null; } };
  const noteBackup = () => { try { g.localStorage.setItem(BKEY, String(Date.now())); } catch (e) { /* yok */ } if (on) renderTools(); };

  function renderRail() {
    const t = api.t;
    $('#deskRail').textContent = st.left ? '« ' + t('Daralt') : '»';
    $('#deskRail').setAttribute('aria-label', st.left ? t('Sol paneli daralt') : t('Sol paneli genişlet'));
    $('#deskRail').setAttribute('aria-expanded', String(st.left));
  }

  // ---------- Seçim ve sağ panel ----------
  function select(sel) { st.sel = sel; if (on) { if (!st.right) { st.right = true; save(); applyVars(); api.mapResize(); } renderRight(); renderBottom(); } }
  function ctx() {
    const cur = api.cur(); if (!cur) return null;
    const r = api.result(); if (!r || !r.ok) return { cur, r: null };
    return { cur, r, vm: api.hv(r), A: api.assess(r) };
  }
  const N = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? `<span class="dk-n" data-v="${v}">${api.esc(api.fmt(v, d))}</span>` : '—';
  const kv = rows => `<dl class="dk-kv">${rows.map(([l, v, u]) => `<dt>${api.esc(api.t(l))}</dt><dd>${v}${u ? ' <small>' + api.esc(u) + '</small>' : ''}</dd>`).join('')}</dl>`;
  const kpi = (l, v, u) => `<div class="dk-kpi"><span>${api.esc(api.t(l))}</span><b>${v}</b>${u ? ` <small>${api.esc(u)}</small>` : ''}</div>`;
  function findingsFor(A, pred) {
    const t = api.t, esc = api.esc, AS = g.IrriAssess, fs = A.findings.filter(pred);
    if (!fs.length) return `<p class="dk-muted">${esc(t('Bu nesneyle ilgili mühendislik uyarısı yok.'))}</p>`;
    return fs.map(x => `<button type="button" class="dk-warn dk-w-${x.seviye}" data-kod="${esc(x.kod)}"><span class="dk-lv">${esc(t(AS.LEVEL_AD[x.seviye]))}</span> <code>${esc(x.kod)}</code> ${esc(AS.text(x.baslik, t, api.fmt))}</button>`).join('');
  }
  // Çok parselli projede panel aktif parselin değerlerini gösterir: başlıkta parsel adı
  const projAd = p => p.name + (g.IrriParsel && g.IrriParsel.coklu(p) ? ' · ' + g.IrriParsel.aktifAd(p) : '');
  function renderRight() {
    const el = $('#deskRight'); if (!el) return;
    const t = api.t, esc = api.esc;
    if (!sagAcik()) { el.innerHTML = `<button type="button" class="dk-reopen" data-dk="open" aria-label="${esc(t('Mühendislik panelini aç'))}" title="${esc(t('Mühendislik panelini aç'))}">‹</button>`; el.querySelector('[data-dk=open]').onclick = () => { st.right = true; if (bosPanel()) st.rightBos = true; save(); applyVars(); renderRight(); api.mapResize(); }; return; }
    const c = ctx();
    const head = (kind, title) => `<div class="dk-head"><div><span class="dk-kind">${esc(t(kind))}</span><strong>${title}</strong></div><button type="button" class="dk-x" data-dk="close" aria-label="${esc(t('Mühendislik panelini kapat'))}">✕</button></div>`;
    let body = '';
    if (!c) body = head('Mühendislik paneli', esc(t('Proje seçilmedi'))) + `<div class="dk-body"><p class="dk-muted">${esc(t('Bir proje açın veya yeni proje oluşturun.'))}</p></div>`;
    else if (!c.r) body = head('Mühendislik paneli', esc(projAd(c.cur))) + `<div class="dk-body"><p class="dk-muted">${esc(t('Hesap sonucu yok: Veriler ekranında kaynak debisini girip Hesapla deyin.'))}</p></div>`;
    else {
      const { r, vm, A } = c, s = st.sel;
      if (s && s.type === 'shift' && vm.shift.details[s.j]) {
        const d = vm.shift.details[s.j], p = d.pump;
        body = head('Shift', `Shift ${d.no} · ${esc(d.units.join(', '))}`) + `<div class="dk-body">
          <div class="dk-kpis">${kpi('Debi', N(d.Q, 2), 'm³/h')}${kpi('Gerekli basınç', N(d.H, 2), 'm · ' + api.fmt(d.Hbar, 2) + ' bar')}${kpi('Alan', N(d.A, 2), 'da')}${kpi('Sulama süresi', N(d.dur, 2), 'h')}</div>
          ${kv([['Sulama hacmi (bir sulama)', N(d.vol, 1), 'm³'], ['Sezonluk çalışma', N(d.seasonH, 0), 'h'], ['Sezonluk enerji', N(d.kWh, 0), 'kWh'],
            ['Pompa görev noktası', p ? `${N(p.Q, 2)} m³/h @ ${N(p.H != null ? p.H : p.Hreq, 2)} m` : esc(t('Pompa gerekmez')), ''], p && p.eta != null ? ['Pompa verimi', N(p.eta, 1), '%'] : null,
            ['Açılan manifoldlar', esc(d.units.join(', ')), ''], ['Lateral sayısı', N(d.nLat, 0), ''], ['Kritik ünite', esc(d.critUnit ? d.critUnit.id : '—'), '']].filter(Boolean))}
          <h4>${esc(t('Gerekli basınç dökümü'))}</h4>${kv(d.breakdown.map(b => [b.label, N(b.v, b.d), b.unit]))}
          <h4>${esc(t('Mühendislik uyarıları'))}</h4>${findingsFor(A, x => (x.ekran && x.ekran.sekme === 'shift') || x.seviye === 'uygunsuz')}
          <div class="dk-links"><button type="button" data-shiftyon="${d.j}">${esc(t('Shift Yönetimi'))} ›</button><button type="button" data-go="shift:${d.j}">${esc(t('Shift Analizi’nde aç'))} ›</button><button type="button" data-go="sonuc">${esc(t('Bütün uyarılar'))} ›</button></div></div>`;
      } else if (s && s.type === 'manifold' && r.units[s.k]) {
        const u = r.units[s.k], j = shiftOf(r, s.k);
        body = head('Manifold (alt ünite)', `M${s.k + 1} · PE Ø${u.pipe.od} PN${u.pipe.pn}`) + `<div class="dk-body">
          <div class="dk-kpis">${kpi('Debi', N(u.Q, 2), 'm³/h')}${kpi('Hız', N(u.v, 2), 'm/s')}${kpi('Uzunluk', N(u.Lm, 1), 'm')}${kpi('Giriş basıncı', N(u.hIn, 2), 'm')}</div>
          ${kv([['Shift', 'Shift ' + (j + 1), ''], ['Lateral sayısı', N(u.nLat, 0), ''], ['İç çap', N(u.pipe.ic, 1), 'mm'], ['Sürtünme kaybı', N(u.hf, 2), 'm'], ['Basınç değişimi', N(u.varH, 2), 'm'], ['İzin verilen değişim', N(r.emitter.allowMan, 2), 'm']])}
          <h4>${esc(t('Mühendislik uyarıları'))}</h4>${findingsFor(A, x => x.ekran && x.ekran.sekme === 'manifold')}
          <div class="dk-links"><button type="button" data-go="manifold">${esc(t('Manifold bölümünde aç'))} ›</button><button type="button" data-sel="shift:${j}">${esc(t('Shift’ini seç'))} ›</button></div></div>`;
      } else if (s && s.type === 'lateral' && s.l) {
        const l = s.l;
        body = head('Lateral', `Ø${r.lateral.d} · ${esc(t('alt ünite'))} M${(s.k ?? 0) + 1}`) + `<div class="dk-body">
          <div class="dk-kpis">${kpi('Uzunluk', N(l.len, 1), 'm')}${kpi('Damlatıcı', N(l.N, 0), '')}${kpi('Debi', N(l.Q, 0), 'l/h')}${kpi('Basınç farkı', N(l.dH, 2), 'm')}</div>
          ${kv([['İç çap', N(r.lateral.ic, 1), 'mm'], ['İzin verilen basınç farkı', N(r.emitter.allowLat, 2), 'm'], ['En uzun lateral (sistem)', N(r.lateral.maxLen, 1), 'm']])}
          <h4>${esc(t('Mühendislik uyarıları'))}</h4>${findingsFor(A, x => x.ekran && x.ekran.sekme === 'lateral')}
          <div class="dk-links"><button type="button" data-go="lateral">${esc(t('Lateral bölümünde aç'))} ›</button></div></div>`;
      } else if (s && s.type === 'anahat' && r.main.net[s.i]) {
        const sg = r.main.net[s.i];
        body = head('Ana boru şebekesi', `${esc(sg.id)} · ${sg.pipe && sg.pipe.kutuphane ? `${esc(sg.pipe.malzeme)} Ø${sg.od} SDR${sg.pipe.sdr}` : `PVC-U Ø${sg.od}`} PN${sg.pn}`) + `<div class="dk-body">
          <div class="dk-kpis">${kpi('Uzunluk', N(sg.L, 1), 'm')}${kpi('Debi (en büyük shift)', N(sg.Qmax, 1), 'm³/h')}${kpi('Hız', N(sg.v, 2), 'm/s')}${kpi('Sürtünme kaybı', N(sg.hf, 2), 'm')}</div>
          ${kv([['İç çap', N(sg.ic, 1), 'mm'], ['Ana hat toplam uzunluğu', N(r.main.Lmain, 0), 'm'], ['Gerekli basma yüksekliği (en büyük)', N(r.main.sel.Hmax, 2), 'm']])}
          <h4>${esc(t('Mühendislik uyarıları'))}</h4>${findingsFor(A, x => x.ekran && (x.ekran.sekme === 'anahat' || x.ekran.sekme === 'basinc'))}
          <div class="dk-links"><button type="button" data-go="anahat">${esc(t('Ana Boru Şebekesi’nde aç'))} ›</button></div></div>`;
      } else if (s && s.type === 'kaynak') {
        const p = r.pump, inp = c.cur.inp;
        body = head('Su kaynağı ve pompa', esc(p.need ? (p.ad || t('Pompa')) : t('Pompa gerekmez'))) + `<div class="dk-body">
          <div class="dk-kpis">${kpi('Kaynak debisi', N(Number(String(inp.Q).replace(',', '.')), 1), 'm³/h')}${kpi('En büyük shift', N(r.sel.Qmax, 2), 'm³/h')}${p.need ? kpi('Pompa görev noktası', N(p.H, 2), 'm') + kpi('Motor', N(p.motor, 1), 'kW') : ''}</div>
          ${kv([['Filtrasyon', api.esc(r.filter.text), ''], ['Shift vanası', api.esc(r.valve.text), ''], ['Sezonluk enerji', N(p.kWh || 0, 0), 'kWh']])}
          <h4>${esc(t('Mühendislik uyarıları'))}</h4>${findingsFor(A, x => x.ekran && (x.ekran.sekme === 'pompa' || x.ekran.sekme === 'basinc'))}
          <div class="dk-links"><button type="button" data-go="pompa">${esc(t('Pompa ve Filtrasyon’da aç'))} ›</button></div></div>`;
      } else {
        const k = vm.ozet.kpis, cnt = A.count;
        body = head('Proje özeti', esc(projAd(c.cur))) + `<div class="dk-body">
          <div class="dk-kpis">${k.slice(0, 4).map(x => kpi(x.label, N(x.v, x.d), x.unit)).join('')}</div>
          <p class="dk-counts"><span class="dk-lv dk-w-uygunsuz">${esc(t('Uygunsuz'))} ${cnt.uygunsuz}</span> <span class="dk-lv dk-w-uyari">${esc(t('Uyarı'))} ${cnt.uyari}</span> <span class="dk-lv dk-w-on-degerlendirme">${esc(t('Ön değerlendirme'))} ${cnt['on-degerlendirme']}</span></p>
          <p class="dk-muted">${esc(t('Haritada bir shift, manifold, lateral veya ana hat parçasına tıklayın; alt paneldeki tablolardan da seçebilirsiniz.'))}</p>
          <div class="dk-links"><button type="button" data-sel="kaynak">${esc(t('Su kaynağı ve pompa'))} ›</button><button type="button" data-go="sonuc">${esc(t('Mühendislik değerlendirmesi'))} ›</button></div></div>`;
      }
    }
    el.innerHTML = body;
    bindPanel(el);
  }
  const shiftOf = (r, k) => r.sel.groups.findIndex(gr => gr.includes(k));
  function bindPanel(el) {
    const x = el.querySelector('[data-dk=close]'); if (x) x.onclick = () => { st.right = false; st.rightBos = false; save(); applyVars(); renderRight(); api.mapResize(); };
    el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const [v, j] = b.dataset.go.split(':'); if (v === 'sonuc') api.show('sonuc'); else api.openHydro(v, j != null ? +j : null); });
    el.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => { const [type, j] = b.dataset.sel.split(':'); select(type === 'shift' ? { type, j: +j } : { type }); });
    el.querySelectorAll('[data-kod]').forEach(b => b.onclick = () => api.focusFinding(b.dataset.kod));
    el.querySelectorAll('[data-shiftyon]').forEach(b => b.onclick = () => api.shiftYonetimi && api.shiftYonetimi(+b.dataset.shiftyon));
  }

  // ---------- Alt panel ----------
  const TABS = [['shift', 'Shift’ler'], ['anahat', 'Ana hat kesitleri'], ['malzeme', 'Malzeme'], ['uyari', 'Mühendislik uyarıları']];
  function renderBottom() {
    const el = $('#deskBottom'); if (!el) return;
    const t = api.t, esc = api.esc, c = ctx();
    const tabs = TABS.map(([k, l]) => `<button type="button" role="tab" aria-selected="${st.drawer && st.tab === k}" class="db-tab ${st.drawer && st.tab === k ? 'on' : ''}" data-tab="${k}">${esc(t(l))}${k === 'uyari' && c && c.A ? ` (${c.A.findings.length})` : ''}</button>`).join('');
    let content = '';
    if (st.drawer) {
      if (!c || !c.r) content = `<p class="dk-muted">${esc(t('Hesap sonucu yok.'))}</p>`;
      else if (st.tab === 'shift') {
        content = `<table class="db-t"><thead><tr><th>Shift</th><th>${esc(t('Debi'))} m³/h</th><th>${esc(t('Gerekli H'))} m</th><th>${esc(t('Alan'))} da</th><th>${esc(t('Süre'))} h</th><th>${esc(t('Hacim'))} m³</th><th>${esc(t('Enerji'))} kWh</th><th>${esc(t('Manifoldlar'))}</th></tr></thead><tbody>${c.vm.shift.details.map(d => `<tr data-sel="shift:${d.j}" tabindex="0" class="${st.sel && st.sel.type === 'shift' && st.sel.j === d.j ? 'on' : ''}"><td>Shift ${d.no}</td><td>${N(d.Q, 2)}</td><td>${N(d.H, 2)}</td><td>${N(d.A, 2)}</td><td>${N(d.dur, 2)}</td><td>${N(d.vol, 1)}</td><td>${N(d.kWh, 0)}</td><td>${esc(d.units.join(', '))}</td></tr>`).join('')}</tbody></table>`;
      } else if (st.tab === 'anahat') {
        content = `<table class="db-t"><thead><tr><th>${esc(t('Kesit'))}</th><th>${esc(t('Çap'))}</th><th>PN</th><th>L m</th><th>${esc(t('Debi'))} m³/h</th><th>v m/s</th><th>${esc(t('Kayıp'))} m</th></tr></thead><tbody>${c.r.main.net.map((sg, i) => `<tr data-sel="anahat:${i}" tabindex="0" class="${st.sel && st.sel.type === 'anahat' && st.sel.i === i ? 'on' : ''}"><td>${esc(sg.id)}</td><td>Ø${sg.od}</td><td>${sg.pn}</td><td>${N(sg.L, 1)}</td><td>${N(sg.Qmax, 1)}</td><td>${N(sg.v, 2)}</td><td>${N(sg.hf, 2)}</td></tr>`).join('')}</tbody></table>`;
      } else if (st.tab === 'malzeme') {
        content = `<table class="db-t"><thead><tr><th>${esc(t('Grup'))}</th><th>${esc(t('Kalem'))}</th><th>${esc(t('Miktar'))}</th><th>${esc(t('Birim'))}</th><th>${esc(t('Tutar'))} TL</th></tr></thead><tbody>${c.r.bom.map(b => `<tr><td>${esc(t(b.grup))}</td><td class="db-l">${esc(b.kalem)}</td><td>${N(b.miktar, 0)}</td><td>${esc(t(b.birim))}</td><td>${b.tutar != null ? N(b.tutar, 0) : '—'}</td></tr>`).join('')}</tbody></table><p class="dk-muted">${esc(t('Fiyat girişi ve raporlar Malzeme bölümündedir.'))}</p>`;
      } else {
        const AS = g.IrriAssess;
        content = `<div class="db-warns">${c.A.findings.map(x => `<button type="button" class="dk-warn dk-w-${x.seviye}" data-kod="${esc(x.kod)}"><span class="dk-lv">${esc(t(AS.LEVEL_AD[x.seviye]))}</span> <code>${esc(x.kod)}</code> ${esc(AS.text(x.baslik, t, api.fmt))}</button>`).join('') || `<p class="dk-muted">${esc(t('Yapılandırılmış uyarı yok.'))}</p>`}</div>`;
      }
    }
    el.innerHTML = `<div class="db-grip" role="separator" aria-orientation="horizontal" aria-label="${esc(t('Alt panel yüksekliği'))}" tabindex="0"></div>
      <div class="db-bar" role="tablist">${tabs}<span class="dt-gap"></span><button type="button" class="dt-btn" data-db="toggle" aria-expanded="${st.drawer}">${esc(t(st.drawer ? 'Alt paneli kapat' : 'Alt paneli aç'))} ${st.drawer ? '▾' : '▴'}</button></div>
      <div class="db-body">${content}</div>`;
    el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { st.tab = b.dataset.tab; st.drawer = true; save(); applyVars(); renderBottom(); api.mapResize(); });
    el.querySelector('[data-db=toggle]').onclick = () => { st.drawer = !st.drawer; save(); applyVars(); renderBottom(); api.mapResize(); };
    el.querySelectorAll('tr[data-sel]').forEach(tr => { const go = () => { const [type, n] = tr.dataset.sel.split(':'); select(type === 'shift' ? { type, j: +n } : { type, i: +n }); }; tr.onclick = go; tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
    el.querySelectorAll('[data-kod]').forEach(b => b.onclick = () => api.focusFinding(b.dataset.kod));
    const grip = el.querySelector('.db-grip');
    grip.onpointerdown = e => {
      if (!st.drawer) return; e.preventDefault(); grip.setPointerCapture(e.pointerId);
      const y0 = e.clientY, h0 = st.drawerH;
      grip.onpointermove = ev => { st.drawerH = Math.max(140, Math.min(g.innerHeight * 0.6, h0 + (y0 - ev.clientY))); applyVars(); };
      grip.onpointerup = () => { grip.onpointermove = null; save(); api.mapResize(); };
    };
    grip.onkeydown = e => { if (!st.drawer) return; if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); st.drawerH = Math.max(140, Math.min(g.innerHeight * 0.6, st.drawerH + (e.key === 'ArrowUp' ? 20 : -20))); applyVars(); save(); api.mapResize(); } };
  }

  // Uygulama ekran değiştirdiğinde, hesap yenilendiğinde ve proje açıldığında çağrılır
  function refresh() { if (!on) return; if (applyVars()) api.mapResize(); renderTools(); renderRail(); renderRight(); renderBottom(); }
  function projectChanged() { st.sel = null; refresh(); }

  g.IrriDesk = { init, refresh, select, projectChanged, noteBackup, get active() { return on; }, MIN_W, state: st };
  if (typeof module !== 'undefined') module.exports = g.IrriDesk;
})(typeof window !== 'undefined' ? window : globalThis);

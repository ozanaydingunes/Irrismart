// IrriGrow — Profesyonel hidrolik paneli: çizim (MH-1)
// Görünüm modelini (hydro-view.js) HTML'e çevirir. Tek bir duyarlı işaretleme üretilir: geniş ekranda tablolar,
// dar ekranda aynı satırlar CSS ile kart olarak gösterilir; masaüstü ve mobil aynı veriyi kullanır.
// Ekrandaki her sayı `data-v` özniteliğinde ham değeriyle taşınır (aynı-veri testi).
(function (g) {
  const TABS = [['ozet', 'Sistem Özeti'], ['lateral', 'Lateral'], ['manifold', 'Manifold'], ['anahat', 'Ana Boru Şebekesi'], ['shift', 'Shift Analizi'], ['pompa', 'Pompa ve Filtrasyon'], ['basinc', 'Basınç ve Enerji'], ['tablo', 'Hidrolik Hesap Tablosu']];
  const LVL = { ok: 'Uygun', warn: 'Sınırda', bad: 'Uygunsuz' };
  const ICON = {
    ok: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M5 8.2l2 2 4-4.4"/></svg>',
    warn: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8 15 14H1z"/><path d="M8 6.2v3.6M8 11.6v.4"/></svg>',
    bad: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8"/></svg>',
  };

  function make(o) {
    const t = o.t || (x => x), loc = o.locale || 'tr-TR';
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const fmt = (v, d) => (v == null || !Number.isFinite(Number(v))) ? '—' : Number(v).toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
    // Sayı: ekranda biçimli, data-v'de ham değer
    const N = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? `<span class="hp-n" data-v="${v}">${fmt(v, d ?? 2)}</span>`
      : v == null ? '—' : (typeof v === 'object' && v.t != null) ? esc(t(v.t)) : esc(String(v));   // {t:'…'} çevrilir; kod ve adlar olduğu gibi
    const month = m => new Date(2026, m - 1, 1).toLocaleDateString(loc, { month: 'short' });
    const U = u => u ? ` <span class="hp-u">${esc(t(u))}</span>` : '';
    const badge = l => l ? `<span class="hp-b hp-${l}">${ICON[l]}${esc(t(LVL[l]))}</span>` : '';
    const chip = (vm, s) => s ? `<span class="hp-src hp-src-${s}">${esc(t(vm.SRC[s] || s))}</span>` : '';
    const fill = (txt, params) => t(txt, Object.fromEntries(Object.entries(params || {}).map(([k, v]) => [k, Array.isArray(v) ? fmt(v[0], v[1]) : v])));
    const barTxt = b => b != null ? ` <span class="hp-bar">(${fmt(b, 2)} bar)</span>` : '';

    function kv(vm, rows) {
      return `<dl class="hp-kv">${rows.map(r => `<div class="hp-kv-r${r.status ? ' hp-st-' + r.status : ''}"><dt>${esc(t(r.label))}${r.note ? ` <small>${esc(t(r.note))}</small>` : ''}</dt><dd>${N(r.v, r.d)}${U(r.unit)}${barTxt(r.bar)}${r.sub ? ` <small class="hp-sub">· ${N(r.sub[0], r.sub[1])}${U(r.sub[2])}</small>` : ''} ${r.status ? badge(r.status) : ''}${chip(vm, r.src)}</dd></div>`).join('')}</dl>`;
    }
    // Duyarlı tablo: geniş ekranda tablo, dar ekranda her satır bir kart (etiketler data-l'den)
    function table(cols, rows, opt = {}) {
      const tx = (i, d) => i && d == null ? ' class="hp-tx"' : '';   // metin sütunu: sola hizalı
      const head = cols.map(([l, u, d], i) => `<th scope="col"${tx(i, d)}>${esc(t(l))}${u ? `<span class="hp-u"> ${esc(t(u))}</span>` : ''}</th>`).join('') + (opt.status ? `<th scope="col" class="hp-tx">${esc(t('Kontrol'))}</th>` : '');
      const body = rows.map(r => `<tr class="${r.crit ? 'hp-crit' : ''}${r.sel ? ' hp-selrow' : ''}">${r.cells.map((c, i) => {
        const [l, u, d] = cols[i];
        return i === 0 ? `<th scope="row" data-l="${esc(t(l))}">${N(c, d)}</th>` : `<td${tx(i, d)} data-l="${esc(t(l))}${u ? ' (' + esc(t(u)) + ')' : ''}">${N(c, d)}</td>`;
      }).join('')}${opt.status ? `<td class="hp-tx" data-l="${esc(t('Kontrol'))}">${badge(r.status)}</td>` : ''}</tr>`).join('');
      return `<div class="hp-tw"><table class="hp-rt"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }
    const card = (title, body, extra = '') => `<section class="hp-card">${title ? `<h3>${esc(t(title))}</h3>` : ''}${extra}${body}</section>`;
    const method = (m, inputs, asm) => `<details class="hp-method"><summary>${esc(t('Yöntem, girdiler ve varsayımlar'))}</summary><div class="hp-mgrid">
      <div><h4>${esc(t('Yöntem'))}</h4><ul>${m.map(x => `<li>${esc(t(x))}</li>`).join('')}</ul></div>
      <div><h4>${esc(t('Girdiler'))}</h4><ul>${inputs.map(x => `<li>${esc(t(x))}</li>`).join('')}</ul></div>
      <div><h4>${esc(t('Varsayımlar'))}</h4><ul>${asm.map(x => `<li>${esc(t(x))}</li>`).join('')}</ul></div></div></details>`;
    const notYet = txt => `<p class="hp-later">${esc(t(txt))}</p>`;

    // ---------- Sekmeler ----------
    function ozet(vm) {
      const o = vm.ozet, maxH = Math.max(...o.shiftBars.map(b => Math.max(b.H, b.pumpH || 0, b.Hd)), 1) * 1.05;
      const pct = v => (v / maxH * 100).toFixed(2) + '%';
      return `<div class="hp-kpis">${o.kpis.map(k => `<div class="hp-kpi"><span class="hp-kl">${esc(t(k.label))}</span><b>${N(k.v, k.d)}${U(k.unit)}</b>${k.sub ? `<span class="hp-ks">${N(k.sub[0], k.sub[1])}${U(k.sub[2])}</span>` : ''}${chip(vm, k.src)}</div>`).join('')}</div>
      ${card('Mühendislik kontrolleri', (() => {
        const li = c => `<li class="hp-ck hp-ck-${c.level}">${badge(c.level)}<span><b>${esc(t(c.title))}</b> — ${esc(fill(c.text, c.params))}</span><button class="hp-link" data-go="${c.tab}">${esc(t('Ayrıntı'))} ›</button></li>`;
        const open = vm.checks.filter(c => c.level !== 'ok'), okc = vm.checks.filter(c => c.level === 'ok');
        return `<ul class="hp-checks">${open.map(li).join('')}</ul>${okc.length ? `<details class="hp-okfold"><summary>${esc(t('Uygun kontroller'))} (${okc.length})</summary><ul class="hp-checks">${okc.map(li).join('')}</ul></details>` : ''}`;
      })(),
        `<p class="hp-count">${badge('bad')} ${N(vm.count.bad, 0)} · ${badge('warn')} ${N(vm.count.warn, 0)} · ${badge('ok')} ${N(vm.count.ok, 0)}</p>`)}
      <div class="hp-cols">
        ${card('Shift başına gerekli basma yüksekliği', `<div class="hp-bars">${o.shiftBars.map(b => `<button class="hp-barrow" data-shift="${b.j}"><span class="hp-bl">Shift ${b.j + 1}</span><span class="hp-track"><span class="hp-fill" style="width:${pct(b.H)}"></span>${b.Hd > b.H + 1e-6 ? `<span class="hp-fill2" style="left:${pct(b.H)};width:${pct(b.Hd - b.H)}"></span>` : ''}${b.pumpH ? `<span class="hp-mark" style="left:${pct(b.pumpH)}"></span>` : ''}</span><span class="hp-bv">${N(b.H, 1)}${U('m')} · ${N(b.Q, 1)}${U('m³/h')}</span></button>`).join('')}</div>
          <p class="hp-legend"><span class="hp-lg hp-lg1"></span>${esc(t('Gerekli H'))} <span class="hp-lg hp-lg2"></span>${esc(t('Verilen H fazlası'))} <span class="hp-lg hp-lg3"></span>${esc(t('Pompa eğrisindeki H'))}</p>`)}
        ${card('Su ihtiyacı ve program', kv(vm, o.water))}
      </div>
      <div class="hp-cols">
        ${card('Basınç aralığı', kv(vm, o.pressure))}
        ${card('Boru ve damlatıcı uzunlukları', kv(vm, o.lengths))}
      </div>
      ${o.critPath ? card('Kritik hidrolik güzergâh', `<p class="hp-path">K0 → ${o.critPath.segs.map(esc).join(' → ')} → M${o.critPath.unit + 1}</p><p class="hp-muted">${esc(fill('Shift {s}: gerekli H {h} m · yol {l} m', { s: o.critPath.j + 1, h: [o.critPath.H, 2], l: [o.critPath.L, 0] }))}</p>`) : ''}
      ${o.engineWarn.length ? `<details class="hp-method"><summary>${esc(t('Hesap motoru uyarıları'))} (${o.engineWarn.length})</summary><ul class="hp-plain">${o.engineWarn.map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>` : ''}
      ${method(['FAO-56: ET₀ × Kc × Kr / Ea', 'Shift: ardışık alt üniteler, en büyük shift debisini en aza indiren bölme', 'Gerekli H: statik + kot + istasyon kayıpları + ana hat sürtünmesi + vana + ünite girişi'],
        ['Arazi, bitki, damlatıcı ve kaynak verileri (Veriler ekranı)', 'Ekipman kataloğu ve fiyatlar (Ayarlar)'],
        ['Her shift aynı süre çalışır', 'Alan payı debi oranından hesaplanır', 'Uyarı ve varsayım metinleri motor tarafından Türkçe üretilir'])}`;
    }

    function lateral(vm) {
      const L = vm.lateral;
      return `<div class="hp-cols">${card('Damlatıcı', kv(vm, L.emitter))}${card('Lateral borusu ve yerleşim', kv(vm, L.pipe))}</div>
      ${card('Lateral hidroliği', kv(vm, L.hyd) + (L.slopeNote ? `<p class="hp-note">${esc(t('Eğim yönü bilinmiyor: bütün lateraller yukarı eğimli (en kötü durum) hesaplanır.'))}</p>` : ''))}
      ${card('En kritik 10 lateral (en büyük ΔH)', table(L.table.cols, L.table.rows, { status: true }))}
      ${method(['Watters-Keller (düz plastik boru), damlatıcı damlatıcı adım adım', 'Azami boy: Christiansen F ile tek çaplı lateral', 'İzin verilen fark: hₙ·(1 − 0,9^(1/x)) — %10 debi farkı'],
        ['Damlatıcı debisi, aralığı, basıncı ve x', 'Lateral iç çapı (katalog)', 'Lateral yönündeki eğim'],
        ['Damlatıcı bağlantı kaybı eşdeğer uzunlukla (şerit 0,10 m, ağaç 0,20 m)', 'Basınç farkı payı: %55 lateral, %45 manifold', 'Nominal debi (basınca bağlı debi MH-4)'])}`;
    }

    function manifold(vm) {
      const M = vm.manifold;
      return `<div class="hp-cols">${card('Manifold özeti', kv(vm, M.summary))}${card('Boru dağılımı', table([['Boru', '', null], ['İç çap', 'mm', 1], ['Uzunluk', 'm', 0], ['Adet', '', 0]], M.byPipe.map(b => ({ cells: [b.pipe, b.ic, b.len, b.n] }))))}</div>
      ${card('Alt üniteler (manifoldlar)', table(M.table.cols, M.table.rows, { status: true }))}
      ${method(['Watters-Keller, lateral çıkışları adım adım', 'Çap: hız ≤ 1,5 m/s ve basınç değişimi ≤ izin verilen olacak en küçük PE100', 'Giriş basıncı: debi ağırlıklı ortalama (PC’de en yüksek gereksinim)'],
        ['Lateral giriş debileri ve basınçları', 'PE100 boru kataloğu', 'Manifold yönündeki eğim'],
        ['Alt ünite debisi ≤ kaynak debisinin yarısı', 'Tercihen en fazla Ø110', 'Giriş bağlantısı için +0,3 m'])}`;
    }

    function anahat(vm) {
      const A = vm.anahat;
      const alts = A.alts.map(a => ({ sel: a.sel, cells: [`Ø${a.od} PN${a.pn}`, a.v, a.Hmax, a.kWh, a.pipeCost == null ? t('Fiyat yok') : a.pipeCost, a.annual == null ? '—' : a.annual, (a.sel ? t('SEÇİLİ') + ' ' : '') + a.tags.map(x => t(x)).join(', ')] }));
      return `<div class="hp-cols">${card('Ana hat özeti', kv(vm, A.summary))}${card('Çap dağılımı', table([['Boru', '', null], ['Uzunluk', 'm', 0]], A.sizes.map(x => ({ cells: [x.pipe, x.L] }))))}</div>
      ${A.critPath ? card('Kritik güzergâh', `<p class="hp-path">K0 → ${A.critPath.segs.map(esc).join(' → ')} → M${A.critPath.unit + 1}</p><p class="hp-muted">${esc(fill('Shift {s} · {l} m · tabloda vurgulu', { s: A.critPath.j + 1, l: [A.critPath.L, 0] }))}</p>`) : ''}
      ${card('Boru kesitleri', table(A.table.cols, A.table.rows, { status: true }) + `<p class="hp-muted">${esc(t('Hız: ≤ 1,5 m/s uygun · 1,5–2,0 sınırda · > 2,0 uygunsuz. Kayıp, kesitin taşıdığı en büyük shift debisinde.'))}</p>`)}
      ${notYet('Düğüm basınçları ve Darcy-Weisbach karşılaştırması bu sürümde hesaplanmıyor (MH-4).')}
      ${card('Ana hat çap alternatifleri', table([['Ana çap', '', null], ['Hız', 'm/s', 2], ['H maks.', 'm', 1], ['Enerji', 'kWh/yıl', 0], ['Boru', '₺', 0], ['Yıllık', '₺', 0], ['Not', '', null]], alts))}
      ${method(['Hazen-Williams, C = 150', 'Ağaç ağ: her kesit, akış yönünde beslediği ünitelerin shift debisini taşır', 'Kademeli çap: hız sınırını sağlayan en küçük çap, ana çapı geçmez', 'Ekonomik seçim: boru yatırımının yıllık taksiti + enerji'],
        ['PVC-U boru kataloğu ve fiyatları', 'Güzergâh ve kaynak (Arazi ekranı)', 'Faiz, ömür ve elektrik fiyatı (Ayarlar)'],
        ['Yerel kayıplar: sürtünmenin %10’u', 'PN: 1,25 × en alçak noktadaki işletme ≤ PN ve kapama basıncı ≤ PN'])}`;
    }

    function shift(vm, st) {
      const S = vm.shift, j = Math.min(Math.max(0, st.shift | 0), S.details.length - 1), d = S.details[j];
      const pump = d.pump ? kv(vm, [
        { label: 'Debi', v: d.pump.Q, d: 2, unit: 'm³/h', src: 'hesap' }, { label: 'Pompanın vermesi gereken', v: d.pump.Hreq, d: 2, unit: 'm', src: 'hesap' },
        ...(d.pump.H != null ? [{ label: 'Pompa eğrisindeki H', v: d.pump.H, d: 2, unit: 'm', src: d.pump.src }, { label: 'Pompa eğrisi fazlası', v: d.pump.curveSur, d: 2, unit: 'm', src: d.pump.src, status: d.pump.curveRatio > 1.3 ? 'warn' : 'ok', note: d.pump.curveRatio > 1.3 ? 'regülatör veya frekans konvertörü' : '' }, { label: 'Verim (eğriden)', v: d.pump.eta, d: 1, unit: '%', src: d.pump.src }, { label: 'Mil gücü', v: d.pump.P, d: 2, unit: 'kW', src: d.pump.src }] : []),
      ]) : `<p class="hp-muted">${esc(t('Pompa gerekmiyor.'))}</p>`;
      return `<div class="hp-chips" role="tablist">${S.list.map(x => `<button class="hp-chip${x.j === j ? ' on' : ''}" data-shift="${x.j}" role="tab" aria-selected="${x.j === j}">Shift ${x.no} <small>${N(x.Q, 1)}${U('m³/h')}</small> ${x.status !== 'ok' ? badge(x.status) : ''}</button>`).join('')}</div>
      <section class="hp-card hp-detail"><h3>Shift ${d.no}${S.manual ? ` <span class="hp-src hp-src-elle">${esc(t('elle düzenlendi'))}</span>` : ''}</h3>
        <div class="hp-kpis hp-kpis-s">
          <div class="hp-kpi"><span class="hp-kl">${esc(t('Debi'))}</span><b>${N(d.Q, 2)}${U('m³/h')}</b>${d.overSource ? badge('bad') : ''}</div>
          <div class="hp-kpi"><span class="hp-kl">${esc(t('Gerekli H'))}</span><b>${N(d.H, 2)}${U('m')}</b><span class="hp-ks">${N(d.Hbar, 2)}${U('bar')}</span></div>
          <div class="hp-kpi"><span class="hp-kl">${esc(t('Alan'))}</span><b>${N(d.A, 2)}${U('da')}</b><span class="hp-ks">${N(d.units.length, 0)} ${esc(t('ünite'))} · ${N(d.nLat, 0)} ${esc(t('lateral'))}</span></div>
          <div class="hp-kpi"><span class="hp-kl">${esc(t('Süre · hacim'))}</span><b>${N(d.dur, 2)}${U('h')}</b><span class="hp-ks">${N(d.vol, 1)}${U('m³')}</span></div>
          <div class="hp-kpi"><span class="hp-kl">${esc(t('Sezonluk enerji'))}</span><b>${N(d.kWh, 0)}${U('kWh')}</b><span class="hp-ks">${N(d.cost, 0)}${U('₺')}</span></div>
        </div>
        <div class="hp-cols">
          ${card('Gerekli basma yüksekliğinin dökümü', kv(vm, d.breakdown) + `<p class="hp-total">${esc(t('Toplam'))} <b>${N(d.breakdownSum, 2)}${U('m')}</b></p>` + (d.critUnit ? `<p class="hp-muted">${esc(fill('Belirleyici ünite {u} · yol {l} m', { u: d.critUnit.id, l: [d.critUnit.L, 0] }))}: ${d.critUnit.segs.map(esc).join(' → ')}</p>` : ''))}
          ${card('Pompa görev noktası', pump + kv(vm, [{ label: 'Verilen H', v: d.Hd, d: 2, unit: 'm', src: 'hesap' }, { label: 'Fazla basınç (kot/şebeke)', v: d.surplus, d: 2, unit: 'm', src: 'hesap', status: d.surplus > 5 ? 'warn' : 'ok', note: d.regulator ? 'regülatör önerilir' : '' }]))}
        </div>
        ${card('Açılan manifoldlar', table([['Kod', '', null], ['Debi', 'm³/h', 2], ['Lateral', 'adet', 0], ['Boru', '', null], ['Giriş basıncı', 'm', 2], ['Sürtünme', 'm', 2], ['Basınç değişimi', 'm', 2]], d.unitRows.map(u => ({ cells: [u.id, u.Q, u.nLat, u.pipe, u.hIn, u.hf, u.varH] }))))}
      </section>
      ${card('Shift sayısı alternatifleri', table([['Shift', '', 0], ['En büyük debi', 'm³/h', 1], ['Tur', 'h', 1], ['Ana hat', '', null], ['H maks.', 'm', 1], ['Motor', 'kW', 1], ['Enerji', 'kWh/yıl', 0], ['Yıllık karşılaştırma', '₺', 0]],
        S.alts.map(a => ({ sel: a.sel, status: a.feasible ? 'ok' : 'bad', cells: [a.Ns, a.Qmax, a.cycle, a.main, a.Hmax, a.motor, a.kWh, a.compare == null ? '—' : a.compare] })), { status: true }) + `<p class="hp-muted">${esc(t('Öneri ölçütü'))}: ${esc(S.recBasis)}</p>`)}
      ${method(['Alt üniteler ardışık gruplara bölünür; en büyük shift debisi en aza indirilir', 'Öneri: süreye sığan düzenler arasında yıllık maliyet (fiyatlar eksikse en az shift)'],
        ['Kaynak debisi, günlük çalışma süresi, sulama aralığı', 'Elle shift ataması (Arazi → Shift)'],
        ['Her shift aynı sürede sulanır', 'Shift alanı debi oranından', 'Enerji: shift başına pompa gücü × sezonluk çalışma'])}`;
    }

    function pompa(vm) {
      const P = vm.pompa;
      const duty = P.duty.length ? table([['Shift', '', 0], ['Debi', 'm³/h', 2], ['Gerekli', 'm', 2], ['Eğrideki H', 'm', 2], ['Fazla', 'm', 2], ['Verim', '%', 1], ['Güç', 'kW', 2], ['Enerji', 'kWh', 0]],
        P.duty.map(x => ({ cells: [x.no, x.Q, x.Hreq, x.H, x.sur, x.eta, x.P, x.kWh] }))) : '';
      return `${P.need ? `<div class="hp-cols">${card('Pompa', kv(vm, P.info) + (P.temsili ? `<p class="hp-note">${esc(t('Temsili hesap: jenerik katalog kaydı, gerçek bir pompa modeli değildir. Üretici eğrisini Ayarlar → Ekipman kataloğu ile yükleyin.'))}</p>` : ''))}
        ${card('Shift başına görev noktaları', duty + (P.fromCatalog ? '' : `<p class="hp-muted">${esc(t('Katalog eğrisi yok: yalnız gereksinim gösterilir.'))}</p>`))}</div>` : card('Pompa', `<p>${esc(P.text)}</p>`)}
      ${notYet('Pompanın en verimli çalışma noktası (BEP) bu sürümde hesaplanmıyor (MH-4).')}
      <div class="hp-cols">
        ${card('Filtrasyon', table([['Adet', '', 0], ['Filtre', '', null], ['Tip', '', null], ['Kapasite', 'm³/h', 0]], P.filter.map(x => ({ cells: [x.n, x.ad + (x.mesh ? ` (${x.mesh} mesh)` : ''), x.tip, x.qMax] }))) + kv(vm, [{ label: 'Filtre kaybı (en büyük shift)', v: P.filterLoss, d: 2, unit: 'm', src: 'hesap' }, ...P.water]) + (P.filterMissing.length ? `<p class="hp-note">${esc(fill('{x} filtresi katalogda yok; 5 m kayıp kabul edildi', { x: P.filterMissing.join(', ') }))}</p>` : ''))}
        ${card('Shift vanası', kv(vm, [{ label: 'Vana', v: P.valve, src: P.valveSrc }, { label: 'Kayıp (en büyük shift debisinde)', v: P.valveLoss, d: 2, unit: 'm', src: 'hesap', status: P.valveOver ? 'warn' : 'ok' }]))}
      </div>
      ${method(['Pompa: her shift debisinde katalog eğrisi gerekli basıncı karşılamalı; sezonluk enerjisi en düşük kayıt', 'Katalog yoksa: hidrolik güç / 0,70, motor %10 paylı standart güce yuvarlanır', 'Filtre kaybı: temiz kayıp × (Q / kapasite)² + kirlenme payı', 'Vana kaybı: 10,2 · (Q / Kv)²'],
        ['Kaynak türü ve su kalitesi', 'Pompa, filtre ve vana kataloğu (Ayarlar)'],
        ['Motor verimi %90', 'Kuyu: su en az yüzeye + istasyon kayıplarına basılır'])}`;
    }

    function basinc(vm) {
      const B = vm.basinc;
      return `${card('Shift başına basınç dökümü', table([['Shift', '', 0], ['Statik', 'm', 2], ['Kot', 'm', 2], ['İstasyon', 'm', 2], ['Ana hat', 'm', 2], ['Vana', 'm', 2], ['Ünite girişi', 'm', 2], ['Gerekli H', 'm', 2], ['Verilen H', 'm', 2], ['Pompa H', 'm', 2], ['Fazla', 'm', 2]],
        B.head.map(x => ({ status: x.sur > 5 ? 'warn' : 'ok', cells: [x.no, x.static0, x.rise, x.Hfix, x.hf, x.valve, x.hIn, x.H, x.Hd, x.Hp, x.sur] })), { status: true }))}
      <div class="hp-cols">${card('Basınç sınıfı (PN)', kv(vm, B.pn))}${card('Su darbesi (üst sınır)', kv(vm, B.surge) + `<p class="hp-note">${esc(t('Su darbesi ayrıntılı analiz edilmedi; Joukowsky ani kapanma üst sınırıdır.'))}</p>`)}</div>
      ${card('Enerji', kv(vm, B.energy))}
      ${card('Aylık sulama programı', table([['Ay', '', null], ['Kc', '', 2], ['ET₀', 'mm/gün', 2], ['Brüt', 'mm/gün', 2], ['Aralık', 'gün', 0], ['Süre', 'h', 2], ['Hacim', 'm³/da', 1]], B.monthly.map(m => ({ cells: [month(m.m), m.kc, m.et0, m.gross, m.interval, m.sure, m.m3da] }))))}
      ${notYet('Düğüm basınç profili ve hidrolik eğim çizgisi bu sürümde hesaplanmıyor (MH-4).')}
      ${method(['H = statik + kot + istasyon + ana hat sürtünmesi + vana + ünite girişi', 'PN: 1,25 × en alçak noktadaki işletme ve kapama basıncı', 'Joukowsky: ΔH = a·v/g, a = √(K/ρ / (1 + K·D/(E·e)))', 'Enerji: ρ·g·Q·H / (η pompa · η motor)'],
        ['Kuyu dinamik seviyesi, kot farkı, şebeke basıncı', 'Elektrik fiyatı (Ayarlar)'],
        ['Kapama basıncı (jenerik): görev basıncının 1,3 katı', 'Sürtünme PN kontrolünde ihmal edilir (güvenli yön)'])}`;
    }

    function render(vm, st = {}) {
      const tab = TABS.some(x => x[0] === st.tab) ? st.tab : 'ozet';
      const nav = `<nav class="hp-tabs" aria-label="${esc(t('Hidrolik bölümleri'))}">${TABS.map(([id, l]) => `<button class="hp-tab${id === tab ? ' on' : ''}" data-ptab="${id}" aria-current="${id === tab ? 'page' : 'false'}">${esc(t(l))}</button>`).join('')}</nav>`;
      if (tab === 'tablo') return `${nav}<div class="hp-body" data-tab="tablo"><div id="hpTable"></div></div>`;
      if (!vm || !vm.ok) return `${nav}<div class="hp-body"><div class="note err">${esc(t('Kesin sonuç verilemiyor'))}${vm && vm.err ? `<ul>${vm.err.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}</div></div>`;
      const body = { ozet, lateral, manifold, anahat, shift, pompa, basinc }[tab](vm, st);
      return `${nav}<div class="hp-body" data-tab="${tab}">${body}</div>`;
    }
    return { render, TABS };
  }

  g.IrriHydroPanel = { make, TABS };
  if (typeof module !== 'undefined') module.exports = g.IrriHydroPanel;
})(typeof window !== 'undefined' ? window : globalThis);

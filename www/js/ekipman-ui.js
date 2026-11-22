// IrriGrow — Ekipman önerileri (Malzeme ekranı). Android ve masaüstü web aynı kod ve aynı öneri motoru (IrriEsles / IrriEslesBoru).
// Uygun / verisi eksik / uygun değil listeleri gerekçeleriyle; katalog ve sayfa referansı; malzeme listesine ekleme;
// hidroliği etkileyen seçimde taslak hesap → önce/sonra → Uygula / İptal; uygulanan ekipmanı geri alma.
(function (g) {
  'use strict';
  const t = (s, p) => (g.IrriI18n ? g.IrriI18n.t(s, p) : (p ? s.replace(/\{(\w+)\}/g, (m, k) => (p[k] !== undefined ? p[k] : m)) : s));
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f2 = (v, d = 2) => v == null || !Number.isFinite(v) ? '—' : v.toLocaleString((g.IrriI18n && g.IrriI18n.locale) || 'tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const KAT = [['pompa', 'Pompa'], ['filtre', 'Filtre'], ['vana', 'Vana'], ['boru', 'Boru'], ['baglanti', 'Bağlantı elemanı']];
  const HIDROLIK = { pompa: 1, filtre: 1, vana: 1, boru: 1 };
  let S = { kat: 'pompa', taslak: null }, host = null, veri = null, sonuc = null;

  async function render(el) {
    host = el; const A = g.IrriApp && g.IrriApp.ekipmanBaglam ? g.IrriApp.ekipmanBaglam() : null;
    if (!A || !A.cur || !A.r || !A.r.ok) { host.innerHTML = ''; return; }
    try { veri = await g.IrriKatalogDepo.urunListele(); } catch (e) { veri = { urunler: [], degerler: [], egriler: [] }; }
    sonuc = g.IrriEsles.oneriler(A.r, A.cur.inp, veri);
    ciz(A);
  }

  const durumTag = d => `<span class="tag ${d === 'uygun' ? 'ok' : d === 'uygun-degil' ? 'bad' : 'warn'}">${t(d === 'uygun' ? 'Uygun' : d === 'uygun-degil' ? 'Uygun değil' : 'Verisi eksik')}</span>`;
  function hesapSatir(kat, x) {
    const h = x.hesap || {};
    if (kat === 'pompa' && h.noktalar) return `${t('Rezerv')} ${f2(h.rezerv_m, 1)} m · ${t('mil gücü')} ${f2(h.Pmax_kW)} / ${t('motor')} ${f2(h.motor_kW, 1)} kW${h.isletme ? ` · ${t('işletme noktası')} ${f2(h.isletme.Q, 1)} m³/h @ ${f2(h.isletme.H, 1)} m${h.isletme.eta != null ? ` · η ${f2(h.isletme.eta, 0)} %` : ''}` : ''}${x.kosul ? ' · ' + esc(x.kosul) : ''}`;
    if (kat === 'filtre' && h.adet) return `${h.adet} × · ${t('temiz')} ${f2(h.temiz_bar, 2)} bar · ${t('kirli')} ${f2(h.kirli_bar, 2)} bar${h.dH_m != null ? ` · ΔH ${f2(h.dH_m)} m` : ''}`;
    if (kat === 'vana' && h.Q) return `${t('kayıp')} ${f2(h.kayip_m)} m @ ${f2(h.Q, 1)} m³/h${h.dH_m != null ? ` · ΔH ${f2(h.dH_m)} m` : ''}`;
    if (kat === 'boru' && h.ic) return `${t('iç çap')} ${f2(h.ic, 1)} mm · v ${f2(h.v)} m/s · ${t('kayıp')} ${f2(h.hf)} m (Δ ${f2(h.dhf)}) · ${t('basınç rezervi')} ${f2(h.basincRezerv_m, 1)} m`;
    if (kat === 'baglanti' && h.cap) return `Ø${h.cap} · ${esc((h.eslesen || []).join(', '))}`;
    return '';
  }
  function kart(kat, x, i, segId) {
    const anahtar = `${kat}|${segId || ''}|${i}|${x.durum}`;
    return `<div class="card ek-kart" data-ek="${esc(anahtar)}"><b>${esc(x.uretici)} · ${esc(x.model || x.urunKodu)}</b> ${durumTag(x.durum)}
      ${x.urunKodu ? `<div class="small muted">${t('Ürün kodu')}: ${esc(x.urunKodu)}</div>` : ''}
      <div class="small">${hesapSatir(kat, x)}</div>
      ${x.neden && x.neden.length ? `<ul class="small ${x.durum === 'uygun-degil' ? 'bad' : ''}">${x.neden.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      ${x.uyari && x.uyari.length ? `<ul class="small muted">${x.uyari.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <div class="small muted">${t('Kaynak')}: ${esc((x.kaynakSayfalar || []).join(', ') || '—')}</div>
      <div class="row wrap"><button type="button" class="btn sm" data-ekle="${esc(anahtar)}">${t('Malzeme listesine ekle')}</button>${x.durum === 'uygun' && HIDROLIK[kat] ? `<button type="button" class="btn sm primary" data-hesap="${esc(anahtar)}">${t('Hesaba uygula')}</button>` : ''}</div></div>`;
  }
  function liste(kat, L, segId) {
    if (!L) return '';
    const bolum = (ad, arr) => arr.length ? `<h4>${t(ad)} (${arr.length})</h4>${arr.map(x => kart(kat, x, (L.uygun.concat(L.eksik, L.uygunDegil)).indexOf(x), segId)).join('')}` : '';
    const top = L.uygun.length + L.eksik.length + L.uygunDegil.length;
    return top ? bolum('Uygun', L.uygun) + bolum('Verisi eksik', L.eksik) + bolum('Uygun değil', L.uygunDegil) : `<p class="small muted">${t('Bu kategoride kayıtlı ürün yok. Firma katalogları → Ürünler bölümünden ekleyebilirsiniz.')}</p>`;
  }
  function ciz(A) {
    const c = A.cur, es = c.ekipmanSecimi || null, kalem = c.katalogKalemleri || [];
    const katHtml = S.kat === 'boru' ? (sonuc.boru ? sonuc.boru.segmentler.map(s => `<div class="small muted">${t('Ana hat segmenti')} ${esc(s.seg.id)} · Ø${s.seg.od} PN${s.seg.pn} · ${f2(s.seg.Qmax, 1)} m³/h · ${f2(s.seg.L, 0)} m</div>${liste('boru', s, s.seg.id)}`).join('') : '')
      : S.kat === 'pompa' && sonuc.pompa.bilgi ? `<p class="small muted">${t(sonuc.pompa.bilgi)}</p>` : liste(S.kat, sonuc[S.kat]);
    host.innerHTML = `<div class="card" id="ekipmanKart"><h3>${t('Ekipman önerileri')}</h3>
      <p class="small muted">${t('Öneriler proje hesabının gereksinimleriyle kayıtlı ürünleri karşılaştırır. Yalnız mühendislik doğrulaması geçmiş ürünler “uygun” olabilir; yeni eklenen doğrulanmış ürünler otomatik değerlendirilir.')}</p>
      ${es ? `<div class="note small" id="ekUygulanan">${t('Hesaba uygulanan ekipman')}: ${esc(Object.values(es.ad || {}).join(', '))} <button type="button" class="btn sm" id="ekKaldir">${t('Hesaptan kaldır (Geri Al)')}</button></div>` : ''}
      <div class="kat-cipler" role="tablist">${KAT.map(([k, ad]) => `<button type="button" class="chip ${S.kat === k ? 'on' : ''}" data-ekkat="${k}">${t(ad)}</button>`).join('')}</div>
      ${S.taslak ? taslakHtml() : ''}
      <div id="ekListe">${katHtml}</div></div>
      <div class="card" id="katalogKalemleri"><h3>${t('Katalog kalemleri')} (${kalem.length})</h3>${kalem.length ? `<div class="scroll"><table class="small"><tr><th>${t('Kalem')}</th><th>${t('Miktar')}</th><th></th></tr>${kalem.map((k, i) => `<tr><td>${esc(k.uretici)} · ${esc(k.model || k.urunKodu)}${k.urunKodu ? ' (' + esc(k.urunKodu) + ')' : ''}<br><span class="muted">${t(KAT.find(x => x[0] === k.kategori)[1])} · ${esc(k.kaynak || '')}${k.durum !== 'uygun' ? ` · <b class="bad">${t('kullanıcı kararı: uygunluk doğrulanmadı')}</b>` : ''}</span></td><td><input class="price" data-kmiktar="${i}" inputmode="decimal" value="${k.miktar}"> ${esc(k.birim)}</td><td><button type="button" class="btn sm danger" data-ksil="${i}">✕</button></td></tr>`).join('')}</table></div>` : `<p class="small muted">${t('Henüz katalog kalemi yok.')}</p>`}</div>`;
    bagla(A);
  }
  function taslakHtml() {
    const T = S.taslak;
    return `<div class="card ek-taslak" id="ekTaslak"><h4>${t('Taslak hesap (önce / sonra)')}</h4>${T.hata ? `<div class="note err">${esc(T.hata)}</div>` : `<div class="scroll"><table class="small"><tr><th></th><th>${t('Önce')}</th><th>${t('Sonra')}</th></tr>${T.satirlar.map(s => `<tr><td>${esc(s[0])}</td><td>${esc(s[1])}</td><td><b>${esc(s[2])}</b></td></tr>`).join('')}</table></div>`}
      ${T.uyari ? `<div class="note small">${esc(T.uyari)}</div>` : ''}
      <div class="row"><button type="button" class="btn primary" id="ekUygula" ${T.hata ? 'disabled' : ''}>${t('Uygula')}</button><button type="button" class="btn" id="ekIptal">${t('İptal')}</button></div></div>`;
  }
  function bul(anahtar) {
    const [kat, segId, i] = anahtar.split('|');
    if (kat === 'boru') { const s = sonuc.boru.segmentler.find(x => x.seg.id === segId); return { kat, x: s.uygun.concat(s.eksik, s.uygunDegil)[+i], seg: s.seg }; }
    const L = sonuc[kat]; return { kat, x: L.uygun.concat(L.eksik, L.uygunDegil)[+i] };
  }
  // Boru: motorun doğrulanmış kütüphanesinde aynı malzeme, çap, PN ve et kalınlığı (±0,2 mm) olan kayıt
  function kutuphaneKarsiligi(h) {
    const P = g.IrriPipes; if (!P) return null;
    return (P.liste({ malzeme: h.malzeme, od: h.od }) || []).find(row => row.pn === h.pn && Math.abs(row.enMin - h.e) <= 0.2) || null;
  }
  function ozetSatirlari(r0, r1) {
    const p = r => r.pump && r.pump.need ? `${r.pump.ad || r.pump.text || ''}`.slice(0, 60) : t('gerekmez');
    return [[t('Pompa'), p(r0), p(r1)], [t('Pompa basma yüksekliği'), f2(r0.pump && r0.pump.H, 1) + ' m', f2(r1.pump && r1.pump.H, 1) + ' m'],
      [t('Yıllık enerji'), f2(r0.schedule && r0.schedule.kWh, 0) + ' kWh', f2(r1.schedule && r1.schedule.kWh, 0) + ' kWh'],
      [t('Filtre kaybı'), f2(r0.head.filter) + ' m', f2(r1.head.filter) + ' m'], [t('Vana kaybı'), f2(r0.head.valve) + ' m', f2(r1.head.valve) + ' m'],
      [t('Ana hat'), `Ø${r0.main.sel.od} PN${r0.main.sel.pn}`, `Ø${r1.main.sel.od} PN${r1.main.sel.pn}`], [t('Uyarı sayısı'), String(r0.warn.length), String(r1.warn.length)]];
  }
  function bagla(A) {
    const q = s => host.querySelector(s);
    host.querySelectorAll('[data-ekkat]').forEach(b => b.onclick = () => { S.kat = b.dataset.ekkat; S.taslak = null; ciz(A); });
    host.querySelectorAll('[data-ekle]').forEach(b => b.onclick = () => {
      const { kat, x, seg } = bul(b.dataset.ekle);
      if (x.durum !== 'uygun' && !g.confirm(t('Bu ürün teknik olarak “{d}”. Yine de malzeme listesine eklensin mi? Uygunluk durumu değişmez ve listede belirtilir.', { d: t(x.durum === 'uygun-degil' ? 'Uygun değil' : 'Verisi eksik') }))) return;
      A.kaydet('katalog kalemi', c => { (c.katalogKalemleri = c.katalogKalemleri || []).push({ urunId: x.urunId, kategori: kat, uretici: x.uretici, model: x.model, urunKodu: x.urunKodu, kaynak: (x.kaynakSayfalar || []).join(', '), durum: x.durum, miktar: kat === 'boru' && seg ? Math.round(seg.L) : 1, birim: kat === 'boru' ? 'm' : 'adet', eklenme: Date.now() }); });
      g.IrriApp.toast(t('Malzeme listesine eklendi'));
    });
    host.querySelectorAll('[data-kmiktar]').forEach(i => i.onchange = () => { const v = Number(String(i.value).replace(',', '.')); if (!(v > 0)) { g.IrriApp.toast(t('Geçerli, pozitif bir miktar girin')); return; } A.kaydet(null, c => { c.katalogKalemleri[+i.dataset.kmiktar].miktar = v; }); });
    host.querySelectorAll('[data-ksil]').forEach(b => b.onclick = () => A.kaydet('katalog kalemi silindi', c => { c.katalogKalemleri.splice(+b.dataset.ksil, 1); if (!c.katalogKalemleri.length) delete c.katalogKalemleri; }));
    host.querySelectorAll('[data-hesap]').forEach(b => b.onclick = () => {
      const { kat, x } = bul(b.dataset.hesap), c = A.cur;
      let inp = Object.assign({}, c.inp), ekS = Object.assign({}, (c.ekipmanSecimi && c.ekipmanSecimi.secim) || {}), uyari = null, katalog;
      if (kat === 'boru') {
        const row = kutuphaneKarsiligi(x.hesap);
        if (!row) { S.taslak = { hata: t('Bu borunun motorun doğrulanmış boru kütüphanesinde karşılığı yok (aynı malzeme, çap, PN ve et kalınlığı): hesaba aktarılamaz; yalnız malzeme listesine eklenebilir.') }; return ciz(A); }
        inp.boruSecimi = { ana: { malzeme: row.malzeme, od: row.od, sdr: row.sdr } };
        uyari = t('Hesap, ürünün doğrulanmış boru kütüphanesindeki karşılığıyla yapılır: {m} Ø{od} SDR{sdr} PN{pn}.', { m: row.malzeme, od: row.od, sdr: row.sdr, pn: row.pn });
      } else ekS[kat] = { urunId: x.urunId, egriId: x.egriId || null };
      const ek = g.IrriEsles.motorKatalogu(veri, ekS); katalog = g.IrriEsles.katalogBirlestir(A.temelKatalog, ek);
      const r1 = A.hesapla(inp, katalog);
      if (!r1.ok) { S.taslak = { hata: t('Taslak hesap yapılamadı: {m}', { m: r1.err || '' }) }; return ciz(A); }
      const kullanildi = kat === 'pompa' ? r1.pump && String(r1.pump.id || '').startsWith('urun:' + x.urunId) : kat === 'filtre' ? r1.filter.items.some(i => i.f.id === 'urun:' + x.urunId) : kat === 'vana' ? r1.valve.v && r1.valve.v.id === 'urun:' + x.urunId : true;
      if (!kullanildi) uyari = t('Motor seçilen ürünü bu proje koşullarında kullanmadı (ör. görev noktası veya kapasite): Uygula yapılmamalı.');
      S.taslak = { satirlar: ozetSatirlari(A.r, r1), uyari, kat, inp, ekS, ek, ad: `${x.uretici} ${x.model || x.urunKodu}`, kullanildi };
      ciz(A); const tk = host.querySelector('#ekTaslak'); if (tk && tk.scrollIntoView) tk.scrollIntoView({ block: 'nearest' });
    });
    const ip = q('#ekIptal'); if (ip) ip.onclick = () => { S.taslak = null; ciz(A); };
    const ug = q('#ekUygula'); if (ug) ug.onclick = () => {
      const T = S.taslak; if (!T || T.hata || !T.kullanildi) { g.IrriApp.toast(t('Bu taslak uygulanamaz')); return; }
      A.kaydet('ekipman seçimi öncesi', c => {
        if (T.kat === 'boru') { c.inp.boruSecimi = T.inp.boruSecimi; c.ekipmanSecimi = Object.assign({}, c.ekipmanSecimi || { secim: {}, katalog: {}, ad: {} }); c.ekipmanSecimi.boru = true; c.ekipmanSecimi.ad = Object.assign({}, c.ekipmanSecimi.ad, { boru: T.ad }); }
        else { c.ekipmanSecimi = { secim: T.ekS, katalog: T.ek, ad: Object.assign({}, (c.ekipmanSecimi && c.ekipmanSecimi.ad) || {}, { [T.kat]: T.ad }), boru: !!(c.ekipmanSecimi && c.ekipmanSecimi.boru) }; }
      });
      S.taslak = null; g.IrriApp.toast(t('Ekipman hesaba uygulandı; önceki hâl revizyon olarak saklandı'));
    };
    const kl = q('#ekKaldir'); if (kl) kl.onclick = () => { if (!g.confirm(t('Hesaba uygulanan ekipman kaldırılıp otomatik seçime dönülsün mü?'))) return; A.kaydet('ekipman seçimi kaldırma öncesi', c => { if (c.ekipmanSecimi && c.ekipmanSecimi.boru) delete c.inp.boruSecimi; delete c.ekipmanSecimi; }); };
  }
  g.IrriEkipmanUI = { render, durum: () => S };
})(typeof window !== 'undefined' ? window : globalThis);

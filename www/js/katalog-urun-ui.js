// IrriGrow — Teknik ürün veritabanı ekranı (Firma katalogları → Ürünler). Android ve masaüstü web aynı kod.
// Ürün ekleme / düzenleme / silme, teknik değer ve eğri (katalog + sayfa zorunlu), kullanıcı incelemesi, ayrı mühendislik
// doğrulaması, arama ve filtre. Değerler tahmin edilmez; PDF yalnız yüklenmiş ürün doğrulanmış sayılmaz.
(function (g) {
  'use strict';
  const U = g.IrriKatalogUrun, D = g.IrriKatalogDepo;
  const t = (s, p) => (g.IrriI18n ? g.IrriI18n.t(s, p) : (p ? s.replace(/\{(\w+)\}/g, (m, k) => (p[k] !== undefined ? p[k] : m)) : s));
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = m => { const e = g.document.querySelector('#toast'); if (!e) return; e.textContent = m; e.classList.add('on'); clearTimeout(e._h); e._h = setTimeout(() => e.classList.remove('on'), 3500); };
  const KAT = { boru: 'Boru', baglanti: 'Bağlantı elemanı', vana: 'Vana', filtre: 'Filtre', pompa: 'Pompa', damla: 'Damla sulama', diger: 'Diğer' };
  const DEG = { dis_cap: 'Dış çap', et_kalinligi: 'Et kalınlığı', ic_cap: 'İç çap', dn: 'Nominal çap (DN)', pn: 'Basınç sınıfı (PN)', basinc_min: 'En düşük çalışma basıncı', basinc_max: 'En yüksek çalışma basıncı', sdr: 'SDR',
    malzeme: 'Malzeme', baglanti: 'Bağlantı türü', pompa_tipi: 'Pompa tipi', filtre_tipi: 'Filtre tipi', standart: 'Standart', sicaklik_max: 'Sıcaklık azaltma katsayısı', debi_max: 'En büyük debi', debi_min: 'En küçük debi', debi_nominal: 'Anma debisi', kv: 'Kv / Cv',
    filtrasyon_mesh: 'Filtrasyon (mesh)', filtrasyon_mikron: 'Filtrasyon (µm)', kayip_temiz: 'Temiz filtre kaybı', kayip_kirli: 'Kirli filtre kaybı', geri_yikama_esigi: 'Geri yıkama eşiği', devir: 'Devir', cark_capi: 'Çark çapı', guc_motor: 'Motor gücü', verim_max: 'En yüksek verim' };
  const EGR = { QH: 'Q–H eğrisi', verim: 'Verim eğrisi', guc: 'Güç eğrisi', NPSHr: 'NPSHr eğrisi', kayip: 'Basınç kaybı eğrisi (temiz)' };
  const INC = { bekliyor: 'İnceleme bekliyor', 'kullanici-onayladi': 'Kullanıcı inceledi', reddedildi: 'Kullanıcı reddetti' };
  const MUH = { dogrulanmadi: 'Mühendislik doğrulaması yok', dogrulandi: 'Mühendislik doğrulandı', reddedildi: 'Mühendislikte reddedildi' };
  const sayiOku = s => { const v = Number(String(s ?? '').trim().replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) ? v : NaN; };

  let S = { ekran: 'liste', urunId: null, metin: '', kategori: '', durum: '', form: null, denetim: null };
  let host = null, V = { urunler: [], degerler: [], egriler: [] }, K = { firmalar: [], kataloglar: [] };
  const $ = s => host.querySelector(s);

  async function render(el, katalogVeri) { host = el; K = katalogVeri || K; try { V = await D.urunListele(); } catch (e) { host.innerHTML = `<div class="note err">${esc(String(e.message || e))}</div>`; return; } ciz(); }
  const katalogAdi = id => { const k = K.kataloglar.find(x => x.id === id); return k ? k.ad : t('(katalog bulunamadı)'); };
  const firmaAdi = id => { const k = K.kataloglar.find(x => x.id === id); const f = k && K.firmalar.find(x => x.id === k.firmaId); return f ? f.ad : ''; };
  const durumEtiket = u => `<span class="tag ${u.inceleme === 'kullanici-onayladi' ? '' : 'warn'}">${t(INC[u.inceleme])}</span> <span class="tag ${u.muhendislik === 'dogrulandi' ? 'ok' : u.muhendislik === 'reddedildi' ? 'bad' : 'warn'}" data-muh="${u.muhendislik}">${t(MUH[u.muhendislik])}</span>${u.ornek ? ` <span class="tag">${t('örnek')}</span>` : ''}`;

  function ciz() {
    if (!host) return;
    host.innerHTML = S.ekran === 'form' ? formHtml() : S.ekran === 'urun' ? urunHtml() : listeHtml();
    bagla();
  }

  // ---------- Liste ----------
  function filtreli() {
    const q = S.metin.toLocaleLowerCase('tr');
    return V.urunler.filter(u => (!S.kategori || u.kategori === S.kategori) && (!S.durum || (S.durum === 'dogrulandi' ? u.muhendislik === 'dogrulandi' : S.durum === 'dogrulanmadi' ? u.muhendislik !== 'dogrulandi' : u.inceleme === S.durum))
      && (!q || [u.uretici, u.marka, u.aile, u.model, u.urunKodu, katalogAdi(u.katalogId)].join(' ').toLocaleLowerCase('tr').includes(q)))
      .sort((a, b) => (a.uretici + a.model).localeCompare(b.uretici + b.model, 'tr'));
  }
  function listeHtml() {
    const L = filtreli(), gercekK = K.kataloglar.filter(k => !k.ornek);
    return `<div class="kat-arac"><input type="search" id="urAra" placeholder="${esc(t('Üretici, model, ürün kodu veya katalog ara'))}" value="${esc(S.metin)}" aria-label="${esc(t('Ara'))}">
        <button type="button" class="btn primary" id="urYeni" ${gercekK.length ? '' : 'disabled'}>${t('＋ Ürün')}</button></div>
      ${gercekK.length ? '' : `<p class="small muted">${t('Ürün eklemek için önce bir katalog PDF’i yükleyin: her ürün bir kaynak kataloğa bağlıdır.')}</p>`}
      <div class="row wrap kat-filtre"><label>${t('Kategori')}<select id="urKat"><option value="">${t('Tümü')}</option>${U.KATEGORI.map(k => `<option value="${k}" ${S.kategori === k ? 'selected' : ''}>${t(KAT[k])}</option>`).join('')}</select></label>
        <label>${t('Durum')}<select id="urDurum"><option value="">${t('Tümü')}</option><option value="dogrulandi" ${S.durum === 'dogrulandi' ? 'selected' : ''}>${t('Mühendislik doğrulandı')}</option><option value="dogrulanmadi" ${S.durum === 'dogrulanmadi' ? 'selected' : ''}>${t('Doğrulanmamış')}</option><option value="bekliyor" ${S.durum === 'bekliyor' ? 'selected' : ''}>${t('İnceleme bekliyor')}</option></select></label></div>
      <div class="note small">${t('Ekipman önerilerinde yalnız mühendislik doğrulaması geçmiş ürünler kullanılır. Kullanıcı incelemesi tek başına yeterli değildir; yalnız PDF’i yüklenmiş ürün doğrulanmış sayılmaz.')}</div>
      ${L.length ? `<div class="card kat-firmalar">${L.map(u => `<button type="button" class="kat-firma" data-urun="${esc(u.id)}"><span class="kat-av" aria-hidden="true">${esc((u.kategori[0] || '?').toUpperCase())}</span><span class="kat-fb"><b>${esc(u.uretici)} · ${esc(u.model || u.urunKodu)}</b><small>${t(KAT[u.kategori])}${u.urunKodu ? ' · ' + esc(u.urunKodu) : ''} · ${esc(katalogAdi(u.katalogId))}</small><small>${durumEtiket(u)}</small></span><span aria-hidden="true">›</span></button>`).join('')}</div>`
        : `<div class="card"><p class="muted">${V.urunler.length ? t('Filtreye uyan ürün yok.') : t('Henüz ürün kaydı yok.')}</p></div>`}`;
  }

  // ---------- Ürün formu (ekle / düzenle) ----------
  function formHtml() {
    const F = S.form, gercekK = K.kataloglar.filter(k => !k.ornek);
    return `<div class="kat-ust"><button type="button" class="btn sm" id="urIptal">✕ ${t('İptal')}</button><h2>${F.id ? t('Ürünü düzenle') : t('Ürün ekle')}</h2></div>
      <div class="f one kat-form">
        <label>${t('Kaynak katalog')} *<select id="ufKatalog">${gercekK.map(k => `<option value="${esc(k.id)}" ${F.katalogId === k.id ? 'selected' : ''}>${esc(firmaAdi(k.id))} · ${esc(k.ad)}</option>`).join('')}</select></label>
        <label>${t('Üretici')} *<input id="ufUretici" value="${esc(F.uretici)}" maxlength="120" list="ufFirmalar"><datalist id="ufFirmalar">${K.firmalar.filter(f => !f.ornek).map(f => `<option value="${esc(f.ad)}">`).join('')}</datalist></label>
        <label>${t('Marka')}<input id="ufMarka" value="${esc(F.marka)}" maxlength="120"></label>
        <label>${t('Ürün ailesi')}<input id="ufAile" value="${esc(F.aile)}" maxlength="120"></label>
        <label>${t('Model')}<input id="ufModel" value="${esc(F.model)}" maxlength="160"></label>
        <label>${t('Ürün kodu')}<input id="ufKod" value="${esc(F.urunKodu)}" maxlength="80"></label>
        <label>${t('Kategori')} *<select id="ufKategori">${U.KATEGORI.map(k => `<option value="${k}" ${F.kategori === k ? 'selected' : ''}>${t(KAT[k])}</option>`).join('')}</select></label>
        <label>${t('Not')}<textarea id="ufNot" rows="2" maxlength="1000">${esc(F.notlar)}</textarea></label>
      </div>
      <div class="row"><button type="button" class="btn primary" style="flex:1" id="urKaydet">${t('Kaydet')}</button><button type="button" class="btn" style="flex:1" id="urIptal2">${t('İptal')}</button></div>`;
  }

  // ---------- Ürün ayrıntısı ----------
  function urunHtml() {
    const u = V.urunler.find(x => x.id === S.urunId); if (!u) { S.ekran = 'liste'; return listeHtml(); }
    const ds = V.degerler.filter(d => d.urunId === u.id), es = V.egriler.filter(e => e.urunId === u.id), den = S.denetim && S.denetim.urunId === u.id ? S.denetim.sonuc : null;
    const degerSat = d => `<tr data-deger="${esc(d.id)}"><td>${t(DEG[d.ad] || d.ad)}</td><td><b>${esc(d.deger)}</b> ${esc(d.birim)}${d.siDeger != null && d.birim !== d.siBirim ? ` <small class="muted">(${+d.siDeger.toFixed(4)} ${esc(d.siBirim)})</small>` : ''}</td><td><button type="button" class="hp-link" data-sayfa="${d.kaynak.sayfa}" data-katalog="${esc(d.kaynak.katalogId)}">${t('s.')} ${d.kaynak.sayfa}</button>${d.kaynak.hamMetin ? `<br><small class="muted">“${esc(d.kaynak.hamMetin)}”</small>` : ''}</td><td>${d.inceleme === 'kullanici-onayladi' ? '✓' : d.inceleme === 'reddedildi' ? '✗' : `<button type="button" class="btn sm" data-dinc="${esc(d.id)}">${t('PDF ile aynı')}</button>`} <button type="button" class="btn sm danger" data-dsil="${esc(d.id)}" aria-label="${esc(t('Sil'))}">✕</button></td></tr>`;
    const tur = U.DEGER, adlar = Object.keys(tur);
    return `<div class="kat-ust"><button type="button" class="btn sm" id="urGeri">‹ ${t('Ürünler')}</button><h2>${esc(u.uretici)} · ${esc(u.model || u.urunKodu)}</h2></div>
      <div class="card"><div class="small">${t(KAT[u.kategori])}${u.marka ? ' · ' + esc(u.marka) : ''}${u.aile ? ' · ' + esc(u.aile) : ''}${u.urunKodu ? ' · ' + t('kod') + ' ' + esc(u.urunKodu) : ''}</div>
        <div class="small muted">${t('Kaynak katalog')}: ${esc(firmaAdi(u.katalogId))} · ${esc(katalogAdi(u.katalogId))} <button type="button" class="hp-link" data-sayfa="1" data-katalog="${esc(u.katalogId)}">${t('PDF’i aç')}</button></div>
        <div style="margin-top:6px">${durumEtiket(u)}</div>${u.dogrulama ? `<div class="small muted">${t('Doğrulayan')}: ${esc(u.dogrulama.dogrulayan)} · ${new Date(u.dogrulama.tarih).toLocaleDateString('tr-TR')}</div>` : ''}
        <div class="row wrap" style="margin-top:8px"><button type="button" class="btn sm" id="urDuzenle">${t('Düzenle')}</button><button type="button" class="btn sm danger" id="urSil">${t('Sil')}</button></div></div>
      <div class="card"><h3>${t('Teknik değerler')}</h3>${ds.length ? `<div class="scroll"><table class="small"><tr><th>${t('Özellik')}</th><th>${t('Değer')}</th><th>${t('Kaynak')}</th><th></th></tr>${ds.map(degerSat).join('')}</table></div>` : `<p class="muted small">${t('Teknik değer girilmedi. Değerler katalogdan elle girilir; tahmin edilmez.')}</p>`}
        <details class="kat-ekle"><summary>${t('＋ Teknik değer ekle')}</summary><div class="f one">
          <label>${t('Özellik')}<select id="dvAd">${adlar.map(a => `<option value="${a}">${t(DEG[a] || a)}</option>`).join('')}</select></label>
          <label>${t('Değer (katalogda yazdığı gibi)')}<input id="dvDeger"></label>
          <label>${t('Birim')}<select id="dvBirim"></select></label>
          <label>${t('Katalog sayfası')} *<input id="dvSayfa" inputmode="numeric"></label>
          <label>${t('PDF’teki metin (isteğe bağlı)')}<input id="dvHam" maxlength="500"></label>
          <button type="button" class="btn primary" id="dvKaydet">${t('Değeri kaydet')}</button></div></details></div>
      <div class="card"><h3>${t('Performans eğrileri')}</h3>${es.length ? es.map(e => `<div class="small" data-egri="${esc(e.id)}"><b>${t(EGR[e.tur])}</b> · ${e.noktalar.length} ${t('nokta')} · ${esc(e.birimX)} / ${esc(e.birimY)}${e.kosul.devir ? ' · ' + e.kosul.devir + ' d/dk' : ''}${e.kosul.carkCapi ? ' · Ø' + e.kosul.carkCapi + ' mm' : ''} · <button type="button" class="hp-link" data-sayfa="${e.kaynak.sayfa}" data-katalog="${esc(e.kaynak.katalogId)}">${t('s.')} ${e.kaynak.sayfa}</button> ${e.inceleme === 'kullanici-onayladi' ? '✓' : `<button type="button" class="btn sm" data-einc="${esc(e.id)}">${t('PDF ile aynı')}</button>`} <button type="button" class="btn sm danger" data-esil="${esc(e.id)}">✕</button></div>`).join('') : `<p class="muted small">${t('Eğri girilmedi.')}</p>`}
        <details class="kat-ekle"><summary>${t('＋ Eğri ekle')}</summary><div class="f one">
          <label>${t('Eğri türü')}<select id="evTur">${Object.keys(EGR).map(k => `<option value="${k}">${t(EGR[k])}</option>`).join('')}</select></label>
          <label>${t('Debi birimi')}<select id="evBx">${Object.keys(U.BIRIM.debi_m3h.donusum).map(b => `<option>${b}</option>`).join('')}</select></label>
          <label>${t('Değer birimi')}<select id="evBy"></select></label>
          <label>${t('Noktalar (her satıra “debi; değer”, en az 4, debi artan)')}<textarea id="evNokta" rows="5" placeholder="0; 80&#10;10; 76&#10;20; 68&#10;30; 55"></textarea></label>
          <label>${t('Devir (d/dk)')}<input id="evDevir" inputmode="numeric"></label>
          <label>${t('Çark çapı (mm)')}<input id="evCark" inputmode="decimal"></label>
          <label>${t('Katalog sayfası')} *<input id="evSayfa" inputmode="numeric"></label>
          <button type="button" class="btn primary" id="evKaydet">${t('Eğriyi kaydet')}</button></div></details></div>
      <div class="card" id="urDogrulama"><h3>${t('İnceleme ve mühendislik doğrulaması')}</h3>
        <p class="small muted">${t('Kullanıcı incelemesi: değerlerin PDF’tekiyle aynı olduğunu onaylar. Mühendislik doğrulaması ayrıdır: tamlık, tutarlılık, ürün standardı ve katalog sınırları denetlenir; yalnız denetim geçerse ve doğrulayan kişi yazılırsa ürün önerilerde kullanılır.')}</p>
        <div class="row wrap"><button type="button" class="btn sm" id="urIncele">${t('Ürünü inceledim (PDF ile aynı)')}</button><button type="button" class="btn sm" id="urDenetle">${t('Mühendislik denetimini çalıştır')}</button></div>
        ${den ? `<ul class="small" id="urKurallar">${den.kurallar.length ? den.kurallar.map(k => `<li class="${k.durum === 'kaldi' ? 'bad' : 'warn'}">${esc(k.grup)}: ${esc(k.mesaj)}</li>`).join('') : `<li>${t('Bütün kurallar geçti.')}</li>`}</ul>
          ${den.gecti ? `<div class="row wrap"><input id="urDogrulayan" placeholder="${esc(t('Doğrulayan kişi (ad soyad)'))}" maxlength="120"><button type="button" class="btn sm primary" id="urDogrula">${t('Mühendislik doğrulamasını kaydet')}</button></div>` : `<p class="small bad">${t('Denetim geçmedi: ürün doğrulanamaz ve önerilerde kullanılmaz.')}</p>`}` : ''}
        ${u.muhendislik !== 'dogrulanmadi' ? `<button type="button" class="btn sm" id="urDogrulamaKaldir">${t('Doğrulamayı kaldır')}</button>` : ''}</div>`;
  }

  function degerGirdisi(ad) { const sec = U.METIN_SECENEK[ad], el = $('#dvDeger'); if (!el) return; const yeni = sec ? `<select id="dvDeger">${sec.map(x => `<option>${x}</option>`).join('')}</select>` : '<input id="dvDeger">'; if ((el.tagName === 'SELECT') !== !!sec) el.outerHTML = yeni; }
  function birimSecenek(sel, ad) { const tur = U.DEGER[ad], B = U.BIRIM[tur]; sel.innerHTML = B && B.donusum ? Object.keys(B.donusum).map(b => `<option>${esc(b)}</option>`).join('') : `<option value="">—</option>`; }
  function egriBirim() { const T = U.EGRI_TUR[$('#evTur').value]; $('#evBy').innerHTML = Object.keys(U.BIRIM[T[1]].donusum).map(b => `<option>${esc(b)}</option>`).join(''); }
  // Değer veya eğri değişince ürün doğrulaması geçersiz olur (değerler denetlenmeden önerilere girmesin)
  async function dogrulamaSifirla(u) { if (u.muhendislik !== 'dogrulanmadi') await D.urunKaydet(Object.assign({}, u, { muhendislik: 'dogrulanmadi', dogrulama: null, guncelleme: new Date().toISOString() })); }
  async function pdfAc(katalogId, sayfa) {
    const k = K.kataloglar.find(x => x.id === katalogId); if (!k || !k.dosya || k.dosya.bekliyor) return toast(t('Katalog PDF’i bu cihazda yok'));
    try {
      if (D.yerel()) { const op = g.Capacitor.Plugins.FileOpener; if (op && op.open) await op.open({ filePath: await D.dosyaYerelUri(k.dosya), contentType: 'application/pdf' }); toast(t('PDF açıldı: ilgili sayfa {s}', { s: sayfa })); }
      else { const u = await D.dosyaUrl(k.dosya); g.open(u + '#page=' + sayfa, '_blank'); setTimeout(() => g.URL.revokeObjectURL(u), 60000); }
    } catch (e) { toast(t('PDF açılamadı: {m}', { m: String(e.message || e) })); }
  }

  function bagla() {
    const on = (s, ev, f) => { const e = $(s); if (e) e[ev] = f; };
    on('#urAra', 'oninput', () => { S.metin = $('#urAra').value; const p = $('#urAra').selectionStart; ciz(); const a = $('#urAra'); a.focus(); try { a.setSelectionRange(p, p); } catch (e) { /* */ } });
    on('#urKat', 'onchange', () => { S.kategori = $('#urKat').value; ciz(); });
    on('#urDurum', 'onchange', () => { S.durum = $('#urDurum').value; ciz(); });
    on('#urYeni', 'onclick', () => { S.form = { id: null, katalogId: (K.kataloglar.find(k => !k.ornek) || {}).id, uretici: '', marka: '', aile: '', model: '', urunKodu: '', kategori: 'boru', notlar: '' }; S.ekran = 'form'; ciz(); });
    host.querySelectorAll('[data-urun]').forEach(b => b.onclick = () => { S.urunId = b.dataset.urun; S.ekran = 'urun'; S.denetim = null; ciz(); });
    for (const id of ['#urIptal', '#urIptal2']) on(id, 'onclick', () => { S.ekran = S.form && S.form.id ? 'urun' : 'liste'; S.form = null; ciz(); });
    on('#urGeri', 'onclick', () => { S.ekran = 'liste'; ciz(); });
    on('#urKaydet', 'onclick', async () => {
      const F = S.form, o = { katalogId: $('#ufKatalog').value, uretici: $('#ufUretici').value, marka: $('#ufMarka').value, aile: $('#ufAile').value, model: $('#ufModel').value, urunKodu: $('#ufKod').value, kategori: $('#ufKategori').value, notlar: $('#ufNot').value };
      const k = K.kataloglar.find(x => x.id === o.katalogId);
      let u = F.id ? Object.assign({}, V.urunler.find(x => x.id === F.id)) : U.yeniUrun(Object.assign({}, o, { katalogDosyaSha: k && k.dosya ? k.dosya.sha256 : null }));
      if (F.id) { const y = U.yeniUrun(o); for (const a of ['katalogId', 'uretici', 'marka', 'aile', 'model', 'urunKodu', 'kategori', 'notlar']) u[a] = y[a]; u.guncelleme = new Date().toISOString(); if (u.muhendislik !== 'dogrulanmadi') { u.muhendislik = 'dogrulanmadi'; u.dogrulama = null; } }
      const h = U.urunDogrula(u); if (h.length) return toast(h.join('; '));
      try { await D.urunKaydet(u); S.urunId = u.id; S.form = null; S.ekran = 'urun'; toast(t('Ürün kaydedildi')); await render(host, K); } catch (e) { toast(t('Kaydedilemedi: {m}', { m: String(e.message || e) })); }
    });
    const u = V.urunler.find(x => x.id === S.urunId);
    on('#urDuzenle', 'onclick', () => { S.form = Object.assign({}, u); S.ekran = 'form'; ciz(); });
    on('#urSil', 'onclick', async () => { if (!g.confirm(t('“{a}” ürünü, teknik değerleri ve eğrileri silinsin mi? Katalog PDF’ine dokunulmaz.', { a: u.uretici + ' ' + (u.model || u.urunKodu) }))) return; await D.urunSil(u.id); S.ekran = 'liste'; toast(t('Ürün silindi')); await render(host, K); });
    const dvAd = $('#dvAd'); if (dvAd) { birimSecenek($('#dvBirim'), dvAd.value); degerGirdisi(dvAd.value); dvAd.onchange = () => { birimSecenek($('#dvBirim'), dvAd.value); degerGirdisi(dvAd.value); }; }
    on('#dvKaydet', 'onclick', async () => {
      const ad = $('#dvAd').value, metin = U.BIRIM[U.DEGER[ad]].donusum == null, ham = String($('#dvDeger').value).trim();
      const r = U.yeniDeger({ urunId: u.id, ad, deger: metin ? ham : sayiOku(ham), birim: $('#dvBirim').value, kaynak: { katalogId: u.katalogId, sayfa: parseInt($('#dvSayfa').value, 10), hamMetin: $('#dvHam').value, yontem: 'elle' } });
      if (r.hata) return toast(r.hata.join('; '));
      await D.degerKaydet(r.deger); await dogrulamaSifirla(u); toast(t('Değer kaydedildi; ürün yeniden doğrulanmalı')); await render(host, K);
    });
    host.querySelectorAll('[data-dinc]').forEach(b => b.onclick = async () => { const d = V.degerler.find(x => x.id === b.dataset.dinc); await D.degerKaydet(U.incele(d, 'kullanici-onayladi')); await render(host, K); });
    host.querySelectorAll('[data-dsil]').forEach(b => b.onclick = async () => { await D.degerSil(b.dataset.dsil); await dogrulamaSifirla(u); await render(host, K); });
    const evTur = $('#evTur'); if (evTur) { egriBirim(); evTur.onchange = egriBirim; }
    on('#evKaydet', 'onclick', async () => {
      const n = $('#evNokta').value.split(/\n+/).map(s => s.trim()).filter(Boolean).map(s => s.split(/[;\t]+/).map(sayiOku));
      const kosul = {}; const dv = sayiOku($('#evDevir').value), cc = sayiOku($('#evCark').value); if (Number.isFinite(dv)) kosul.devir = dv; if (Number.isFinite(cc)) kosul.carkCapi = cc;
      const r = U.yeniEgri({ urunId: u.id, tur: $('#evTur').value, birimX: $('#evBx').value, birimY: $('#evBy').value, noktalar: n, kosul, kaynak: { katalogId: u.katalogId, sayfa: parseInt($('#evSayfa').value, 10), yontem: 'goruntu-elle' } });
      if (r.hata) return toast(r.hata.join('; '));
      await D.egriKaydet(r.egri); await dogrulamaSifirla(u); toast(t('Eğri kaydedildi; ürün yeniden doğrulanmalı')); await render(host, K);
    });
    host.querySelectorAll('[data-einc]').forEach(b => b.onclick = async () => { const e = V.egriler.find(x => x.id === b.dataset.einc); await D.egriKaydet(U.incele(e, 'kullanici-onayladi')); await render(host, K); });
    host.querySelectorAll('[data-esil]').forEach(b => b.onclick = async () => { await D.egriSil(b.dataset.esil); await dogrulamaSifirla(u); await render(host, K); });
    host.querySelectorAll('[data-sayfa]').forEach(b => b.onclick = () => pdfAc(b.dataset.katalog, +b.dataset.sayfa));
    on('#urIncele', 'onclick', async () => { await D.urunKaydet(U.incele(u, 'kullanici-onayladi')); toast(t('Kullanıcı incelemesi kaydedildi (mühendislik doğrulaması değildir)')); await render(host, K); });
    on('#urDenetle', 'onclick', () => { S.denetim = { urunId: u.id, sonuc: U.muhendislikDenetle(u, V.degerler.filter(d => d.urunId === u.id), V.egriler.filter(e => e.urunId === u.id)) }; ciz(); });
    on('#urDogrula', 'onclick', async () => {
      try { await D.urunKaydet(U.muhendislikOnayla(u, S.denetim.sonuc, $('#urDogrulayan').value)); S.denetim = null; toast(t('Mühendislik doğrulaması kaydedildi; ürün önerilere dahil')); await render(host, K); }
      catch (e) { toast(String(e.message || e)); }
    });
    on('#urDogrulamaKaldir', 'onclick', async () => { await dogrulamaSifirla(u); await render(host, K); });
  }

  g.IrriKatalogUrunUI = { render, durum: () => S };
})(typeof window !== 'undefined' ? window : globalThis);

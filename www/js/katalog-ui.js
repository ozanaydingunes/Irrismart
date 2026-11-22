// IrriGrow — Firma Malzeme Katalogları ekranı (aşama 1: kayıt, PDF yükleme, yeniden açma, güncelleme/sürüm, silme, bilgi yedeği).
// PDF görüntüleyici (pdf.js) ve arama sonraki aşamadadır; bu aşamada PDF cihazın kendi görüntüleyicisiyle açılır.
// Katalog verisi hesap motoruna, boru kütüphanesine veya proje malzeme listesine aktarılmaz.
(function (g) {
  'use strict';
  const M = g.IrriKatalogModel, D = g.IrriKatalogDepo;
  const t = (s, p) => (g.IrriI18n ? g.IrriI18n.t(s, p) : (p ? s.replace(/\{(\w+)\}/g, (m, k) => (p[k] !== undefined ? p[k] : m)) : s));
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = s => g.document.querySelector(s);
  const loc = () => (g.IrriI18n && g.IrriI18n.locale) || 'tr-TR';
  const boyut = b => b == null ? '—' : b < 1048576 ? (b / 1024).toLocaleString(loc(), { maximumFractionDigits: 0 }) + ' KB' : (b / 1048576).toLocaleString(loc(), { maximumFractionDigits: 1 }) + ' MB';
  const tarihYaz = s => { if (!s) return t('tarih bilinmiyor'); const p = s.split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : p.length === 2 ? `${p[1]}.${p[0]}` : p[0]; };
  const GRUP = { boru: 'Boru', damla: 'Damla sulama', vana: 'Vana', ekparca: 'Ek parça', pompa: 'Pompa', filtre: 'Filtre', gubre: 'Gübreleme', otomasyon: 'Otomasyon', diger: 'Diğer' };
  const TUR = { urun: 'Ürün kataloğu', fiyat: 'Fiyat listesi', teknik: 'Teknik föy', sertifika: 'Sertifika', diger: 'Diğer belge' };
  const KAYNAK = { 'resmi-site': 'Resmî site', bayi: 'Bayi', 'firma-temsilcisi': 'Firma temsilcisi', diger: 'Diğer' };
  const toast = m => { const e = $('#toast'); if (!e) return; e.textContent = m; e.classList.add('on'); clearTimeout(e._h); e._h = setTimeout(() => e.classList.remove('on'), 3500); };

  let S = { ekran: 'liste', firmaId: null, metin: '', grup: null, form: null, veri: { firmalar: [], kataloglar: [] }, hata: null, mesgul: null };

  async function yukle() { try { S.veri = await D.listele(); S.hata = null; } catch (e) { S.hata = String(e.message || e); } }
  async function render() { await yukle(); ciz(); }
  const kok = () => $('#katalog');

  function seg() { return `<div class="seg" id="katSeg"><button type="button" data-malz="proje">${t('Proje malzeme listesi')}</button><button type="button" class="on" data-malz="katalog">${t('Firma katalogları')}</button></div>`; }
  function ciz() {
    const k = kok(); if (!k) return;
    if (S.hata) { k.innerHTML = seg() + `<div class="note err">${t('Katalog deposu açılamadı:')} ${esc(S.hata)}</div>`; bagla(); return; }
    k.innerHTML = seg() + (S.ekran === 'form' ? formHtml() : S.ekran === 'firma' ? firmaHtml() : listeHtml());
    bagla();
  }

  // ---------- Liste: firmalar ----------
  function listeHtml() {
    const { firmalar, kataloglar } = S.veri;
    const gercek = M.filtrele(kataloglar, firmalar, { metin: S.metin, grup: S.grup, ornek: false }), ornek = kataloglar.filter(x => x.ornek);
    const fKart = f => { const ks = gercek.filter(x => x.firmaId === f.id); if (!ks.length) return '';
      const son = ks.map(x => x.belgeTarihi).filter(Boolean).sort().pop(), top = ks.reduce((a, x) => a + (x.dosya && x.dosya.boyut || 0) + (x.oncekiSurumler || []).reduce((b, s) => b + (s.dosya.boyut || 0), 0), 0);
      return `<button type="button" class="kat-firma" data-firma="${esc(f.id)}"><span class="kat-av" aria-hidden="true">${esc((f.ad[0] || '?').toLocaleUpperCase('tr'))}</span><span class="kat-fb"><b>${esc(f.ad)}</b><small>${t('{n} katalog', { n: ks.length })} · ${boyut(top)}${son ? ' · ' + t('son belge: {d}', { d: tarihYaz(son) }) : ''}</small></span>${ks.some(x => x.dosya && x.dosya.bekliyor) ? `<span class="tag warn">${t('PDF bekleniyor')}</span>` : ''}<span aria-hidden="true">›</span></button>`; };
    const liste = firmalar.filter(f => !f.ornek).sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(fKart).join('');
    return `<div class="kat-arac"><input type="search" id="katAra" placeholder="${esc(t('Firma, katalog veya not ara'))}" value="${esc(S.metin)}" aria-label="${esc(t('Ara'))}">
        <label class="btn primary kat-yukle">${t('＋ PDF yükle')}<input type="file" id="katDosya" accept="application/pdf,.pdf" hidden></label></div>
      <div class="kat-cipler" role="group" aria-label="${esc(t('Ürün grubu'))}"><button type="button" class="chip ${S.grup ? '' : 'on'}" data-grup="">${t('Tümü')}</button>${M.URUN_GRUPLARI.map(x => `<button type="button" class="chip ${S.grup === x ? 'on' : ''}" data-grup="${x}">${t(GRUP[x])}</button>`).join('')}</div>
      ${liste ? `<div class="card kat-firmalar">${liste}</div>` : `<div class="card"><p class="muted">${kataloglar.some(x => !x.ornek) ? t('Aramaya uyan katalog yok.') : t('Henüz katalog yüklenmedi. Elinizdeki üretici PDF kataloglarını “＋ PDF yükle” ile ekleyin; dosyalar yalnız bu cihazda saklanır.')}</p></div>`}
      ${ornek.length ? `<div class="card kat-ornek"><h3>${t('Örnek veriler')} <span class="tag">${t('örnek')}</span></h3><p class="small muted">${t('Bu kayıtlar deneme amaçlıdır; yüklediğiniz kataloglarla karıştırılmaz ve yedeğe alınmaz.')}</p>${ornek.map(x => `<div class="small">${esc(x.ad)}</div>`).join('')}</div>` : ''}
      <div class="note kat-not">${t('Katalog bilgileri bilgi amaçlıdır. Hidrolik hesap, programın doğrulanmış boru kütüphanesini kullanır; katalogdaki değerler hesaba aktarılmaz.')}</div>
      <div class="card" id="katDepo"><h3>${t('Depolama ve yedek')}</h3><div id="katAlan" class="small muted">…</div>
        <p class="small">${D.yerel() ? t('PDF dosyaları uygulamanın özel alanında saklanır. Uygulamayı kaldırmak veya uygulama verilerini temizlemek katalogları siler.') : t('PDF dosyaları bu tarayıcının depolamasında saklanır. Tarayıcı verilerini temizlemek veya gizli pencere kullanmak katalogları siler.')}</p>
        <p class="small"><b>${t('Bilgi yedeği PDF dosyalarını içermez.')}</b> ${t('Yedek yalnız katalog adı, firma, tarih, ürün grubu, kaynak ve SHA-256 bilgisini içerir. Geri yüklemeden sonra PDF dosyalarını yeniden seçmeniz gerekir; dosyalar SHA-256 ile eşleştirilir.')}</p>
        <div class="row wrap"><button type="button" class="btn sm" id="katYedek">${t('Bilgileri dışa aktar (JSON)')}</button><label class="btn sm">${t('Bilgi yedeğini geri yükle')}<input type="file" id="katGeri" accept=".json,application/json" hidden></label>${D.yerel() ? '' : `<button type="button" class="btn sm" id="katKalici">${t('Kalıcı depolama iste')}</button>`}</div></div>`;
  }

  // ---------- Firma: kataloglar ----------
  function yasEtiketi(k) {
    if (k.belgeTuru !== 'fiyat') return '';
    if (!k.belgeTarihi) return `<span class="tag warn">${t('Fiyat listesi · tarih bilinmiyor')}</span>`;
    const g2 = M.yasGun(k.belgeTarihi);
    const kdv = k.fiyatListesi && k.fiyatListesi.kdvDahil === true ? t('KDV dahil') : k.fiyatListesi && k.fiyatListesi.kdvDahil === false ? t('KDV hariç') : t('KDV durumu belirtilmedi');
    return `<span class="tag ${g2 > 90 ? 'warn' : ''}">${t('Fiyat listesi · {d} · {g} gün önce', { d: tarihYaz(k.belgeTarihi), g: Math.max(0, g2) })} · ${kdv}${k.fiyatListesi && k.fiyatListesi.paraBirimi ? ' · ' + k.fiyatListesi.paraBirimi : ''}</span>`;
  }
  function firmaHtml() {
    const f = S.veri.firmalar.find(x => x.id === S.firmaId); if (!f) { S.ekran = 'liste'; return listeHtml(); }
    const ks = S.veri.kataloglar.filter(x => x.firmaId === f.id).sort((a, b) => String(b.belgeTarihi || '').localeCompare(String(a.belgeTarihi || '')));
    return `<div class="kat-ust"><button type="button" class="btn sm" id="katGeri0">‹ ${t('Firmalar')}</button><h2>${esc(f.ad)}</h2><label class="btn sm primary">${t('＋ Katalog')}<input type="file" id="katDosya" accept="application/pdf,.pdf" hidden></label></div>
      ${ks.map(k => `<div class="card kat-doc" data-kat="${esc(k.id)}"><b>${esc(k.ad)}</b>${k.ornek ? ` <span class="tag">${t('örnek')}</span>` : ''}
        <div class="small muted">${t(TUR[k.belgeTuru] || 'Diğer belge')} · ${t('Belge tarihi')}: ${tarihYaz(k.belgeTarihi)}${k.dosya && k.dosya.sayfa ? ' · ' + t('{n} sayfa', { n: k.dosya.sayfa }) : ''} · ${boyut(k.dosya && k.dosya.boyut)}</div>
        ${k.urunGruplari.length ? `<div class="small muted">${t('Ürün grubu')}: ${k.urunGruplari.map(x => t(GRUP[x])).join(', ')}</div>` : ''}
        <div class="small muted">${t('Kaynak')}: ${t(KAYNAK[k.kaynak.tur] || 'Diğer')}${k.kaynak.aciklama ? ' · ' + esc(k.kaynak.aciklama) : ''} · ${t('yüklendi {d}', { d: new Date(k.yuklenme).toLocaleDateString(loc()) })}</div>
        ${k.not ? `<div class="small">${esc(k.not)}</div>` : ''}<div>${yasEtiketi(k)}</div>
        ${k.dosya && k.dosya.bekliyor ? `<div class="note">${t('PDF bekleniyor: bu kayıt bilgi yedeğinden geri yüklendi. Aynı PDF dosyasını seçin (SHA-256 ile eşleştirilir).')} <label class="btn sm">${t('PDF seç')}<input type="file" data-bagla="${esc(k.id)}" accept="application/pdf,.pdf" hidden></label></div>`
          : `<div class="row wrap kat-islem"><button type="button" class="btn sm primary" data-ac="${esc(k.id)}">${t('Aç')}</button><button type="button" class="btn sm" data-duzenle="${esc(k.id)}">${t('Düzenle')}</button><label class="btn sm">${t('Güncelle (yeni PDF)')}<input type="file" data-guncelle="${esc(k.id)}" accept="application/pdf,.pdf" hidden></label><button type="button" class="btn sm danger" data-sil="${esc(k.id)}">${t('Sil')}</button></div>`}
        ${(k.oncekiSurumler || []).length ? `<details class="kat-surum"><summary>${t('Sürüm geçmişi ({n})', { n: k.oncekiSurumler.length })}</summary>${k.oncekiSurumler.map(s => `<div class="row wrap small"><span>${tarihYaz(s.belgeTarihi)} · ${boyut(s.dosya.boyut)} · ${t('değiştirildi {d}', { d: new Date(s.degistirilme).toLocaleDateString(loc()) })}</span><button type="button" class="btn sm" data-surumac="${esc(k.id)}|${esc(s.dosya.anahtar)}">${t('Aç')}</button><button type="button" class="btn sm danger" data-surumsil="${esc(k.id)}|${esc(s.dosya.anahtar)}">${t('Sil')}</button></div>`).join('')}</details>` : ''}
      </div>`).join('') || `<p class="muted">${t('Bu firmada katalog yok.')}</p>`}`;
  }

  // ---------- Form: yeni katalog / düzenleme ----------
  function formHtml() {
    const F = S.form, d = F.dosya;
    const firmaAdlari = S.veri.firmalar.filter(f => !f.ornek).map(f => `<option value="${esc(f.ad)}">`).join('');
    return `<div class="kat-ust"><button type="button" class="btn sm" id="katIptal">✕ ${t('İptal')}</button><h2>${F.id ? t('Katalog bilgilerini düzenle') : t('Katalog ekle')}</h2></div>
      <div class="card"><b>📄 ${esc(d ? d.ad : F.dosyaAd || '')}</b><div class="small muted">${d ? boyut(d.boyut) : F.dosyaBoyut ? boyut(F.dosyaBoyut) : ''}${d && d.sha256 ? ' · SHA-256 ' + d.sha256.slice(0, 12) + '…' : ''}</div>
        ${S.mesgul ? `<div class="kat-ilerleme" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(S.mesgul.p * 100)}"><span style="width:${Math.round(S.mesgul.p * 100)}%"></span></div><div class="small">${esc(S.mesgul.m)}</div>` : ''}</div>
      <div class="f one kat-form">
        <label>${t('Katalog adı')} *<input id="kfAd" value="${esc(F.ad)}" maxlength="200" required></label>
        <label>${t('Firma')} * <small class="muted">${t('listeden seçin veya yeni yazın')}</small><input id="kfFirma" list="kfFirmaListe" value="${esc(F.firma)}" maxlength="120" required><datalist id="kfFirmaListe">${firmaAdlari}</datalist></label>
        <label>${t('Belge türü')}<select id="kfTur">${M.BELGE_TURLERI.map(x => `<option value="${x}" ${F.belgeTuru === x ? 'selected' : ''}>${t(TUR[x])}</option>`).join('')}</select></label>
        <label>${t('Belge tarihi')} <small class="muted">${t('ör. 2026, 10.2026 veya 20.10.2026; bilinmiyorsa boş bırakın')}</small><input id="kfTarih" value="${esc(F.tarih)}" inputmode="numeric" maxlength="10"></label>
        <fieldset class="kat-gruplar"><legend>${t('Ürün grupları')}</legend>${M.URUN_GRUPLARI.map(x => `<label class="kat-cb"><input type="checkbox" data-kfgrup="${x}" ${F.urunGruplari.includes(x) ? 'checked' : ''}> ${t(GRUP[x])}</label>`).join('')}</fieldset>
        <label>${t('Kaynak')}<select id="kfKaynak">${M.KAYNAK_TURLERI.map(x => `<option value="${x}" ${F.kaynakTur === x ? 'selected' : ''}>${t(KAYNAK[x])}</option>`).join('')}</select></label>
        <label>${t('Kaynak açıklaması')} <small class="muted">${t('ör. web adresi veya bayi adı')}</small><input id="kfKaynakAc" value="${esc(F.kaynakAc)}" maxlength="300"></label>
        <div id="kfFiyat" ${F.belgeTuru === 'fiyat' ? '' : 'hidden'}><label>${t('KDV')}<select id="kfKdv"><option value="">${t('belirtilmedi')}</option><option value="haric" ${F.kdv === 'haric' ? 'selected' : ''}>${t('KDV hariç')}</option><option value="dahil" ${F.kdv === 'dahil' ? 'selected' : ''}>${t('KDV dahil')}</option></select></label>
          <label>${t('Para birimi')}<select id="kfPara"><option value="">${t('belirtilmedi')}</option>${M.PARA.map(x => `<option ${F.para === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
        <label>${t('Not')}<textarea id="kfNot" maxlength="1000" rows="2">${esc(F.not)}</textarea></label>
      </div>
      <div class="note">${t('Dosya yalnız bu cihazda saklanır; internete veya GitHub’a gönderilmez.')}</div>
      <div class="row"><button type="button" class="btn primary" style="flex:1" id="katKaydet" ${S.mesgul ? 'disabled' : ''}>${t('Kaydet')}</button><button type="button" class="btn" style="flex:1" id="katIptal2">${t('İptal')}</button></div>`;
  }
  function formOku() {
    const F = S.form; F.ad = $('#kfAd').value; F.firma = $('#kfFirma').value; F.belgeTuru = $('#kfTur').value; F.tarih = $('#kfTarih').value; F.kaynakTur = $('#kfKaynak').value; F.kaynakAc = $('#kfKaynakAc').value; F.not = $('#kfNot').value;
    F.urunGruplari = [...g.document.querySelectorAll('[data-kfgrup]')].filter(x => x.checked).map(x => x.dataset.kfgrup); F.kdv = $('#kfKdv').value; F.para = $('#kfPara').value;
  }
  const bosForm = dosya => ({ id: null, dosyaNesne: dosya, dosyaAd: dosya.name, dosyaBoyut: dosya.size, dosya: null, ad: String(dosya.name || '').replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim(), firma: S.firmaId ? (S.veri.firmalar.find(f => f.id === S.firmaId) || {}).ad || '' : '', belgeTuru: 'urun', tarih: '', urunGruplari: [], kaynakTur: 'diger', kaynakAc: '', not: '', kdv: '', para: '' });
  function duzenleForm(k) { const f = S.veri.firmalar.find(x => x.id === k.firmaId) || {}; return { id: k.id, dosya: k.dosya, ad: k.ad, firma: f.ad || '', belgeTuru: k.belgeTuru, tarih: k.belgeTarihi ? tarihYaz(k.belgeTarihi) : '', urunGruplari: k.urunGruplari.slice(), kaynakTur: k.kaynak.tur, kaynakAc: k.kaynak.aciklama || '', not: k.not || '', kdv: k.fiyatListesi && k.fiyatListesi.kdvDahil === true ? 'dahil' : k.fiyatListesi && k.fiyatListesi.kdvDahil === false ? 'haric' : '', para: k.fiyatListesi && k.fiyatListesi.paraBirimi || '' }; }

  async function kaydet() {
    formOku(); const F = S.form;
    if (!F.ad.trim()) return toast(t('Katalog adı gerekli'));
    if (!F.firma.trim()) return toast(t('Firma gerekli'));
    const tarih = M.tarihOku(F.tarih); if (tarih === undefined) return toast(t('Belge tarihi geçersiz (ör. 2026, 10.2026 veya 20.10.2026)'));
    let firma = M.firmaBul(S.veri.firmalar.filter(f => !f.ornek), F.firma), yeniDosya = null;
    try {
      if (!F.id) {
        S.mesgul = { p: 0, m: t('Dosya denetleniyor ve kaydediliyor…') }; ciz();
        yeniDosya = await D.dosyaYaz(F.dosyaNesne, p => { S.mesgul = { p, m: p < 1 ? t('Dosya kaydediliyor… %{p}', { p: Math.round(p * 100) }) : t('Doğrulanıyor…') }; const b = g.document.querySelector('.kat-ilerleme span'); if (b) b.style.width = Math.round(p * 100) + '%'; });
        const ayni = M.ayniDosya(S.veri.kataloglar.filter(x => !x.ornek), yeniDosya.sha256);
        if (ayni && !g.confirm(t('Bu PDF zaten kayıtlı: “{a}”. Yine de ayrı katalog olarak eklensin mi?', { a: ayni.ad }))) { await D.dosyaSil(yeniDosya); S.mesgul = null; S.ekran = 'firma'; S.firmaId = ayni.firmaId; return render(); }
      }
      if (!firma) { firma = M.yeniFirma(F.firma); await D.firmaKaydet(firma); }
      const ortak = { ad: F.ad, firmaId: firma.id, belgeTuru: F.belgeTuru, belgeTarihi: tarih, urunGruplari: F.urunGruplari, kaynak: { tur: F.kaynakTur, aciklama: F.kaynakAc }, not: F.not, kdvDahil: F.kdv === 'dahil' ? true : F.kdv === 'haric' ? false : null, paraBirimi: F.para || null };
      let k;
      if (F.id) { const eski = S.veri.kataloglar.find(x => x.id === F.id); const y = M.yeniKatalog(Object.assign({}, ortak, { dosya: eski.dosya, ornek: eski.ornek })); k = Object.assign({}, eski, { ad: y.ad, firmaId: y.firmaId, belgeTuru: y.belgeTuru, belgeTarihi: y.belgeTarihi, urunGruplari: y.urunGruplari, kaynak: y.kaynak, not: y.not, fiyatListesi: y.fiyatListesi, guncelleme: new Date().toISOString() }); }
      else k = M.yeniKatalog(Object.assign({}, ortak, { dosya: yeniDosya }));
      await D.katalogKaydet(k);
      // Eski firma boş kaldıysa (düzenlemede firma değişti) silinir
      if (F.id) { await yukle(); for (const f of S.veri.firmalar) if (!f.ornek && !S.veri.kataloglar.some(x => x.firmaId === f.id)) await D.firmaSil(f.id); }
      S.mesgul = null; S.form = null; S.ekran = 'firma'; S.firmaId = firma.id; toast(t('Katalog kaydedildi')); await D.kalicilikIste(); render();
    } catch (e) {
      if (yeniDosya) { try { await D.dosyaSil(yeniDosya); } catch (e2) { /* */ } }
      S.mesgul = null; ciz(); toast(t('Kaydedilemedi: {m}', { m: String(e.message || e) }));
    }
  }

  async function ac(dosya) {
    try {
      if (D.yerel()) {
        const op = g.Capacitor.Plugins.FileOpener;
        if (op && op.open) await op.open({ filePath: await D.dosyaYerelUri(dosya), contentType: 'application/pdf' });
        else g.open(await D.dosyaUrl(dosya), '_blank');
      } else {
        const u = await D.dosyaUrl(dosya), w = g.open(u, '_blank');
        if (!w) { const a = g.document.createElement('a'); a.href = u; a.download = dosya.ad || 'katalog.pdf'; g.document.body.appendChild(a); a.click(); a.remove(); }
        setTimeout(() => g.URL.revokeObjectURL(u), 60000);
      }
    } catch (e) { toast(t('PDF açılamadı: {m}', { m: String(e.message || e) })); }
  }

  async function guncelle(k, dosya) {
    if (!g.confirm(t('“{a}” yeni PDF ile güncellensin mi? Eski sürüm sürüm geçmişinde saklanır.', { a: k.ad }))) return;
    toast(t('Dosya kaydediliyor…'));
    let yd = null;
    try { yd = await D.dosyaYaz(dosya); if (yd.sha256 === k.dosya.sha256) { await D.dosyaSil(yd); return toast(t('Bu PDF mevcut sürümle aynı; değişiklik yapılmadı')); }
      await D.katalogKaydet(M.surumEkle(k, yd)); toast(t('Katalog güncellendi; eski sürüm saklandı')); render(); }
    catch (e) { if (yd) { try { await D.dosyaSil(yd); } catch (e2) { /* */ } } toast(t('Kaydedilemedi: {m}', { m: String(e.message || e) })); }
  }
  // Bilgi yedeğinden gelen kayda PDF bağlama: yalnız SHA-256 tutarsa
  async function pdfBagla(k, dosya) {
    let yd = null;
    try { yd = await D.dosyaYaz(dosya); if (yd.sha256 !== k.dosya.sha256) { await D.dosyaSil(yd); return toast(t('Seçilen PDF bu kayıtla eşleşmiyor (SHA-256 farklı)')); }
      await D.katalogKaydet(Object.assign({}, k, { dosya: yd })); toast(t('PDF eşleşti ve kaydedildi')); render(); }
    catch (e) { if (yd) { try { await D.dosyaSil(yd); } catch (e2) { /* */ } } toast(t('Kaydedilemedi: {m}', { m: String(e.message || e) })); }
  }

  function yedekIndir() {
    const y = M.yedekOlustur(S.veri.firmalar, S.veri.kataloglar), metin = JSON.stringify(y, null, 1), ad = `IrriGrow_katalog_bilgileri_${new Date().toISOString().slice(0, 10)}.json`;
    if (D.yerel() && g.IrriReport && g.IrriReport.saveFile) { g.IrriReport.saveFile('IrriGrow_katalog_bilgileri', 'json', g.btoa(unescape(encodeURIComponent(metin))), 'application/json'); return; }
    const a = g.document.createElement('a'); a.href = g.URL.createObjectURL(new Blob([metin], { type: 'application/json' })); a.download = ad; g.document.body.appendChild(a); a.click(); setTimeout(() => { g.URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast(t('Bilgi yedeği indirildi ({n} katalog; PDF dosyaları dahil değil)', { n: y.kataloglar.length }));
  }
  async function yedekYukle(dosya) {
    const r = M.yedekOku(await dosya.text(), S.veri.firmalar, S.veri.kataloglar);
    if (r.hata) return toast(t(r.hata));
    for (const f of r.firmalar) await D.firmaKaydet(f);
    for (const k of r.kataloglar) await D.katalogKaydet(k);
    toast(t('{n} katalog bilgisi geri yüklendi; PDF dosyalarını yeniden seçin. Atlanan: {m}', { n: r.kataloglar.length, m: r.atlanan.length })); render();
  }

  async function alanCiz() {
    const e = $('#katAlan'); if (!e) return; const a = await D.alan(), n = S.veri.kataloglar.filter(x => !x.ornek), top = n.reduce((s, k) => s + (k.dosya && k.dosya.boyut || 0) + (k.oncekiSurumler || []).reduce((b, v) => b + (v.dosya.boyut || 0), 0), 0);
    e.innerHTML = t('{f} firma · {k} katalog · PDF toplamı {b}', { f: S.veri.firmalar.filter(f => !f.ornek).length, k: n.length, b: boyut(top) })
      + (a.kota ? ' · ' + t('depolama: {u} / {q}', { u: boyut(a.kullanilan), q: boyut(a.kota) }) : '')
      + (a.yerel ? '' : ' · ' + (a.kalici === true ? t('kalıcı depolama: açık') : `<b>${t('kalıcı depolama: kapalı — tarayıcı yer darlığında verileri silebilir')}</b>`));
  }

  function bagla() {
    const k = kok(); if (!k) return;
    k.querySelectorAll('[data-malz]').forEach(b => b.onclick = () => { if (b.dataset.malz === 'proje' && g.IrriApp && g.IrriApp.show) g.IrriApp.show('malzeme'); });
    const ara = $('#katAra'); if (ara) ara.oninput = () => { S.metin = ara.value; const pos = ara.selectionStart; ciz(); const a2 = $('#katAra'); if (a2) { a2.focus(); try { a2.setSelectionRange(pos, pos); } catch (e) { /* */ } } };
    k.querySelectorAll('[data-grup]').forEach(b => b.onclick = () => { S.grup = b.dataset.grup || null; ciz(); });
    k.querySelectorAll('[data-firma]').forEach(b => b.onclick = () => { S.ekran = 'firma'; S.firmaId = b.dataset.firma; ciz(); kok().closest('.view').scrollTop = 0; });
    const fd = $('#katDosya'); if (fd) fd.onchange = () => { const f = fd.files[0]; if (!f) return; S.form = bosForm(f); S.ekran = 'form'; ciz(); };
    const g0 = $('#katGeri0'); if (g0) g0.onclick = () => { S.ekran = 'liste'; ciz(); };
    for (const id of ['#katIptal', '#katIptal2']) { const b = $(id); if (b) b.onclick = () => { if (S.mesgul) return; S.form = null; S.ekran = S.firmaId ? 'firma' : 'liste'; ciz(); }; }
    const kt = $('#kfTur'); if (kt) kt.onchange = () => { const f = $('#kfFiyat'); if (f) f.hidden = kt.value !== 'fiyat'; };
    const ky = $('#katKaydet'); if (ky) ky.onclick = kaydet;
    const bul = id => S.veri.kataloglar.find(x => x.id === id);
    k.querySelectorAll('[data-ac]').forEach(b => b.onclick = () => ac(bul(b.dataset.ac).dosya));
    k.querySelectorAll('[data-duzenle]').forEach(b => b.onclick = () => { S.form = duzenleForm(bul(b.dataset.duzenle)); S.ekran = 'form'; ciz(); });
    k.querySelectorAll('[data-guncelle]').forEach(x => x.onchange = () => { if (x.files[0]) guncelle(bul(x.dataset.guncelle), x.files[0]); });
    k.querySelectorAll('[data-bagla]').forEach(x => x.onchange = () => { if (x.files[0]) pdfBagla(bul(x.dataset.bagla), x.files[0]); });
    k.querySelectorAll('[data-sil]').forEach(b => b.onclick = async () => { const kk = bul(b.dataset.sil); if (!g.confirm(t('“{a}” ve bütün sürümleri bu cihazdan silinsin mi? Bu işlem geri alınamaz.', { a: kk.ad }))) return;
      await D.katalogSil(kk); await yukle(); if (!S.veri.kataloglar.some(x => x.firmaId === kk.firmaId)) { await D.firmaSil(kk.firmaId); S.ekran = 'liste'; } toast(t('Katalog silindi')); render(); });
    k.querySelectorAll('[data-surumac]').forEach(b => b.onclick = () => { const [id, a] = b.dataset.surumac.split('|'); const s = bul(id).oncekiSurumler.find(x => x.dosya.anahtar === a); ac(s.dosya); });
    k.querySelectorAll('[data-surumsil]').forEach(b => b.onclick = async () => { const [id, a] = b.dataset.surumsil.split('|'); if (!g.confirm(t('Bu eski sürüm silinsin mi? Bu işlem geri alınamaz.'))) return; await D.surumDosyasiSil(bul(id), a); toast(t('Eski sürüm silindi')); render(); });
    const yd = $('#katYedek'); if (yd) yd.onclick = yedekIndir;
    const gy = $('#katGeri'); if (gy) gy.onchange = () => { if (gy.files[0]) yedekYukle(gy.files[0]); };
    const kc = $('#katKalici'); if (kc) kc.onclick = async () => { const r = await D.kalicilikIste(); toast(r ? t('Kalıcı depolama açıldı') : t('Tarayıcı kalıcı depolama iznini vermedi')); alanCiz(); };
    alanCiz(); dosyaDurumu();
  }
  // Kaydı olan ama PDF dosyası cihazda bulunmayan (silinmiş/bozulmuş) kataloglar tam kayıt gibi gösterilmez
  async function dosyaDurumu() {
    for (const el of g.document.querySelectorAll('.kat-doc[data-kat]')) {
      const k = S.veri.kataloglar.find(x => x.id === el.dataset.kat); if (!k || !k.dosya || k.dosya.bekliyor) continue;
      let var1 = false; try { var1 = await D.dosyaVarMi(k.dosya); } catch (e) { var1 = false; }
      if (!var1 && !el.querySelector('[data-pdfeksik]')) { const n = g.document.createElement('div'); n.className = 'note err'; n.dataset.pdfeksik = '1'; n.textContent = t('PDF dosyası bu cihazda bulunamadı: kayıt yalnız bilgi içeriyor. “Güncelle (yeni PDF)” ile dosyayı yeniden ekleyin.'); el.insertBefore(n, el.querySelector('.kat-islem')); const ac = el.querySelector('[data-ac]'); if (ac) ac.disabled = true; }
    }
  }

  // Açılışta yarım kalmış yazımları temizle (kayıtlarda adı geçmeyen dosyalar)
  function baslat() { setTimeout(() => { if (S.mesgul) return; D.sahipsizTemizle().catch(() => { /* depo açılamadıysa ekranda gösterilir */ }); }, 4000); }
  // Üst çubuk düğmesi her zaman firma listesine döner (yükleme sürerken form korunur)
  const sifirla = () => { if (S.mesgul) return; S.ekran = 'liste'; S.form = null; S.firmaId = null; };
  g.IrriKatalogUI = { render, sifirla, durum: () => S, baslat };
  if (g.document) { if (g.document.readyState === 'loading') g.document.addEventListener('DOMContentLoaded', baslat); else baslat(); }
})(typeof window !== 'undefined' ? window : globalThis);

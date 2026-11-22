// IrriGrow — Akıllı ekipman seçimi: pompa, filtre, vana, bağlantı elemanı (+ boru: esles-boru.js). Android ve masaüstü aynı kod.
// Girdi: E.design sonucu (salt okunur) + katalog ürün veritabanı (IrriKatalogUrun modeli). Hesap motoru değiştirilmez.
// Kurallar:
//  - Yalnız mühendislik doğrulaması geçmiş ürün "uygun" olabilir; doğrulanmamış veya teknik verisi girilmemiş ürün (yalnız PDF'i
//    yüklenmiş) "verisi eksik" listesine gider. Örnek veri hiç önerilmez. Ürünler üreticiye sabitlenmez: veritabanındaki her
//    doğrulanmış ürün otomatik değerlendirilir.
//  - Eğriler yalnız ölçülen aralıkta okunur; aralık dışı için değer üretilmez.
//  - Hidroliği etkileyen seçimler (pompa, filtre, vana) motorun mevcut katalog arayüzüyle (opt.catalog) yeniden hesaplanabilsin diye
//    motor biçimine çevrilir (motorKatalogu). Boru: motorun doğrulanmış boru kütüphanesindeki karşılığıyla (inp.boruSecimi).
(function (g) {
  'use strict';
  const U = () => g.IrriKatalogUrun || (typeof require !== 'undefined' ? require('./katalog-urun.js') : null);
  const G = 9.81, M_BAR = 10.2;
  const sec = u => U().secimdeKullanilabilir(u);

  // Ürün + değerleri + eğrileri tek nesnede (yalnız bu ürüne ait); kaynak sayfaları toplanır
  function urunPaketleri(veri, kategori) {
    const { urunler = [], degerler = [], egriler = [] } = veri || {};
    return urunler.filter(u => u.kategori === kategori && !u.ornek).map(u => {
      const ds = degerler.filter(d => d.urunId === u.id), es = egriler.filter(e => e.urunId === u.id), V = {};
      for (const d of ds) V[d.ad] = d.siDeger ?? d.deger;
      const kaynakSayfalar = [...new Set(ds.map(d => d.kaynak).concat(es.map(e => e.kaynak)).map(k => k.katalogId + ' s.' + k.sayfa))];
      return { u, V, es, kaynakSayfalar };
    });
  }
  const temel = (P, ek) => Object.assign({ urunId: P.u.id, uretici: P.u.uretici, model: P.u.model, urunKodu: P.u.urunKodu, katalogId: P.u.katalogId, kaynakSayfalar: P.kaynakSayfalar }, ek);
  // Doğrulama durumu ve zorunlu veri; eksikse "verisi eksik"
  function onKosul(P, zorunlu) {
    const n = [];
    if (!sec(P.u)) n.push(P.u.muhendislik === 'reddedildi' ? 'mühendislik doğrulamasında reddedildi' : 'mühendislik doğrulaması yapılmadı (kullanıcı incelemesi veya yalnız PDF yeterli değildir)');
    for (const [k, ad] of zorunlu) if (P.V[k] == null) n.push(`${ad} katalogda kayıtlı değil`);
    return n;
  }
  const grupla = list => ({ uygun: list.filter(x => x.durum === 'uygun'), eksik: list.filter(x => x.durum === 'eksik-veri'), uygunDegil: list.filter(x => x.durum === 'uygun-degil') });

  // ---------- Proje gereksinimleri (motor sonucundan) ----------
  function gereksinim(r, inp) {
    if (!r || !r.ok) return null;
    const m = r.main && r.main.sel || {}, Hp = m.Hp || [], depth = (r.head && r.head.depth) || 0, src = (inp && inp.srcType) || 'kuyu';
    const tipler = src === 'kuyu' ? ['dalgic'] : src === 'yuzey' ? (depth > 6 ? ['dalgic', 'dikey'] : ['santrifuj']) : ['booster', 'santrifuj'];
    const Qj = r.sel.Qj, gorevler = Qj.map((Q, j) => ({ Q, H: Hp[j] || 0 })).filter(d => d.H > 0.5);
    const Qd = Math.max(...Qj), Hd = Math.max(0, ...gorevler.map(d => d.H));
    return {
      srcType: src, pompaTipleri: tipler, gorevler, Qd, Hd, statik: Math.min(Hd, Math.max(0, (r.head && r.head.static0) || 0)), saat: (r.schedule && r.schedule.pumpHours) || 0,
      pompaGerekli: !!(r.pump && r.pump.need),
      filtreAsamalari: (r.filter && r.filter.items || []).map(({ f, n }) => ({ tip: f.tip, mesh: f.mesh || null, n, kayip_m: f.hTemiz * Math.pow(Qd / (n * f.qMax), 2) + (f.kirlenme || 0) })),
      vanaQ: Math.max(...r.units.map(u => u.Q)), vanaKayip_m: r.valve && r.valve.loss ? r.valve.loss(Math.max(...r.units.map(u => u.Q))) : null,
      calismaBasinci_bar: Math.max(0, ...(m.Hd || [0])) / M_BAR,
      anaHat: (r.main.net || []).filter(s => !s.virtual && s.L > 0).map(s => ({ od: s.od, pn: s.pn, malzeme: s.pipe && s.pipe.malzeme ? s.pipe.malzeme : 'PVC-U' })),
      manifoldCaplari: [...new Set(r.units.map(u => u.pipe && u.pipe.od).filter(Boolean))],
      anaPnGerek_bar: Math.max(1.25 * (m.Pop || 0), m.Pshut || 0) / M_BAR,
    };
  }

  // ---------- Pompa ----------
  // Her Q–H eğrisi (devir / çark çapı koşuluyla) ayrı aday: farklı devir/çark birbirinin yerine kullanılmaz
  function pompaDegerlendir(P, req) {
    const qh = P.es.filter(e => e.tur === 'QH'), verim = P.es.find(e => e.tur === 'verim'), npsh = P.es.find(e => e.tur === 'NPSHr');
    const once = onKosul(P, [['pompa_tipi', 'pompa tipi'], ['guc_motor', 'motor gücü']]);
    if (!qh.length) once.push('üretici Q–H eğrisi yok');
    if (once.length) return [temel(P, { durum: 'eksik-veri', neden: once, uyari: [] })];
    return qh.map(e => {
      const kosul = (e.kosul.devir ? e.kosul.devir + ' d/dk' : '') + (e.kosul.carkCapi ? ' Ø' + e.kosul.carkCapi + ' mm çark' : '');
      const neden = [], uyari = [], eksik = [], noktalar = [];
      if (!req.pompaTipleri.includes(P.V.pompa_tipi)) neden.push(`pompa tipi ${P.V.pompa_tipi}; kaynak için uygun tipler: ${req.pompaTipleri.join(', ')}`);
      let Pmax = 0;
      for (const d of req.gorevler) {
        const H = U().egriDeger(e, d.Q);
        if (H == null) { neden.push(`${d.Q.toFixed(1)} m³/h ölçülen eğri aralığı dışında (eğri ${e.si[0][0]}–${e.si[e.si.length - 1][0]} m³/h); değer tahmin edilmez`); continue; }
        if (H < d.H - 1e-9) neden.push(`${d.Q.toFixed(1)} m³/h'de basma yüksekliği ${H.toFixed(1)} m < gereken ${d.H.toFixed(1)} m`);
        const eta = verim ? U().egriDeger(verim, d.Q) : null;
        let Pk = null; if (eta != null && eta > 0) { Pk = G * d.Q / 3600 * H / (eta / 100); Pmax = Math.max(Pmax, Pk); }
        noktalar.push({ Q: d.Q, Hgerek: d.H, H, eta, P: Pk });
      }
      if (!verim) eksik.push('verim eğrisi yok: mil gücü ve enerji hesaplanamaz');
      else if (noktalar.some(n => n.eta == null)) eksik.push('verim eğrisi görev debilerini kapsamıyor: güç hesaplanamaz');
      if (!eksik.length && Pmax > P.V.guc_motor + 1e-9) neden.push(`mil gücü ${Pmax.toFixed(2)} kW > motor gücü ${P.V.guc_motor} kW`);
      // İşletme noktası: sistem eğrisi H = Hs + (Hd − Hs)(Q/Qd)^1,852 ile pompa eğrisinin kesişimi (yalnız ölçülen aralıkta)
      let isletme = null;
      const Hsys = Q => req.statik + (req.Hd - req.statik) * Math.pow(Q / req.Qd, 1.852), f = Q => U().egriDeger(e, Q) - Hsys(Q);
      const Qa = req.Qd, Qb = e.si[e.si.length - 1][0];
      if (U().egriDeger(e, Qa) != null && f(Qa) >= 0) {
        if (f(Qb) > 0) uyari.push('işletme noktası ölçülen eğri aralığının dışında kalıyor: kısma vanası veya frekans kontrolü gerekir; nokta tahmin edilmez');
        else { let a = Qa, b = Qb; for (let i = 0; i < 60; i++) { const c = (a + b) / 2; if (f(c) >= 0) a = c; else b = c; } isletme = { Q: a, H: U().egriDeger(e, a), eta: verim ? U().egriDeger(verim, a) : null }; }
      }
      if (P.V.pompa_tipi === 'dalgic') uyari.push('dalgıç pompa: NPSH, kuyuda daldırma derinliğine bağlıdır; bu bilgi proje verisinde yok');
      else if (!npsh) uyari.push('NPSHr eğrisi yok: emme koşulu denetlenemedi');
      else uyari.push(`NPSHr ${U().egriDeger(npsh, req.Qd) != null ? U().egriDeger(npsh, req.Qd).toFixed(1) + ' m' : '(aralık dışı)'} @ ${req.Qd.toFixed(1)} m³/h; NPSHa için emme yüksekliği proje verisinde yok, sahada denetlenmeli`);
      const durum = neden.length ? 'uygun-degil' : eksik.length ? 'eksik-veri' : 'uygun';
      const tasarim = noktalar.find(n => Math.abs(n.Q - req.Qd) < 1e-9) || noktalar[0];
      return temel(P, { durum, neden: neden.concat(eksik), uyari, kosul, egriId: e.id,
        hesap: { noktalar, isletme, rezerv_m: tasarim ? tasarim.H - tasarim.Hgerek : null, Pmax_kW: Pmax || null, motor_kW: P.V.guc_motor } });
    });
  }

  // ---------- Filtre ----------
  function filtreDegerlendir(P, req) {
    const once = onKosul(P, [['filtre_tipi', 'filtre tipi'], ['debi_max', 'en büyük debi']]);
    if (once.length) return temel(P, { durum: 'eksik-veri', neden: once, uyari: [] });
    const asama = req.filtreAsamalari.find(a => a.tip === P.V.filtre_tipi), neden = [], eksik = [], uyari = [];
    if (!asama) return temel(P, { durum: 'uygun-degil', neden: [`proje filtre planında ${P.V.filtre_tipi} aşaması yok (plan: ${req.filtreAsamalari.map(a => a.tip).join(' + ') || '—'})`], uyari });
    if (asama.mesh != null) { if (P.V.filtrasyon_mesh == null) eksik.push(P.V.filtrasyon_mikron != null ? 'filtrasyon µm olarak verilmiş; proje gereksinimi mesh: dönüşüm tahmini yapılmaz' : 'filtrasyon derecesi yok'); else if (P.V.filtrasyon_mesh < asama.mesh) neden.push(`filtrasyon ${P.V.filtrasyon_mesh} mesh < gereken ${asama.mesh} mesh`); }
    const n = Math.ceil(req.Qd / P.V.debi_max - 1e-9), q = req.Qd / n;
    if (n > 4) neden.push(`${req.Qd.toFixed(1)} m³/h için ${n} paralel filtre gerekir (en çok 4 değerlendirilir)`);
    const kayipE = P.es.find(e => e.tur === 'kayip'), temiz = kayipE ? U().egriDeger(kayipE, q) : null;
    if (!kayipE) eksik.push('temiz filtre basınç kaybı eğrisi yok'); else if (temiz == null) eksik.push(`${q.toFixed(1)} m³/h temiz kayıp eğrisi aralığı dışında; tahmin edilmez`);
    const kirli = P.V.kayip_kirli ?? P.V.geri_yikama_esigi ?? null;
    if (kirli == null) eksik.push('kirli filtre (geri yıkama) tasarım kaybı yok');
    else if (temiz != null && !(kirli > temiz)) neden.push('kirli filtre kaybı temiz kayıptan büyük olmalı (katalog verisi tutarsız)');
    const tasarim_m = kirli != null ? kirli * M_BAR : null, dH = tasarim_m != null ? tasarim_m - asama.kayip_m : null;
    if (dH != null && Math.abs(dH) > 0.05) uyari.push(`tasarım kaybı motor varsayımından ${dH > 0 ? '+' : ''}${dH.toFixed(2)} m farklı: pompa basma yüksekliği yeniden hesaplanmalı (Hesaba uygula)`);
    return temel(P, { durum: neden.length ? 'uygun-degil' : eksik.length ? 'eksik-veri' : 'uygun', neden: neden.concat(eksik), uyari,
      hesap: { adet: n, birimDebi: q, temiz_bar: temiz, kirli_bar: kirli, tasarim_m, motorVarsayim_m: asama.kayip_m, dH_m: dH } });
  }

  // ---------- Vana (shift / alt ünite vanası) ----------
  function vanaDegerlendir(P, req) {
    const once = onKosul(P, [['dn', 'DN'], ['pn', 'PN']]);
    if (once.length) return temel(P, { durum: 'eksik-veri', neden: once, uyari: [] });
    const neden = [], eksik = [], uyari = [];
    if (P.V.pn < req.calismaBasinci_bar - 1e-9) neden.push(`PN ${P.V.pn} < çalışma basıncı ${req.calismaBasinci_bar.toFixed(2)} bar`);
    if (P.V.basinc_max != null && P.V.basinc_max < req.calismaBasinci_bar - 1e-9) neden.push(`katalogdaki en yüksek çalışma basıncı ${P.V.basinc_max} bar < ${req.calismaBasinci_bar.toFixed(2)} bar`);
    if (P.V.debi_max != null && P.V.debi_max < req.vanaQ - 1e-9) neden.push(`en büyük debi ${P.V.debi_max} m³/h < ${req.vanaQ.toFixed(1)} m³/h`);
    if (P.V.kv == null) eksik.push('Kv / Cv yok: basınç kaybı hesaplanamaz');
    const kayip_m = P.V.kv != null ? M_BAR * Math.pow(req.vanaQ / P.V.kv, 2) : null;
    if (P.V.basinc_min != null) uyari.push(`en düşük çalışma basıncı ${P.V.basinc_min} bar: vana girişinde sağlandığı sahada denetlenmeli`);
    const dH = kayip_m != null && req.vanaKayip_m != null ? kayip_m - req.vanaKayip_m : null;
    if (dH != null && Math.abs(dH) > 0.05) uyari.push(`vana kaybı motor varsayımından ${dH > 0 ? '+' : ''}${dH.toFixed(2)} m farklı: pompa basma yüksekliği yeniden hesaplanmalı (Hesaba uygula)`);
    if (req.manifoldCaplari.length && !req.manifoldCaplari.some(od => Math.abs(od - P.V.dn) <= 0.35 * od)) uyari.push(`DN ${P.V.dn} manifold çaplarından (${req.manifoldCaplari.join(', ')} mm) belirgin farklı: redüksiyon gerekir`);
    return temel(P, { durum: neden.length ? 'uygun-degil' : eksik.length ? 'eksik-veri' : 'uygun', neden: neden.concat(eksik), uyari, hesap: { Q: req.vanaQ, kayip_m, dH_m: dH, calismaBasinci_bar: req.calismaBasinci_bar } });
  }

  // ---------- Bağlantı elemanı ----------
  const UYUM = { PE: ['elektrofuzyon', 'alin-kaynak', 'kompresyon', 'flans', 'disli'], PVC: ['yapistirma', 'contali', 'flans', 'disli'] };
  const aile = m => /^PE/.test(m || '') ? 'PE' : /PVC/.test(m || '') ? 'PVC' : null;
  function baglantiDegerlendir(P, req) {
    const cap = P.V.dis_cap ?? P.V.dn, once = onKosul(P, [['pn', 'PN'], ['malzeme', 'malzeme'], ['baglanti', 'bağlantı türü']]);
    if (cap == null) once.push('çap (dış çap / DN) katalogda kayıtlı değil');
    if (once.length) return temel(P, { durum: 'eksik-veri', neden: once, uyari: [] });
    const hedefler = req.anaHat.map(s => ({ od: s.od, malzeme: s.malzeme, pnGerek: req.anaPnGerek_bar, yer: 'ana hat' }))
      .concat(req.manifoldCaplari.map(od => ({ od, malzeme: 'PE100', pnGerek: req.calismaBasinci_bar, yer: 'manifold' })));
    const es = hedefler.filter(h => h.od === cap);
    const neden = [], uyari = [];
    if (!es.length) neden.push(`Ø${cap} projedeki boru çaplarında yok (ana hat: ${[...new Set(req.anaHat.map(s => s.od))].join(', ')}; manifold: ${req.manifoldCaplari.join(', ')})`);
    else {
      const h = es[0];
      if (aile(P.V.malzeme) && aile(h.malzeme) && aile(P.V.malzeme) !== aile(h.malzeme)) neden.push(`malzeme ${P.V.malzeme}, ${h.yer} borusu ${h.malzeme}: uyumsuz`);
      const uy = UYUM[aile(h.malzeme)]; if (uy && !uy.includes(P.V.baglanti)) neden.push(`${P.V.baglanti} bağlantısı ${h.malzeme} boru için uygun değil (${uy.join(', ')})`);
      if (P.V.pn < h.pnGerek - 1e-9) neden.push(`PN ${P.V.pn} < gereken ${h.pnGerek.toFixed(2)} bar (${h.yer})`);
    }
    return temel(P, { durum: neden.length ? 'uygun-degil' : 'uygun', neden, uyari, hesap: { cap, eslesen: es.map(h => h.yer) } });
  }

  // ---------- Hepsi ----------
  function oneriler(r, inp, veri) {
    const req = gereksinim(r, inp); if (!req) return null;
    const B = g.IrriEslesBoru || (typeof require !== 'undefined' ? require('./esles-boru.js') : null);
    const sirala = (L, k) => L.slice().sort(k);
    const pompa = grupla(urunPaketleri(veri, 'pompa').flatMap(P => pompaDegerlendir(P, req)));
    pompa.uygun = sirala(pompa.uygun, (a, b) => (a.hesap.Pmax_kW ?? 1e9) - (b.hesap.Pmax_kW ?? 1e9));
    const filtre = grupla(urunPaketleri(veri, 'filtre').map(P => filtreDegerlendir(P, req)));
    const vana = grupla(urunPaketleri(veri, 'vana').map(P => vanaDegerlendir(P, req)));
    vana.uygun = sirala(vana.uygun, (a, b) => a.hesap.kayip_m - b.hesap.kayip_m);
    const baglanti = grupla(urunPaketleri(veri, 'baglanti').map(P => baglantiDegerlendir(P, req)));
    return { req, pompa: req.pompaGerekli ? pompa : Object.assign(pompa, { bilgi: 'Bu projede pompa gerekmiyor' }), filtre, vana, baglanti, boru: B ? B.alternatifler(r, veri.urunler, veri.degerler) : null };
  }

  // ---------- Motor biçimine çevirme (yeniden hesap için; yalnız doğrulanmış ve uygun ürün) ----------
  function motorPompa(P, egriId) {
    const e = P.es.find(x => x.id === egriId), verim = P.es.find(x => x.tur === 'verim');
    const egri = e.si.map(([Q, H]) => [Q, H, verim ? U().egriDeger(verim, Q) : null]).filter(p => p[2] != null);
    return { id: 'urun:' + P.u.id + ':' + egriId, marka: P.u.uretici, model: P.u.model || P.u.urunKodu, tip: P.V.pompa_tipi, motorKw: P.V.guc_motor, egri, kaynak: 'Katalog ürün veritabanı (mühendislik doğrulamalı)', dogrulandi: true };
  }
  function motorFiltre(P) {
    const k = P.es.find(x => x.tur === 'kayip'), hq = k ? U().egriDeger(k, P.V.debi_max) : null, kirli = P.V.kayip_kirli ?? P.V.geri_yikama_esigi;
    if (hq == null || kirli == null) return null;
    return { id: 'urun:' + P.u.id, tip: P.V.filtre_tipi, ad: `${P.u.uretici} ${P.u.model || P.u.urunKodu}`, mesh: P.V.filtrasyon_mesh || null, qMax: P.V.debi_max, hTemiz: hq * M_BAR, kirlenme: Math.max(0, (kirli - hq) * M_BAR), kaynak: 'Katalog ürün veritabanı', dogrulandi: true };
  }
  function motorVana(P) { if (P.V.kv == null) return null; return { id: 'urun:' + P.u.id, ad: `${P.u.uretici} ${P.u.model || P.u.urunKodu}`, kv: P.V.kv, qMax: P.V.debi_max || 1e9, tip: 'sektor', kaynak: 'Katalog ürün veritabanı', dogrulandi: true }; }
  // Seçimden motor katalog girdisi: { pompa?: [..], filtre?: [..], vana?: [..] } — projeye yazılır (taşınabilir, eşzamanlı)
  function motorKatalogu(veri, secim) {
    const out = {}, bul = (kat, id) => urunPaketleri(veri, kat).find(P => P.u.id === id);
    if (secim.pompa) { const P = bul('pompa', secim.pompa.urunId); if (P && sec(P.u)) out.pompa = [motorPompa(P, secim.pompa.egriId)]; }
    if (secim.filtre) { const P = bul('filtre', secim.filtre.urunId); const f = P && sec(P.u) ? motorFiltre(P) : null; if (f) out.filtre = [f]; }
    if (secim.vana) { const P = bul('vana', secim.vana.urunId); const v = P && sec(P.u) ? motorVana(P) : null; if (v) out.vana = [v]; }
    return out;
  }
  // Motor kataloğu: seçilen kategoride yalnız seçilen ürün; diğer kategoriler değişmez (filtre: aynı tipteki aşama değiştirilir)
  function katalogBirlestir(temelKatalog, ek) {
    const k = Object.assign({}, temelKatalog);
    if (ek.pompa) k.pompa = ek.pompa.slice();
    if (ek.vana) k.vana = ek.vana.slice();
    if (ek.filtre) k.filtre = (temelKatalog.filtre || []).filter(f => !ek.filtre.some(e => e.tip === f.tip)).concat(ek.filtre);
    return k;
  }

  const api = Object.freeze({ gereksinim, urunPaketleri, pompaDegerlendir, filtreDegerlendir, vanaDegerlendir, baglantiDegerlendir, oneriler, motorKatalogu, katalogBirlestir });
  g.IrriEsles = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

// Android ↔ masaüstü eşdeğerlik testi: aynı proje, aynı ürün verisi ve aynı manuel düzenle her platformda çalışan uygulamanın
// ürettiği sonuçların özeti (parmak izi). İşlevler sayfaya (page.evaluate) gönderilir; kendi içinde bağımsızdır.
// Ürünler test içinde üretilen sentetik verilerdir (gerçek katalog değildir).
module.exports = {
  // Sayfada: proje kaydı + katalog + doğrulanmış ürünler (pompa, filtre, vana, boru, bağlantı) + manuel shift düzeni
  kur: async () => {
    const D = window.IrriKatalogDepo, M = window.IrriKatalogModel, U = window.IrriKatalogUrun;
    const p = { id: 'esd', name: 'Eşdeğerlik', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [], src: null, inp: { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, srcType: 'kuyu', depth: 40, region: 'akdeniz' } };
    localStorage.setItem('irrismart.projects.v1', JSON.stringify([p]));
    const r = window.IrriEngine.design(p.inp), req = window.IrriEsles.gereksinim(r, p.inp);
    const dosya = await D.dosyaYaz(new File([new Blob([new TextEncoder().encode('%PDF-1.4\n% esdeger\n%%EOF\n')])], 'e.pdf'));
    const f = Object.assign(M.yeniFirma('Eşdeğer Üretici'), { id: 'frm_esd' }); await D.firmaKaydet(f);
    const k = Object.assign(M.yeniKatalog({ ad: 'Eşdeğer katalog', firmaId: f.id, dosya }), { id: 'kat_esd' }); await D.katalogKaydet(k);
    const K = s => ({ katalogId: k.id, sayfa: s, hamMetin: 'test', yontem: 'elle' });
    let n = 0;
    async function urun(kategori, model, degerler, egriler, dogrula = true) {
      let u = Object.assign(U.yeniUrun({ uretici: 'Eşdeğer Üretici', model, urunKodu: model, katalogId: k.id, kategori }), { id: 'urn_' + model });
      const ds = degerler.map(([ad, deger, birim], i) => Object.assign(U.yeniDeger({ urunId: u.id, ad, deger, birim, kaynak: K(10 + i) }).deger, { id: 'dgr_' + model + '_' + (n++), inceleme: 'kullanici-onayladi' }));
      const es = (egriler || []).map((o, i) => Object.assign(U.yeniEgri(Object.assign({ urunId: u.id, kaynak: K(30) }, o)).egri, { id: 'egr_' + model + '_' + i, inceleme: 'kullanici-onayladi' }));
      u = U.incele(u, 'kullanici-onayladi');
      if (dogrula) { const den = U.muhendislikDenetle(u, ds, es); if (!den.gecti) throw new Error(model + ' denetim'); u = U.muhendislikOnayla(u, den, 'Test'); }
      await D.urunKaydet(u); for (const d of ds) await D.degerKaydet(d); for (const e of es) await D.egriKaydet(e);
    }
    const F = [0, 0.4, 0.8, 1.2, 1.6];
    await urun('pompa', 'P1', [['pompa_tipi', 'dalgic', ''], ['guc_motor', 45, 'kW']], [{ tur: 'QH', birimX: 'm³/h', birimY: 'm', noktalar: F.map(x => [+(req.Qd * x).toFixed(2), +(req.Hd * 1.1 * (1.3 - 0.3 * x * x)).toFixed(2)]), kosul: { devir: 2900 } }, { tur: 'verim', birimX: 'm³/h', birimY: '%', noktalar: F.map((x, i) => [+(req.Qd * x).toFixed(2), [30, 55, 68, 66, 55][i]]) }]);
    await urun('pompa', 'P2', [['pompa_tipi', 'dalgic', ''], ['guc_motor', 45, 'kW']], [], false);
    const asm = req.filtreAsamalari.find(a => a.mesh) || req.filtreAsamalari[0];
    await urun('filtre', 'F1', [['filtre_tipi', asm.tip, ''], ['dn', 80, 'mm'], ['debi_max', 80, 'm³/h'], ['filtrasyon_mesh', asm.mesh || 120, 'mesh'], ['kayip_kirli', 0.5, 'bar']], [{ tur: 'kayip', birimX: 'm³/h', birimY: 'bar', noktalar: [[0, 0], [20, 0.12], [40, 0.3], [80, 0.6]] }]);
    await urun('vana', 'V1', [['dn', 63, 'mm'], ['pn', 16, 'bar'], ['kv', 60, 'Kv']]);
    await urun('boru', 'B1', [['dis_cap', 110, 'mm'], ['et_kalinligi', 6.6, 'mm'], ['pn', 10, 'bar'], ['malzeme', 'PE100', '']]);
    const ana = req.anaHat[0];
    await urun('baglanti', 'C1', [['dis_cap', ana.od, 'mm'], ['pn', 16, 'bar'], ['malzeme', /^PE/.test(ana.malzeme) ? 'PE100' : 'PVC-U', ''], ['baglanti', /^PE/.test(ana.malzeme) ? 'elektrofuzyon' : 'yapistirma', '']]);
    return true;
  },
  // Sayfada: parmak izi (sayılar 6 anlamlı basamağa yuvarlanır; zaman damgası ve rastgele kimlik içermez)
  iz: async () => {
    const yuv = v => typeof v === 'number' ? (Number.isFinite(v) ? +v.toPrecision(6) : String(v)) : Array.isArray(v) ? v.map(yuv) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, yuv(v[k])])) : v;
    const E = window.IrriEngine, SY = window.IrriShiftYonetimi, X = window.IrriEsles, Ly = window.IrriLayout;
    const p = JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0];
    const r = E.design(p.inp);
    const ozet = r => !r.ok ? { hata: r.err } : ({ Qj: r.sel.Qj, groups: r.sel.groups, H: r.pump && r.pump.H, pompa: r.pump && (r.pump.ad || r.pump.text), kWh: r.schedule.kWh, ana: [r.main.sel.od, r.main.sel.pn, r.main.sel.v], filtre: r.head.filter, vana: r.head.valve, uyari: r.warn.length, lateral: [r.lateral.d, r.lateral.Lmax], bom: r.bom.map(b => [b.kalem, b.miktar]) });
    // Manuel düzen: 5 shift gerçek atamayla (aynı işlev her platformda)
    const b = SY.bolumle(r.units.map(u => u.Q), 5, Ly.partition), rm = E.design(p.inp, null, { manual: { sig: r.layout.sig, assign: b.assign } });
    const veri = await window.IrriKatalogDepo.urunListele();
    const o = X.oneriler(r, p.inp, veri), oz = L => L ? { uygun: L.uygun.map(x => [x.model, x.kosul || '', x.hesap]), eksik: L.eksik.map(x => x.model), uygunDegil: L.uygunDegil.map(x => x.model) } : null;
    // Pompa hesaba uygulanmış hâli (motor kataloğu arayüzü)
    const s = o.pompa.uygun[0], ek = X.motorKatalogu(veri, { pompa: { urunId: s.urunId, egriId: s.egriId } }), rp = E.design(p.inp, null, { catalog: X.katalogBirlestir(window.IRRI_CATALOG, ek) });
    const proj = Object.assign({}, p, { katalogKalemleri: [{ urunId: s.urunId, kategori: 'pompa', uretici: s.uretici, model: s.model, urunKodu: s.urunKodu, kaynak: s.kaynakSayfalar.join(', '), durum: 'uygun', miktar: 1, birim: 'adet' }] });
    const rapor = window.IrriReportData.build(proj, r);
    const wb = window.IrriReportData.workbook && window.XLSX ? window.IrriReportData.workbook(window.XLSX, proj, r) : null;
    const urunler = veri.urunler.map(u => [u.id, u.kategori, u.inceleme, u.muhendislik]).sort();
    return yuv({ hesap: ozet(r), manuel: ozet(rm), urunler, degerSayisi: veri.degerler.length, oneriler: { pompa: oz(o.pompa), filtre: oz(o.filtre), vana: oz(o.vana), baglanti: oz(o.baglanti), boru: o.boru.segmentler.map(sg => oz(sg)) },
      pompaUygulanmis: ozet(rp), rapor: { ozet: rapor.ozet, hidrolik: rapor.hidrolik, sektor: rapor.sektor, bomP: rapor.bomP, bomU: rapor.bomU, akil: rapor.akil.sheet }, excelSayfa: wb && wb.SheetNames ? wb.SheetNames.map(n => [n, window.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })]) : null });
  },
};

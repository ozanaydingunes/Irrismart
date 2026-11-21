// IrriGrow — rapor tabloları (PDF ve Excel ortak). Değerler SAYI olarak tutulur; birim ayrı sütundadır.
// Satır biçimi: [etiket, değer, birim, ondalık]  — değer sayı veya metin
(function (g) {
  const D = g.IRRI_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
  const E = () => g.IrriEngine;
  const AS = () => g.IrriAssess || (typeof require !== 'undefined' ? require('./assess.js') : null);
  const nfmt = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v.toLocaleString('tr-TR', { minimumFractionDigits: d ?? 1, maximumFractionDigits: d ?? 1 }) : '—';

  // MH-AKIL-1: Sonuç ekranıyla aynı değerlendirme (IrriAssess.forProject). PDF ve Excel bu nesneden yazılır.
  function akil(p, r) {
    const A = AS().forProject(p, r), tx = x => AS().text(x, T, nfmt);
    const findings = A.findings.map(x => ({
      kod: x.kod, seviye: x.seviye,
      head: `${x.kod} · ${T(AS().LEVEL_AD[x.seviye])}${x.onDegerlendirme ? ' · ' + T(AS().ON_DEG) : ''} — ${tx(x.baslik)}`,
      kv: x.durum.map(q => [tx(q.ad), q.deger, q.birim, q.d])
        .concat(x.sinir ? [[T('Sınır') + ': ' + tx(x.sinir.ad), x.sinir.deger, x.sinir.birim, x.sinir.d]] : [])
        .concat([[T('Neden'), tx(x.neden), '', null]])
        .concat(x.kisaGerekce ? [[T('Not'), tx(x.kisaGerekce), '', null]] : [])
        .concat(x.onem ? [[T('Önem'), tx(x.onem), '', null]] : [])
        .concat(x.onay && x.onay !== 'yok' ? [[T('Kullanıcı kararı'), T(({ bekliyor: 'İnceleniyor', kabul: 'Bilinerek kabul edildi', red: 'Çözülmesi gerekiyor' })[x.onay] || x.onay), '', null]] : []),
      sols: [[T('Çözüm'), T('Durum'), T('Gerekçe'), T('Gereken veri')]].concat(x.cozumler.map(c => [tx(c.baslik), T(AS().DURUM_AD[c.durum]) + (c.asama && c.durum === 'degerlendirilmedi' ? ' (' + c.asama + ')' : ''), tx(c.gerekce) + (c.varsayim ? ' ' + tx(c.varsayim) : '') + (c.kapsam ? ' ' + tx(c.kapsam) : ''), (c.gerekenVeri || []).map(tx).join('; ')])),
    }));
    const head = [T('Kod'), T('Seviye'), T('Başlık'), T('Mevcut değer'), T('Sınır'), T('Birim'), T('Çözüm türü'), T('Çözüm durumu'), T('Açıklama / gerekçe'), T('Gereken veri')];
    const rr = AS().reportRows(A, T, nfmt);
    const sheet = [head].concat(rr.map(x => x.cells), A.other.map(w => ['', T('Diğer hesap notu'), '', null, null, '', '', '', w, '']));
    const decs = [null].concat(rr.map(x => x.dec ?? null), A.other.map(() => null));
    return { A, findings, other: A.other, count: A.count, sheet, decs };
  }
  const T = (x, p) => g.IrriI18n ? g.IrriI18n.t(x, p) : (p ? x.replace(/\{(\w+)\}/g, (m, k) => (p[k] !== undefined ? p[k] : m)) : x);
  const SRC = () => ({ kullanici: T('Kullanıcı'), katalog: T('Katalog'), ornek: T('Örnek fiyat') });

  function build(p, r) {
    const s = r.schedule, m = r.main.sel, c = D.CROPS[p.inp.crop], sel = r.sel;
    const ozet = [
      [T('Proje'), p.name, '', null], [T('Tarih'), new Date().toLocaleDateString('tr-TR'), '', null], [T('Bitki'), c.ad, '', null],
      [T('Tasarım geometrisi'), r.field.mode === 'parsel' ? 'Gerçek parsel sınırı' : 'Eşdeğer dikdörtgen', '', null],
      [T('Alan'), r.field.da, 'da', 2],
      [T('Eğim (lateral yönü)'), r.field.sLat, '%', 2], [T('Eğim (manifold yönü)'), r.field.sMan, '%', 2],
      [T('Sıra arası'), r.field.Sr, 'm', 2], [T('Sıra üzeri'), r.field.Sp, 'm', 2], [T('Bitki sayısı'), r.field.plants, 'adet', 0],
      [T('Damlatıcı debisi'), r.emitter.q, 'l/h', 2], r.emitter.ne ? [T('Ağaç başına damlatıcı'), r.emitter.ne, 'adet', 0] : [T('Damlatıcı aralığı'), r.emitter.Se, 'm', 2],
      [T('Damlatıcı tipi'), r.emitter.pc ? 'Basınç ayarlı (PC)' : 'Normal', '', null],
      [T('Shift sayısı'), r.sectors.Ns, 'adet', 0], [T('En büyük shift debisi'), r.sectors.Qsec, 'm³/h', 2],
      [T('Pompa'), r.pump.text, '', null], [T('Filtrasyon'), r.filter.text, '', null], [T('Shift vanası'), `${r.valve.text} × ${r.units.length}`, '', null],
      r.cost.total != null ? [T('Toplam malzeme bedeli'), r.cost.total, 'TL', 0] : [T('Toplam malzeme bedeli'), `Hesaplanmadı — ${r.cost.missing} kalemin fiyatı eksik`, '', null],
    ];
    const hidrolik = [
      [T('Lateral çapı'), r.lateral.d, 'mm', 0], [T('Lateral iç çapı'), r.lateral.ic, 'mm', 1],
      [T('İzin verilen maks. lateral boyu'), r.lateral.Lmax, 'm', 1], [T('En uzun lateral'), r.lateral.maxLen, 'm', 1],
      [T('Lateral adedi'), r.lateral.count, 'adet', 0], [T('Toplam lateral uzunluğu'), r.lateral.len, 'm', 0], [T('Kör lateral (damlatıcısız)'), r.lateral.lead, 'm', 0],
      [T('Damlatıcı adedi'), r.lateral.emitters, 'adet', 0],
      [T('Maks. lateral basınç farkı'), r.lateral.maxDH, 'm', 2], [T('Lateral için izin'), r.emitter.allowLat, 'm', 2],
      [T('Lateral giriş basıncı (maks.)'), r.inlet.hLatIn, 'm', 2],
      [T('Alt ünite (manifold) adedi'), r.manifold.count, 'adet', 0], [T('En uzun manifold'), r.manifold.LmMax, 'm', 1],
      [T('Maks. manifold debisi'), r.manifold.Qmax, 'm³/h', 2], [T('Maks. manifold hızı'), r.manifold.vMax, 'm/s', 2],
      [T('Maks. manifold basınç farkı'), r.manifold.varMax, 'm', 2], [T('Manifold için izin'), r.emitter.allowMan, 'm', 2],
      [T('Manifold giriş basıncı (maks.)'), r.inlet.hManIn, 'm', 2],
      [T('Ana hat'), m.pipe && m.pipe.kutuphane ? `${m.pipe.malzeme} Ø${m.od} SDR${m.pipe.sdr} PN${m.pn} (${T('elle seçildi')})` : `PVC-U Ø${m.od} PN${m.pn}`, '', null], [T('Ana hat iç çapı'), m.ic, 'mm', 1], [T('Ana hat uzunluğu'), r.main.Lmain, 'm', 0], [T('Kritik yol'), r.main.Lcrit, 'm', 0],
      [T('Ana hat hızı (en büyük shift)'), m.v, 'm/s', 2], [T('Ana hat kaybı (kritik yol)'), m.hf, 'm', 2],
      [T('Kuyu seviyesi / emme'), r.head.depth, 'm', 1], [T('Kaynak-arazi kot farkı'), r.head.dZ, 'm', 1], [T('Arazi içi maks. yükselme'), r.head.riseMax, 'm', 2],
      [T('Filtre kaybı (kirlenme payı dahil)'), r.head.filter, 'm', 2], [T('Shift vanası kaybı'), r.head.valve, 'm', 2], [T('Gübreleme + sayaç + vanalar'), 2, 'm', 1],
      [T('Gerekli basma yüksekliği (maks.)'), m.Hmax, 'm', 2],
    ];
    if (r.head.Havail > 0) hidrolik.push([T('Mevcut şebeke basıncı'), r.head.Havail, 'm', 1]);
    // 1.0.1: çalışma sırası (Shift Yönetimi) varsa shift tablosu o sırayla ve "Sıra" sütunuyla yazılır; yoksa tablo değişmez
    const SY = g.IrriShiftYonetimi || (typeof require !== 'undefined' ? require('./shift-yonetimi.js') : null);
    const sira = SY ? SY.raporSirasi(p, r) : null;
    const sektor = sira
      ? [[T('Çalışma sırası'), T('Shift'), T('Alt ünite'), T('Debi (m³/h)'), T('Gerekli H (m)')]].concat(sira.map((j, i) => [i + 1, j + 1, sel.groups[j].length, sel.Qj[j], m.H[j]]))
      : [[T('Shift'), T('Alt ünite'), T('Debi (m³/h)'), T('Gerekli H (m)')]].concat(sel.groups.map((gr, j) => [j + 1, gr.length, sel.Qj[j], m.H[j]]));
    const sektorDec = sira ? [0, 0, 0, 2, 2] : [0, 0, 2, 2];
    const sektorPdf = sira ? { w: [24, 22, 26, 34, 34], num: [1, 2, 3, 4] } : { w: [30, 30, 40, 40], num: [1, 2, 3] };
    const sektorXls = sira ? [12, 10, 12, 14, 14] : [10, 12, 14, 14];
    // 1.0.4: shift başına hedef debi (bilgi) girilmişse tabloya son sütun olarak eklenir; yoksa tablo değişmez
    const HS = SY ? SY.hedefler(p && p.shiftHedefler, sel.groups.length) : null;
    if (HS) {
      sektor[0].push(T('Hedef debi (bilgi, m³/h)'));
      sektor.slice(1).forEach(row => { const j = row[sira ? 1 : 0] - 1; row.push(SY.hedefOf(HS, p.shiftHedef, j) ?? ''); });
      sektorDec.push(2); sektorPdf.w.push(30); sektorPdf.num.push(sektor[0].length - 1); sektorXls.push(16);
    }
    // Hedef shift debisi yalnız bilgidir (hesabı değiştirmez); yalnız girilmişse rapora yazılır
    if (p && Number.isFinite(p.shiftHedef) && p.shiftHedef > 0) ozet.push([T('Hedef shift debisi (bilgi; hesabı değiştirmez)'), p.shiftHedef, 'm³/h', 2]);
    const altSek = [[T('Shift sayısı'), T('En büyük shift (m³/h)'), T('Tur süresi (h)'), T('Süreye sığar'), T('Ana hat'), T('Maks. H (m)'), T('Motor (kW)'), T('Enerji (kWh/yıl)'), T('Karşılaştırma (TL/yıl)'), T('Durum')]]
      .concat(r.sectorAlts.map(a => [a.Ns, a.Qmax, a.cycleHours, a.feasible ? T('Evet') : T('Hayır'), `Ø${a.main.sel.od} PN${a.main.sel.pn}`, a.main.sel.Hmax, a.pump.need ? a.pump.motor : 0, a.kWh, a.missing.length ? T('Fiyat eksik') : a.compare, (a === sel ? T('SEÇİLİ') + ' ' : '') + (a.recommended ? T('Önerilen') : '')]));
    const altSekDec = [0, 2, 1, null, null, 1, 1, 0, 0, null];
    const altHat = [[T('Çap'), T('PN'), T('Hız (m/s)'), T('Kayıp (m)'), T('Maks. H (m)'), T('Enerji (kWh/yıl)'), T('Boru (TL)'), T('Enerji (TL/yıl)'), T('Yıllık (TL)'), T('Not')]]
      .concat(r.main.alts.map(a => [a.od, a.pn, a.v, a.hf, a.Hmax, a.kWh, a.pipeCost ?? T('Fiyat yok'), a.energyCost, a.annual ?? '—', (a === m ? T('SEÇİLİ') + ' ' : '') + a.tags.map(x => T(x)).join(', ')]));
    const altHatDec = [0, 0, 2, 2, 1, 0, 0, 0, 0, null];
    const su = [
      [T('Tepe ET0'), s.et0, 'mm/gün', 2], [T('Kc'), s.kc, '', 2], [T('Kr'), s.Kr, '', 2], [T('Net ihtiyaç'), s.net, 'mm/gün', 2], [T('Brüt ihtiyaç'), s.gross, 'mm/gün', 2],
      [T('Bitki başına (tepe)'), s.lpPlant, 'l/gün', 1], [T('Uygulama hızı'), s.AR, 'mm/h', 2], [T('Kolay alınabilir su (RAW)'), s.RAW, 'mm', 1],
      [T('Sulama aralığı'), s.interval, 'gün', 0], [T('Maks. aralık (toprak)'), s.Imax, 'gün', 0], [T('Shift başına süre'), s.t, 'saat', 2], [T('Bir tur süresi'), s.cycleHours, 'saat', 1],
      [T('Sezonluk su'), s.seasonM3, 'm³', 0], [T('Sezonluk su (dekar başına)'), s.seasonM3 / r.field.da, 'm³/da', 0], [T('Sezonluk pompa çalışması'), s.pumpHours, 'saat', 0],
      [T('Sezonluk enerji'), s.kWh, 'kWh', 0], [T('Sezonluk enerji bedeli'), s.energyCost, 'TL', 0],
    ];
    const prog = [[T('Ay'), T('Kc'), T('ET0 (mm/gün)'), T('Brüt (mm/gün)'), T('Aralık (gün)'), T('Süre (saat/shift)'), T('Su (m³/da·ay)')]]
      .concat(s.monthly.map(x => [x.ay, x.kc, x.et0, x.gross, x.interval, x.sure, x.m3da]));
    const progDec = [null, 2, 1, 1, 0, 1, 0];
    const bomHead = [T('Grup'), 'Kalem', 'Miktar', 'Birim', 'Birim fiyat (TL)', 'Tutar (TL)', 'Fiyat kaynağı'];
    const priced = r.bom.filter(b => b.fiyat != null), unpriced = r.bom.filter(b => b.fiyat == null);
    const bomP = [bomHead].concat(priced.map(b => [T(b.grup), b.kalem + (b.opsiyonel ? ' (' + T('opsiyonel') + ')' : ''), b.miktar, T(b.birim), b.fiyat, b.tutar, SRC()[b.kaynak] || '']));
    const bomU = [[T('Grup'), T('Kalem'), T('Miktar'), T('Birim')]].concat(unpriced.map(b => [T(b.grup), b.kalem + (b.opsiyonel ? ' (' + T('opsiyonel') + ')' : ''), b.miktar, T(b.birim)]));
    const bomDec = [null, null, 0, null, 2, 0, null];
    const toplam = [
      [T('Fiyatlı kalemler ara toplamı (opsiyoneller hariç)'), r.cost.subtotal, 'TL', 0],
      [T('Fiyatı eksik zorunlu kalem'), r.cost.missing, 'adet', 0], [T('Örnek fiyatlı kalem'), r.cost.example, 'adet', 0],
      r.cost.total != null ? [T('TOPLAM MALZEME BEDELİ'), r.cost.total, 'TL', 0] : [T('TOPLAM MALZEME BEDELİ'), 'Hesaplanmadı (eksik fiyat)', '', null],
    ];
    return { akil: akil(p, r), ozet, hidrolik, sektor, sektorDec, sektorPdf, sektorXls, altSek, altSekDec, altHat, altHatDec, su, prog, progDec, bomP, bomU, bomDec, toplam };
  }

  // Excel çalışma kitabı (SheetJS). Sayılar gerçek sayı hücresi, ondalık biçimi ayrı.
  function workbook(XLSX, p, r) {
    const TB = build(p, r), wb = XLSX.utils.book_new();
    const z = d => d == null ? null : d === 0 ? '#,##0' : '#,##0.' + '0'.repeat(d);
    const sn = x => T(x).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31);
    const sheet = (name, rows, cols, decs) => {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      rows.forEach((row, ri) => row.forEach((v, ci) => {
        if (typeof v !== 'number') return;
        const ref = XLSX.utils.encode_cell({ r: ri, c: ci }), d = decs(ri, ci);
        if (ws[ref] && d != null) ws[ref].z = z(d);
      }));
      ws['!cols'] = cols.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, name);
    };
    const kv = (name, rows) => sheet(name, [[T('Kalem'), T('Değer'), T('Birim')]].concat(rows.map(([a, b, c]) => [a, b, T(c)])), [44, 26, 10], (ri) => ri ? rows[ri - 1][3] : null);
    const tbl = (name, rows, dec, cols) => sheet(name, rows, cols, (ri, ci) => ri ? dec[ci] : null);
    kv(sn('Özet'), TB.ozet);
    sheet(sn('Uyarılar'), TB.akil.sheet, [10, 16, 46, 14, 12, 8, 16, 26, 90, 40], (ri, ci) => ri && (ci === 3 || ci === 4) ? TB.akil.decs[ri] : null);
    kv(sn('Hidrolik'), TB.hidrolik);
    tbl(sn('Shift’ler'), TB.sektor, TB.sektorDec, TB.sektorXls);
    tbl(sn('Shift alternatifleri'), TB.altSek, TB.altSekDec, [13, 20, 14, 12, 16, 12, 11, 16, 20, 18]);
    tbl(sn('Ana hat alternatifleri'), TB.altHat, TB.altHatDec, [8, 6, 10, 10, 12, 16, 14, 16, 14, 30]);
    kv(sn('Su ihtiyacı'), TB.su); tbl(sn('Aylık program'), TB.prog, TB.progDec, [8, 8, 14, 14, 12, 18, 16]);
    tbl(sn('Malzeme (fiyatlı)'), TB.bomP, TB.bomDec, [12, 56, 10, 8, 16, 16, 14]);
    tbl(sn('Malzeme (fiyatsız)'), TB.bomU, TB.bomDec, [12, 56, 10, 8]);
    kv(sn('Maliyet'), TB.toplam);
    // K-5: kot/parsel kaynağı ve sınırları yalnız haritadan kot alınmış veya KML/KMZ ile içe aktarılmış projelerde
    const kaynak = g.IrriKaynak ? g.IrriKaynak.projeSatirlari(p, T, nfmt) : [];
    sheet(sn('Varsayımlar'), [['#', T('Varsayım / uyarı')]].concat(r.asm.map((a, i) => [i + 1, a]), r.warn.map(w => [T('Uyarı'), w]), kaynak.map(k => [T('Veri kaynağı'), k])), [7, 110], () => 0);
    if (p.hydro) hydroSheets(XLSX, wb, p.hydro);
    return wb;
  }


  // ---- Hidrolik Hesap Tablosu sayfaları: kullanıcının Excel dosyasındaki formüllerle (XLOOKUP → INDEX/MATCH) ----
  const SYS_MAP = [['crop', 3, 'Bitki', ''], ['area', 4, 'Alan', 'da'], ['et', 5, 'ET', 'mm/gün'], ['T', 6, 'T', 'h'], ['Sr', 7, 'Sıra Arası', 'm'], ['Sp', 8, 'Sıra Üzeri', 'm'], ['nl', 9, 'Lateral Sayısı', 'adet'],
    ['q', 10, 'q', 'l/h'], ['Sd', 11, 'Sd', 'm'], ['n', 12, 'n', 'adet/bitki'], ['rate', 13, 'Sulama hızı', 'mm/h'], ['Qp', 14, 'Q bitki', 'l/h'], ['Tp', 15, 'T bitki', 'h/gün'], ['maxShift', 16, 'Max Shift (h)', 'ad'],
    ['shifts', 17, 'Shift #', 'adet'], ['totalTime', 18, 'Toplam Sulama Süresi', 'h'], ['totalQ', 19, 'Toplam Debi', 'm³/h'], ['shiftQ', 20, 'Shift Debi', 'm³/h'], ['target', 21, 'Parsel Hedef Debi', 'm³/h'],
    ['parcels', 22, 'Parsel Sayısı', 'adet'], ['parcelA', 23, 'Ort. Parsel Alanı', 'da'], ['parcelQ', 24, 'Ort. Parsel Debi', 'm³/h'], ['valves', 25, 'Aynı Anda Çal. Vana', 'adet'], ['shiftMax', 26, 'Shift Debi MAX', 'm³/h'], ['shiftMin', 27, 'Shift Debi MIN', 'm³/h']];
  const SYS_F = { 12: '(X8/X11)*X9', 13: 'IFERROR((X12*X10)/(X8*X7),"")', 14: 'IFERROR((X12*X10),"")', 15: 'IFERROR((((X8*X7)*X5)/X14),"")', 16: 'IFERROR((ROUNDDOWN(X6/X15,0)),"")',
    18: 'IFERROR((X15*X17),"")', 19: 'IFERROR((X4*X5/X15),"")', 20: 'IFERROR((((X4/X17)*X5)/X15),"")', 22: 'IFERROR((ROUNDUP(X19/X21,0)),"")', 23: 'IFERROR((X4/X22),"")',
    24: 'IFERROR((X19/X22),"")', 25: 'IFERROR((ROUNDUP(X20/X24,0)),"")', 26: 'IFERROR((X25*X24),"")', 27: 'IFERROR(((ROUNDDOWN(X20/X24,0))*X24),"")' };
  const SYS_DEC = { n: 2, rate: 2, Qp: 2, Tp: 2, maxShift: 0, totalTime: 1, totalQ: 1, shiftQ: 1, parcels: 0, parcelA: 2, parcelQ: 2, valves: 0, shiftMax: 2, shiftMin: 2 };
  const z = d => d === 0 ? '0' : '0.' + '0'.repeat(d);
  const numIn = v => { if (v === undefined || v === null || v === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : String(v); };

  function hydroSheets(XLSX, wb, hydro, opt = {}) {
    const HT = g.IrriHydroTable || (typeof require !== 'undefined' ? require('./hydro-table.js') : null);
    const LIB = g.IRRI_PIPELIB || (typeof require !== 'undefined' ? require('./pipelib.js') : []);
    const enc = (c, r) => XLSX.utils.encode_cell({ c, r: r - 1 });
    const put = (ws, c, r, cell) => { ws[enc(c, r)] = cell; };
    const fcell = (f, v, d) => { const c = { f }; if (!opt.noCache) { if (typeof v === 'number') { c.t = 'n'; c.v = v; } else { c.t = 's'; c.v = v ?? ''; } } if (d != null) c.z = z(d); return c; };
    const vcell = v => typeof v === 'number' ? { t: 'n', v } : { t: 's', v: String(v ?? '') };
    const fields = (hydro.fields || []).slice(0, 6);
    // SİSTEM: B=etiket, C..H=Field 1..6, I=birim
    const ws = {};
    put(ws, 1, 1, vcell(T('Arazi'))); put(ws, 1, 2, vcell(T('Bölge')));
    for (let j = 0; j < 6; j++) put(ws, 2 + j, 2, vcell('Field ' + (j + 1)));
    for (const [k, row, lab, unit] of SYS_MAP) { put(ws, 1, row, vcell(T(lab))); if (unit) put(ws, 8, row, vcell(T(unit))); }
    fields.forEach((f, j) => {
      const o = HT.systemField(f || {}); if (!o.used && !(f && f.crop)) return;
      const col = XLSX.utils.encode_col(2 + j);
      for (const [k, row] of SYS_MAP) {
        if (SYS_F[row]) put(ws, 2 + j, row, fcell(SYS_F[row].replace(/X/g, col), o[k] == null ? '' : o[k], SYS_DEC[k]));
        else { const v = k === 'crop' ? (f.crop ?? '') : numIn(f[k]); if (v !== null && v !== '') put(ws, 2 + j, row, vcell(v)); }
      }
    });
    ws['!ref'] = 'A1:I27'; ws['!cols'] = [{ wch: 2 }, { wch: 24 }, ...Array(6).fill({ wch: 12 }), { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'SİSTEM');
    // IRRIFRICT: her shift için ayrı sayfa
    const H = ['Segment', 'Type', 'Material', 'PN, BAR', 'Lenght, m', 'Flow rate, m3/h', 'Start height, m', 'End height, m', 'Valve min pressure, mSS', 'Slope, %', 'ID, m', 'C', 'Friction loss, m/m', 'Friction loss total, m', 'Elevation difference, m', 'Combined head loss, mSS', 'Diameter&pressure control', 'Velocity, m/s', 'Velocity control'];
    const N = LIB.length + 1;
    const names = Object.keys(hydro.fric || {}).filter(k => (hydro.fric[k] || []).length);
    for (const nm of names) {
      const rows = hydro.fric[nm], res = HT.friction(rows), w = {};
      H.forEach((h, i) => put(w, 1 + i, 2, vcell(h)));
      for (let i = 0; i < 15; i++) {
        const r = 3 + i, rw = rows[i] || {}, o = res.rows[i];
        put(w, 1, r, vcell(i + 1));
        if (rw.type) put(w, 2, r, vcell(rw.type)); if (rw.material) put(w, 3, r, vcell(rw.material));
        for (const [c, k] of [[4, 'pn'], [5, 'L'], [6, 'Q'], [7, 'h1']]) { const v = numIn(rw[k]); if (v !== null) put(w, c, r, vcell(v)); }
        if (i === 0) { const a = numIn(rw.h2), b = numIn(rw.pmin); if (a !== null) put(w, 8, r, vcell(a)); if (b !== null) put(w, 9, r, vcell(b)); }
        else { put(w, 8, r, fcell(`H${r - 1}`, o.I)); put(w, 9, r, fcell(`J${r - 1}+Q${r - 1}`, o.J, 2)); }
        put(w, 10, r, fcell(`IFERROR(ROUND(((I${r}-H${r})/F${r})*100,2),"")`, o.K ?? '', 2));
        put(w, 11, r, fcell(`IFERROR(INDEX('ANA BORULAR'!$C$2:$C$${N},MATCH(D${r}&E${r},'ANA BORULAR'!$E$2:$E$${N},0)),"")`, o.L ?? '', 1));
        put(w, 12, r, fcell(`IFERROR(INDEX('ANA BORULAR'!$D$2:$D$${N},MATCH(D${r},'ANA BORULAR'!$A$2:$A$${N},0)),"")`, o.M ?? ''));
        put(w, 13, r, fcell(`ROUND(IFERROR(((1.131*10^12)*(G${r}/M${r})^1.852*(L${r}^-4.87))/1000,0),4)`, o.N, 4));
        put(w, 14, r, fcell(`ROUND(IF(C${r}="Submain",N${r}*F${r}*0.354,N${r}*F${r}),2)`, o.O, 2));
        put(w, 15, r, fcell(`I${r}-H${r}`, o.P, 2));
        put(w, 16, r, fcell(`O${r}+P${r}`, o.Qc, 2));
        put(w, 17, r, fcell(`IF(G${r}>1,IF(OR(OR(Q${r}>F${r}*10,Q${r}*-1>F${r}*10),SUM(Q${r}:Q${r + 14})>F${r}*10),"DN, PN control","DN, PN matched"),"  ")`, o.R || '  '));
        put(w, 18, r, fcell(`ROUND(IFERROR((4*(G${r}/3600))/(3.14*((L${r}/1000)^2)),0),2)`, o.S, 2));
        put(w, 19, r, fcell(`IF(G${r}>1,IF(S${r}>1.8,"V control","V matched"),"  ")`, o.T || '  '));
      }
      put(w, 1, 20, vcell('1) Head Loss [∆H/L (m)] calculation is based on Hazen-Williams formula'));
      put(w, 1, 21, vcell('2) For Sub-main type, the F Factor assumes >200 supply points'));
      put(w, 1, 23, vcell(T('Gerekli giriş basıncı') + ', mSS')); put(w, 8, 23, fcell(`J${3 + Math.max(0, res.rows.filter(x => x.used).length - 1)}+Q${3 + Math.max(0, res.rows.filter(x => x.used).length - 1)}`, res.required ?? '', 2));
      w['!ref'] = 'A1:T23'; w['!cols'] = [{ wch: 3 }, { wch: 9 }, { wch: 12 }, { wch: 22 }, ...Array(16).fill({ wch: 13 })];
      XLSX.utils.book_append_sheet(wb, w, ('IRRIFRICT ' + nm).slice(0, 31));
    }
    // ANA BORULAR (Tablo11): Malzeme, PN, iç çap, C, anahtar = Malzeme&PN
    const pw = {}; ['Material', 'Pressure Rating/ Wall Thickness', 'Inner Diameter (mm)', 'C', 'Sütun1'].forEach((h, i) => put(pw, i, 1, vcell(h)));
    LIB.forEach(([m, pn, id, C], i) => { const r = i + 2; put(pw, 0, r, vcell(m)); put(pw, 1, r, vcell(pn)); put(pw, 2, r, vcell(id)); put(pw, 3, r, vcell(C)); put(pw, 4, r, fcell(`A${r}&B${r}`, m + String(pn))); });
    pw['!ref'] = 'A1:E' + N; pw['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 6 }, { wch: 26 }];
    XLSX.utils.book_append_sheet(wb, pw, 'ANA BORULAR');
    return wb;
  }
  function hydroWorkbook(XLSX, p, opt) { const wb = XLSX.utils.book_new(); hydroSheets(XLSX, wb, p.hydro || {}, opt); return wb; }

  g.IrriReportData = { akil, build, workbook, hydroSheets, hydroWorkbook };
  if (typeof module !== 'undefined') module.exports = g.IrriReportData;
})(typeof window !== 'undefined' ? window : globalThis);

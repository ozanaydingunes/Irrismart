// IrriGrow — PDF / Excel çıktısı ve dosya kaydetme
(function () {
  const RD = window.IrriReportData;
  const n = (v, d = 1) => (v == null || (typeof v === 'number' && !Number.isFinite(v))) ? '-' : typeof v === 'number' ? v.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }) : String(v);
  // Dosya adı yalnız ASCII: Chromium/Android bazı ASCII dışı adları ("Büyük tarla") "download" olarak kaydediyor.
  // Yalnız dosya adı sadeleşir (ü→u, ş→s, …); proje adı, PDF/Excel içeriği ve Türkçe metinler değişmez.
  // Dönüşüm bilgi kaybederse (Türkçe harf, Kiril, İbranice, Çince…) özgün addan türetilen sabit 4 karakterlik ek
  // eklenir: "Büyük tarla" ile "Buyuk tarla" ya da iki Rusça ad aynı dosya adına düşmez.
  const TR_ASCII = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' };
  const ozet = s => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36).slice(-4).padStart(4, '0'); };
  function safe(s) {
    const ham = String(s == null ? '' : s).trim();
    const a = ham.replace(/[çğıöşüÇĞİÖŞÜ]/g, c => TR_ASCII[c]).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9_\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60);
    // Kayıpsız: yalnız tek boşluklar '_' oldu ve özgün adda '_' yoktu ("A B" ile "A_B" ayrışır)
    const kayipsiz = ham.replace(/ /g, '_') === a && !/_|\s\s|[^\S ]/.test(ham);
    const kok = /[A-Za-z]/.test(a) ? a : ('proje' + (a ? '_' + a : ''));   // yalnız rakam kaldıysa ("Поле 1" → "1") okunur ön ek
    return kok + (kayipsiz || !ham ? '' : '-' + ozet(ham));
  }
  const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  function b64FromBuf(buf) { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }

  // Capacitor 6 yerel köprüsü eklentileri Capacitor.Plugins altında sunar (registerPlugin yalnız paketlenmiş JS'te var)
  function plugin(n) {
    const C = window.Capacitor; if (!C) return null;
    if (C.Plugins && C.Plugins[n]) return C.Plugins[n];
    if (typeof C.registerPlugin === 'function') return C.registerPlugin(n);
    return null;
  }
  const stamp = () => { const d = new Date(), p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
  const toast = m => window.IrriApp && window.IrriApp.toast(m);
  const T = (x, q) => window.IrriI18n ? window.IrriI18n.t(x, q) : x;

  // Dosya hazır paneli: Aç / Paylaş / (kayıt yeri)
  function sheet(info) {
    let el = document.getElementById('fileSheet');
    if (!el) { el = document.createElement('div'); el.id = 'fileSheet'; document.body.appendChild(el); }
    el.innerHTML = `<div class="sheet-bg"></div><div class="sheet"><b>${info.name}</b>
      <p class="muted small">${info.saved ? T('Cihaza kaydedildi: ') + info.saved : T('Cihaza kaydedilemedi; Paylaş ile Drive / Dosyalar\'a kaydedebilirsiniz.')}</p>
      <div class="row"><button class="btn primary" style="flex:1" data-a="open">${T('Aç')}</button><button class="btn" style="flex:1" data-a="share">${T('Paylaş')}</button></div>
      <button class="btn block ghost" data-a="close" style="margin-top:8px">${T('Kapat')}</button></div>`;
    el.classList.add('on');
    const close = () => el.classList.remove('on');
    el.querySelector('.sheet-bg').onclick = close;
    el.querySelector('[data-a=close]').onclick = close;
    el.querySelector('[data-a=open]').onclick = async () => {
      const FO = plugin('FileOpener');
      if (!FO) return toast(T('Dosya açıcı bulunamadı; Paylaş ile açın'));
      try { await FO.open({ filePath: info.uri, contentType: info.mime, openWithDefault: false }); }
      catch (e) { toast(/Activity not found|8/.test(String(e && (e.code || e.message))) ? T('Bu dosyayı açacak uygulama yok ({x} yükleyin) — Paylaş ile de açabilirsiniz', { x: info.mime.includes('pdf') ? T('PDF görüntüleyici') : 'Excel / Google Sheets' }) : T('Açılamadı: ') + (e.message || e)); }
    };
    el.querySelector('[data-a=share]').onclick = async () => {
      const SH = plugin('Share');
      if (!SH) return toast(T('Paylaşım eklentisi bulunamadı'));
      try { await SH.share({ title: info.name, files: [info.uri], dialogTitle: 'Dosyayı paylaş' }); }
      catch (e) { if (!/cancel/i.test(String(e && e.message))) toast(T('Paylaşılamadı: ') + (e.message || e)); }
    };
  }

  // Android'de aynı adlı dosyanın üzerine yazılmaz (tarayıcı kendisi yeniden adlandırır): ad_2, ad_3 …
  async function bosAd(FS, name) {
    const nokta = name.lastIndexOf('.'), kok = name.slice(0, nokta), uz = name.slice(nokta);
    for (let k = 1; k < 100; k++) {
      const ad = k === 1 ? name : `${kok}_${k}${uz}`;
      try { await FS.stat({ path: 'IrriGrow/' + ad, directory: 'DOCUMENTS' }); } catch (e) { return ad; }   // yoksa boş
    }
    return `${kok}_${Date.now()}${uz}`;
  }
  async function saveFile(base, ext, base64, mime) {
    let name = `${base}_${stamp()}.${ext}`;
    if (isNative()) {
      const FS = plugin('Filesystem');
      if (!FS) throw new Error(T('Dosya sistemi eklentisi bulunamadı'));
      if (FS.stat) name = await bosAd(FS, name);
      const w = await FS.writeFile({ path: name, data: base64, directory: 'CACHE' }); // açma/paylaşma için
      let saved = null;
      try { await FS.writeFile({ path: 'IrriGrow/' + name, data: base64, directory: 'DOCUMENTS', recursive: true }); saved = T('Belgeler') + ' / IrriGrow / ' + name; }
      catch (e) {
        try { const x = await FS.writeFile({ path: 'IrriGrow/' + name, data: base64, directory: 'EXTERNAL', recursive: true }); saved = 'Android/data/com.irrigrow.app.dev/files/IrriGrow / ' + name; }
        catch (e2) { /* yalnız paylaşım */ }
      }
      sheet({ name, uri: w.uri, mime, saved });
    } else {
      const bin = atob(base64), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([arr], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast(name + ' ' + T('indirildi'));
    }
    return name;
  }

  let logoCache = null;
  async function logoData() {
    if (logoCache) return logoCache;
    const buf = await (await fetch('img/logo.png')).arrayBuffer();
    const data = 'data:image/png;base64,' + b64FromBuf(buf);
    const ratio = await new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth / i.naturalHeight); i.onerror = () => res(1); i.src = data; });
    return (logoCache = { data, ratio });
  }
  let fontCache = null;
  async function fonts() {
    if (fontCache) return fontCache;
    const get = async f => b64FromBuf(await (await fetch('vendor/fonts/' + f)).arrayBuffer());
    fontCache = { r: await get('DejaVuSansCondensed.ttf'), b: await get('DejaVuSansCondensed-Bold.ttf') };
    return fontCache;
  }
  function svgToPng(svg, w) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); const k = w / img.width; c.width = w; c.height = Math.round(img.height * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); res({ data: c.toDataURL('image/png'), ratio: c.height / c.width }); };
      img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  // Çince ve İbranice için PDF İngilizce üretilir (gömülü yazı tipinde CJK yok; jsPDF sağdan sola dizgi yapmaz)
  async function pdf(p, r, svg) {
    const I = window.IrriI18n;
    if (I && ['he', 'zh'].includes(I.lang)) return I.withLang('en', () => pdfInner(p, r, svg));
    return pdfInner(p, r, svg);
  }
  async function pdfInner(p, r, svg) {
    const tr = (x, q) => window.IrriI18n ? window.IrriI18n.t(x, q) : x;
    const loc = window.IrriI18n ? window.IrriI18n.locale : 'tr-TR';
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const f = await fonts();
    doc.addFileToVFS('dv.ttf', f.r); doc.addFont('dv.ttf', 'DV', 'normal'); doc.addFileToVFS('dvb.ttf', f.b); doc.addFont('dvb.ttf', 'DV', 'bold');
    const T = RD.build(p, r), Wd = 210, M = 14; let y = 16;
    const need = h => { if (y + h > 284) { doc.addPage(); y = 16; } };
    const h1 = t => { need(14); doc.setFont('DV', 'bold'); doc.setFontSize(12); doc.setTextColor(15, 107, 69); doc.text(t, M, y); y += 2; doc.setDrawColor(15, 107, 69); doc.line(M, y, Wd - M, y); y += 5; doc.setTextColor(20, 30, 25); };
    const kv = rows => {
      doc.setFontSize(9);
      for (const [k, v, u, d] of rows) {
        const uu = u ? tr(u) : ''; const txt = typeof v === 'number' ? `${n(v, d ?? 1)}${uu ? ' ' + uu : ''}` : String(v ?? '') + (uu && typeof v !== 'string' ? ' ' + uu : '');
        const lines = doc.splitTextToSize(txt, 104); need(lines.length * 4.4 + 1);
        doc.setFont('DV', 'normal'); doc.setTextColor(95, 111, 102); doc.text(doc.splitTextToSize(String(k), 72), M, y);
        doc.setTextColor(20, 30, 25); doc.setFont('DV', 'bold'); doc.text(lines, M + 76, y); y += lines.length * 4.4 + 0.8;
      }
      y += 3;
    };
    const table = (rows, widths, dec, alignR) => {
      doc.setFontSize(7.6);
      rows.forEach((row, ri) => {
        const cells = row.map((c, ci) => doc.splitTextToSize(ri && typeof c === 'number' ? n(c, dec[ci] ?? 1) : String(c ?? ''), widths[ci] - 1.5));
        const hh = Math.max(...cells.map(c => c.length)) * 3.5 + 1.8; need(hh);
        if (ri === 0) { doc.setFillColor(227, 242, 234); doc.rect(M, y - 3.3, Wd - 2 * M, hh, 'F'); }
        doc.setFont('DV', ri === 0 ? 'bold' : 'normal');
        let x = M; cells.forEach((c, ci) => { const right = alignR.includes(ci); doc.text(c, right ? x + widths[ci] - 1 : x + 0.5, y, { align: right ? 'right' : 'left' }); x += widths[ci]; });
        y += hh; doc.setDrawColor(221, 229, 224); doc.line(M, y - 3.3, Wd - M, y - 3.3);
      });
      y += 3;
    };
    try { const lg = await logoData(), lh = 24, lw = lh * lg.ratio; doc.addImage(lg.data, 'PNG', M, 8, lw, lh); y = 8 + lh + 8; } catch (e) { /* logo yüklenemezse başlıksız devam */ }
    doc.setFont('DV', 'bold'); doc.setFontSize(17); doc.setTextColor(15, 81, 50); doc.text(tr('Damla Sulama Ön Projesi'), M, y); y += 7;
    doc.setFont('DV', 'normal'); doc.setFontSize(10); doc.setTextColor(95, 111, 102); doc.text(`${p.name} · IrriGrow · ${new Date().toLocaleDateString(loc)}`, M, y); y += 8;
    h1(tr('Proje özeti')); kv(T.ozet);
    if (T.parsel) {   // çoklu parsel: parsel bazlı alan ve hidrolik özet, proje toplamı
      h1(tr('Parseller ve proje toplamı'));
      table(T.parsel.rows, [36, 16, 16, 20, 13, 21, 18, 42], T.parsel.dec, [1, 2, 3, 4, 5, 6]);
      doc.setFont('DV', 'normal'); doc.setFontSize(8.2); doc.setTextColor(95, 111, 102);
      for (const nt of T.parsel.notlar) { const ln = doc.splitTextToSize(nt, Wd - 2 * M); need(ln.length * 3.8 + 1); doc.text(ln, M, y); y += ln.length * 3.8 + 1; }
      doc.setTextColor(20, 30, 25); y += 3;
    }
    // MH-AKIL-1: mühendislik değerlendirmesi (Sonuç ekranıyla aynı nesne); kritik uyarılar önce
    h1(tr('Mühendislik değerlendirmesi'));
    if (!T.akil.findings.length) kv([[tr('Durum'), tr('Yapılandırılmış uyarı yok.'), '', null]]);
    for (const x of T.akil.findings) {
      need(12); doc.setFont('DV', 'bold'); doc.setFontSize(10);
      const col = x.seviye === 'uygunsuz' ? [163, 32, 26] : x.seviye === 'uyari' ? [122, 74, 0] : x.seviye === 'on-degerlendirme' ? [122, 74, 0] : [29, 78, 137];
      doc.setTextColor(...col); const hl = doc.splitTextToSize(x.head, Wd - 2 * M); doc.text(hl, M, y); y += hl.length * 4.6 + 1; doc.setTextColor(20, 30, 25);
      kv(x.kv);
      if (x.sols.length > 1) table(x.sols, [40, 30, 78, 34], [], []);
    }
    if (svg) { try { const img = await svgToPng(svg, 1400); const iw = Wd - 2 * M, ih = Math.min(iw * img.ratio, 200); const iw2 = ih / img.ratio; need(ih + 14); h1(tr('Yerleşim planı')); doc.addImage(img.data, 'PNG', M + (iw - iw2) / 2, y, iw2, ih); y += ih + 6; } catch (e) { /* plan çizilemezse rapor yine üretilir */ } }
    h1(tr('Hidrolik hesaplar')); kv(T.hidrolik);
    h1(tr('Shift’ler')); table(T.sektor, T.sektorPdf.w, T.sektorDec, T.sektorPdf.num);
    h1(tr('Shift planlaması alternatifleri')); table(T.altSek, [13, 18, 15, 13, 20, 14, 13, 19, 23, 34], T.altSekDec, [0, 1, 2, 5, 6, 7, 8]);
    h1(tr('Ana hat alternatifleri')); table(T.altHat, [11, 9, 13, 13, 15, 19, 19, 19, 19, 45], T.altHatDec, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    h1(tr('Su ihtiyacı ve sulama programı')); kv(T.su); table(T.prog, [20, 18, 24, 24, 24, 38, 34], T.progDec, [1, 2, 3, 4, 5, 6]);
    h1(tr('Malzeme listesi — fiyatlı kalemler')); table(T.bomP, [18, 66, 17, 11, 21, 23, 26], T.bomDec, [2, 4, 5]);
    if (T.bomU.length > 1) { h1(tr('Malzeme listesi — fiyatı eksik kalemler')); table(T.bomU, [24, 110, 24, 24], T.bomDec, [2]); }
    if (p.hydro) {
      const HT = window.IrriHydroTable, fs = (p.hydro.fields || []).map(f => [f, HT.systemField(f || {})]).filter(([f, o]) => o.used);
      if (fs.length) {
        h1(tr('Hidrolik Hesap Tablosu') + ' — SİSTEM');
        const rows = [['', ...fs.map((x, i) => (x[0].crop || 'Field ' + (i + 1)))]];
        const lab = [['area', 'Alan', 'da', 2], ['et', 'ET', 'mm/gün', 2], ['T', 'T', 'h', 1], ['rate', 'Sulama hızı', 'mm/h', 2], ['Qp', 'Q bitki', 'l/h', 2], ['Tp', 'T bitki', 'h/gün', 2], ['maxShift', 'Max Shift (h)', '', 0], ['shifts', 'Shift #', '', 0], ['totalTime', 'Toplam Sulama Süresi', 'h', 1], ['totalQ', 'Toplam Debi', 'm³/h', 1], ['shiftQ', 'Shift Debi', 'm³/h', 1], ['parcels', 'Parsel Sayısı', '', 0], ['parcelQ', 'Ort. Parsel Debi', 'm³/h', 2], ['valves', 'Aynı Anda Çal. Vana', '', 0], ['shiftMax', 'Shift Debi MAX', 'm³/h', 2], ['shiftMin', 'Shift Debi MIN', 'm³/h', 2]];
        for (const [k, l, u, d] of lab) rows.push([tr(l) + (u ? ' (' + tr(u) + ')' : ''), ...fs.map(([f, o]) => { const v = o[k] !== undefined ? o[k] : Number(String(f[k] ?? '').replace(',', '.')); return Number.isFinite(v) ? n(v, d) : ''; })]);
        const w0 = 62, wc = Math.min(30, (Wd - 2 * M - w0) / fs.length); table(rows, [w0, ...fs.map(() => wc)], [], fs.map((x, i) => i + 1));
      }
      for (const [nm, segs] of Object.entries(p.hydro.fric || {})) {
        if (!segs || !segs.length) continue;
        const fr = HT.friction(segs), used = fr.rows.filter(o => o.used);
        h1(tr('Sürtünme') + ' (IRRIFRICT) — ' + nm);
        const rows = [['#', tr('Tip'), tr('Malzeme'), 'PN', 'L m', 'Q m³/h', 'ID', tr('Kayıp') + ' m', 'Δz m', 'Σ m', 'v m/s', tr('Basınç') + ' m']]
          .concat(used.map(o => [o.i + 1, o.type, o.material, o.pn, o.F, o.G, o.L ?? '', o.O, o.P, o.Qc, o.S, o.J]));
        table(rows, [7, 17, 36, 10, 14, 16, 14, 16, 13, 13, 14, 12], [0, null, null, null, 1, 2, 1, 2, 2, 2, 2, 2], [0, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        kv([[tr('Gerekli giriş basıncı'), fr.required ?? '—', 'mSS', 2]]);
      }
    }
    h1(tr('Maliyet')); kv(T.toplam);
    if (T.akil.other.length) { h1(tr('Diğer hesap notları')); kv(T.akil.other.map((w, i) => [String(i + 1), w, '', null])); }
    h1(tr('Varsayımlar')); kv(r.asm.map((a, i) => [String(i + 1), a, '', null]));
    // K-5: kot/parsel kaynağı, atıflar ve kot verisinin sınırları (yalnız haritadan kot alınmış veya KML/KMZ ile içe aktarılmış projede)
    const kaynak = window.IrriKaynak ? window.IrriKaynak.projeSatirlari(p, tr, (v, d) => n(v, d)) : [];
    if (kaynak.length) { h1(tr('Veri kaynakları ve sınırlamalar')); kv(kaynak.map((a, i) => [String(i + 1), a, '', null])); }
    need(18); doc.setFont('DV', 'normal'); doc.setFontSize(8); doc.setTextColor(95, 111, 102);
    doc.text(doc.splitTextToSize(tr('Bu rapor ön projelendirme amaçlıdır. Hesaplar FAO-56, Keller & Bliesner, Watters-Keller ve Hazen-Williams (C=150) bağıntılarıyla yapılmıştır. "Jenerik" veya "örnek" olarak işaretli ekipman ve fiyatlar gerçek ürün verisi değildir; uygulama öncesi saha ölçümü, su analizi ve üretici kataloğu değerleriyle kontrol edilmelidir.'), Wd - 2 * M), M, y);
    const pages = doc.getNumberOfPages(); for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(8); doc.text(`${i} / ${pages}`, Wd - M, 292, { align: 'right' }); }
    return saveFile(`IrriGrow_${safe(p.name)}`, 'pdf', doc.output('datauristring').split(',')[1], 'application/pdf');
  }

  async function xlsx(p, r) {
    const b64 = XLSX.write(RD.workbook(XLSX, p, r), { bookType: 'xlsx', type: 'base64' });
    return saveFile(`IrriGrow_${safe(p.name)}`, 'xlsx', b64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  async function hydroXlsx(p) {
    const b64 = XLSX.write(RD.hydroWorkbook(XLSX, p), { bookType: 'xlsx', type: 'base64' });
    return saveFile(`IrriGrow_${safe(p.name)}_hidrolik`, 'xlsx', b64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  async function json(base, obj) { return saveFile(base, 'json', btoa(unescape(encodeURIComponent(JSON.stringify(obj, null, 2)))), 'application/json'); }

  // Ölçekli, vektörel PDF pafta: çizim modelinden (ekran görüntüsü değil). Çoklu paftada her pafta ayrı sayfa.
  async function sheetPdf(p, M, o) {
    const Dr = window.IrriDrawing, I = window.IrriI18n;
    const run = async () => {
      const t = (x, q) => I ? I.t(x, q) : x;
      const first = Dr.sheet(M, Object.assign({}, o, { t }));
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: [first.W, first.H], orientation: first.W > first.H ? 'landscape' : 'portrait', compress: true });
      const f = await fonts();
      doc.addFileToVFS('dv.ttf', f.r); doc.addFont('dv.ttf', 'DV', 'normal'); doc.addFileToVFS('dvb.ttf', f.b); doc.addFont('dvb.ttf', 'DV', 'bold');
      const tiles = o.multi ? first.tiles : { nx: 1, ny: 1, n: 1 };
      let pg = 0;
      for (let j = 0; j < tiles.ny; j++) for (let i = 0; i < tiles.nx; i++) {
        if (pg++) doc.addPage([first.W, first.H], first.W > first.H ? 'landscape' : 'portrait');
        const S = Dr.sheet(M, Object.assign({}, o, { t, tile: { i, j } }));
        Dr.toPDF(doc, S, 'DV');
      }
      doc.setProperties({ title: `${p.name} — ${o.format} 1:${first.scale}`, subject: 'IrriGrow sulama projesi', creator: 'IrriGrow' });
      return saveFile(`IrriGrow_${safe(p.name)}_pafta_${o.format}`, 'pdf', doc.output('datauristring').split(',')[1], 'application/pdf');
    };
    if (I && ['he', 'zh'].includes(I.lang)) return I.withLang('en', run);
    return run();
  }
  async function dxf(p, M) {
    const D = window.IrriDrawing.toDXF(M, { t: window.IrriI18n ? window.IrriI18n.t : x => x });
    return saveFile(`IrriGrow_${safe(p.name)}`, 'dxf', b64FromBuf(D.bytes.buffer.slice(D.bytes.byteOffset, D.bytes.byteOffset + D.bytes.byteLength)), 'application/dxf');
  }

  window.IrriReport = { pdf, xlsx, hydroXlsx, json, plugin, sheetPdf, dxf, saveFile, dosyaAdi: safe };
})();

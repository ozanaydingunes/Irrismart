// IrriGrow 1.0.1 — Shift Yönetimi: taslak düzenin özeti, önce/sonra karşılaştırması, çalışma sırası ve hedef debi.
// Saf modül: DOM, depolama ve ağ kullanmaz; hesap motorunu değiştirmez. Bütün sayılar motorun sonucundan
// (E.design) ve aynı sonuçtan üretilen görünüm modelinden (IrriHydroView.build) okunur; burada tahmin üretilmez.
// Metinler Türkçe anahtardır; çağıran taraf t() ile çevirir.
//  - Çalışma sırası (shiftSira) yalnız program ve rapor sırasıdır: hidrolik hesabı değiştirmez.
//  - Hedef debi (shiftHedef) yalnız bilgi amaçlıdır: hesaplanan debiyle yan yana gösterilir, fiziği değiştirmez.
(function (g) {
  const fin = v => typeof v === 'number' && Number.isFinite(v);

  // Çalışma sırası: 0..n-1'in bir permütasyonu mu
  function siraGecerli(sira, n) {
    if (!Array.isArray(sira) || sira.length !== n) return false;
    const s = new Set(sira);
    return s.size === n && sira.every(v => Number.isInteger(v) && v >= 0 && v < n);
  }
  const siraVarsayilan = n => Array.from({ length: n }, (_, i) => i);
  const siraOf = (sira, n) => siraGecerli(sira, n) ? sira.slice() : siraVarsayilan(n);
  // Sıradaki i. konumdaki shift'i bir yukarı (-1) veya aşağı (+1) taşır
  function siraTasi(sira, i, yon) {
    const s = sira.slice(), k = i + yon;
    if (i < 0 || i >= s.length || k < 0 || k >= s.length) return s;
    [s[i], s[k]] = [s[k], s[i]];
    return s;
  }
  const siraVarsayilanMi = s => s.every((v, i) => v === i);

  // Alt ünite k'yi shift q'ya taşı; boşalan shift numaraları sıkıştırılır (mevcut "select[data-unit]" davranışıyla aynı)
  function ataTasi(assign, k, q) {
    const a = assign.slice(); a[k] = q;
    const ids = [...new Set(a)].sort((x, y) => x - y), mp = new Map(ids.map((v, i) => [v, i]));
    return a.map(v => mp.get(v));
  }
  const atamaOf = r => { const m = []; r.sel.groups.forEach((gr, j) => gr.forEach(k => { m[k] = j; })); return m; };

  // Shift sayısı değişince eski sıra yeni düzene uymaz; yalnız geçerliyse korunur
  const siraUyar = (sira, n) => siraGecerli(sira, n) ? sira.slice() : null;

  // Hedef debiden sapma (%): hesaplanan debi ile kullanıcının hedefi; hedef yoksa null
  const hedefSapma = (Q, hedef) => fin(Q) && fin(hedef) && hedef > 0 ? (Q - hedef) / hedef * 100 : null;
  function hedefOku(v) {
    if (v == null || v === '') return null;
    const x = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
    return Number.isFinite(x) && x > 0 ? x : NaN;
  }

  // Bir sonucun özeti (karşılaştırma ve panel için). vm = IrriHydroView.build(r, …), A = IrriAssess.forProject(…)
  function ozet(r, vm, A) {
    if (!r || !r.ok || !vm || !vm.ok) return null;
    const sel = r.sel, ms = r.main.sel, p = r.pump;
    const D = vm.shift.details;
    const mainHf = d => { const b = (d.breakdown || []).find(x => /^Ana hat sürtünmesi/.test(x.label)); return b ? b.v : null; };
    const shifts = D.map(d => ({
      j: d.j, no: d.no, units: d.units.slice(), A: d.A, Q: d.Q, H: d.H, Hbar: d.Hbar, Hp: d.Hp, Hd: d.Hd, surplus: d.surplus,
      dur: d.dur, vol: d.vol, nLat: d.nLat, overSource: d.overSource, regulator: d.regulator, kWh: d.kWh,
      hfMain: mainHf(d), critUnit: d.critUnit ? d.critUnit.id : null,
      pump: d.pump ? { Q: d.pump.Q, Hreq: d.pump.Hreq, H: d.pump.H, eta: d.pump.eta, P: d.pump.P, src: d.pump.src } : null,
      status: (vm.shift.list[d.j] || {}).status || 'ok',
    }));
    const jc = vm.jCrit != null ? vm.jCrit : shifts.reduce((m, s, j) => s.H > shifts[m].H ? j : m, 0);
    const net = (r.main.net || []).filter(x => x.kind !== 'kaynak');
    const cnt = (A && A.count) || {};
    return {
      Ns: sel.groups.length, manual: !!sel.manual, shifts, jCrit: jc,
      Qmax: Math.max(...sel.Qj), Qmin: Math.min(...sel.Qj), Qtoplam: r.sectors.Qfield,
      Qkritik: sel.Qj[jc], vMain: net.length ? Math.max(...net.map(x => x.v)) : null, mainOd: ms.od, mainPn: ms.pn,
      Hmax: ms.Hmax, hfKritik: shifts[jc] ? shifts[jc].hfMain : null,
      pompa: p.need ? { Q: p.Q, H: p.H, motor: p.motor, ad: p.fromCatalog ? p.ad : null } : null,
      dur: r.schedule.t, tur: r.schedule.cycleHours, kWh: r.schedule.kWh, feasible: sel.feasible !== false,
      saatGun: r.schedule.hoursPerDay, aralik: r.schedule.interval, avail: sel.avail,
      uygunsuz: cnt.uygunsuz || 0, uyari: cnt.uyari || 0, kontrolBad: vm.count.bad, kontrolWarn: vm.count.warn, kontrolOk: vm.count.ok,
      // Resmî değerlendirme (Sonuç/PDF/Excel ile aynı IrriAssess sonucu): uygunsuz bulgu kodları ve kapasite bulguları
      bulgular: A && A.findings ? A.findings.filter(x => x.seviye === 'uygunsuz').map(x => x.kod) : null,
      kap01: !!(A && A.findings && A.findings.some(x => x.kod === 'W-KAP-01')),
      kap02: !!(A && A.findings && A.findings.some(x => x.kod === 'W-KAP-02')),
      kap03: !!(A && A.findings && A.findings.some(x => x.kod === 'W-KAP-03')),
    };
  }

  // Uygunluk sınırları (yalnız motor sonucundan ve proje verisinden; motorun kendi ölçütüyle aynı):
  //  - kaynak: her shift'in hesaplanan debisi ≤ su kaynağı debisi (shift'ler ardışık çalışır)
  //  - kapasite: günlük gereken hacim (toplam debi × shift süresi ÷ aralık) ≤ kaynak debisi × günlük çalışma süresi
  //    (gerekli koşul; yeterli değildir)
  //  - gunluk: günlük gereken sulama süresi (tur ÷ aralık) ≤ günlük kullanılabilir süre
  //  - tur: tur süresi ≤ günlük süre × sulama aralığı (motorun 'feasible' ölçütü)
  // Hedef debi bu denetimlerde KULLANILMAZ. Günlük süre girilmemişse motorun varsayılanı (20 h) kullanılır ve belirtilir.
  // 1.0.1 düzeltmesi (cihaz testi, Hata 2): her satırın durumu açıkça belirtilir ve genel sonuç resmî değerlendirmeyle
  // (IrriAssess: W-KAP-01/02/03 ve diğer uygunsuz bulgular) aynı olur. Durumlar:
  //   'uygun' | 'sinirda' (teknik olarak uygun, işletme payı az) | 'varsayim' (girilmemiş veri, motor varsayılanıyla hesaplandı)
  //   | 'veri-yok' (denetlenemedi) | 'uygun-degil'
  // Eksik veya varsayımlı veri ASLA 'uygun' sayılmaz. Kullanıcının kararı (onay) bu sonucu değiştirmez.
  const DURUM_OK = { uygun: true, sinirda: true, varsayim: null, 'veri-yok': null, 'uygun-degil': false };
  function uygunluk(o, Qsrc, inp) {
    if (!o) return Object.assign([], { genel: 'dogrulanamadi', bulgular: [] });
    const varsayilan = !(inp && inp.hours != null && String(inp.hours).trim() !== '');
    const Qs = fin(Number(Qsrc)) && Number(Qsrc) > 0 ? Number(Qsrc) : null;
    const gerekGun = o.Qtoplam * o.dur / o.aralik, kapGun = Qs != null ? Qs * o.saatGun : null;
    const kaynakD = Qs == null ? 'veri-yok' : (o.Qmax <= Qs + 1e-9 && !o.kap03) ? 'uygun' : 'uygun-degil';
    const kapD = kapGun == null ? 'veri-yok' : gerekGun > kapGun + 1e-6 ? 'uygun-degil' : varsayilan ? 'varsayim' : 'uygun';
    const gunD = o.tur / o.aralik > o.saatGun + 1e-9 ? 'uygun-degil' : varsayilan ? 'varsayim' : 'uygun';
    const turD = (!o.feasible || o.kap01) ? 'uygun-degil' : varsayilan ? 'varsayim' : o.kap02 ? 'sinirda' : 'uygun';
    const satir = (k, ad, deger, sinir, birim, d, durum, not) => ({ k, ad, deger, sinir, birim, d, durum, ok: DURUM_OK[durum], not });
    const L = [
      satir('kaynak', 'Kaynak debisi', o.Qmax, Qs, 'm³/h', 1, kaynakD, Qs == null ? 'Su kaynağı debisi girilmedi: denetlenemedi' : 'En büyük shift debisi ≤ su kaynağı debisi'),
      satir('kapasite', 'Kaynak günlük kapasitesi', gerekGun, kapGun, 'm³/gün', 0, kapD, Qs == null ? 'Su kaynağı debisi girilmedi: denetlenemedi' : 'Günlük gereken hacim ≤ kaynak debisi × günlük çalışma süresi (gerekli koşul, yeterli değil)'),
      satir('gunluk', 'Günlük sulama süresi', o.tur / o.aralik, o.saatGun, 'h/gün', 1, gunD, varsayilan ? 'Günlük çalışma süresi girilmedi: varsayılan değer kullanıldı' : 'Günlük gereken süre ≤ günlük kullanılabilir süre'),
      satir('tur', 'Tur süresi', o.tur, o.avail, 'h', 1, turD, turD === 'sinirda' ? 'Teknik olarak uygun; işletme payı (planlama sınırı) aşıldı' : 'Tur süresi ≤ günlük süre × sulama aralığı'),
    ];
    // Panelde gösterilmeyen diğer uygunsuz bulgular (ör. W-PN-02) da genel sonuca girer
    const bulgular = (o.bulgular || []).slice();
    const durumlar = L.map(x => x.durum);
    L.genel = durumlar.includes('uygun-degil') || bulgular.length ? 'uygun-degil'
      : durumlar.includes('veri-yok') || o.bulgular == null ? 'dogrulanamadi'
      : durumlar.includes('varsayim') ? 'varsayimla'
      : durumlar.includes('sinirda') ? 'sinirda' : 'uygun';
    L.bulgular = bulgular; L.varsayilan = varsayilan;
    return L;
  }
  // Teknik olarak uygun mu: yalnız 'uygun' ve 'sinirda'. Varsayımlı/eksik veri ve uygunsuz bulgu → hayır
  const uygunMu = L => !!L && (L.genel === 'uygun' || L.genel === 'sinirda');

  // Önce/sonra satırları. iyi: 'az' → düşük değer iyidir, 'cok' → yüksek değer iyidir, null → yön yok (bilgi)
  const SATIR = [
    ['Ns', 'Shift sayısı', '', 0, null],
    ['Qmax', 'En büyük shift debisi', 'm³/h', 2, 'az'],
    ['Qmin', 'En küçük shift debisi', 'm³/h', 2, null],
    ['Qkritik', 'Kritik shift debisi', 'm³/h', 2, null],
    ['vMain', 'Ana hat en büyük hız', 'm/s', 2, 'az'],
    ['Hmax', 'Gerekli basma yüksekliği (maks.)', 'm', 2, 'az'],
    ['hfKritik', 'Kritik shift ana hat kaybı', 'm', 2, 'az'],
    ['pompaQ', 'Pompa görev noktası debisi', 'm³/h', 2, null],
    ['pompaH', 'Pompa görev noktası basıncı', 'm', 2, 'az'],
    ['motor', 'Pompa motor gücü', 'kW', 1, 'az'],
    ['dur', 'Shift başına süre', 'h', 2, null],
    ['tur', 'Bir tur süresi', 'h', 1, 'az'],
    ['kWh', 'Sezonluk enerji', 'kWh', 0, 'az'],
    ['uygunsuz', 'Uygunsuz bulgu', 'adet', 0, 'az'],
    ['uyari', 'Uyarı', 'adet', 0, 'az'],
  ];
  const deger = (o, k) => k === 'pompaQ' ? (o.pompa ? o.pompa.Q : null) : k === 'pompaH' ? (o.pompa ? o.pompa.H : null) : k === 'motor' ? (o.pompa ? o.pompa.motor : null) : o[k];
  function karsilastir(a, b) {
    if (!a || !b) return [];
    return SATIR.map(([k, label, unit, d, iyi]) => {
      const x = deger(a, k), y = deger(b, k), dl = fin(x) && fin(y) ? y - x : null;
      const esik = Math.pow(10, -d) / 2, ayni = dl != null && Math.abs(dl) < esik;
      const yon = dl == null || ayni || !iyi ? 'ayni' : (iyi === 'az') === (dl < 0) ? 'iyi' : 'kotu';
      return { k, label, unit, d, once: x ?? null, sonra: y ?? null, fark: dl, yon: dl == null && x !== y ? 'bilgi' : yon };
    });
  }
  const degisti = rows => rows.some(x => x.yon !== 'ayni');

  // Taslak ile mevcut kayıt aynı mı (Uygula düğmesi için)
  function esit(a, b) {
    const n = x => JSON.stringify({ Ns: x.Ns ?? null, manual: x.manual ? x.manual.assign : null, sira: x.sira || null, hedef: x.hedef ?? null });
    return n(a) === n(b);
  }

  // Rapor sırası: geçerli sıra varsa shift dizinlerini o sırayla döndürür, yoksa null (raporlar değişmez)
  const raporSirasi = (p, r) => p && r && r.ok && siraGecerli(p.shiftSira, r.sel.groups.length) && !siraVarsayilanMi(p.shiftSira) ? p.shiftSira.slice() : null;

  const api = Object.freeze({ uygunluk, uygunMu, siraGecerli, siraVarsayilan, siraOf, siraTasi, siraUyar, siraVarsayilanMi, ataTasi, atamaOf, hedefSapma, hedefOku, ozet, karsilastir, degisti, esit, raporSirasi, SATIR });
  g.IrriShiftYonetimi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

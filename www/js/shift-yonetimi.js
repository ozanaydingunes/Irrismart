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
  function ozet(r, vm, A, Gm) {
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
      // 1.0.3 PR-2: bütün bulgular (bilgi hariç) — giderilen / yeni / devam eden karşılaştırması için
      bulguListe: A && A.findings ? A.findings.filter(x => x.seviye !== 'bilgi').map(x => ({ kod: x.kod, seviye: x.seviye, baslik: x.baslik })) : null,
      kontroller: (vm.checks || []).map(c => ({ kod: c.kod, level: c.level, title: c.title, text: c.text, params: c.params })),
      // Günlük su ihtiyacı (m³/gün) = toplam debi × shift süresi ÷ aralık (resmî kapasite denetimiyle aynı)
      gunlukSu: r.sectors.Qfield * r.schedule.t / r.schedule.interval,
      // Alan: gerçek geometri (alt ünite poligonları) ve hesapta kullanılan alan payı (debi oranı) ayrı tutulur
      alanGeo: Gm ? (geoAlan(r, Gm) || { shift: null }).shift : null,
      alanPay: shifts.map(x => x.A),
    };
  }

  // Bulgu farkı: önceki ve taslak düzenin resmî bulguları (bilgi hariç). Kullanıcı kararı (onay) bulguyu kaldırmaz:
  // karşılaştırma yalnız hesap sonucuna bakar.
  function bulguFarki(a, b) {
    if (!a || !b || !a.bulguListe || !b.bulguListe) return null;
    const A = new Map(a.bulguListe.map(x => [x.kod, x])), B = new Map(b.bulguListe.map(x => [x.kod, x]));
    return {
      giderilen: [...A.values()].filter(x => !B.has(x.kod)),
      yeni: [...B.values()].filter(x => !A.has(x.kod)),
      devam: [...B.values()].filter(x => A.has(x.kod)).map(x => Object.assign({}, x, { onceki: A.get(x.kod).seviye })),
    };
  }
  // Seçili shift'e ait satırlar (aynı numaralı shift, önce ve sonra) + günlük su ihtiyacı
  function secSatirlar(a, b, j) {
    if (!a || !b) return [];
    const sa = a.shifts[j], sb = b.shifts[j];
    const row = (k, label, x, y, unit, d, iyi) => { const dl = fin(x) && fin(y) ? y - x : null, ayni = dl != null && Math.abs(dl) < Math.pow(10, -d) / 2;
      return { k, label, unit, d, once: fin(x) ? x : null, sonra: fin(y) ? y : null, fark: dl, yon: dl == null ? (x === y ? 'ayni' : 'bilgi') : ayni || !iyi ? 'ayni' : (iyi === 'az') === (dl < 0) ? 'iyi' : 'kotu' }; };
    return [
      row('secAlan', 'Seçili shift alanı (geometri)', a.alanGeo ? a.alanGeo[j] : null, b.alanGeo ? b.alanGeo[j] : null, 'da', 2, null),
      row('secQ', 'Seçili shift hesaplanan debisi', sa ? sa.Q : null, sb ? sb.Q : null, 'm³/h', 2, null),
      row('gunlukSu', 'Günlük su ihtiyacı', a.gunlukSu, b.gunlukSu, 'm³/gün', 0, null),
    ];
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
    const n = x => JSON.stringify({ Ns: x.Ns ?? null, manual: x.manual ? x.manual.assign : null, sira: x.sira || null, hedef: x.hedef ?? null, hedefler: x.hedefler && Object.keys(x.hedefler).length ? x.hedefler : null });
    return n(a) === n(b);
  }

  // Rapor sırası: geçerli sıra varsa shift dizinlerini o sırayla döndürür, yoksa null (raporlar değişmez)
  const raporSirasi = (p, r) => p && r && r.ok && siraGecerli(p.shiftSira, r.sel.groups.length) && !siraVarsayilanMi(p.shiftSira) ? p.shiftSira.slice() : null;

  // Shift başına GERÇEK alan (da): alt ünitelerin harita/yerleşim poligonlarından (motorun kullandığı aynı kırpma).
  // Mevcut ekranlardaki "alan payı debi oranından" değeri değişmez; bu değer yalnız yeni Shift panelinde gösterilir.
  // Geometri yoksa null (ekranda "Hesaplanamadı").
  function geoAlan(r, Gm) {
    const Ly = r && r.ok && r.layout; if (!Ly || !Ly.P || !Ly.bands || !Gm || !Gm.clipRect) return null;
    const birim = r.units.map(u => { const b = Ly.bands[u.band]; if (!b) return NaN; const c = Gm.clipRect(Ly.P, b.x0, b.x1, u.y0, u.y1); let a = 0; for (let i = 0; i < c.length; i++) { const p = c[i], q = c[(i + 1) % c.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2 / 1000; });
    if (birim.some(x => !fin(x))) return null;
    return { birim, shift: r.sel.groups.map(g => g.reduce((t, k) => t + birim[k], 0)) };
  }
  // Alt ünitenin lateralleri: sayı ve en uzun boy (yerleşimden)
  function birimLateral(r, k) {
    const u = r.units[k], lo = Math.min(u.y0, u.y1) - 1e-6, hi = Math.max(u.y0, u.y1) + 1e-6;
    const L = (r.layout.laterals || []).filter(l => l.band === u.band && l.y >= lo && l.y <= hi);
    return { n: u.nLat, enUzun: L.length ? Math.max(...L.map(l => l.len)) : null };
  }

  // 1.0.4: shift başına hedef debi (yalnız bilgi). Kayıt { Ns, deger: { "0": 70, … } }; yalnız aynı shift sayısında geçerli.
  function hedefler(kayit, n) {
    if (!kayit || typeof kayit !== 'object' || kayit.Ns !== n || !kayit.deger || typeof kayit.deger !== 'object') return null;
    const d = {}; for (const [k, v] of Object.entries(kayit.deger)) { const j = Number(k); if (Number.isInteger(j) && j >= 0 && j < n && fin(v) && v > 0) d[j] = v; }
    return Object.keys(d).length ? d : null;
  }
  const hedefOf = (hs, genel, j) => hs && fin(hs[j]) ? hs[j] : fin(genel) && genel > 0 ? genel : null;

  // ---------- Shift sayısı sınırları (1.0.5 cihaz testi: pasif − / + düğmelerinin nedeni) ----------
  // Fiziksel sınırlar motorla aynı kuraldan türetilir (motor değişmez):
  //  alt: kaynak debisi — daha az shift'te en az bir shift'in debisi kaynak debisini aşar (IrriLayout.minSectors)
  //  üst: alt ünite sayısı — her shift en az bir alt ünite içerir
  // Otomatik arama aralığı (motorun hesapladığı adaylar) bu fiziksel aralığın bir alt kümesidir; ayrı raporlanır.
  function minShift(Qu, Qs) {
    if (!(Qs > 0) || !Qu.length) return null;
    let n = 0, t = 0; for (const q of Qu) { if (q > Qs + 1e-9) return Infinity; if (t + q > Qs + 1e-9) { n++; t = 0; } t += q; }
    return n + (t > 0 ? 1 : 0);
  }
  function nsSinirlari(r, Qs) {
    const Qu = (r && r.units || []).map(u => u.Q), nU = Qu.length, m = minShift(Qu, Qs);
    const oto = (r && r.sectorAlts || []).filter(a => !a.manual).map(a => a.Ns).sort((a, b) => a - b);
    return { nU, Qs: Qs > 0 ? Qs : null, min: Number.isFinite(m) ? m : null, imkansiz: m === Infinity, oto, otoMin: oto.length ? oto[0] : null, otoMax: oto.length ? oto[oto.length - 1] : null };
  }
  // Pasif − / + nedeni: { kod, n, nU, Qs, min, otoMin, otoMax } (metin çevirisi arayüzde yapılır). null: düğme etkin.
  function nsPasifNedeni(s, n, yon) {
    const o = { n, nU: s.nU, Qs: s.Qs, min: s.min, otoMin: s.otoMin, otoMax: s.otoMax };
    if (yon < 0) {
      if (s.oto.some(k => k < n)) return null;
      if (n <= 1) return Object.assign(o, { kod: 'en-az-bir' });
      if (s.min != null && n <= s.min) return Object.assign(o, { kod: 'kaynak' });
      return Object.assign(o, { kod: 'oto-aralik' });
    }
    if (s.oto.some(k => k > n)) return null;
    if (n >= s.nU) return Object.assign(o, { kod: 'alt-unite' });
    return Object.assign(o, { kod: 'oto-aralik' });
  }
  // Elle istenen shift sayısı motora gönderilmeden önce doğrulanır: tam sayı, fiziksel aralıkta.
  function nsDogrula(k, s) {
    if (typeof k !== 'number' || !Number.isInteger(k)) return { ok: false, kod: 'tam-sayi' };
    if (k < 1) return { ok: false, kod: 'en-az-bir' };
    // Motorun hesapladığı aday her zaman geçerlidir (kayıtlı sayı aday listesine motor tarafından eklenir)
    if (s.oto.includes(k)) return { ok: true, otomatikAralikta: true };
    if (s.imkansiz) return { ok: false, kod: 'unite-kaynak' };
    if (k > s.nU) return { ok: false, kod: 'alt-unite' };
    if (s.min != null && k < s.min) return { ok: false, kod: 'kaynak' };
    return { ok: true, otomatikAralikta: s.oto.includes(k) };
  }

  // ---------- Manuel mod: istenen shift sayısına gerçek alt ünite ataması ----------
  // Motorun bölmesi (Ly.partition) her k için tam k grup üretmeyebilir; manuel modda sayı motora açık atama olarak gider.
  // Bitişiklik korunur (alt üniteler sıralı); grup sayısı k'dan azsa en büyük debili grup (≥ 2 üniteli) debi ortasından ikiye bölünür.
  // Dönüş: { assign } (alt ünite → shift numarası) veya { neden } — sonuç uydurulmaz.
  function bolumle(Qu, k, partition) {
    const n = Qu.length;
    if (!Number.isInteger(k) || k < 1) return { neden: 'en-az-bir' };
    if (k > n) return { neden: 'alt-unite' };
    let gr = partition(Qu, k).filter(g => g.length).map(g => g.slice());
    while (gr.length < k) {
      let i = -1, enb = -1;
      gr.forEach((g, j) => { const q = g.reduce((a, x) => a + Qu[x], 0); if (g.length >= 2 && q > enb) { enb = q; i = j; } });
      if (i < 0) return { neden: 'bolunemez' };
      const g = gr[i]; let t = 0, kes = 1;
      for (let m = 0; m < g.length - 1; m++) { t += Qu[g[m]]; kes = m + 1; if (t >= enb / 2) break; }
      gr.splice(i, 1, g.slice(0, kes), g.slice(kes));
    }
    if (gr.length > k) return { neden: 'bolunemez' };
    const assign = new Array(n); gr.forEach((g, j) => g.forEach(x => { assign[x] = j; }));
    return { assign };
  }

  // Manuel mod başlangıç dağılımı adayları (hepsi gerçek atama; motor her birini ayrıca hesaplar):
  //  'debi'   — debi dengeli bitişik bölme (en büyük shift debisini en aza indirir)
  //  'basinc' — gerekli basıncı (yükselti + giriş basıncı) benzer alt üniteler aynı shift'te: pompanın küçük
  //             shift'lerde fazla basınç üretmesini azaltır; sıra içinde yine debi dengeli bölünür
  function manuelAdaylar(units, k, partition) {
    const Qu = units.map(u => u.Q), a = bolumle(Qu, k, partition);
    if (a.neden) return { neden: a.neden };
    const out = [{ kod: 'debi', assign: a.assign }];
    const sira = units.map((u, i) => i).sort((x, y) => ((units[y].rise || 0) + (units[y].hIn || 0)) - ((units[x].rise || 0) + (units[x].hIn || 0)) || x - y);
    const b = bolumle(sira.map(i => Qu[i]), k, partition);
    if (b.assign) { const as = new Array(Qu.length); sira.forEach((i, x) => { as[i] = b.assign[x]; }); if (as.join() !== a.assign.join()) out.push({ kod: 'basinc', assign: as }); }
    return { adaylar: out };
  }
  // Aday sıralaması: istenen sayıda hesaplanan > daha iyi uygunluk > daha az enerji > daha düşük en büyük basınç
  const GENEL_SIRA = ['uygun', 'sinirda', 'varsayimla', 'dogrulanamadi', 'uygun-degil'];
  function adaySirala(list, k) {
    const puan = x => [x.hesap && x.n === k ? 0 : 1, GENEL_SIRA.indexOf(x.genel) < 0 ? 9 : GENEL_SIRA.indexOf(x.genel), x.kWh ?? Infinity, x.Hmax ?? Infinity];
    return list.slice().sort((p, q) => { const a = puan(p), b = puan(q); for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; });
  }

  const api = Object.freeze({ minShift, bolumle, manuelAdaylar, adaySirala, nsSinirlari, nsPasifNedeni, nsDogrula, hedefler, hedefOf, bulguFarki, secSatirlar, geoAlan, birimLateral, uygunluk, uygunMu, siraGecerli, siraVarsayilan, siraOf, siraTasi, siraUyar, siraVarsayilanMi, ataTasi, atamaOf, hedefSapma, hedefOku, ozet, karsilastir, degisti, esit, raporSirasi, SATIR });
  g.IrriShiftYonetimi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

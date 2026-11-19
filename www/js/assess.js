// IrriGrow — MH-AKIL-1: yapılandırılmış mühendislik uyarıları ve çözüm önerileri
//
// Motorun (engine.js) tasarım sonucundan karar destek nesneleri üretir. Kurallar:
//  * Hidrolik hesap YAPMAZ, motoru değiştirmez ve yeniden çalıştırmaz. Bütün sayılar motor sonucundan
//    okunur ya da yalnız aritmetikle (toplam, oran, birim) türetilir.
//  * Eşikler motorun ve MH-1 panelinin mevcut eşikleridir. Tek yeni eşik W-KAP-02 planlama oranıdır
//    (proje ayarı, varsayılan %90); teknik uygunluğu DEĞİŞTİRMEZ, yalnız işletme payı uyarısı verir.
//  * Bir çözüm "hesaplandi-uygun" olarak yalnız motorun gerçekten hesapladığı bir alternatif zorunlu
//    kontrollerden geçtiğinde işaretlenir. Hesaplanmamış çözümler "degerlendirilmedi" ya da
//    "veri-gerekli" olarak kalır; matematiksel olarak sağlanamayan gerekli koşul "kanitla-uygunsuz"dur.
//  * Motor uyarı metinleri (r.warn) değişmez. Bir yapılandırılmış uyarıyla eşleşmeyen metin
//    "Diğer hesap notları" (other) listesinde kalır; hiçbir uyarı kaybolmaz.
// Sonuç ekranı, Hidrolik panel (hydro-view checks), PDF ve Excel bu modülün çıktısını okur.
(function (g) {
  const VER = 1;
  const BAR = 10.2, V_OK = 1.5, V_MAX = 2.0;          // hydro-view ile aynı
  const K_DEF = 0.9, K_MIN = 0.5, K_MAX = 1.0;        // W-KAP-02 planlama oranı
  const EPS = 1e-9;

  const LEVELS = ['uygunsuz', 'on-degerlendirme', 'uyari', 'bilgi'];
  const LEVEL_AD = { uygunsuz: 'Uygunsuz', 'on-degerlendirme': 'Ön değerlendirme', uyari: 'Uyarı', bilgi: 'Bilgi' };
  const DURUM = ['hesaplandi-uygun', 'hesaplandi-uygunsuz', 'kanitla-uygunsuz', 'varsayimla-yetersiz', 'degerlendirilmedi', 'veri-gerekli'];
  const DURUM_AD = {
    'hesaplandi-uygun': 'Hesaplandı – uygun', 'hesaplandi-uygunsuz': 'Hesaplandı – uygunsuz', 'kanitla-uygunsuz': 'Kanıtla uygunsuz',
    'varsayimla-yetersiz': 'Bu varsayımlarla yetersiz', 'degerlendirilmedi': 'Değerlendirilmedi', 'veri-gerekli': 'Veri gerekli',
  };
  const ON_DEG = 'Ön değerlendirme – mühendislik doğrulaması gerekli';
  const TRANSIENT = 'Ayrıntılı geçici rejim analizi gerekli';

  // Metin nesnesi: { t: 'Türkçe anahtar {a}', p: { a: [sayı, ondalık] | 'metin' } } — çevrilir, sayılar yerel biçimde yazılır
  const T = (t, p) => ({ t, p: p || {} });
  const n = (v, d) => [v, d];
  const qty = (ad, deger, birim, d, kaynak, kapsam) => ({ ad: T(ad), deger, birim: birim || '', d: d == null ? 1 : d, kaynak: kaynak || 'hesap', kapsam: kapsam || 'proje' });

  // Motorun r.warn metinlerinden hangisinin hangi koda karşılık geldiğini belirlemek için (yalnız TANIMA;
  // hiçbir sayı metinden okunmaz). Koşullar engine.js ile birebir aynıdır; test T-6 bunu denetler.
  const COVERS = {
    'W-KAP-01': [/^Hiçbir shift alternatifinde tepe dönem turu/, /^Seçilen \d+ shift’li düzende tepe dönem turu/],
    'W-KAP-03': [/^Elle düzenlenen shift’lerden en az birinin debisi/],
    'W-SHF-01': [/^Shift debileri dengesiz/],
    'W-SHF-02': [/^Kaynak debisinin bir kısmı kullanılmıyor/],
    'W-FLT-01': [/^Katalogda .+ filtresi yok/],
    'W-VAN-01': [/^Katalogdaki en büyük vana/],
    'W-VERI-01': [/^Bazı ana hat çaplarının fiyatı yok/],
    'W-POM-01': [/^Seçilen pompa bazı shift’lerde gerekenden/],
    'W-POM-03': [/^Hidrant basıncı yalnızca/],
    'W-BAS-01': [/^Bazı shift’lerde .+ fazla basınç var/],
    'W-PN-02': [/^Seçilen pompanın kapama basıncı/],
    'W-PN-03': [/manifoldun giriş basıncı PN\d+ sınıfı için yüksek/],
    'W-LAT-01': [/^Lateral giriş basıncı, lateral borusunun/],
    'W-SD-01': [/^Su darbesi ayrıntılı analiz edilmedi/],
  };

  const clampK = k => { const x = Number(k); return Number.isFinite(x) ? Math.min(K_MAX, Math.max(K_MIN, x)) : K_DEF; };
  const planK = p => clampK(p && p.akil && p.akil.planOrani != null ? p.akil.planOrani : K_DEF);

  function cleanInp(inp) {
    const Vd = g.IrriValidate;
    if (Vd && inp) { try { const v = Vd.validate(inp); if (v && v.clean) return v.clean; } catch (e) { /* ham girdi kullanılır */ } }
    return inp || {};
  }
  const given = (inp, k) => inp && inp[k] !== undefined && inp[k] !== null && String(inp[k]).trim() !== '';

  // Bir motor shift alternatifinin zorunlu kontrolleri (hepsi motorun hesapladığı değerlerden)
  function altChecks(a, Qs) {
    const m = a.main.sel, fails = [];
    if (!a.feasible) fails.push(T('tur {a} h > {b} h', { a: n(a.cycleHours, 1), b: n(a.avail, 0) }));
    if (Qs && a.Qmax > Qs + EPS) fails.push(T('shift debisi {a} > kaynak {b} m³/h', { a: n(a.Qmax, 1), b: n(Qs, 1) }));
    if (m.v > V_MAX + EPS) fails.push(T('ana hat hızı {a} > {b} m/s', { a: n(m.v, 2), b: n(V_MAX, 1) }));
    if (1.25 * m.Pop > m.pn * BAR + EPS) fails.push(T('ana hat işletme basıncı PN{p} sınırını aşıyor', { p: String(m.pn) }));
    if (a.pump && a.pump.Pshut != null && a.pump.Pshut > m.pn * BAR + EPS) fails.push(T('pompa kapama basıncı {a} m > PN{p} ({b} m)', { a: n(a.pump.Pshut, 1), p: String(m.pn), b: n(m.pn * BAR, 1) }));
    return fails;
  }
  const PIPE_KAPSAM = T('Kontrol edilenler: hız, işletme basıncı ve pompa kapama basıncının PN sınıfına göre durumu. Su darbesi ve diğer uyarılar bu çap için ayrıca hesaplanmadı.');
  const ALT_KAPSAM = T('Kontrol edilenler: tur süresi, kaynak debisi, ana hat hızı ve PN, pompa kapama basıncı. Lateral ve manifold yerleşimi değişmediği için aynıdır; su darbesi bu düzen için ayrıca hesaplanmadı.');

  // Ana hat çap alternatifinin zorunlu kontrolleri (motorun main.alts kaydı)
  function pipeChecks(a, pump) {
    const fails = [];
    if (a.v > V_MAX + EPS) fails.push(T('hız {a} > {b} m/s', { a: n(a.v, 2), b: n(V_MAX, 1) }));
    if (1.25 * a.Pop > a.pn * BAR + EPS) fails.push(T('işletme basıncı PN{p} sınırını aşıyor', { p: String(a.pn) }));
    if (a.Pshut != null && a.Pshut > a.pn * BAR + EPS) fails.push(T('pompa kapama basıncı {a} m > PN{p} ({b} m)', { a: n(a.Pshut, 1), p: String(a.pn), b: n(a.pn * BAR, 1) }));
    return fails;
  }

  function evaluate(r, ctx = {}) {
    if (!r || !r.ok) return { surum: VER, ok: false, findings: [], checks: [], other: r ? (r.warn || []).slice() : [], count: { uygunsuz: 0, 'on-degerlendirme': 0, uyari: 0, bilgi: 0 } };
    const inp = cleanInp(ctx.inp), k = clampK(ctx.k);
    const Qs = Number(ctx.Qsource) > 0 ? Number(ctx.Qsource) : (Number(inp.Q) > 0 ? Number(inp.Q) : null);
    const f = r.field, e = r.emitter, lat = r.lateral, s = r.schedule, sel = r.sel, ms = r.main.sel, p = r.pump;
    const units = r.units, net = r.main.net, Ns = sel.groups.length;
    const autoAlts = r.sectorAlts.filter(a => !a.manual);
    const pumpTemsili = p.need && (!p.fromCatalog || !p.verified);
    const geoKaynak = f.mode === 'parsel' ? 'cizim' : 'dikdortgen';
    const findings = [], checks = [];

    const find = (kod, seviye, o) => {
      const x = Object.assign({ kod, seviye, baslik: null, neden: null, durum: [], sinir: null, eksikGirdi: [], cozumler: [], ayrinti: null, ekran: { sekme: 'ozet' },
        onDegerlendirme: false, projeId: ctx.projeId || null, revId: ctx.revId || null, geoKaynak, onay: (ctx.onay && ctx.onay[kod]) || 'yok', surum: VER }, o);
      findings.push(x); return x;
    };
    // Hidrolik panel kontrolü (MH-1 ile aynı başlık/metin/eşik) + kod
    const chk = (kod, level, tab, title, text, params) => checks.push({ kod, level, tab, title, text, params: params || {} });
    const sol = (tur, baslik, durum, gerekce, o) => Object.assign({ tur, baslik, durum, gerekce, gerekenVeri: [], asama: null, hedef: null }, o || {});

    // ---------- Temel büyüklükler (kapasite) ----------
    const t = s.t, I = s.interval, H = s.hoursPerDay, Qf = r.sectors.Qfield;
    const V = Qf * t;                       // bir sulamada verilen brüt hacim, m³ (tur = Σ shift süresi için kullanılan değer)
    const Vd = V / I;                       // günlük ortalama, m³/gün
    const cap = Qs ? Qs * H : null;         // günlük kaynak kapasitesi, m³/gün
    const kap = {
      Qs, H, I, t, Qf, V, Vd, cap,
      deficit: cap != null ? Vd - cap : null,
      Hreq: Qs ? Vd / Qs : null,                     // günlük kaynak kapasitesinin yetmesi için gereken en az süre (gerekli koşul)
      Qlb: Vd / H,                                   // gerekli koşul: kaynak debisi alt sınırı
      NsLB: Qs ? Math.ceil(Qf / Qs - EPS) : null,    // herhangi bir gruplamada en az shift sayısı
    };
    kap.cycLB = kap.NsLB != null ? kap.NsLB * t : null;

    // ---------- W-KAP-01: tur süresi kullanılabilir süreyi aşıyor ----------
    const feasAny = autoAlts.some(a => a.feasible);
    const kap01 = !feasAny || !sel.feasible;
    chk('W-KAP-01', sel.feasible ? 'ok' : 'bad', 'shift', 'Sulama turu süresi', 'Tur {a} h, kullanılabilir {b} h', { a: [sel.cycleHours, 1], b: [sel.avail, 0] });
    if (kap01) {
      const cz = [];
      // 1) Yalnız shift sayısı — motorun hesapladığı alternatifler
      const rows = autoAlts.map(a => { const fl = altChecks(a, Qs); return { Ns: a.Ns, Qmax: a.Qmax, cycle: a.cycleHours, avail: a.avail, feasible: a.feasible, durum: fl.length ? 'hesaplandi-uygunsuz' : 'hesaplandi-uygun', neden: fl }; });
      const okRows = rows.filter(x => x.durum === 'hesaplandi-uygun');
      if (okRows.length) {
        const b = okRows[0];
        cz.push(sol('shift', T('{n} shift’li düzen', { n: String(b.Ns) }), 'hesaplandi-uygun',
          T('Motorla hesaplandı: tur {a} h ≤ {b} h, en büyük shift {c} m³/h.', { a: n(b.cycle, 1), b: n(b.avail, 0), c: n(b.Qmax, 1) }), { tablo: rows, kapsam: ALT_KAPSAM }));
      } else if (kap.cycLB != null && kap.cycLB > sel.avail + EPS) {
        cz.push(sol('shift', T('Yalnız shift sayısını değiştirmek'), 'kanitla-uygunsuz',
          T('Kaynak {q} m³/h ile her gruplamada en az {ns} shift gerekir (toplam debi {qf} m³/h): tur ≥ {ns} × {t} h = {c} h > {av} h. Motorun hesapladığı {k} alternatifin hiçbiri sığmıyor; shift sayısını artırmak turu uzatır.',
            { q: n(Qs, 1), ns: String(kap.NsLB), qf: n(Qf, 1), t: n(t, 2), c: n(kap.cycLB, 1), av: n(sel.avail, 0), k: String(rows.length) }), { tablo: rows, kapsam: ALT_KAPSAM }));
      } else {
        cz.push(sol('shift', T('Yalnız shift sayısını değiştirmek'), 'hesaplandi-uygunsuz',
          T('Motorun hesapladığı {k} alternatifin hiçbiri bütün kontrolleri sağlamıyor. Farklı gruplamalar MH-AKIL-2’de değerlendirilecek.', { k: String(rows.length) }), { tablo: rows, kapsam: ALT_KAPSAM, asama: 'MH-AKIL-2' }));
      }
      // 2) Günlük çalışma süresi
      if (kap.Hreq != null) {
        if (kap.Hreq > 24 + EPS) cz.push(sol('sure', T('Günlük çalışmayı 24 saate kadar uzatmak'), 'kanitla-uygunsuz',
          T('Günlük ihtiyaç {v} m³; {q} m³/h kaynakla en az {h} h/gün gerekir > 24 h. Diğer girdiler aynı kaldıkça süre uzatmak yetmez.', { v: n(Vd, 0), q: n(Qs, 1), h: n(kap.Hreq, 1) })));
        else if (H < 24 - EPS) cz.push(sol('sure', T('Günlük çalışma süresini artırmak'), 'degerlendirilmedi',
          T('Gerekli koşul: en az {h} h/gün (günlük ihtiyaç {v} m³ ÷ {q} m³/h). Bu bir alt sınırdır; gerçek süre shift yerleşimine bağlıdır ve motor yeniden çalıştırılarak MH-AKIL-2’de hesaplanacak.', { h: n(kap.Hreq, 1), v: n(Vd, 0), q: n(Qs, 1) }),
          { asama: 'MH-AKIL-2', gerekenVeri: [T('İzin verilen en uzun günlük pompa çalışma süresi')] }));
      }
      // 3) Kaynak debisini artırmak
      cz.push(sol('kaynak', T('Kaynak debisini artırmak'), 'degerlendirilmedi',
        T('Gerekli koşul: kaynak debisi en az {q} m³/h olmalı (günlük ihtiyaç {v} m³ ÷ {h} h). Bu mutlak bir değer değil, alt sınırdır: alt ünite debileri ve shift gruplaması nedeniyle gerçek gereksinim daha yüksek olabilir. Değer motor yeniden çalıştırılarak MH-AKIL-2’de hesaplanacak.', { q: n(kap.Qlb, 1), v: n(Vd, 0), h: n(H, 0) }),
        { asama: 'MH-AKIL-2', gerekenVeri: [T('Kuyu verimi (pompa deneyi) veya ek kaynak debisi'), T('Dinamik su seviyesi')] }));
      // 4) Sulama aralığı (§6.3)
      const ar = intervalEval(r, inp, kap);
      cz.push(...ar.cozumler);
      // MH-AKIL-2: kayıtlı ve geçerli motor alternatifleri varsa kaynak/süre/aralık çözümleri motor sonucuyla güncellenir
      if (ctx.alt && ctx.alt.rows) applyAlternatives(cz, ctx.alt, n);
      // 5) Araziyi bölmek
      cz.push(sol('bolme', T('Araziyi bölmek, aynı kaynak'), 'kanitla-uygunsuz',
        T('Bölümler aynı kaynaktan sırayla sulanırsa günlük toplam ihtiyaç ({v} m³) ve kaynak kapasitesi ({c} m³/gün) değişmez; bölmek kapasiteyi artırmaz.', { v: n(Vd, 0), c: n(cap, 0) })));
      cz.push(sol('bolme', T('Araziyi bölmek, ek kaynakla'), 'veri-gerekli',
        T('Her bölüm kendi kaynağıyla ayrı hesaplanmalı. Ek kaynağın verisi olmadan uygunluk söylenemez; bölme MH-AKIL-3’te gelecek.'),
        { asama: 'MH-AKIL-3', gerekenVeri: [T('Ek kaynağın konumu'), T('Ek kaynağın debisi'), T('Ek kaynağın dinamik seviyesi')] }));
      // 6) Diğer işletme senaryoları
      cz.push(sol('depolama', T('Depolama havuzu'), 'degerlendirilmedi',
        T('Havuz, günlük ihtiyacı değil ancak gün içi tepe debiyi dengeler; günlük ortalama açık ({d} m³/gün) sürdükçe havuz boşalır. Bu sürümde hesaplanmıyor.', { d: n(Math.max(0, kap.deficit || 0), 0) }),
        { gerekenVeri: [T('Havuz hacmi'), T('Havuzu dolduran kaynak ve çalışma süresi')] }));
      cz.push(sol('isletme', T('Kısmi (eksik) sulama kabulü'), 'degerlendirilmedi',
        T('Tepe dönemde ihtiyacın yalnız {o} kadarı verilebilir; verim kaybı agronomik karardır ve bu sürümde değerlendirilmiyor.', { o: '%' + (cap != null ? Math.round(100 * Math.min(1, cap / Vd)) : '—') })));
      find('W-KAP-01', 'uygunsuz', {
        baslik: T('Sulama turu kullanılabilir süreye sığmıyor'),
        neden: T('Seçili düzende tur {a} h; {i} günlük aralıkta kullanılabilir süre {b} h. Günlük ihtiyaç {v} m³, kaynak kapasitesi {c} m³/gün.', { a: n(sel.cycleHours, 1), i: String(I), b: n(sel.avail, 0), v: n(Vd, 0), c: n(cap, 0) }),
        onem: T('Tur süreye sığmazsa tepe dönemde bitkilere gereken su verilemez.'),
        durum: [qty('Tur süresi', sel.cycleHours, 'h', 1), qty('Günlük sulama hacmi', Vd, 'm³', 0), qty('Kaynak debisi', Qs, 'm³/h', 1, given(ctx.inp, 'Q') ? 'girdi' : 'varsayilan', 'kaynak'), qty('Shift sayısı', Ns, '', 0, sel.manual ? 'elle' : 'otomatik')],
        sinir: qty('Kullanılabilir süre', sel.avail, 'h', 0, given(ctx.inp, 'hours') ? 'girdi' : 'varsayilan'),
        kisaGerekce: Qs ? T('Yalnız shift sayısını değiştirmek çözmüyor: {v} m³ ÷ {q} m³/h = {h} h > {b} h.', { v: n(Vd, 0), q: n(Qs, 1), h: n(kap.Hreq, 1), b: n(H, 0) }) : null,
        cozumler: cz, ayrinti: { kapasite: kap, aralik: ar.tablo, unsurlar: ar.unsurlar }, ekran: { sekme: 'shift' },
      });
    }

    // ---------- W-KAP-02: işletme güvenlik payı (planlama oranı) ----------
    if (sel.feasible && sel.cycleHours > k * sel.avail + EPS) {
      const lim = k * sel.avail;
      chk('W-KAP-02', 'warn', 'shift', 'İşletme payı', 'Tur {a} h, planlama sınırı {b} h (%{k})', { a: [sel.cycleHours, 1], b: [lim, 1], k: [k * 100, 0] });
      find('W-KAP-02', 'uyari', {
        baslik: T('İşletme payı az'),
        neden: T('Tur {a} h; planlama sınırı {b} h ({av} h’nin %{k}’i). Sistem teknik olarak uygun, ancak arıza, bakım veya telafi sulaması için yalnız {r} h pay kalıyor.', { a: n(sel.cycleHours, 1), b: n(lim, 1), av: n(sel.avail, 0), k: n(k * 100, 0), r: n(sel.avail - sel.cycleHours, 1) }),
        onem: T('Bu uyarı teknik uygunluğu değiştirmez; yalnız işletme esnekliğini gösterir. Oran Veriler → Proje ayarları’ndan değiştirilebilir.'),
        durum: [qty('Tur süresi', sel.cycleHours, 'h', 1), qty('Kalan pay', sel.avail - sel.cycleHours, 'h', 1)],
        sinir: qty('Planlama sınırı', lim, 'h', 1, 'ayar'),
        cozumler: [sol('kaynak', T('Kaynak debisini veya çalışma süresini artırmak'), 'degerlendirilmedi', T('Pay büyür; değer motor yeniden çalıştırılarak MH-AKIL-2’de hesaplanacak.'), { asama: 'MH-AKIL-2' })],
        ekran: { sekme: 'shift' }, planOrani: k,
      });
    }

    // ---------- W-KAP-03: shift debisi kaynak debisini aşıyor (elle düzenleme) ----------
    if (Qs) chk('W-KAP-03', sel.Qmax <= Qs + EPS ? 'ok' : 'bad', 'shift', 'Kaynak debisi', 'En büyük shift {a} m³/h, kaynak {b} m³/h', { a: [sel.Qmax, 2], b: [Qs, 2] });
    if ((sel.manual && sel.overSource) || (Qs && sel.Qmax > Qs + EPS)) {
      const rec = autoAlts.find(a => a.recommended), fl = rec ? altChecks(rec, Qs) : null;
      find('W-KAP-03', 'uygunsuz', {
        baslik: T('Shift debisi kaynak debisini aşıyor'),
        neden: T('En büyük shift {a} m³/h, kaynak {b} m³/h: bu düzen uygulanamaz.', { a: n(sel.Qmax, 1), b: n(Qs, 1) }),
        durum: [qty('En büyük shift debisi', sel.Qmax, 'm³/h', 1)], sinir: qty('Kaynak debisi', Qs, 'm³/h', 1, 'girdi', 'kaynak'),
        cozumler: rec ? [sol('shift', T('Otomatik shift düzenine dönmek ({n} shift)', { n: String(rec.Ns) }), fl.length ? 'hesaplandi-uygunsuz' : 'hesaplandi-uygun',
          fl.length ? T('Motorla hesaplandı; kalan sorunlar: {x}', { x: fl }) : T('Motorla hesaplandı: tur {a} h ≤ {b} h, en büyük shift {c} m³/h.', { a: n(rec.cycleHours, 1), b: n(rec.avail, 0), c: n(rec.Qmax, 1) }), { kapsam: ALT_KAPSAM })] : [],
        ekran: { sekme: 'shift' },
      });
    }

    // ---------- W-SHF-01 / W-SHF-02 ----------
    if (Ns > 1) chk('W-SHF-01', sel.Qmin >= 0.7 * sel.Qmax ? 'ok' : 'warn', 'shift', 'Shift debi dengesi', 'En küçük / en büyük = {a} / {b} m³/h', { a: [sel.Qmin, 2], b: [sel.Qmax, 2] });
    if (sel.Qmin < 0.7 * sel.Qmax && sel.Ns > 1) {
      const bal = autoAlts.filter(a => a !== sel && a.Qmin >= 0.7 * a.Qmax);
      find('W-SHF-01', 'uyari', {
        baslik: T('Shift debileri dengesiz'),
        neden: T('En küçük shift {a} m³/h, en büyük {b} m³/h (oran %{o} < %70). Pompa küçük shift’lerde fazla basınç üretir.', { a: n(sel.Qmin, 1), b: n(sel.Qmax, 1), o: n(100 * sel.Qmin / sel.Qmax, 0) }),
        durum: [qty('En küçük / en büyük', sel.Qmin / sel.Qmax * 100, '%', 0)], sinir: qty('Önerilen en az oran', 70, '%', 0, 'motor'),
        cozumler: bal.map(a => { const fl = altChecks(a, Qs); return sol('shift', T('{n} shift’li düzen', { n: String(a.Ns) }), fl.length ? 'hesaplandi-uygunsuz' : 'hesaplandi-uygun',
          fl.length ? T('Debiler dengeli ({a}–{b} m³/h) ama: {x}', { a: n(a.Qmin, 1), b: n(a.Qmax, 1), x: fl }) : T('Motorla hesaplandı: debiler {a}–{b} m³/h, tur {c} h.', { a: n(a.Qmin, 1), b: n(a.Qmax, 1), c: n(a.cycleHours, 1) }), { kapsam: ALT_KAPSAM }); })
          .concat([sol('shift', T('Shift atamasını elle dengelemek'), 'degerlendirilmedi', T('Sonuç → Shift’ler bölümünden alt üniteleri taşıyın; motor her değişiklikte yeniden hesaplar.'))]),
        ekran: { sekme: 'shift' },
      });
    }
    if (Qs && Qs > sel.Qmax * 1.6 && sel.Ns > 1) {
      const fewer = autoAlts.filter(a => a.Ns < sel.Ns);
      find('W-SHF-02', 'bilgi', {
        baslik: T('Kaynak debisinin bir kısmı kullanılmıyor'),
        neden: T('En büyük shift {a} m³/h, kaynak {b} m³/h.', { a: n(sel.Qmax, 1), b: n(Qs, 1) }),
        durum: [qty('En büyük shift debisi', sel.Qmax, 'm³/h', 1)], sinir: qty('Kaynak debisi', Qs, 'm³/h', 1, 'girdi', 'kaynak'),
        cozumler: fewer.map(a => { const fl = altChecks(a, Qs); return sol('shift', T('{n} shift’li düzen', { n: String(a.Ns) }), fl.length ? 'hesaplandi-uygunsuz' : 'hesaplandi-uygun',
          fl.length ? T('Motorla hesaplandı; kalan sorunlar: {x}', { x: fl }) : T('Motorla hesaplandı: tur {a} h, en büyük shift {b} m³/h.', { a: n(a.cycleHours, 1), b: n(a.Qmax, 1) }), { kapsam: ALT_KAPSAM }); }),
        ekran: { sekme: 'shift' },
      });
    }

    // ---------- Lateral / manifold ----------
    chk('W-LAT-02', lat.maxDH <= e.allowLat + EPS ? 'ok' : 'bad', 'lateral', 'Lateral basınç farkı', 'En büyük ΔH {a} m, izin verilen {b} m', { a: [lat.maxDH, 2], b: [e.allowLat, 2] });
    if (lat.maxDH > e.allowLat + EPS) find('W-LAT-02', 'uygunsuz', {
      baslik: T('Lateral basınç farkı izin verilen sınırı aşıyor'), neden: T('En büyük ΔH {a} m, izin verilen {b} m.', { a: n(lat.maxDH, 2), b: n(e.allowLat, 2) }),
      durum: [qty('Lateral ΔH', lat.maxDH, 'm', 2)], sinir: qty('İzin verilen', e.allowLat, 'm', 2, 'motor'),
      cozumler: [sol('boru', T('Daha kısa lateral veya daha büyük lateral çapı'), 'degerlendirilmedi', T('Yerleşim değişir; motor yeniden çalıştırılarak değerlendirilmeli.'), { asama: 'MH-AKIL-2' })], ekran: { sekme: 'lateral' },
    });
    const manVar = Math.max(...units.map(u => u.varH));
    chk('W-MAN-01', manVar <= e.allowMan + EPS ? 'ok' : 'bad', 'manifold', 'Manifold basınç değişimi', 'En büyük {a} m, izin verilen {b} m', { a: [manVar, 2], b: [e.allowMan, 2] });
    if (manVar > e.allowMan + EPS) find('W-MAN-01', 'uygunsuz', {
      baslik: T('Manifold basınç değişimi izin verilen sınırı aşıyor'), neden: T('En büyük {a} m, izin verilen {b} m.', { a: n(manVar, 2), b: n(e.allowMan, 2) }),
      durum: [qty('Manifold basınç değişimi', manVar, 'm', 2)], sinir: qty('İzin verilen', e.allowMan, 'm', 2, 'motor'),
      cozumler: [sol('boru', T('Manifold çapını büyütmek veya alt üniteyi küçültmek'), 'degerlendirilmedi', T('Yerleşim değişir; motor yeniden çalıştırılarak değerlendirilmeli.'), { asama: 'MH-AKIL-2' })], ekran: { sekme: 'manifold' },
    });
    const manPN = units.filter(u => u.hInMax * 1.25 > u.pipe.pn * BAR);
    if (manPN.length) {
      chk('W-PN-03', 'bad', 'manifold', 'Manifold PN sınıfı', '{n} manifoldun giriş basıncı PN sınıfı için yüksek', { n: [manPN.length, 0] });
      find('W-PN-03', 'uygunsuz', {
        baslik: T('Manifold giriş basıncı PN sınıfı için yüksek'), neden: T('{n} manifoldda 1,25 × giriş basıncı PN{p} sınırını ({b} m) aşıyor.', { n: String(manPN.length), p: String(manPN[0].pipe.pn), b: n(manPN[0].pipe.pn * BAR, 1) }),
        durum: [qty('Etkilenen manifold', manPN.length, 'adet', 0), qty('En büyük giriş basıncı', Math.max(...manPN.map(u => u.hInMax)), 'm', 1)], sinir: qty('PN sınırı', manPN[0].pipe.pn * BAR, 'm', 1, 'katalog'),
        cozumler: [sol('pn', T('Bir üst PN sınıfı manifold borusu'), 'degerlendirilmedi', T('Bu sürümde motor manifold PN alternatifi hesaplamıyor.'), { asama: 'MH-AKIL-2' }),
          sol('ekipman', T('Manifold girişinde basınç regülatörü'), 'veri-gerekli', T('Regülatörün ayar basıncı ve kaybı üretici verisi ister.'), { gerekenVeri: [T('Regülatör ayar basıncı ve kayıp eğrisi')] })],
        ekran: { sekme: 'manifold' },
      });
    }
    if (lat.cat && lat.cat.maxH && Math.max(...units.map(u => u.hInMax)) > lat.cat.maxH) {
      const hx = Math.max(...units.map(u => u.hInMax));
      chk('W-LAT-01', 'warn', 'lateral', 'Lateral boru basıncı', 'Lateral girişi boru sınırını ({a} m) aşabilir', { a: [lat.cat.maxH, 0] });
      find('W-LAT-01', 'uyari', {
        baslik: T('Lateral giriş basıncı boru sınırını aşabilir'), neden: T('En büyük giriş basıncı {a} m, lateral borusunun sınırı {b} m.', { a: n(hx, 1), b: n(lat.cat.maxH, 0) }),
        durum: [qty('En büyük giriş basıncı', hx, 'm', 1)], sinir: qty('Lateral boru sınırı', lat.cat.maxH, 'm', 0, 'katalog'),
        cozumler: [sol('ekipman', T('Alt ünite girişinde basınç regülatörü'), 'veri-gerekli', T('Regülatörün ayar basıncı ve kaybı üretici verisi ister.'), { gerekenVeri: [T('Regülatör ayar basıncı ve kayıp eğrisi')] }),
          sol('boru', T('Daha yüksek basınç sınıflı lateral'), 'veri-gerekli', T('Katalogda daha dayanıklı lateral kaydı gerekir.'), { gerekenVeri: [T('Lateral borusunun izin verilen basıncı')] })],
        ekran: { sekme: 'lateral' },
      });
    }

    // ---------- Ana hat: hız ve PN ----------
    const vMain = Math.max(...net.map(x => x.v), 0), vSt = vMain <= V_OK + EPS ? 'ok' : vMain <= V_MAX + EPS ? 'warn' : 'bad';
    if (net.length) chk('W-HIZ-01', vSt, 'anahat', 'Ana hat hızı', 'En büyük hız {a} m/s (öneri ≤ {b} m/s)', { a: [vMain, 2], b: [V_OK, 1] });
    const bigger = r.main.alts.filter(a => a.od > ms.od);
    const pipeSol = (fltr, okText) => bigger.filter(fltr).slice(0, 3).map(a => { const fl = pipeChecks(a, p);
      return sol('boru', T('Ana hat Ø{od} PN{pn}', { od: String(a.od), pn: String(a.pn) }), fl.length ? 'hesaplandi-uygunsuz' : 'hesaplandi-uygun',
        fl.length ? T('Motorla hesaplandı; kalan sorunlar: {x}', { x: fl }) : T(okText, { v: n(a.v, 2), h: n(a.Hmax, 1), e: n(a.energyCost, 0) }), { kapsam: PIPE_KAPSAM }); });
    if (net.length && vSt !== 'ok') find('W-HIZ-01', vSt === 'bad' ? 'uygunsuz' : 'uyari', {
      baslik: T('Ana hat hızı yüksek'), neden: T('En büyük hız {a} m/s; öneri ≤ {b} m/s, üst sınır {c} m/s.', { a: n(vMain, 2), b: n(V_OK, 1), c: n(V_MAX, 1) }),
      durum: [qty('En büyük hız', vMain, 'm/s', 2)], sinir: qty('Önerilen hız', V_OK, 'm/s', 1, 'motor'),
      cozumler: pipeSol(() => true, 'Motorla hesaplandı: hız {v} m/s, gerekli H {h} m, enerji {e} ₺/yıl.'), ekran: { sekme: 'anahat' },
    });
    chk('W-PN-01', 1.25 * ms.Pop <= ms.pn * BAR + EPS ? 'ok' : 'bad', 'basinc', 'Ana hat PN (işletme)', '1,25 × {a} m ≤ PN{p} ({b} m)', { a: [ms.Pop, 1], p: [ms.pn, 0], b: [ms.pn * BAR, 1] });
    if (1.25 * ms.Pop > ms.pn * BAR + EPS) find('W-PN-01', 'uygunsuz', {
      baslik: T('Ana hat işletme basıncı PN sınıfını aşıyor'), neden: T('1,25 × {a} m = {c} m > PN{p} ({b} m).', { a: n(ms.Pop, 1), c: n(1.25 * ms.Pop, 1), p: String(ms.pn), b: n(ms.pn * BAR, 1) }),
      durum: [qty('İşletme basıncı (en alçak nokta)', ms.Pop, 'm', 1)], sinir: qty('PN sınırı', ms.pn * BAR, 'm', 1, 'katalog'),
      cozumler: pipeSol(a => 1.25 * a.Pop <= a.pn * BAR + EPS, 'Motorla hesaplandı: hız {v} m/s, gerekli H {h} m, enerji {e} ₺/yıl.'), ekran: { sekme: 'basinc' },
    });
    if (p.need && p.Pshut != null) chk('W-PN-02', p.Pshut <= ms.pn * BAR + EPS ? 'ok' : 'bad', 'basinc', 'Pompa kapama basıncı', '{a} m, PN{p} sınırı {b} m', { a: [p.Pshut, 1], p: [ms.pn, 0], b: [ms.pn * BAR, 1] });
    if (p.Pshut != null && p.Pshut > ms.pn * BAR) find('W-PN-02', 'uygunsuz', {
      baslik: T('Pompa kapama basıncı ana hat PN sınıfını aşıyor'),
      neden: T('Vana kapalıyken pompanın en alçak noktada oluşturabileceği basınç {a} m; ana hat PN{p} sınırı {b} m.', { a: n(p.Pshut, 1), p: String(ms.pn), b: n(ms.pn * BAR, 1) }),
      durum: [qty('Pompa kapama basıncı', p.Pshut, 'm', 1, pumpTemsili ? 'jenerik' : 'katalog')], sinir: qty('PN sınırı', ms.pn * BAR, 'm', 1, 'katalog'),
      cozumler: pipeSol(a => a.Pshut == null || a.Pshut <= a.pn * BAR + EPS, 'Motorla hesaplandı: hız {v} m/s, gerekli H {h} m, enerji {e} ₺/yıl.')
        .concat([sol('ekipman', T('Emniyet (basınç tahliye) vanası'), 'veri-gerekli', T('Açma basıncı ve tahliye kapasitesi üretici verisiyle seçilmeli.'), { gerekenVeri: [T('Tahliye vanası açma basıncı ve kapasitesi')] }),
          sol('ekipman', T('Daha düz eğrili pompa veya frekans konvertörü'), 'degerlendirilmedi', T('Pompa seçimi değişir; bu sürümde alternatif pompa hesaplanmıyor.'))]),
      ekran: { sekme: 'basinc' },
    });

    // ---------- Su darbesi (ön değerlendirme; ayrıntısı MH-AKIL-5) ----------
    const sg = r.surge;
    chk('W-SD-01', sg.exceeds ? 'bad' : 'warn', 'basinc', 'Su darbesi (Joukowsky üst sınırı)', 'ΔH ≈ {a} m, tepe {b} m — ön değerlendirme', { a: [sg.dH, 0], b: [sg.peak, 0] });
    find('W-SD-01', sg.exceeds ? 'uygunsuz' : 'on-degerlendirme', {
      onDegerlendirme: true,
      baslik: sg.exceeds ? T('Su darbesi üst sınırı PN sınıfını aşabilir') : T('Su darbesi ön değerlendirmesi'),
      neden: T('Ani kapanma için Joukowsky üst sınırı ΔH ≈ {a} m (dalga hızı {c} m/s); işletme {o} m + ΔH = {b} m, PN{p} sınırı {s} m. Ayrıntılı geçici rejim analizi yapılmadı.',
        { a: n(sg.dH, 0), c: n(sg.a, 0), o: n(sg.Pline, 1), b: n(sg.peak, 0), p: String(ms.pn), s: n(sg.pnH, 1) }),
      onem: T('{a}. {b}.', { a: T(ON_DEG), b: T(TRANSIENT) }),
      durum: [qty('Joukowsky ΔH', sg.dH, 'm', 0), qty('Tepe basınç (üst sınır)', sg.peak, 'm', 0), qty('Kritik süre 2L/a', sg.Tc, 's', 1)],
      sinir: qty('PN sınırı', sg.pnH, 'm', 1, 'katalog'),
      cozumler: [
        sol('ekipman', T('Vana kapanma süresi'), 'degerlendirilmedi', T('Kapanma süresinin 2L/a = {a} s’den uzun olması ani-kapanma sınırını aşmamak için gereklidir, yeterli değildir. 5 × 2L/a = {b} s yalnız pratik bir kuraldır.', { a: n(sg.Tc, 1), b: n(sg.tClose, 0) }), { asama: 'MH-AKIL-5', gerekenVeri: [T('Vana kapanma eğrisi')] }),
        sol('pn', T('Daha yüksek PN sınıfı'), 'degerlendirilmedi', T('Üst sınır karşılaştırması MH-AKIL-5’te; negatif basınç ve kolon ayrılması bu sürümde değerlendirilmiyor.'), { asama: 'MH-AKIL-5' }),
        sol('ekipman', T('Pompa duruşu (elektrik kesintisi)'), 'degerlendirilmedi', T('Çoğu sistemde en kritik senaryodur; bu sürümde değerlendirilmiyor.'), { asama: 'MH-AKIL-5' }),
        sol('ekipman', T('Vakum riski ve hava/vakum vanaları'), 'veri-gerekli', T('Yüksek noktalar için arazi kotları gerekir (MH-2).'), { asama: 'MH-2', gerekenVeri: [T('Ana hat boyunca arazi kotları')] }),
        sol('veri', T(TRANSIENT), 'veri-gerekli', T('Karakteristikler yöntemiyle; IrriGrow bu sürümde yapmaz.'), { gerekenVeri: [T('Pompa atalet momenti'), T('Vana karakteristiği'), T('Hat profili')] }),
      ],
      ekran: { sekme: 'basinc' },
    });

    // ---------- Pompa, basınç fazlası, ekipman ----------
    const sur = Math.max(...ms.surplus);
    if (sur > 5) {
      chk('W-BAS-01', 'warn', 'basinc', 'Fazla basınç', 'Bazı shift’lerde {a} m fazla basınç: shift vanasında regülatör', { a: [sur, 1] });
      find('W-BAS-01', 'uyari', {
        baslik: T('Bazı shift’lerde fazla basınç var'), neden: T('En büyük fazla basınç {a} m (kot farkı veya sabit kaynak basıncı).', { a: n(sur, 1) }),
        durum: [qty('En büyük fazla basınç', sur, 'm', 1)], sinir: qty('Motor eşiği', 5, 'm', 0, 'motor'),
        cozumler: [sol('ekipman', T('Shift vanalarında basınç düşürücü (regülatör)'), 'veri-gerekli', T('Ayar basıncı ve kayıp eğrisi üretici verisi ister.'), { gerekenVeri: [T('Regülatör ayar basıncı ve kayıp eğrisi')] })],
        ekran: { sekme: 'basinc' },
      });
    }
    if (p.need && p.fromCatalog && p.over > 1.3) {
      chk('W-POM-01', 'warn', 'pompa', 'Pompa fazla basınç', 'Gerekenden %{a} fazla basınç: regülatör veya frekans konvertörü', { a: [(p.over - 1) * 100, 0] });
      find('W-POM-01', 'uyari', {
        baslik: T('Pompa bazı shift’lerde fazla basınç üretiyor'), neden: T('Gerekenden %{a} fazla basınç.', { a: n((p.over - 1) * 100, 0) }),
        durum: [qty('Fazla basınç oranı', (p.over - 1) * 100, '%', 0)], sinir: qty('Motor eşiği', 30, '%', 0, 'motor'),
        cozumler: [sol('ekipman', T('Basınç regülatörü veya frekans konvertörü'), 'degerlendirilmedi', T('Enerji kazancı bu sürümde hesaplanmıyor.'))],
        ekran: { sekme: 'pompa' },
      });
    }
    if (pumpTemsili) {
      chk('W-POM-02', 'warn', 'pompa', 'Temsili pompa', 'Pompa doğrulanmış bir üretici kaydı değil; gerçek katalogla kontrol edin', {});
      find('W-POM-02', 'uyari', {
        baslik: T('Pompa temsili (doğrulanmamış) kayıt'), neden: T('Pompa doğrulanmış bir üretici kaydı değil; gerçek katalogla kontrol edin'),
        eksikGirdi: [T('Üretici pompa eğrisi (Q–H, verim, güç)')],
        cozumler: [sol('veri', T('Gerçek üretici kataloğunu yüklemek'), 'veri-gerekli', T('Ayarlar → Katalog yükle (JSON).'), { gerekenVeri: [T('Üretici pompa eğrisi (Q–H, verim, güç)')] })],
        ekran: { sekme: 'pompa' },
      });
    }
    if (p.need && inp.srcType === 'sebeke' && p.H < 5) find('W-POM-03', 'uyari', {
      baslik: T('Hidrant basıncı az farkla yetersiz'), neden: T('Pompa yalnız {a} m basınç ekliyor.', { a: n(p.H, 1) }),
      durum: [qty('Pompa basma yüksekliği', p.H, 'm', 1)], sinir: qty('Motor eşiği', 5, 'm', 0, 'motor'),
      cozumler: pipeSol(() => true, 'Motorla hesaplandı: hız {v} m/s, gerekli H {h} m, enerji {e} ₺/yıl.').concat([sol('boru', T('Pompa yerine bir üst ana hat çapı'), 'degerlendirilmedi', T('Pompasız çalışma bu sürümde ayrıca hesaplanmıyor.'), { asama: 'MH-AKIL-2' })]),
      ekran: { sekme: 'pompa' },
    });
    if (sel.filter.missing.length) {
      chk('W-FLT-01', 'warn', 'pompa', 'Filtre kataloğu eksik', '{x} filtresi katalogda yok; 5 m kayıp kabul edildi', { x: sel.filter.missing.join(', ') });
      find('W-FLT-01', 'uyari', {
        baslik: T('Filtre kataloğu eksik'), neden: T('{x} filtresi katalogda yok; 5 m kayıp kabul edildi', { x: sel.filter.missing.join(', ') }),
        eksikGirdi: [T('Filtre kayıp eğrisi')], cozumler: [sol('veri', T('Filtre katalog kaydı eklemek'), 'veri-gerekli', T('Ayarlar → Katalog yükle (JSON).'), { gerekenVeri: [T('Filtre kayıp eğrisi')] })], ekran: { sekme: 'pompa' },
      });
    }
    if (sel.valve.over) {
      chk('W-VAN-01', 'warn', 'pompa', 'Shift vanası kapasitesi', 'Katalogdaki en büyük vana yetersiz; paralel bağlantı gerekir', {});
      find('W-VAN-01', 'uyari', {
        baslik: T('Shift vanası kapasitesi yetersiz'), neden: T('Katalogdaki en büyük vana yetersiz; paralel bağlantı gerekir'),
        cozumler: [sol('ekipman', T('Paralel vana veya daha büyük vana kaydı'), 'veri-gerekli', T('Vana kayıp eğrisi gerekir.'), { gerekenVeri: [T('Vana kayıp eğrisi')] })], ekran: { sekme: 'pompa' },
      });
    }
    if (!sel.main.allPriced) find('W-VERI-01', 'bilgi', {
      baslik: T('Ana hat fiyatları eksik'), neden: T('Çap, ekonomik karşılaştırma yerine hız ölçütüyle (≤ 1,5 m/s) seçildi.'),
      eksikGirdi: [T('Ana hat borusu birim fiyatları')], cozumler: [sol('veri', T('Boru fiyatlarını girmek'), 'veri-gerekli', T('Malzeme ekranından fiyat girin; çap seçimi ekonomik ölçüte geçer.'), { gerekenVeri: [T('Ana hat borusu birim fiyatları')] })], ekran: { sekme: 'anahat' },
    });

    // ---------- Sıralama, sayım, motor metinlerinin eşleştirilmesi ----------
    const ord = x => LEVELS.indexOf(x.seviye);
    findings.sort((a, b) => ord(a) - ord(b));
    const corder = { bad: 0, warn: 1, ok: 2 };
    checks.sort((a, b) => corder[a.level] - corder[b.level]);
    const have = new Set(findings.map(x => x.kod));
    const matched = [], other = [];
    (r.warn || []).forEach((w, i) => {
      const kod = Object.keys(COVERS).find(c => have.has(c) && COVERS[c].some(re => re.test(w)));
      if (kod) matched.push({ i, kod }); else other.push(w);
    });
    const count = { uygunsuz: 0, 'on-degerlendirme': 0, uyari: 0, bilgi: 0 };
    findings.forEach(x => { count[x.seviye]++; });
    // Teknik uygunluk yalnız uyarı seviyelerinden çıkar; kullanıcı kararı (onay) bunu DEĞİŞTİRMEZ.
    const teknikUygun = count.uygunsuz === 0;
    return { surum: VER, ok: true, planOrani: k, teknikUygun, findings, checks, other, matched, count, kapasite: kap };
  }

  // MH-AKIL-2 sonuçlarını W-KAP-01 çözümlerine işler. Durum kuralları:
  //  hesaplandi-uygun   : motorla hesaplandı, kapasite uygun VE başka "uygunsuz" uyarı kalmıyor
  //  hesaplandi-uygunsuz: motorla hesaplandı; kapasite sağlanmıyor ya da kritik uyarılar açık kalıyor
  function applyAlternatives(cz, alt, n) {
    const motor = x => ({ Q: x.girdi.Q, H: x.girdi.H, I: x.girdi.I, Ns: x.Ns, cycle: x.cycle, avail: x.avail, Hmax: x.Hmax, motor: x.motor, kWh: x.kWh, od: x.od, pn: x.pn, hacim: x.hacim, acik: x.acik });
    const kalan = x => x.acik && x.acik.length ? T('Kapasite sorunu çözülüyor, ancak şu kritik uyarılar açık kalıyor: {x}. Bu nedenle kesin çözüm olarak önerilmez.', { x: x.acik.join(', ') }) : null;
    const durumOf = x => x.durum === 'uygun' ? 'hesaplandi-uygun' : 'hesaplandi-uygunsuz';
    const qSol = (x, baslik) => sol2('kaynak', baslik, durumOf(x),
      x.enKucuk ? T('Motorla hesaplandı: {q} m³/h ve {h} h/gün ile {ns} shift, tur {c} h ≤ {av} h. {qa} m³/h ile tur {ca} h, sığmıyor. Bu değer motorun shift gruplama kuralı ve bu yerleşim için bulunan en küçük değerdir; mutlak teorik minimum değildir.',
        { q: n(x.girdi.Q, 1), h: n(x.girdi.H, 1), ns: String(x.Ns), c: n(x.cycle, 2), av: n(x.avail, 1), qa: n(x.altQ, 1), ca: n(x.altCycle, 2) })
        : T('Motorla hesaplandı: {q} m³/h ve {h} h/gün ile {ns} shift, tur {c} h ≤ {av} h. 0,1 m³/h altı da uygun çıktı; bu değer en küçük olmayabilir.', { q: n(x.girdi.Q, 1), h: n(x.girdi.H, 1), ns: String(x.Ns), c: n(x.cycle, 2), av: n(x.avail, 1) }),
      { motor: motor(x), kalan: kalan(x), kapsam: T('Kaynak debisi ve günlük süre dışındaki bütün girdiler aynı; kuyu veriminin pompa deneyiyle doğrulanması gerekir.') });
    const sol2 = (tur, baslik, durum, gerekce, o) => Object.assign({ tur, baslik, durum, gerekce, gerekenVeri: [], asama: null, hedef: null }, o || {});
    const byId = id => alt.rows.find(x => x.id === id);
    // Kaynak debisi (mevcut süre)
    const kq = byId('kaynak'), ki = cz.findIndex(c => c.tur === 'kaynak');
    if (kq && ki >= 0 && kq.girdi) cz[ki] = Object.assign(qSol(kq, T('Kaynak debisini {q} m³/h’e çıkarmak', { q: n(kq.girdi.Q, 1) })), { gerekenVeri: cz[ki].gerekenVeri });
    else if (kq && ki >= 0 && (kq.imkansiz || kq.bulunamadi)) cz[ki] = sol2('kaynak', T('Kaynak debisini artırmak'), 'hesaplandi-uygunsuz', T('Motorla aranan aralıkta kapasiteyi sağlayan bir debi bulunamadı.'));
    // Günlük süre (mevcut debi)
    const su = byId('sure'), si = cz.findIndex(c => c.tur === 'sure');
    if (su && su.girdi) {
      const x = su.kanit ? sol2('sure', T('Günlük çalışmayı 24 saate kadar uzatmak'), 'kanitla-uygunsuz', T('Gereken en az {h} h/gün > 24 h. Motor 24 h/gün ile de hesapladı: tur {c} h > {av} h.', { h: n(su.hNeed, 1), c: n(su.cycle, 2), av: n(su.avail, 1) }), { motor: motor(su) })
        : sol2('sure', T('Günlük çalışmayı {h} saate çıkarmak', { h: n(su.girdi.H, 1) }), durumOf(su), T('Motorla hesaplandı: {h} h/gün ile tur {c} h ≤ {av} h.', { h: n(su.girdi.H, 1), c: n(su.cycle, 2), av: n(su.avail, 1) }), { motor: motor(su), kalan: kalan(su) });
      if (si >= 0) cz[si] = x; else cz.splice(ki + 1, 0, x);
    }
    // Kaynak + süre
    const ks = alt.rows.filter(x => x.aile === 'kaynak-sure' && x.girdi);
    const at = cz.findIndex(c => c.tur === 'kaynak') + 1;
    cz.splice(at, 0, ...ks.map(x => qSol(x, T('Kaynak {q} m³/h ve günde {h} saat', { q: n(x.girdi.Q, 1), h: n(x.girdi.H, 0) }))));
    // Sulama aralığı: motor sonucu eklenir (MH-AKIL-1 değerlendirmesi ve varsayımlar korunur)
    for (const x of alt.rows.filter(y => y.aile === 'aralik')) {
      const c = cz.find(y => y.tur === 'aralik' && y.baslik && y.baslik.p && y.baslik.p.i === String(x.girdi.I));
      if (!c) continue;
      c.durum = durumOf(x);
      c.motor = motor(x); c.kalan = x.kapasiteUygun ? kalan(x) : null;
      c.motorNot = T('Motorla hesaplandı: {i} gün aralıkta tur {c} h, kullanılabilir {av} h.', { i: String(x.girdi.I), c: n(x.cycle, 2), av: n(x.avail, 1) });
    }
  }

  // §6.3 Sulama aralığı değerlendirmesi: her aralık seçeneği için ayrı satır; toplu "uygunsuz" yok.
  function intervalEval(r, inp, kap) {
    const s = r.schedule, D = g.IRRI_DATA, crop = D && D.CROPS ? D.CROPS[inp.crop] : null;
    const soilGiven = !!(inp && inp.soil && D && D.SOILS && D.SOILS[inp.soil]);
    const soil = D && D.SOILS ? (D.SOILS[inp.soil] || D.SOILS.tinli) : null;
    const unsurlar = [
      qty('Günlük brüt ihtiyaç', s.gross, 'mm/gün', 2),
      qty('Brüt ihtiyaç × toplam alan', s.gross * r.field.A / 1000, 'm³/gün', 0),
      qty('Günlük sulama hacmi (Σ damlatıcı debisi × shift süresi ÷ aralık)', kap.Vd, 'm³/gün', 0),
      qty('Damlatıcıların kapladığı alan oranı', 100 * kap.Vd / (s.gross * r.field.A / 1000), '%', 2),
      qty('Dönemlik brüt ihtiyaç', s.seasonM3, 'm³', 0),
      soil ? qty('Toprak kullanılabilir su', soil.aw, 'mm/m', 0, soilGiven ? 'girdi' : 'varsayilan') : null,
      crop ? qty('Kök derinliği', crop.Zr, 'm', 2, 'varsayilan') : null,
      crop ? qty('İzin verilen tüketim oranı', crop.p, '', 2, 'varsayilan') : null,
      qty('Kolay alınabilir su (RAW)', s.RAW, 'mm', 1), qty('En büyük aralık', s.Imax, 'gün', 0),
      qty('Bir uygulamada shift süresi', s.t, 'h', 2),
      kap.cap != null ? qty('Günlük kaynak kapasitesi', kap.cap, 'm³/gün', 0, 'hesap', 'kaynak') : null,
      kap.deficit != null ? qty('Günlük ortalama açık', Math.max(0, kap.deficit), 'm³/gün', 0) : null,
    ].filter(Boolean);
    const varsayim = T('Varsayımlar: aynı tepe ET₀ ve Kc, aynı günlük çalışma süresi ({h} h), aynı kaynak debisi, depolama yok.', { h: n(kap.H, 0) });
    const veri = soilGiven ? [T('Kök derinliği (bitki kaydındaki değer kullanıldı)')] : [T('Toprak sınıfı (tınlı kabul edildi)'), T('Kök derinliği (bitki kaydındaki değer kullanıldı)')];
    const tablo = [], cozumler = [];
    const Imax = s.Imax, top = Math.min(Math.max(Imax + 1, kap.I + 1), 7);
    for (let I = 1; I <= top; I++) {
      if (I === kap.I) continue;
      const need = kap.Vd * I, can = kap.cap != null ? kap.cap * I : null, acik = can != null ? need - can : null;
      let durum, gerekce;
      if (I > Imax) {
        durum = soilGiven ? 'hesaplandi-uygunsuz' : 'veri-gerekli';
        gerekce = T(soilGiven ? '{i} gün > en büyük aralık {m} gün (RAW {raw} mm ÷ günlük net {nt} mm): bitki su stresi riski.' : '{i} gün > en büyük aralık {m} gün (RAW {raw} mm ÷ günlük net {nt} mm): bitki su stresi riski. Toprak sınıfı girilmediği için kesin değildir.',
          { i: String(I), m: String(Imax), raw: n(s.RAW, 1), nt: n(s.net, 2) });
      } else if (acik != null && acik > EPS) {
        durum = 'varsayimla-yetersiz';
        gerekce = T('{i} gün: gereken {a} m³, verilebilen {i} × {h} h × {q} m³/h = {b} m³; açık {c} m³ (günde {d} m³). Aralık değiştirmek günlük açığı kapatmaz.', { i: String(I), a: n(need, 0), h: n(kap.H, 0), q: n(kap.Qs, 1), b: n(can, 0), c: n(acik, 0), d: n(acik / I, 0) });
      } else {
        durum = 'degerlendirilmedi';
        gerekce = T('{i} gün: hacim dengesi sağlanıyor; shift yerleşimi motor yeniden çalıştırılarak MH-AKIL-2’de değerlendirilecek.', { i: String(I) });
      }
      tablo.push({ I, need, can, acik, durum, gerekce });
      cozumler.push({ tur: 'aralik', baslik: T('Sulama aralığı {i} gün', { i: String(I) }), durum, gerekce, varsayim, gerekenVeri: I > Imax || !soilGiven ? veri : [], asama: durum === 'degerlendirilmedi' ? 'MH-AKIL-2' : null, hedef: null });
    }
    return { cozumler, tablo, unsurlar };
  }

  // Çevrilebilir metni düz metne çevirir (sayılar yerel biçimde). fmt(v, d) ve t(x, p) çağırandan gelir.
  function text(x, t, fmt) {
    if (x == null) return '';
    if (typeof x === 'string') return t(x);
    if (Array.isArray(x)) return x.map(y => text(y, t, fmt)).join('; ');
    const p = {};
    for (const [k, v] of Object.entries(x.p || {})) p[k] = Array.isArray(v) ? (typeof v[0] === 'number' ? fmt(v[0], v[1]) : v.map(y => text(y, t, fmt)).join('; ')) : (v && typeof v === 'object' ? text(v, t, fmt) : v);
    return t(x.t, p);
  }
  // Rapor satırları (PDF ve Excel ortak): sayılar sayı olarak kalır
  function reportRows(A, t, fmt) {
    const rows = [];
    for (const x of A.findings) {
      const base = [x.kod, t(LEVEL_AD[x.seviye]), text(x.baslik, t, fmt)];
      const dz = x.durum[0], sn = x.sinir;
      rows.push({ kind: 'uyari', kod: x.kod, seviye: x.seviye, cells: base.concat([dz ? dz.deger : null, sn ? sn.deger : null, dz ? dz.birim : (sn ? sn.birim : ''), '', '', text(x.neden, t, fmt), x.eksikGirdi.map(y => text(y, t, fmt)).join('; ')]), dec: dz ? dz.d : (sn ? sn.d : null) });
      for (const c of x.cozumler) rows.push({ kind: 'cozum', kod: x.kod, seviye: x.seviye, durum: c.durum, cells: [x.kod, '', '', null, null, '', t(TUR_AD[c.tur] || c.tur), t(DURUM_AD[c.durum]) + (c.asama ? ' (' + c.asama + ')' : ''), text(c.baslik, t, fmt) + ': ' + text(c.gerekce, t, fmt) + (c.varsayim ? ' ' + text(c.varsayim, t, fmt) : '') + (c.kapsam ? ' ' + text(c.kapsam, t, fmt) : ''), (c.gerekenVeri || []).map(y => text(y, t, fmt)).join('; ')] });
    }
    return rows;
  }
  const TUR_AD = { shift: 'Shift', kaynak: 'Kaynak', sure: 'Çalışma süresi', aralik: 'Sulama aralığı', bolme: 'Arazi bölme', boru: 'Boru', pn: 'PN sınıfı', ekipman: 'Ekipman', veri: 'Veri', depolama: 'Depolama', isletme: 'İşletme' };

  // Proje + motor sonucu → değerlendirme. Sonuç ekranı, Hidrolik panel, PDF ve Excel bu tek çağrıyı kullanır.
  const SV = () => g.IrriSolver || (typeof require !== 'undefined' ? require('./solver.js') : null);
  const forProject = (p, r) => {
    const S = SV(), alt = S && S.valid(p, r) ? p.akil.alternatifler : null;   // girdiler değiştiyse kayıtlı alternatifler kullanılmaz
    return evaluate(r, { inp: p && p.inp, k: planK(p), projeId: p && p.id || null, revId: null, onay: p && p.akil && p.akil.onay || null, alt });
  };

  const api = { altChecks, forProject, VER, K_DEF, K_MIN, K_MAX, LEVELS, LEVEL_AD, DURUM, DURUM_AD, TUR_AD, ON_DEG, TRANSIENT, COVERS, evaluate, planK, clampK, text, reportRows };
  g.IrriAssess = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

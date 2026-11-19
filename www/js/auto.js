// IrriGrow — MH-AUTO-1: Akıllı Otomatik Tasarım Modu için BAĞIMSIZ veri modeli ve saf kurallar.
// Bu modül hesap motorunu ÇAĞIRMAZ, motor sonucunu ve projeyi DEĞİŞTİRMEZ; yalnız verilen nesneleri okur ve yeni
// nesneler döndürür. Arayüz ve gerçek kilit entegrasyonu MH-MANUEL-1A'dan sonradır (docs/mh-auto-plan.md §6).
(function (g) {
  const SURUM = 1;
  const BAR = 10.2;                 // motorla aynı dönüşüm: PN (bar) → m su sütunu (engine.js)
  const V_ANA_MAX = 2.0;            // motorun ana hat çap adayı sınırı (engine.js: v > 2,0 → aday dışı)

  // ---------- 1. Çalışma modu ----------
  // 'mevcut': alanı olmayan eski projeler — bugünkü motor davranışı aynen (bu modül hiçbir şey önermez).
  // 'manuel': Manuel Mühendislik Modu. 'otomatik': Akıllı Otomatik Tasarım Modu (kullanıcı seçer).
  const MODLAR = ['mevcut', 'manuel', 'otomatik'];
  const ALTERNATIFLER = ['ekonomik', 'dengeli', 'performans'];

  // ---------- 2. Ortak seçim boyutları (malzeme, çap, PN, SDR, shift …) ----------
  // Her boyut bir kilit alanıdır. İleride aday uzayı bu boyutlardan kurulur; kilitli boyut sabit tutulur.
  const BOYUTLAR = {
    'shift.sayi':      { tur: 'sayi', aciklama: 'Shift sayısı', dogrula: v => Number.isInteger(v) && v >= 1 },
    'shift.atama':     { tur: 'nesne', aciklama: 'Elle shift ataması (imza + atama)', dogrula: v => !!v && typeof v.sig === 'string' && Array.isArray(v.assign) },
    'boru.ana':        { tur: 'boru', aciklama: 'Ana hat borusu (malzeme, Ø, SDR, PN)', dogrula: v => boruGecerli(v) },
    'boru.manifold':   { tur: 'boru', aciklama: 'Manifold borusu (malzeme, Ø, SDR, PN)', dogrula: v => boruGecerli(v) },
    'lateral.cap':     { tur: 'sayi', aciklama: 'Lateral çapı (mm)', dogrula: v => [16, 20].includes(v) },
    'sira.yonu':       { tur: 'metin', aciklama: 'Sıra yönü', dogrula: v => ['uzun', 'kisa'].includes(v) },
    'ekipman.pompa':   { tur: 'kimlik', aciklama: 'Pompa', dogrula: v => typeof v === 'string' && !!v },
    'ekipman.filtre':  { tur: 'kimlik', aciklama: 'Filtre', dogrula: v => typeof v === 'string' && !!v },
    'ekipman.vana':    { tur: 'kimlik', aciklama: 'Kontrol vanası', dogrula: v => typeof v === 'string' && !!v },
    'guzergah.ana':    { tur: 'nesne', aciklama: 'Ana hat güzergâhı', dogrula: v => Array.isArray(v) && v.length >= 1 },
  };
  const MALZEMELER = ['PE100', 'PE80', 'PVC-U'];
  function boruGecerli(b) {
    return !!b && MALZEMELER.includes(b.malzeme) && [b.od, b.sdr, b.pn].every(x => typeof x === 'number' && Number.isFinite(x) && x > 0);
  }

  // ---------- 3. Tasarım veri modeli ----------
  function yeniTasarim(mod = 'manuel') {
    if (!MODLAR.includes(mod) || mod === 'mevcut') throw new Error(`Geçersiz mod: ${mod}`);
    return { surum: SURUM, mod, kilitler: {}, oneriler: null, secilen: null, agirliklar: null };
  }
  // Projedeki alanı okur; alan yoksa 'mevcut' (eski proje). Projeyi DEĞİŞTİRMEZ.
  function tasarimOku(proje) {
    const t = proje && proje.tasarim;
    if (!t) return { surum: SURUM, mod: 'mevcut', kilitler: {}, oneriler: null, secilen: null, agirliklar: null };
    return { surum: t.surum || SURUM, mod: MODLAR.includes(t.mod) ? t.mod : 'mevcut', kilitler: Object.assign({}, t.kilitler || {}),
      oneriler: t.oneriler || null, secilen: t.secilen || null, agirliklar: t.agirliklar || null };
  }
  function tasarimDogrula(t) {
    const e = [];
    if (!t || typeof t !== 'object') return ['tasarım bir nesne olmalı'];
    if (t.surum !== SURUM) e.push(`surum ${SURUM} olmalı`);
    if (!MODLAR.includes(t.mod)) e.push(`mod ${MODLAR.join('/')} olmalı`);
    for (const [alan, k] of Object.entries(t.kilitler || {})) {
      if (!BOYUTLAR[alan]) { e.push(`bilinmeyen kilit alanı: ${alan}`); continue; }
      if (!BOYUTLAR[alan].dogrula(k.deger)) e.push(`${alan}: geçersiz değer`);
      if (k.kaynak !== 'kullanici') e.push(`${alan}: kilidi yalnız kullanıcı koyabilir`);
      if (!Number.isFinite(k.zaman)) e.push(`${alan}: zaman damgası gerekli`);
    }
    if (t.secilen != null && !ALTERNATIFLER.includes(t.secilen) && t.secilen !== 'manuel') e.push('secilen geçersiz');
    if (t.agirliklar) e.push(...agirlikDogrula(t.agirliklar));
    return e;
  }

  // ---------- 4. Kilitler (veri altyapısı; gerçek entegrasyon MH-MANUEL-1A sonrası) ----------
  // Kilitler yalnız kullanıcı eylemiyle konur/kaldırılır. Bütün işlevler yeni nesne döndürür (değişmezlik).
  function kilitle(t, alan, deger, zaman = Date.now()) {
    if (!BOYUTLAR[alan]) throw new Error(`Bilinmeyen kilit alanı: ${alan}`);
    if (!BOYUTLAR[alan].dogrula(deger)) throw new Error(`${alan}: geçersiz değer`);
    return Object.assign({}, t, { kilitler: Object.assign({}, t.kilitler, { [alan]: { deger: JSON.parse(JSON.stringify(deger)), kaynak: 'kullanici', zaman } }) });
  }
  function kilitAc(t, alan, onay) {
    if (onay !== true) throw new Error('Kilit yalnız kullanıcının açık onayıyla kaldırılır');
    const k = Object.assign({}, t.kilitler); delete k[alan];
    return Object.assign({}, t, { kilitler: k });
  }
  const kilitliMi = (t, alan) => !!(t && t.kilitler && t.kilitler[alan]);
  // Bir öneriyi kilitlerle birleştirir: kilitli alan HER ZAMAN kullanıcının değeridir. Hangi değerin nereden
  // geldiği alan alan döner. Öneri, kilitli bir alanı değiştirmeye çalışıyorsa bu 'cakisma' olarak raporlanır.
  function birlestir(oneri, t) {
    const deger = {}, kaynak = {}, cakisma = [];
    for (const alan of Object.keys(BOYUTLAR)) {
      const k = t.kilitler[alan];
      if (k) {
        deger[alan] = k.deger; kaynak[alan] = 'kilit';
        if (oneri && alan in oneri && JSON.stringify(oneri[alan]) !== JSON.stringify(k.deger)) cakisma.push(alan);
      } else if (oneri && alan in oneri) { deger[alan] = oneri[alan]; kaynak[alan] = 'oneri'; }
    }
    return { deger, kaynak, cakisma };
  }
  // Kilit uygulanabilirliği: bir kilit yeni koşullarda uygulanamıyorsa SİLİNMEZ; kullanıcıya üç seçenek sunulur.
  // kosullar: { 'shift.atama': { sig: '...' }, 'boru.ana': { gecerliMi: fn } … }
  function kilitDurumu(t, kosullar = {}) {
    return Object.entries(t.kilitler || {}).map(([alan, k]) => {
      const c = kosullar[alan];
      let uygulanabilir = true, neden = null;
      if (alan === 'shift.atama' && c && c.sig != null && k.deger.sig !== c.sig) { uygulanabilir = false; neden = 'Yerleşim değişti; elle shift ataması eski yerleşime ait'; }
      if (c && typeof c.gecerliMi === 'function' && !c.gecerliMi(k.deger)) { uygulanabilir = false; neden = c.neden || 'Kilitli seçim yeni koşullarda geçerli değil'; }
      return { alan, uygulanabilir, neden, secenekler: uygulanabilir ? [] : ['koru', 'uyarla', 'kaldir'] };
    });
  }

  // ---------- 5. Zorunlu mühendislik uygunluk kuralları (U-01…U-07) ----------
  // Girdi: motor sonucu r (design() çıktısı) ve bağlam { kaynakDebisi }. Eksik alan → 'veri-eksik' (asla 'uygun').
  const sayi = x => typeof x === 'number' && Number.isFinite(x);
  const kural = (kod, ad, durum, deger, sinir, mesaj) => ({ kod, ad, durum, deger: deger ?? null, sinir: sinir ?? null, mesaj });
  const eksik = (kod, ad, ne) => kural(kod, ad, 'veri-eksik', null, null, `Hesaplanamadı — eksik veri: ${ne}`);
  const KURALLAR = [
    ['U-01', 'Damlatıcı debi tekdüzeliği', r => {
      const L = r.lateral, M = r.manifold, E = r.emitter;
      if (!L || !M || !E || ![L.maxDH, E.allowLat, M.varMax, E.allowMan].every(sayi)) return eksik('U-01', 'Damlatıcı debi tekdüzeliği', 'lateral/manifold basınç farkı');
      const oran = Math.max(L.maxDH / E.allowLat, M.varMax / E.allowMan);
      return kural('U-01', 'Damlatıcı debi tekdüzeliği', oran <= 1 + 1e-9 ? 'uygun' : 'uygunsuz', oran, 1, 'İzin verilen basınç farkının kullanılan oranı');
    }],
    ['U-02', 'Tepe dönem sulama turu', r => {
      const s = r.sel; if (!s || typeof s.feasible !== 'boolean' || !sayi(s.cycleHours) || !sayi(s.avail)) return eksik('U-02', 'Tepe dönem sulama turu', 'tur süresi');
      return kural('U-02', 'Tepe dönem sulama turu', s.feasible ? 'uygun' : 'uygunsuz', s.cycleHours, s.avail, 'Tur süresi (h) ≤ mevcut sulama süresi (h)');
    }],
    ['U-03', 'Shift debisi ≤ kaynak debisi', (r, b) => {
      if (!r.sel || !sayi(r.sel.Qmax) || !sayi(b.kaynakDebisi)) return eksik('U-03', 'Shift debisi ≤ kaynak debisi', 'kaynak debisi veya shift debisi');
      return kural('U-03', 'Shift debisi ≤ kaynak debisi', r.sel.Qmax <= b.kaynakDebisi + 1e-9 ? 'uygun' : 'uygunsuz', r.sel.Qmax, b.kaynakDebisi, 'm³/h');
    }],
    ['U-04', 'Ana hat akış hızı', r => {
      const m = r.main && r.main.sel; const net = (r.main && r.main.net) || [];
      if (!m || !sayi(m.v)) return eksik('U-04', 'Ana hat akış hızı', 'ana hat hızı');
      const vMax = Math.max(m.v, ...net.map(s => s.v).filter(sayi));
      return kural('U-04', 'Ana hat akış hızı', vMax <= V_ANA_MAX + 1e-9 ? 'uygun' : 'uygunsuz', vMax, V_ANA_MAX, 'm/s (motorun ana hat sınırı)');
    }],
    ['U-05', 'Normal işletme basıncı ≤ boru basınç sınıfı', r => {
      const m = r.main && r.main.sel;
      if (!m || ![m.pn, m.Pop].every(sayi) || !Array.isArray(r.units)) return eksik('U-05', 'Normal işletme basıncı ≤ boru basınç sınıfı', 'PN veya işletme basıncı');
      // PN-2 öncesi: motorun bugünkü kuralı (1,25 × en alçak noktadaki işletme ≤ PN, kapama ≤ PN). PN-2 ile PFA'ya geçer.
      const sinirAna = m.pn * BAR, gerekli = Math.max(1.25 * m.Pop, sayi(r.pump && r.pump.Pshut) ? r.pump.Pshut : (sayi(m.Pshut) ? m.Pshut : 0));
      const man = r.units.filter(u => u.pipe && sayi(u.pipe.pn) && sayi(u.hInMax)).map(u => 1.25 * u.hInMax / (u.pipe.pn * BAR));
      const oran = Math.max(gerekli / sinirAna, ...man);
      return kural('U-05', 'Normal işletme basıncı ≤ boru basınç sınıfı', oran <= 1 + 1e-9 ? 'uygun' : 'uygunsuz', oran, 1,
        'Ana hat ve manifoldlarda gereken basıncın PN sınırına oranı (PN-2 ile sıcaklık ve PFA eklenecek)');
    }],
    ['U-06', 'Lateral giriş basıncı ≤ lateral sınırı', r => {
      const cat = r.lateral && r.lateral.cat;
      if (!cat || !sayi(cat.maxH) || !Array.isArray(r.units) || !r.units.length) return eksik('U-06', 'Lateral giriş basıncı ≤ lateral sınırı', 'lateral borusu en büyük basıncı');
      const h = Math.max(...r.units.map(u => u.hInMax).filter(sayi));
      return kural('U-06', 'Lateral giriş basıncı ≤ lateral sınırı', h <= cat.maxH + 1e-9 ? 'uygun' : 'uygunsuz', h, cat.maxH, 'm');
    }],
    ['U-07', 'Pompa çalışma noktası', r => {
      const p = r.pump; if (!p) return eksik('U-07', 'Pompa çalışma noktası', 'pompa');
      if (!p.need) return kural('U-07', 'Pompa çalışma noktası', 'uygun', null, null, 'Pompa gerekmiyor');
      if (!p.fromCatalog) return eksik('U-07', 'Pompa çalışma noktası', 'katalogda uygun pompa yok (temsilî pompa)');
      return kural('U-07', 'Pompa çalışma noktası', 'uygun', p.over ?? null, null, 'Katalog pompası bütün shift görev noktalarını karşılıyor');
    }],
  ];
  function uygunluk(r, baglam = {}) {
    if (!r || !r.ok) return { durum: 'veri-eksik', kurallar: [eksik('U-00', 'Hesap sonucu', 'motor sonucu yok veya hatalı')] };
    const kurallar = KURALLAR.map(([, , f]) => { try { return f(r, baglam); } catch (e) { return eksik('U-??', 'Kural', String(e.message || e)); } });
    const durum = kurallar.some(k => k.durum === 'uygunsuz') ? 'uygunsuz' : kurallar.some(k => k.durum === 'veri-eksik') ? 'veri-eksik' : 'uygun';
    return { durum, kurallar };
  }

  // ---------- 6. Geçici rejim (ayrı; asla tek başına 'uygunsuz' değil) ----------
  function geciciRejim(r) {
    const s = r && r.surge;
    if (!s || ![s.peak, s.pnH, s.dH].every(sayi)) return { durum: 'veri-eksik', mesaj: 'Su darbesi ön değerlendirmesi yapılamadı' };
    if (s.peak > s.pnH + 1e-9) return { durum: 'gecici-analiz-gerekli', deger: s.peak, sinir: s.pnH,
      mesaj: 'Teorik su darbesi üst sınırı PN sınıfını aşabilir. Ayrıntılı geçici rejim analizi gereklidir.' };
    return { durum: 'on-degerlendirme-sinir-icinde', deger: s.peak, sinir: s.pnH, mesaj: 'Joukowsky üst sınırı PN içinde — yalnız ön değerlendirme' };
  }

  // ---------- 7. Doğrulanmış uygunluk ve veri niteliği ----------
  // MH-3 (kot hidrolikte) ve MH-AKIL-5 (geçici rejim) tamamlanmadan en yüksek durum 'on-tasarim'dır.
  const YETENEK = { kotHidrolikte: false, geciciRejimAnalizi: false };   // bu sürümün gerçek durumu
  function veriNiteligi(r, proje = {}) {
    const n = [];
    if (r && r.pump && r.pump.need && r.pump.fromCatalog && !r.pump.verified) n.push({ kod: 'katalog-jenerik', mesaj: 'Pompa kaydı jenerik (doğrulanmamış katalog)' });
    if (r && r.pump && r.pump.need && !r.pump.fromCatalog) n.push({ kod: 'pompa-temsili', mesaj: 'Katalogda uygun pompa yok; temsilî pompa' });
    if (r && r.lateral && r.lateral.cat && r.lateral.cat.dogrulandi === false) n.push({ kod: 'katalog-jenerik', mesaj: 'Lateral borusu jenerik değer' });
    if (r && r.filter && r.filter.missing && r.filter.missing.length) n.push({ kod: 'katalog-eksik', mesaj: 'Katalogda eksik filtre' });
    if (!r || !r.cost || r.cost.total == null) n.push({ kod: 'fiyat-eksik', mesaj: 'Bazı kalemlerin fiyatı yok — maliyet sıralaması kesin değil' });
    else if (r.cost.example > 0) n.push({ kod: 'fiyat-ornek', mesaj: 'Örnek fiyatlar kullanıldı' });
    if (r && r.schedule && r.schedule.epSrc === 'ornek') n.push({ kod: 'fiyat-ornek', mesaj: 'Elektrik fiyatı örnek değer' });
    if (proje.elev || (proje.inp && proje.inp.grad)) n.push({ kod: 'kot-dem', mesaj: 'Kot verisi harita yükseklik modelinden (≈ 90 m, ön inceleme)' });
    if (!YETENEK.kotHidrolikte) n.push({ kod: 'kot-hidrolik-yok', mesaj: 'Kot verisi hidrolik hesaba dahil edilmedi (MH-3)' });
    if (!YETENEK.geciciRejimAnalizi) n.push({ kod: 'gecici-analiz-yok', mesaj: 'Ayrıntılı geçici rejim analizi yapılmadı (MH-AKIL-5)' });
    return n;
  }
  function degerlendir(r, baglam = {}, proje = {}) {
    const u = uygunluk(r, baglam), gr = geciciRejim(r), nit = veriNiteligi(r, proje);
    const engel = nit.filter(x => ['katalog-jenerik', 'pompa-temsili', 'kot-hidrolik-yok', 'gecici-analiz-yok'].includes(x.kod)).map(x => x.mesaj);
    const dogrulanmis = u.durum === 'uygun' && gr.durum === 'on-degerlendirme-sinir-icinde' && !engel.length
      ? { durum: 'dogrulanmis-uygun', eksikler: [] }
      : { durum: 'on-tasarim', etiket: 'Ön tasarım — mühendislik doğrulaması gerekli', eksikler: engel };
    return { normal: u, gecici: gr, dogrulanmis, veriNiteligi: nit };
  }

  // ---------- 8. Alternatif seçimi (Ekonomik, Dengeli, Performans) ----------
  const VARSAYILAN_AGIRLIK = Object.freeze({ yatirim: 0.35, enerji: 0.30, bakim: 0.20, hidrolik: 0.15 });
  function agirlikDogrula(a) {
    const e = [], k = ['yatirim', 'enerji', 'bakim', 'hidrolik'];
    if (!a || typeof a !== 'object') return ['ağırlıklar bir nesne olmalı'];
    for (const x of k) if (!(sayi(a[x]) && a[x] >= 0 && a[x] <= 1)) e.push(`${x} ağırlığı 0–1 arasında olmalı`);
    if (Object.keys(a).some(x => !k.includes(x))) e.push('bilinmeyen ağırlık');
    if (!e.length && Math.abs(k.reduce((t, x) => t + a[x], 0) - 1) > 1e-6) e.push('ağırlıkların toplamı %100 olmalı');
    return e;
  }
  // aday: { id, uygunluk (uygunluk() çıktısı), metrik: { yatirim|null, metraj, enerjiYillik, bakimYillik|null,
  //          hidrolik: { Hmax, vMax, tekduzelikOrani, toplamKayip } }, crf }
  function alternatifSec(adaylar, secenek = {}) {
    // Zorunlu uygunluk filtresi kapatılamaz: yalnız 'agirliklar' seçeneği kabul edilir.
    const bilinmeyen = Object.keys(secenek || {}).filter(k => k !== 'agirliklar');
    if (bilinmeyen.length) throw new Error(`Bilinmeyen seçenek (${bilinmeyen.join(', ')}): zorunlu uygunluk filtresi devre dışı bırakılamaz`);
    const agirlik = secenek.agirliklar || VARSAYILAN_AGIRLIK;
    const ae = agirlikDogrula(agirlik); if (ae.length) throw new Error(ae.join('; '));
    const havuz = (adaylar || []).filter(a => a.uygunluk && a.uygunluk.durum === 'uygun');   // zorunlu filtre: puanlamadan ÖNCE
    if (!havuz.length) {
      const nedenler = {};
      for (const a of adaylar || []) for (const k of (a.uygunluk && a.uygunluk.kurallar) || []) if (k.durum !== 'uygun') (nedenler[k.kod] = nedenler[k.kod] || { kod: k.kod, ad: k.ad, durum: k.durum, aday: 0 }).aday++;
      return { durum: 'uygun-tasarim-yok', mesaj: 'Uygun tasarım bulunamadı', nedenler: Object.values(nedenler).sort((x, y) => y.aday - x.aday), alternatifler: [] };
    }
    const fiyatTam = havuz.every(a => sayi(a.metrik.yatirim));
    const bakimTam = havuz.every(a => sayi(a.metrik.bakimYillik));
    const yat = a => fiyatTam ? a.metrik.yatirim : a.metrik.metraj;           // fiyat eksikse vekil ölçüt: boru metrajı
    const crf = a => sayi(a.crf) ? a.crf : 0;
    const yillik = a => (fiyatTam ? a.metrik.yatirim * crf(a) : 0) + a.metrik.enerjiYillik + (bakimTam ? a.metrik.bakimYillik : 0);
    const kapsam = { yatirim: fiyatTam ? 'fiyat' : 'metraj-vekil', bakim: bakimTam ? 'dahil' : 'hesaplanmadi', siralamaKesin: fiyatTam };
    const notlar = [];
    if (!fiyatTam) notlar.push('Bazı kalemlerin fiyatı yok: yatırım yerine boru metrajı kullanıldı — sıralama kesin değil');
    if (!bakimTam) notlar.push('Bakım maliyeti hesaplanmadı — karşılaştırma bakım hariç');
    const min = f => Math.min(...havuz.map(f)), enIyi = (f, esitlik) => [...havuz].sort((x, y) => f(x) - f(y) || esitlik(x, y) || String(x.id).localeCompare(String(y.id)))[0];
    // Hidrolik performans göstergesi (küçük = iyi): normalize en yüksek basınç, en yüksek hız ve tekdüzelik oranı ortalaması
    const h = a => a.metrik.hidrolik, nz = (v, m) => m > 0 ? v / m : 1;
    const mH = min(a => h(a).Hmax), mV = min(a => h(a).vMax), mT = Math.max(min(a => h(a).tekduzelikOrani), 1e-9);
    const hidrolikSkor = a => (nz(h(a).Hmax, mH) + nz(h(a).vMax, mV) + nz(h(a).tekduzelikOrani, mT)) / 3;
    // Dengeli puan: bakım verisi yoksa bakım ağırlığı katılmaz, kalanlar oransal ölçeklenir
    const w = Object.assign({}, agirlik); if (!bakimTam) { const kalan = 1 - w.bakim; w.bakim = 0; for (const k of ['yatirim', 'enerji', 'hidrolik']) w[k] = kalan > 0 ? w[k] / kalan : 0; }
    const mY = min(yat), mE = Math.max(min(a => a.metrik.enerjiYillik), 1e-9), mB = bakimTam ? Math.max(min(a => a.metrik.bakimYillik), 1e-9) : 1;
    const dengeliPuan = a => w.yatirim * nz(yat(a), mY) + w.enerji * nz(a.metrik.enerjiYillik, mE) + (bakimTam ? w.bakim * nz(a.metrik.bakimYillik, mB) : 0) + w.hidrolik * hidrolikSkor(a);
    const sec = {
      ekonomik: enIyi(fiyatTam ? yillik : yat, (x, y) => hidrolikSkor(x) - hidrolikSkor(y)),
      dengeli: enIyi(dengeliPuan, (x, y) => yat(x) - yat(y)),
      performans: enIyi(a => a.metrik.enerjiYillik, (x, y) => h(x).toplamKayip - h(y).toplamKayip || h(x).tekduzelikOrani - h(y).tekduzelikOrani || h(x).vMax - h(y).vMax || yat(x) - yat(y)),
    };
    // Aynı tasarıma düşen alternatifler tek kartta birleştirilir
    const kartlar = [];
    for (const tur of ALTERNATIFLER) { const a = sec[tur], k = kartlar.find(x => x.id === a.id); if (k) k.turler.push(tur); else kartlar.push({ id: a.id, turler: [tur], aday: a }); }
    return { durum: 'tamam', kapsam, notlar, agirliklar: w, secim: { ekonomik: sec.ekonomik.id, dengeli: sec.dengeli.id, performans: sec.performans.id }, alternatifler: kartlar,
      puan: Object.fromEntries(havuz.map(a => [a.id, { yillik: yillik(a), dengeli: dengeliPuan(a), hidrolik: hidrolikSkor(a) }])) };
  }
  // Motor sonucundan aday metriği (yalnız okuma). bakimYillik kullanıcıdan gelir; yoksa null (uydurulmaz).
  function metrikCikar(r, bakimYillik = null) {
    const pipeLen = (r.lateral ? r.lateral.len : 0) + ((r.manifold && r.manifold.byPipe) || []).reduce((t, b) => t + b.len, 0) + ((r.main && r.main.Lmain) || 0);
    const kayip = ((r.main && r.main.sel && r.main.sel.hf) || 0) + ((r.lateral && r.lateral.hfMax) || 0) + ((r.manifold && r.manifold.hfMax) || 0);
    return {
      yatirim: r.cost && sayi(r.cost.total) ? r.cost.total : null, metraj: pipeLen,
      enerjiYillik: r.schedule && sayi(r.schedule.energyCost) ? r.schedule.energyCost : 0,
      bakimYillik: sayi(bakimYillik) && bakimYillik >= 0 ? bakimYillik : null,
      hidrolik: { Hmax: r.main.sel.Hmax, vMax: r.main.sel.v, toplamKayip: kayip,
        tekduzelikOrani: Math.max(r.lateral.maxDH / r.emitter.allowLat, r.manifold.varMax / r.emitter.allowMan) },
    };
  }

  // ---------- 8b. Kilitli tasarım uygunsuz hâle gelirse: kilit korunur, gerekçe açıklanır ----------
  // u: uygunluk() çıktısı (kilitli seçimlerle hesaplanmış tasarım). Kilitleri DEĞİŞTİRMEZ; kullanıcıya açıklama üretir.
  const KURAL_ILGILI = { 'U-01': ['lateral.cap', 'boru.manifold', 'shift.atama'], 'U-02': ['shift.sayi', 'shift.atama'], 'U-03': ['shift.sayi', 'shift.atama'],
    'U-04': ['boru.ana'], 'U-05': ['boru.ana', 'boru.manifold', 'ekipman.pompa'], 'U-06': ['lateral.cap', 'boru.manifold'], 'U-07': ['ekipman.pompa'] };
  function kilitliTasarimGerekce(t, u) {
    const kilitli = Object.keys((t && t.kilitler) || {});
    if (!u || !Array.isArray(u.kurallar)) return { durum: 'veri-eksik', mesaj: 'Uygunluk sonucu yok' };
    const sorunlu = u.kurallar.filter(k => k.durum !== 'uygun');
    if (!sorunlu.length) return { durum: 'uygun', kilitli, gerekceler: [] };
    const gerekceler = sorunlu.map(k => ({ kod: k.kod, ad: k.ad, durum: k.durum, deger: k.deger, sinir: k.sinir, aciklama: k.mesaj,
      ilgiliKilitler: (KURAL_ILGILI[k.kod] || []).filter(a => kilitli.includes(a)) }));
    const kilitKaynakli = gerekceler.some(g => g.ilgiliKilitler.length);
    return { durum: u.durum, kilitli, kilitlerKorundu: true, gerekceler,
      mesaj: kilitli.length
        ? `Kilitli seçimleriniz korundu (${kilitli.join(', ')}). Bu tasarım şu koşulları sağlamıyor: ${gerekceler.map(g => `${g.kod} ${g.ad}`).join('; ')}.`
          + (kilitKaynakli ? ' İlgili kilitleri gözden geçirebilirsiniz; sistem kilitleri kendiliğinden değiştirmez.' : '')
        : `Bu tasarım şu koşulları sağlamıyor: ${gerekceler.map(g => `${g.kod} ${g.ad}`).join('; ')}.` };
  }

  // ---------- 9. Aday uzayı (ortak değerlendirme yapısı) ----------
  // secenekler: { alan: [değerler] }. Kilitli alan tek değere (kullanıcının değeri) indirgenir. Sınır aşılırsa kısmi.
  function adayUzayi(secenekler, t, sinir = 200) {
    const alanlar = Object.keys(secenekler).filter(a => BOYUTLAR[a]);
    const listeler = alanlar.map(a => kilitliMi(t, a) ? [t.kilitler[a].deger] : secenekler[a].filter(v => BOYUTLAR[a].dogrula(v)));
    const out = []; let kismi = false;
    const gez = (i, acc) => { if (out.length >= sinir) { kismi = true; return; } if (i === alanlar.length) { out.push(Object.assign({}, acc)); return; }
      for (const v of listeler[i]) { acc[alanlar[i]] = v; gez(i + 1, acc); if (out.length >= sinir) { kismi = true; return; } } };
    if (listeler.every(l => l.length)) gez(0, {});
    return { adaylar: out, kismi, toplam: listeler.reduce((t, l) => t * l.length, 1) };
  }

  const api = { SURUM, MODLAR, ALTERNATIFLER, BOYUTLAR, VARSAYILAN_AGIRLIK, YETENEK, yeniTasarim, tasarimOku, tasarimDogrula,
    kilitle, kilitAc, kilitliMi, birlestir, kilitDurumu, uygunluk, geciciRejim, veriNiteligi, degerlendir,
    agirlikDogrula, alternatifSec, metrikCikar, adayUzayi, kilitliTasarimGerekce };
  // Kurallar ve API dışarıdan değiştirilemez (ör. uygunluk() yerine her şeyi 'uygun' sayan bir işlev konamaz)
  Object.freeze(KURALLAR); KURALLAR.forEach(Object.freeze); Object.freeze(BOYUTLAR); Object.values(BOYUTLAR).forEach(Object.freeze);
  Object.freeze(YETENEK); Object.freeze(api);
  g.IrriAuto = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

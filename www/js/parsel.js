// IrriGrow 1.0.7 düzeltme — Çoklu parsel (tek projede birden çok bağımsız parsel)
//
// Veri modeli (geriye uyumlu):
//  • Projenin üst düzey alanları (inp, poly, src, station, route, shift ve ekipman alanları …) her zaman AKTİF parseldir.
//    Tek parselli eski projelerde hiçbir şey değişmez: bu alanlar zaten projenin tek parselidir.
//  • Çok parselli projede ek alanlar: parselId / parselAd (aktif parselin kimliği ve adı), parseller (diğer parseller:
//    her biri { id, ad, inp, poly, src, … } — aktif parselle aynı alanlar), parselSira (görüntüleme sırası).
//  • Parsel değiştirmek, aktif parselin alanlarını paketleyip "parseller"e koymak ve seçileni üst düzeye almaktır.
//    Böylece Sınır / Kaynak / İstasyon / Ana hat / Shift / Hidrolik / Malzeme / ekipman / rapor kodu değişmeden aktif
//    parsel üzerinde çalışır ve hesap motoru (engine.js) değişmez.
// Hidrolik: her parsel kendi kaynağı, ana hattı ve shift düzeniyle AYRI hesaplanır; parseller birbirine bağlı sayılmaz.
// Ortak kaynak / ortak pompa / ortak ana hat bu sürümde hesaplanmaz — böyle bir durum algılanırsa açıkça "hesaplanmadı" yazılır.
(function (g) {
  'use strict';
  const Gm = () => g.IrriGeom || (typeof require !== 'undefined' ? require('./geom.js') : null);
  // Parsele ait alanlar (proje adı, kimliği, revizyonlar ve çizim başlığı (meta) projeye aittir)
  const KEYS = ['inp', 'poly', 'src', 'station', 'route', 'hydro', 'elev', 'geoKaynak', 'kmlGeriAl', 'shiftEdit', 'shiftEditEski', 'shiftEditYedek',
    'shiftSira', 'shiftHedef', 'shiftHedefler', 'shiftKullaniciKarari', 'shiftGeriAl', 'katalogKalemleri', 'ekipmanSecimi', 'drawPos', 'techOpt', 'akil'];
  // Yeni parselde parselin geometrisine / kaynağına bağlı girdiler taşınmaz (kullanıcı yeniden girer)
  const PARSELE_OZGU_GIRDI = ['area_da', 'L', 'W', 'grad', 'slopeLong', 'slopeShort', 'Q', 'depth', 'Havail', 'Ns', 'boruSecimi', 'dZ'];
  const RENK = ['#ffd400', '#ff7043', '#ab47bc', '#26c6da', '#9ccc65', '#ec407a', '#7e57c2', '#ffa726', '#29b6f6', '#d4e157'];

  const coklu = p => !!(p && Array.isArray(p.parseller) && p.parseller.length > 0);
  const aktifId = p => (p && p.parselId) || 'p1';
  const aktifAd = p => (p && p.parselAd) || 'Parsel 1';
  const kopya = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));

  function paketle(p) {
    const o = { id: aktifId(p), ad: aktifAd(p) };
    for (const k of KEYS) if (p[k] !== undefined) o[k] = p[k];
    return o;
  }
  function yerlestir(p, o) {
    for (const k of KEYS) delete p[k];
    for (const k of KEYS) if (o[k] !== undefined) p[k] = o[k];
    if (!Array.isArray(p.poly)) p.poly = [];
    if (!p.inp || typeof p.inp !== 'object') p.inp = {};
    p.parselId = o.id; p.parselAd = o.ad;
  }
  // Görüntüleme sırasıyla bütün parseller: { id, ad, aktif, veri } (veri: aktif için proje, diğerleri için parsel kaydı)
  function liste(p) {
    if (!p) return [];
    const hepsi = [{ id: aktifId(p), ad: aktifAd(p), aktif: true, veri: p }].concat((p.parseller || []).map(o => ({ id: o.id, ad: o.ad, aktif: false, veri: o })));
    const sira = Array.isArray(p.parselSira) ? p.parselSira : [];
    const yer = id => { const i = sira.indexOf(id); return i < 0 ? 1e6 : i; };
    return hepsi.sort((a, b) => yer(a.id) - yer(b.id) || a.id.localeCompare(b.id, 'en', { numeric: true })).map((x, i) => Object.assign(x, { renk: RENK[i % RENK.length], sira: i }));
  }
  const yeniId = p => { const n = liste(p).map(x => +String(x.id).replace(/\D/g, '') || 0); return 'p' + (Math.max(0, ...n) + 1); };
  function siraGuncelle(p) { p.parselSira = liste(p).map(x => x.id); }
  // Aktif parseli değiştir (veri kopyalanmaz, yer değiştirir: kayıp olmaz)
  function sec(p, id) {
    if (!coklu(p) || id === aktifId(p)) return false;
    const i = p.parseller.findIndex(o => o.id === id); if (i < 0) return false;
    if (!p.parselSira) siraGuncelle(p);
    const eski = paketle(p), yeni = p.parseller.splice(i, 1)[0];
    p.parseller.push(eski); yerlestir(p, yeni);
    return true;
  }
  // Yeni boş parsel ekler ve aktif yapar. sablon: parselin girdileri (yoksa aktif parselin geometriden bağımsız girdileri)
  function ekle(p, ad, veri) {
    if (!p.parselId) p.parselId = 'p1';
    if (!p.parselAd) p.parselAd = 'Parsel 1';
    p.parseller = p.parseller || [];
    siraGuncelle(p);
    const id = yeniId(p), inp = kopya(p.inp) || {};
    for (const k of PARSELE_OZGU_GIRDI) delete inp[k];
    inp.geom = 'parsel';
    const o = Object.assign({ id, ad: ad || ('Parsel ' + id.slice(1)), inp, poly: [] }, veri || {});
    o.id = id;
    p.parseller.push(paketle(p)); yerlestir(p, o);
    p.parselSira.push(id);
    return id;
  }
  // Parseli siler (son parsel silinemez). Aktif parsel silinirse sıradaki parsel aktif olur.
  function sil(p, id) {
    if (!coklu(p)) return false;
    if (id === aktifId(p)) {
      const sonraki = liste(p).find(x => !x.aktif); sec(p, sonraki.id);
    }
    const i = p.parseller.findIndex(o => o.id === id); if (i < 0) return false;
    p.parseller.splice(i, 1);
    if (Array.isArray(p.parselSira)) p.parselSira = p.parselSira.filter(x => x !== id);
    if (!p.parseller.length) delete p.parseller;
    return true;
  }
  function adlandir(p, id, ad) {
    ad = String(ad || '').trim().slice(0, 80); if (!ad) return false;
    if (id === aktifId(p)) { if (!p.parselId) p.parselId = 'p1'; p.parselAd = ad; return true; }
    const o = (p.parseller || []).find(x => x.id === id); if (!o) return false;
    o.ad = ad; return true;
  }

  // ---------- Alan, çevre, çakışma ----------
  function alanCevre(poly) {
    if (!Array.isArray(poly) || poly.length < 3) return null;
    const Lc = Gm().toLocal(poly).pts;
    let A = 0, P = 0;
    for (let i = 0; i < Lc.length; i++) { const [x1, y1] = Lc[i], [x2, y2] = Lc[(i + 1) % Lc.length]; A += x1 * y2 - x2 * y1; P += Math.hypot(x2 - x1, y2 - y1); }
    return { alan_m2: Math.abs(A) / 2, cevre_m: P };
  }
  const icinde = (pt, vs) => { let c = false; for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) { const [yi, xi] = vs[i], [yj, xj] = vs[j]; if ((yi > pt[0]) !== (yj > pt[0]) && pt[1] < (xj - xi) * (pt[0] - yi) / (yj - yi) + xi) c = !c; } return c; };
  const kutu = vs => vs.reduce((b, [a, o]) => [Math.min(b[0], a), Math.min(b[1], o), Math.max(b[2], a), Math.max(b[3], o)], [Infinity, Infinity, -Infinity, -Infinity]);
  // İki parselin çakışan alanı (m²): ortak sınır kutusunda düzenli örnekleme (yaklaşık, uyarı için)
  function cakismaAlani(a, b) {
    const ka = kutu(a), kb = kutu(b), k = [Math.max(ka[0], kb[0]), Math.max(ka[1], kb[1]), Math.min(ka[2], kb[2]), Math.min(ka[3], kb[3])];
    if (k[0] >= k[2] || k[1] >= k[3]) return 0;
    const N = 120; let n = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const pt = [k[0] + (i + 0.5) * (k[2] - k[0]) / N, k[1] + (j + 0.5) * (k[3] - k[1]) / N]; if (icinde(pt, a) && icinde(pt, b)) n++; }
    if (!n) return 0;
    const ac = alanCevre([[k[0], k[1]], [k[0], k[3]], [k[2], k[3]], [k[2], k[1]]]);
    return ac.alan_m2 * n / (N * N);
  }
  const mesafe = (a, b) => { const R = 6371000, r = Math.PI / 180, dl = (b[0] - a[0]) * r, dn = (b[1] - a[1]) * r * Math.cos((a[0] + b[0]) / 2 * r); return R * Math.hypot(dl, dn); };

  // ---------- Proje özeti (parsel bazlı ve toplam) ----------
  // hesapla(parselVerisi, aktifMi) → motor sonucu (çağıran sağlar; bu modül motoru çağırmaz)
  function ozet(p, hesapla) {
    const L = liste(p), satir = [], uyarilar = [];
    for (const x of L) {
      const v = x.veri, ac = alanCevre(v.poly), inp = v.inp || {};
      const s = { id: x.id, ad: x.ad, aktif: x.aktif, renk: x.renk, alan_m2: ac ? ac.alan_m2 : null, cevre_m: ac ? ac.cevre_m : null, kose: (v.poly || []).length,
        kaynak: v.src || null, kaynakTip: inp.srcType || null, Q: inp.Q != null && inp.Q !== '' ? +String(inp.Q).replace(',', '.') : null, durum: 'eksik', neden: '' };
      if (!ac) s.neden = 'Parsel sınırı yok (en az 3 köşe)';
      else if (s.Q == null || !(s.Q > 0)) s.neden = 'Kaynak debisi girilmedi';
      else {
        let r = null; try { r = hesapla ? hesapla(v, x.aktif) : null; } catch (e) { r = { ok: false, err: [String(e && e.message || e)] }; }
        if (!r) s.neden = 'Hesap yapılmadı';
        else if (!r.ok) { s.durum = 'hesaplanamadi'; s.neden = (r.err && r.err[0]) || 'Hesap yapılamadı'; }
        else {
          s.durum = r.layout && r.layout.mode === 'parsel' ? 'hesaplandi' : 'yaklasik';
          if (s.durum === 'yaklasik') s.neden = 'Parsel planı yok: dikdörtgen yaklaşımıyla hesaplandı (Arazi → Uygula)';
          s.shift = r.sel.groups.length; s.altUnite = r.units.length; s.Qsys = Math.max(...r.sel.Qj); s.H = r.pump && r.pump.need ? r.pump.H : null;
          s.kW = r.pump && r.pump.need && r.pump.motor ? r.pump.motor : null; s.uyari = r.warn.length; s.kaynakAsimi = !!r.sel.overSource;
          s.shiftler = r.sel.Qj.map((q, j) => ({ ad: `${x.ad} · Shift ${j + 1}`, Q: q }));
        }
      }
      satir.push(s);
    }
    // Çakışma: çift sayılmasın
    let cakisma = 0;
    const gecerli = L.filter(x => (x.veri.poly || []).length >= 3);
    for (let i = 0; i < gecerli.length; i++) for (let j = i + 1; j < gecerli.length; j++) {
      const a = cakismaAlani(gecerli[i].veri.poly, gecerli[j].veri.poly);
      if (a > 1) { cakisma += a; uyarilar.push({ kod: 'cakisma', mesaj: '“{a}” ile “{b}” çakışıyor (≈ {d} da): çakışan alan toplamda bir kez sayıldı; sınırları düzeltin.', p: { a: gecerli[i].ad, b: gecerli[j].ad, d: (a / 1000).toFixed(2) } }); }
    }
    // Ortak kaynak: farklı parsellerin kaynakları aynı noktada (≤ 15 m) — ortak kaynak/pompa hesabı yapılmaz
    const kaynakli = L.filter(x => Array.isArray(x.veri.src) && x.veri.src.length === 2);
    for (let i = 0; i < kaynakli.length; i++) for (let j = i + 1; j < kaynakli.length; j++) {
      if (mesafe(kaynakli[i].veri.src, kaynakli[j].veri.src) <= 15) [kaynakli[i].id, kaynakli[j].id].forEach(id => { const x = satir.find(y => y.id === id); if (x) x.ortakKaynak = true; }), uyarilar.push({ kod: 'ortak-kaynak', mesaj: '“{a}” ve “{b}” aynı kaynağı kullanıyor görünüyor: ortak kaynak / pompa hesabı yapılmadı. Parseller ayrı hesaplandı; aynı anda sulanırlarsa toplam debi kaynak kapasitesini aşabilir.', p: { a: kaynakli[i].ad, b: kaynakli[j].ad } });
    }
    const brut = satir.reduce((s, x) => s + (x.alan_m2 || 0), 0);
    const tamam = satir.filter(x => x.durum === 'hesaplandi').length;
    return {
      parseller: satir, uyarilar,
      // Yöntem: alan = parsel sınırlarının düzlem alanları toplamı (boşluk dahil değil); çakışma varsa düzenli örneklemeyle düşülür → yaklaşık.
      // Parsel kaynak debileri TOPLANMAZ ve ortak pompa debisi olarak sunulmaz; durum yalnız parsellerin ayrı hesaplarının durumudur.
      toplam: { parsel: satir.length, alan_m2: brut - cakisma, brut_m2: brut, cakisma_m2: cakisma, alanYaklasik: cakisma > 1, shift: satir.reduce((s, x) => s + (x.shift || 0), 0), hesaplanan: tamam,
        durum: tamam === satir.length && !uyarilar.some(u => u.kod === 'ortak-kaynak') ? 'hesaplandi' : 'eksik' },
    };
  }

  // Toplam değerlerin üretim yöntemi (ekran ve rapor aynı metin)
  function yontemNotlari(oz, T) {
    return [T('Toplam alan: parsel sınırlarının düzlem alanlarının toplamıdır; parseller arasındaki boşluk dahil değildir.'),
      oz.toplam.alanYaklasik ? T('Parsel sınırları çakıştığı için toplam alan YAKLAŞIKTIR: çakışan alan düzenli örneklemeyle tahmin edilip bir kez sayıldı; sınırlar düzeltilmeden kesin alan olarak kullanmayın.') : null,
      T('Parsel kaynak debileri toplanmaz ve ortak pompa debisi değildir; ortak pompa / kaynak / ana hat uygunluğu hesaplanmadı.'),
      T('Proje durumu yalnız parsellerin ayrı hesaplarını özetler: hepsi ayrı ayrı hesaplandıysa “hesaplandı” yazılır; ortak sistem uygunluğu anlamına gelmez.'),
      oz.parseller.some(x => x.ortakKaynak) ? T('Ortak kaynak kullanan parseller için ortak sistem doğrulanmadı; ayrı sonuçlar ortak sistem tasarımı yerine kullanılamaz.') : null].filter(Boolean);
  }
  // Rapor tablosu (PDF/Excel ortak): başlık + parsel satırları + toplam
  function raporTablosu(oz, T) {
    const D = { hesaplandi: 'Hesaplandı', yaklasik: 'Yaklaşık (parsel planı yok)', hesaplanamadi: 'Hesaplanamadı', eksik: 'Eksik veri' };
    const rows = [[T('Parsel'), T('Alan (da)'), T('Çevre (m)'), T('Kaynak debisi (m³/h)'), T('Shift sayısı'), T('En büyük shift debisi (m³/h)'), T('Pompa basma yük. (m)'), T('Durum')]];
    for (const s of oz.parseller) rows.push([s.ad + (s.aktif ? ' *' : ''), s.alan_m2 != null ? s.alan_m2 / 1000 : '—', s.cevre_m != null ? s.cevre_m : '—', s.Q != null ? s.Q : '—', s.shift != null ? s.shift : '—', s.Qsys != null ? s.Qsys : '—', s.H != null ? s.H : '—', T(D[s.durum]) + (s.ortakKaynak ? ' — ' + T('Ortak kaynak: doğrulanmadı') : '') + (s.neden ? ' — ' + T(s.neden) : '')]);
    rows.push([oz.toplam.alanYaklasik ? T('Proje toplamı (alan yaklaşık)') : T('Proje toplamı'), oz.toplam.alan_m2 / 1000, '', '', oz.toplam.shift, '', '', oz.toplam.durum === 'hesaplandi' ? T('Bütün parseller hesaplandı') : T('Bazı parseller hesaplanmadı — toplam eksik')]);
    const notlar = [T('Her parsel kendi kaynağı, ana hattı ve shift düzeniyle ayrı hesaplanır; parseller hidrolik olarak birbirine bağlı sayılmaz. Ortak kaynak, pompa veya ana hat hesaplanmaz.'), T('* Ayrıntılı hidrolik bölümler aktif parsele aittir.')].concat(yontemNotlari(oz, T))
      .concat(oz.toplam.cakisma_m2 > 1 ? [T('Çakışan alan ({d} da) toplamda bir kez sayıldı.', { d: (oz.toplam.cakisma_m2 / 1000).toFixed(2).replace('.', ',') })] : [])
      .concat(oz.uyarilar.map(u => T(u.mesaj, u.p)));
    return { rows, dec: [null, 2, 0, 2, 0, 2, 1, null], notlar };
  }

  // Çok parselli rapor özeti uygulama tarafından hesaplanıp rapora iletilir (kalıcı kaydedilmez)
  const bellek = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  const ozetBelle = (p, oz) => { if (bellek && p) bellek.set(p, oz); };
  const ozetAl = p => (bellek && p ? bellek.get(p) : null) || null;

  const api = { yontemNotlari, KEYS, RENK, coklu, aktifId, aktifAd, liste, sec, ekle, sil, adlandir, alanCevre, cakismaAlani, ozet, raporTablosu, ozetBelle, ozetAl };
  g.IrriParsel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

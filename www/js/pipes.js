// IrriGrow — PN-1: standart tabanlı boru kütüphanesi (yalnız veri ve doğrulama katmanı).
// Hesap motoru, otomatik boru seçimi ve eski katalog (catalog-data.js) bu modülü KULLANMAZ (docs/pn-1-uygulama.md).
// Kullanım PN-2 (izin verilen basınç) ve PN-3 (elle boru seçimi) ile başlar.
(function (g) {
  const D = g.IRRI_PIPES_DATA || (typeof require !== 'undefined' ? require('./pipes-data.js') : null);
  const MALZEMELER = ['PE100', 'PE80', 'PVC-U'];
  const HAT_TURLERI = ['ana', 'dagitim', 'manifold'];
  const DUZEYLER = ['iki-uretici-katalogu', 'standart-metni'];   // etkin kütüphane yalnız bu düzeyleri kabul eder
  const PN_MERDIVEN = [4, 5, 6, 8, 10, 12.5, 16, 20, 25];
  const DUZEY_URETICI = 'uretici-katalogu';   // yalnız o üreticinin kendi ürünü için; standart kütüphaneye karışmaz
  const r1 = x => Math.round(x * 10) / 10;
  // Veri değiştirilemez: çağıran kod (ekran, rapor) kütüphane satırlarını yanlışlıkla bozamaz
  const dondur = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.values(o).forEach(dondur); Object.freeze(o); } return o; };
  if (D) ['SATIRLAR', 'ADAYLAR', 'KAYNAKLAR', 'SICAKLIK', 'SICAKLIK_ADAY', 'EKSIK', 'URETICI_KAYITLARI'].forEach(k => dondur(D[k]));

  // Geçerli (doğrulanmış) STANDART TABANLI kombinasyonlar. Üreticiye özel kayıtlar burada yoktur (ureticiListe).
  function liste(f = {}) {
    return D.SATIRLAR.filter(s => DUZEYLER.includes(s.dogrulama) && !s.uretici
      && (!f.malzeme || s.malzeme === f.malzeme)
      && (!f.hatTuru || s.hatTurleri.includes(f.hatTuru))
      && (f.od == null || s.od === f.od)
      && (f.pn == null || s.pn === f.pn));
  }
  // Tek satır veya null (geçersiz / doğrulanmamış kombinasyon)
  function bul(malzeme, od, sdr) {
    if (!MALZEMELER.includes(malzeme) || !Number.isFinite(od) || !Number.isFinite(sdr)) return null;   // eksik girdi filtre sayılmaz
    return liste({ malzeme, od }).find(s => s.sdr === sdr) || null;
  }
  // İç çap: nominal dış çap − 2 × en küçük et (bugünkü katalogla aynı yöntem). Bu değer gerçek borudan
  // biraz büyüktür (et toleransı); ekranda "en küçük et kalınlığıyla hesaplandı" notu gerekir.
  function icCap(s) { return s ? r1(s.od - 2 * s.enMin) : null; }

  // Standart PN merdiveninde x'i aşmayan en büyük değer
  const asagiPn = x => PN_MERDIVEN.filter(p => p <= x + 1e-9).pop() ?? null;
  // Çapraz denetim: PN = 20·MRS / (C·(SDR − 1)), standart PN'e aşağı yuvarlanır. Tablo PN'i esastır.
  function pnDenetim(s) {
    if (!s || !s.mrs || !s.cTasarim) return { tamam: false, neden: 'MRS veya C yok' };
    const ham = 20 * s.mrs / (s.cTasarim * (s.sdr - 1)), hesap = asagiPn(ham);
    return { tamam: hesap === s.pn, ham, hesap, tablo: s.pn };
  }
  // Sıcaklık düşürme katsayısı. Doğrulanmış tablo yoksa ya da T aralık dışındaysa null — değer uydurulmaz.
  // Yalnız doğrulanmış tablo (SICAKLIK) kullanılır; SICAKLIK_ADAY hiçbir yoldan hesaba girmez.
  function sicaklikKatsayisi(malzeme, T) {
    const t = D.SICAKLIK[malzeme];
    if (!t || !DUZEYLER.includes(t.dogrulama) || !Array.isArray(t.noktalar) || !Number.isFinite(T)) return null;
    const n = t.noktalar;
    if (T < n[0][0] - 1e-9 || T > n[n.length - 1][0] + 1e-9) return null;
    for (let i = 0; i < n.length - 1; i++) {
      const [t1, f1] = n[i], [t2, f2] = n[i + 1];
      if (T >= t1 - 1e-9 && T <= t2 + 1e-9) return t2 > t1 ? f1 + (T - t1) / (t2 - t1) * (f2 - f1) : f1;
    }
    return n[n.length - 1][1];
  }
  // Ekranda gösterilecek durum: doğrulanmış tablo yoksa 'veri-eksik' + (varsa) tek kaynaklı aday ve belirsizlik notları
  function sicaklikDurumu(malzeme) {
    if (sicaklikSecenekleri(malzeme).length) return { durum: 'dogrulandi' };
    const aday = D.SICAKLIK_ADAY[malzeme] || null;
    // Aday yalnız BİLGİ olarak döner (kopya, secilebilir: false); hesap parametresi olarak seçilemez.
    return { durum: 'veri-eksik', aday: aday ? Object.assign({}, aday, { secilebilir: false, yalnizBilgi: true }) : null,
      belirsizlik: aday && aday.belirsizlik ? aday.belirsizlik : [],
      mesaj: 'Sıcaklık katsayısı doğrulanmadı — 20 °C değeri dışında izin verilen basınç düzeltilemez' };
  }
  // Kullanıcının hesap parametresi olarak SEÇEBİLECEĞİ sıcaklık tabloları: yalnız doğrulanmış olanlar.
  function sicaklikSecenekleri(malzeme) {
    const t = D.SICAKLIK[malzeme];
    return t && DUZEYLER.includes(t.dogrulama) && sicaklikTablosuDogrula(t).length === 0 ? [t] : [];
  }
  // İçe aktarılan veya elle girilen sıcaklık tablosu: doğrulama düzeyi ve kaynak zorunlu; tek kaynaklı/aday tablo reddedilir.
  function sicaklikTablosuDogrula(t) {
    const e = [];
    if (!t || typeof t !== 'object') return ['sıcaklık tablosu bir nesne olmalı'];
    if (!DUZEYLER.includes(t.dogrulama)) e.push(`sıcaklık tablosu doğrulama düzeyi ${DUZEYLER.join('/')} olmalı (tek kaynaklı veya aday tablo hesaba alınamaz)`);
    if (!Array.isArray(t.kaynaklar) || t.kaynaklar.length < (t.dogrulama === 'standart-metni' ? 1 : 2)) e.push('sıcaklık tablosu için yeterli kaynak yok');
    const n = t.noktalar;
    if (!Array.isArray(n) || n.length < 2) e.push('en az iki sıcaklık noktası gerekli');
    else {
      n.forEach((p, i) => { if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || p[1] <= 0 || p[1] > 1) e.push(`nokta ${i}: [°C, 0 < katsayı ≤ 1] olmalı`); });
      for (let i = 1; i < n.length; i++) if (n[i][0] <= n[i - 1][0] || n[i][1] > n[i - 1][1]) e.push('sıcaklık artan, katsayı azalan olmalı');
    }
    return [...new Set(e)];
  }

  // Üreticiye özel kayıtlar: standart tablodan AYRI tutulur; kendi standart sürümü, tasarım katsayısı ve katalog sürümüyle.
  function ureticiListe(f = {}) {
    return (D.URETICI_KAYITLARI || []).filter(s => s.dogrulama === DUZEY_URETICI
      && (!f.uretici || s.uretici === f.uretici) && (!f.malzeme || s.malzeme === f.malzeme) && (f.od == null || s.od === f.od));
  }
  function ureticiKaydiDogrula(satirlar) {
    const e = [];
    (satirlar || []).forEach((s, i) => {
      const k = `uretici[${i}]`;
      for (const f of ['uretici', 'katalogSurum', 'standart', 'standartSurum']) if (typeof s[f] !== 'string' || !s[f].trim()) e.push(`${k}.${f} gerekli`);
      if (!(Number.isFinite(s.cTasarim) && s.cTasarim >= 1)) e.push(`${k}.cTasarim (tasarım katsayısı) gerekli ve ≥ 1 olmalı`);
      if (s.dogrulama !== DUZEY_URETICI) e.push(`${k}.dogrulama '${DUZEY_URETICI}' olmalı`);
      for (const f of ['od', 'sdr', 'enMin', 'pn']) if (!(typeof s[f] === 'number' && Number.isFinite(s[f]) && s[f] > 0)) e.push(`${k}.${f} pozitif sayı olmalı`);
      if (s.ulke != null && !/^[A-Z]{2}$/.test(s.ulke)) e.push(`${k}.ulke ISO 3166-1 iki harfli kod olmalı`);
    });
    return e;
  }

  const MALZEME_ESKI = { pe: 'PE100', pvc: 'PVC-U' };
  // Eski katalog kaydının (catalog-data.js) yeni kütüphanedeki karşılığı ve farkı. Kataloğu DEĞİŞTİRMEZ.
  // durum: 'ayni' | 'fark' | 'aday-tek-kaynak' | 'aday-celiski' | 'karsilik-yok'
  function esdeger(kayit, tur) {
    const malzeme = kayit.malzeme || MALZEME_ESKI[tur];
    const sdrEski = kayit.sdr || (kayit.et ? r1(kayit.od / kayit.et) : null);
    const adaylar = liste({ malzeme, od: kayit.od, pn: kayit.pn });
    const s = adaylar.find(x => x.sdr === kayit.sdr) || (adaylar.length === 1 ? adaylar[0] : null);
    const out = { id: kayit.id, malzeme, od: kayit.od, pn: kayit.pn, etEski: kayit.et ?? null, icEski: kayit.ic ?? null, sdrEski };
    if (s) {
      const ic = icCap(s), dEt = kayit.et != null ? r1(kayit.et - s.enMin) : null, dIc = kayit.ic != null ? r1(kayit.ic - ic) : null;
      return Object.assign(out, { durum: dEt === 0 && dIc === 0 ? 'ayni' : 'fark', sdr: s.sdr, enMin: s.enMin, ic, dEt, dIc, dogrulama: s.dogrulama });
    }
    const a = D.ADAYLAR.find(x => x.malzeme === malzeme && x.od === kayit.od && (kayit.sdr ? x.sdr === kayit.sdr : Math.abs(x.sdr - sdrEski) / x.sdr < 0.08));
    if (a) return Object.assign(out, { durum: a.neden === 'celiski' ? 'aday-celiski' : 'aday-tek-kaynak', sdr: a.sdr, degerler: a.degerler });
    return Object.assign(out, { durum: 'karsilik-yok' });
  }
  function karsilastir(katalog) {
    const b = (katalog && katalog.borular) || {};
    return [...(b.pe || []).map(k => esdeger(k, 'pe')), ...(b.pvc || []).map(k => esdeger(k, 'pvc'))];
  }

  // Kütüphane / üretici kaydı doğrulaması (içe aktarma ve testler için). Hata listesi döner.
  function dogrula(satirlar, kaynaklar = D.KAYNAKLAR) {
    const e = [];
    const pos = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
    (satirlar || []).forEach((s, i) => {
      const k = `kutuphane[${i}]`;
      if (!MALZEMELER.includes(s.malzeme)) e.push(`${k}.malzeme ${MALZEMELER.join('/')} olmalı`);
      for (const f of ['od', 'sdr', 'enMin', 'pn']) if (!pos(s[f])) e.push(`${k}.${f} pozitif sayı olmalı`);
      if (pos(s.sdr) && s.sdr <= 2) e.push(`${k}.sdr 2'den büyük olmalı`);
      if (pos(s.od) && pos(s.enMin) && 2 * s.enMin >= s.od) e.push(`${k} et kalınlığı dış çapın yarısından küçük olmalı`);
      if (pos(s.pn) && !PN_MERDIVEN.includes(s.pn)) e.push(`${k}.pn standart PN değeri değil`);
      if (!DUZEYLER.includes(s.dogrulama)) e.push(`${k}.dogrulama ${DUZEYLER.join('/')} olmalı (doğrulanmamış satır etkin kütüphaneye giremez)`);
      if (!s.standart || !s.standartSurum) e.push(`${k}.standart ve standartSurum gerekli`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.dogrulamaTarihi || '')) e.push(`${k}.dogrulamaTarihi YYYY-AA-GG olmalı`);
      if (!Array.isArray(s.hatTurleri) || !s.hatTurleri.length || s.hatTurleri.some(h => !HAT_TURLERI.includes(h))) e.push(`${k}.hatTurleri ${HAT_TURLERI.join('/')} değerlerinden olmalı`);
      const kk = s.kaynaklar || [];
      if (s.dogrulama === 'iki-uretici-katalogu') {
        const yay = new Set(kk.map(id => kaynaklar[id] && kaynaklar[id].yayimci).filter(Boolean));
        if (yay.size < 2) e.push(`${k} iki bağımsız üretici kaynağı gerekli`);
        if ((s.pnKaynak || []).filter(id => kaynaklar[id]).length < 2) e.push(`${k} PN için iki kaynak gerekli`);
      }
      for (const id of [...kk, ...(s.pnKaynak || [])]) if (!kaynaklar[id]) e.push(`${k} bilinmeyen kaynak: ${id}`);
      // Genişletilebilir alanlar: varsa metin (veya null) olmalı; üretici kaydı üretici ve katalog sürümü taşımalı
      for (const f of ['standartBolgesi', 'esdegerStandart', 'ulke', 'uretici', 'urunSerisi', 'katalogKodu', 'katalogSurum'])
        if (s[f] !== undefined && s[f] !== null && (typeof s[f] !== 'string' || !s[f].trim())) e.push(`${k}.${f} boş olmayan metin veya null olmalı`);
      if (s.ulke != null && !/^[A-Z]{2}$/.test(s.ulke)) e.push(`${k}.ulke ISO 3166-1 iki harfli kod olmalı (ör. TR)`);
      if (s.uretici && !s.katalogSurum) e.push(`${k} üretici kaydında katalogSurum gerekli`);
    });
    const seen = new Set();
    (satirlar || []).forEach((s, i) => { const key = `${s.malzeme}|${s.od}|${s.sdr}`; if (seen.has(key)) e.push(`kutuphane[${i}] yinelenen kombinasyon ${key}`); seen.add(key); });
    return e;
  }

  const api = { MALZEMELER, HAT_TURLERI, DUZEYLER, DUZEY_URETICI, PN_MERDIVEN, liste, bul, icCap, pnDenetim, sicaklikKatsayisi, sicaklikDurumu, sicaklikSecenekleri, sicaklikTablosuDogrula, ureticiListe, ureticiKaydiDogrula, esdeger, karsilastir, dogrula, veri: D };
  g.IrriPipes = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

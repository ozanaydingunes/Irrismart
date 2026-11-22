// IrriGrow — Akıllı ekipman seçimi, aşama 1: boru eşleştirme (salt okunur; hesap motorunu değiştirmez).
// Girdi: E.design sonucu (ana hat segment debileri, uzunlukları, mevcut çap/PN ve basınç ölçütü) + katalog ürün veritabanı
// (IrriKatalogUrun veri modeli; ayrı bir ürün modeli tanımlanmaz).
// Kurallar:
//  - Yalnız mühendislik doğrulaması geçmiş ürünler "uygun" olabilir; incelenmemiş / doğrulanmamış / eksik verili ürün
//    "verisi eksik" listesine gider, uygun listesine ALINMAZ. Örnek veri hiçbir zaman önerilmez.
//  - İç çap = dış çap − 2 × et kalınlığı (üretici verisi); hız ve sürtünme kaybı motorla AYNI işlevle (Hazen-Williams, C = 150, +%10 yerel kayıp).
//  - Basınç sınıfı motorla aynı ölçüt: PN × 10,2 m ≥ max(1,25 × işletme basıncı, kapama basıncı).
//  - Hız sınırı motorla aynı: ≤ 2,0 m/s.
//  - Bağlantı uyumu: aday malzeme mevcut hat malzemesinden farklıysa geçiş parçası gerekliliği bildirilir; aynı segmentte
//    aynı dış çap serisi korunmuyorsa bağlantı elemanları değişir uyarısı verilir.
//  - Su darbesi (geçici rejim) PN sınıfıyla karıştırılmaz; ayrı uyarı olarak her sonuçta yer alır.
(function (g) {
  'use strict';
  const Hy = () => g.IrriHyd || (typeof require !== 'undefined' ? require('./hydraulics.js') : null);
  const U = () => g.IrriKatalogUrun || (typeof require !== 'undefined' ? require('./katalog-urun.js') : null);
  const V_MAX = 2.0, YEREL = 1.10, M_PER_BAR = 10.2;

  // Proje segment gereksinimleri (motor sonucundan; değiştirmeden)
  function gereksinimler(r) {
    if (!r || !r.ok || !r.main || !r.main.net) return null;
    const m = r.main.sel || {}, pompaKapama = r.pump && r.pump.Pshut != null ? r.pump.Pshut : 0;
    const basincGerek = Math.max(1.25 * (m.Pop || 0), m.Pshut || 0, pompaKapama);
    return {
      basincGerek_m: basincGerek, isletme_m: m.Pop || 0, kapama_m: Math.max(m.Pshut || 0, pompaKapama),
      segmentler: r.main.net.filter(s => !s.virtual && s.L > 0).map(s => ({ id: s.id, L: s.L, Qmax: s.Qmax, od: s.od, pn: s.pn, ic: s.ic,
        malzeme: s.pipe && s.pipe.malzeme ? s.pipe.malzeme : 'PVC-U', v: s.v, hf: s.hf })),
    };
  }

  // Katalog ürün veritabanından boru adayları (değerler + kaynak sayfaları)
  function boruAdaylari(urunler, degerler) {
    return (urunler || []).filter(u => u.kategori === 'boru' && !u.ornek).map(u => {
      const D = {}, kaynak = []; for (const d of (degerler || []).filter(x => x.urunId === u.id)) { D[d.ad] = d.siDeger ?? d.deger; kaynak.push({ ad: d.ad, katalogId: d.kaynak.katalogId, sayfa: d.kaynak.sayfa }); }
      return { urun: u, od: D.dis_cap ?? null, e: D.et_kalinligi ?? null, pn: D.pn ?? null, malzeme: D.malzeme ?? null, sdr: D.sdr ?? null, kaynak };
    });
  }

  // Bir segment için tek ürün değerlendirmesi
  function degerlendir(seg, a, gerek) {
    const neden = [], uyari = ['Su darbesi (geçici rejim) PN sınıfıyla değerlendirilmez; ayrı analiz gerekir.'];
    const kaynakSayfalar = [...new Set(a.kaynak.map(k => k.katalogId + ' s.' + k.sayfa))];
    const temel = { urunId: a.urun.id, uretici: a.urun.uretici, model: a.urun.model, urunKodu: a.urun.urunKodu, katalogId: a.urun.katalogId, kaynakSayfalar };
    if (!U().secimdeKullanilabilir(a.urun)) neden.push(a.urun.muhendislik === 'reddedildi' ? 'mühendislik doğrulamasında reddedildi' : 'mühendislik doğrulaması yapılmadı (kullanıcı incelemesi yeterli değildir)');
    for (const [k, ad] of [['od', 'dış çap'], ['e', 'et kalınlığı'], ['pn', 'PN'], ['malzeme', 'malzeme']]) if (a[k] == null) neden.push(`${ad} katalogda kayıtlı değil`);
    if (neden.length) return Object.assign(temel, { durum: 'eksik-veri', neden, uyari });
    const ic = a.od - 2 * a.e;
    if (!(ic > 0)) return Object.assign(temel, { durum: 'eksik-veri', neden: ['iç çap hesaplanamadı (et kalınlığı tutarsız)'], uyari });
    const v = Hy().velocity(seg.Qmax, ic), hf = Hy().hfHW(seg.Qmax / 3600, ic / 1000, seg.L) * YEREL;
    const pnM = a.pn * M_PER_BAR, rezerv = pnM - gerek.basincGerek_m;
    if (v > V_MAX + 1e-9) neden.push(`hız ${v.toFixed(2)} m/s > ${V_MAX} m/s`);
    if (rezerv < -1e-9) neden.push(`PN ${a.pn} (${pnM.toFixed(1)} m) < gereken ${gerek.basincGerek_m.toFixed(1)} m (1,25 × işletme veya kapama basıncı)`);
    if (a.malzeme !== seg.malzeme) uyari.push(`malzeme geçişi (${seg.malzeme} → ${a.malzeme}): uygun geçiş/bağlantı parçası gerekir`);
    if (a.od !== seg.od) uyari.push(`dış çap ${seg.od} → ${a.od} mm: bağlantı elemanları (manşon, redüksiyon, T) yeniden seçilmeli`);
    return Object.assign(temel, { durum: neden.length ? 'uygun-degil' : 'uygun', neden, uyari,
      hesap: { od: a.od, e: a.e, ic, sdr: a.od / a.e, pn: a.pn, malzeme: a.malzeme, v, hf, dhf: hf - seg.hf, basincRezerv_m: rezerv } });
  }

  // Segment başına üç liste: uygun (en küçük kayıp artışı / hız sırasıyla) / verisi eksik / uygun değil
  function alternatifler(r, urunler, degerler) {
    const gerek = gereksinimler(r); if (!gerek) return null;
    const adaylar = boruAdaylari(urunler, degerler);
    return Object.assign({}, gerek, { segmentler: gerek.segmentler.map(seg => {
      const L = adaylar.map(a => degerlendir(seg, a, gerek));
      const uygun = L.filter(x => x.durum === 'uygun').sort((p, q) => p.hesap.od - q.hesap.od || p.hesap.hf - q.hesap.hf);
      return { seg, uygun, eksik: L.filter(x => x.durum === 'eksik-veri'), uygunDegil: L.filter(x => x.durum === 'uygun-degil'),
        ureticiSayisi: new Set(uygun.map(x => x.uretici)).size };
    }) });
  }

  const api = Object.freeze({ V_MAX, gereksinimler, boruAdaylari, degerlendir, alternatifler });
  g.IrriEslesBoru = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

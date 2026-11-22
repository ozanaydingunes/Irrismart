// IrriGrow — Katalog teknik ürün veritabanı: veri modeli (saf işlevler; depolama ve arayüzden bağımsız).
// İlkeler:
//  - Her teknik değerin kaynağı zorunludur: katalog, sayfa numarası, özgün değer ve birim (PDF'teki ham metin önerilir).
//  - Bilinmeyen değer tahmin edilmez; alan boş kalır. Eğrilerde ölçülen aralık dışında değer üretilmez.
//  - İki ayrı onay: kullanıcı incelemesi ("okunan değer PDF'tekiyle aynı") ≠ mühendislik doğrulaması.
//    Yalnız mühendislik doğrulaması geçmiş ürün ekipman seçiminde kullanılabilir; kullanıcı onayı hesaba girmez.
//  - Hesap motoru, boru kütüphanesi ve proje verisi bu modülden çağrılmaz.
(function (g) {
  'use strict';
  const SURUM = 1;
  const KATEGORI = ['boru', 'baglanti', 'vana', 'filtre', 'pompa', 'damla', 'diger'];
  const INCELEME = ['bekliyor', 'kullanici-onayladi', 'reddedildi'];
  const MUHENDISLIK = ['dogrulanmadi', 'dogrulandi', 'reddedildi'];
  const YONTEM = ['elle', 'goruntu-elle', 'metin', 'tablo'];

  // Teknik değer tanımları: SI birimi, izin verilen özgün birimler ve dönüşümler (yalnız tanımlı dönüşümler; tahmin yok)
  const BIRIM = {
    uzunluk_mm: { si: 'mm', donusum: { mm: 1, cm: 10, m: 1000, inch: 25.4, '"': 25.4 } },
    basinc_bar: { si: 'bar', donusum: { bar: 1, atm: 1.01325, kPa: 0.01, MPa: 10, psi: 0.0689476, 'mSS': 0.0980665 } },
    debi_m3h: { si: 'm³/h', donusum: { 'm³/h': 1, 'm3/h': 1, 'l/h': 0.001, 'l/s': 3.6, 'l/min': 0.06 } },
    yukseklik_m: { si: 'm', donusum: { m: 1, mSS: 1, bar: 10.1972, kPa: 0.101972 } },
    guc_kw: { si: 'kW', donusum: { kW: 1, W: 0.001, HP: 0.7457, PS: 0.7355 } },
    devir_rpm: { si: 'd/dk', donusum: { 'd/dk': 1, rpm: 1, 'min⁻¹': 1, '1/min': 1 } },
    oran: { si: '', donusum: { '': 1 } },
    yuzde: { si: '%', donusum: { '%': 1 } },
    kv: { si: 'm³/h/√bar', donusum: { 'm³/h/√bar': 1, Kv: 1, Cv: 0.865 } },
    mesh: { si: 'mesh', donusum: { mesh: 1 } },
    mikron: { si: 'µm', donusum: { 'µm': 1, mikron: 1, micron: 1 } },
    metin: { si: '', donusum: null },
  };
  const DEGER = {
    dis_cap: 'uzunluk_mm', et_kalinligi: 'uzunluk_mm', ic_cap: 'uzunluk_mm', dn: 'uzunluk_mm',
    pn: 'basinc_bar', basinc_min: 'basinc_bar', basinc_max: 'basinc_bar', sdr: 'oran',
    malzeme: 'metin', baglanti: 'metin', standart: 'metin', sicaklik_max: 'oran', pompa_tipi: 'metin', filtre_tipi: 'metin',
    debi_max: 'debi_m3h', debi_min: 'debi_m3h', debi_nominal: 'debi_m3h',
    kv: 'kv', filtrasyon_mesh: 'mesh', filtrasyon_mikron: 'mikron',
    kayip_temiz: 'basinc_bar', kayip_kirli: 'basinc_bar', geri_yikama_esigi: 'basinc_bar',
    devir: 'devir_rpm', cark_capi: 'uzunluk_mm', guc_motor: 'guc_kw', verim_max: 'yuzde',
  };
  const METIN_SECENEK = { pompa_tipi: ['dalgic', 'santrifuj'], filtre_tipi: ['disk', 'elek', 'kum', 'hidrosiklon'], baglanti: ['elektrofuzyon', 'alin-kaynak', 'kompresyon', 'yapistirma', 'contali', 'flans', 'disli'] };
  const MALZEME = ['PE80', 'PE100', 'PE100-RC', 'PVC-U', 'PP', 'PP-R', 'LDPE', 'pirinç', 'dökme demir', 'paslanmaz', 'diger'];

  const kirp = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
  const yeniId = on => on + '_' + ((g.crypto && g.crypto.getRandomValues) ? Array.from(g.crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('') : Math.random().toString(16).slice(2, 18));

  // Kaynak: katalog + sayfa zorunlu; yöntem elle / görüntüden elle / metin / tablo
  function kaynakDogrula(k) {
    const h = [];
    if (!k || !k.katalogId) h.push('kaynak katalog yok');
    if (!k || !Number.isInteger(k.sayfa) || k.sayfa < 1) h.push('sayfa numarası yok');
    if (k && k.yontem && !YONTEM.includes(k.yontem)) h.push('kaynak yöntemi geçersiz');
    return h;
  }

  function yeniUrun(o) {
    const simdi = new Date().toISOString();
    return {
      surum: SURUM, id: o.id || yeniId('urn'), katalogId: o.katalogId || null, katalogDosyaSha: o.katalogDosyaSha || null,
      uretici: kirp(o.uretici, 120), marka: kirp(o.marka, 120), aile: kirp(o.aile, 120), model: kirp(o.model, 160), urunKodu: kirp(o.urunKodu, 80),
      kategori: KATEGORI.includes(o.kategori) ? o.kategori : 'diger',
      inceleme: 'bekliyor', muhendislik: 'dogrulanmadi', dogrulama: null, notlar: kirp(o.notlar, 1000),
      olusturma: simdi, guncelleme: simdi, ornek: o.ornek === true,
    };
  }
  function urunDogrula(u) {
    const h = [];
    if (!u.uretici) h.push('üretici gerekli');
    if (!u.model && !u.urunKodu) h.push('model veya ürün kodu gerekli');
    if (!u.katalogId) h.push('kaynak katalog gerekli');
    if (!KATEGORI.includes(u.kategori)) h.push('kategori geçersiz');
    return h;
  }

  // Teknik değer: özgün değer + birim + kaynak zorunlu; SI değeri yalnız tanımlı dönüşümle hesaplanır
  function yeniDeger(o) {
    const tur = DEGER[o.ad], B = tur && BIRIM[tur];
    const h = [];
    if (!B) h.push('bilinmeyen teknik değer: ' + o.ad);
    h.push(...kaynakDogrula(o.kaynak));
    let si = null;
    if (B && B.donusum) {
      const sayi = typeof o.deger === 'number' ? o.deger : Number(String(o.deger).replace(',', '.'));
      if (!Number.isFinite(sayi)) h.push('değer sayı değil');
      else if (!(o.birim in B.donusum)) h.push(`birim "${o.birim}" ${o.ad} için tanımlı değil`);
      else si = sayi * B.donusum[o.birim];
    } else if (B && !kirp(o.deger, 200)) h.push('değer boş');
    else if (METIN_SECENEK[o.ad] && !METIN_SECENEK[o.ad].includes(o.deger)) h.push(`${o.ad} için geçerli değerler: ${METIN_SECENEK[o.ad].join(', ')}`);
    if (h.length) return { hata: h };
    return { deger: { id: o.id || yeniId('dgr'), urunId: o.urunId, ad: o.ad, deger: o.deger, birim: o.birim || '', siDeger: si, siBirim: B.si,
      kaynak: { katalogId: o.kaynak.katalogId, sayfa: o.kaynak.sayfa, hamMetin: kirp(o.kaynak.hamMetin, 500), yontem: o.kaynak.yontem || 'elle' },
      inceleme: 'bekliyor', olusturma: new Date().toISOString() } };
  }

  // Performans eğrisi: en az 4 nokta, Q kesin artan, kaynak zorunlu; devir ve çark çapı koşulu eğrinin parçası
  const EGRI_TUR = { QH: ['debi_m3h', 'yukseklik_m'], verim: ['debi_m3h', 'yuzde'], guc: ['debi_m3h', 'guc_kw'], NPSHr: ['debi_m3h', 'yukseklik_m'], kayip: ['debi_m3h', 'basinc_bar'] };
  function yeniEgri(o) {
    const h = [], T = EGRI_TUR[o.tur];
    if (!T) h.push('eğri türü geçersiz');
    h.push(...kaynakDogrula(o.kaynak));
    const n = Array.isArray(o.noktalar) ? o.noktalar : [];
    if (n.length < 4) h.push('en az 4 nokta gerekli');
    if (n.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) h.push('nokta biçimi geçersiz');
    else for (let i = 1; i < n.length; i++) if (!(n[i][0] > n[i - 1][0])) { h.push('debi değerleri kesin artan olmalı'); break; }
    const bx = T && BIRIM[T[0]].donusum[o.birimX], by = T && BIRIM[T[1]].donusum[o.birimY];
    if (T && (bx == null || by == null)) h.push('eğri birimleri tanımlı değil');
    if (o.tur === 'QH' && !(o.kosul && (o.kosul.devir || o.kosul.carkCapi))) h.push('Q–H eğrisinde devir veya çark çapı belirtilmeli');
    if (h.length) return { hata: h };
    return { egri: { id: o.id || yeniId('egr'), urunId: o.urunId, tur: o.tur, birimX: o.birimX, birimY: o.birimY, noktalar: n.map(p => p.slice()),
      si: n.map(([x, y]) => [x * bx, y * by]), kosul: Object.assign({}, o.kosul || {}),
      kaynak: { katalogId: o.kaynak.katalogId, sayfa: o.kaynak.sayfa, hamMetin: kirp(o.kaynak.hamMetin, 500), yontem: o.kaynak.yontem || 'goruntu-elle' },
      inceleme: 'bekliyor', olusturma: new Date().toISOString() } };
  }
  // Eğri üzerinde doğrusal ara değer: yalnız ölçülen aralık içinde; dışında null (tahmin yok)
  function egriDeger(egri, Q) {
    const p = egri.si; if (!p || !p.length || Q < p[0][0] || Q > p[p.length - 1][0]) return null;
    for (let i = 1; i < p.length; i++) if (Q <= p[i][0]) { const [x0, y0] = p[i - 1], [x1, y1] = p[i]; return y0 + (y1 - y0) * (Q - x0) / (x1 - x0); }
    return null;
  }

  // Kullanıcı incelemesi: yalnız "okunan değer PDF'tekiyle aynı" anlamına gelir; mühendislik durumunu değiştirmez
  function incele(kayit, durum) { if (!INCELEME.includes(durum)) throw new Error('inceleme durumu geçersiz'); return Object.assign({}, kayit, { inceleme: durum, guncelleme: new Date().toISOString() }); }

  // ---------- Mühendislik doğrulaması ----------
  // Kurallar dört grupta: (1) tamlık, (2) matematiksel tutarlılık, (3) ürün standardı, (4) işletme koşulu ve katalog sınırları.
  // Sonuç: { gecti, kurallar: [{ kod, grup, durum: 'gecti'|'kaldi'|'eksik', mesaj }] }. Kalan veya eksik kural varsa "doğrulandı" yapılamaz.
  const SDR_PN = { PE80: { 6: 21, 8: 17, 10: 13.6, 12.5: 11, 16: 9 }, PE100: { 6: 26, 8: 21, 10: 17, 12.5: 13.6, 16: 11, 20: 9 }, 'PE100-RC': { 6: 26, 8: 21, 10: 17, 12.5: 13.6, 16: 11, 20: 9 } }; // EN 12201-2, C = 1,25
  const PE_DIS_CAP = [16, 20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 180, 200, 225, 250, 280, 315, 355, 400, 450, 500, 560, 630]; // EN 12201-2 nominal dış çaplar
  const PVC_DIS_CAP = [20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 200, 225, 250, 280, 315, 355, 400, 450, 500, 630]; // EN ISO 1452-2
  function muhendislikDenetle(u, degerler, egriler, kosul) {
    const D = {}; for (const d of degerler || []) D[d.ad] = d;
    const v = ad => D[ad] ? D[ad].siDeger ?? D[ad].deger : null;
    const K = []; const ekle = (kod, grup, durum, mesaj) => K.push({ kod, grup, durum, mesaj });
    const gerekli = (ad, grup) => { if (v(ad) == null) { ekle('eksik-' + ad, 'tamlık', 'eksik', `${ad} katalogda kayıtlı değil`); return false; } return true; };
    if ((degerler || []).some(d => d.inceleme !== 'kullanici-onayladi')) ekle('inceleme', 'tamlık', 'eksik', 'tüm değerler kullanıcı incelemesinden geçmeli');
    if (u.kategori === 'boru') {
      const ok = ['dis_cap', 'et_kalinligi', 'pn', 'malzeme'].map(a => gerekli(a)).every(Boolean);
      if (ok) {
        const od = v('dis_cap'), e = v('et_kalinligi'), mal = v('malzeme'), pn = v('pn');
        if (!(e > 0 && e < od / 2)) ekle('et-aralik', 'tutarlılık', 'kaldi', 'et kalınlığı dış çapın yarısından küçük ve pozitif olmalı');
        if (v('ic_cap') != null && Math.abs(v('ic_cap') - (od - 2 * e)) > 0.2) ekle('ic-cap', 'tutarlılık', 'kaldi', `iç çap ${v('ic_cap')} mm ≠ dış çap − 2 × et = ${(od - 2 * e).toFixed(1)} mm`);
        if (v('sdr') != null && Math.abs(v('sdr') - od / e) > Math.max(0.6, 0.08 * v('sdr')))   // küçük çaplarda en az 2,0 mm et nedeniyle d/e, SDR'den sapabilir
           ekle('sdr', 'tutarlılık', 'kaldi', `SDR ${v('sdr')} ≠ dış çap / et = ${(od / e).toFixed(1)}`);
        if (/^PE/.test(mal)) {
          if (!PE_DIS_CAP.includes(od)) ekle('std-cap', 'standart', 'kaldi', `${od} mm EN 12201-2 nominal dış çap serisinde yok`);
          const beklenenSdr = (SDR_PN[mal] || {})[pn];
          if (beklenenSdr == null) ekle('std-pn', 'standart', 'kaldi', `${mal} için PN ${pn} EN 12201-2 serisinde yok`);
          else {
            // EN 12201-2 güvenlik yönü: et kalınlığı en az max(2,0 mm, d / SDR) olmalı (daha ince et PN sınıfını karşılamaz);
            // tablo değerleri yuvarlama nedeniyle biraz kalın olabilir (ör. Ø110 SDR17: 6,47 → 6,6 mm). Aşırı kalın et yanlış SDR/PN eşleşmesidir.
            const eMin = Math.max(2.0, od / beklenenSdr);
            if (e < eMin - 0.005) ekle('std-sdr-pn', 'standart', 'kaldi', `${mal} PN ${pn} (SDR ${beklenenSdr}) için Ø${od} et kalınlığı en az ${eMin.toFixed(2)} mm olmalı; katalog ${e} mm`);
            else if (e > eMin + Math.max(0.2, 0.03 * eMin)) ekle('std-sdr-pn', 'standart', 'kaldi', `${mal} Ø${od} × ${e} mm, PN ${pn} (SDR ${beklenenSdr}) ile eşleşmiyor: et kalınlığı farklı bir SDR serisine ait`);
          }
        } else if (mal === 'PVC-U' && !PVC_DIS_CAP.includes(od)) ekle('std-cap', 'standart', 'kaldi', `${od} mm EN ISO 1452-2 serisinde yok`);
        if (kosul && kosul.calismaBasinci != null && kosul.calismaBasinci > pn) ekle('isletme-pn', 'işletme', 'kaldi', `çalışma basıncı ${kosul.calismaBasinci} bar > PN ${pn}`);
        if (kosul && kosul.sicaklik != null && kosul.sicaklik > 20 && v('sicaklik_max') == null) ekle('isletme-sicaklik', 'işletme', 'eksik', '20 °C üzeri işletme için katalogda sıcaklık azaltma katsayısı yok');
      }
    } else if (u.kategori === 'vana') {
      if (['dn', 'pn'].map(a => gerekli(a)).every(Boolean)) {
        if (v('kv') == null) ekle('eksik-kv', 'tamlık', 'eksik', 'Kv/Cv veya kayıp eğrisi yok: basınç kaybı hesaplanamaz');
        if (v('basinc_min') != null && v('basinc_max') != null && !(v('basinc_min') < v('basinc_max'))) ekle('basinc-aralik', 'tutarlılık', 'kaldi', 'en düşük basınç en yüksekten küçük olmalı');
        if (v('basinc_max') != null && v('basinc_max') > v('pn') + 1e-9) ekle('pn-max', 'tutarlılık', 'kaldi', 'katalogdaki en yüksek çalışma basıncı PN sınıfını aşıyor');
      }
    } else if (u.kategori === 'filtre') {
      if (['debi_max', 'dn'].map(a => gerekli(a)).every(Boolean)) {
        if (v('filtre_tipi') == null) ekle('eksik-filtre_tipi', 'tamlık', 'eksik', 'filtre tipi (disk / elek / kum / hidrosiklon) yok');
        if (v('filtrasyon_mesh') == null && v('filtrasyon_mikron') == null) ekle('eksik-filtrasyon', 'tamlık', 'eksik', 'filtrasyon derecesi (mesh / µm) yok');
        if (!(egriler || []).some(e => e.tur === 'kayip') && v('kayip_temiz') == null) ekle('eksik-kayip', 'tamlık', 'eksik', 'temiz filtre basınç kaybı (tablo/eğri) yok');
        if (v('kayip_temiz') != null && v('kayip_kirli') != null && !(v('kayip_temiz') < v('kayip_kirli'))) ekle('kayip-sira', 'tutarlılık', 'kaldi', 'temiz filtre kaybı kirli filtre kaybından küçük olmalı');
      }
    } else if (u.kategori === 'pompa') {
      const qh = (egriler || []).filter(e => e.tur === 'QH');
      if (!qh.length) ekle('eksik-qh', 'tamlık', 'eksik', 'üretici Q–H eğrisi yok');
      for (const e of qh) {
        if (!(e.kosul && (e.kosul.devir || e.kosul.carkCapi))) ekle('qh-kosul', 'tamlık', 'eksik', 'Q–H eğrisinin devir / çark çapı koşulu yok');
        if (e.si.some((p, i) => i && p[1] > e.si[i - 1][1] + 1e-9)) ekle('qh-azalan', 'tutarlılık', 'kaldi', 'Q–H eğrisi debi arttıkça azalmalı');
      }
      if (!(egriler || []).some(e => e.tur === 'NPSHr')) ekle('eksik-npsh', 'tamlık', 'uyari', 'NPSHr eğrisi yok: emme koşulu denetlenemez (seçimde uyarı olarak gösterilir)');
      if (!(egriler || []).some(e => e.tur === 'verim')) ekle('eksik-verim', 'tamlık', 'uyari', 'verim eğrisi yok: güç ve enerji hesaplanamaz (seçimde verisi eksik sayılır)');
      if (v('pompa_tipi') == null) ekle('eksik-pompa_tipi', 'tamlık', 'eksik', 'pompa tipi (dalgıç / santrifüj) yok');
    }
    const gecti = !K.some(k => k.durum === 'kaldi' || k.durum === 'eksik');   // 'uyari' doğrulamayı engellemez
    return { gecti, kurallar: K };
  }
  // Mühendislik doğrulaması kaydı: denetim geçmeden "dogrulandi" yapılamaz; doğrulayan adı ve tarih saklanır
  function muhendislikOnayla(u, denetim, dogrulayan) {
    if (!denetim || !denetim.gecti) throw new Error('mühendislik denetimi geçmedi: ' + (denetim ? denetim.kurallar.filter(k => k.durum === 'kaldi' || k.durum === 'eksik').map(k => k.mesaj).join('; ') : 'denetim yok'));
    if (!kirp(dogrulayan, 120)) throw new Error('doğrulayan kişi gerekli');
    return Object.assign({}, u, { muhendislik: 'dogrulandi', dogrulama: { dogrulayan: kirp(dogrulayan, 120), tarih: new Date().toISOString(), kurallar: denetim.kurallar.map(k => k.kod) }, guncelleme: new Date().toISOString() });
  }
  // Ekipman seçiminde kullanılabilir mi? Yalnız mühendislik doğrulaması (kullanıcı onayı yetmez); örnek veri asla
  const secimdeKullanilabilir = u => !!u && u.muhendislik === 'dogrulandi' && !u.ornek;

  // ---------- Örnek (test) verileri: açıkça "örnek", doğrulanmamış; gerçek katalog ürünü gibi gösterilmez ----------
  function ornekVeri(katalogId) {
    const K = s => ({ katalogId, sayfa: s, hamMetin: 'ÖRNEK VERİ — gerçek katalog değildir', yontem: 'elle' });
    const u = (kategori, model, urunKodu) => Object.assign(yeniUrun({ katalogId, uretici: 'ÖRNEK ÜRETİCİ', model, urunKodu, kategori, ornek: true }), { id: 'ornek_' + urunKodu });
    const urunler = [u('boru', 'Örnek PE100 boru 63 PN10', 'ORN-B63'), u('vana', 'Örnek küresel vana DN50', 'ORN-V50'), u('filtre', 'Örnek disk filtre 2"', 'ORN-F2'), u('pompa', 'Örnek dalgıç pompa', 'ORN-P1')];
    const d = (urunId, ad, deger, birim, s) => yeniDeger({ urunId, ad, deger, birim, kaynak: K(s) }).deger;
    const degerler = [d('ornek_ORN-B63', 'dis_cap', 63, 'mm', 1), d('ornek_ORN-B63', 'et_kalinligi', 3.8, 'mm', 1), d('ornek_ORN-B63', 'pn', 10, 'bar', 1), d('ornek_ORN-B63', 'malzeme', 'PE100', '', 1),
      d('ornek_ORN-V50', 'dn', 50, 'mm', 2), d('ornek_ORN-V50', 'pn', 16, 'bar', 2), d('ornek_ORN-F2', 'dn', 50, 'mm', 3), d('ornek_ORN-F2', 'debi_max', 25, 'm³/h', 3)];
    const egriler = [yeniEgri({ urunId: 'ornek_ORN-P1', tur: 'QH', birimX: 'm³/h', birimY: 'm', noktalar: [[0, 80], [10, 76], [20, 68], [30, 55], [40, 38]], kosul: { devir: 2900 }, kaynak: K(4) }).egri];
    return { urunler, degerler, egriler };
  }

  const api = Object.freeze({ SURUM, METIN_SECENEK, KATEGORI, INCELEME, MUHENDISLIK, YONTEM, BIRIM, DEGER, MALZEME, EGRI_TUR, SDR_PN, PE_DIS_CAP, PVC_DIS_CAP,
    yeniUrun, urunDogrula, yeniDeger, yeniEgri, egriDeger, incele, muhendislikDenetle, muhendislikOnayla, secimdeKullanilabilir, ornekVeri });
  g.IrriKatalogUrun = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

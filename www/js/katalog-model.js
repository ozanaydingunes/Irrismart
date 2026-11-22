// IrriGrow — Firma Malzeme Katalogları: veri modeli (saf işlevler; depolamadan ve arayüzden bağımsız).
// İlkeler:
//  - Katalog kayıtları ve PDF'ler yalnız cihazda saklanır; proje JSON'una girmez.
//  - Katalogdan okunan ya da kullanıcının işaretlediği hiçbir değer hidrolik hesap motoruna aktarılmaz
//    (bu modül motoru, boru kütüphanesini veya fiyat kataloğunu çağırmaz).
//  - Bilinmeyen alan tahminle doldurulmaz; boş bırakılır.
(function (g) {
  'use strict';
  const SURUM = 1;
  const URUN_GRUPLARI = ['boru', 'damla', 'vana', 'ekparca', 'pompa', 'filtre', 'gubre', 'otomasyon', 'diger'];
  const BELGE_TURLERI = ['urun', 'fiyat', 'teknik', 'sertifika', 'diger'];
  const KAYNAK_TURLERI = ['resmi-site', 'bayi', 'firma-temsilcisi', 'diger'];
  const PARA = ['TRY', 'USD', 'EUR'];

  const kirp = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
  // Türkçe karakterleri koruyarak karşılaştırma anahtarı (firma adı eşleştirme)
  const anahtar = s => kirp(s, 120).toLocaleLowerCase('tr').replace(/\s+/g, ' ');
  function yeniId(on) { const r = (g.crypto && g.crypto.getRandomValues) ? Array.from(g.crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('') : Math.random().toString(16).slice(2, 18).padEnd(16, '0'); return on + '_' + r; }

  // Belge tarihi: 'YYYY', 'YYYY-MM' veya 'YYYY-MM-DD' (gün/ay bilinmiyorsa uydurulmaz). Kullanıcı girişi: 2026, 10.2026, 20.10.2026, 2026-10
  function tarihOku(s) {
    s = kirp(s, 20); if (!s) return null;
    let m;
    if ((m = /^(\d{4})$/.exec(s))) return m[1];
    if ((m = /^(\d{4})-(\d{1,2})$/.exec(s)) || (m = /^(\d{1,2})[./](\d{4})$/.exec(s))) { const [y, a] = m[1].length === 4 ? [m[1], m[2]] : [m[2], m[1]]; return +a >= 1 && +a <= 12 ? `${y}-${String(a).padStart(2, '0')}` : undefined; }
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)) || (m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s))) {
      const [y, a, d] = m[1].length === 4 ? [+m[1], +m[2], +m[3]] : [+m[3], +m[2], +m[1]];
      const dt = new Date(Date.UTC(y, a - 1, d));
      return dt.getUTCFullYear() === y && dt.getUTCMonth() === a - 1 && dt.getUTCDate() === d ? `${y}-${String(a).padStart(2, '0')}-${String(d).padStart(2, '0')}` : undefined;
    }
    return undefined; // geçersiz
  }
  const tarihGecerli = t => t == null || /^\d{4}(-\d{2}(-\d{2})?)?$/.test(t);
  // Belgenin yaşı (gün); tarihin bilinmeyen kısmı en iyimser (en yeni) kabul edilir: yıl → 31 Aralık, ay → ayın son günü
  function yasGun(t, simdi) {
    if (!t) return null;
    const p = t.split('-').map(Number), y = p[0], a = p[1] || 12, d = p[2] || new Date(Date.UTC(y, a, 0)).getUTCDate();
    return Math.floor(((simdi || Date.now()) - Date.UTC(y, a - 1, d)) / 864e5);
  }

  // Dosya doğrulama: PDF imzası (%PDF-) ve boyut
  const PDF_IMZA = [0x25, 0x50, 0x44, 0x46, 0x2d];
  const pdfImzasi = bayt => !!bayt && bayt.length >= 5 && PDF_IMZA.every((b, i) => bayt[i] === b);
  const ENCOK_BAYT = 400 * 1024 * 1024; // 400 MB üst sınır (cihaz belleği ve depolama güvenliği)

  // Kayıt doğrulama ve normalleştirme. Hata listesi boşsa kayıt kaydedilebilir.
  function katalogDogrula(k) {
    const h = [];
    if (!k || typeof k !== 'object') return ['kayıt yok'];
    if (!kirp(k.ad, 200)) h.push('Katalog adı gerekli');
    if (!k.firmaId) h.push('Firma gerekli');
    if (k.belgeTuru && !BELGE_TURLERI.includes(k.belgeTuru)) h.push('Belge türü geçersiz');
    if (!tarihGecerli(k.belgeTarihi)) h.push('Belge tarihi geçersiz');
    if (!Array.isArray(k.urunGruplari) || k.urunGruplari.some(x => !URUN_GRUPLARI.includes(x))) h.push('Ürün grubu geçersiz');
    if (k.kaynak && k.kaynak.tur && !KAYNAK_TURLERI.includes(k.kaynak.tur)) h.push('Kaynak türü geçersiz');
    const d = k.dosya;
    if (!d || !d.anahtar || !(d.boyut > 0) || !/^[0-9a-f]{64}$/.test(d.sha256 || '')) h.push('Dosya bilgisi eksik');
    if (k.fiyatListesi && k.fiyatListesi.paraBirimi && !PARA.includes(k.fiyatListesi.paraBirimi)) h.push('Para birimi geçersiz');
    return h;
  }
  function yeniKatalog(o) {
    const simdi = new Date().toISOString();
    return {
      surum: SURUM, id: o.id || yeniId('kat'), firmaId: o.firmaId, ad: kirp(o.ad, 200), belgeTuru: BELGE_TURLERI.includes(o.belgeTuru) ? o.belgeTuru : 'urun',
      belgeTarihi: o.belgeTarihi || null, urunGruplari: (o.urunGruplari || []).filter(x => URUN_GRUPLARI.includes(x)),
      kaynak: { tur: KAYNAK_TURLERI.includes(o.kaynak && o.kaynak.tur) ? o.kaynak.tur : 'diger', aciklama: kirp(o.kaynak && o.kaynak.aciklama, 300) },
      not: kirp(o.not, 1000), dosya: o.dosya, yuklenme: simdi, guncelleme: simdi, oncekiSurumler: [],
      fiyatListesi: o.belgeTuru === 'fiyat' ? { kdvDahil: o.kdvDahil === true ? true : o.kdvDahil === false ? false : null, paraBirimi: PARA.includes(o.paraBirimi) ? o.paraBirimi : null } : null,
      // Teknik değer çıkarımı sonraki aşamada; değerler 'okundu' durumunda kalır, motora gitmez
      cikarim: { durum: 'yok', satirlar: [] },
      ornek: o.ornek === true,
    };
  }
  function yeniFirma(ad, ornek) { return { surum: SURUM, id: yeniId('frm'), ad: kirp(ad, 120), olusturma: new Date().toISOString(), ornek: ornek === true }; }
  const firmaBul = (firmalar, ad) => firmalar.find(f => anahtar(f.ad) === anahtar(ad)) || null;

  // Güncelleme: yeni PDF geldiğinde eski dosya sürüm geçmişine alınır (varsayılan: saklanır)
  function surumEkle(k, yeniDosya, yeniTarih) {
    const eski = { dosya: k.dosya, belgeTarihi: k.belgeTarihi, degistirilme: new Date().toISOString() };
    return Object.assign({}, k, { dosya: yeniDosya, belgeTarihi: yeniTarih !== undefined ? yeniTarih : k.belgeTarihi, guncelleme: eski.degistirilme, oncekiSurumler: [eski].concat(k.oncekiSurumler || []) });
  }
  function surumSil(k, anahtarSil) { return Object.assign({}, k, { oncekiSurumler: (k.oncekiSurumler || []).filter(s => s.dosya.anahtar !== anahtarSil) }); }
  // Bir kaydın depodaki bütün dosya anahtarları (silme ve sahipsiz dosya temizliği için)
  const dosyaAnahtarlari = k => [k.dosya && k.dosya.anahtar].concat((k.oncekiSurumler || []).map(s => s.dosya && s.dosya.anahtar)).filter(Boolean);
  // Yinelenme: aynı SHA-256 zaten kayıtlıysa o kayıt
  const ayniDosya = (kataloglar, sha) => kataloglar.find(k => ((k.dosya && k.dosya.sha256 === sha) || (k.oncekiSurumler || []).some(s => s.dosya.sha256 === sha))) || null;

  // Filtre: metin (ad, firma, not), firma, ürün grubu, belge türü; örnek veriler ayrı
  function filtrele(kataloglar, firmalar, f) {
    f = f || {}; const q = anahtar(f.metin || ''), fa = id => (firmalar.find(x => x.id === id) || {}).ad || '';
    return kataloglar.filter(k => (!f.firmaId || k.firmaId === f.firmaId) && (!f.grup || k.urunGruplari.includes(f.grup)) && (!f.tur || k.belgeTuru === f.tur)
      && (f.ornek == null || !!k.ornek === !!f.ornek) && (!q || anahtar([k.ad, fa(k.firmaId), k.not].join(' ')).includes(q)));
  }

  // ---------- Toplu dışa aktarma / geri yükleme (yalnız bilgi kaydı; PDF dosyalarını İÇERMEZ) ----------
  const YEDEK_TUR = 'irrigrow-katalog-bilgileri';
  function yedekOlustur(firmalar, kataloglar) {
    return { tur: YEDEK_TUR, surum: SURUM, olusturma: new Date().toISOString(), pdfIcerir: false,
      aciklama: 'Bu dosya yalnız katalog bilgilerini (ad, firma, tarih, ürün grubu, kaynak, SHA-256) içerir. PDF dosyalarını İÇERMEZ. Geri yüklemede PDF dosyalarını yeniden seçmeniz gerekir; dosyalar SHA-256 ile eşleştirilir.',
      firmalar: firmalar.filter(f => !f.ornek), kataloglar: kataloglar.filter(k => !k.ornek).map(k => Object.assign({}, k, { dosya: dosyaOzet(k.dosya), oncekiSurumler: (k.oncekiSurumler || []).map(s => Object.assign({}, s, { dosya: dosyaOzet(s.dosya) })) })) };
  }
  const dosyaOzet = d => d ? { ad: d.ad, boyut: d.boyut, sha256: d.sha256, sayfa: d.sayfa || null } : null;
  // Geri yükleme: yedek doğrulanır; mevcut kayıtlar silinmez (aynı id → atlanır). Dosyası olmayan kayıtlar "PDF bekleniyor" durumunda gelir.
  function yedekOku(metin, mevcutFirmalar, mevcutKataloglar) {
    let y; try { y = typeof metin === 'string' ? JSON.parse(metin) : metin; } catch (e) { return { hata: 'Dosya okunamadı (geçerli JSON değil)' }; }
    if (!y || y.tur !== YEDEK_TUR) return { hata: 'Bu dosya bir IrriGrow katalog bilgileri yedeği değil' };
    if (!(y.surum >= 1 && y.surum <= SURUM)) return { hata: 'Yedek sürümü desteklenmiyor' };
    const fIds = new Set(mevcutFirmalar.map(f => f.id)), kIds = new Set(mevcutKataloglar.map(k => k.id));
    const firmalar = (y.firmalar || []).filter(f => f && f.id && kirp(f.ad, 120) && !fIds.has(f.id)).map(f => ({ surum: SURUM, id: f.id, ad: kirp(f.ad, 120), olusturma: f.olusturma || new Date().toISOString(), ornek: false }));
    const tumFirma = new Set([...fIds, ...firmalar.map(f => f.id)]);
    const kataloglar = [], atlanan = [];
    for (const k of y.kataloglar || []) {
      if (!k || !k.id || kIds.has(k.id)) { atlanan.push(k && k.ad); continue; }
      if (!tumFirma.has(k.firmaId) || !k.dosya || !/^[0-9a-f]{64}$/.test(k.dosya.sha256 || '')) { atlanan.push(k.ad); continue; }
      kataloglar.push(Object.assign(yeniKatalog(Object.assign({}, k, { kaynak: k.kaynak, ornek: false })), { id: k.id, yuklenme: k.yuklenme, guncelleme: k.guncelleme, belgeTarihi: tarihGecerli(k.belgeTarihi) ? k.belgeTarihi : null,
        dosya: Object.assign(dosyaOzet(k.dosya), { anahtar: null, bekliyor: true }), oncekiSurumler: [] }));
    }
    return { firmalar, kataloglar, atlanan };
  }

  // ---------- Akışlı SHA-256 (büyük dosya belleğe bütün olarak alınmadan; parça parça) ----------
  const K256 = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256Akis() {
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const W = new Uint32Array(64), blok = new Uint8Array(64); let dolu = 0, toplam = 0, bitti = false;
    function isle(b, o) {
      for (let i = 0; i < 16; i++) W[i] = (b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3];
      for (let i = 16; i < 64; i++) { const x = W[i - 15], y = W[i - 2]; W[i] = (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) + W[i - 16] + (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)) + W[i - 7]; }
      let a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], gg = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & gg)) + K256[i] + W[i]) | 0;
        const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = gg; gg = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += bb; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += gg; H[7] += h;
    }
    return {
      ekle(u8) {
        if (bitti) throw new Error('özet tamamlandı'); let i = 0; toplam += u8.length;
        if (dolu) { const n = Math.min(64 - dolu, u8.length); blok.set(u8.subarray(0, n), dolu); dolu += n; i = n; if (dolu === 64) { isle(blok, 0); dolu = 0; } }
        for (; i + 64 <= u8.length; i += 64) isle(u8, i);
        if (i < u8.length) { blok.set(u8.subarray(i), 0); dolu = u8.length - i; }
        return this;
      },
      bitir() {
        bitti = true; const bit = toplam * 8, son = new Uint8Array(dolu < 56 ? 64 : 128); son.set(blok.subarray(0, dolu)); son[dolu] = 0x80;
        const hi = Math.floor(bit / 4294967296), lo = bit >>> 0, L = son.length;
        son[L - 8] = hi >>> 24; son[L - 7] = hi >>> 16; son[L - 6] = hi >>> 8; son[L - 5] = hi; son[L - 4] = lo >>> 24; son[L - 3] = lo >>> 16; son[L - 2] = lo >>> 8; son[L - 1] = lo;
        for (let o = 0; o < L; o += 64) isle(son, o);
        return Array.from(H, x => x.toString(16).padStart(8, '0')).join('');
      },
    };
  }

  const api = Object.freeze({ SURUM, URUN_GRUPLARI, BELGE_TURLERI, KAYNAK_TURLERI, PARA, ENCOK_BAYT, YEDEK_TUR, anahtar, yeniId, tarihOku, tarihGecerli, yasGun, pdfImzasi,
    katalogDogrula, yeniKatalog, yeniFirma, firmaBul, surumEkle, surumSil, dosyaAnahtarlari, ayniDosya, filtrele, yedekOlustur, yedekOku, sha256Akis });
  g.IrriKatalogModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

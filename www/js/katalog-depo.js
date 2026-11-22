// IrriGrow — Firma Malzeme Katalogları: depolama katmanı.
//  - Bilgi kayıtları (firma, katalog): IndexedDB 'irrigrow-katalog' (Android WebView'da da uygulamanın özel verisidir).
//  - PDF dosyaları:
//      Android (Capacitor): uygulamanın özel dizini Directory.Data / kataloglar / <anahtar>.pdf
//        Köprü veriyi base64 metin olarak taşıdığından dosya 1 MB'lık parçalar hâlinde yazılır (writeFile + appendFile);
//        bütün dosya hiçbir zaman tek bir metin olarak belleğe alınmaz. Önce '.part' adına yazılır, doğrulanınca yeniden adlandırılır.
//      Web: IndexedDB 'dosyalar' deposunda Blob olarak (base64'e çevrilmeden).
//  - Her yazımdan sonra dosya depodan geri okunur ve SHA-256 + boyut denetlenir; tutmazsa dosya silinir, kayıt oluşturulmaz.
//  - Hiçbir dosya ağ üzerinden gönderilmez.
(function (g) {
  'use strict';
  const M = g.IrriKatalogModel;
  const DB_AD = 'irrigrow-katalog', DB_SURUM = 1, PARCA = 1024 * 1024, KLASOR = 'kataloglar';
  const yerel = () => !!(g.Capacitor && g.Capacitor.isNativePlatform && g.Capacitor.isNativePlatform() && FS());
  const FS = () => g.Capacitor && g.Capacitor.Plugins && g.Capacitor.Plugins.Filesystem;

  // ---------- IndexedDB ----------
  let dbSoz = null;
  function db() {
    if (dbSoz) return dbSoz;
    dbSoz = new Promise((ok, red) => {
      if (!g.indexedDB) return red(new Error('IndexedDB kullanılamıyor (gizli pencere veya tarayıcı kısıtı)'));
      const r = g.indexedDB.open(g.IRRI_KATALOG_DB || DB_AD, DB_SURUM);
      r.onupgradeneeded = () => { const d = r.result; for (const s of ['firmalar', 'kataloglar']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); if (!d.objectStoreNames.contains('dosyalar')) d.createObjectStore('dosyalar'); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => red(r.error || new Error('IndexedDB açılamadı'));
      r.onblocked = () => red(new Error('IndexedDB başka bir sekmede açık'));
    });
    dbSoz.catch(() => { dbSoz = null; });
    return dbSoz;
  }
  const istek = r => new Promise((ok, red) => { r.onsuccess = () => ok(r.result); r.onerror = () => red(r.error); });
  async function islem(depo, kip, fn) {
    const d = await db(), tx = d.transaction(depo, kip), s = tx.objectStore(depo);
    const bitis = new Promise((ok, red) => { tx.oncomplete = ok; tx.onerror = () => red(tx.error); tx.onabort = () => red(tx.error || new Error('İşlem iptal edildi (depolama dolu olabilir)')); });
    const sonuc = await fn(s); await bitis; return sonuc;
  }
  const hepsi = depo => islem(depo, 'readonly', s => istek(s.getAll()));
  const koy = (depo, v, k) => islem(depo, 'readwrite', s => istek(k === undefined ? s.put(v) : s.put(v, k)));
  const sil = (depo, k) => islem(depo, 'readwrite', s => istek(s.delete(k)));
  const al = (depo, k) => islem(depo, 'readonly', s => istek(s.get(k)));

  // ---------- Yardımcılar ----------
  const blobBayt = (b, a, z) => b.slice(a, z).arrayBuffer().then(x => new Uint8Array(x));
  function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return g.btoa(s); }
  async function blobOzet(blob, ilerleme) {
    const h = M.sha256Akis();
    for (let o = 0; o < blob.size; o += PARCA) { h.ekle(await blobBayt(blob, o, Math.min(o + PARCA, blob.size))); if (ilerleme) ilerleme(Math.min(1, (o + PARCA) / blob.size)); }
    return h.bitir();
  }
  async function urlOzet(url) {
    const yan = await g.fetch(url); if (!yan.ok) throw new Error('Dosya geri okunamadı (' + yan.status + ')');
    const h = M.sha256Akis(); let n = 0;
    if (yan.body && yan.body.getReader) { const rd = yan.body.getReader(); for (;;) { const { done, value } = await rd.read(); if (done) break; h.ekle(value); n += value.length; } }
    else { const u = new Uint8Array(await yan.arrayBuffer()); h.ekle(u); n = u.length; }
    return { sha256: h.bitir(), boyut: n };
  }
  // Yazılmış ama henüz kayda bağlanmamış dosyalar: sahipsiz dosya temizliği bunlara dokunmaz
  // (Android emülatör testinde açılış temizliği, yazımı biten ama kaydı yapılmamış PDF'i siliyordu).
  const bekleyen = new Set();
  const yol = (anahtar, part) => `${KLASOR}/${anahtar}.pdf${part ? '.part' : ''}`;

  // Dosya önce denetlenir (PDF imzası, boyut); yazılır; geri okunup doğrulanır. Dönen nesne katalog kaydının 'dosya' alanıdır.
  async function dosyaYaz(dosya, ilerleme) {
    if (!dosya || !(dosya.size > 0)) throw new Error('Dosya boş');
    if (dosya.size > M.ENCOK_BAYT) throw new Error('Dosya çok büyük (üst sınır 400 MB)');
    let imza; try { imza = await blobBayt(dosya, 0, 5); } catch (e) { throw yerHatasi(e); }
    if (!M.pdfImzasi(imza)) throw new Error('Bu dosya PDF değil (PDF imzası yok)');
    const anahtar = M.yeniId('pdf'), h = M.sha256Akis(), adim = p => ilerleme && ilerleme(p);
    bekleyen.add(anahtar);
    if (yerel()) {
      const fs = FS();
      try {
        for (let o = 0; o < dosya.size; o += PARCA) {
          const u = await blobBayt(dosya, o, Math.min(o + PARCA, dosya.size)); h.ekle(u);
          const v = { path: yol(anahtar, true), data: b64(u), directory: 'DATA' };
          if (o === 0) await fs.writeFile(Object.assign(v, { recursive: true })); else await fs.appendFile(v);
          adim(0.85 * Math.min(1, (o + PARCA) / dosya.size));
        }
        const sha256 = h.bitir();
        await fs.rename({ from: yol(anahtar, true), to: yol(anahtar), directory: 'DATA', toDirectory: 'DATA' });
        const geri = await urlOzet(await dosyaUrl({ anahtar, depo: 'android-dosya' }));
        adim(1);
        if (geri.sha256 !== sha256 || geri.boyut !== dosya.size) throw new Error('Yazılan dosya doğrulanamadı (SHA-256 / boyut tutmuyor)');
        return { ad: String(dosya.name || 'katalog.pdf').slice(0, 200), boyut: dosya.size, sha256, mime: 'application/pdf', depo: 'android-dosya', anahtar };
      } catch (e) {
        for (const p of [yol(anahtar, true), yol(anahtar)]) { try { await fs.deleteFile({ path: p, directory: 'DATA' }); } catch (e2) { /* yok */ } }
        bekleyen.delete(anahtar); throw yerHatasi(e);
      }
    }
    // Web: IndexedDB'ye Blob olarak
    let sha256; try { sha256 = await blobOzet(dosya, p => adim(0.5 * p)); } catch (e) { bekleyen.delete(anahtar); throw yerHatasi(e); }
    try { await koy('dosyalar', new Blob([dosya], { type: 'application/pdf' }), anahtar); } catch (e) { bekleyen.delete(anahtar); throw yerHatasi(e); }
    const geri = await al('dosyalar', anahtar);
    const gsha = geri ? await blobOzet(geri, p => adim(0.5 + 0.5 * p)) : null;
    if (!geri || geri.size !== dosya.size || gsha !== sha256) { bekleyen.delete(anahtar); try { await sil('dosyalar', anahtar); } catch (e) { /* */ } throw new Error('Yazılan dosya doğrulanamadı (SHA-256 / boyut tutmuyor)'); }
    return { ad: String(dosya.name || 'katalog.pdf').slice(0, 200), boyut: dosya.size, sha256, mime: 'application/pdf', depo: 'indexeddb', anahtar };
  }
  // Emülatörde dolu diskte tarayıcı yalnız 'NotReadableError / could not be read' veriyordu; kullanıcıya anlaşılır metin
  function yerHatasi(e) { const m = String(e && (e.message || e.name) || e) + ' ' + String(e && e.name || ''); return /quota|space|ENOSPC|dolu|full/i.test(m) ? new Error('Cihazda yeterli boş alan yok; dosya kaydedilmedi')
      : /NotReadable|could not be read/i.test(m) ? new Error('Dosya okunamadı: cihazda yeterli boş alan veya bellek olmayabilir ya da dosyaya erişim kalktı; dosya kaydedilmedi') : e instanceof Error ? e : new Error(m); }

  // Görüntüleme/açma için adres (Android: yerel sunucu adresi; web: geçici blob adresi — kullanım bitince serbest bırakılmalı)
  async function dosyaUrl(d) {
    if (d.depo === 'android-dosya') { const fs = FS(); if (!fs) throw new Error('Dosya sistemi eklentisi yok'); const u = await fs.getUri({ path: yol(d.anahtar), directory: 'DATA' }); return g.Capacitor.convertFileSrc(u.uri); }
    const b = await al('dosyalar', d.anahtar); if (!b) throw new Error('PDF dosyası bulunamadı'); return g.URL.createObjectURL(b);
  }
  async function dosyaYerelUri(d) { if (d.depo !== 'android-dosya') return null; return (await FS().getUri({ path: yol(d.anahtar), directory: 'DATA' })).uri; }
  async function dosyaVarMi(d) {
    if (!d || !d.anahtar) return false;
    if (d.depo === 'android-dosya') { try { const s = await FS().stat({ path: yol(d.anahtar), directory: 'DATA' }); return s.size === d.boyut; } catch (e) { return false; } }
    const b = await al('dosyalar', d.anahtar); return !!b && b.size === d.boyut;
  }
  // Tam doğrulama (SHA-256 yeniden hesaplanır)
  async function dosyaDogrula(d) {
    if (!(await dosyaVarMi(d))) return { ok: false, neden: 'dosya yok' };
    if (d.depo === 'android-dosya') { const r = await urlOzet(await dosyaUrl(d)); return { ok: r.sha256 === d.sha256 && r.boyut === d.boyut, neden: 'özet' }; }
    const b = await al('dosyalar', d.anahtar); return { ok: (await blobOzet(b)) === d.sha256, neden: 'özet' };
  }
  async function dosyaSil(d) {
    if (!d || !d.anahtar) return;
    bekleyen.delete(d.anahtar);
    if (d.depo === 'android-dosya') { try { await FS().deleteFile({ path: yol(d.anahtar), directory: 'DATA' }); } catch (e) { /* zaten yok */ } return; }
    await sil('dosyalar', d.anahtar);
  }

  // ---------- Kayıtlar ----------
  async function listele() { const [firmalar, kataloglar] = await Promise.all([hepsi('firmalar'), hepsi('kataloglar')]); return { firmalar, kataloglar }; }
  async function firmaKaydet(f) { await koy('firmalar', f); return f; }
  async function katalogKaydet(k) { const h = M.katalogDogrula(k); if (h.length && !(k.dosya && k.dosya.bekliyor)) throw new Error(h.join('; ')); await koy('kataloglar', k); M.dosyaAnahtarlari(k).forEach(a => bekleyen.delete(a)); return k; }
  // Katalog silme: bütün sürüm dosyaları + kayıt. Firmanın son kataloğuysa firma da silinir (kullanıcı firmayı ayrıca tutmak istemedikçe).
  async function katalogSil(k) { for (const d of [k.dosya].concat((k.oncekiSurumler || []).map(s => s.dosya))) if (d && d.anahtar) await dosyaSil(d); await sil('kataloglar', k.id); }
  async function surumDosyasiSil(k, anahtar) { const s = (k.oncekiSurumler || []).find(x => x.dosya.anahtar === anahtar); if (!s) return k; await dosyaSil(s.dosya); const y = M.surumSil(k, anahtar); await koy('kataloglar', y); return y; }
  const firmaSil = id => sil('firmalar', id);

  // Kayıtlarda adı geçmeyen dosyaları (yarım kalmış yazımlar dahil) temizler
  async function sahipsizTemizle() {
    const { kataloglar } = await listele(), gecerli = new Set(kataloglar.flatMap(M.dosyaAnahtarlari).concat([...bekleyen])); let n = 0;
    if (yerel()) {
      let liste = []; try { liste = (await FS().readdir({ path: KLASOR, directory: 'DATA' })).files || []; } catch (e) { return 0; }
      for (const f of liste) { const ad = typeof f === 'string' ? f : f.name, a = ad.replace(/\.pdf(\.part)?$/, ''); if (!gecerli.has(a)) { try { await FS().deleteFile({ path: KLASOR + '/' + ad, directory: 'DATA' }); n++; } catch (e) { /* */ } } }
      return n;
    }
    const anahtarlar = await islem('dosyalar', 'readonly', s => istek(s.getAllKeys()));
    for (const a of anahtarlar) if (!gecerli.has(a)) { await sil('dosyalar', a); n++; }
    return n;
  }

  // ---------- Depolama durumu ----------
  async function alan() {
    const s = g.navigator && g.navigator.storage, o = { yerel: yerel(), kullanilan: null, kota: null, kalici: null };
    try { if (s && s.estimate) { const e = await s.estimate(); o.kullanilan = e.usage ?? null; o.kota = e.quota ?? null; } } catch (e) { /* */ }
    try { if (s && s.persisted) o.kalici = await s.persisted(); } catch (e) { /* */ }
    return o;
  }
  async function kalicilikIste() { try { const s = g.navigator && g.navigator.storage; return s && s.persist ? await s.persist() : null; } catch (e) { return null; } }

  g.IrriKatalogDepo = { yerel, db, listele, firmaKaydet, firmaSil, katalogKaydet, katalogSil, surumDosyasiSil, dosyaYaz, dosyaUrl, dosyaYerelUri, dosyaVarMi, dosyaDogrula, dosyaSil, sahipsizTemizle, alan, kalicilikIste, PARCA };
})(typeof window !== 'undefined' ? window : globalThis);

#!/usr/bin/env node
// TEST (katalog Android depolama, birleştirilmeyecek test dalı): APK'yı emülatörde çalıştırır ve gerçek Capacitor Filesystem
// üzerinden katalog depolama katmanını dener. PDF'ler cihazda üretilir; hiçbir dosya ağa gönderilmez.
const { _android: android } = require('playwright');
const PKG = 'com.irrigrow.app.dev', DIR = 'files/kataloglar';
const log = (...a) => console.log('[KAT]', ...a);
const SONUC = (ad, ok, ek) => log((ok ? 'GEÇTİ' : 'KALDI') + ' ' + ad + (ek !== undefined ? ' ' + (typeof ek === 'string' ? ek : JSON.stringify(ek)) : ''));
const BOYUTLAR = (process.env.KAT_BOYUT || '5,50,120,300').split(',').map(Number);

(async () => {
  const [device] = await android.devices();
  const sh = async c => (await device.shell(c)).toString().trim();
  const runas = c => sh(`run-as ${PKG} sh -c '${c}'`);
  log('android', await sh('getprop ro.build.version.release'), 'sdk', await sh('getprop ro.build.version.sdk'), 'webview', (await sh('dumpsys webviewupdate')).split('\n').filter(l => /Current WebView package/.test(l)).join(' '));
  let page;
  const baslat = async () => { await sh(`am force-stop ${PKG}`); await sh(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`); const wv = await device.webView({ pkg: PKG }, { timeout: 90000 }); page = await wv.page(); page.on('pageerror', e => log('SAYFA HATASI', e.message)); await page.waitForFunction(() => window.IrriKatalogDepo && window.IrriKatalogModel, null, { timeout: 60000 }); await page.waitForTimeout(1500); };
  const dosyalar = async () => (await runas(`ls -l ${DIR} 2>/dev/null`)).split('\n').filter(l => /\.pdf/.test(l)).map(l => { const p = l.trim().split(/\s+/); return { ad: p[p.length - 1], boyut: +p[4] }; });
  const cihazSha = async anahtar => ((await runas(`sha256sum ${DIR}/${anahtar}.pdf`)).split(/\s+/)[0] || '');
  const bosAlanKB = async () => +((await sh('df /data | tail -1')).split(/\s+/)[3] || 0);
  // Cihazda (WebView içinde) n MB'lık, tohuma göre farklı içerikli PDF Blob'u üretir ve depoya yazar
  const yaz = (mb, tohum, bekleme) => page.evaluate(async ([mb, tohum]) => {
    const parca = new Uint8Array(1024 * 1024); let x = tohum * 2654435761 >>> 0; for (let i = 0; i < parca.length; i++) { x = (x * 1664525 + 1013904223) >>> 0; parca[i] = x >>> 24; }
    const bas = new TextEncoder().encode(`%PDF-1.4\n% IrriGrow android test ${mb} MB tohum ${tohum}\n`), son = new TextEncoder().encode('\n%%EOF\n');
    const blob = new Blob([bas].concat(Array(Math.max(0, mb - 1)).fill(parca), [parca.subarray(0, 4096), son]), { type: 'application/pdf' });
    const f = new File([blob], `test-${mb}mb.pdf`, { type: 'application/pdf' });
    const t0 = performance.now(); try { const d = await window.IrriKatalogDepo.dosyaYaz(f); return { ok: true, d, sn: (performance.now() - t0) / 1000, boyut: f.size }; } catch (e) { return { ok: false, hata: String(e.message || e), sn: (performance.now() - t0) / 1000, boyut: f.size }; }
  }, [mb, tohum]);
  const kaydet = (d, ad) => page.evaluate(async ([d, ad]) => { const M = window.IrriKatalogModel, D = window.IrriKatalogDepo; const { firmalar } = await D.listele(); let f = firmalar.find(x => x.ad === 'Test Firma'); if (!f) { f = M.yeniFirma('Test Firma'); await D.firmaKaydet(f); } const k = M.yeniKatalog({ ad, firmaId: f.id, dosya: d }); await D.katalogKaydet(k); return k; }, [d, ad]);
  const listele = () => page.evaluate(() => window.IrriKatalogDepo.listele());

  await sh(`pm clear ${PKG}`); await baslat();
  SONUC('yerel Capacitor Filesystem kullanılıyor', await page.evaluate(() => window.IrriKatalogDepo.yerel()));

  // 1) Boyutlar: parçalı yazım, SHA-256 (uygulama + cihazın kendi sha256sum'u), süre
  const kayitlar = [];
  for (const [i, mb] of BOYUTLAR.entries()) {
    const once = await bosAlanKB();
    const r = await yaz(mb, i + 1);
    if (!r.ok) { SONUC(`${mb} MB yazım`, false, r); continue; }
    const cs = await cihazSha(r.d.anahtar), dg = await page.evaluate(d => window.IrriKatalogDepo.dosyaDogrula(d), r.d);
    SONUC(`${mb} MB yazım (${r.sn.toFixed(1)} sn, depo ${r.d.depo})`, r.d.depo === 'android-dosya' && r.d.boyut === r.boyut);
    SONUC(`${mb} MB SHA-256: uygulama = cihaz sha256sum = geri okuma`, cs === r.d.sha256 && dg.ok, { uygulama: r.d.sha256.slice(0, 12), cihaz: cs.slice(0, 12) });
    log(`${mb} MB boş alan farkı (KB)`, once - await bosAlanKB());
    kayitlar.push(await kaydet(r.d, `Test ${mb} MB`));
  }
  SONUC('yarım (.part) dosya kalmadı', !(await dosyalar()).some(f => /\.part$/.test(f.ad)), await dosyalar());

  // 2) Uygulamayı kapatıp açma: kayıtlar ve dosyalar duruyor, SHA-256 tutuyor
  await baslat();
  const v1 = await listele();
  SONUC('yeniden açılışta kayıtlar duruyor', v1.kataloglar.length === kayitlar.length, v1.kataloglar.length);
  for (const k of v1.kataloglar) SONUC(`yeniden açılışta doğrulama: ${k.ad}`, (await page.evaluate(d => window.IrriKatalogDepo.dosyaDogrula(d), k.dosya)).ok);

  // 3) Güncelleme: eski sürüm saklanır (iki dosya da diskte)
  const k0 = v1.kataloglar.find(k => k.ad === `Test ${BOYUTLAR[0]} MB`);
  if (k0) {
    const r = await yaz(BOYUTLAR[0], 99);
    if (!r.ok) SONUC('güncelleme için yeni PDF yazımı', false, r);
    else {
    await page.evaluate(([k, d]) => window.IrriKatalogDepo.katalogKaydet(window.IrriKatalogModel.surumEkle(k, d)), [k0, r.d]);
    const ad = (await dosyalar()).map(f => f.ad);
    SONUC('güncelleme: yeni ve eski sürüm dosyaları diskte', ad.includes(r.d.anahtar + '.pdf') && ad.includes(k0.dosya.anahtar + '.pdf'));
  } }

  // 4) Aynı PDF yeniden: aynı SHA-256 → yinelenme algılanır
  await baslat();
  const r2 = await yaz(BOYUTLAR[0], 1);
  if (!r2.ok) SONUC('aynı PDF yazımı', false, r2); else {
  const ayni = await page.evaluate(async sha => { const { kataloglar } = await window.IrriKatalogDepo.listele(); const k = window.IrriKatalogModel.ayniDosya(kataloglar, sha); return k && k.ad; }, r2.d.sha256);
  SONUC('aynı PDF yeniden yüklenince algılanır', !!ayni, ayni);
  await page.evaluate(d => window.IrriKatalogDepo.dosyaSil(d), r2.d); }

  // 5) Yarım kalan yükleme: yazım sürerken uygulama kapatılır; sonra sahipsiz dosya temizliği
  await page.evaluate(() => { const p = new Uint8Array(1024 * 1024).fill(7); const b = new Blob([new TextEncoder().encode('%PDF-1.4\n')].concat(Array(80).fill(p)), { type: 'application/pdf' }); window.__yarim = window.IrriKatalogDepo.dosyaYaz(new File([b], 'yarim.pdf')).catch(() => null); });
  await page.waitForTimeout(2500);
  await sh(`am force-stop ${PKG}`);
  const yarim = (await dosyalar()).filter(f => /\.part$/.test(f.ad));
  log('kapatma anında yarım dosya', JSON.stringify(yarim));
  await baslat(); const temiz = await page.evaluate(() => window.IrriKatalogDepo.sahipsizTemizle());
  SONUC('yarım kalan yükleme: .part dosyası açılışta temizlenir, kayıt oluşmaz', !(await dosyalar()).some(f => /\.part$/.test(f.ad)) && (await listele()).kataloglar.length === kayitlar.length, { yarim: yarim.length, temizlenen: temiz });

  // 6) Bilgi yedeği → kayıtları sil → geri yükle → aynı PDF ile eşleştir
  const kk = (await listele()).kataloglar.find(k => k.ad === `Test ${BOYUTLAR[1] || BOYUTLAR[0]} MB`);
  if (kk) {
    const yedek = await page.evaluate(async () => { const { firmalar, kataloglar } = await window.IrriKatalogDepo.listele(); return JSON.stringify(window.IrriKatalogModel.yedekOlustur(firmalar, kataloglar)); });
    SONUC('bilgi yedeği PDF içermez', !/%PDF/.test(yedek) && JSON.parse(yedek).pdfIcerir === false, (yedek.length / 1024).toFixed(1) + ' KB');
    await page.evaluate(k => window.IrriKatalogDepo.katalogSil(k), kk);
    const geri = await page.evaluate(async y => { const D = window.IrriKatalogDepo, M = window.IrriKatalogModel, v = await D.listele(), r = M.yedekOku(y, v.firmalar, v.kataloglar); for (const f of r.firmalar) await D.firmaKaydet(f); for (const k of r.kataloglar) await D.katalogKaydet(k); return r.kataloglar.map(k => k.id); }, yedek);
    const idx = BOYUTLAR.indexOf(BOYUTLAR[1] || BOYUTLAR[0]);
    await baslat();
    const r3 = await yaz(BOYUTLAR[idx], idx + 1);
    if (!r3.ok) { SONUC('geri yükleme için PDF yazımı', false, r3); r3.d = { sha256: '' }; }
    const es = await page.evaluate(async ([id, d]) => { const D = window.IrriKatalogDepo, { kataloglar } = await D.listele(), k = kataloglar.find(x => x.id === id); if (!k || !k.dosya.bekliyor || k.dosya.sha256 !== d.sha256) return false; await D.katalogKaydet(Object.assign({}, k, { dosya: d })); return true; }, [kk.id, r3.d]);
    SONUC('geri yükleme sonrası aynı PDF SHA-256 ile eşleşir', geri.includes(kk.id) && es);
  }

  // 7) Silme ve alanın geri kazanılması
  const once = await bosAlanKB(), du0 = await runas(`du -sk ${DIR}`);
  for (const k of (await listele()).kataloglar) await page.evaluate(k => window.IrriKatalogDepo.katalogSil(k), k);
  await page.evaluate(() => window.IrriKatalogDepo.sahipsizTemizle());
  const sonra = await bosAlanKB(), kalan = await dosyalar();
  SONUC('silme: bütün PDF dosyaları kaldırıldı ve alan geri kazanıldı', !kalan.length && sonra > once, { onceDu: du0, kazanilanKB: sonra - once });

  // 8) Yetersiz depolama: /data doldurulur, ~40 MB boş bırakılır; 120 MB yazım reddedilmeli ve artık dosya kalmamalı
  const bos = await bosAlanKB(), doldur = Math.max(0, bos - 40 * 1024);
  log('boş alan (KB)', bos, 'doldurulan (KB)', doldur);
  await sh(`fallocate -l ${doldur}k /data/local/tmp/doldur.bin || dd if=/dev/zero of=/data/local/tmp/doldur.bin bs=1048576 count=${Math.floor(doldur / 1024)}`);
  log('doldurma sonrası boş alan (KB)', await bosAlanKB());
  const r4 = await yaz(120, 7);
  SONUC('yetersiz alan: yazım reddedilir, anlaşılır hata', !r4.ok && /boş alan|space|ENOSPC/i.test(r4.hata || ''), r4.ok ? 'yazıldı!' : r4.hata);
  SONUC('yetersiz alan: yarım dosya kalmaz', !(await dosyalar()).length, await dosyalar());
  await sh('rm -f /data/local/tmp/doldur.bin');
  log('BİTTİ');
  await device.close();
})().catch(e => { console.log('[KAT] BETİK HATASI', e && e.stack || e); process.exit(1); });

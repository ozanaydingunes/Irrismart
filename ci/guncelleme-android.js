#!/usr/bin/env node
// TEST (birleşik test dalı, birleştirilmeyecek): telefondaki 1.0.5 tanılama kurulumunu (versionCode 17) taklit eder;
// test projeleri kaydedilir, yeni APK (versionCode 18) 'adb install -r' ile ÜZERİNE kurulur (kaldırma yok),
// proje verisinin bayt bayt korunduğu, hesap sonucunun değişmediği ve katalog depolamasının çalıştığı denetlenir.
const { _android: android } = require('playwright');
const { execSync } = require('child_process');
const PKG = 'com.irrigrow.app.dev';
const log = (...a) => console.log('[GUN]', ...a);
const SONUC = (ad, ok, ek) => log((ok ? 'GEÇTİ' : 'KALDI') + ' ' + ad + (ek !== undefined ? ' ' + JSON.stringify(ek) : ''));
const lat = 37.0, lng = 35.0;
const PROJ = [
  { id: 'pb', name: 'Test 8 shift', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [[lat, lng], [lat, lng + 0.0075], [lat + 0.0021, lng + 0.0078], [lat + 0.0027, lng + 0.0012], [lat + 0.0012, lng - 0.0006]], src: [lat - 0.0005, lng - 0.0005], station: null, route: [], inp: { crop: 'domates', geom: 'parsel', Q: 120, srcType: 'kuyu', depth: 40, region: 'akdeniz', hours: 20 }, shiftSira: null },
  { id: 'p9', name: '9 shift kayıtlı', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [[36.9, 30.7], [36.9, 30.7105], [36.9021, 30.7112], [36.9035, 30.706], [36.903, 30.7005]], src: [36.8996, 30.6996], station: [36.8998, 30.6998], route: [[36.8999, 30.7]], inp: { crop: 'domates', geom: 'parsel', Q: 90, srcType: 'kuyu', depth: 40, region: 'akdeniz', soil: 'tinli', hours: 20, Ns: 9 } },
  { id: 'p3', name: 'Test 3 shift', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [], src: null, inp: { crop: 'domates', area_da: 20, L: 200, W: 100, Q: 40, srcType: 'kuyu', depth: 30, region: 'akdeniz', hours: 20 } },
];

(async () => {
  const [device] = await android.devices();
  const sh = async c => (await device.shell(c)).toString().trim();
  const surum = async () => (await sh(`dumpsys package ${PKG}`)).split('\n').filter(l => /versionCode|versionName/.test(l)).map(s => s.trim()).slice(0, 2).join(' ');
  let page;
  const baslat = async () => { await sh(`am force-stop ${PKG}`); await sh(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`); const wv = await device.webView({ pkg: PKG }, { timeout: 90000 }); page = await wv.page(); await page.waitForFunction(() => window.IrriEngine && window.IRRI_SURUM, null, { timeout: 60000 }); await page.waitForTimeout(1500); };
  // Hesap parmak izi: her projenin motor sonucu (kayıtlı girdilerle) — eski ve yeni sürümde aynı olmalı
  const parmakIzi = () => page.evaluate(() => { const ps = JSON.parse(localStorage.getItem('irrismart.projects.v1') || '[]'); return ps.map(p => { const r = window.IrriEngine.design(p.inp, null, p.poly && p.poly.length >= 3 ? { poly: p.poly, src: p.src, station: p.station, route: p.route } : {}); return { id: p.id, ok: r.ok, Ns: r.ok ? r.sel.groups.length : null, Qj: r.ok ? r.sel.Qj.map(q => +q.toFixed(4)) : null, H: r.ok && r.pump ? +(r.pump.H || 0).toFixed(3) : null }; }); });

  execSync('adb install eski.apk', { stdio: 'inherit' });
  log('eski kurulum', await surum());
  await baslat();
  // Projeler uygulamanın kendi kaydetme yoluyla yazılır; WebView DOMStorage'ı diske yazsın diye beklenir (zorla kapatma öncesi)
  await page.evaluate(ps => { localStorage.setItem('irrismart.projects.v1', JSON.stringify(ps)); }, PROJ);
  await page.reload(); await page.waitForTimeout(3000);
  SONUC('eski sürümde test projeleri kayıtlı (yeniden yüklemede okunuyor)', await page.evaluate(() => (JSON.parse(localStorage.getItem('irrismart.projects.v1') || '[]')).length) === PROJ.length);
  // Eski sürümde (main 1.0.6) bir katalog PDF'i ve kaydı oluşturulur; güncellemeden sonra korunmalı
  const katEski = await page.evaluate(async () => { const D = window.IrriKatalogDepo, M = window.IrriKatalogModel; const b = new Blob([new TextEncoder().encode('%PDF-1.4\n% guncelleme katalog\n'), new Uint8Array(2 * 1024 * 1024).fill(9), new TextEncoder().encode('\n%%EOF\n')]); const d = await D.dosyaYaz(new File([b], 'eski-katalog.pdf')); const f = M.yeniFirma('Test Firma'); await D.firmaKaydet(f); const k = M.yeniKatalog({ ad: 'Eski sürüm kataloğu', firmaId: f.id, dosya: d }); await D.katalogKaydet(k); return { id: k.id, sha: d.sha256, anahtar: d.anahtar }; });
  log('eski sürümde katalog', JSON.stringify(katEski));
  await page.waitForTimeout(10000);
  await baslat();
  const eskiVeri = await page.evaluate(() => localStorage.getItem('irrismart.projects.v1')), eskiIz = await parmakIzi(), eskiYedek = await page.evaluate(() => JSON.stringify(window.IrriStore.backupPayload(JSON.parse(localStorage.getItem('irrismart.projects.v1')), {}, null, new Date(0))));
  if (!eskiVeri) { SONUC('eski sürümde veri zorla kapatma sonrası okunabiliyor', false); process.exit(1); }
  log('eski sürüm', await page.evaluate(() => window.IRRI_SURUM + ' / ' + window.IRRI_SURUM_KODU), 'hesap', JSON.stringify(eskiIz.map(x => x.id + ':' + x.Ns)));

  // Yeni APK eskinin ÜZERİNE (kaldırmadan)
  let cikti = '';
  try { cikti = execSync('adb install -r yeni.apk 2>&1').toString(); } catch (e) { cikti = String(e.stdout || e.message); }
  log('adb install -r çıktısı', cikti.trim().split('\n').pop());
  SONUC('yeni APK eski kurulumun üzerine kuruldu (kaldırma yok)', /Success/.test(cikti), cikti.trim().split('\n').pop());
  if (!/Success/.test(cikti)) { log('logcat', execSync('adb logcat -d | grep -iE "PackageManager|INSTALL_FAILED" | tail -20').toString()); process.exit(1); }
  log('yeni kurulum', await surum());
  await baslat();
  SONUC('yeni sürüm çalışıyor (versionCode 20)', await page.evaluate(() => window.IRRI_SURUM_KODU) === 20, await page.evaluate(() => window.IRRI_SURUM));
  const yeniVeri = await page.evaluate(() => localStorage.getItem('irrismart.projects.v1'));
  SONUC('proje verisi bayt bayt korundu', yeniVeri === eskiVeri, { uzunluk: [eskiVeri && eskiVeri.length, yeniVeri && yeniVeri.length] });
  const yeniIz = await parmakIzi();
  SONUC('eski projelerin hidrolik sonuçları değişmedi (aynı girdi → aynı sonuç)', eskiIz.length === PROJ.length && eskiIz.every(x => x.ok) && JSON.stringify(yeniIz) === JSON.stringify(eskiIz), yeniIz.map(x => x.id + ':' + x.Ns));
  // JSON yedeği: eski sürümün dışa aktarımı yeni sürümde aynı projeleri verir
  // JSON yedeği: eski sürümde (17) alınan yedek yeni sürümde (18) okunur; projeler ve hesap sonuçları aynı
  const yedekUyum = await page.evaluate(y => { const r = window.IrriStore.readBackup(y); const ps = r.valid; return { n: ps.length, ayni: JSON.stringify(ps.map(p => [p.id, p.inp])) === JSON.stringify(JSON.parse(y).projects.map(p => [p.id, p.inp])) }; }, eskiYedek).catch(e => ({ hata: e.message }));
  SONUC('eski sürüm JSON yedeği yeni sürümde okunur, proje girdileri aynı', yedekUyum.n === PROJ.length && yedekUyum.ayni, yedekUyum);
  // Katalog depolaması yeni sürümde çalışıyor
  const kat = await page.evaluate(async () => { const D = window.IrriKatalogDepo; if (!D) return { yok: true }; const b = new Blob([new TextEncoder().encode('%PDF-1.4\n% guncelleme testi\n'), new Uint8Array(5 * 1024 * 1024).fill(3), new TextEncoder().encode('\n%%EOF\n')]); const d = await D.dosyaYaz(new File([b], 't.pdf')); const v = await D.dosyaDogrula(d); await D.dosyaSil(d); return { yerel: D.yerel(), depo: d.depo, ok: v.ok }; });
  SONUC('katalog depolaması yeni sürümde çalışıyor (Android dosya + SHA-256)', kat.yerel && kat.depo === 'android-dosya' && kat.ok, kat);
  // Eski sürümde yüklenen katalog korunmuş: kayıt, dosya ve SHA-256
  const katYeni = await page.evaluate(async id => { const D = window.IrriKatalogDepo; const { kataloglar } = await D.listele(); const k = kataloglar.find(x => x.id === id); if (!k) return { yok: true }; return { sha: k.dosya.sha256, dogru: (await D.dosyaDogrula(k.dosya)).ok }; }, katEski.id);
  SONUC('eski sürümde yüklenen katalog güncellemeden sonra korundu (kayıt + PDF + SHA-256)', katYeni.dogru && katYeni.sha === katEski.sha, katYeni);
  SONUC('Manuel Shift modu yüklü', await page.evaluate(() => !!(window.IrriShiftYonetimi && window.IrriShiftYonetimi.manuelAdaylar && window.IrriShiftYonetimi.bolumle)));

  // ---------- Gerçek WebView'da manuel mod etkileşimi (dokunuşlar Playwright tap ile WebView'a gönderilir) ----------
  page.on('dialog', d => d.accept());
  const bosta = () => page.waitForFunction(() => { const p = document.querySelector('#smPanel'); return p && p.getAttribute('aria-busy') !== 'true'; }, null, { timeout: 60000 }).then(() => page.waitForTimeout(400));
  const ekranda = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight && b.right <= innerWidth; }, sel);
  const N = async () => +(await page.textContent('#smNsN'));
  await page.evaluate(() => document.querySelector('[data-open="p3"]').click()); await page.waitForTimeout(800);
  await page.evaluate(() => window.IrriApp.show('hidrolik')); await page.waitForTimeout(2000);
  await page.tap('#bShiftYon'); await page.waitForSelector('#smPanel'); await bosta();
  SONUC('WebView: panel başlığı, mod seçici, − / + ve uygunluk kaydırmadan ekranda (otomatik)', (await Promise.all(['#smTitle', '#smMod [data-smmod=manuel]', '#smNsEksi', '#smNsArti', '#smUygunluk h3'].map(ekranda))).every(Boolean));
  await page.tap('#smMod [data-smmod=manuel]'); await bosta();
  SONUC('WebView: Manuel moda geçildi', await page.isVisible('#smManuelEtiket'));
  SONUC('WebView: manuel modda başlık, − / + ve uygunluk kaydırmadan ekranda', (await Promise.all(['#smTitle', '#smNsEksi', '#smNsArti', '#smUygunluk h3'].map(ekranda))).every(Boolean));
  const n0 = await N(); await page.tap('#smNsEksi'); await bosta(); const n1 = await N();
  const genel = await page.getAttribute('#smUygunluk', 'data-genel');
  SONUC(`WebView: manuel − dokunuşu ${n0} → ${n1}; kaynak sınırı altı "uygun değil"`, n1 === n0 - 1 && genel === 'uygun-degil' && await page.isVisible('#smKaynakAlti'), { genel });
  await page.tap('#smUygula'); await page.waitForTimeout(2500);
  const kayit = await page.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(p => p.id === 'p3'));
  SONUC('WebView: uygunsuz manuel düzen onayla kaydedildi, kullanıcı kararı saklandı', kayit.shiftEdit && new Set(kayit.shiftEdit.assign).size === n1 && kayit.shiftKullaniciKarari && kayit.shiftKullaniciKarari.genel === 'uygun-degil');
  await baslat();
  const sonra = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(x => x.id === 'p3'); const r = window.IrriEngine.design(p.inp, null, { manual: p.shiftEdit }); const d = window.IrriReportData.build(p, r); return { n: r.sel.groups.length, uygunsuz: d.akil.findings.filter(f => f.seviye === 'uygunsuz').length, not: d.akil.other.some(w => /bilerek kaydetti/.test(w)) }; });
  SONUC('WebView: yeniden açılışta manuel düzen duruyor; raporda uygunsuz bulgu ve kullanıcı kararı notu', sonra.n === n1 && sonra.uygunsuz >= 1 && sonra.not, sonra);
  await page.evaluate(() => document.querySelector('[data-open="p3"]').click()); await page.waitForTimeout(800);
  await page.evaluate(() => window.IrriApp.show('hidrolik')); await page.waitForTimeout(2000);
  if (await page.$('#bShiftGeri')) { await page.tap('#bShiftGeri'); await page.waitForTimeout(2000); }
  const geri = await page.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(x => x.id === 'p3'));
  SONUC('WebView: Geri Al manuel düzeni ve kararı geri aldı', !geri.shiftEdit && !geri.shiftKullaniciKarari);
  // Yeniden başlatma sonrası veri duruyor
  await baslat();
  SONUC('yeniden başlatma sonrası projeler duruyor', await page.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1') || '[]').length) === PROJ.length);
  log('BİTTİ');
  await device.close();
})().catch(e => { console.log('[GUN] BETİK HATASI', e && e.stack || e); process.exit(1); });

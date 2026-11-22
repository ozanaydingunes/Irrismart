#!/usr/bin/env node
// TEST (1.0.7 sürüm dalı): Android emülatöründe
//  1) telefondaki kurulumu taklit eden eski APK (versionCode 20) kurulur; proje + katalog PDF kaydı oluşturulur,
//  2) 1.0.7 APK (versionCode 21) kaldırmadan üzerine kurulur; proje ve katalog korunumu, ürün veritabanı geçişi (IndexedDB 2) denetlenir,
//  3) masaüstüyle aynı eşdeğerlik parmak izi (ci/parmak-izi.js) gerçek WebView'da hesaplanır ve masaüstü özetiyle karşılaştırılır.
const { _android: android } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs'), crypto = require('crypto');
const PI = require('./parmak-izi.js');
const PKG = 'com.irrigrow.app.dev';
const log = (...a) => console.log('[ESD]', ...a);
const SONUC = (ad, ok, ek) => log((ok ? 'GEÇTİ' : 'KALDI') + ' ' + ad + (ek !== undefined ? ' ' + JSON.stringify(ek).slice(0, 300) : ''));
(async () => {
  const [device] = await android.devices();
  const sh = async c => (await device.shell(c)).toString().trim();
  log('android', await sh('getprop ro.build.version.release'), (await sh('dumpsys webviewupdate')).split('\n').filter(l => /Current WebView package/.test(l)).join(' '));
  let page;
  const baslat = async () => { for (let d = 1; d <= 3; d++) { try { await sh(`am force-stop ${PKG}`); await sh(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`); await new Promise(r => setTimeout(r, 3000)); const wv = await device.webView({ pkg: PKG }, { timeout: 90000 }); page = await wv.page(); page.on('dialog', x => x.accept().catch(() => {})); await page.waitForFunction(() => window.IrriEngine && window.IRRI_SURUM, null, { timeout: 60000 }); await page.waitForTimeout(1500); return; } catch (e) { log('başlatma denemesi', d, String(e.message).split('\n')[0]); if (d === 3) throw e; } } };
  // 1) Eski sürüm
  execSync('adb install eski.apk', { stdio: 'inherit' }); await baslat();
  log('eski sürüm', await page.evaluate(() => window.IRRI_SURUM + ' / ' + window.IRRI_SURUM_KODU));
  const eski = await page.evaluate(async () => {
    const ps = [{ id: 'tel', name: 'Telefon projesi', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [], src: null, inp: { crop: 'domates', area_da: 20, L: 200, W: 100, Q: 40, srcType: 'kuyu', depth: 30, region: 'akdeniz', hours: 20 } }];
    localStorage.setItem('irrismart.projects.v1', JSON.stringify(ps));
    const D = window.IrriKatalogDepo, M = window.IrriKatalogModel;
    const d = await D.dosyaYaz(new File([new Blob([new TextEncoder().encode('%PDF-1.4\n% eski katalog\n'), new Uint8Array(1024 * 1024).fill(5), new TextEncoder().encode('\n%%EOF\n')])], 'eski.pdf'));
    const f = M.yeniFirma('Eski Firma'); await D.firmaKaydet(f); const k = M.yeniKatalog({ ad: 'Eski katalog', firmaId: f.id, dosya: d }); await D.katalogKaydet(k);
    return { katalogId: k.id, sha: d.sha256, proje: localStorage.getItem('irrismart.projects.v1') };
  });
  await page.reload(); await page.waitForTimeout(3000); await page.waitForTimeout(8000);
  // 2) 1.0.7 üzerine kurulum
  let cikti = ''; try { cikti = execSync('adb install -r yeni.apk 2>&1').toString(); } catch (e) { cikti = String(e.stdout || e.message); }
  SONUC('1.0.7 APK eski kurulumun üzerine kuruldu (kaldırma yok)', /Success/.test(cikti), cikti.trim().split('\n').pop());
  if (!/Success/.test(cikti)) process.exit(1);
  await baslat();
  SONUC('1.0.7 çalışıyor (versionCode 21)', await page.evaluate(() => window.IRRI_SURUM_KODU) === 21, await page.evaluate(() => window.IRRI_SURUM));
  SONUC('proje verisi bayt bayt korundu', await page.evaluate(() => localStorage.getItem('irrismart.projects.v1')) === eski.proje);
  const kat = await page.evaluate(async id => { const D = window.IrriKatalogDepo; const v = await D.listele(); const k = v.kataloglar.find(x => x.id === id); const db = await D.db(); return { var: !!k, sha: k && k.dosya.sha256, dogru: k ? (await D.dosyaDogrula(k.dosya)).ok : false, surum: db.version, depolar: [...db.objectStoreNames].sort() }; }, eski.katalogId);
  SONUC('katalog ve PDF korundu; ürün veritabanı geçişi (IndexedDB sürüm 2)', kat.var && kat.sha === eski.sha && kat.dogru && kat.surum === 2 && ['urunler', 'degerler', 'egriler'].every(x => kat.depolar.includes(x)), kat);
  // 3) Eşdeğerlik parmak izi (temiz başlangıç: mevcut veriler silinmeden ayrı veritabanı adıyla değil, aynı depo; test kayıtları kimlikle ayrılır)
  await page.evaluate(PI.kur); const iz = await page.evaluate(PI.iz);
  const json = JSON.stringify(iz), h = crypto.createHash('sha256').update(json).digest('hex');
  fs.writeFileSync(process.env.ESDEGER_OUT || 'esdeger-android.json', json);
  const masa = fs.existsSync('esdeger-masaustu.json') ? fs.readFileSync('esdeger-masaustu.json', 'utf8') : null, hm = masa ? crypto.createHash('sha256').update(masa).digest('hex') : null;
  log('android parmak izi', h, 'masaüstü', hm);
  if (masa && masa !== json) {
    const a = JSON.parse(masa), b = iz;
    for (const k of Object.keys(a)) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
      if (k === 'excelSayfa' && Array.isArray(a[k]) && Array.isArray(b[k])) {
        a[k].forEach(([ad, rows], i) => { const r2 = (b[k][i] || [])[1] || []; if (JSON.stringify(rows) === JSON.stringify(r2)) return;
          for (let y = 0; y < Math.max(rows.length, r2.length); y++) { const x1 = JSON.stringify(rows[y]), x2 = JSON.stringify(r2[y]); if (x1 !== x2) { log('FARK Excel', ad, 'satır', y + 1, 'masaüstü:', String(x1).slice(0, 220), '| android:', String(x2).slice(0, 220)); break; } } });
      } else log('FARK', k, JSON.stringify(a[k]).slice(0, 200), '≠', JSON.stringify(b[k]).slice(0, 200));
    }
  }
  SONUC('Android ve masaüstü aynı mühendislik sonuçları (hesap, otomatik/manuel shift, ürünler, öneriler, malzeme, rapor/Excel verisi)', !!masa && masa === json);
  log('BİTTİ'); await device.close();
})().catch(e => { console.log('[ESD] BETİK HATASI', e && e.stack || e); process.exit(1); });

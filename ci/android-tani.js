#!/usr/bin/env node
// TANILAMA (birleştirilmeyecek): APK'yı gerçek Android WebView'da (emülatör) çalıştırır, Shift Yönetimi akışlarını
// dener ve sonuçları günlüğe yazar. Dokunuşlar `adb input tap` ile gerçek dokunma olayı olarak gönderilir.
// Kişisel veri yok: yalnız test projeleri kullanılır.
const { _android: android } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.env.TANI_OUT || 'tani'; fs.mkdirSync(OUT, { recursive: true });
const PKG = 'com.irrigrow.app.dev';
const log = (...a) => console.log('[TANI]', ...a);
const lat = 37.0, lng = 35.0;
const PROJ = [
  { id: 'pb', name: 'Test 8 shift', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [[lat, lng], [lat, lng + 0.0075], [lat + 0.0021, lng + 0.0078], [lat + 0.0027, lng + 0.0012], [lat + 0.0012, lng - 0.0006]], src: [lat - 0.0005, lng - 0.0005], station: null, route: [], inp: { crop: 'domates', geom: 'parsel', Q: 120, srcType: 'kuyu', depth: 40, region: 'akdeniz', hours: 20 } },
  { id: 'p3', name: 'Test 3 shift', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [], src: null, inp: { crop: 'domates', area_da: 20, L: 200, W: 100, Q: 40, srcType: 'kuyu', depth: 30, region: 'akdeniz', hours: 20 } },
  { id: 'p1', name: 'Test tek shift', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [], src: null, inp: { crop: 'domates', area_da: 4, L: 80, W: 50, Q: 60, srcType: 'kuyu', depth: 20, region: 'akdeniz', hours: 20 } },
];

(async () => {
  const [device] = await android.devices();
  log('cihaz', device.model(), device.serial());
  const sh = async c => (await device.shell(c)).toString().trim();
  log('android', await sh('getprop ro.build.version.release'), 'sdk', await sh('getprop ro.build.version.sdk'));
  log('webview', (await sh('dumpsys webviewupdate')).split('\n').filter(l => /Current WebView package|versionName/.test(l)).slice(0, 3).join(' | '));
  log('paket', (await sh(`dumpsys package ${PKG}`)).split('\n').filter(l => /versionCode|versionName/.test(l)).map(s => s.trim()).slice(0, 2).join(' | '));
  await sh(`am force-stop ${PKG}`); await sh(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`);
  const webview = await device.webView({ pkg: PKG }, { timeout: 60000 });
  const page = await webview.page();
  const hatalar = [];
  page.on('pageerror', e => hatalar.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') hatalar.push(m.type() + ': ' + m.text()); });
  await page.waitForTimeout(3000);
  log('url', page.url(), 'ua', await page.evaluate(() => navigator.userAgent));

  // ---------- A. Paketteki kod ----------
  const kod = await page.evaluate(async () => {
    const app = await (await fetch('js/app.js')).text(), sy = await (await fetch('js/shift-yonetimi.js')).text().catch(() => '');
    return { surum: window.IRRI_SURUM, kod: window.IRRI_SURUM_KODU, appBoyut: app.length, sy: typeof window.IrriShiftYonetimi, syHedefler: !!(window.IrriShiftYonetimi && window.IrriShiftYonetimi.hedefler),
      ssTutamak: app.includes('function ssTutamak'), nsSecim: app.includes('function nsSecim'), smekle: app.includes('data-smekle'), bulgu: app.includes('smBulgu'), arazi: app.includes("ss-arazi"),
      desk: document.documentElement.classList.contains('desk'), web: document.documentElement.classList.contains('web'), w: innerWidth, h: innerHeight, dpr: devicePixelRatio,
      tabH: getComputedStyle(document.documentElement).getPropertyValue('--tab'), topH: getComputedStyle(document.documentElement).getPropertyValue('--top') };
  });
  log('kod', JSON.stringify(kod));

  // ---------- Test projeleri ----------
  await page.evaluate(ps => { localStorage.setItem('irrismart.projects.v1', JSON.stringify(ps)); }, PROJ);
  await page.reload(); await page.waitForTimeout(3000);

  // Gerçek dokunuş: CSS piksel → ekran pikseli (WebView tam ekran varsayımı ölçülerek doğrulanır)
  const ekran = await sh('wm size'); log('ekran', ekran);
  const dokun = async (sel, ad) => {
    const r = await page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const ust = document.elementFromPoint(x, y);
      const cs = getComputedStyle(e); return { x, y, w: b.width, h: b.height, gorunur: b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none', ustte: ust ? (ust === e || e.contains(ust)) : false, ustEleman: ust ? ust.tagName + '#' + ust.id + '.' + String(ust.className).slice(0, 40) : null, z: cs.zIndex, pos: cs.position, bottom: cs.bottom }; }, sel);
    if (!r) { log(ad, 'YOK (DOM\'da değil):', sel); return false; }
    log(ad, JSON.stringify(r));
    const dpr = kod.dpr, x = Math.round(r.x * dpr), y = Math.round(r.y * dpr);
    await device.shell(`input tap ${x} ${y}`); await page.waitForTimeout(1500);
    return true;
  };
  const durum = async ad => log(ad, JSON.stringify(await page.evaluate(() => ({ gorunum: (document.querySelector('.view.on') || {}).id, tut: !!document.querySelector('#ssTut'), sheet: !!document.querySelector('#ssSheet'), sm: !!document.querySelector('#smPanel'), smGizli: (document.querySelector('#smPanel') || { classList: { contains: () => null } }).classList.contains('sm-min'),
    ns: (document.querySelector('#smNsN') || {}).textContent, kart: document.querySelectorAll('#smPanel .sm-shift').length, cmp: !!document.querySelector('#smPanel .sm-cmp'), bulgu: !!document.querySelector('#smBulgu'), uygun: (document.querySelector('#smUygunluk') || { dataset: {} }).dataset.genel, mesgul: (document.querySelector('#smPanel') || { getAttribute: () => null }).getAttribute('aria-busy'), toast: (document.querySelector('#toast.on') || {}).textContent || '' }))));
  const ekranGoruntusu = async ad => { try { fs.writeFileSync(path.join(OUT, ad + '.png'), await device.screenshot()); } catch (e) { log('ekran görüntüsü alınamadı', e.message); } };

  for (const id of ['pb', 'p3', 'p1']) {
    log('==== proje', id);
    await page.evaluate(() => document.querySelector('nav.tabs [data-v=projeler]').click()); await page.waitForTimeout(800);
    await dokun(`[data-open="${id}"]`, 'proje aç');
    await dokun('nav.tabs [data-v=hidrolik]', 'hidrolik sekmesi'); await page.waitForTimeout(4000);
    await durum('hidrolik'); await ekranGoruntusu(id + '-1-hidrolik');
    // 1. Alt Shift paneli
    if (await dokun('#ssTut', 'TUTAMAK')) { await durum('tutamak sonrası'); await ekranGoruntusu(id + '-2-sheet'); const x = await page.$('#ssX'); if (x) await dokun('#ssX', 'kapat'); }
    // 2. +/−
    if (await dokun('#bShiftYon', 'Shift Yönetimi düğmesi')) {
      await page.waitForTimeout(1500); await durum('panel açıldı'); await ekranGoruntusu(id + '-3-panel');
      if (await dokun('#smNsArti', 'ARTI')) { await page.waitForTimeout(5000); await durum('+ sonrası'); await ekranGoruntusu(id + '-4-arti'); }
      if (await dokun('#smNsEksi', 'EKSİ')) { await page.waitForTimeout(5000); await durum('− sonrası'); }
      // 3. Alt ünite ekleme: gerçek <select> dokunuşu yerel seçiciyi açar; seçim DOM üzerinden yapılır (yerel liste otomasyonu yok)
      const sec = await page.$('#smPanel select[data-smekle]');
      if (sec) { const ops = await sec.$$eval('option', o => o.map(x => x.value).filter(Boolean)); await sec.selectOption(ops[0]); await page.waitForTimeout(5000); await durum('alt ünite ekleme sonrası'); await ekranGoruntusu(id + '-5-ekle'); }
      else log('alt ünite ekle seçicisi YOK');
      // 4. Uygunluk
      log('uygunluk', JSON.stringify(await page.evaluate(() => { const u = document.querySelector('#smUygunluk'), b = document.querySelector('#smBulgu'); return { u: !!u, genel: u && u.dataset.genel, bulguGrup: b ? b.querySelectorAll('ul[data-grup]').length : 0, cmpSatir: document.querySelectorAll('#smPanel .sm-cmp tr[data-k]').length }; })));
      if (await page.$('#smIptal')) await dokun('#smIptal', 'iptal');
    }
    // Arazi tutamağı
    await dokun('nav.tabs [data-v=arazi]', 'arazi sekmesi'); await page.waitForTimeout(3000);
    await durum('arazi'); await ekranGoruntusu(id + '-6-arazi');
  }
  log('HATALAR', hatalar.length ? hatalar.slice(0, 30).join(' || ') : 'yok');
  log('son hata (window)', await page.evaluate(() => window.__sonHata || '-'));
  await device.close();
})().catch(e => { console.log('[TANI] BETİK HATASI', e && e.stack || e); process.exit(1); });

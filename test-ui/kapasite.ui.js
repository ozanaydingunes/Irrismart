#!/usr/bin/env node
// MH-AKIL-2 — Tarayıcı testleri (S-12): "Kapasite alternatifleri" kartı.
//  • Düğme → ilerleme → sonuç tablosu; sonuç projeye kaydedilir, sayfa yeniden açılınca korunur.
//  • Masaüstü (1280) ve telefon (390) aynı alternatifleri ve aynı sayıları (data-v) gösterir.
//  • Yatay sayfa taşması yok; düğme ≥ 44 px; açık ve koyu temada karşıtlık ≥ 4,5:1.
//  • Hiçbir alternatif kritik uyarı açıkken "Uygun" görünmez; test2'de "uygun alternatif bulunamadı" yazar.
//  • W-KAP-01 kartındaki kaynak çözümü motor sonucunu (debi) gösterir.
//  • Girdi değişince kayıtlı alternatifler geçersiz sayılır ve yeniden hesap istenir.
//  • Kapasite sorunu olmayan projede kart gösterilmez.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www'), SHOTS = process.env.SHOTS || null;
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const PROJECTS = [
  { id: 't2', name: 'test2', created: 1, updated: 2, poly: [], src: null, inp: { crop: 'domates', area_da: 288.9, srcType: 'kuyu', depth: 40, region: 'akdeniz', Q: 86.3 } },
  { id: 'p1', name: 'S01 Domates', created: 1, updated: 1, poly: [], src: null, inp: { crop: 'domates', srcType: 'kuyu', region: 'akdeniz', soil: 'tinli', area_da: 50, L: 400, W: 125, Q: 45, depth: 40 } },
];
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };
function lum(rgb) { const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

(async () => {
  const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const port = srv.address().port, browser = await chromium.launch();
  const open = async (w, h, theme) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.route(/arcgisonline|open-meteo/, r => r.abort());
    const pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
    await pg.addInitScript(([p, th]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('irrismart.projects.v1', p); sessionStorage.setItem('seeded', '1'); } localStorage.setItem('irrigrow.theme', th); }, [JSON.stringify(PROJECTS), theme]);
    await pg.goto(`http://localhost:${port}/`); await pg.waitForTimeout(1000);
    await pg.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
    return { ctx, pg, errs };
  };
  const toResult = async (pg, id) => { await pg.click('[data-v=projeler]'); await pg.waitForTimeout(200); await pg.click(`[data-open=${id}]`); await pg.waitForTimeout(400); await pg.click('[data-v=sonuc]'); await pg.waitForTimeout(800); };
  const rows = pg => pg.$$eval('#kapasite tr[data-alt]', trs => trs.map(tr => ({ id: tr.dataset.alt, durum: tr.querySelector('[data-alt-durum]').dataset.altDurum, v: [...tr.querySelectorAll('[data-v]')].map(n => n.dataset.v) })));

  const views = {};
  for (const [w, h, tag] of [[390, 844, 'mobil'], [1280, 900, 'masaustu']]) {
    const { ctx, pg, errs } = await open(w, h, 'acik');
    await toResult(pg, 't2');
    const btn = await pg.$('#bKap');
    check(!!btn, `${tag}: hesapla düğmesi yok`);
    if (btn) check((await btn.boundingBox()).height >= 44, `${tag}: düğme 44 px’ten küçük`);
    await pg.click('#bKap');
    check(!!(await pg.$('#kapasite .ak-prog')), `${tag}: ilerleme göstergesi yok`);
    await pg.waitForSelector('#kapasite table', { timeout: 60000 });
    const rs = await rows(pg); views[tag] = rs;
    check(rs.length >= 5 && rs[0].id === 'mevcut', `${tag}: alternatif satırları eksik (${rs.length})`);
    check(!rs.some(r => r.durum === 'uygun'), `${tag}: test2’de kritik uyarı açıkken "Uygun" alternatif`);
    const txt = await pg.$eval('#kapasite', e => e.textContent);
    check(/Bütün zorunlu kontrolleri sağlayan alternatif bulunamadı/.test(txt) && /mutlak teorik minimum değildir/i.test(txt) || /Mutlak teorik minimum değildir/.test(txt), `${tag}: açıklamalar eksik`);
    const kq = await pg.$eval('#ak-W-KAP-01 [data-tur=kaynak]', e => ({ d: e.dataset.durum, motor: !!e.querySelector('.ak-motor') }));
    check(kq.motor && kq.d === 'hesaplandi-uygunsuz', `W-KAP-01 kaynak çözümü motor sonucunu göstermiyor (${JSON.stringify(kq)})`);
    const ov = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth); check(ov <= 0, `${tag}: yatay taşma ${ov}px`);
    const saved = await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(p => p.id === 't2'));
    check(saved.akil && saved.akil.alternatifler && saved.akil.alternatifler.rows.length === rs.length && saved.inp.Q === 86.3, `${tag}: sonuç projeye kaydedilmedi ya da girdi değişti`);
    await pg.reload(); await pg.waitForTimeout(1000); await toResult(pg, 't2');
    check(!!(await pg.$('#kapasite table')), `${tag}: yeniden açılışta kayıtlı alternatifler görünmüyor`);
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); const H = await pg.$eval('#v-sonuc', e => e.scrollHeight); await pg.setViewportSize({ width: w, height: Math.min(H + 200, 14000) }); await pg.waitForTimeout(200); await (await pg.$('#kapasite')).screenshot({ path: `${SHOTS}/kapasite-${tag}.png` }); }
    check(!errs.length, `${tag}: sayfa hatası ${errs.join(' | ')}`);
    await ctx.close();
  }
  check(JSON.stringify(views.mobil) === JSON.stringify(views.masaustu), 'masaüstü ve mobil farklı alternatif/sayı gösteriyor');

  // Tema karşıtlığı
  for (const theme of ['acik', 'koyu']) {
    const { ctx, pg } = await open(390, 844, theme);
    await toResult(pg, 't2'); await pg.click('#bKap'); await pg.waitForSelector('#kapasite table', { timeout: 60000 });
    const pairs = await pg.$$eval('#kapasite td, #kapasite .ak-asm, #kapasite .ak-key, #kapasite .ak-dz, #kapasite .ak-tl', els => els.map(e => {
      const col = getComputedStyle(e).color; let n = e, bg = 'rgba(0, 0, 0, 0)';
      while (n && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) { bg = getComputedStyle(n).backgroundColor; n = n.parentElement; }
      return [col, bg, e.className || e.tagName];
    }));
    const rgb = s => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    const low = pairs.filter(([c, b]) => contrast(rgb(c), rgb(b)) < 4.5);
    check(pairs.length > 30 && !low.length, `${theme}: ${low.length} öğede karşıtlık < 4,5 (${low.slice(0, 3).map(x => x[2] + ' ' + x[0] + '/' + x[1]).join('; ')})`);
    if (SHOTS) { const H = await pg.$eval('#v-sonuc', e => e.scrollHeight); await pg.setViewportSize({ width: 390, height: Math.min(H + 200, 14000) }); await pg.waitForTimeout(200); await (await pg.$('#kapasite')).screenshot({ path: `${SHOTS}/kapasite-mobil-${theme}.png` }); }
    await ctx.close();
  }

  // Girdi değişince geçersizleşme; kapasite sorunu olmayan projede kart yok
  {
    const { ctx, pg, errs } = await open(1280, 900, 'acik');
    await toResult(pg, 't2'); await pg.click('#bKap'); await pg.waitForSelector('#kapasite table', { timeout: 60000 });
    await pg.click('[data-v=veri]'); await pg.waitForTimeout(300);
    await pg.fill('#form input[name=Q]', '90'); await pg.dispatchEvent('#form input[name=Q]', 'change'); await pg.waitForTimeout(300);
    await pg.click('[data-v=sonuc]'); await pg.waitForTimeout(800);
    const txt = await pg.$eval('#kapasite', e => e.textContent).catch(() => '');
    check(!(await pg.$('#kapasite table')) && /geçersiz/.test(txt), 'girdi değişti ama eski alternatifler gösteriliyor');
    check(!(await pg.$('#ak-W-KAP-01 .ak-motor')), 'geçersiz alternatif W-KAP-01 çözümlerinde kullanıldı');
    await toResult(pg, 'p1');
    check(!(await pg.$('#kapasite')), 'kapasite sorunu olmayan projede kart gösterildi');
    check(!errs.length, 'geçersizleşme: ' + errs.join(' | '));
    await ctx.close();
  }

  await browser.close(); srv.close();
  console.log(`\n${passes} kontrol geçti, ${fails} kontrol başarısız`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

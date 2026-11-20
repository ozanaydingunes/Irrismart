#!/usr/bin/env node
// MH-AKIL-1 — Tarayıcı testleri (T-12): Sonuç ekranındaki "Mühendislik değerlendirmesi" bölümü.
//  • Kritik (uygunsuz) uyarılar ilk sırada ve açık; diğerleri kapalı başlık.
//  • Masaüstü (1280 px) ve telefon (390 px) aynı kodları ve aynı sayıları (data-v) gösterir.
//  • Açılır paneller çalışır; yatay sayfa taşması yok; uyarı başlığı ve seçim kutusu dokunma hedefi ≥ 40 px.
//  • Açık ve koyu temada metin/zemin karşıtlığı en az 4,5:1.
//  • Hazır olmayan modüllere (karşılaştırma, harita bölme) düğme gösterilmez.
//  • Hidrolik paneldeki "Çözümler" bağlantısı ilgili uyarı kartını açar.
//  • Planlama oranı Veriler → Proje ayarları’ndan değişir, motor girdisine yazılmaz, yalnız W-KAP-02’yi etkiler.
//  • Kullanıcı kararı projeye kaydedilir ve sayfa yeniden açıldığında korunur.
// İsteğe bağlı: SHOTS=<klasör> verilirse ekran görüntüleri kaydedilir.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www'), SHOTS = process.env.SHOTS || null;
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const PROJECTS = [
  { id: 't2', name: 'test2', created: 1, updated: 2, poly: [], src: null, inp: { crop: 'domates', area_da: 288.9, srcType: 'kuyu', depth: 40, region: 'akdeniz', Q: 86.3 } },
  { id: 'p1', name: 'S01 Domates', created: 1, updated: 1, poly: [], src: null, inp: { crop: 'domates', srcType: 'kuyu', region: 'akdeniz', soil: 'tinli', area_da: 50, L: 400, W: 125, Q: 45, depth: 40 } },
  { id: 'k2', name: 'Pay', created: 1, updated: 0, poly: [], src: null, inp: { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, depth: 40, region: 'akdeniz' } },
];
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };
function lum(rgb) { const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

(async () => {
  const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const port = srv.address().port, browser = await chromium.launch();
  const open = async (w, h, theme, projs) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.route(/arcgisonline|open-meteo/, r => r.abort());
    const pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
    await pg.addInitScript(([p, th]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('irrismart.projects.v1', p); sessionStorage.setItem('seeded', '1'); } localStorage.setItem('irrigrow.theme', th); }, [JSON.stringify(projs || PROJECTS), theme]);
    await pg.goto(`http://localhost:${port}/`); await pg.waitForTimeout(1000);
    await pg.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
    return { ctx, pg, errs };
  };
  const toResult = async (pg, id) => { await pg.click('[data-v=projeler]'); await pg.waitForTimeout(200); await pg.click(`[data-open=${id}]`); await pg.waitForTimeout(400); await pg.click('[data-v=sonuc]'); await pg.waitForTimeout(800); };
  const state = pg => pg.$$eval('#akil .ak-card', cs => cs.map(c => ({ kod: c.dataset.kod, sev: c.dataset.seviye, open: c.open, v: [...c.querySelectorAll('.ak-tiles .ak-n')].map(n => n.dataset.v) })));

  // 1) Sıra, açık/kapalı, masaüstü = mobil, taşma, dokunma hedefi, hazır olmayan düğmeler
  for (const id of ['t2', 'p1']) {
    const res = {};
    for (const [w, h, tag] of [[390, 844, 'mobil'], [1280, 900, 'masaustu']]) {
      const { ctx, pg, errs } = await open(w, h, 'acik');
      await toResult(pg, id);
      const st = await state(pg); res[tag] = st;
      check(st.length > 0, `${id}/${tag}: uyarı kartı yok`);
      const order = { uygunsuz: 0, 'on-degerlendirme': 1, uyari: 2, bilgi: 3 };
      check(st.every((x, i) => !i || order[st[i - 1].sev] <= order[x.sev]), `${id}/${tag}: kritik uyarılar önce gelmiyor`);
      check(st.every(x => x.open === (x.sev === 'uygunsuz')), `${id}/${tag}: yalnız kritik uyarılar açık olmalı`);
      const ov = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth); check(ov <= 0, `${id}/${tag}: yatay taşma ${ov}px`);
      await pg.evaluate(() => document.querySelectorAll('#akil details').forEach(d => { d.open = true; }));
      const ov2 = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth); check(ov2 <= 0, `${id}/${tag}: paneller açıkken yatay taşma ${ov2}px`);
      const small = await pg.$$eval('#akil .ak-head, #akil .ak-sub > summary, #akil select', els => els.filter(e => e.getBoundingClientRect().height < 40).length);
      check(small === 0, `${id}/${tag}: ${small} dokunma hedefi 40 px’ten küçük`);
      const txt = await pg.$eval('#akil', e => e.textContent);
      // 1.0.1: "Shiftleri Düzenle" hazır bir modüle (Shift Yönetimi) gider; başka düğme/bağlantı olmamalı
      const links = await pg.$$eval('#akil a, #akil button:not([data-shiftyon])', els => els.map(e => e.textContent.trim()));
      const smb = await pg.$$eval('#akil button[data-shiftyon]', els => els.map(e => [e.dataset.shiftyon, e.getBoundingClientRect().height]));
      check(smb.every(([k, h]) => (k === 'W-HIZ-01' || k === 'W-POM-01') && h >= 36), `${id}/${tag}: Shiftleri Düzenle düğmesi yalnız W-HIZ-01/W-POM-01'de ve dokunulabilir olmalı (${JSON.stringify(smb)})`);
      check(!links.length && !/Alternatifleri karşılaştır|Haritada böl|Araziyi böl —|yakında/i.test(txt), `${id}/${tag}: hazır olmayan modüle yönlendirme var (${links.join(', ')})`);
      check(!/güvenli|onaylı|garanti/i.test(txt), `${id}/${tag}: yasaklı ifade`);
      if (id === 't2') {
        check(st[0].kod === 'W-KAP-01', 'test2: ilk uyarı W-KAP-01 değil');
        check(/Kanıtla uygunsuz/.test(txt) && /Değerlendirilmedi/.test(txt) && /alt sınır/.test(txt), 'test2: çözüm durumları/alt sınır görünmüyor');
        check(!/Hesaplandı – uygun(?!suz)/.test(await pg.$eval('#ak-W-KAP-01', e => e.textContent)), 'test2: kapasite için uygun çözüm gösterildi');
      }
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); const h2 = await pg.$eval('#v-sonuc', e => e.scrollHeight); await pg.setViewportSize({ width: w, height: Math.min(h2 + 200, 14000) }); await pg.waitForTimeout(200); await (await pg.$('#akil')).screenshot({ path: `${SHOTS}/${id}-${tag}-acik.png` }); }
      check(!errs.length, `${id}/${tag}: sayfa hatası ${errs.join(' | ')}`);
      await ctx.close();
    }
    check(JSON.stringify(res.mobil) === JSON.stringify(res.masaustu.map(x => Object.assign({}, x, { open: res.mobil.find(y => y.kod === x.kod).open }))), `${id}: masaüstü ve mobil farklı veri gösteriyor`);
  }

  // 2) Tema karşıtlığı (açık ve koyu)
  for (const theme of ['acik', 'koyu']) {
    const { ctx, pg } = await open(390, 844, theme);
    await toResult(pg, 't2');
    await pg.evaluate(() => document.querySelectorAll('#akil details').forEach(d => { d.open = true; }));
    const pairs = await pg.$$eval('#akil .ak-title, #akil .ak-neden, #akil .ak-why, #akil .ak-asm, #akil .ak-dz, #akil .ak-lv, #akil .ak-key, #akil .ak-tl, #akil .ak-need', els => els.map(e => {
      const col = getComputedStyle(e).color; let n = e, bg = 'rgba(0, 0, 0, 0)';
      while (n && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) { bg = getComputedStyle(n).backgroundColor; n = n.parentElement; }
      return [col, bg, e.className];
    }));
    const rgb = s => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    const low = pairs.filter(([c, b]) => contrast(rgb(c), rgb(b)) < 4.5);
    check(pairs.length > 20 && !low.length, `${theme}: ${low.length} öğede karşıtlık < 4,5 (${low.slice(0, 3).map(x => x[2] + ' ' + x[0] + '/' + x[1]).join('; ')})`);
    if (SHOTS) { const h2 = await pg.$eval('#v-sonuc', e => e.scrollHeight); await pg.setViewportSize({ width: 390, height: Math.min(h2 + 200, 14000) }); await pg.waitForTimeout(200); await (await pg.$('#akil')).screenshot({ path: `${SHOTS}/t2-mobil-${theme}-hepsi-acik.png` }); }
    await ctx.close();
  }

  // 3) Hidrolik paneli → "Çözümler" → ilgili kart açılır
  {
    const { ctx, pg, errs } = await open(390, 844, 'acik');
    await toResult(pg, 'p1');
    await pg.click('[data-v=hidrolik]'); await pg.waitForTimeout(600);
    const kod = await pg.$eval('#hydro [data-kod]', b => b.dataset.kod).catch(() => null);
    check(!!kod, 'Hidrolik panelde "Çözümler" bağlantısı yok');
    if (kod) {
      await pg.click(`#hydro [data-kod="${kod}"]`); await pg.waitForTimeout(700);
      const vis = await pg.$eval('#v-sonuc', e => e.classList.contains('on') || getComputedStyle(e).display !== 'none').catch(() => false);
      const isOpen = await pg.$eval(`#ak-${kod}`, e => e.open).catch(() => false);
      check(vis && isOpen, `"Çözümler" (${kod}) Sonuç ekranındaki kartı açmadı`);
    }
    check(!errs.length, 'Çözümler bağlantısı: ' + errs.join(' | '));
    await ctx.close();
  }

  // 4) Planlama oranı ve kullanıcı kararı: projeye kaydedilir, motor girdisine yazılmaz
  {
    const { ctx, pg, errs } = await open(1280, 900, 'acik');
    await toResult(pg, 'k2');
    const has = async () => !!(await pg.$('#ak-W-KAP-02'));
    const before = await has();
    await pg.click('[data-v=veri]'); await pg.waitForTimeout(400);
    await pg.fill('#planOrani', '50'); await pg.dispatchEvent('#planOrani', 'change'); await pg.waitForTimeout(300);
    await pg.click('[data-v=sonuc]'); await pg.waitForTimeout(700);
    const after = await has();
    const saved = await pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(p => p.id === 'k2'));
    check(saved.akil && saved.akil.planOrani === 0.5 && saved.inp.planOrani === undefined && saved.inp.__planOrani === undefined, 'planlama oranı projeye (motor girdisi dışında) kaydedilmedi');
    check(before === false && after === true, `W-KAP-02 oranla değişmedi (önce ${before}, sonra ${after})`);
    const sel = await pg.$('#akil select[data-onay]');
    check(!!sel, 'kullanıcı kararı seçimi yok');
    if (sel) {
      const kod = await sel.evaluate(e => e.dataset.onay);
      await sel.selectOption('kabul'); await pg.waitForTimeout(300);
      await pg.reload(); await pg.waitForTimeout(1000); await toResult(pg, 'k2');
      const v = await pg.$eval(`#akil select[data-onay="${kod}"]`, e => e.value);
      check(v === 'kabul', 'kullanıcı kararı yeniden açılışta korunmadı');
    }
    check(!errs.length, 'ayarlar: ' + errs.join(' | '));
    await ctx.close();
  }

  await browser.close(); srv.close();
  console.log(`\n${passes} kontrol geçti, ${fails} kontrol başarısız`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

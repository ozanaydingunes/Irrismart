#!/usr/bin/env node
// 1.0.1 Shift Yönetimi (A+B) — Android genişliği (390 px) ve masaüstü web (1280 px), aynı kod.
//  SH-1 Hidrolik ekranında "Shift Yönetimi" düğmesi paneli açar; masaüstünde üst çubukta da düğme var
//  SH-2 Panel: her shift için alan, hesaplanan debi, basınç, süre, pompa görev noktası ve vanalar; yatay taşma yok
//  SH-3 Önizleme: shift sayısı değişince önce/sonra tablosu motor sonucunu gösterir; Uygula'ya kadar projeye yazılmaz
//  SH-4 Çalışma sırası ↑/↓ ve hedef debi: hedef yalnız bilgi; hidrolik karşılaştırma değişmez
//  SH-5 "Haritada göster": Arazi ekranı açılır, seçili shift vurgulanır (mobilde panel küçülür, masaüstünde açık kalır)
//  SH-6 Uygula: revizyon alınır, shift sayısı/sıra/hedef kaydedilir; Geri Al önceki hâle döndürür
//  SH-7 Elle alt ünite taşıma önizlenir ve uygulanır (shiftEdit); İptal hiçbir şeyi değiştirmez
//  SH-8 W-HIZ-01 / W-POM-01 çözüm kartında "Shiftleri Düzenle" paneli açar
//  SH-9 Eski proje (yeni alanlar yok) panelde açılır; JSON yedek yeni alanları taşır
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www');
const SC = require('../test/golden/scenarios');
const S18 = SC.find(x => x.id.startsWith('S18'));
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };
const PROJ = { id: 'sy1', name: 'Shift yönetimi testi', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: S18.opt.poly, src: S18.opt.src, station: S18.opt.station, route: S18.opt.route, inp: Object.assign({}, S18.inp) };

(async () => {
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const browser = await chromium.launch();
  for (const [ad, vp] of [['390', { width: 390, height: 844 }], ['1280', { width: 1280, height: 900 }]]) {
    const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
    await pg.addInitScript(p => { if (!sessionStorage.getItem('s')) { localStorage.setItem('irrismart.projects.v1', JSON.stringify([p])); sessionStorage.setItem('s', '1'); } }, PROJ);
    await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(800);
    const P = () => pg.evaluate(() => JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0]);
    const desk = await pg.evaluate(() => document.documentElement.classList.contains('desk'));
    check(desk === (ad === '1280'), `${ad}: masaüstü düzeni ${desk}`);
    await pg.click('[data-open="sy1"]'); await pg.waitForTimeout(300);
    const git = async v => { if (desk) await pg.evaluate(v => document.querySelector(`nav.tabs [data-v=${v}]`).click(), v); else await pg.click(`nav.tabs [data-v=${v}]`); await pg.waitForTimeout(700); };
    await git('hidrolik');

    // SH-1
    check(await pg.isVisible('#bShiftYon'), `${ad} SH-1 Hidrolik ekranında Shift Yönetimi düğmesi yok`);
    if (desk) check(await pg.isVisible('#deskTools [data-dt=shift]'), `${ad} SH-1 masaüstü üst çubukta Shift Yönetimi yok`);
    await pg.click(desk ? '#deskTools [data-dt=shift]' : '#bShiftYon'); await pg.waitForTimeout(500);
    check(await pg.isVisible('#smPanel'), `${ad} SH-1 panel açılmadı`);

    // SH-2
    const kart = await pg.$$eval('#smPanel .sm-shift', a => a.map(x => x.textContent));
    const motor = await pg.evaluate(() => { const p = JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0]; const r = IrriEngine.design(p.inp, undefined, { poly: p.poly, src: p.src, station: p.station, route: p.route }); return { n: r.sel.groups.length, g0: r.sel.groups[0].length, Qj: r.sel.Qj, alts: r.sectorAlts.map(a => ({ Ns: a.Ns, Qmax: a.Qmax, rec: !!a.recommended })) }; });
    check(kart.length === motor.n && kart.every(x => /da/.test(x) && /m³\/h/.test(x) && /bar/.test(x) && /M\d/.test(x)), `${ad} SH-2 shift kartları eksik (${kart.length}/${motor.n})`);
    const tasma = await pg.evaluate(() => { const e = document.querySelector('#smPanel .sm-body'); return e.scrollWidth - e.clientWidth; });
    check(tasma <= 1, `${ad} SH-2 panel yatay taşıyor (${tasma} px)`);
    check(await pg.isVisible('#smAyni') && await pg.isDisabled('#smUygula'), `${ad} SH-2 değişiklik yokken Uygula kapalı olmalı`);

    // SH-3
    const yeni = motor.alts.find(a => !a.rec && a.Ns > motor.n) || motor.alts.find(a => !a.rec);
    await pg.selectOption('#smNs', { value: String(yeni.Ns) }); await pg.waitForTimeout(600);
    const qmax = await pg.$eval('#smPanel .sm-cmp tr[data-k=Qmax] td:nth-child(3)', e => e.textContent);
    check(await pg.isVisible('#smPanel .sm-cmp') && Math.abs(parseFloat(qmax.replace(/\./g, '').replace(',', '.')) - yeni.Qmax) < 0.01, `${ad} SH-3 önizleme en büyük debi ${qmax} ≠ ${yeni.Qmax}`);
    check((await pg.$$('#smPanel .sm-shift')).length === yeni.Ns, `${ad} SH-3 taslakta ${yeni.Ns} shift kartı olmalı`);
    check((await P()).inp.Ns == null, `${ad} SH-3 önizleme projeye yazılmamalı`);
    check(!(await pg.isDisabled('#smUygula')), `${ad} SH-3 Uygula açılmalı`);

    // SH-4
    const once = await pg.$$eval('#smPanel .sm-shift', a => a.map(x => x.dataset.j));
    await pg.click('#smPanel .sm-shift [data-dn="0"]'); await pg.waitForTimeout(200);
    const sonra = await pg.$$eval('#smPanel .sm-shift', a => a.map(x => x.dataset.j));
    check(sonra[0] === once[1] && sonra[1] === once[0], `${ad} SH-4 sıra değişmedi (${once} → ${sonra})`);
    const cmp1 = await pg.$eval('#smPanel .sm-cmp', e => e.textContent);
    await pg.fill('#smHedef', '30'); await pg.dispatchEvent('#smHedef', 'change'); await pg.waitForTimeout(200);
    check((await pg.$$('#smPanel .sm-hedef')).length === yeni.Ns, `${ad} SH-4 hedef sapması her shiftte gösterilmeli`);
    check(await pg.$eval('#smPanel .sm-cmp', e => e.textContent) === cmp1, `${ad} SH-4 hedef debi karşılaştırmayı değiştirmemeli`);

    // SH-5
    await pg.click('#smPanel [data-harita="1"]'); await pg.waitForTimeout(900);
    check(await pg.evaluate(() => document.querySelector('#v-arazi').classList.contains('on')), `${ad} SH-5 Arazi ekranı açılmadı`);
    if (desk) check(await pg.isVisible('#smPanel'), `${ad} SH-5 masaüstünde panel açık kalmalı`);
    else {
      check(!(await pg.isVisible('#smPanel')) && await pg.isVisible('#smChip') && /Shift 2/.test(await pg.textContent('#smChip')), `${ad} SH-5 mobilde panel küçülmeli, dönüş düğmesi görünmeli`);
      await pg.click('#smChip'); await pg.waitForTimeout(300);
      check(await pg.isVisible('#smPanel'), `${ad} SH-5 panele dönülmedi`);
    }
    const vurgu = await pg.evaluate(() => { const c = document.querySelector('#map canvas'); return !!c && c.width > 0; });
    check(vurgu, `${ad} SH-5 harita planı çizilmedi`);

    // SH-6
    const rev0 = ((await P()).revs || []).length;
    await pg.click('#smUygula'); await pg.waitForTimeout(900);
    let p = await P();
    check(!(await pg.isVisible('#smPanel')), `${ad} SH-6 Uygula sonrası panel kapanmalı`);
    check(Number(p.inp.Ns) === yeni.Ns && Array.isArray(p.shiftSira) && p.shiftSira.length === yeni.Ns && p.shiftHedef === 30 && p.shiftGeriAl, `${ad} SH-6 kayıt: Ns=${p.inp.Ns} sıra=${p.shiftSira} hedef=${p.shiftHedef}`);
    check((p.revs || []).length > rev0 && p.revs.some(x => x.note === 'shift yönetimi öncesi'), `${ad} SH-6 revizyon alınmadı`);
    // Raporlar çalışma sırasını taşır: PDF üretilir, Excel "Shift’ler" sayfası sıra sütunuyla ve kayıtlı sırayla
    await git('sonuc');
    const indir = async sel => { const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click(sel)]); return fs.readFileSync(await d.path()); };
    const pdf = await indir('#bPdf'), xls = await indir('#bXls');
    check(pdf.slice(0, 5).toString() === '%PDF-' && pdf.length > 20000, `${ad} SH-6 PDF üretilmedi`);
    const wb = XLSX.read(xls, { type: 'buffer' }), sh = wb.Sheets[wb.SheetNames.find(n => /Shift’ler/.test(n))];
    const satir = sh ? XLSX.utils.sheet_to_json(sh, { header: 1 }) : [];
    check(satir.length === yeni.Ns + 1 && /Çalışma sırası/.test(satir[0][0]) && satir.slice(1).map(x => x[1] - 1).join() === p.shiftSira.join(), `${ad} SH-6 Excel shift tablosu çalışma sırasıyla değil: ${JSON.stringify(satir.slice(0, 3))}`);
    const oz = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    check(oz.some(x => /Hedef shift debisi/.test(x[0]) && x[1] === 30), `${ad} SH-6 Excel özetinde hedef debi yok`);
    await git('hidrolik');
    check(await pg.isVisible('#bShiftGeri'), `${ad} SH-6 Geri Al düğmesi yok`);
    await pg.click('#bShiftGeri'); await pg.waitForTimeout(800);
    p = await P();
    check(p.inp.Ns == null && p.shiftSira == null && p.shiftHedef == null && p.shiftGeriAl == null, `${ad} SH-6 Geri Al önceki hâle dönmedi`);

    // SH-8
    await git('sonuc');
    const btn = await pg.$$('#result [data-shiftyon]');
    check(btn.length >= 1, `${ad} SH-8 W-HIZ-01/W-POM-01 kartında Shiftleri Düzenle yok`);
    if (btn.length) { await pg.evaluate(() => { const b = document.querySelector('#result [data-shiftyon]'); b.closest('details').open = true; b.closest('details.ak-card').open = true; b.click(); }); await pg.waitForTimeout(400); check(await pg.isVisible('#smPanel'), `${ad} SH-8 panel açılmadı`); await pg.click('#smIptal'); await pg.waitForTimeout(200); }

    // SH-7
    await git('hidrolik');
    await pg.click('#bShiftYon'); await pg.waitForTimeout(400);
    await pg.click('#smPanel [data-ac="0"]'); await pg.waitForTimeout(200);
    const s0 = await pg.$('#smPanel select[data-smunit]');
    const ops = await s0.$$eval('option', x => x.map(y => y.value));
    await s0.selectOption({ value: ops[ops.length - 1] }); await pg.waitForTimeout(600);
    const beklenen = motor.g0 > 1 ? motor.n + 1 : motor.n;   // tek üniteli shift boşalırsa numara sıkıştırılır
    const nk = (await pg.$$('#smPanel .sm-shift')).length, bas = await pg.textContent('#smPanel .sm-head');
    check(nk === beklenen && /elle/.test(bas), `${ad} SH-7 elle taşıma önizlenmedi (${nk} kart, beklenen ${beklenen}, ${bas})`);
    await pg.click('#smIptal'); await pg.waitForTimeout(300);
    p = await P();
    check(!(await pg.isVisible('#smPanel')) && !p.shiftEdit, `${ad} SH-7 İptal projeyi değiştirmemeli`);
    await pg.click('#bShiftYon'); await pg.waitForTimeout(400);
    await pg.click('#smPanel [data-ac="0"]'); await pg.waitForTimeout(200);
    await pg.selectOption('#smPanel select[data-smunit]', { value: ops[ops.length - 1] }); await pg.waitForTimeout(600);
    await pg.click('#smUygula'); await pg.waitForTimeout(900);
    p = await P();
    check(p.shiftEdit && p.shiftEdit.assign && Math.max(...p.shiftEdit.assign) === beklenen - 1, `${ad} SH-7 elle atama kaydedilmedi (${JSON.stringify(p.shiftEdit)})`);
    const r2 = await pg.evaluate(() => { const p = JSON.parse(localStorage.getItem('irrismart.projects.v1'))[0]; const r = IrriEngine.design(p.inp, undefined, { manual: p.shiftEdit, poly: p.poly, src: p.src, station: p.station, route: p.route }); return r.sel.manual && r.sel.groups.length; });
    check(r2 === beklenen, `${ad} SH-7 motor elle düzeni uygulamıyor`);

    // SH-9
    const yedek = await pg.evaluate(() => { const ps = JSON.parse(localStorage.getItem('irrismart.projects.v1')); ps[0].shiftSira = ps[0].shiftEdit ? null : ps[0].shiftSira; return IrriStore.readBackup(JSON.stringify(IrriStore.backupPayload(ps, {}, null))).valid[0]; });
    check(yedek && yedek.shiftEdit && yedek.shiftGeriAl, `${ad} SH-9 yedek yeni alanları taşımadı`);
    check(!errs.length, `${ad} sayfa hatası: ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`${passes} denetim geçti, ${fails} başarısız`);
  process.exit(fails ? 1 : 0);
})();

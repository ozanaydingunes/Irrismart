#!/usr/bin/env node
// 1.0.3 PR-2 — Manuel Shift düzenleme iş akışı ve Arazi Görüntüle/Düzenle ayrımı.
// Ekranlar: 390 px telefon (dokunmatik), 800×1280 tablet (dokunmatik), 1280 px masaüstü web.
// Gerçek Android WebView'un yerini tutmaz; cihaz testi ayrıca yapılmalıdır.
//  D1 Tamamlanmış parsel Arazi'de görüntüleme modunda açılır: köşe tutamağı yok, Geri/Temizle kapalı, dokunuş sınırı değiştirmez
//  D2 Açıkça "Sınır" seçilince düzenleme çalışır; "Görüntüle" ile salt okunura dönülür
//  D3 Yeni parsel çizimi bugünkü gibi (Sınır modunda açılır, dokunuş köşe ekler)
//  D4 Shift sayısı − / +: taslakta değişir, kayıt değişmez, uçlarda kapalı
//  D5 "Bu shift'e alt ünite ekle": seçili shift büyür; değerler motorla aynı; kayıt değişmez
//  D6 Önce/sonra satırları ve bulgu farkı (giderilen / yeni / devam eden)
//  D7 Haritada düzenle: fırça taslağa yazar (kayıt değişmez); Uygula kaydeder; Geri Al eski atamayı getirir
//  D8 Açık taslak varken Sınır düzenlemesine geçiş: Uygula / İptal / Vazgeç kararı
//  D9 Eski JSON (v0.6.0) projesi panelde açılır
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'www');
const LS0 = require('../test/fixtures/localstorage-v0.6.0.json');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
let fails = 0, passes = 0;
const check = (c, msg) => { if (c) passes++; else { fails++; console.log('✗ ' + msg); } };
const lat = 37.0, lng = 35.0;
const poly = [[lat, lng], [lat, lng + 0.0075], [lat + 0.0021, lng + 0.0078], [lat + 0.0027, lng + 0.0012], [lat + 0.0012, lng - 0.0006]];
const temel = { crop: 'domates', geom: 'parsel', Q: 120, srcType: 'kuyu', depth: 40, region: 'akdeniz', hours: 20 };
const eski = JSON.parse(LS0['irrismart.projects.v1']);
const PROJ = [
  { id: 'pb', name: 'Büyük parsel', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly, src: [lat - 0.0005, lng - 0.0005], station: null, route: [], inp: Object.assign({}, temel) },
  { id: 'pn', name: 'Yeni çizim', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [], src: null, station: null, route: [], inp: Object.assign({}, temel) },
  { id: 'ps', name: 'S01', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [], src: null, inp: { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, srcType: 'kuyu', depth: 40, region: 'akdeniz', slopeLong: 0, slopeShort: 0, hours: 20 } },
  // Cihaz testi hatası: kayıtlı Ns (9) motorun otomatik aday aralığının (18–25) dışında; − ile 9'a dönünce 18'e atlıyordu
  { id: 'p9', name: '225 da · 9 shift', created: 1, updated: 2, schema: 2, rev: 0, revs: [], poly: [[36.9, 30.7], [36.9, 30.7105], [36.9021, 30.7112], [36.9035, 30.706], [36.903, 30.7005]], src: [36.8996, 30.6996], station: [36.8998, 30.6998], route: [[36.8999, 30.7]],
    inp: { crop: 'domates', geom: 'parsel', Q: 90, srcType: 'kuyu', depth: 40, region: 'akdeniz', soil: 'tinli', hours: 20, Ns: 9 } },
  ...eski,
];
const EKRAN = [
  ['390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
  ['tablet', { viewport: { width: 800, height: 1280 }, isMobile: true, hasTouch: true }],
  ['1280', { viewport: { width: 1280, height: 860 } }],
];

(async () => {
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const browser = await chromium.launch();
  for (const [ad, opt] of EKRAN) {
    const ctx = await browser.newContext(opt);
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
    await pg.addInitScript(([ps, ls]) => { if (!sessionStorage.getItem('s')) { for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); localStorage.setItem('irrismart.projects.v1', JSON.stringify(ps)); sessionStorage.setItem('s', '1'); } }, [PROJ, LS0]);
    await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(900);
    const desk = await pg.evaluate(() => document.documentElement.classList.contains('desk'));
    const dokun = async sel => { if (opt.hasTouch) await pg.tap(sel); else await pg.click(sel); };
    const nokta = async (x, y) => { if (opt.hasTouch) await pg.touchscreen.tap(x, y); else await pg.mouse.click(x, y); };
    const git = async v => { await pg.evaluate(v => document.querySelector(`nav.tabs [data-v=${v}]`).click(), v); await pg.waitForTimeout(900); };
    const ac = async (id, v) => { await git('projeler'); await dokun(`[data-open="${id}"]`); await pg.waitForTimeout(300); await git(v); await pg.waitForTimeout(800); };
    const P = id => pg.evaluate(id => JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(p => p.id === id), id);
    // Tasarım verisi: hesap girdisi, geometri ve shift kayıtları (ekran sekmesi ve olağan hesap revizyonları hariç)
    const TAS = ['inp', 'poly', 'src', 'station', 'route', 'shiftEdit', 'shiftEditEski', 'shiftEditYedek', 'shiftSira', 'shiftHedef', 'shiftGeriAl', 'drawPos'];
    const tasarim = async id => { const p = await P(id); return JSON.stringify(TAS.map(k => p[k] === undefined ? null : p[k])); };
    const mod = () => pg.$eval('#mModes button.on', b => b.dataset.m).catch(() => null);
    const bosta = () => pg.waitForFunction(() => { const p = document.querySelector('#smPanel'); return !p || p.getAttribute('aria-busy') !== 'true'; }, null, { timeout: 30000 });
    const harita = () => pg.$eval('#map', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, pk: e.dataset.planKutu ? JSON.parse(e.dataset.planKutu) : null }; });

    // ---------- D1 Görüntüleme modu ----------
    await ac('pb', 'arazi'); await pg.waitForTimeout(800);
    const p0 = JSON.stringify((await P('pb')).poly);
    check(await mod() === 'gor', `${ad} D1 tamamlanmış parsel görüntüleme modunda açılmalı (${await mod()})`);
    check((await pg.$$('#map .vtx')).length === 0 && await pg.isDisabled('#mUndo') && await pg.isDisabled('#mClear'), `${ad} D1 köşe tutamağı yok, Geri/Temizle kapalı`);
    let h = await harita();
    // Parsel dışı ve içi dokunuşlar
    for (const [x, y] of [[h.x + 30, h.y + h.h * 0.6], [h.x + h.w - 30, h.y + h.h * 0.7], [h.x + (h.pk.x0 + h.pk.x1) / 2, h.y + (h.pk.y0 + h.pk.y1) / 2]]) {
      await nokta(x, y); await pg.waitForTimeout(350);
      if (await pg.$('#ssSheet')) { await dokun('#ssX'); await pg.waitForTimeout(200); }
    }
    check(JSON.stringify((await P('pb')).poly) === p0, `${ad} D1 görüntüleme modunda dokunuş parseli değiştirmemeli`);
    // Kaynak ve köşe sürükleme yok: kaynak işaretçisi sürüklenemez
    check(await pg.$eval('#map .srcm', e => !e.classList.contains('leaflet-marker-draggable')).catch(() => true), `${ad} D1 kaynak işaretçisi sürüklenemez`);

    // ---------- D2 Açık düzenleme ----------
    await dokun('#mModes [data-m=sinir]'); await pg.waitForTimeout(500);
    check(await mod() === 'sinir' && (await pg.$$('#map .vtx')).length === 5 && !(await pg.isDisabled('#mUndo')), `${ad} D2 Sınır seçilince tutamaklar ve Geri açılır`);
    await nokta(h.x + 30, h.y + h.h * 0.6); await pg.waitForTimeout(400);
    check((await P('pb')).poly.length === 6, `${ad} D2 düzenleme modunda dokunuş köşe ekler`);
    await dokun('#mUndo'); await pg.waitForTimeout(400);
    check(JSON.stringify((await P('pb')).poly) === p0, `${ad} D2 Geri ile eklenen köşe kaldırılır`);
    await dokun('#mModes [data-m=gor]'); await pg.waitForTimeout(400);
    check(await mod() === 'gor' && (await pg.$$('#map .vtx')).length === 0, `${ad} D2 Görüntüle'ye dönülür`);

    // ---------- D3 Yeni parsel çizimi ----------
    await ac('pn', 'arazi'); await pg.waitForTimeout(600);
    check(await mod() === 'sinir', `${ad} D3 boş parselde çizim modu (${await mod()})`);
    h = await harita();
    for (const [fx, fy] of [[0.3, 0.3], [0.7, 0.3], [0.6, 0.6]]) { await nokta(h.x + h.w * fx, h.y + h.h * fy); await pg.waitForTimeout(300); }
    check((await P('pn')).poly.length === 3, `${ad} D3 yeni parsel köşeleri eklenir (${(await P('pn')).poly.length})`);

    // ---------- D4 − / + ----------
    await ac('pb', 'hidrolik');
    const kayit = await tasarim('pb');
    await dokun('#bShiftYon'); await pg.waitForSelector('#smPanel'); await pg.waitForTimeout(300);
    const n0 = +(await pg.textContent('#smNsN'));
    await dokun('#smNsArti'); await bosta(); await pg.waitForTimeout(200);
    check(+(await pg.textContent('#smNsN')) === n0 + 1 && (await pg.$$('#smPanel .sm-shift')).length === n0 + 1, `${ad} D4 + shift sayısını artırır`);
    await dokun('#smNsArti'); await bosta(); await pg.waitForTimeout(200);
    check(+(await pg.textContent('#smNsN')) === n0 + 2, `${ad} D4 + ikinci kez`);
    await dokun('#smNsEksi'); await bosta(); await pg.waitForTimeout(200);
    check(+(await pg.textContent('#smNsN')) === n0 + 1, `${ad} D4 − shift sayısını azaltır`);
    for (let i = 0; i < 12 && !(await pg.isDisabled('#smNsEksi')); i++) { await dokun('#smNsEksi'); await bosta(); }
    check(await pg.isDisabled('#smNsEksi'), `${ad} D4 en az seçenekte − kapalı`);
    check(await tasarim('pb') === kayit, `${ad} D4 taslak kaydı değiştirmez`);
    await dokun('#smIptal'); await pg.waitForTimeout(300);
    check(await tasarim('pb') === kayit, `${ad} D4 İptal kaydı değiştirmez`);

    // ---------- D5 Bu shift'e alt ünite ekle + D6 karşılaştırma ----------
    await dokun('#bShiftYon'); await pg.waitForSelector('#smPanel'); await pg.waitForTimeout(300);
    const sec = await pg.$eval('#smPanel .sm-shift.on', e => +e.dataset.j);
    const ops = await pg.$$eval('#smPanel select[data-smekle] option', o => o.map(x => x.value).filter(Boolean));
    await pg.selectOption('#smPanel select[data-smekle]', { value: ops[0] }); await bosta(); await pg.waitForTimeout(200);
    const k = +ops[0];
    const vanalar = await pg.$eval(`#smPanel .sm-shift.on`, e => e.textContent);
    check(new RegExp(`M${k + 1}\\b`).test(vanalar), `${ad} D5 M${k + 1} seçili shift'e eklendi`);
    const sat = await pg.$$eval('#smPanel .sm-cmp tr[data-k]', rs => Object.fromEntries(rs.map(r => [r.dataset.k, [r.children[1].textContent, r.children[2].textContent]])));
    const gerek = ['secAlan', 'secQ', 'Qmax', 'pompaQ', 'pompaH', 'vMain', 'hfKritik', 'tur', 'kWh', 'gunlukSu', 'uygunluk'];
    check(gerek.every(x => sat[x]), `${ad} D6 önce/sonra satırları (${gerek.filter(x => !sat[x])})`);
    const sayi = s => parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
    check(sayi(sat.secAlan[1]) > sayi(sat.secAlan[0]), `${ad} D5 seçili shift alanı büyüdü (${sat.secAlan})`);
    const motor = await pg.evaluate(([k, j]) => { const p = JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(x => x.id === 'pb');
      const st = JSON.parse(localStorage.getItem('irrismart.settings.v1') || 'null') || undefined, o = { poly: p.poly, src: p.src, station: p.station, route: p.route };
      const r0 = IrriEngine.design(p.inp, st, o), a = IrriShiftYonetimi.ataTasi(IrriShiftYonetimi.atamaOf(r0), k, j);
      const r = IrriEngine.design(p.inp, st, Object.assign({ manual: { sig: r0.layout.sig, assign: a } }, o));
      return { Qmax: r.sectors.Qsec, tur: r.schedule.cycleHours, alan: IrriShiftYonetimi.geoAlan(r, IrriGeom).shift[a[k]] }; }, [k, sec]);
    check(Math.abs(sayi(sat.Qmax[1]) - motor.Qmax) < 0.006 && Math.abs(sayi(sat.tur[1]) - motor.tur) < 0.051 && Math.abs(sayi(sat.secAlan[1]) - motor.alan) < 0.006, `${ad} D5 değerler motorla aynı (${sat.Qmax[1]} / ${motor.Qmax})`);
    check(await pg.isVisible('#smBulgu') && (await pg.$$('#smBulgu ul[data-grup]')).length === 3, `${ad} D6 bulgu farkı üç grup`);
    check(await tasarim('pb') === kayit, `${ad} D5 taslak kaydı değiştirmez`);
    await dokun('#smIptal'); await pg.waitForTimeout(300);

    // D6 giderilen / yeni (S01: 12 shift'te W-HIZ-01 ve W-POM-01 giderilir, W-KAP-01 oluşur)
    await ac('ps', 'hidrolik'); await dokun('#bShiftYon'); await pg.waitForSelector('#smPanel');
    await pg.selectOption('#smNs', { value: '12' }); await bosta(); await pg.waitForTimeout(200);
    const gid = await pg.$$eval('#smBulgu ul[data-grup=giderilen] li[data-kod]', a => a.map(x => x.dataset.kod)), yeni = await pg.$$eval('#smBulgu ul[data-grup=yeni] li[data-kod]', a => a.map(x => x.dataset.kod));
    // Aynı modüller ve aynı proje ayarlarıyla sayfada hesaplanan resmî fark (ayarlar eski yedekten gelir)
    const bek = await pg.evaluate(() => { const p = JSON.parse(localStorage.getItem('irrismart.projects.v1')).find(x => x.id === 'ps'), st = JSON.parse(localStorage.getItem('irrismart.settings.v1') || 'null') || undefined, SY = IrriShiftYonetimi;
      const oz = i => { const r = IrriEngine.design(i, st, {}); return SY.ozet(r, IrriHydroView.build(r, { inp: i, Qsource: i.Q }), IrriAssess.forProject(Object.assign({}, p, { inp: i }), r), IrriGeom); };
      const f = SY.bulguFarki(oz(p.inp), oz(Object.assign({}, p.inp, { Ns: 12 }))); return { g: f.giderilen.map(x => x.kod).sort(), y: f.yeni.map(x => x.kod).sort() }; });
    check(JSON.stringify(gid.slice().sort()) === JSON.stringify(bek.g) && JSON.stringify(yeni.slice().sort()) === JSON.stringify(bek.y) && yeni.includes('W-KAP-01'), `${ad} D6 giderilen ${gid} / yeni ${yeni} — beklenen ${bek.g} / ${bek.y}`);
    check(await pg.$eval('#smPanel .sm-cmp tr[data-k=uygunluk]', e => e.className) === 'sm-kotu', `${ad} D6 teknik uygunluk satırı kötüleşmeyi gösterir`);
    await dokun('#smIptal'); await pg.waitForTimeout(300);

    // ---------- D7 Haritada düzenle → taslak; Uygula; Geri Al ----------
    await ac('pb', 'hidrolik'); await dokun('#bShiftYon'); await pg.waitForSelector('#smPanel'); await pg.waitForTimeout(300);
    await dokun('#smPanel [data-hduz="0"]'); await pg.waitForTimeout(2000);
    check(await pg.evaluate(() => document.querySelector('#v-arazi').classList.contains('on')) && await mod() === 'shift' && /taslak/.test(await pg.textContent('#mShiftBar')), `${ad} D7 harita taslak düzenleme modunda`);
    h = await harita();
    let B = JSON.parse(await pg.$eval('#map', e => e.dataset.birimler || '[]'));
    // Masaüstünde sağdaki Shift Yönetimi çekmecesinin altında kalan bölge dokunulamaz: görünür alandan seç
    const sag = desk ? await pg.$eval('#smPanel', e => e.getBoundingClientRect().left).catch(() => h.x + h.w) : h.x + h.w;
    const hedef = B.find(b => b.s !== 0 && b.x > 20 && b.y > 20 && h.x + b.x < sag - 20 && b.y < h.h - 20);
    check(!!hedef, `${ad} D7 ekranda başka shift'e ait alt ünite var`);
    if (hedef) {
      await nokta(h.x + hedef.x, h.y + hedef.y); await pg.waitForTimeout(2500);
      B = JSON.parse(await pg.$eval('#map', e => e.dataset.birimler || '[]'));
      check((B.find(b => b.k === hedef.k) || {}).s === 0, `${ad} D7 dokunulan alt ünite (M${hedef.k + 1}) taslakta Shift 1'e taşındı`);
      check(await tasarim('pb') === kayit, `${ad} D7 haritada düzenleme kaydı (tasarım verisi) değiştirmez`);
      await dokun(desk ? '#mPanel' : '#smChip'); await pg.waitForTimeout(600);
      check(await pg.isVisible('#smPanel') && await pg.$eval('#smMod [data-smmod=manuel]', e => e.classList.contains('on')), `${ad} D7 panele dönüş, taslak elle`);
      await dokun('#smUygula'); await pg.waitForTimeout(1500);
      const pu = await P('pb');
      check(pu.shiftEdit && pu.shiftEdit.assign[hedef.k] === 0 && pu.shiftGeriAl, `${ad} D7 Uygula atamayı kaydeder`);
      await git('hidrolik'); await dokun('#bShiftGeri'); await pg.waitForTimeout(1200);
      const pg2 = await P('pb');
      check(!pg2.shiftEdit && !pg2.shiftGeriAl, `${ad} D7 Geri Al önceki (otomatik) atamaya döner`);
    }

    // ---------- D8 Açık taslak + Sınır düzenlemesi ----------
    for (const secim of ['#mkVazgec', '#mkIptal']) {
      await git('hidrolik'); await dokun('#bShiftYon'); await pg.waitForSelector('#smPanel'); await dokun('#smNsArti'); await bosta();
      await dokun('#smPanel [data-harita="0"]'); await pg.waitForTimeout(1800);
      const once = await tasarim('pb');
      await dokun('#mModes [data-m=sinir]'); await pg.waitForTimeout(300);
      check(await pg.isVisible('#mKarar'), `${ad} D8 taslak varken Sınır'a geçişte karar sorulur`);
      await dokun(secim); await pg.waitForTimeout(500);
      if (secim === '#mkVazgec') {
        check(!(await pg.$('#mKarar')) && await mod() !== 'sinir', `${ad} D8 Vazgeç: mod değişmez`);
        if (!desk) await dokun('#smChip'); await pg.waitForTimeout(300); await dokun('#smIptal'); await pg.waitForTimeout(300);
      } else {
        check(!(await pg.$('#smPanel')) && await mod() === 'sinir' && await tasarim('pb') === once, `${ad} D8 İptal: taslak atılır, Sınır modu açılır, kayıt aynı`);
        await dokun('#mModes [data-m=gor]'); await pg.waitForTimeout(300);
      }
    }

    // ---------- D10 Cihaz testi hatası: − / + başlangıç sayısına geri döner (9 → 18 → 9; 18'e atlamaz) ----------
    await ac('p9', 'hidrolik'); await dokun('#bShiftYon'); await pg.waitForSelector('#smPanel'); await pg.waitForTimeout(300);
    const k9 = await tasarim('p9');
    check(await pg.textContent('#smNsN') === '9', `${ad} D10 başlangıç 9 shift`);
    await dokun('#smNsArti'); await bosta(); await pg.waitForTimeout(200);
    const arti = await pg.textContent('#smNsN');
    await dokun('#smNsEksi'); await bosta(); await pg.waitForTimeout(200);
    const kartSay = (await pg.$$('#smPanel .sm-shift')).length;
    check(+arti > 9 && await pg.textContent('#smNsN') === '9' && kartSay === 9 && await pg.isDisabled('#smUygula'), `${ad} D10 + (${arti}) sonra − ile 9'a dönülür; taslak başlangıçla aynı (${await pg.textContent('#smNsN')})`);
    const op9 = await pg.$$eval('#smPanel select[data-smekle] option', o => o.map(x => x.value).filter(Boolean));
    await pg.selectOption('#smPanel select[data-smekle]', { value: op9[0] }); await bosta(); await pg.waitForTimeout(200);
    const n9 = +(await pg.textContent('#smNsN'));
    check(n9 === 9 || n9 === 8, `${ad} D10 alt ünite ekleme 9 shift'lik düzen üzerinden (${n9})`);
    check(await tasarim('p9') === k9, `${ad} D10 kayıt değişmedi`);
    await dokun('#smIptal'); await pg.waitForTimeout(300);

    // ---------- D11 Arazi'den doğrudan erişim ----------
    await ac('pb', 'arazi'); await pg.waitForTimeout(800);
    check(await pg.isVisible('#ssTut'), `${ad} D11 Arazi'de Shiftler tutamağı görünür`);
    const tutAlt = await pg.$eval('#ssTut', e => e.getBoundingClientRect().bottom), barUst = await pg.$eval('#v-arazi .mapbar', e => e.getBoundingClientRect().top);
    check(tutAlt <= barUst + 1, `${ad} D11 tutamak harita alt çubuğunu örtmez (${tutAlt} / ${barUst})`);
    await dokun('#mModes [data-m=shift]'); await pg.waitForTimeout(500);
    await dokun('#mShiftBar [data-b="2"]'); await pg.waitForTimeout(300);
    await dokun('#ssTut'); await pg.waitForSelector('#ssSheet'); await pg.waitForTimeout(300);
    check(await pg.$eval('.ss-chip.on', e => e.dataset.ssj) === '2', `${ad} D11 Shift modunda tutamak seçili fırçanın shift'ini (3) açar`);
    await dokun('#ssX'); await pg.waitForTimeout(300);
    check(await pg.isVisible('#mSY'), `${ad} D11 Shift çubuğunda Shift Yönetimi düğmesi`);
    await dokun('#mSY'); await pg.waitForSelector('#smPanel'); await pg.waitForTimeout(300);
    check(await pg.$eval('#smPanel .sm-shift.on', e => e.dataset.j) === '2', `${ad} D11 Shift Yönetimi aynı shift seçili açılır`);

    // ---------- D12 Shift başına hedef debi: taslak → Uygula; Geri Al ----------
    await pg.fill('#smPanel input[data-smhedefj="2"]', '55,5'); await pg.dispatchEvent('#smPanel input[data-smhedefj="2"]', 'change'); await pg.waitForTimeout(300);
    check(/55,50/.test(await pg.$eval('#smPanel .sm-shift.on', e => e.textContent)) && !(await pg.isDisabled('#smUygula')), `${ad} D12 shift 3 hedefi taslakta gösterilir`);
    check(!(await P('pb')).shiftHedefler, `${ad} D12 taslak kaydı değiştirmez`);
    await dokun('#smUygula'); await pg.waitForTimeout(1200);
    const ph = await P('pb');
    check(ph.shiftHedefler && ph.shiftHedefler.deger['2'] === 55.5, `${ad} D12 Uygula shift hedefini kaydeder (${JSON.stringify(ph.shiftHedefler)})`);
    check(JSON.stringify(ph.inp) === JSON.stringify(PROJ[0].inp) && !ph.shiftEdit, `${ad} D12 hedef hesap girdisini değiştirmez`);
    await git('hidrolik'); await dokun('#bShiftGeri'); await pg.waitForTimeout(1000);
    check(!(await P('pb')).shiftHedefler, `${ad} D12 Geri Al hedefi kaldırır`);

    // ---------- D9 Eski JSON projesi ----------
    const eskiId = eski[0].id;
    await ac(eskiId, 'hidrolik');
    if (await pg.$('#bShiftYon')) {
      await dokun('#bShiftYon'); await pg.waitForSelector('#smPanel'); await pg.waitForTimeout(300);
      check(+(await pg.textContent('#smNsN')) >= 1 && (await pg.$$('#smPanel .sm-shift')).length >= 1, `${ad} D9 eski proje panelde açılır`);
      await dokun('#smIptal'); await pg.waitForTimeout(200);
    } else check(false, `${ad} D9 eski projede Shift Yönetimi düğmesi yok`);
    check(JSON.stringify((await P(eskiId)).inp) === JSON.stringify(eski[0].inp), `${ad} D9 eski proje girdileri değişmedi`);
    check(!errs.length, `${ad} sayfa hatası: ${errs.join(' | ')}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`Shift düzenleme: ${passes} denetim geçti, ${fails} başarısız`);
  process.exit(fails ? 1 : 0);
})();

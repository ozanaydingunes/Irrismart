// MH-AKIL-2 — Otomatik shift ve kaynak kapasitesi alternatifleri (docs/mh-akil-2-plan.md §7).
// Her alternatif gerçek hesap motoruyla hesaplanır; bu dosya bulunan değerlerin motorla doğrulandığını,
// oran yönteminin kullanılmadığını, uygun olmayan alternatiflerin önerilmediğini ve üç hacmin ayrı
// tutulduğunu denetler.
const XLSX = require('xlsx');
const { E, test, ok, near, W } = require('./_lib');
const AS = require(W('assess.js')), S = require(W('solver.js')), AV = require(W('assess-view.js'));
const RD = require(W('report-data.js')), St = require(W('store.js'));
const SC = require('./golden/scenarios');

const T2 = { crop: 'domates', area_da: 288.9, srcType: 'kuyu', depth: 40, region: 'akdeniz', Q: 86.3 };
const base = E.design(T2);
const res = S.runSync(base, T2, null, {}, { k: 0.9 });
const byId = id => res.rows.find(x => x.id === id);
const des = (o) => E.design(Object.assign({}, T2, o));
const proj = (inp, extra) => Object.assign({ id: 'p1', name: 'test2', inp, poly: [], src: null }, extra || {});

test('S-1 test2: mevcut süreyle en küçük kaynak debisi motorla uygun, 0,1 m³/h altı uygunsuz; oran yöntemi yok', () => {
  const k = byId('kaynak');
  ok(k && k.girdi && k.kapasiteUygun && k.enKucuk, 'kaynak alternatifi bulunamadı');
  const r = des({ Q: k.girdi.Q }), rb = des({ Q: k.altQ });
  ok(r.sel.feasible && S.capacityOk(r, k.girdi.Q, 20), 'bulunan debi motorla uygun değil');
  ok(!S.capacityOk(rb, k.altQ, 20), '0,1 m³/h altı da uygun');
  near(k.altQ, Math.round((k.girdi.Q - 0.1) * 10) / 10, 1e-9, 'doğrulama adımı');
  near(k.cycle, r.sel.cycleHours, 1e-12, 'satır motor sonucundan gelmiyor');
  // Gruplama kuralı: Nmax = ⌊H·I/t⌋ shift'e sığmak için gereken en büyük grup debisi
  ok(k.nmax === Math.floor(20 * 1 / base.schedule.t + 1e-9), 'Nmax');
  ok(k.girdi.Q >= k.qPartition - 1e-9 && k.girdi.Q - k.qPartition < 0.1 + 1e-9, `debi gruplama kuralının üst yuvarlaması değil (${k.girdi.Q} / ${k.qPartition})`);
  const ratio = base.sel.cycleHours / base.sel.avail * 86.3;
  const nums = []; JSON.stringify(res, (key, v) => { if (typeof v === 'number') nums.push(v); return v; });
  ok(!nums.some(v => Math.abs(v - ratio) < 0.5), `oran yöntemi değeri (${ratio.toFixed(1)}) üretildi`);
});

test('S-2 yalnız shift değişimi: motorun bütün alternatifleri uygunsuz; alt sınır kanıtı geçerli', () => {
  const sh = res.shift;
  ok(sh.kanit && sh.nsLB === Math.ceil(base.sectors.Qfield / 86.3 - 1e-9), 'alt sınır');
  ok(sh.liste.length === base.sectorAlts.filter(a => !a.manual).length && sh.liste.every(x => !x.feasible), 'shift alternatifleri');
  near(sh.cycLB, sh.nsLB * base.schedule.t, 1e-12, 'tur alt sınırı');
});

test('S-3 süre: test2’de 24 h kanıtla uygunsuz ve motorun 24 h sonucu gösterilir', () => {
  const s = byId('sure');
  ok(s && s.kanit && s.hNeed > 24 && s.girdi.H === 24 && s.durum === 'uygunsuz', 'süre satırı');
  const r = des({ hours: 24 }); near(s.cycle, r.sel.cycleHours, 1e-12, 'motor sonucu'); near(s.avail, 24, 1e-12, 'sınır');
});

test('S-4 kaynak + süre: her süre için bulunan debi motorla uygun, 0,1 altı uygunsuz', () => {
  const ks = res.rows.filter(x => x.aile === 'kaynak-sure');
  ok(ks.length >= 2 && ks.every(x => x.girdi.H > 20), 'kaynak + süre satırı yok');
  for (const x of ks) {
    ok(x.kapasiteUygun && S.capacityOk(des({ Q: x.girdi.Q, hours: x.girdi.H }), x.girdi.Q, x.girdi.H), `${x.id}: uygun değil`);
    ok(!S.capacityOk(des({ Q: x.altQ, hours: x.girdi.H }), x.altQ, x.girdi.H), `${x.id}: 0,1 altı da uygun`);
  }
  ok(ks[ks.length - 1].girdi.Q <= byId('kaynak').girdi.Q, 'daha uzun süreyle daha az debi gerekmeli');
});

test('S-5 aralık: motor sonucu; tur ve sınır birlikte değişir, oran sabit', () => {
  const ar = res.rows.filter(x => x.aile === 'aralik');
  ok(ar.length >= 1, 'aralık satırı yok');
  for (const x of ar) {
    ok(x.girdi.I <= base.schedule.Imax && x.girdi.I !== base.schedule.interval, 'aralık seçimi');
    near(x.cycle / x.avail, base.sel.cycleHours / base.sel.avail, 0.02, 'tur/sınır oranı aralıkla değişmemeli');
    ok(x.durum === 'uygunsuz', 'test2’de aralık kapasiteyi çözmemeli');
  }
  ok(res.notes.some(n => n.kod === 'aralik-imax' && n.Imax === base.schedule.Imax), 'Imax notu');
});

test('S-6 kritik uyarısı açık alternatif "uygun" sayılmaz; görünümde önerilmez', () => {
  for (const x of res.rows.filter(y => y.girdi)) {
    if (x.durum === 'uygun') ok(x.kapasiteUygun && !x.acik.length, `${x.id}: açık uyarıyla uygun`);
    if (x.kapasiteUygun && x.acik.length) ok(x.durum === 'kapasite-uygun', `${x.id}: durum`);
  }
  ok(!res.rows.some(x => x.durum === 'uygun'), 'test2’de (W-PN-02/W-SD-01 açık) uygun alternatif olmamalı');
  const html = AV.make({}).alternatives(S.pack(proj(T2), base, res));
  ok(/Bütün zorunlu kontrolleri sağlayan alternatif bulunamadı/.test(html) && !/[Öö]nerilen/.test(html.replace(/önerilmez/g, '')), 'görünüm uygun olmayanı öneriyor');
  const A = AS.forProject(proj(T2, { akil: { alternatifler: S.pack(proj(T2), base, res) } }), base);
  const f = A.findings.find(x => x.kod === 'W-KAP-01');
  ok(!f.cozumler.some(c => c.durum === 'hesaplandi-uygun'), 'kritik uyarı açıkken çözüm uygun gösterildi');
  ok(f.cozumler.filter(c => c.motor && c.kalan).every(c => /kesin çözüm olarak önerilmez/.test(c.kalan.t)), 'kalan kritik uyarılar yazılmalı');
});

test('S-7 üç hacim ayrı: eksik yerleşim ihtiyacı azaltmaz; kaynak brüt ihtiyacı da karşılamalı', () => {
  const v = res.hacim0;
  near(v.ihtiyac, base.schedule.gross * base.field.A / 1000, 1e-9, 'brüt ihtiyaç');
  near(v.uygulanan, base.sectors.Qfield * base.schedule.t / base.schedule.interval, 1e-9, 'uygulanan');
  ok(v.kapsama < 1 && v.kapsama > 0.98, 'kapsama oranı');
  // Yapay durum: motor turu sığıyor ama hedef alan daha büyük (ör. yarısı damlatıcısız) → uygun sayılmamalı
  const ok1 = E.design({ crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, depth: 40, region: 'akdeniz' });
  ok(ok1.sel.feasible && S.capacityOk(ok1, 45, 20), 'temel senaryo uygun olmalı');
  const fake = JSON.parse(JSON.stringify(ok1)); fake.field.A = ok1.field.A * 3;   // ihtiyaç üç katı (1.246 > 900 m³/gün), uygulanan aynı
  const vv = S.volumes(fake, 45, 20);
  ok(vv.kaynak < vv.ihtiyac && fake.sel.feasible && !S.capacityOk(fake, 45, 20), 'kapsama eksikliği ihtiyacı düşürdü');
});

test('S-8 çözümleyici motor sonucunu değiştirmez; motor kodu çağrılır, kopyalanmaz', () => {
  const before = JSON.stringify(base); S.runSync(base, T2, null, {}, {}); ok(JSON.stringify(base) === before, 'temel sonuç değişti');
  const src = require('fs').readFileSync(W('solver.js'), 'utf8');
  ok(/\.design\b/.test(src) && !/hazen|colebrook|watters|Math\.pow\(.*1\.852/i.test(src), 'çözümleyici hidrolik bağıntı içermemeli');
  ok(res.calistirma > 0 && res.calistirma < 40, `çalıştırma sayısı ${res.calistirma}`);
});

test('S-9 kayıt: özet projeye yazılır, JSON yedekten döner; girdi değişince geçersiz olur', () => {
  const p = proj(T2); p.akil = { alternatifler: S.pack(p, base, res) };
  ok(S.valid(p, base), 'yeni kayıt geçersiz');
  const back = St.readBackup(JSON.stringify(St.backupPayload([p], {}, null, new Date(0)))).valid[0];
  ok(S.valid(back, base) && JSON.stringify(back.akil.alternatifler) === JSON.stringify(p.akil.alternatifler), 'yedekten dönmedi');
  const q = JSON.parse(JSON.stringify(p)); q.inp.Q = 90; const rq = E.design(q.inp);
  ok(!S.valid(q, rq), 'girdi değişti ama kayıt geçerli sayıldı');
  const A = AS.forProject(q, rq); ok(!A.findings.find(x => x.kod === 'W-KAP-01').cozumler.some(c => c.motor), 'geçersiz kayıt kullanıldı');
  ok(JSON.stringify(S.runSync(base, T2, null, {}, {}).rows.map(x => x.girdi)) === JSON.stringify(res.rows.map(x => x.girdi)), 'sonuç tekrarlanabilir değil');
});

test('S-10 tutarlılık: geçerli özetle Sonuç, PDF ve Excel aynı çözüm durumlarını gösterir', () => {
  const p = proj(T2); p.akil = { alternatifler: S.pack(p, base, res) };
  const A = AS.forProject(p, base), f = A.findings.find(x => x.kod === 'W-KAP-01');
  const kq = f.cozumler.find(c => c.tur === 'kaynak');
  ok(kq.motor && kq.durum === 'hesaplandi-uygunsuz' && near(kq.motor.Q, byId('kaynak').girdi.Q, 1e-12, 'Q') === undefined, 'kaynak çözümü motor sonucu taşımıyor');
  ok(f.cozumler.filter(c => c.tur === 'kaynak').length === 1 + res.rows.filter(x => x.aile === 'kaynak-sure').length, 'kaynak + süre çözümleri');
  const html = AV.make({}).render(A);
  ok(html.includes(`data-v="${byId('kaynak').girdi.Q}"`), 'Sonuç ekranında motor debisi yok');
  const TB = RD.build(p, base), fx = TB.akil.findings.find(x => x.kod === 'W-KAP-01');
  ok(JSON.stringify(fx.sols.slice(1).map(r => r[1])) === JSON.stringify(f.cozumler.map(c => AS.DURUM_AD[c.durum] + (c.asama && c.durum === 'degerlendirilmedi' ? ' (' + c.asama + ')' : ''))), 'PDF çözüm durumları farklı');
  const wb = XLSX.read(XLSX.write(RD.workbook(XLSX, p, base), { bookType: 'xlsx', type: 'buffer' }), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Uyarılar'], { header: 1, defval: null }).filter(x => x[0] === 'W-KAP-01' && x[6]);
  ok(rows.length === f.cozumler.length && rows.every((x, i) => x[7].startsWith(AS.DURUM_AD[f.cozumler[i].durum])), 'Excel çözüm durumları farklı');
  // Kayıt yokken çıktı MH-AKIL-1 ile aynı (altın kayıtlar değişmez)
  const A0 = AS.forProject(proj(T2), base); ok(!A0.findings.find(x => x.kod === 'W-KAP-01').cozumler.some(c => c.motor), 'kayıt yokken motor sonucu var');
});

test('S-11 bütün kapasite sorunlu altın senaryolarda çözümleyici tutarlı sonuç verir', () => {
  for (const sc of SC.filter(s => !s.opt)) {
    const r = E.design(sc.inp); if (!r.ok || r.sel.feasible) continue;
    const out = S.runSync(r, sc.inp, null, {}, {});
    for (const x of out.rows.filter(y => y.girdi && y.aile !== 'mevcut')) {
      ok(['uygun', 'kapasite-uygun', 'uygunsuz'].includes(x.durum), `${sc.id}: durum`);
      if (x.aile === 'kaynak' || x.aile === 'kaynak-sure') ok(x.kapasiteUygun && x.girdi.Q > Number(sc.inp.Q), `${sc.id}: ${x.id}`);
    }
  }
});

test('S-13 kapasite ekranındaki ve çözümlerdeki bütün metinlerin 7 dilde çevirisi var', () => {
  const D = require(W('i18n-dict.js')), used = new Set(), seen = new Set();
  const t = (s, p) => { used.add(s); return p ? s.replace(/\{(\w+)\}/g, (m, k) => (p[k] !== undefined ? p[k] : m)) : s; };
  const walk = o => { if (!o || typeof o !== 'object') return; if (typeof o.t === 'string' && 'p' in o) seen.add(o.t); Object.values(o).forEach(walk); };
  const p = proj(T2, {}); p.akil = { alternatifler: S.pack(p, base, res) };
  const A = AS.forProject(p, base); walk(A);
  const V = AV.make({ t }); V.render(A); V.alternatives(p.akil.alternatifler); V.alternatives(null, { stale: true }); V.alternatives(null, { running: true, done: 2 });
  const skip = new Set(['PN', 'Kc', 'Kr', 'm', 'h', 'kW', 'kWh', 'm³', 'm³/h', '%', 'gün', 'Shift', '']);
  const miss = [...new Set([...used, ...seen])].filter(k => !skip.has(k) && !/^[\d\s.,:/()%×÷=≤≥<>+–—-]*$/.test(k)).filter(k => !['en', 'de', 'es', 'ru', 'it', 'he', 'zh'].every(l => D[k] && D[k][l]));
  ok(!miss.length, `${miss.length} eksik çeviri: ` + miss.slice(0, 5).join(' | '));
});

// Faz 1 denetim bulguları: basınç sınıfı, kot farkı, su darbesi, bağımsız Darcy karşılaştırması, veri güvenliği
const { E, Hy, CAT, Ct, test, near, ok, W } = require('./_lib');
const St = require(W('store.js'));
const base = { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 60, srcType: 'kuyu', depth: 10, region: 'akdeniz' };
const nu = 1.004e-6;
const JDW = (Qls, dmm) => { const d = dmm / 1000, v = Qls / 1000 / (Math.PI * d * d / 4), Re = v * d / nu; const f = Re < 2000 ? 64 / Re : 0.25 / Math.log10(1.5e-6 / (3.7 * d) + 5.74 / Re ** 0.9) ** 2; return 100 * f * v * v / (2 * 9.81 * d); };

test('Watters-Keller, Darcy-Weisbach (Swamee-Jain) ile %10 içinde uyumlu (türbülanslı akış)', () => {
  for (const d of [13.6, 20, 51.4, 96.8, 141]) for (const v of [0.5, 1, 1.5, 2]) {
    const Q = v * Math.PI * (d / 2000) ** 2 * 1000; const r = Hy.jSmooth(Q, d) / JDW(Q, d);
    ok(Math.abs(r - 1) < 0.10, `Ø${d} v=${v}: oran ${r.toFixed(3)}`);
  }
});

test('Katalogda PN16 PE100 (SDR11) ve PVC-U (EN 1452) var; iç çap = dış çap − 2·et; PN16 fiyatı PN10’dan yüksek', () => {
  const pe = CAT.borular.pe.filter(p => p.pn === 16), pvc = CAT.borular.pvc.filter(p => p.pn === 16);
  ok(pe.length >= 10 && pvc.length >= 10, 'PN16 kayıtları eksik');
  for (const p of [...pe, ...pvc]) near(p.ic, p.od - 2 * p.et, 0.051, `${p.id} iç çap`);
  near(CAT.borular.pe.find(p => p.id === 'pe-110-pn16').ic, 90, 1e-9, 'PE100 Ø110 PN16 iç çap');
  const s = { pvc: { 110: 100 }, pe: { 110: 100 }, edited: {} };
  ok(Ct.priceOf(s, 'pvc:110:16').v > Ct.priceOf(s, 'pvc:110:10').v && Ct.priceOf(s, 'pe:110:16').v > Ct.priceOf(s, 'pe:110:10').v, 'PN16 örnek fiyat çarpanı');
});

test('Kot olarak aşağıdaki arazi: en alçak noktadaki statik basınç PN seçimine girer, regülatör uyarısı verilir', () => {
  const flat = E.design(base), down = E.design(Object.assign({}, base, { dZ: -60 }));
  ok(flat.ok && down.ok, 'tasarım');
  ok(flat.main.sel.pn === 6, 'düz arazide PN6 yeterli');
  ok(down.main.sel.pn >= 10, `60 m aşağıdaki arazide PN${down.main.sel.pn} seçildi`);
  ok(down.main.sel.pn * 10.2 >= 1.25 * down.main.sel.Pop, 'PN ≥ 1,25 × en alçak nokta basıncı');
  ok(down.warn.some(w => /basınç düşürücü|regülatör/.test(w)), 'fazla basınç uyarısı yok');
});

test('Kuyuda pompa her zaman gerekir; kot farkı ne olursa olsun basma yüksekliği ≥ dinamik seviye + istasyon kayıpları', () => {
  const r = E.design(Object.assign({}, base, { dZ: -60 }));
  ok(r.pump.need, 'kuyudan cazibe ile su alınamaz');
  r.sel.main.sel.Hp.forEach((h, j) => ok(h >= 10 + r.sel.Hfix[j] - 1e-9, `shift ${j + 1}: ${h}`));
  ok(!/NaN/.test(r.pump.text), 'pompa metninde NaN');
});

test('Cazibeli yüzey kaynağı: pompa gerekmez metni sayısal ve doğru', () => {
  const r = E.design(Object.assign({}, base, { srcType: 'yuzey', depth: 0, dZ: -80 }));
  ok(r.ok, r.err); ok(!r.pump.need, 'pompa gerekmemeli'); ok(!/NaN/.test(r.pump.text) && /cazibe/.test(r.pump.text), r.pump.text);
});

test('Su darbesi: Joukowsky dalga hızı ve ΔH = a·v/g; uyarı her projede verilir', () => {
  const r = E.design(Object.assign({}, base, { depth: 40 }));
  const m = r.main.sel, s = r.surge;
  const a = Math.sqrt(2.19e9 / 998 / (1 + 2.19e9 * m.pipe.ic / (3.0e9 * m.pipe.et)));
  near(s.a, a, 1e-9, 'dalga hızı'); ok(s.a > 250 && s.a < 500, `PVC için dalga hızı makul değil: ${s.a}`);
  near(s.dH, a * m.v / 9.81, 1e-9, 'ΔH'); near(s.Tc, 2 * r.main.Lmain / a, 1e-9, 'kritik süre');
  ok(r.warn.some(w => /Su darbesi ayrıntılı analiz edilmedi/.test(w)), 'su darbesi uyarısı');
});

test('Su hacmi dengesi: tur hacmi (Σ debi × süre) ≈ brüt ihtiyaç × aralık × alan (%5)', () => {
  for (const inp of [Object.assign({}, base, { depth: 40 }), { crop: 'zeytin', area_da: 200, Q: 80, srcType: 'yuzey', region: 'ege' }]) {
    const r = E.design(inp), s = r.schedule;
    const a = r.sectors.Qfield * s.t, b = s.gross * s.interval * r.field.A / 1000;
    ok(Math.abs(a / b - 1) < 0.05, `${inp.crop}: ${a.toFixed(0)} / ${b.toFixed(0)} m³`);
  }
});

test('Depolama: bozuk JSON silinmez, kurtarma verisi döner', () => {
  const r = St.parseProjects('{bozuk');
  ok(r.corrupt && r.rescue === '{bozuk' && r.projects.length === 0, 'bozuk veri kurtarılmadı');
});

test('Depolama: geçersiz kayıtlar ayrılır, geçerliler şema 2’ye taşınır ve alanları korunur', () => {
  const old = [{ id: 'a1', name: 'Bahçe', inp: { crop: 'zeytin', area_da: 12 }, poly: [[1, 2]], hydro: { fields: [] }, updated: 5 }, { name: 'idsiz' }, null];
  const r = St.parseProjects(JSON.stringify(old));
  ok(r.projects.length === 1 && r.dropped === 2 && r.migrated, 'ayırma/migrasyon');
  const p = r.projects[0];
  ok(p.schema === St.SCHEMA && p.rev === 1 && Array.isArray(p.revs) && p.created === 5, 'şema alanları');
  ok(p.name === 'Bahçe' && p.inp.area_da === 12 && p.poly[0][1] === 2 && Array.isArray(p.hydro.fields), 'mevcut alanlar korunmadı');
  ok(JSON.parse(r.rescue).length === 2, 'geçersiz kayıtlar kurtarma verisinde');
  const again = St.parseProjects(JSON.stringify(r.projects)); ok(!again.migrated, 'migrasyon tekrar çalışmamalı');
});

test('Revizyon geçmişi: aynı veri tekrar kaydedilmez, en fazla 20 revizyon, geri yükleme çalışır, kopya yeni kimlik alır', () => {
  const p = St.migrateProject({ id: 'x', inp: { area_da: 1 } });
  St.snapshot(p); St.snapshot(p); ok(p.revs.length === 1, 'aynı veri iki kez');
  for (let i = 2; i <= 30; i++) { p.inp = { area_da: i }; St.snapshot(p); }
  ok(p.revs.length === 20 && p.revs[19].rev === p.rev, 'revizyon sınırı');
  const target = p.revs[5].rev, want = JSON.parse(p.revs[5].data).inp.area_da;
  ok(St.restoreRev(p, target) && p.inp.area_da === want, 'geri yükleme');
  const c = St.duplicate(p, 'kopya'); ok(c.id !== p.id && c.revs.length === 0 && c.inp.area_da === want, 'kopya');
});

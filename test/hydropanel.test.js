// MH-1 — Profesyonel hidrolik paneli: görünüm modeli ve çizim testleri.
// (1) Panel motor sonuçlarını değiştirmez ve kendi hidrolik hesabı yapmaz: ekrandaki her sayı görünüm modelinden,
//     görünüm modelindeki her hidrolik büyüklük motor sonucundan gelir.
// (2) Basınç dökümü motorun H değerine, shift enerjileri yıllık enerjiye eşittir.
// (3) Henüz hesaplanmayan büyüklükler (Darcy-Weisbach, düğüm basıncı, pompa BEP) sonuç olarak gösterilmez.
// (4) Bütün sekme ve shift ekranları 18 altın senaryonun hepsinde hatasız çizilir; metinler 7 dilde çevrilidir.
const fs = require('fs');
const { E, test, ok, near, W } = require('./_lib');
const HV = require(W('hydro-view.js')), HP = require(W('hydro-panel.js'));
const DICT = require(W('i18n-dict.js'));
const SC = require('./golden/scenarios');

const cases = SC.map(sc => { const r = E.design(sc.inp, null, sc.opt || {}); return { sc, r, vm: HV.build(r, { inp: sc.inp, Qsource: sc.inp.Q }) }; });
function renderAll(vm, t) {
  const P = HP.make({ t: t || (x => x) }), out = [];
  for (const [tab] of HP.TABS) {
    if (tab === 'shift') vm.shift.details.forEach((_, j) => out.push([tab + ':' + (j + 1), P.render(vm, { tab, shift: j })]));
    else out.push([tab, P.render(vm, { tab })]);
  }
  return out;
}
const dataV = html => [...html.matchAll(/data-v="([^"]+)"/g)].map(m => Number(m[1]));

test('Panel: 18 senaryoda görünüm modeli kurulur, sayılar sonlu, 8 sekme ve her shift ekranı çizilir', () => {
  for (const { sc, vm } of cases) {
    ok(vm.ok, `${sc.id}: görünüm modeli kurulamadı`);
    const bad = HV.numbers(vm).filter(([, v]) => !Number.isFinite(v));
    ok(!bad.length, `${sc.id}: sonlu olmayan değer ${bad.slice(0, 3).map(x => x[0]).join(', ')}`);
    const pages = renderAll(vm);
    ok(pages.length === 7 + vm.shift.details.length, `${sc.id}: sekme sayısı`);
    for (const [name, html] of pages) ok(html.includes('hp-tabs') && !/undefined|NaN/.test(html), `${sc.id} ${name}: bozuk çıktı`);
  }
});

test('Panel: ekrandaki her sayı görünüm modelinden gelir (çizici kendi değerini üretmez)', () => {
  for (const { sc, vm } of cases) {
    const allowed = new Set(HV.numbers(vm).map(([, v]) => v));
    for (const [name, html] of renderAll(vm)) {
      const extra = dataV(html).filter(v => !allowed.has(v));
      ok(!extra.length, `${sc.id} ${name}: modelde olmayan sayı ${extra.slice(0, 5).join(', ')}`);
    }
  }
});

test('Panel: değerler motor sonucuyla aynı (debi, shift, H, pompa, enerji, uzunluklar)', () => {
  for (const { sc, r, vm } of cases) {
    const k = Object.fromEntries(vm.ozet.kpis.map(x => [x.label, x.v]));
    ok(k['Sistem debisi'] === r.sectors.Qfield && k['Eşzamanlı debi'] === r.sel.Qmax && k['Shift sayısı'] === r.sectors.Ns, `${sc.id}: özet kartları`);
    ok(k['Yıllık enerji'] === (r.pump.kWh || 0), `${sc.id}: yıllık enerji`);
    vm.shift.details.forEach((d, j) => {
      ok(d.Q === r.sel.Qj[j] && d.H === r.main.sel.H[j] && d.Hp === r.main.sel.Hp[j] && d.surplus === r.main.sel.surplus[j], `${sc.id} shift ${j + 1}: debi/H`);
      ok(JSON.stringify(d.units) === JSON.stringify(r.sel.groups[j].map(q => 'M' + (q + 1))), `${sc.id} shift ${j + 1}: üniteler`);
    });
    ok(vm.anahat.table.rows.length === r.main.net.length && vm.anahat.table.rows.every((x, i) => x.cells[0] === r.main.net[i].id && x.cells[7] === r.main.net[i].v && x.cells[8] === r.main.net[i].hf), `${sc.id}: ana hat kesitleri`);
    ok(vm.manifold.table.rows.every((x, q) => x.cells[4] === r.units[q].Q && x.cells[10] === r.units[q].varH && x.cells[11] === r.units[q].hIn), `${sc.id}: manifold tablosu`);
  }
});

test('Panel: shift basınç dökümü motorun gerekli H değerine eşit; shift enerjileri yıllık enerjiye eşit', () => {
  for (const { sc, r, vm } of cases) {
    vm.shift.details.forEach((d, j) => {
      near(d.breakdownSum, r.main.sel.H[j], 1e-9, `${sc.id} shift ${j + 1}: döküm toplamı`);
      near(d.breakdown.reduce((a, x) => a + x.v, 0), r.main.sel.H[j], 1e-9, `${sc.id} shift ${j + 1}: döküm satırları`);
    });
    if (r.pump.need) near(r.pump.shiftKWh.reduce((a, b) => a + b, 0), r.pump.kWh, 1e-6 * r.pump.kWh, `${sc.id}: shift enerjileri`);
  }
});

test('Panel: Darcy-Weisbach, düğüm basıncı ve pompa BEP değeri gösterilmez (yalnız "hesaplanmıyor" notu)', () => {
  for (const { sc, vm } of cases) {
    const keys = HV.numbers(vm).map(([p]) => p.toLowerCase());
    ok(!keys.some(p => /\.(dw|darcy|bep|nodep|pnode|hgl)\b/.test(p)), `${sc.id}: modelde yasak büyüklük`);
    for (const [name, html] of renderAll(vm)) {
      const plain = html.replace(/<p class="hp-later">[^<]*<\/p>/g, '').replace(/<details class="hp-method">[\s\S]*?<\/details>/g, '');
      ok(!/Darcy|BEP|Düğüm basınç/.test(plain), `${sc.id} ${name}: hesaplanmayan büyüklük sonuç gibi görünüyor`);
    }
  }
});

test('Panel: jenerik pompa "temsili" etiketlidir; uyarı düzeyleri sembol + metin taşır', () => {
  const { vm } = cases[0], P = HP.make({ t: x => x });
  ok(vm.pompa.temsili && vm.checks.some(c => c.title === 'Temsili pompa'), 'jenerik pompa uyarısı');
  const html = P.render(vm, { tab: 'ozet' });
  for (const l of ['Uygunsuz', 'Sınırda', 'Uygun']) ok(new RegExp(`<span class="hp-b hp-\\w+"><svg[^>]*aria-hidden="true">[\\s\\S]*?</svg>${l}</span>`).test(html), `${l} rozeti sembol + metin değil`);
});

test('Panel: masaüstü ve mobil aynı işaretlemeyi kullanır (çizici ekran boyutundan bağımsız)', () => {
  const src = fs.readFileSync(W('hydro-panel.js'), 'utf8');
  ok(!/innerWidth|matchMedia|screen\.|clientWidth/.test(src), 'çizici ekran boyutuna bakmamalı; düzen yalnız CSS ile değişir');
  const { vm } = cases[0], P = HP.make({ t: x => x });
  ok(P.render(vm, { tab: 'anahat' }) === P.render(vm, { tab: 'anahat' }), 'aynı girdiyle aynı çıktı');
});

test('Panel: bütün panel metinlerinin 7 dilde çevirisi var', () => {
  const SYM = new Set(['%', 'bar', 'da', 'h', 'ha', 'kW', 'kWh', 'l/h', 'm', 'm/s', 'mm', 'm³', 'm³/h', 's', '×', '₺', '₺/kWh', 'ΔH', 'Kc', 'ET₀']);
  const keys = new Set(), t = x => { keys.add(x); return x; };
  for (const { vm } of cases) renderAll(vm, t);
  const miss = [];
  for (const k of keys) if (!SYM.has(k)) for (const l of ['en', 'de', 'es', 'ru', 'it', 'he', 'zh']) if (!(DICT[k] && DICT[k][l])) miss.push(`${l}: ${k}`);
  ok(!miss.length, `${miss.length} eksik çeviri:\n  ` + miss.slice(0, 20).join('\n  '));
});

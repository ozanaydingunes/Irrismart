// MH-AKIL-1 — Yapılandırılmış mühendislik uyarıları ve çözüm önerileri (docs/mh-akil-1-plan.md §8).
// Uyarı katmanı motoru değiştirmez ve yeniden çalıştırmaz; bütün sayılar motor sonucundan gelir. Bu dosya:
// T-1..T-4 test2 benzeri kapasite sorunu, T-5 yanlış alarm ve kod kümesi kaydı, T-6 kayıp uyarı yok,
// T-7 Sonuç / Hidrolik / PDF / Excel tutarlılığı, T-8 "uygun" yalnız hesaplanmış çözümde, T-9 su darbesi dili,
// T-10 proje saklama ve gerçek JSON yedeği, T-13 planlama oranı ayrımı, T-14 sulama aralığı.
const fs = require('fs'), path = require('path');
const XLSX = require('xlsx');
const { E, test, ok, near, W } = require('./_lib');
const AS = require(W('assess.js')), AV = require(W('assess-view.js'));
const HV = require(W('hydro-view.js')), HP = require(W('hydro-panel.js'));
const RD = require(W('report-data.js')), St = require(W('store.js'));
const SC = require('./golden/scenarios');
const LS = require('./fixtures/localstorage-v0.6.0.json');
const KODLAR = path.join(__dirname, 'fixtures', 'assess-kodlar.json');

// test2'ye benzer proje (kullanıcının ekran görüntüsündeki 288,9 da / 86,3 m³/h)
const T2 = { crop: 'domates', area_da: 288.9, srcType: 'kuyu', depth: 40, region: 'akdeniz', Q: 86.3 };
const proj = (inp, extra) => Object.assign({ id: 'p-' + Math.random().toString(36).slice(2, 7), name: 'Test', inp, poly: [], src: null }, extra || {});
const fmt = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v.toLocaleString('tr-TR', { minimumFractionDigits: d ?? 1, maximumFractionDigits: d ?? 1 }) : '—';
const tx = x => AS.text(x, (s, p) => p ? s.replace(/\{(\w+)\}/g, (m, k) => (p[k] !== undefined ? p[k] : m)) : s, fmt);
const allText = A => { const out = []; const walk = o => { if (!o || typeof o !== 'object') return; if (typeof o.t === 'string' && 'p' in o) out.push(tx(o)); for (const v of Object.values(o)) walk(v); }; walk(A.findings); return out.join('\n'); };
const sol = (f, tur, pred) => f.cozumler.filter(c => c.tur === tur && (!pred || pred(c)));
const cases = SC.map(sc => { const r = E.design(sc.inp, null, sc.opt || {}); const p = proj(sc.inp, { id: sc.id, poly: (sc.opt || {}).poly || [] }); return { sc, r, p, A: r.ok ? AS.forProject(p, r) : null }; });

// ---------- T-1 .. T-4: test2 ----------
test('T-1 test2: W-KAP-01 üretilir; değerler motor alanlarıyla birebir aynı', () => {
  const r = E.design(T2), A = AS.forProject(proj(T2), r), f = A.findings.find(x => x.kod === 'W-KAP-01');
  ok(f && f.seviye === 'uygunsuz', 'W-KAP-01 yok');
  ok(A.findings[0].seviye === 'uygunsuz', 'kritik uyarı ilk sırada değil');
  near(f.durum[0].deger, r.sel.cycleHours, 1e-12, 'tur süresi');
  near(f.sinir.deger, r.sel.avail, 1e-12, 'kullanılabilir süre');
  near(f.durum.find(q => q.ad.t === 'Kaynak debisi').deger, 86.3, 1e-12, 'kaynak debisi');
  near(A.kapasite.Vd, r.sectors.Qfield * r.schedule.t / r.schedule.interval, 1e-9, 'günlük ihtiyaç = ΣQ·t/I');
  ok(f.kisaGerekce && /çözmüyor/.test(f.kisaGerekce.t), '"yalnız shift değişimi çözmüyor" notu yok');
});

test('T-2 test2: yalnız shift değişimi — motorun her alternatifi hesaplandı-uygunsuz, çözüm kanıtla uygunsuz', () => {
  const r = E.design(T2), f = AS.forProject(proj(T2), r).findings.find(x => x.kod === 'W-KAP-01');
  const s = sol(f, 'shift')[0];
  ok(s.durum === 'kanitla-uygunsuz', `shift çözümü ${s.durum}`);
  const auto = r.sectorAlts.filter(a => !a.manual);
  ok(s.tablo.length === auto.length, 'alternatif tablosu motor listesinden farklı');
  s.tablo.forEach((row, i) => { ok(row.Ns === auto[i].Ns && row.cycle === auto[i].cycleHours && row.durum === 'hesaplandi-uygunsuz', `Ns ${row.Ns}`); });
  // Alt sınır: her gruplamada en az ⌈ΣQ/Qs⌉ shift; tur ≥ bu × t
  ok(Math.ceil(r.sectors.Qfield / 86.3) * r.schedule.t > r.sel.avail, 'kanıt koşulu sağlanmıyor');
});

test('T-3 test2: süre kanıtla uygunsuz; kaynak yalnız alt sınır ve değerlendirilmedi; oran yöntemi (132) üretilmez', () => {
  const r = E.design(T2), A = AS.forProject(proj(T2), r), f = A.findings.find(x => x.kod === 'W-KAP-01');
  const sure = sol(f, 'sure')[0], kay = sol(f, 'kaynak')[0];
  ok(sure.durum === 'kanitla-uygunsuz' && A.kapasite.Hreq > 24, 'süre çözümü');
  ok(kay.durum === 'degerlendirilmedi' && kay.asama === 'MH-AKIL-2', 'kaynak çözümü uygun gösterilmemeli');
  near(kay.gerekce.p.q[0], A.kapasite.Vd / r.schedule.hoursPerDay, 1e-9, 'kaynak alt sınırı = günlük ihtiyaç ÷ H');
  ok(/alt sınır/.test(kay.gerekce.t) && /mutlak bir değer değil/.test(kay.gerekce.t), 'alt sınır olduğu yazılmıyor');
  const ratio = r.sel.cycleHours / r.sel.avail * 86.3;          // ≈ 132,5 — yanlış yöntem
  const nums = []; JSON.stringify(A, (k, v) => { if (typeof v === 'number') nums.push(v); return v; });
  ok(!nums.some(v => Math.abs(v - ratio) < 0.5), `oran yöntemiyle bulunan değer (${ratio.toFixed(1)}) çıktıda var`);
  ok(!f.cozumler.some(c => c.durum === 'hesaplandi-uygun'), 'test2’de kapasite sorunu için uygun çözüm gösterildi (hiçbiri motorla hesaplanmadı)');
});

test('T-4 test2: bölme — aynı kaynakla kanıtla uygunsuz, ek kaynakla veri gerekli', () => {
  const f = AS.forProject(proj(T2), E.design(T2)).findings.find(x => x.kod === 'W-KAP-01');
  const b = sol(f, 'bolme');
  ok(b.length === 2 && b[0].durum === 'kanitla-uygunsuz' && b[1].durum === 'veri-gerekli', 'bölme durumları');
  ok(b[1].gerekenVeri.length === 3 && b[1].asama === 'MH-AKIL-3', 'ek kaynak verileri listelenmeli');
  ok(b[0].hedef === null && b[1].hedef === null, 'hazır olmayan modüle yönlendirme olmamalı');
});

test('T-14 sulama aralığı: I > Imax su stresi; I ≤ Imax "bu varsayımlarla yetersiz"; toprak girilmemişse veri gerekli', () => {
  for (const soil of [undefined, 'killi']) {
    const inp = Object.assign({}, T2, soil ? { soil } : {}), r = E.design(inp), s = r.schedule;
    const f = AS.forProject(proj(inp), r).findings.find(x => x.kod === 'W-KAP-01'), ar = sol(f, 'aralik');
    ok(ar.length >= 2 && !ar.some(c => c.gerekce.p.i === String(s.interval)), 'aralık seçenekleri');
    for (const c of ar) {
      const I = Number(c.gerekce.p.i);
      if (I > s.Imax) ok(c.durum === (soil ? 'hesaplandi-uygunsuz' : 'veri-gerekli') && /stres/.test(c.gerekce.t), `I=${I} su stresi`);
      else { ok(c.durum === 'varsayimla-yetersiz' && c.varsayim && /depolama yok/.test(c.varsayim.t), `I=${I} varsayım`); near(c.gerekce.p.d[0], Math.max(0, f.ayrinti.kapasite.deficit), 1e-9, 'günlük açık aralıktan bağımsız'); }
      if (!soil) ok(c.gerekenVeri.some(v => /Toprak sınıfı/.test(v.t)), 'toprak verisi istenmeli');
    }
    ok(f.ayrinti.unsurlar.some(q => q.ad.t === 'Kolay alınabilir su (RAW)') && f.ayrinti.unsurlar.some(q => q.ad.t === 'Kök derinliği'), 'aralık unsurları');
    ok(!ar.some(c => c.durum === 'kanitla-uygunsuz'), 'aralık seçenekleri toplu olarak kanıtla uygunsuz ilan edilmemeli');
  }
});

// ---------- T-5, T-6, T-8: bütün altın senaryolar ----------
test('T-5 yanlış alarm yok; senaryo başına uyarı kodu kümesi kayıtla aynı', () => {
  const now = {};
  for (const { sc, r, A } of cases) {
    if (!A) continue;
    const kodlar = A.findings.map(x => x.kod + ':' + x.seviye).sort(); now[sc.id] = kodlar;
    ok(A.findings.some(x => x.kod === 'W-KAP-01') === (!r.sel.feasible || !r.sectorAlts.filter(a => !a.manual).some(a => a.feasible)), `${sc.id}: W-KAP-01 koşulu`);
    for (const c of A.checks.filter(c => c.level === 'ok')) ok(!A.findings.some(x => x.kod === c.kod && x.seviye === 'uygunsuz'), `${sc.id}: ${c.kod} kontrolü uygun ama uyarı var`);
  }
  if (process.env.KAYIT) fs.writeFileSync(KODLAR, JSON.stringify(now, null, 1) + '\n');
  const rec = JSON.parse(fs.readFileSync(KODLAR, 'utf8'));
  ok(JSON.stringify(rec) === JSON.stringify(now), 'uyarı kodu kümesi değişti (bilinçli ise KAYIT=1 ile yenileyin):\n' + Object.keys(now).filter(k => JSON.stringify(rec[k]) !== JSON.stringify(now[k])).join(', '));
});

test('T-6 kayıp uyarı yok: her motor uyarısı eşleşir ya da "Diğer hesap notları"nda', () => {
  for (const { sc, r, A } of cases.concat([{ sc: { id: 'test2' }, r: E.design(T2) }].map(c => Object.assign(c, { A: AS.forProject(proj(T2), c.r) })))) {
    if (!A) continue;
    ok(A.matched.length + A.other.length === r.warn.length, `${sc.id}: ${r.warn.length} uyarıdan ${A.matched.length + A.other.length} tanesi gösteriliyor`);
    const seen = new Set(A.matched.map(m => m.i)); ok(seen.size === A.matched.length, 'aynı metin iki kez eşleşti');
    for (const x of A.findings) if (AS.COVERS[x.kod] && x.kod !== 'W-KAP-03') ok(A.matched.some(m => m.kod === x.kod), `${sc.id}: ${x.kod} uyarısı var ama motor metni yok (koşullar farklı)`);
    for (const m of A.matched) ok(AS.COVERS[m.kod].some(re => re.test(r.warn[m.i])), 'eşleşme düzeni');
  }
});

test('T-8 "Hesaplandı – uygun" yalnız motorun hesapladığı alternatiflerde', () => {
  const extra = [T2, Object.assign({}, T2, { Q: 160 }), { crop: 'domates', area_da: 50, Q: 45, hours: 6 }].map(inp => { const r = E.design(inp); return { r, A: AS.forProject(proj(inp), r) }; });
  for (const { r, A } of cases.filter(c => c.A).concat(extra)) {
    for (const x of A.findings) for (const c of x.cozumler) {
      if (c.durum !== 'hesaplandi-uygun') continue;
      ok(['shift', 'boru'].includes(c.tur), `${x.kod}: ${c.tur} çözümü hesaplanmadan uygun gösterildi`);
      if (c.tur === 'shift') ok(r.sectorAlts.some(a => c.baslik.p.n === String(a.Ns)), 'shift alternatifi motorda yok');
      if (c.tur === 'boru') ok(r.main.alts.some(a => c.baslik.p.od === String(a.od) && c.baslik.p.pn === String(a.pn)), 'çap alternatifi motorda yok');
      ok(c.kapsam, 'kontrol kapsamı yazılmalı');
    }
    for (const x of A.findings) for (const c of x.cozumler) ok(AS.DURUM.includes(c.durum), 'bilinmeyen durum ' + c.durum);
  }
});

// ---------- T-9: su darbesi ----------
test('T-9 su darbesi: ön değerlendirme ve geçici rejim ibaresi var; "güvenli/onaylı/garanti" yok', () => {
  for (const { sc, A } of cases.filter(c => c.A)) {
    const f = A.findings.find(x => x.kod === 'W-SD-01');
    ok(f && f.onDegerlendirme, `${sc.id}: W-SD-01 yok`);
    const all = tx(f.onem) + tx(f.neden) + f.cozumler.map(c => tx(c.baslik) + tx(c.gerekce)).join(' ');
    ok(all.includes(AS.ON_DEG) && all.includes(AS.TRANSIENT), `${sc.id}: zorunlu ibareler`);
    ok(f.cozumler.every(c => c.durum !== 'hesaplandi-uygun'), 'su darbesi çözümü uygun gösterildi');
    ok(!/güvenli|onaylı|onaylanmış|garanti/i.test(allText(A)), `${sc.id}: yasaklı ifade`);
  }
  const html = AV.make({}).render(cases[0].A) + JSON.stringify(RD.build(cases[0].p, cases[0].r).akil.findings);
  ok(!/güvenli|onaylı|garanti/i.test(html), 'ekran/rapor metninde yasaklı ifade');
});

// ---------- T-7: tutarlılık ----------
test('T-7 Sonuç, Hidrolik, PDF ve Excel aynı kodları, seviyeleri ve değerleri gösterir', () => {
  const lv = { bad: ['uygunsuz'], warn: ['uyari', 'on-degerlendirme'] };
  const all = cases.filter(c => c.A).concat([(() => { const p = proj(T2), r = E.design(T2); return { sc: { id: 'test2' }, p, r, A: AS.forProject(p, r) }; })()]);
  for (const { sc, p, r, A } of all) {
    // Sonuç ekranı
    const html = AV.make({}).render(A);
    for (const x of A.findings) {
      ok(html.includes(`data-kod="${x.kod}"`) && html.includes(`data-seviye="${x.seviye}"`), `${sc.id}: Sonuç ekranında ${x.kod} yok`);
      for (const q of x.durum.concat(x.sinir ? [x.sinir] : [])) if (typeof q.deger === 'number') ok(html.includes(`data-v="${q.deger}"`), `${sc.id}: ${x.kod} değeri ${q.deger} Sonuç ekranında yok`);
    }
    // Hidrolik panel: aynı nesne; uygun olmayan her kontrolün uyarısı aynı seviyede
    const vm = HV.build(r, { inp: p.inp, Qsource: p.inp.Q, assess: A });
    ok(vm.assess === A && vm.checks.length === A.checks.length, 'panel farklı değerlendirme kullanıyor');
    const vm2 = HV.build(r, { inp: p.inp, Qsource: p.inp.Q, k: AS.planK(p) });
    ok(JSON.stringify(vm2.checks) === JSON.stringify(vm.checks), 'panel kendi başına farklı kontrol üretiyor');
    for (const c of vm.checks.filter(c => c.level !== 'ok')) { const f = A.findings.find(x => x.kod === c.kod); ok(f && lv[c.level].includes(f.seviye), `${sc.id}: panel ${c.kod} (${c.level}) ↔ Sonuç ${f && f.seviye}`); }
    const panel = HP.make({}).render(vm, { tab: 'ozet' });
    for (const c of vm.checks.filter(c => c.level !== 'ok')) ok(panel.includes(`>${c.kod}<`), `${sc.id}: panelde ${c.kod} kodu yok`);
    // PDF (rapor tablosu) ve Excel
    const TB = RD.build(p, r);
    ok(JSON.stringify(TB.akil.findings.map(x => x.kod + x.seviye)) === JSON.stringify(A.findings.map(x => x.kod + x.seviye)), `${sc.id}: PDF uyarıları farklı`);
    TB.akil.findings.forEach((x, i) => A.findings[i].durum.forEach((q, k) => ok(x.kv[k][1] === q.deger, `${sc.id}: PDF ${x.kod} değeri`)));
    const wb = XLSX.read(XLSX.write(RD.workbook(XLSX, p, r), { bookType: 'xlsx', type: 'buffer' }), { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Uyarılar'], { header: 1, defval: null });
    const xl = rows.slice(1).filter(x => x[1] && x[2]);
    ok(JSON.stringify(xl.map(x => x[0])) === JSON.stringify(A.findings.map(x => x.kod)), `${sc.id}: Excel uyarı kodları farklı`);
    xl.forEach((x, i) => { const d = A.findings[i].durum[0]; if (d && typeof d.deger === 'number') near(x[3], d.deger, 1e-12, `${sc.id}: Excel ${x[0]} değeri`); });
    ok(rows.filter(x => x[1] === 'Diğer hesap notu').length === A.other.length, `${sc.id}: Excel diğer notlar`);
    ok(wb.SheetNames.includes('Varsayımlar'), 'Varsayımlar sayfası korunmalı');
    // "Hesaplandı – uygun" satırları raporlarda da kontrol kapsamıyla birlikte yazılır
    const okRows = TB.akil.findings.flatMap(x => x.sols.slice(1)).filter(r => r[1] === 'Hesaplandı – uygun');
    ok(okRows.every(r => /Kontrol edilenler/.test(r[2])), `${sc.id}: PDF'te uygun çözümün kapsamı yazılmamış`);
    ok(rows.filter(x => x[7] === 'Hesaplandı – uygun').every(x => /Kontrol edilenler/.test(x[8])), `${sc.id}: Excel'de uygun çözümün kapsamı yazılmamış`);
  }
});

// ---------- T-13: planlama oranı ----------
test('T-13 planlama oranı yalnız W-KAP-02’yi etkiler; motor sonucu ve W-KAP-01 değişmez', () => {
  let seen = false;
  for (const { sc, r, p } of cases.filter(c => c.A)) {
    const base = JSON.stringify(E.design(sc.inp, null, sc.opt || {}).sel.cycleHours);
    const res = [0.5, 0.9, 1].map(k => AS.forProject(Object.assign({}, p, { akil: { planOrani: k } }), r));
    ok(JSON.stringify(r.sel.cycleHours) === base, 'motor sonucu değişti');
    const strip = A => JSON.stringify(A.findings.filter(x => x.kod !== 'W-KAP-02'));
    ok(strip(res[0]) === strip(res[1]) && strip(res[1]) === strip(res[2]), `${sc.id}: oran başka uyarıları değiştirdi`);
    res.forEach(A => { const f = A.findings.find(x => x.kod === 'W-KAP-02'); if (f) { ok(f.seviye === 'uyari' && r.sel.feasible, 'W-KAP-02 yalnız uygun sistemde, uyarı seviyesinde'); seen = true; } });
    if (r.sel.feasible) { const ratio = r.sel.cycleHours / r.sel.avail; ok(!!res[0].findings.find(x => x.kod === 'W-KAP-02') === ratio > 0.5 + 1e-9 && !res[2].findings.find(x => x.kod === 'W-KAP-02'), `${sc.id}: eşik`); }
  }
  ok(seen, 'hiçbir senaryoda W-KAP-02 denenmedi');
  ok(AS.clampK(0.2) === 0.5 && AS.clampK(3) === 1 && AS.planK({}) === 0.9 && AS.planK({ akil: { planOrani: 0.8 } }) === 0.8, 'sınırlar ve varsayılan');
  const app = fs.readFileSync(W('app.js'), 'utf8');
  ok(/name="__planOrani"/.test(app) && /cur\.akil\.planOrani = AS\.clampK/.test(app) && !/cur\.inp\.planOrani/.test(app), 'oran motor girdisine yazılmamalı');
});

// ---------- T-10: proje saklama ve gerçek JSON yedeği ----------
test('T-10 proje ayarı ve kullanıcı kararı saklanır; eski projeler hatasız değerlendirilir', () => {
  const p = proj(T2, { akil: { planOrani: 0.8, onay: { 'W-KAP-01': 'kabul' } } });
  const back = St.parseProjects(JSON.stringify([p])).projects[0];
  ok(back.akil.planOrani === 0.8 && back.akil.onay['W-KAP-01'] === 'kabul', 'akil alanı kayboldu');
  const A = AS.forProject(back, E.design(back.inp));
  ok(A.findings.find(x => x.kod === 'W-KAP-01').onay === 'kabul' && A.planOrani === 0.8, 'onay/oran değerlendirmeye geçmiyor');
  const old = St.parseProjects(LS['irrismart.projects.v1']).projects;
  ok(old.length > 0, 'v0.6.0 projesi yok');
  for (const q of old) { ok(!q.akil && AS.planK(q) === AS.K_DEF, 'eski projeye alan eklendi'); const r = E.design(q.inp, null, { poly: q.poly, src: q.src }); if (r.ok) ok(AS.forProject(q, r).ok, 'eski proje değerlendirilemedi'); }
});

test('T-10b gerçek JSON yedek → geri yükleme: proje, ayar ve uyarılar birebir korunur; Excel yedek değildir', () => {
  const p = proj(T2, { akil: { planOrani: 0.75, onay: { 'W-PN-02': 'red' } }, rev: 3, revs: [{ rev: 3, t: 1, note: '', data: '{}' }], created: 5, updated: 9 });
  const r0 = E.design(p.inp), A0 = AS.forProject(p, r0);
  const text = JSON.stringify(St.backupPayload([p], { elektrik: 4.2 }, null, new Date(0)), null, 2);   // uygulamanın yazdığı dosya
  const j = St.readBackup(text);
  ok(j.valid.length === 1 && j.settings.elektrik === 4.2, 'yedek okunamadı');
  const list = [proj({ crop: 'domates', area_da: 10, Q: 10 }, { id: 'baska', updated: 1 })];
  St.mergeBackup(list, j.valid);
  const q = list.find(x => x.id === p.id);
  ok(list.length === 2 && q && JSON.stringify(q.inp) === JSON.stringify(p.inp) && q.rev === 3 && q.revs.length === 1 && q.updated === 9, 'proje alanları değişti');
  const r1 = E.design(q.inp), A1 = AS.forProject(q, r1);
  ok(JSON.stringify(r1.sel.cycleHours) === JSON.stringify(r0.sel.cycleHours), 'hesap sonucu değişti');
  ok(JSON.stringify(A1.findings) === JSON.stringify(A0.findings), 'uyarılar (kod, seviye, değer, çözüm, karar) değişti');
  ok(A1.planOrani === 0.75 && A1.findings.find(x => x.kod === 'W-PN-02').onay === 'red', 'proje ayarı yedekten dönmedi');
  // Aynı kimlikli proje üzerine yazılır, kopya oluşmaz
  St.mergeBackup(list, St.readBackup(text).valid); ok(list.length === 2, 'geri yükleme kopya üretti');
  // Eski uygulama adıyla (IrriSmart) alınmış yedek de okunur
  ok(St.readBackup(JSON.stringify({ uygulama: 'IrriSmart', yedekSurum: 1, projects: JSON.parse(LS['irrismart.projects.v1']) })).valid.length > 0, 'eski yedek okunamadı');
  // Excel raporu yedek olarak kabul edilmez
  const xlsxB64 = XLSX.write(RD.workbook(XLSX, p, r0), { bookType: 'xlsx', type: 'base64' });
  let threw = false; try { St.readBackup(xlsxB64); } catch (e) { threw = true; } ok(threw, 'Excel dosyası yedek olarak okundu');
  let threw2 = false; try { St.readBackup('{"projects":[]}'); } catch (e) { threw2 = e.i18n === true; } ok(threw2, 'IrriGrow olmayan JSON reddedilmeli');
  const app = fs.readFileSync(W('app.js'), 'utf8');
  ok(app.includes('St.backupPayload(') && app.includes('St.readBackup(') && app.includes('St.mergeBackup('), 'uygulama aynı yedek fonksiyonlarını kullanmıyor');
});

// ---------- Ek: modül motoru değiştirmez ----------
test('Uyarı katmanı motor sonucunu değiştirmez ve hesap yapmaz', () => {
  const r = E.design(T2), before = JSON.stringify(r);
  AS.forProject(proj(T2), r); HV.build(r, { inp: T2, Qsource: 86.3 }); RD.build(proj(T2), r);
  ok(JSON.stringify(r) === before, 'motor sonucu değiştirildi');
  const src = fs.readFileSync(W('assess.js'), 'utf8');
  ok(!/IrriEngine|\.design\(|Math\.pow|hazen|colebrook/i.test(src), 'assess.js motoru çağırıyor veya hidrolik bağıntı içeriyor');
});

test('T-15 "Bilinerek kabul edildi" teknik uygunsuzluğu kaldırmaz ve projeyi uygun yapmaz', () => {
  const r = E.design(T2), A0 = AS.forProject(proj(T2), r);
  const onay = {}; A0.findings.forEach(x => { onay[x.kod] = 'kabul'; });
  const p = proj(T2, { akil: { onay } }), A1 = AS.forProject(p, r);
  ok(A0.teknikUygun === false && A1.teknikUygun === false, 'kabul edilen uygunsuzluk projeyi uygun yaptı');
  ok(JSON.stringify(A1.count) === JSON.stringify(A0.count), 'sayımlar değişti');
  A1.findings.forEach((x, i) => { ok(x.seviye === A0.findings[i].seviye && x.onay === 'kabul', `${x.kod}: seviye değişti`); ok(JSON.stringify(x.cozumler) === JSON.stringify(A0.findings[i].cozumler), `${x.kod}: çözümler değişti`); });
  const TB = RD.build(p, r), f = TB.akil.findings.find(x => x.kod === 'W-KAP-01');
  ok(/Uygunsuz/.test(f.head) && f.kv.some(k => k[1] === 'Bilinerek kabul edildi'), 'PDF kararla birlikte uygunsuz yazmıyor');
  const html = AV.make({}).render(A1);
  ok(/data-seviye="uygunsuz"/.test(html) && /teknik uygunluğu değiştirmez/.test(html), 'ekran kararın etkisini açıklamıyor');
  const ok1 = cases.find(c => c.A && c.A.teknikUygun); if (ok1) ok(ok1.A.count.uygunsuz === 0, 'teknik uygunluk tanımı');
});

test('Hacim tanımları: tur ve kapasite Σ damlatıcı debisi × süre ile; brüt × alan ayrıca gösterilir', () => {
  const r = E.design(T2), f = AS.forProject(proj(T2), r).findings.find(x => x.kod === 'W-KAP-01'), u = f.ayrinti.unsurlar;
  const V = u.find(q => /Σ damlatıcı/.test(q.ad.t)).deger, B = u.find(q => q.ad.t === 'Brüt ihtiyaç × toplam alan').deger;
  near(V * r.schedule.interval / r.schedule.t, r.sectors.Qfield, 1e-9, 'sulama hacmi motorun toplam debisinden');
  near(r.sel.groups.length * r.schedule.t, r.sel.cycleHours, 1e-9, 'tur = Ns × t');
  near(B, r.schedule.gross * r.field.A / 1000, 1e-9, 'brüt × alan');
  ok(B > V && (B - V) / B < 0.02, `fark beklenen aralıkta değil (${B} / ${V})`);
});

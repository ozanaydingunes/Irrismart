// PN-3a — kullanıcının seçtiği ana hat borusunun (doğrulanmış kütüphaneden) hesap motoruna aktarılması
const { E, test, ok, near } = require('./_lib');
require('../www/js/pipes.js');            // tarayıcıda PN-3b ile yüklenecek; motor seçim varken IrriPipes'ı kullanır
const A = require('../www/js/auto.js');
const EP = require('./ref/epanet');
const SC = require('./golden/scenarios.js');
const kuyu50 = { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 45, srcType: 'kuyu', depth: 40, region: 'akdeniz' };
const sec = (malzeme, od, sdr) => ({ ana: { malzeme, od, sdr } });
const tasarla = (inp, opt = {}) => E.design(inp, null, opt);
const JSONs = r => JSON.stringify(r);
// Bağımsız hesap (motor işlevleri kullanılmadan): hız ve Hazen-Williams (C = 150) kaybı
const hiz = (Qm3h, dmm) => (Qm3h / 3600) / (Math.PI * Math.pow(dmm / 2000, 2));
const hw = (Qm3h, dmm, L) => 10.67 * L * Math.pow(Qm3h / 3600, 1.852) / (Math.pow(150, 1.852) * Math.pow(dmm / 1000, 4.87));

test('P3-01 Boru seçimi olmayan projeler bit bit aynı (seçim yok / ana: null)', () => {
  for (const s of SC) {
    const a = tasarla(s.inp, s.opt || {});
    const b = tasarla(Object.assign({}, s.inp, { boruSecimi: { ana: null } }), s.opt || {});
    const c = tasarla(Object.assign({}, s.inp, { boruSecimi: undefined }), s.opt || {});
    ok(JSONs(a) === JSONs(b) && JSONs(a) === JSONs(c), `${s.id}: seçimsiz sonuç değişti`);
  }
});

test('P3-02 PN10 (SDR17) ve PN16 (SDR11), aynı dış çap: iç çap, hız, kayıp, basınç ve pompa yüksekliği doğru değişir', () => {
  const r0 = tasarla(kuyu50), r10 = tasarla(Object.assign({}, kuyu50, { boruSecimi: sec('PE100', 110, 17) })), r16 = tasarla(Object.assign({}, kuyu50, { boruSecimi: sec('PE100', 110, 11) }));
  ok(r0.ok && r10.ok && r16.ok, `${r10.err || ''} ${r16.err || ''}`);
  const m10 = r10.main.sel, m16 = r16.main.sel;
  // PN yalnız basınç sınırı değil: aynı Ø110'da et 6,6 → 10,0 mm, iç çap 96,8 → 90,0 mm
  near(m10.ic, 96.8, 1e-9, 'Ø110 SDR17 iç çap'); near(m16.ic, 90.0, 1e-9, 'Ø110 SDR11 iç çap');
  ok(m10.pn === 10 && m16.pn === 16 && m10.pipe.et === 6.6 && m16.pipe.et === 10, 'PN ve et');
  near(m10.v, hiz(r10.sel.Qmax, 96.8), 1e-9, 'hız PN10 (bağımsız)'); near(m16.v, hiz(r16.sel.Qmax, 90.0), 1e-9, 'hız PN16 (bağımsız)');
  ok(m16.v > m10.v, 'küçük iç çap → yüksek hız');
  // Segment kayıpları: bağımsız Hazen-Williams × 1,10 yerel kayıp payı
  for (const sg of r16.main.net) near(sg.hf, hw(sg.Qmax, 90.0, sg.L) * 1.10, 1e-9 * Math.max(1, sg.hf), `${sg.id} kayıp`);
  ok(r16.main.net.every(sg => sg.od === 110 && sg.ic === 90), 'seçilen boru bütün ana hat boyunca (kademe yok)');
  ok(m16.hf > m10.hf && m16.H.every((h, j) => h > m10.H[j]), 'kayıp ve shift basıncı artar');
  ok(r16.pump.H >= r10.pump.H && r16.schedule.kWh >= r10.schedule.kWh, 'pompa yüksekliği ve enerji artar (veya eşit)');
  // Su darbesi ön değerlendirmesi PE malzemesiyle (E = 1 GPa) ve seçilen et/iç çapla
  ok(r16.surge.E === 1.0e9 && r0.surge.E === 3.0e9 && r16.surge.a > r10.surge.a, 'dalga hızı: PE ve kalın et');
  // Malzeme listesi ve varsayımlar
  ok(r10.bom.some(b => b.key === 'kutuphane:PE100:110:17' && /PE100 boru Ø110 SDR17 PN10/.test(b.kalem)), 'BOM kalemi');
  ok(r10.asm.some(a => /kullanıcı tarafından seçildi: PE100 Ø110 SDR17 PN10/.test(a) && /standart metniyle doğrudan doğrulanmadı/.test(a)), 'varsayım metni');
  ok(!r10.bom.some(b => /^pvc:/.test(b.key) && b.grup === 'Ana hat'), 'ana hatta PVC kalemi yok');
});

test('P3-03 Yalnız etkin ve doğrulanmış kombinasyonlar: PN6, PVC-U ve geçersiz seçimler reddedilir', () => {
  const red = (b, msg) => { const r = tasarla(Object.assign({}, kuyu50, { boruSecimi: b })); ok(!r.ok && r.err.some(e => msg.test(e)), `${JSON.stringify(b)} → ${r.err}`); };
  red(sec('PE100', 110, 26), /doğrulanmış boru kütüphanesinde yok/);    // PN6: tek kaynak, etkin değil
  red(sec('PVC-U', 110, 21), /doğrulanmış boru kütüphanesinde yok/);    // PVC-U: kütüphanede etkin satır yok
  red(sec('PE80', 110, 11), /doğrulanmış boru kütüphanesinde yok/);     // PE80 yalnız Ø40–63
  red(sec('PE80', 32, 11), /doğrulanmış boru kütüphanesinde yok/);      // kaynak çelişkisi, etkin değil
  red(sec('PE100', 111, 17), /doğrulanmış boru kütüphanesinde yok/);    // standart dışı çap
  for (const b of [sec('Çelik', 110, 17), sec('PE100', '110', 17), sec('PE100', 110, -17), { ana: { malzeme: 'PE100', od: 110 } }, { ana: sec('PE100', 110, 17).ana, manifold: {} }, 'PE100', 5]) {
    const r = tasarla(Object.assign({}, kuyu50, { boruSecimi: b }));
    ok(!r.ok && r.fieldErrors && r.fieldErrors.boruSecimi, `yapı hatası yakalanmadı: ${JSON.stringify(b)}`);
  }
});

test('P3-04 Seçim sınırları aşıyorsa reddedilmez, hesaplanır ve açıkça "uygunsuz" yazılır', () => {
  // Çok küçük çap: hız 2,0 m/s'yi aşar
  const rv = tasarla(Object.assign({}, kuyu50, { boruSecimi: sec('PE100', 63, 11) }));
  ok(rv.ok && rv.main.sel.hizUygun === false && rv.main.sel.v > 2, 'hız aşımı hesaplanır');
  ok(rv.warn.some(w => /akış hızı .* 2,0 m\/s sınırını aşıyor\. Bu seçim uygunsuz/.test(w)), 'hız uyarısı');
  ok(A.uygunluk(rv, { kaynakDebisi: 45 }).kurallar.find(k => k.kod === 'U-04').durum === 'uygunsuz', 'MH-AUTO U-04 uygunsuz');
  // Yüksek kot farkı: PN10 yetersiz, PN16 yeterli
  const yuk = Object.assign({}, kuyu50, { dZ: 60 });
  const p10 = tasarla(Object.assign({}, yuk, { boruSecimi: sec('PE100', 125, 17) })), p16 = tasarla(Object.assign({}, yuk, { boruSecimi: sec('PE100', 125, 11) }));
  ok(p10.ok && p10.main.sel.pnYeterli === false && p10.warn.some(w => /basınç sınıfı yetersiz.*PN10.*Bu seçim uygunsuz/.test(w)), 'PN10 yetersiz uyarısı');
  ok(p16.ok && p16.main.sel.pnYeterli === true && !p16.warn.some(w => /basınç sınıfı yetersiz/.test(w)), 'PN16 yeterli');
  ok(A.uygunluk(p10, { kaynakDebisi: 45 }).kurallar.find(k => k.kod === 'U-05').durum === 'uygunsuz', 'MH-AUTO U-05 uygunsuz');
});

test('P3-05 Otomatik seçim bozulmadı: seçim yoksa mainOd ve kademeli ana hat aynen; seçim varsa mainOd uygulanmaz', () => {
  const s13 = SC.find(s => s.id === 'S13-ana-hat-zorunlu-cap'), r13 = tasarla(s13.inp);
  ok(r13.main.sel.od === 160 && r13.main.sel.pipe.malzeme === 'PVC-U', 'mainOd: PVC Ø160');
  const r = tasarla(Object.assign({}, s13.inp, { boruSecimi: sec('PE100', 125, 17) }));
  ok(r.ok && r.main.sel.od === 125 && r.main.sel.secim === 'kullanici' && r.main.alts.length === 1, 'kullanıcı seçimi önceliklidir');
  const s3 = SC.find(s => s.id === 'S03-asagi-egimli-lateral'), a3 = tasarla(s3.inp, s3.opt);
  ok(a3.main.teleskop === true && new Set(a3.main.net.map(x => x.od)).size >= 1, 'otomatik: kademe ayarı aynen');
  const b3 = tasarla(Object.assign({}, s3.inp, { boruSecimi: sec('PE100', 160, 17) }), s3.opt);
  ok(b3.ok && b3.main.teleskop === false && b3.main.net.every(x => x.od === 160), 'seçim: tek çap');
});

test('P3-06 Seçilen boruyla ana hat ağı EPANET (Hazen-Williams) ile: shift basma yüksekliği ≤ max(0,10 m; %0,2)', async () => {
  const durumlar = [
    [kuyu50, {}, sec('PE100', 110, 11)], [kuyu50, {}, sec('PE100', 125, 17)],
    [SC.find(s => s.id === 'S03-asagi-egimli-lateral').inp, SC.find(s => s.id === 'S03-asagi-egimli-lateral').opt, sec('PE100', 200, 17)],
    [SC.find(s => s.id === 'S19-buyuk-hidrant').inp, {}, sec('PE100', 315, 11)],
  ];
  for (const [inp, opt, b] of durumlar) {
    const r = tasarla(Object.assign({}, inp, { boruSecimi: b }), opt);
    ok(r.ok, `${JSON.stringify(b)}: ${r.err}`);
    const H = r.main.sel.H;
    for (let j = 0; j < r.sel.groups.length; j++) {
      const { loss, rootQ } = await EP.mainNetwork(r, j);
      const Hep = r.head.static0 + r.sel.Hfix[j] + Math.max(...r.sel.groups[j].map(k => { const u = r.units[k]; return u.rise + loss[k] + r.sel.uValve[k].loss(u.Q) + u.hIn; }));
      ok(Math.abs(H[j] - Hep) <= Math.max(0.10, 0.002 * Hep), `${b.ana.malzeme} Ø${b.ana.od} SDR${b.ana.sdr} shift ${j + 1}: H motor ${H[j].toFixed(3)} EPANET ${Hep.toFixed(3)}`);
      ok(Math.abs(rootQ - (r.main.net.length ? r.sel.Qj[j] : 0)) <= 0.01, `kök debi shift ${j + 1}`);
    }
  }
});

test('P3-07 Seçim değişince bütün bağımlı hesaplar yeniden çalışır (aynı design çağrısı)', () => {
  const a = tasarla(Object.assign({}, kuyu50, { boruSecimi: sec('PE100', 140, 17) })), b = tasarla(Object.assign({}, kuyu50, { boruSecimi: sec('PE100', 140, 11) }));
  ok(a.ok && b.ok, 'iki hesap');
  const fark = ['main.sel.ic', 'main.sel.v', 'main.sel.hf', 'main.sel.Hmax', 'surge.a', 'surge.dH'].filter(k => { const g = (o, p) => p.split('.').reduce((x, y) => x[y], o); return g(a, k) !== g(b, k); });
  ok(fark.length === 6, `değişmeyen bağımlı büyüklük: ${fark}`);
  ok(a.bom.find(x => x.grup === 'Ana hat' && /PE100 boru/.test(x.kalem)).key !== b.bom.find(x => x.grup === 'Ana hat' && /PE100 boru/.test(x.kalem)).key, 'malzeme listesi güncellenir');
  // Seçim yalnız kullanıcı açıkça uyguladığında: aynı girdi tekrar hesaplanınca aynı sonuç
  ok(JSONs(a) === JSONs(tasarla(Object.assign({}, kuyu50, { boruSecimi: sec('PE100', 140, 17) }))), 'belirlenimci');
});

// Tasarım bütünlüğü: elle hesap, kütle dengesi, sınır koşulları, sektör alternatifleri
const { E, Ly, test, near, rel, ok } = require('./_lib');
const base = { crop: 'domates', area_da: 50, L: 400, W: 125, Q: 60, srcType: 'kuyu', depth: 40, region: 'akdeniz', soil: 'tinli', dSource: 50, slopeLong: 1, slopeShort: 0.5 };

function invariants(r, Q) {
  ok(r.ok, 'tasarım başarısız: ' + r.err);
  const s = r.schedule;
  ok(s.net > 0 && s.gross > s.net && s.t > 0, 'sulama ihtiyacı pozitif olmalı');
  ok(s.monthly.every(m => m.gross > 0 && m.sure > 0 && m.interval >= 1), 'aylık değerler pozitif');
  const sumU = r.units.reduce((t, u) => t + u.Q, 0), sumL = r.layout.laterals.reduce((t, l) => t + l.Q, 0) / 1000;
  near(sumU, sumL, 1e-6, 'Σ alt ünite debisi = Σ lateral debisi');
  for (const a of r.sectorAlts) {
    near(a.Qj.reduce((t, x) => t + x, 0), r.sectors.Qfield, 1e-6, 'Σ sektör debisi = arazi debisi');
    ok(a.Qmax <= Q + 1e-9, `sektör debisi (${a.Qmax}) kaynak debisini (${Q}) aşıyor`);
    const flat = a.groups.flat().sort((x, y) => x - y); ok(flat.every((v, i) => v === i), 'her alt ünite tam bir sektörde');
  }
  ok(r.lateral.maxDH <= r.emitter.allowLat * 1.0001, 'lateral basınç farkı sınırı');
  ok(r.units.every(u => u.varH <= r.emitter.allowMan + 1e-9 && u.v <= 1.5), 'manifold basınç farkı / hız sınırı');
  ok(r.main.sel.v <= 2.0, 'ana hat hızı');
  ok(r.lateral.maxLen <= r.lateral.Lmax + 1e-6, 'lateral boyu ≤ maks.');
  ok(r.bom.every(b => Number.isFinite(b.miktar) && b.miktar >= 0), 'malzeme miktarları');
  ok((r.cost.total === null) === (r.cost.missing > 0), 'eksik fiyatla toplam verilmemeli');
  const nums = [r.field.A, r.lateral.len, r.main.Lmain, r.main.sel.Hmax, s.seasonM3, r.sectors.Qsec];
  ok(nums.every(v => Number.isFinite(v) && v > 0), 'temel çıktılar sonlu ve pozitif');
}

test('Örnek proje (domates 50 da) değişmezleri', () => invariants(E.design(base), 60));

test('FAO-56 elle hesap — zeytin, Ege (Kr, RAW, aralık, süre)', () => {
  const r = E.design({ crop: 'zeytin', area_da: 200, Q: 80, srcType: 'yuzey', region: 'ege', soil: 'tinli' });
  ok(r.ok, r.err);
  const s = r.schedule, Kr = 0.5 + 0.15 * 0.5, net = 6.2 * 0.7 * Kr, gross = net / 0.9, RAW = 150 * 1.2 * 0.65 * 0.30;
  near(s.Kr, Kr, 1e-9, 'Kr'); near(s.net, net, 1e-9, 'net'); near(s.gross, gross, 1e-9, 'brüt'); near(s.RAW, RAW, 1e-9, 'RAW');
  ok(s.Imax === Math.floor(RAW / net), 'Imax'); ok(s.interval === 2, 'aralık');
  near(s.AR, 4 * 4 / (6 * 6), 1e-9, 'uygulama hızı'); near(s.t, gross * 2 / (16 / 36), 1e-9, 'süre');
});

test('Domates uygulama hızı ve net ihtiyaç elle hesap', () => {
  const s = E.design(base).schedule;
  near(s.net, 6.5 * 1.15, 1e-9, 'ETc'); near(s.AR, 2 / (0.33 * 1.4), 1e-9, 'AR');
});

test('Basma yüksekliği bileşenleri toplamı = H (kritik alt ünite)', () => {
  const r = E.design(base), sel = r.sel, m = r.main.sel;
  sel.groups.forEach((gr, j) => {
    // Bağımsız: segment debisi = o segmentin beslediği, bu shift'teki alt ünitelerin debileri toplamı
    const Hj = Math.max(...gr.map(k => {
      const u = r.units[k]; let hf = 0;
      for (const sg of r.main.net) if (sg.down.includes(k)) { const q = sg.down.filter(x => gr.includes(x)).reduce((t, x) => t + r.units[x].Q, 0); hf += E.hfHW(q / 3600, sg.ic / 1000, sg.L) * 1.1; }
      return r.head.static0 + u.rise + hf + sel.Hfix[j] + sel.uValve[k].loss(u.Q) + u.hIn;
    }));
    near(m.H[j], Hj, 1e-9, `sektör ${j + 1}`);
  });
});

test('Pompa: seçilen eğri her sektörde gerekli basıncı karşılar, motor aşırı yüklenmez', () => {
  for (const inp of [base, { ...base, Q: 30 }, { ...base, crop: 'zeytin', area_da: 300, Q: 90, srcType: 'yuzey', depth: 3 }]) {
    const r = E.design(inp); ok(r.ok, r.err);
    const p = r.pump; ok(p.need, 'pompa gerekli olmalı');
    if (p.fromCatalog) { ok(p.pts.every(x => x.H >= x.Hreq - 1e-9), 'eğri basıncı yetersiz'); ok(p.Pmax <= p.motor + 1e-9, 'motor aşırı yük'); }
  }
});

test('Şebeke: yeterli basınçta pompa önerilmez, yetersizde booster', () => {
  const r1 = E.design({ crop: 'misir', area_da: 20, Q: 40, srcType: 'sebeke', pAvail: 6, region: 'icanadolu' });
  ok(r1.ok && r1.pump.need === false, 'pompa gerekmemeli');
  const r2 = E.design({ crop: 'misir', area_da: 20, Q: 40, srcType: 'sebeke', pAvail: 1, region: 'icanadolu' });
  ok(r2.ok && r2.pump.need === true, 'booster gerekmeli');
});

test('Kaynak debisi azaldıkça en az sektör sayısı artar (monotonluk)', () => {
  let prev = 0;
  for (const Q of [200, 120, 80, 60, 40, 25, 15]) {
    const r = E.design({ ...base, Q }); ok(r.ok, `Q=${Q}: ${r.err}`); invariants(r, Q);
    const nMin = Math.min(...r.sectorAlts.map(a => a.Ns)); ok(nMin >= prev, `Q=${Q} → ${nMin} < ${prev}`); prev = nMin;
  }
});

test('Sektör alternatifleri: birden fazla seçenek, önerilen işaretli, kullanıcı seçimi uygulanır', () => {
  const r = E.design({ ...base, Q: 45 });
  ok(r.sectorAlts.length >= 2, 'en az 2 alternatif bekleniyor');
  ok(r.sectorAlts.filter(a => a.recommended).length === 1, 'tek önerilen');
  const other = r.sectorAlts.find(a => !a.recommended);
  const r2 = E.design({ ...base, Q: 45, Ns: other.Ns });
  ok(r2.sectors.Ns === other.Ns, 'kullanıcının sektör sayısı uygulanmadı');
});

test('Ardışık bölme en büyük sektör debisini en aza indirir (kaba kuvvetle karşılaştırma)', () => {
  const brute = (Q, n) => { let best = Infinity; const rec = (i, k, mx) => { if (k === 1) { const s = Q.slice(i).reduce((a, b) => a + b, 0); best = Math.min(best, Math.max(mx, s)); return; } let s = 0; for (let j = i; j <= Q.length - k; j++) { s += Q[j]; rec(j + 1, k - 1, Math.max(mx, s)); } }; rec(0, n, 0); return best; };
  for (let t = 0; t < 40; t++) {
    const Q = Array.from({ length: 3 + (t % 7) }, (_, i) => 5 + ((i * 37 + t * 11) % 23));
    for (let n = 1; n <= Q.length; n++) {
      const gr = Ly.partition(Q, n), mx = Math.max(...gr.map(g => g.reduce((s, i) => s + Q[i], 0)));
      near(mx, brute(Q, n), 1e-6, `Q=${Q} n=${n}`);
    }
  }
});

test('PC damlatıcı, eğimli zeytinlik: kısıtlar sağlanır', () => invariants(E.design({ crop: 'zeytin', area_da: 200, Q: 80, srcType: 'yuzey', region: 'ege', slopeLong: 3, slopeShort: 1, emitter: 'pc' }), 80));

test('Yüksek eğim ve düşük basınçta lateral kurulamıyorsa açık hata verilir (çökme yok)', () => {
  const r = E.design({ ...base, slopeLong: 30, slopeShort: 30, hNom: 3, rowDir: 'uzun' });
  ok(r.ok || r.err.length, 'sonuç veya hata olmalı');
  ok(!r.err.some(e => /Beklenmeyen/.test(e)), 'beklenmeyen hata: ' + r.err);
});

test('Debi olmadan kesin sonuç verilmez; alan hatası ilgili alana bağlanır', () => {
  const r = E.design({ crop: 'domates', area_da: 50 }); ok(!r.ok && /debisi/.test(r.err[0]), 'debi');
  const r2 = E.design({ ...base, area_da: -5 }); ok(!r2.ok && r2.fieldErrors.area_da, 'negatif alan alan hatası');
});

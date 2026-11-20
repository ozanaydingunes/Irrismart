// K-1 — veri güvenliği çekirdeği: yedekten yükleme mevcut projeyi korur; revizyon güzergâh/istasyon/elle shift'i taşır
const fs = require('fs'), path = require('path');
const { test, ok } = require('./_lib');
const St = require('../www/js/store.js');
const pr = (id, extra = {}) => Object.assign({ id, name: 'P-' + id, created: 1, updated: 2, poly: [], src: null, inp: { crop: 'domates', area_da: 10, Q: 10 }, schema: 2, rev: 1, revs: [] }, extra);

test('K1-01 Yedekten yükleme: aynı kimlik + farklı içerik → mevcut korunur, yedekteki "(yedekten)" kopya olarak eklenir', () => {
  const yerel = pr('a', { inp: { crop: 'domates', area_da: 10, Q: 77 }, name: 'Yerel' });
  const list = [yerel];
  const yedek = [pr('a', { inp: { crop: 'domates', area_da: 10, Q: 10 }, name: 'Yerel' }), pr('b')];
  ok(JSON.stringify(St.planBackup(list, yedek)) === JSON.stringify({ yeni: 1, ayni: 0, farkli: 1 }), 'plan');
  St.mergeBackup(list, yedek);
  ok(list.length === 3 && St.mergeBackup.son.kopya === 1 && St.mergeBackup.son.eklenen === 1, 'özet');
  const a = list.find(p => p.id === 'a');
  ok(a === yerel && a.inp.Q === 77 && a.name === 'Yerel', 'mevcut proje aynen korunur (aynı nesne, değişmeden)');
  const k = list.find(p => p.kaynakKimlik === 'a');
  ok(k && k.id !== 'a' && k.name === 'Yerel (yedekten)' && k.inp.Q === 10, 'yedekteki proje yeni kimlikle kopya');
});

test('K1-02 Aynı içerik yeniden yüklenince kopya oluşmaz; yeni kimlik eklenir; kimlik çakışması olmaz', () => {
  const p = pr('a'), list = [JSON.parse(JSON.stringify(p))];
  St.mergeBackup(list, [Object.assign({}, p, { updated: 999 })]);     // yalnız zaman damgası farklı → aynı içerik
  ok(list.length === 1 && St.mergeBackup.son.ayni === 1, 'aynı içerik değişmez');
  St.mergeBackup(list, [pr('c')]); ok(list.length === 2 && St.mergeBackup.son.eklenen === 1, 'yeni proje eklenir');
  const many = [pr('x', { inp: { crop: 'domates', area_da: 1, Q: 1 } })];
  for (let i = 0; i < 20; i++) St.mergeBackup(many, [pr('x', { inp: { crop: 'domates', area_da: 1, Q: 2 + i } })]);
  ok(new Set(many.map(p => p.id)).size === many.length && many.length === 21, 'kimlikler benzersiz');
});

test('K1-03 Revizyon güzergâh, istasyon ve elle shift atamasını taşır; geri yüklemede döner; eski revizyon mevcut alanı silmez', () => {
  const p = pr('a', { station: [1, 2], route: [[3, 4]], shiftEdit: { sig: 's1', assign: [0, 1] } });
  St.snapshot(p, 'ilk'); const r1 = p.rev;
  p.route = []; p.shiftEdit = { sig: 's2', assign: [1, 0] }; St.snapshot(p, 'iki');
  ok(St.restoreRev(p, r1) && p.route.length === 1 && p.shiftEdit.sig === 's1' && p.station[0] === 1, 'geri yükleme tam');
  // Eski biçim revizyon (yalnız inp/poly/src/hydro): mevcut istasyon ve atama korunur
  const q = pr('b', { station: [9, 9], shiftEdit: { sig: 'z', assign: [0] }, rev: 5, revs: [{ rev: 5, t: 1, note: '', data: JSON.stringify({ inp: { crop: 'domates', area_da: 5, Q: 5 }, poly: [], src: null }) }] });
  ok(St.restoreRev(q, 5) && q.inp.area_da === 5 && q.station[0] === 9 && q.shiftEdit.sig === 'z', 'eski revizyon yeni alanları silmez');
});

test('K1-04 Uygulama: elle shift ataması yalnız saklanarak kaldırılır; geri yükleme planBackup ile onay ister', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'www', 'js', 'app.js'), 'utf8');
  // Her "delete cur.shiftEdit" satırı (veya hemen önceki satır) atamayı saklar ya da önce revizyon alır
  const L = app.split('\n'), korur = /shiftEditEski = |shiftEditYedek = |St\.snapshot\(cur, 'temizleme öncesi'\)|cur\.shiftEdit = cur\.shiftEditEski/;
  const silmeler = L.map((l, i) => [l, L[i - 1] || '']).filter(([l]) => /delete cur\.shiftEdit;/.test(l));
  ok(silmeler.length >= 4, `silme yolu sayısı: ${silmeler.length}`);   // hesap, Otomatik, parsel temizleme, yerleşim alternatifi
  const korumasiz = silmeler.filter(([l, o]) => !korur.test(l) && !korur.test(o));
  ok(!korumasiz.length, 'saklamadan silen satır: ' + korumasiz.map(x => x[0].trim().slice(0, 80)).join(' | '));
  ok(/St\.planBackup\(projects, valid\)/.test(app) && !/üzerine yazılacak/.test(app), 'geri yükleme onayı yeni davranışı anlatır');
});

test('K1-05 Aynı yedek ikinci kez yüklenince "(yedekten)" kopya çoğalmaz; yedek değişmişse yeni kopya eklenir', () => {
  const yerel = [pr('a', { name: 'Yerel', inp: { crop: 'domates', area_da: 10, Q: 77 } })];
  const yedek = [pr('a', { name: 'Yedek', inp: { crop: 'domates', area_da: 10, Q: 10 } })];
  St.mergeBackup(yerel, JSON.parse(JSON.stringify(yedek)));
  ok(yerel.length === 2 && St.mergeBackup.son.kopya === 1, 'ilk yüklemede tek kopya');
  ok(St.planBackup(yerel, yedek).ayni === 1 && St.planBackup(yerel, yedek).farkli === 0, 'özet: aynı yedek "aynı" sayılmalı');
  St.mergeBackup(yerel, JSON.parse(JSON.stringify(yedek)));
  ok(yerel.length === 2 && St.mergeBackup.son.ayni === 1 && St.mergeBackup.son.kopya === 0, `ikinci yüklemede kopya çoğaldı: ${yerel.length}`);
  ok(yerel.find(x => x.id === 'a').inp.Q === 77, 'yerel proje korunmalı');
  const degisik = [pr('a', { name: 'Yedek', inp: { crop: 'domates', area_da: 10, Q: 12 } })];
  St.mergeBackup(yerel, degisik);
  ok(yerel.length === 3 && St.mergeBackup.son.kopya === 1, 'farklı içerikli yedek yeni kopya eklemeli');
});

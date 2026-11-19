// MH-AUTO-1 — bağımsız veri modeli ve saf uygunluk kuralları (motor ve projeler değişmez)
const fs = require('fs'), path = require('path');
const { E, D, test, ok, near } = require('./_lib');
const A = require('../www/js/auto.js');
const SC = require('./golden/scenarios.js');
const PR = (D && D.defaultPrices) || {};
const tasarla = s => E.design(s.inp, PR, Object.assign({}, s.opt || {}));
const kaynak = s => Number(s.inp.Q);
const kod = (u, k) => u.kurallar.find(x => x.kod === k);

test('A1-01 Mod veri modeli: eski proje "mevcut"; yeni tasarım manuel/otomatik; doğrulama', () => {
  const p = { name: 'eski', inp: {} };
  const t0 = A.tasarimOku(p);
  ok(t0.mod === 'mevcut' && !('tasarim' in p), 'eski proje mevcut kipte, proje değişmez');
  for (const m of ['manuel', 'otomatik']) ok(A.tasarimDogrula(A.yeniTasarim(m)).length === 0, m);
  let at = false; try { A.yeniTasarim('mevcut'); } catch (e) { at = true; } ok(at, "'mevcut' elle oluşturulamaz");
  at = false; try { A.yeniTasarim('robot'); } catch (e) { at = true; } ok(at, 'geçersiz mod');
  const e = A.tasarimDogrula({ surum: 9, mod: 'x', kilitler: { 'bilinmeyen': {} }, secilen: 'en-iyi', agirliklar: { yatirim: 2 } });
  for (const k of ['surum', 'mod', 'bilinmeyen kilit', 'secilen', 'yatirim']) ok(e.some(x => x.includes(k)), `yakalanmadı: ${k}`);
});

test('A1-02 Kilitler: yalnız kullanıcı, değişmez nesneler, kilit öneriye üstün, açma onay ister', () => {
  const t0 = A.yeniTasarim('otomatik');
  const boru = { malzeme: 'PE100', od: 110, sdr: 17, pn: 10 };
  const t1 = A.kilitle(t0, 'boru.ana', boru, 1000);
  ok(!A.kilitliMi(t0, 'boru.ana') && A.kilitliMi(t1, 'boru.ana'), 'eski nesne değişmez');
  boru.od = 160; ok(t1.kilitler['boru.ana'].deger.od === 110, 'kilit değeri kopyalanır');
  ok(t1.kilitler['boru.ana'].kaynak === 'kullanici' && A.tasarimDogrula(t1).length === 0, 'kaynak kullanıcı');
  const b = A.birlestir({ 'boru.ana': { malzeme: 'PVC-U', od: 160, sdr: 26, pn: 10 }, 'shift.sayi': 4 }, t1);
  ok(b.deger['boru.ana'].malzeme === 'PE100' && b.kaynak['boru.ana'] === 'kilit', 'kilit kazanır');
  ok(b.deger['shift.sayi'] === 4 && b.kaynak['shift.sayi'] === 'oneri' && b.cakisma.includes('boru.ana'), 'öneri ve çakışma raporu');
  let at = false; try { A.kilitAc(t1, 'boru.ana'); } catch (e) { at = true; } ok(at, 'onaysız açılamaz');
  ok(!A.kilitliMi(A.kilitAc(t1, 'boru.ana', true), 'boru.ana') && A.kilitliMi(t1, 'boru.ana'), 'onaylı açma yeni nesne');
  for (const [alan, v] of [['shift.sayi', 0], ['boru.ana', { malzeme: 'Çelik', od: 110, sdr: 17, pn: 10 }], ['lateral.cap', 18], ['yok', 1]]) {
    at = false; try { A.kilitle(t0, alan, v); } catch (e) { at = true; } ok(at, `geçersiz kilit: ${alan}`);
  }
});

test('A1-03 Uygulanamayan kilit sessizce silinmez: koru / uyarla / kaldır sorulur', () => {
  let t = A.kilitle(A.yeniTasarim('otomatik'), 'shift.atama', { sig: 'eski', assign: [0, 1, 1] }, 1);
  t = A.kilitle(t, 'boru.ana', { malzeme: 'PE100', od: 110, sdr: 17, pn: 10 }, 2);
  const d = A.kilitDurumu(t, { 'shift.atama': { sig: 'yeni' }, 'boru.ana': { gecerliMi: v => v.od >= 125, neden: 'Hız sınırı aşılıyor' } });
  ok(d.length === 2 && d.every(x => !x.uygulanabilir && x.secenekler.join() === 'koru,uyarla,kaldir'), JSON.stringify(d));
  ok(A.kilitliMi(t, 'shift.atama') && A.kilitliMi(t, 'boru.ana'), 'kilitler yerinde');
  ok(A.kilitDurumu(t, { 'shift.atama': { sig: 'eski' } }).find(x => x.alan === 'shift.atama').uygulanabilir, 'aynı imza uygulanabilir');
});

test('A1-04 Uygunluk kuralları bütün altın senaryolarda çalışır; 7 kural; motor sonucu değişmez', () => {
  for (const s of SC) {
    const r = tasarla(s); if (!r.ok) continue;
    const once = JSON.stringify(r);
    const u = A.uygunluk(r, { kaynakDebisi: kaynak(s) });
    ok(u.kurallar.length === 7 && ['uygun', 'uygunsuz', 'veri-eksik'].includes(u.durum), s.id);
    ok(JSON.stringify(r) === once, `${s.id}: motor sonucu değişmemeli`);
    // Tur süresine sığmayan senaryo U-02'de uygunsuz
    ok(kod(u, 'U-02').durum === (r.sel.feasible ? 'uygun' : 'uygunsuz'), `${s.id} U-02`);
  }
  const s5 = SC.find(s => s.id === 'S05-coklu-shift'), u5 = A.uygunluk(tasarla(s5), { kaynakDebisi: kaynak(s5) });
  ok(u5.durum === 'uygunsuz' && kod(u5, 'U-02').durum === 'uygunsuz', 'S05 tur sığmıyor');
  // Kapama basıncı ana hat PN'ini aşan senaryo (motor da uyarı veriyor) U-05'te uygunsuz
  const s8 = SC.find(s => s.id === 'S08-yuksek-kot-farki-yukari'), r8 = tasarla(s8);
  ok(r8.warn.some(w => /kapama basıncı .* PN/.test(w)) && kod(A.uygunluk(r8, { kaynakDebisi: kaynak(s8) }), 'U-05').durum === 'uygunsuz', 'S08 U-05 motor uyarısıyla tutarlı');
});

test('A1-05 Eksik veri hiçbir zaman "uygun" sayılmaz', () => {
  const s = SC[0], r = tasarla(s);
  const u0 = A.uygunluk(r, {});   // kaynak debisi yok
  ok(kod(u0, 'U-03').durum === 'veri-eksik' && u0.durum !== 'uygun', 'kaynak debisi yoksa veri eksik');
  const bos = A.uygunluk({ ok: true }, { kaynakDebisi: 45 });
  ok(bos.kurallar.every(k => k.durum === 'veri-eksik') && bos.durum === 'veri-eksik', 'boş sonuç');
  ok(A.uygunluk(null).durum === 'veri-eksik' && A.uygunluk({ ok: false }).durum === 'veri-eksik', 'hatalı sonuç');
  const r2 = JSON.parse(JSON.stringify(r)); delete r2.lateral.cat.maxH;
  ok(kod(A.uygunluk(r2, { kaynakDebisi: 45 }), 'U-06').durum === 'veri-eksik', 'lateral sınırı yok');
});

test('A1-06 Geçici rejim ayrı: Joukowsky aşımı "geçici rejim analizi gerekli", normal kontrolü bozmaz', () => {
  const s = SC.find(x => x.id === 'S01-duz-arazi'), r = tasarla(s);
  ok(r.surge.exceeds, 'S01 Joukowsky aşıyor (ön koşul)');
  const d = A.degerlendir(r, { kaynakDebisi: kaynak(s) });
  ok(d.gecici.durum === 'gecici-analiz-gerekli' && /Ayrıntılı geçici rejim analizi gereklidir/.test(d.gecici.mesaj), 'mesaj');
  ok(d.normal.kurallar.every(k => !/darbe|Joukowsky/i.test(k.ad)), 'normal kurallarda su darbesi yok');
  const s13 = SC.find(x => x.id === 'S13-ana-hat-zorunlu-cap'), r13 = tasarla(s13);
  ok(!r13.surge.exceeds && A.geciciRejim(r13).durum === 'on-degerlendirme-sinir-icinde', 'S13 sınır içinde (yalnız ön değerlendirme)');
  ok(A.geciciRejim({}).durum === 'veri-eksik', 'veri yok');
});

test('A1-07 Kesin uygunluk bildirilmez: MH-3 ve MH-AKIL-5 öncesi en yüksek durum "ön tasarım"', () => {
  ok(A.YETENEK.kotHidrolikte === false && A.YETENEK.geciciRejimAnalizi === false, 'bu sürümün yetenekleri');
  for (const s of SC) {
    const r = tasarla(s); if (!r.ok) continue;
    const d = A.degerlendir(r, { kaynakDebisi: kaynak(s) }, Object.assign({ inp: s.inp }, s.opt || {}));
    ok(d.dogrulanmis.durum === 'on-tasarim' && /mühendislik doğrulaması gerekli/.test(d.dogrulanmis.etiket), s.id);
    ok(d.dogrulanmis.eksikler.some(x => /MH-3/.test(x)) && d.dogrulanmis.eksikler.some(x => /MH-AKIL-5/.test(x)), `${s.id} eksikler`);
    ok(d.veriNiteligi.some(x => x.kod === 'kot-hidrolik-yok'), `${s.id} kot uyarısı`);
  }
});

// Yapay adaylar: alternatif seçim kurallarını motordan bağımsız sınamak için
const U = d => ({ durum: d, kurallar: d === 'uygun' ? [] : [{ kod: 'U-02', ad: 'Tepe dönem sulama turu', durum: d }] });
const ad = (id, d, yatirim, enerji, bakim, Hmax, vMax, tek, kayip, metraj = 1000) => ({ id, uygunluk: U(d), crf: 0.13,
  metrik: { yatirim, metraj, enerjiYillik: enerji, bakimYillik: bakim, hidrolik: { Hmax, vMax, tekduzelikOrani: tek, toplamKayip: kayip } } });

test('A1-08 Uygun tasarım yoksa öneri yok: "Uygun tasarım bulunamadı" + sağlanamayan koşullar', () => {
  const r = A.alternatifSec([ad('a', 'uygunsuz', 1, 1, 1, 30, 1, 0.5, 5), ad('b', 'veri-eksik', 2, 2, 2, 30, 1, 0.5, 5)]);
  ok(r.durum === 'uygun-tasarim-yok' && r.mesaj === 'Uygun tasarım bulunamadı' && r.alternatifler.length === 0, 'öneri yok');
  ok(r.nedenler[0].kod === 'U-02' && r.nedenler[0].aday === 2, 'nedenler sayılır');
  ok(A.alternatifSec([]).durum === 'uygun-tasarim-yok', 'boş liste');
});

test('A1-09 Üç alternatif aynı zorunlu filtreden geçer; ucuz ama uygunsuz aday seçilmez', () => {
  const adaylar = [
    ad('ucuz-uygunsuz', 'uygunsuz', 50, 10, 1, 20, 0.8, 0.5, 2),
    ad('A', 'uygun', 100, 50, 10, 40, 1.4, 0.9, 12),
    ad('B', 'uygun', 130, 30, 10, 32, 1.0, 0.7, 7),
    ad('C', 'uygun', 160, 25, 12, 28, 0.8, 0.6, 5),
  ];
  const r = A.alternatifSec(adaylar);
  ok(r.durum === 'tamam' && !Object.values(r.secim).includes('ucuz-uygunsuz'), 'uygunsuz aday seçilmez');
  ok(r.secim.ekonomik === 'B', `ekonomik (yıllık toplam): ${r.secim.ekonomik}`);   // A: 13+50+10=73, B: 16,9+30+10=56,9, C: 20,8+25+12=57,8
  ok(r.secim.performans === 'C', 'performans: en düşük enerji');
  ok(['A', 'B', 'C'].includes(r.secim.dengeli) && r.kapsam.bakim === 'dahil' && r.kapsam.siralamaKesin, 'dengeli ve kapsam');
  near(Object.values(r.agirliklar).reduce((t, x) => t + x, 0), 1, 1e-9, 'ağırlık toplamı');
});

test('A1-10 Bakım verisi yoksa "hesaplanmadı", ağırlık yeniden ölçeklenir; fiyat yoksa metraj ve "kesin değil"', () => {
  const r = A.alternatifSec([ad('A', 'uygun', 100, 50, null, 40, 1.4, 0.9, 12), ad('B', 'uygun', 130, 30, null, 32, 1.0, 0.7, 7)]);
  ok(r.kapsam.bakim === 'hesaplanmadi' && r.notlar.some(x => x.includes('Bakım maliyeti hesaplanmadı')), 'bakım notu');
  ok(r.agirliklar.bakim === 0 && Math.abs(r.agirliklar.yatirim - 0.35 / 0.8) < 1e-9, 'yeniden ölçekleme');
  const f = A.alternatifSec([ad('A', 'uygun', null, 50, 5, 40, 1.4, 0.9, 12, 900), ad('B', 'uygun', 130, 30, 5, 32, 1.0, 0.7, 7, 1200)]);
  ok(f.kapsam.yatirim === 'metraj-vekil' && !f.kapsam.siralamaKesin && f.notlar.some(x => x.includes('kesin değil')), 'fiyat eksik');
  ok(f.secim.ekonomik === 'A', 'metraj vekil: daha az boru');
});

test('A1-11 Ağırlıklar kullanıcıca değiştirilebilir ve doğrulanır; aynı tasarım tek kart', () => {
  ok(A.agirlikDogrula(A.VARSAYILAN_AGIRLIK).length === 0 && A.VARSAYILAN_AGIRLIK.yatirim === 0.35 && A.VARSAYILAN_AGIRLIK.hidrolik === 0.15, 'varsayılan %35/%30/%20/%15');
  ok(A.agirlikDogrula({ yatirim: 0.5, enerji: 0.5, bakim: 0.2, hidrolik: 0 }).some(x => x.includes('%100')), 'toplam');
  ok(A.agirlikDogrula({ yatirim: -1, enerji: 1, bakim: 1, hidrolik: 0 }).length > 0, 'negatif');
  let at = false; try { A.alternatifSec([ad('A', 'uygun', 1, 1, 1, 1, 1, 1, 1)], { agirliklar: { yatirim: 1 } }); } catch (e) { at = true; } ok(at, 'geçersiz ağırlık reddedilir');
  const tek = A.alternatifSec([ad('A', 'uygun', 100, 30, 5, 30, 1, 0.5, 5), ad('B', 'uygun', 200, 60, 9, 40, 1.5, 0.9, 9)]);
  ok(tek.alternatifler.length === 1 && tek.alternatifler[0].turler.join() === 'ekonomik,dengeli,performans', 'A her açıdan iyi: tek kart');
  const yat = A.alternatifSec([ad('A', 'uygun', 100, 50, 10, 40, 1.4, 0.9, 12), ad('B', 'uygun', 130, 30, 10, 32, 1.0, 0.7, 7)], { agirliklar: { yatirim: 1, enerji: 0, bakim: 0, hidrolik: 0 } });
  ok(yat.secim.dengeli === 'A', 'yalnız yatırım ağırlığı → ucuz olan');
});

test('A1-12 Gerçek motor çıktısıyla uçtan uca: yerleşim varyantları → alternatifler', () => {
  const s = SC.find(x => x.id === 'S01-duz-arazi');
  const L = E.layoutAlternatives(s.inp, PR, s.opt || {});
  const adaylar = L.list.filter(v => v.ok).map(v => ({ id: `${v.rowDir}-${v.latD}`, uygunluk: A.uygunluk(v.r, { kaynakDebisi: kaynak(s) }), crf: 0.13, metrik: A.metrikCikar(v.r) }));
  ok(adaylar.length >= 2, 'varyant var');
  const r = A.alternatifSec(adaylar);
  const uygunlar = adaylar.filter(a => a.uygunluk.durum === 'uygun').map(a => a.id);
  if (r.durum === 'tamam') ok(Object.values(r.secim).every(id => uygunlar.includes(id)), 'yalnız uygun varyantlar');
  else ok(r.durum === 'uygun-tasarim-yok' && r.nedenler.length > 0, 'uygun varyant yok → nedenler');
  ok(r.durum === 'uygun-tasarim-yok' || r.notlar.some(x => x.includes('Bakım')), 'bakım verilmedi → not');
});

test('A1-13 Ortak aday uzayı: malzeme/çap/PN/SDR ve shift; kilitli boyut sabit; sınır aşılırsa kısmi', () => {
  const boru = [{ malzeme: 'PE100', od: 110, sdr: 17, pn: 10 }, { malzeme: 'PE100', od: 125, sdr: 17, pn: 10 }, { malzeme: 'Çelik', od: 1, sdr: 1, pn: 1 }];
  const u = A.adayUzayi({ 'boru.ana': boru, 'shift.sayi': [2, 3, 4], 'lateral.cap': [16, 20] }, A.yeniTasarim('otomatik'));
  ok(u.adaylar.length === 2 * 3 * 2 && !u.kismi, 'geçersiz boru elenir: 12 aday');
  const t = A.kilitle(A.yeniTasarim('otomatik'), 'shift.sayi', 3, 1);
  const k = A.adayUzayi({ 'boru.ana': boru, 'shift.sayi': [2, 3, 4] }, t);
  ok(k.adaylar.length === 2 && k.adaylar.every(a => a['shift.sayi'] === 3), 'kilitli shift sayısı sabit');
  const s = A.adayUzayi({ 'shift.sayi': [1, 2, 3, 4, 5, 6], 'lateral.cap': [16, 20] }, A.yeniTasarim('otomatik'), 5);
  ok(s.adaylar.length === 5 && s.kismi && s.toplam === 12, 'kısmi arama bildirilir');
  ok(A.adayUzayi({ 'bilinmeyen': [1] }, A.yeniTasarim('otomatik')).adaylar.length === 1, 'bilinmeyen boyut yok sayılır');
});

test('A1-14 Kapsam: motor, otomatik seçim, arayüz ve projeler bu modülü kullanmaz', () => {
  const src = f => fs.readFileSync(path.join(__dirname, '..', 'www', f), 'utf8');
  for (const f of ['js/engine.js', 'js/layout.js', 'js/hydraulics.js', 'js/assess.js', 'js/app.js', 'js/desk.js', 'js/store.js', 'js/catalog.js'])
    ok(!/IrriAuto|auto\.js/.test(src(f)), `${f} MH-AUTO-1 modülünü kullanmamalı`);
  ok(!/auto\.js/.test(src('index.html')), 'index.html yüklememeli (arayüz MH-MANUEL-1A sonrası)');
  const a = src('js/auto.js');
  ok(!/IrriEngine|\.design\(|localStorage|document\./.test(a), 'auto.js motoru çağırmaz, depolamaya ve DOM’a dokunmaz');
});

test('A1-15 Zorunlu uygunluk filtresi kapatılamaz; kurallar ve API değiştirilemez', () => {
  const adaylar = [ad('uygunsuz', 'uygunsuz', 1, 1, 1, 10, 0.5, 0.1, 1), ad('ok', 'uygun', 100, 50, 10, 40, 1.4, 0.9, 12)];
  for (const sec of [{ filtre: false }, { zorunluFiltre: false, agirliklar: A.VARSAYILAN_AGIRLIK }, { tumAdaylar: true }]) {
    let at = false; try { A.alternatifSec(adaylar, sec); } catch (e) { at = /devre dışı bırakılamaz/.test(e.message); } ok(at, JSON.stringify(sec));
  }
  ok(Object.isFrozen(A) && Object.isFrozen(A.YETENEK) && Object.isFrozen(A.BOYUTLAR), 'API dondurulmuş');
  const once = A.uygunluk; try { A.uygunluk = () => ({ durum: 'uygun', kurallar: [] }); } catch (e) { /* katı kip */ }
  ok(A.uygunluk === once, 'uygunluk() değiştirilemez');
  try { A.YETENEK.kotHidrolikte = true; } catch (e) { /* katı kip */ }
  ok(A.YETENEK.kotHidrolikte === false, 'yetenek bayrağı değiştirilemez (kesin uygunluk açılamaz)');
});

test('A1-16 Kilitli tasarım uygunsuz hâle gelirse kilit korunur ve gerekçe açıklanır', () => {
  const s5 = SC.find(s => s.id === 'S05-coklu-shift'), r5 = tasarla(s5);
  let t = A.kilitle(A.yeniTasarim('otomatik'), 'shift.sayi', r5.sectors.Ns, 1);
  t = A.kilitle(t, 'boru.ana', { malzeme: 'PVC-U', od: r5.main.sel.od, sdr: 33, pn: r5.main.sel.pn }, 2);
  const u = A.uygunluk(r5, { kaynakDebisi: kaynak(s5) });
  const g = A.kilitliTasarimGerekce(t, u);
  ok(g.durum === 'uygunsuz' && g.kilitlerKorundu && A.kilitliMi(t, 'shift.sayi') && A.kilitliMi(t, 'boru.ana'), 'kilitler korunur');
  const u02 = g.gerekceler.find(x => x.kod === 'U-02');
  ok(u02 && u02.ilgiliKilitler.includes('shift.sayi') && u02.deger > u02.sinir, 'U-02 gerekçesi ve ilgili kilit');
  ok(/Kilitli seçimleriniz korundu/.test(g.mesaj) && /U-02/.test(g.mesaj) && /kendiliğinden değiştirmez/.test(g.mesaj), g.mesaj);
  const s1 = SC[0], u1 = A.uygunluk(tasarla(s1), { kaynakDebisi: kaynak(s1) });
  ok(A.kilitliTasarimGerekce(t, u1).durum === 'uygun', 'uygun tasarımda gerekçe yok');
  const eks = A.kilitliTasarimGerekce(t, A.uygunluk(tasarla(s1), {}));
  ok(eks.durum === 'veri-eksik' && eks.gerekceler.some(x => x.kod === 'U-03' && x.durum === 'veri-eksik'), 'eksik veri de gerekçe olarak gösterilir, uygun sayılmaz');
});

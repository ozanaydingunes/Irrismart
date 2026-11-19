// PN-1 — standart tabanlı boru kütüphanesi: veri, doğrulama, iç çap, eski katalogla karşılaştırma, geriye uyum
const fs = require('fs'), path = require('path');
const { Ct, CAT, test, near, ok } = require('./_lib');
const P = require('../www/js/pipes.js');
const D = P.veri;
const doc = f => fs.readFileSync(path.join(__dirname, '..', 'docs', f), 'utf8');

test('P1-01 Etkin satırlar: pozitif ölçüler, iç çap > 0, od/et ≈ SDR (tablo yuvarlaması içinde)', () => {
  ok(D.SATIRLAR.length > 0, 'etkin satır yok');
  for (const s of D.SATIRLAR) {
    const id = `${s.malzeme} Ø${s.od} SDR${s.sdr}`;
    ok(s.od > 0 && s.enMin > 0 && P.icCap(s) > 0, id);
    // en küçük et ≈ od/SDR (0,1 mm'ye yuvarlanmış) veya en küçük et alt sınırı (2,0 mm): SDR sapması küçük kalmalı
    const sdrGercek = s.od / s.enMin;
    ok(s.enMin >= s.od / s.sdr - 0.1 || s.enMin === 2, `${id}: et ${s.enMin} < od/SDR`);   // tablo değerleri 0,1 mm'ye yuvarlanmış
    ok(s.enMin === 2 || Math.abs(sdrGercek - s.sdr) / s.sdr < 0.06, `${id}: od/et = ${sdrGercek.toFixed(2)}`);
  }
});

test('P1-02 PN çapraz denetimi: tablo PN = 20·MRS/(C·(SDR−1)) standart PN’e aşağı yuvarlanmış', () => {
  for (const s of D.SATIRLAR) { const d = P.pnDenetim(s); ok(d.tamam, `${s.malzeme} Ø${s.od} SDR${s.sdr}: hesap PN${d.hesap} ≠ tablo PN${d.tablo}`); }
  near(P.pnDenetim({ mrs: 10, cTasarim: 1.25, sdr: 17, pn: 10 }).ham, 10, 1e-9, 'PE100 SDR17');
  near(P.pnDenetim({ mrs: 8, cTasarim: 1.25, sdr: 11, pn: 12.5 }).ham, 12.8, 1e-9, 'PE80 SDR11');
  ok(!P.pnDenetim({ mrs: 10, cTasarim: 1.25, sdr: 17, pn: 16 }).tamam, 'yanlış PN yakalanmalı');
});

test('P1-03 Bütün etkin kombinasyonlar listede; beklenen kapsam ve sayı', () => {
  const ods = [32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 180, 200, 225, 250, 280, 315];
  for (const od of ods) for (const [sdr, pn] of [[17, 10], [11, 16]]) {
    const s = P.bul('PE100', od, sdr); ok(s && s.pn === pn, `PE100 Ø${od} SDR${sdr} PN${pn} eksik`);
  }
  for (const od of [40, 50, 63]) { const s = P.bul('PE80', od, 11); ok(s && s.pn === 12.5, `PE80 Ø${od} SDR11 eksik`); }
  ok(D.SATIRLAR.length === 35, `etkin satır sayısı ${D.SATIRLAR.length}`);
  ok(P.liste({ malzeme: 'PVC-U' }).length === 0, 'PVC-U için iki bağımsız kaynak yok: etkin satır olmamalı');
  ok(P.liste({ malzeme: 'PE100', pn: 10 }).every(s => s.sdr === 17), 'PE100 PN10 = SDR17');
  ok(P.liste({ hatTuru: 'manifold' }).length === 35 && P.liste({ hatTuru: 'lateral' }).length === 0, 'lateral kütüphanede yok');
});

test('P1-04 Geçersiz ve doğrulanmamış kombinasyonlar bulunamaz', () => {
  ok(P.bul('PE80', 110, 41) === null, 'PE80 SDR41');
  ok(P.bul('PE100', 110, 26) === null, 'PE100 SDR26 tek kaynak — etkin değil');
  ok(P.bul('PE80', 32, 11) === null, 'PE80 Ø32 SDR11 kaynaklar çelişiyor — etkin değil');
  ok(P.bul('PVC-U', 110, 26) === null, 'PVC-U etkin değil');
  ok(P.bul('PE100', 111, 17) === null, 'standart dışı çap');
  const c = D.ADAYLAR.find(a => a.malzeme === 'PE80' && a.od === 32);
  ok(c && c.neden === 'celiski' && c.degerler['upo-pe80'] === 2.9 && c.degerler['ali-pe80'] === 3, 'PE80 Ø32 çelişkisi kayıtlı');
  // aday satırların hiçbiri etkin listede değil
  for (const a of D.ADAYLAR) ok(!D.SATIRLAR.some(s => s.malzeme === a.malzeme && s.od === a.od && s.sdr === a.sdr), `aday etkin listede: ${a.malzeme} Ø${a.od} SDR${a.sdr}`);
});

test('P1-05 Kaynak doğrulaması: her satırda kaynak, standart sürümü, tarih ve düzey; iki bağımsız yayımcı', () => {
  ok(P.dogrula(D.SATIRLAR).length === 0, P.dogrula(D.SATIRLAR).join('; '));
  const kd = doc('pn-kaynaklar.md');
  for (const id of Object.keys(D.KAYNAKLAR)) ok(kd.includes(`\`${id}\``), `pn-kaynaklar.md içinde ${id} yok`);
  for (const s of D.SATIRLAR) {
    ok(s.dogrulama === 'iki-uretici-katalogu', 'düzey');
    ok(s.dogrulama !== 'standart-metni', 'standart metniyle doğrudan doğrulandı yazılmamalı');
    ok(/^\d{4}-\d{2}-\d{2}$/.test(s.dogrulamaTarihi) && s.standartSurum, 'tarih/sürüm');
  }
  // Doğrulayıcı hatalı satırları yakalar
  const kotu = [{ malzeme: 'PE100', od: 110, sdr: 17, enMin: 6.6, pn: 10, standart: 'EN 12201-2', standartSurum: 'x', dogrulamaTarihi: '2026-11-19', hatTurleri: ['ana'], kaynaklar: ['pl-ll', 'pl-ll'], pnKaynak: ['pl-ll'], dogrulama: 'iki-uretici-katalogu' },
    { malzeme: 'PEX', od: 50, sdr: 11, enMin: 30, pn: 11, dogrulama: 'dogrulanmadi', hatTurleri: ['lateral'], kaynaklar: ['yok'] }];
  const e = P.dogrula(kotu);
  for (const k of ['iki bağımsız üretici', 'PN için iki kaynak', 'malzeme', 'yarısından', 'standart PN', 'dogrulama', 'standartSurum', 'dogrulamaTarihi', 'hatTurleri', 'bilinmeyen kaynak'])
    ok(e.some(x => x.includes(k)), `yakalanmadı: ${k} — ${e.join('; ')}`);
  ok(P.dogrula([D.SATIRLAR[0], D.SATIRLAR[0]]).some(x => x.includes('yinelenen')), 'yinelenen satır');
});

test('P1-06 İç çap hesabı: dış çap − 2 × en küçük et', () => {
  near(P.icCap(P.bul('PE100', 110, 17)), 96.8, 1e-9, 'Ø110 SDR17');
  near(P.icCap(P.bul('PE100', 110, 11)), 90.0, 1e-9, 'Ø110 SDR11');
  near(P.icCap(P.bul('PE100', 315, 17)), 277.6, 1e-9, 'Ø315 SDR17');
  near(P.icCap(P.bul('PE80', 63, 11)), 51.4, 1e-9, 'PE80 Ø63 SDR11');
  for (const s of D.SATIRLAR) near(P.icCap(s), s.od - 2 * s.enMin, 0.051, `${s.od}/${s.sdr}`);
  ok(P.icCap(null) === null, 'null');
});

test('P1-07 Sıcaklık katsayısı: doğrulanmış tablo yok → null (değer uydurulmaz); aday ayrı tutulur', () => {
  for (const m of P.MALZEMELER) { ok(P.sicaklikKatsayisi(m, 20) === null && P.sicaklikKatsayisi(m, 30) === null, m); ok(P.sicaklikDurumu(m).durum === 'veri-eksik', m); }
  const a = P.sicaklikDurumu('PE100').aday;
  ok(a && a.neden === 'tek-kaynak' && a.noktalar[0][0] === 20 && a.noktalar[0][1] === 1, 'PE100 aday tablo (tek kaynak) saklı');
  ok(P.sicaklikDurumu('PVC-U').aday === null, 'PVC-U kaynak yok');
});

test('P1-08 Eski katalog karşılaştırması: bütün kayıtlar raporlanır, katalog değişmez', () => {
  const once = JSON.stringify(CAT);
  const k = P.karsilastir(CAT);
  ok(k.length === CAT.borular.pe.length + CAT.borular.pvc.length, 'her kayıt raporda');
  ok(JSON.stringify(CAT) === once, 'katalog değişmemeli');
  const by = id => k.find(x => x.id === id);
  ok(by('pe-110-pn10').durum === 'ayni' && by('pe-110-pn16').durum === 'ayni', 'PE100 PN10/16 Ø110 aynı');
  ok(by('pe-110-pn6').durum === 'aday-tek-kaynak', 'PE100 PN6 (SDR26) tek kaynak');
  ok(k.filter(x => x.malzeme === 'PVC-U').every(x => x.durum === 'karsilik-yok'), 'PVC-U karşılık yok');
  // Rapor belgesi güncel: her eski kaydın kimliği ve durumu belgede
  const r = doc('pn-1-karsilastirma.md');
  for (const x of k) ok(r.includes(`| ${x.id} |`) && r.includes(x.durum), `raporda yok: ${x.id}`);
});

test('P1-09 Geriye uyum: eski katalog doğrulaması aynı; kutuphane bölümü yalnız doğrulanır, seçim değişmez', () => {
  ok(Ct.checkCatalog(CAT).length === 0, 'varsayılan katalog');
  const ornek = { borular: { pe: [{ id: 'firma-pe-90-6', od: 90, pn: 6, ic: 83, fiyat: null }], pvc: [{ id: 'firma-pvc-110-6', od: 110, pn: 6, ic: 103.6, fiyat: null }] } };
  ok(Ct.checkCatalog(ornek).length === 0, 'app.js örnek katalog');
  ok(Ct.checkCatalog({ borular: { kutuphane: D.SATIRLAR } }).length === 0, 'etkin kütüphane geçerli');
  ok(Ct.checkCatalog({ borular: { kutuphane: [{ malzeme: 'PE100', od: 110 }] } }).length > 0, 'hatalı kütüphane yakalanır');
  ok(Ct.checkCatalog({ borular: { kutuphane: {} } }).some(x => x.includes('dizi')), 'dizi değil');
  const m = Ct.mergeCatalog(CAT, { borular: { kutuphane: D.SATIRLAR } });
  ok(JSON.stringify(m.borular.pe) === JSON.stringify(CAT.borular.pe) && JSON.stringify(m.borular.pvc) === JSON.stringify(CAT.borular.pvc), 'otomatik seçim listeleri değişmez');
});

test('P1-10 Motor ve arayüz bu modülü kullanmaz (PN-1 kapsamı)', () => {
  const src = f => fs.readFileSync(path.join(__dirname, '..', 'www', f), 'utf8');
  for (const f of ['js/engine.js', 'js/layout.js', 'js/hydraulics.js', 'js/assess.js', 'js/app.js', 'js/catalog-data.js'])
    ok(!/IrriPipes|IRRI_PIPES_DATA|pipes(-data)?\.js/.test(src(f)), `${f} kütüphaneyi kullanmamalı`);
  ok(!/pipes(-data)?\.js/.test(src('index.html')), 'index.html henüz yüklememeli (PN-2)');
});

test('P1-11 Sınır değerleri: en küçük ve en büyük çaplar var; kapsam dışı çaplar ve SDR’ler yok', () => {
  ok(P.bul('PE100', 32, 17) && P.bul('PE100', 315, 11), 'Ø32 ve Ø315 var');
  for (const od of [16, 20, 25, 355, 400]) ok(P.bul('PE100', od, 17) === null && P.bul('PE100', od, 11) === null, `Ø${od} kapsam dışı`);
  ok(P.bul('PE80', 40, 11) && P.bul('PE80', 63, 11) && !P.bul('PE80', 75, 11) && !P.bul('PE80', 25, 11), 'PE80 yalnız Ø40–63');
  for (const sdr of [0, -11, 11.0001, '11', NaN, null, undefined]) ok(P.bul('PE100', 110, sdr) === null, `SDR ${String(sdr)}`);
  for (const od of [0, -110, 110.5, '110', NaN, null]) ok(P.bul('PE100', od, 17) === null, `Ø ${String(od)}`);
  ok(P.bul('pe100', 110, 17) === null && P.bul('PVC', 110, 17) === null, 'malzeme adı birebir');
  ok(P.liste({ malzeme: 'PE100', pn: 12.5 }).length === 0 && P.liste({ malzeme: 'PE80', pn: 16 }).length === 0, 'PN12,5 PE100 ve PN16 PE80 yok');
  ok(P.sicaklikKatsayisi('PE100', NaN) === null && P.sicaklikKatsayisi('Bilinmeyen', 20) === null, 'sıcaklık geçersiz girdi');
});

test('P1-12 Geçersiz kayıtlar ve uluslararası alanlar doğrulanır', () => {
  const ok1 = Object.assign({}, D.SATIRLAR[0]);
  ok(P.dogrula([ok1]).length === 0, 'geçerli satır');
  const varyant = (fark, beklenen) => { const e = P.dogrula([Object.assign({}, ok1, fark)]); ok(e.some(x => x.includes(beklenen)), `${JSON.stringify(fark)} → ${beklenen}: ${e.join('; ')}`); };
  varyant({ sdr: 1 }, "2'den büyük"); varyant({ sdr: 0 }, 'pozitif'); varyant({ od: NaN }, 'pozitif'); varyant({ enMin: '2' }, 'pozitif');
  varyant({ pn: 7 }, 'standart PN'); varyant({ dogrulama: 'standart-metni-degil' }, 'dogrulama'); varyant({ hatTurleri: [] }, 'hatTurleri');
  varyant({ ulke: 'Türkiye' }, 'ISO 3166-1'); varyant({ uretici: 'Firma' }, 'katalogSurum'); varyant({ urunSerisi: '' }, 'boş olmayan');
  ok(P.dogrula([Object.assign({}, ok1, { ulke: 'TR', uretici: 'Firma', urunSerisi: 'Seri A', katalogKodu: 'X1', katalogSurum: '2026/1' })]).length === 0, 'üretici kaydı geçerli');
  for (const s of D.SATIRLAR) ok(s.standartBolgesi === 'EN' && s.esdegerStandart === 'ISO 4427-2' && s.uretici === null && s.ulke === null, 'standart tabanlı satır üreticiden bağımsız');
});

test('P1-13 Eski kayıtlar değişmeden kalır: katalog parmak izi, sayılar ve seçim listeleri', () => {
  const crypto = require('crypto');
  const h = crypto.createHash('sha256').update(JSON.stringify(CAT.borular)).digest('hex');
  ok(h === 'd092d1ee2e042d91319a9e4488f531ff28dc13ef09e9e364d8b41dc6e53b9021', `eski boru kataloğu değişti: ${h}`);
  ok(CAT.borular.pe.length === 28 && CAT.borular.pvc.length === 33 && CAT.borular.lateral.length === 2, 'kayıt sayıları');
  // Kütüphane yüklenmesi ve karşılaştırma eski kayıtları değiştirmez
  P.karsilastir(CAT); P.liste(); P.dogrula(D.SATIRLAR);
  ok(crypto.createHash('sha256').update(JSON.stringify(CAT.borular)).digest('hex') === h, 'işlemlerden sonra aynı');
  // Kütüphane verisi değiştirilemez (dondurulmuş): çağıran kod satırları bozamaz
  const s0 = P.liste()[0], et0 = s0.enMin;
  try { s0.enMin = 99; } catch (e) { /* katı kipte TypeError beklenir */ }
  ok(P.liste()[0].enMin === et0 && Object.isFrozen(s0) && Object.isFrozen(s0.kaynaklar) && Object.isFrozen(D.SATIRLAR), 'veri dondurulmuş');
});

test('P1-14 Sıcaklık belirsizliği kullanıcıya gösterilebilir; katsayı üretilmez', () => {
  const d = P.sicaklikDurumu('PE100');
  ok(d.durum === 'veri-eksik' && d.mesaj && d.belirsizlik.length >= 2, 'PE100 belirsizlik notları');
  ok(d.belirsizlik.some(x => x.includes('0,87')) && d.belirsizlik.some(x => x.includes('0,85')), 'iki değer kümesi de görünür');
  ok(P.sicaklikDurumu('PVC-U').belirsizlik.length === 0 && P.sicaklikDurumu('PVC-U').mesaj, 'PVC-U yalnız eksik veri mesajı');
  for (const T of [20, 25, 30, 40, 50]) ok(P.sicaklikKatsayisi('PE100', T) === null, `PE100 ${T} °C null`);
});

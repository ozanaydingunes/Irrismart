// Sürüm yükseltmesinde yerel veri korunumu (PR-A, Capacitor 8 / API 36).
// fixtures/localstorage-v0.6.0.json: v0.6.0 (Capacitor 6) uygulamasının arayüzünden proje oluşturulup
// fiyat ayarı değiştirildikten sonra alınan gerçek localStorage dökümüdür. Yeni sürüm aynı paket adı
// ve aynı WebView kökeniyle (https://localhost) bu veriyi okur; burada okuma/geçiş katmanı doğrulanır.
const { E, test, ok, near, W } = require('./_lib');
const St = require(W('store.js'));
const LS = require('./fixtures/localstorage-v0.6.0.json');
const KEY = 'irrismart.projects.v1', SKEY = 'irrismart.settings.v1';

test('Yükseltme: v0.6.0 depolama anahtarları değişmedi', () => {
  ok(LS[KEY] && LS[SKEY], 'fixture anahtarları eksik');
  const app = require('fs').readFileSync(W('app.js'), 'utf8');
  for (const k of [KEY, SKEY, 'irrismart.catalog.v1']) ok(app.includes(`'${k}'`), `app.js artık ${k} anahtarını kullanmıyor (veri kaybı riski)`);
});

test('Yükseltme: v0.6.0 projeleri kayıpsız okunur, kurtarmaya düşmez', () => {
  const raw = LS[KEY], orig = JSON.parse(raw), r = St.parseProjects(raw);
  ok(!r.corrupt && !r.rescue, 'geçerli veri kurtarma alanına taşındı');
  ok(r.projects.length === orig.length && orig.length > 0, 'proje sayısı değişti');
  r.projects.forEach((p, i) => {
    const o = orig[i];
    ok(p.id === o.id && p.name === o.name, 'kimlik/ad değişti');
    ok(JSON.stringify(p.inp) === JSON.stringify(o.inp), 'girdiler değişti');
    ok(JSON.stringify(p.poly) === JSON.stringify(o.poly) && p.src === o.src, 'harita verisi değişti');
    ok(JSON.stringify(p.revs) === JSON.stringify(o.revs) && p.rev === o.rev, 'revizyon geçmişi değişti');
    ok(p.created === o.created && p.updated === o.updated, 'tarihler değişti');
  });
});

test('Yükseltme: şema geçişi tekrarlandığında veri değişmez (idempotent)', () => {
  const once = St.parseProjects(LS[KEY]).projects, twice = St.parseProjects(JSON.stringify(once));
  ok(!twice.migrated && !twice.rescue, 'ikinci okumada yeniden geçiş/kurtarma');
  ok(JSON.stringify(twice.projects) === JSON.stringify(once), 'ikinci okumada veri değişti');
});

test('Yükseltme: kullanıcı fiyat ayarları korunur ve hesapta kullanılır', () => {
  const s = JSON.parse(LS[SKEY]);
  near(s.elektrik, 4.25, 1e-12, 'elektrik fiyatı'); ok(s.edited && s.edited.elektrik === true, 'kullanıcı düzenleme işareti');
  const p = St.parseProjects(LS[KEY]).projects[0];
  const r = E.design(p.inp, s);
  ok(r.ok, 'eski proje yeni sürümde hesaplanamadı: ' + (r.err || []).join('; '));
  ok(r.sectors.Ns === 6, `shift sayısı değişti (${r.sectors.Ns})`);
  near(r.sectors.Qsec, 36.2, 0.05, 'en büyük shift debisi');
  near(r.schedule.energyCost, r.schedule.kWh * 4.25, 1e-6, 'enerji maliyeti kullanıcı fiyatıyla');
});

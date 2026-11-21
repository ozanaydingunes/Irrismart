// Çeviri kapsamı: koddaki her t()/T()/tr() metninin ve ekran etiketlerinin 7 dilde karşılığı var mı, yer tutucular korunmuş mu
const fs = require('fs'), path = require('path');
const { W, test, ok } = require('./_lib');
const D = require(W('i18n-dict.js'));
const LANGS = ['en', 'de', 'es', 'ru', 'it', 'he', 'zh'];
const SKIP = new Set(['da', 'ET', 'T', 'h', 'm', 'q', 'l/h', 'Sd', 'n', 'mm/h', 'm³/h', 'PN', 'Kc', 'Kr', 'Max Shift (h)', 'Shift #', 'Ø16 mm', 'Ø20 mm', 'Field 1', 'Hata: ']);
const DYN = ['Kuyu', 'Yüzey suyu', 'Şebeke / hidrant', 'Su kaynağı', 'Göl/kanal/havuz', 'Şebeke/hidrant', 'Pompa', 'Parsel sınırı', 'Shift sınırı', 'Ana hat (PVC-U)', 'Manifold (PE100)', 'Pompa istasyonu', 'Filtre istasyonu', 'Gübreleme ünitesi', 'Kontrol istasyonu', 'Ana kesme vanası', 'Çekvalf', 'Shift (parsel) vanası', 'Basınç regülatörü', 'Hava tahliye / vakum kırıcı', 'Yıkama vanası', 'Redüksiyon (çap değişimi)', 'Ana hat sonu yıkama vanası',
  'Parsel', 'Ekipman', 'Etiketler', 'Shift kutuları', 'Tablolar', 'Müşteri / işletme', 'İl', 'İlçe', 'Mevki', 'Proje mühendisi', 'Proje tarihi', 'Pafta no', 'Yatay', 'Dikey', 'Renkli', 'Siyah-beyaz', 'Tek pafta', 'Çoklu pafta', 'Otomatik', 'yatay', 'dikey'];
function keys() {
  const out = new Set();
  for (const f of ['app.js', 'report.js', 'report-data.js', 'validate.js', 'drawing.js', 'assess.js', 'assess-view.js', 'platform.js', 'desk.js', 'shift-yonetimi.js', 'katalog-ui.js']) {
    const s = fs.readFileSync(W(f), 'utf8');
    for (const m of s.matchAll(/\b(?:t|T|tr|sn)\(\s*'((?:[^'\\]|\\.)*)'/g)) out.add(m[1].replace(/\\'/g, "'"));
  }
  // MH-WEB-2 masaüstü paneli: başlık, KPI, satır ve sekme etiketleri yardımcı işlevlerle çevrilir
  const dk = fs.readFileSync(W('desk.js'), 'utf8');
  for (const re of [/\b(?:head|kpi)\(\s*'([^']+)'/g, /\[\s*'([^']+)',\s*(?:N\(|api\.|esc\(|`)/g, /\['\w+', '([^']+)'\]/g]) for (const m of dk.matchAll(re)) out.add(m[1]);
  const h = fs.readFileSync(path.join(__dirname, '..', 'www', 'index.html'), 'utf8');
  for (const m of h.matchAll(/data-i18n>([^<]+)</g)) out.add(m[1].trim());
  const a = fs.readFileSync(W('app.js'), 'utf8');
  const form = a.slice(a.indexOf('const FORM = ['), a.indexOf('function renderForm'));
  for (const m of form.matchAll(/\['\w+', '([^']+)'/g)) out.add(m[1]);
  for (const m of form.matchAll(/\['\w*', '([^']+)'\]/g)) out.add(m[1]);
  for (const m of form.matchAll(/^\s*\['([^']+)', \[/gm)) out.add(m[1]);
  const d = fs.readFileSync(W('data.js'), 'utf8');
  for (const m of d.matchAll(/ad: '([^']+)'/g)) out.add(m[1]);
  // Firma katalogları: grup/belge türü/kaynak adları ve geri yükleme hata metinleri değişkenle çevrilir
  const ku = fs.readFileSync(W('katalog-ui.js'), 'utf8');
  for (const satir of ku.split('\n').filter(x => /^\s*const (GRUP|TUR|KAYNAK) = /.test(x))) for (const m of satir.matchAll(/: '([^']+)'/g)) out.add(m[1]);
  for (const m of fs.readFileSync(W('katalog-model.js'), 'utf8').matchAll(/hata: '([^']+)'/g)) out.add(m[1]);
  // değişkenle çevrilen metinler (t(x) biçiminde, kaynakta sabit olarak yazılı)
  for (const k of DYN) out.add(k);
  return [...out].filter(k => k.trim() && !SKIP.has(k));
}
test('Her arayüz metninin 7 dilde çevirisi var', () => {
  const miss = [];
  for (const k of keys()) for (const l of LANGS) if (!(D[k] && D[k][l])) miss.push(`${l}: ${k}`);
  ok(miss.length === 0, `${miss.length} eksik çeviri:\n  ` + miss.slice(0, process.env.ALL ? 9999 : 25).join('\n  '));
});
test('Çevirilerde {yer tutucular} korunmuş', () => {
  const bad = [];
  for (const [k, e] of Object.entries(D)) { const ph = (k.match(/\{\w+\}/g) || []).sort().join(); for (const l of LANGS) if (e[l] && (e[l].match(/\{\w+\}/g) || []).sort().join() !== ph) bad.push(`${l}: ${k}`); }
  ok(!bad.length, bad.join('\n'));
});
test('t(): seçili dil, yer tutucu ve İngilizce/Türkçe yedeği', () => {
  globalThis.IRRI_DICT = D; const I = require(W('i18n.js'));
  ok(I.t('Hesapla') === 'Hesapla', 'varsayılan Türkçe');
  return I.withLang('de', () => {
    ok(I.t('Hesapla') === 'Berechnen', 'Almanca');
    ok(I.t('{n} proje yüklendi', { n: 3 }) === '3 Projekte geladen', 'yer tutucu');
    ok(I.t('Sözlükte olmayan metin') === 'Sözlükte olmayan metin', 'yedek');
  }).then(() => ok(I.t('Hesapla') === 'Hesapla', 'geçici dil sonrası geri dönüş'));
});

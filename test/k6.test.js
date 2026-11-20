// K-6 — IrriGrow 1.0.0 sürüm adayı: sürüm tek kaynak, Android kimliği ve güncelleme uyumu
const fs = require('fs'), path = require('path');
const { test, ok, W } = require('./_lib');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const V = require(W('version.js'));
const pkg = JSON.parse(R('package.json')), lock = JSON.parse(R('package-lock.json'));
const gradle = R('android/app/build.gradle'), cap = JSON.parse(R('capacitor.config.json')), wf = R('.github/workflows/apk.yml');

test('K6-01 Sürüm 1.0.0 her yerde aynı: package.json, package-lock, version.js, Android versionName', () => {
  ok(pkg.version === '1.0.0' && V.surum === '1.0.0', `package.json ${pkg.version} / version.js ${V.surum}`);
  ok(lock.version === pkg.version && lock.packages[''].version === pkg.version, 'package-lock');
  const vn = gradle.match(/versionName "([^"]+)"/)[1];
  ok(vn === pkg.version, `versionName ${vn}`);
});

test('K6-02 versionCode bir artırıldı (0.6.1 = 9 → 1.0.0 = 10); version.js ile aynı', () => {
  const vc = +gradle.match(/^\s*versionCode (\d+)$/m)[1];
  ok(vc === 10 && V.kod === vc, `versionCode ${vc} / ${V.kod}`);
});

test('K6-03 Uygulama kimliği ve imza anahtarı değişmedi (eski kurulumun üzerine güncelleme, veriler korunur)', () => {
  ok(/applicationId "com\.irrigrow\.app\.dev"/.test(gradle) && /namespace = "com\.irrigrow\.app\.dev"/.test(gradle) && cap.appId === 'com.irrigrow.app.dev', 'paket kimliği');
  ok(cap.server.androidScheme === 'https' && cap.server.hostname === 'localhost', 'WebView kökeni (localStorage) değişmemeli');
  ok(/storeFile file\('irrismart-debug\.keystore'\)/.test(gradle) && fs.existsSync(path.join(__dirname, '..', 'android', 'app', 'irrismart-debug.keystore')), 'debug anahtarı');
  ok(/EXPECT_CERT: 457741305275221a657c6594ff0e489316e2b1eef2c184bc4434c4e06bb20b2e/.test(wf), 'CI sertifika denetimi');
});

test('K6-04 CI: APK adı ve indirme paketi sürümü taşır; versionName ve v2 imza şeması denetlenir', () => {
  ok(/APK_DOSYA=IrriGrow-\$V-debug\.apk/.test(wf) && /name: IrriGrow-\$\{\{ env\.IRRI_SURUM \}\}-debug-apk/.test(wf), 'adlar');
  ok(/test "\$VN" = "\$IRRI_SURUM"/.test(wf) && /APK Signature Scheme v2\): true/.test(wf) && /sha256sum/.test(wf), 'denetimler');
});

test('K6-05 Arayüzde sürüm elle yazılmıyor; index.html version.js’i ilk yükler', () => {
  const app = R('www/js/app.js'), idx = R('www/index.html');
  ok(!/IrriGrow v\d/.test(app) && /window\.IRRI_SURUM/.test(app), 'app.js sabit sürüm içeriyor');
  ok(idx.indexOf('js/version.js') > 0 && idx.indexOf('js/version.js') < idx.indexOf('js/app.js'), 'yükleme sırası');
});

test('K6-06 Sürüm adayı "yayına hazır" olarak işaretlenmedi; yayın kontrol listesi ve cihaz test listesi var', () => {
  const liste = R('docs/k6-cihaz-test-listesi.md'), yayin = R('docs/yayin-kontrol-listesi.md');
  ok(/Sürüm adayı/.test(liste) && /yayına hazır değildir/i.test(liste), 'cihaz listesi durumu');
  for (const k of ['Uygulama kimliği', 'AAB', 'imza', 'Gizlilik', 'Open-Meteo', 'Esri']) ok(yayin.includes(k), 'yayın listesinde eksik: ' + k);
  ok(!/yayına hazır(?! değil)/i.test(R('www/js/app.js') + R('www/js/version.js')), 'uygulama "yayına hazır" dememeli');
});

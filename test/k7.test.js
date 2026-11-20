// K-7 — Play Store hazırlığı: yayın imzası yalnız gizli değişkenlerden, geliştirme kimliği Play'e gitmez, belgeler tam
const fs = require('fs'), path = require('path');
const { test, ok } = require('./_lib');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const gradle = R('android/app/build.gradle'), wf = R('.github/workflows/aab.yml'), sh = R('ci/build-apk.sh');

test('K7-01 Yayın imzası yalnız ortam değişkenlerinden; depoda yayın anahtarı veya şifresi yok', () => {
  const rel = gradle.slice(gradle.indexOf('        release {'), gradle.indexOf('buildTypes'));
  ok(/System\.getenv\('IRRIGROW_UPLOAD_KEYSTORE'\)/.test(rel) && /System\.getenv\('IRRIGROW_UPLOAD_STORE_PASSWORD'\)/.test(rel), 'release ortamdan okunmalı');
  ok(!/storePassword '|keyPassword '/.test(rel), 'release içinde sabit şifre olmamalı');
  ok(/if \(System\.getenv\('IRRIGROW_UPLOAD_KEYSTORE'\)\) signingConfig signingConfigs\.release/.test(gradle), 'release yalnız anahtar varsa imzalanmalı');
  const jks = [];
  const tara = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { if (['node_modules', '.git', 'build', '.gradle'].includes(f.name)) continue; const p = path.join(d, f.name); if (f.isDirectory()) tara(p); else if (/\.(jks|keystore|p12)$/i.test(f.name)) jks.push(path.relative(path.join(__dirname, '..'), p)); } };
  tara(path.join(__dirname, '..'));
  ok(jks.length === 1 && jks[0] === path.join('android', 'app', 'irrismart-debug.keystore'), 'depoda yalnız debug anahtarı olmalı: ' + jks.join(', '));
});

test('K7-02 AAB iş akışı: kimlik denetimi, gizli değişkenler, şifreler GITHUB_ENV’e yazılmaz', () => {
  ok(/\*\.dev\|\*\.debug\|\*\.test\) echo "HATA: Play için geliştirme kimliği/.test(wf), '.dev kimliği reddedilmeli');
  ok(/secrets\.IRRIGROW_UPLOAD_KEYSTORE_B64/.test(wf) && /secrets\.IRRIGROW_UPLOAD_STORE_PASSWORD/.test(wf), 'gizli değişkenler');
  const envYaz = wf.split('\n').filter(l => /GITHUB_ENV/.test(l) || /^\s+echo "IRRIGROW_/.test(l)).join('\n');
  ok(!/PASSWORD|KEY_ALIAS=/.test(envYaz), 'şifre GITHUB_ENV’e yazılmamalı');
  ok(/rm -f "\$RUNNER_TEMP\/upload\.jks"/.test(wf) && /permissions:\n\s+contents: read/.test(wf), 'geçici anahtar silinmeli; salt okuma izni');
  ok(/if \(project\.hasProperty\('irrigrowAppId'\)\) applicationId/.test(gradle) && /applicationId "com\.irrigrow\.app\.dev"/.test(gradle), 'kimlik yalnız komut satırından değişir');
  ok(/GOREV="\$\{GOREV:-assembleDebug\}"/.test(sh), 'debug APK varsayılan kalmalı');
});

test('K7-03 Gizlilik ve veri güvenliği belgeleri uygulamanın gerçek davranışını kapsar', () => {
  const g = R('docs/gizlilik-politikasi.md'), v = R('docs/play-veri-guvenligi.md'), k = R('docs/k7-play-store.md');
  for (const s of ['Esri', 'Open-Meteo', 'Android sistem yedeklemesi', '◎', 'KML/KMZ', 'reklam', '[İLETİŞİM E-POSTASI]', 'KVKK']) ok(g.includes(s), 'gizlilik: ' + s);
  const en = R('docs/privacy-policy.md');
  for (const s of ['Esri', 'Open-Meteo', 'Android system backup', '◎', 'KML/KMZ', 'advertising', '[CONTACT E-MAIL]', 'GDPR']) ok(en.includes(s), 'privacy: ' + s);
  ok(g.split('\n## ').length === en.split('\n## ').length, 'TR ve EN bölüm sayısı aynı olmalı');
  ok(/allowBackup="true"/.test(R('android/app/src/main/AndroidManifest.xml')), 'allowBackup değişirse gizlilik metni güncellenmeli');
  for (const s of ['Kesin konum', 'HTTPS', 'ACCESS_FINE_LOCATION', 'Analiz SDK']) ok(v.includes(s), 'veri güvenliği: ' + s);
  for (const s of ['com.irrigrow.app', 'Play App Signing', 'YAYIN ENGELİ', 'çözülmedi', 'MH-AKIL-5']) ok(k.includes(s), 'K-7: ' + s);
  const r = R('docs/k7-aab-rehberi.md');
  for (const s of ['IRRIGROW_UPLOAD_KEYSTORE_B64', 'IRRIGROW_UPLOAD_STORE_PASSWORD', 'IRRIGROW_UPLOAD_KEY_ALIAS', 'IRRIGROW_UPLOAD_KEY_PASSWORD', 'keytool -genkeypair', 'Yayın engeli', 'Dahili test']) ok(r.includes(s), 'rehber: ' + s);
  for (const s of ['IRRIGROW_UPLOAD_KEYSTORE_B64', 'IRRIGROW_UPLOAD_STORE_PASSWORD', 'IRRIGROW_UPLOAD_KEY_ALIAS', 'IRRIGROW_UPLOAD_KEY_PASSWORD']) ok(wf.includes('secrets.' + s), 'iş akışı gizli değişkeni ile rehber aynı olmalı: ' + s);
});

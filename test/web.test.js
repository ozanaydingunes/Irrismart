// MH-WEB-1 — Web yayını ve platform ayrımı (W-6, W-7) için kalıcı denetimler.
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { test, ok, W } = require('./_lib');
const ROOT = path.join(__dirname, '..');
const yml = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'pages.yml'), 'utf8');

test('Pages iş akışı: yalnız main ve elle başlatma; testler geçmeden yayın yok; www/ yayımlanır', () => {
  ok(/on:\s*\n\s*push:\s*\n\s*branches: \[main\]/.test(yml), 'main tetikleyicisi yok');
  const dep = yml.slice(yml.indexOf('  deploy:'));
  ok(/needs: test/.test(dep), 'dağıtım testlere bağlı değil');
  ok(dep.includes("if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'"), 'dağıtım yalnız main ile sınırlı değil (PR yayımlanmamalı)');
  for (const step of ['npm test', 'node tools/audit.js', 'npm run test:ui', 'npm run test:web', 'node tools/secret-scan.js www']) ok(yml.includes(step), `yayın öncesi adım eksik: ${step}`);
  ok(/upload-pages-artifact@v\d+[\s\S]*path: www/.test(yml), 'yayımlanan klasör www olmalı');
  ok(!/secrets\./.test(yml), 'iş akışı gizli anahtar kullanmamalı');
});
test('Android derleme iş akışı korunuyor (apk.yml ayrı ve değişmedi: test → apk)', () => {
  const apk = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'apk.yml'), 'utf8');
  ok(/name: APK derle/.test(apk) && apk.includes('bash ci/build-apk.sh') && apk.includes('apksigner') && !/deploy-pages|upload-pages-artifact/.test(apk), 'apk.yml değişmiş görünüyor');
});
test('Gizli anahtar taraması: www temiz; sahte anahtar yakalanır', () => {
  const run = d => { try { cp.execFileSync('node', [path.join(ROOT, 'tools', 'secret-scan.js'), d], { stdio: 'pipe' }); return 0; } catch (e) { return e.status; } };
  ok(run(path.join(ROOT, 'www')) === 0, 'www içinde gizli anahtar kalıbı var');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'irri-sec-'));
  fs.writeFileSync(path.join(tmp, 'a.js'), "const k = 'AIza" + 'x'.repeat(35) + "';");
  ok(run(tmp) === 1, 'tarama sahte Google anahtarını yakalamadı');
});
test('Platform ayrımı: Android (Capacitor) ortamında web notu üretilmez; hesap kodu platformdan bağımsız', () => {
  const src = fs.readFileSync(W('platform.js'), 'utf8');
  ok(/if \(isNative\(\) \|\| !g\.document\) return;/.test(src), 'yerel platform denetimi yok');
  for (const f of ['engine.js', 'hydraulics.js', 'layout.js', 'geom.js', 'assess.js', 'report-data.js', 'store.js']) ok(!/Capacitor|IrriPlatform/.test(fs.readFileSync(W(f), 'utf8')), `${f} platforma bağımlı olmamalı`);
  const html = fs.readFileSync(path.join(ROOT, 'www', 'index.html'), 'utf8');
  ok(!/(src|href)="\//.test(html), 'index.html mutlak yol içeriyor (alt yolda yayın bozulur)');
});

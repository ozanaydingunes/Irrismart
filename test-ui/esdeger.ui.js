#!/usr/bin/env node
// Masaüstü tarafı eşdeğerlik parmak izi (Chromium, 1280 px ve 390 px). Çıktı: SHA-256 özet + JSON dosyası.
// Android tarafı aynı işlevleri emülatör WebView'unda çalıştırır (ci/esdeger-android.js); özetler karşılaştırılır.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PI = require('../ci/parmak-izi.js');
const ROOT = path.join(__dirname, '..', 'www');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };
(async () => {
  const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const browser = await chromium.launch(), ozetler = [];
  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: vp }); await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
    const pg = await ctx.newPage(); await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForTimeout(600);
    await pg.evaluate(PI.kur); const iz = await pg.evaluate(PI.iz);
    const json = JSON.stringify(iz), h = crypto.createHash('sha256').update(json).digest('hex');
    ozetler.push(h); fs.writeFileSync(process.env.ESDEGER_OUT || 'esdeger-masaustu.json', json);
    console.log(`[ESD] masaüstü ${vp.width}px ${h}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  const ok = ozetler.every(x => x === ozetler[0]);
  console.log(ok ? '[ESD] GEÇTİ masaüstü 1280 px ve 390 px aynı parmak izi' : '[ESD] KALDI masaüstü ekran boyutları farklı sonuç verdi');
  process.exit(ok ? 0 : 1);
})();

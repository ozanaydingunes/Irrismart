#!/usr/bin/env node
// IrriGrow — yerel önizleme sunucusu (kabul testi için): `npm run onizleme` veya `node tools/onizleme.js`
//
// • Yalnız bu bilgisayardan erişilir (127.0.0.1); ağa açılmaz.
// • `www/` klasörünü olduğu gibi sunar; uygulama kodunu değiştirmez.
// • Tarayıcı deposu adrese (origin) bağlıdır: http://127.0.0.1:<port> canlı siteden
//   (https://ozanaydingunes.github.io) tamamen ayrıdır. Önizleme canlı sitedeki projeleri
//   göremez ve değiştiremez; canlı site de önizlemedeki projeleri görmez.
// • Ek paket gerektirmez (yalnız Node.js).
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..', 'www');
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || process.argv[2]) || 8090;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

// İstenen yolu www/ içine sınırlar; dışarı çıkan (../) veya geçersiz yolları reddeder.
function resolveSafe(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]); } catch (e) { return null; }
  if (p.includes('\0')) return null;
  const f = path.resolve(ROOT, '.' + (p.endsWith('/') ? p + 'index.html' : p));
  return f === ROOT || f.startsWith(ROOT + path.sep) ? f : null;
}

// Sekme başlığına "ÖNİZLEME" eklenir: canlı siteyle karışmasın. Uygulama dosyası değişmez.
const MARK = '<script>document.addEventListener("DOMContentLoaded",function(){document.title="ÖNİZLEME · "+document.title})</script>';

function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  const f = resolveSafe(req.url);
  if (!f) { res.writeHead(400); return res.end('Geçersiz yol'); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Bulunamadı'); }
    const ext = path.extname(f).toLowerCase();
    if (ext === '.html') data = Buffer.from(String(data).replace('</head>', MARK + '</head>'));
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}

function start(port = PORT, host = HOST) {
  const srv = http.createServer(handler);
  return new Promise((ok, fail) => { srv.once('error', fail); srv.listen(port, host, () => ok(srv)); });
}

if (require.main === module) {
  start().then(srv => {
    const url = `http://${HOST}:${srv.address().port}/`;
    console.log('\nIrriGrow önizleme sunucusu çalışıyor\n');
    console.log('  Adres:   ' + url);
    console.log('  Klasör:  ' + ROOT);
    console.log('\n  • Yalnız bu bilgisayardan açılır; ağa kapalıdır.');
    console.log('  • Canlı siteden ayrı bir tarayıcı deposu kullanır: canlı sitedeki projeleriniz değişmez.');
    console.log('  • Kendi projelerinizle denemek için canlı sitede "Yedekle (JSON)", burada "Yedek ▾ → Yedekten yükle".');
    console.log('  • Masaüstü düzeni için pencere en az 1200 px genişlikte olmalı.');
    console.log('\n  Durdurmak için bu pencerede Ctrl+C.\n');
  }).catch(e => {
    if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} kullanımda. Başka bir port deneyin: node tools/onizleme.js 8091`);
    else console.error(e.message);
    process.exit(1);
  });
}

module.exports = { start, resolveSafe, ROOT };

// Yerel önizleme sunucusu (tools/onizleme.js): yalnız www/ içini, yalnız 127.0.0.1'den sunar
const path = require('path'), http = require('http');
const { test, ok } = require('./_lib');
const O = require(path.join(__dirname, '..', 'tools', 'onizleme.js'));
const get = (port, p) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port, path: p }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res({ s: r.statusCode, t: r.headers['content-type'], b })); }).on('error', rej));

test('Önizleme: www/ dışına çıkan yollar reddedilir', () => {
  ok(O.resolveSafe('/index.html') === path.join(O.ROOT, 'index.html'), 'index');
  ok(O.resolveSafe('/') === path.join(O.ROOT, 'index.html'), 'kök');
  for (const p of ['/../package.json', '/%2e%2e/package.json', '/js/../../tools/onizleme.js', '/%00', '/%E0%A4%A']) ok(O.resolveSafe(p) === null, 'reddedilmedi: ' + p);
});
test('Önizleme: sayfa, betik ve başlık işareti; yalnız yerel adres', async () => {
  const srv = await O.start(0); const port = srv.address().port;
  try {
    ok(srv.address().address === '127.0.0.1', 'yalnız 127.0.0.1');
    const h = await get(port, '/'); ok(h.s === 200 && /text\/html/.test(h.t) && h.b.includes('ÖNİZLEME · '), 'index + işaret');
    const j = await get(port, '/js/engine.js'); ok(j.s === 200 && /javascript/.test(j.t), 'betik');
    ok((await get(port, '/../package.json')).s !== 200, 'dışarı çıkış');
    ok((await get(port, '/yok.js')).s === 404, '404');
  } finally { srv.close(); }
});

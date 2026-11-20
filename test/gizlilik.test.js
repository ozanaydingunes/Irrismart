// Gizlilik politikası sayfaları (TR/EN): yer tutucu kalmaz, yayın notu sayfaya girmez, bilgi eksikse sayfa üretilmez
const fs = require('fs'), path = require('path');
const { test, ok } = require('./_lib');
const G = require('../tools/gizlilik-sayfa.js');
const ORNEK = { gelistirici: 'Örnek Geliştirici', eposta: 'iletisim@example.com', tarih: '2026-12-01' };
const KOK = path.join(__dirname, '..');

test('GZ-01 Bilgi eksik veya hatalıysa sayfa üretilmez', () => {
  const at = b => { try { G.uret(b); return null; } catch (e) { return e.message; } };
  ok(/Eksik alan: gelistirici, eposta, tarih/.test(at({ gelistirici: '', eposta: '', tarih: '' })), 'boş alanlar');
  ok(/Geçersiz e-posta/.test(at({ ...ORNEK, eposta: 'yok' })) && /Tarih/.test(at({ ...ORNEK, tarih: '01.12.2026' })), 'biçim denetimi');
});

test('GZ-02 Örnek bilgilerle TR ve EN sayfaları: yer tutucu yok, yayın notu yok, bütün bölümler, e-posta bağlantısı', () => {
  const s = G.uret(ORNEK), tr = s['www/gizlilik.html'], en = s['www/privacy.html'];
  for (const [h, dil, n] of [[tr, 'tr', 'Örnek Geliştirici'], [en, 'en', 'Örnek Geliştirici']]) {
    ok(h.startsWith('<!doctype html>') && h.includes(`<html lang="${dil}">`) && h.includes('<meta name="viewport"'), dil + ': iskelet');
    ok(!/\[[A-ZÇĞİÖŞÜ .-]+\]/.test(h), dil + ': yer tutucu kaldı');
    ok(!/Yayın notu|Publishing note/.test(h), dil + ': yayın notu sayfaya girmiş');
    ok(h.includes(n) && h.includes('href="mailto:iletisim@example.com"'), dil + ': ad / e-posta');
    ok((h.match(/<h2>/g) || []).length === 10 && h.includes('<table>') && h.includes('Open-Meteo') && h.includes('Esri'), dil + ': bölümler/tablo');
    ok(!/<script/i.test(h), dil + ': betik olmamalı');
  }
  ok(tr.includes('01.12.2026') && en.includes('2026-12-01'), 'tarih biçimi');
  ok(tr.includes('href="privacy.html"') && en.includes('href="gizlilik.html"'), 'dil bağlantıları');
});

test('GZ-03 Yayımlanan sayfalar varsa bilgi dosyasıyla ve metinle güncel olmalı', () => {
  const b = JSON.parse(fs.readFileSync(path.join(KOK, 'docs', 'gizlilik-bilgileri.json'), 'utf8'));
  const var1 = fs.existsSync(path.join(KOK, 'www', 'gizlilik.html')), var2 = fs.existsSync(path.join(KOK, 'www', 'privacy.html'));
  ok(var1 === var2, 'iki sayfa birlikte yayımlanmalı');
  if (!var1) { ok(G.bilgileriDenetle(b) !== null, 'bilgiler doluysa sayfalar da üretilmeli'); return; }
  const s = G.uret(b);
  for (const f of Object.keys(s)) ok(fs.readFileSync(path.join(KOK, f), 'utf8') === s[f], f + ' güncel değil (node tools/gizlilik-sayfa.js)');
});

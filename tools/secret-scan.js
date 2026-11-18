#!/usr/bin/env node
// Yayımlanacak dosyalarda gizli anahtar / jeton kalıbı taraması (MH-WEB-1, W-6).
// Kullanım: node tools/secret-scan.js <klasör> [...]
// Bulursa çıkış kodu 1 olur ve dosya:satır listelenir (değerin kendisi yazdırılmaz).
const fs = require('fs'), path = require('path');
const PATTERNS = [
  ['Google API anahtarı', /AIza[0-9A-Za-z_-]{35}/],
  ['AWS erişim anahtarı', /AKIA[0-9A-Z]{16}/],
  ['GitHub jetonu', /gh[pousr]_[0-9A-Za-z]{36,}/],
  ['OpenAI/Anthropic benzeri anahtar', /\bsk-(?:ant-)?[0-9A-Za-z_-]{20,}/],
  ['Slack jetonu', /xox[baprs]-[0-9A-Za-z-]{10,}/],
  ['Özel anahtar bloğu', /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['Esri/ArcGIS API anahtarı', /AAPK[0-9A-Za-z_-]{20,}/],
  ['URL içinde anahtar/jeton', /[?&](?:api[_-]?key|apikey|access_token|token|key)=[0-9A-Za-z_-]{16,}/i],
  ['Atanmış gizli değer', /\b(?:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*['"][^'"\s]{12,}['"]/i],
];
const SKIP = /\.(png|jpe?g|gif|webp|ico|ttf|woff2?|pdf|zip)$/i;
const found = [];
function walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) { for (const f of fs.readdirSync(p)) walk(path.join(p, f)); return; }
  if (SKIP.test(p)) return;
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  lines.forEach((ln, i) => { for (const [ad, re] of PATTERNS) if (re.test(ln)) found.push(`${p}:${i + 1} — ${ad}`); });
}
const roots = process.argv.slice(2); if (!roots.length) roots.push('www');
roots.forEach(walk);
if (found.length) { console.log('Gizli anahtar kalıbı bulundu:\n  ' + found.join('\n  ')); process.exit(1); }
console.log(`Gizli anahtar taraması temiz (${roots.join(', ')}).`);
module.exports = { PATTERNS };

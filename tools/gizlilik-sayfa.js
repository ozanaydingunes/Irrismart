#!/usr/bin/env node
// Gizlilik politikası sayfaları: docs/gizlilik-politikasi.md (TR) ve docs/privacy-policy.md (EN) → www/gizlilik.html, www/privacy.html
// Geliştirici adı, iletişim e-postası ve yürürlük tarihi yalnız docs/gizlilik-bilgileri.json'dan okunur.
// Alanlardan biri boşsa sayfa ÜRETİLMEZ (yer tutuculu sayfa yayına çıkamaz).
//   node tools/gizlilik-sayfa.js           → sayfaları yazar
//   node tools/gizlilik-sayfa.js --check   → yazmaz; www'deki sayfalar güncel değilse hata verir
const fs = require('fs'), path = require('path');
const KOK = path.join(__dirname, '..');
const R = f => fs.readFileSync(path.join(KOK, f), 'utf8');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Satır içi biçim: **kalın**, `kod`, köprü (yalnız https)
const satir = s => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/(https:\/\/[^\s)<,]+[^\s)<,.])/g, '<a href="$1" rel="noopener">$1</a>');

// Bu belgelerdeki sınırlı Markdown: #/## başlık, paragraf, - liste, | tablo, > blok (yayın notu — atlanır)
function md2html(md) {
  const L = md.replace(/\r/g, '').split('\n'), out = [];
  let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (!l.trim()) { i++; continue; }
    if (l.startsWith('>')) { while (i < L.length && L[i].startsWith('>')) i++; continue; }   // yayın notu sayfaya konmaz
    if (l.startsWith('## ')) { out.push(`<h2>${satir(l.slice(3))}</h2>`); i++; continue; }
    if (l.startsWith('# ')) { out.push(`<h1>${satir(l.slice(2))}</h1>`); i++; continue; }
    if (l.startsWith('|')) {
      const rows = []; while (i < L.length && L[i].startsWith('|')) rows.push(L[i++]);
      const hucre = r => r.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
      const [bas, , ...govde] = rows;
      out.push(`<div class="tw"><table><thead><tr>${hucre(bas).map(h => `<th>${satir(h)}</th>`).join('')}</tr></thead><tbody>${govde.map(r => `<tr>${hucre(r).map(h => `<td>${satir(h)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^- /.test(l)) {
      const it = [];
      while (i < L.length && (/^- /.test(L[i]) || /^  \S/.test(L[i]))) { if (/^- /.test(L[i])) it.push(L[i].slice(2)); else it[it.length - 1] += ' ' + L[i].trim(); i++; }
      out.push(`<ul>${it.map(x => `<li>${satir(x)}</li>`).join('')}</ul>`);
      continue;
    }
    const p = []; while (i < L.length && L[i].trim() && !/^(#|\||- |>)/.test(L[i])) p.push(L[i++].trim());
    // Kaydırılmış satırlar boşlukla birleşir; yalnız '**Etiket:**' ile başlayan ardışık satırlar ayrı satırda kalır
    out.push(`<p>${p.map((x, k) => (k && /^\*\*/.test(x) && /^\*\*/.test(p[k - 1]) ? '<br>' : k ? ' ' : '') + satir(x)).join('')}</p>`);
  }
  return out.join('\n');
}

const YER = { tr: ['[GELİŞTİRİCİ ADI]', '[İLETİŞİM E-POSTASI]', '[YÜRÜRLÜK TARİHİ]'], en: ['[DEVELOPER NAME]', '[CONTACT E-MAIL]', '[EFFECTIVE DATE]'] };

function bilgileriDenetle(b) {
  const eksik = ['gelistirici', 'eposta', 'tarih'].filter(k => !b || typeof b[k] !== 'string' || !b[k].trim());
  if (eksik.length) return 'Eksik alan: ' + eksik.join(', ') + ' (docs/gizlilik-bilgileri.json)';
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(b.eposta)) return 'Geçersiz e-posta: ' + b.eposta;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.tarih) || isNaN(Date.parse(b.tarih))) return 'Tarih YYYY-AA-GG biçiminde olmalı: ' + b.tarih;
  return null;
}

function sayfa(dil, b) {
  const md = R(dil === 'tr' ? 'docs/gizlilik-politikasi.md' : 'docs/privacy-policy.md');
  const [ad, ep, tr] = YER[dil];
  const [y, a, g] = b.tarih.split('-');
  const tarih = dil === 'tr' ? `${g}.${a}.${y}` : b.tarih;
  let govde = md2html(md).split(ad).join(esc(b.gelistirici)).split(tr).join(tarih)
    .split(esc(ep)).join(`<a href="mailto:${esc(b.eposta)}">${esc(b.eposta)}</a>`).split(ep).join(`<a href="mailto:${esc(b.eposta)}">${esc(b.eposta)}</a>`);
  if (/\[[A-ZÇĞİÖŞÜ .-]+\]/.test(govde)) throw new Error('Doldurulmamış yer tutucu kaldı (' + dil + ')');
  const baslik = dil === 'tr' ? 'IrriGrow Gizlilik Politikası' : 'IrriGrow Privacy Policy';
  const diger = dil === 'tr' ? '<a href="privacy.html" hreflang="en">English</a>' : '<a href="gizlilik.html" hreflang="tr">Türkçe</a>';
  return `<!doctype html>
<html lang="${dil}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${baslik}</title>
<meta name="robots" content="index,follow">
<style>
:root{--bg:#fff;--fg:#15231c;--mut:#5f6f66;--line:#dfe7e2;--acc:#11694a}
@media (prefers-color-scheme:dark){:root{--bg:#111815;--fg:#e8efea;--mut:#a8b5ad;--line:#2a3530;--acc:#5fd3a0}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:820px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:1.7rem;line-height:1.25;margin:.2em 0 .6em}h2{font-size:1.2rem;margin:1.6em 0 .4em}
a{color:var(--acc)}code{font-size:.9em}
.tw{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:.92rem}th,td{border:1px solid var(--line);padding:6px 8px;text-align:start;vertical-align:top}
nav{display:flex;justify-content:space-between;gap:12px;font-size:.95rem;color:var(--mut)}
</style>
</head>
<body>
<main>
<nav><span>IrriGrow</span>${diger}</nav>
${govde}
</main>
</body>
</html>
`;
}

function uret(b) {
  const h = bilgileriDenetle(b); if (h) throw new Error(h);
  return { 'www/gizlilik.html': sayfa('tr', b), 'www/privacy.html': sayfa('en', b) };
}

module.exports = { md2html, bilgileriDenetle, uret };

if (require.main === module) {
  const b = JSON.parse(R('docs/gizlilik-bilgileri.json'));
  let s;
  try { s = uret(b); } catch (e) { console.error('Sayfa üretilmedi: ' + e.message); process.exit(1); }
  if (process.argv.includes('--check')) {
    const eski = Object.keys(s).filter(f => !fs.existsSync(path.join(KOK, f)) || R(f) !== s[f]);
    if (eski.length) { console.error('Güncel değil: ' + eski.join(', ') + ' — node tools/gizlilik-sayfa.js çalıştırın'); process.exit(1); }
    console.log('Gizlilik sayfaları güncel.');
  } else { for (const [f, html] of Object.entries(s)) fs.writeFileSync(path.join(KOK, f), html); console.log('Yazıldı: ' + Object.keys(s).join(', ')); }
}

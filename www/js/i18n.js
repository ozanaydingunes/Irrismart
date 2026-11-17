// IrriGrow — çoklu dil. Anahtar: Türkçe metnin kendisi; sözlük i18n-dict.js içinde.
// t('Metin {x}', {x: 5}) — çeviri yoksa İngilizce, o da yoksa Türkçe gösterilir.
(function (g) {
  const LANGS = {
    tr: { ad: 'Türkçe', loc: 'tr-TR' }, en: { ad: 'English', loc: 'en-GB' }, de: { ad: 'Deutsch', loc: 'de-DE' },
    es: { ad: 'Español', loc: 'es-ES' }, ru: { ad: 'Русский', loc: 'ru-RU' }, it: { ad: 'Italiano', loc: 'it-IT' },
    he: { ad: 'עברית', loc: 'he-IL', rtl: true }, zh: { ad: '中文', loc: 'zh-CN' },
  };
  const KEY = 'irrigrow.lang';
  let lang = 'tr';
  try { const s = g.localStorage && g.localStorage.getItem(KEY); if (s && LANGS[s]) lang = s; } catch (e) { /* depolama yok */ }
  const dict = () => g.IRRI_DICT || {};
  function t(s, p) {
    let out = s;
    if (lang !== 'tr') { const e = dict()[s]; out = (e && (e[lang] || e.en)) || s; }
    if (p) out = out.replace(/\{(\w+)\}/g, (m, k) => (p[k] !== undefined ? p[k] : m));
    return out;
  }
  function apply(root) {
    if (!g.document) return;
    const d = g.document;
    d.documentElement.lang = lang; d.documentElement.dir = LANGS[lang].rtl ? 'rtl' : 'ltr';
    (root || d).querySelectorAll('[data-i18n]').forEach(el => { el._src = el._src || el.textContent.trim(); el.textContent = t(el._src); });
  }
  function setLang(l) { if (!LANGS[l]) return; lang = l; try { g.localStorage.setItem(KEY, l); } catch (e) { } apply(); }
  // Geçici dil (kalıcı kaydetmeden; örn. PDF'i Çince/İbranice yerine İngilizce üretmek için)
  async function withLang(l, fn) { const old = lang; lang = l; try { return await fn(); } finally { lang = old; } }
  const api = { t, setLang, withLang, apply, LANGS, get lang() { return lang; }, get locale() { return LANGS[lang].loc; }, get rtl() { return !!LANGS[lang].rtl; } };
  g.IrriI18n = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

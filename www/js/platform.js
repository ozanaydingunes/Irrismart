// IrriGrow — platform ayrımı (MH-WEB-1)
// Android (Capacitor) ve web tarayıcısı AYNI uygulama kodunu ve AYNI hesap motorunu kullanır. Bu modül yalnız
// platforma özgü bilgilendirmeyi yapar ve Android'de hiçbir şeyi değiştirmez:
//   • Web'de Projeler ekranına bilgi notu: projeler yalnız bu tarayıcıda saklanır; otomatik bulut eşitlemesi
//     YOKTUR; telefon ve bilgisayar arasında JSON yedekle taşınır. Tarayıcı depolama kullanımı gösterilir.
//   • Android'de (Capacitor yerel platformu) not eklenmez, DOM'a dokunulmaz.
(function (g) {
  const isNative = () => !!(g.Capacitor && g.Capacitor.isNativePlatform && g.Capacitor.isNativePlatform());
  const t = (s, p) => (g.IrriI18n ? g.IrriI18n.t(s, p) : (p ? s.replace(/\{(\w+)\}/g, (m, k) => (p[k] !== undefined ? p[k] : m)) : s));
  const LIMIT_KB = 5120;   // tarayıcıların çoğunda localStorage sınırı yaklaşık 5 MB (tarayıcıya göre değişir)

  // localStorage'daki IrriGrow verisinin yaklaşık boyutu (UTF-16: karakter başına 2 bayt)
  function storageKB() {
    try {
      let n = 0; const ls = g.localStorage;
      for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (/^irri/i.test(k)) n += (k.length + (ls.getItem(k) || '').length) * 2; }
      return n / 1024;
    } catch (e) { return null; }
  }
  const fmtKB = kb => kb == null ? '—' : kb < 1024 ? Math.round(kb).toLocaleString(g.IrriI18n ? g.IrriI18n.locale : 'tr-TR') + ' KB' : (kb / 1024).toLocaleString(g.IrriI18n ? g.IrriI18n.locale : 'tr-TR', { maximumFractionDigits: 1 }) + ' MB';

  function notice() {
    const kb = storageKB(), pct = kb != null ? kb / LIMIT_KB * 100 : 0;
    return `<b>${t('Web sürümü')}</b> · ${t('Projeler yalnız bu tarayıcıda saklanır. Otomatik bulut eşitlemesi yoktur; telefon ile bilgisayar arasında projeleri JSON yedekle taşıyın (Yedekle / Yedekten yükle).')}`
      + `<br><span class="small">${t('Tarayıcı depolama kullanımı: {x} (tarayıcı sınırı genellikle yaklaşık 5 MB).', { x: fmtKB(kb) })}${pct > 70 ? ' <b>' + t('Depolama dolmak üzere: yedek alıp kullanılmayan projeleri silin.') + '</b>' : ''} ${t('Tarayıcı verilerini temizlemek projeleri de siler.')}</span>`;
  }
  function render() {
    if (isNative() || !g.document) return;
    const host = g.document.getElementById('v-projeler'); if (!host) return;
    let el = g.document.getElementById('webNote');
    if (!el) { el = g.document.createElement('div'); el.id = 'webNote'; el.className = 'note webnote'; el.setAttribute('role', 'note'); const pad = host.querySelector('.pad') || host, hero = pad.querySelector('.hero'); pad.insertBefore(el, hero ? hero.nextSibling : pad.firstChild); }
    el.innerHTML = notice();
  }
  function init() {
    if (isNative() || !g.document) return;
    g.document.documentElement.classList.add('web');
    render();
    // Proje listesi değiştikçe (kaydetme, silme, yedekten yükleme) kullanım değerini güncelle
    const v = g.document.getElementById('v-projeler');
    if (v && g.MutationObserver) new g.MutationObserver(() => { const el = g.document.getElementById('webNote'); if (el && !el.dataset.busy) { el.dataset.busy = '1'; el.innerHTML = notice(); delete el.dataset.busy; } }).observe(g.document.getElementById('projList') || v, { childList: true });
  }

  g.IrriPlatform = { isNative, storageKB, notice, render, init, LIMIT_KB };
  if (g.document) { if (g.document.readyState === 'loading') g.document.addEventListener('DOMContentLoaded', init); else init(); }
  if (typeof module !== 'undefined') module.exports = g.IrriPlatform;
})(typeof window !== 'undefined' ? window : globalThis);

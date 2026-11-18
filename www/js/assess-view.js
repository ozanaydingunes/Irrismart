// IrriGrow — MH-AKIL-1: Sonuç ekranındaki "Mühendislik değerlendirmesi" bölümü (uyarı kartları ve çözümler)
// Yalnız IrriAssess.evaluate çıktısını çizer; hiçbir sayı üretmez. Masaüstü ve mobil aynı işaretlemeyi kullanır:
// kritik (uygunsuz) uyarılar açık, diğerleri kapalı başlık olarak gelir; uzun açıklamalar açılır panellerdedir.
(function (g) {
  const AS = () => g.IrriAssess || (typeof require !== 'undefined' ? require('./assess.js') : null);
  const ESC = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LV_CLASS = { uygunsuz: 'bad', 'on-degerlendirme': 'pre', uyari: 'warn', bilgi: 'info' };
  const DZ_CLASS = { 'hesaplandi-uygun': 'ok', 'hesaplandi-uygunsuz': 'bad', 'kanitla-uygunsuz': 'bad', 'varsayimla-yetersiz': 'warn', degerlendirilmedi: 'na', 'veri-gerekli': 'info' };
  const DZ_ICON = { 'hesaplandi-uygun': '✓', 'hesaplandi-uygunsuz': '✗', 'kanitla-uygunsuz': '✗', 'varsayimla-yetersiz': '!', degerlendirilmedi: '…', 'veri-gerekli': '?' };
  const ONAY = [['yok', 'Kullanıcı kararı yok'], ['bekliyor', 'İnceleniyor'], ['kabul', 'Bilinerek kabul edildi'], ['red', 'Çözülmesi gerekiyor']];
  const SRC = { girdi: 'Girdi', varsayilan: 'Varsayılan', hesap: 'Hesap', katalog: 'Katalog', jenerik: 'Jenerik (temsili)', motor: 'Motor eşiği', ayar: 'Proje ayarı', elle: 'Elle', otomatik: 'Otomatik' };

  function make(o = {}) {
    const t = o.t || (x => x), esc = o.esc || ESC;
    const fmt = o.fmt || ((v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v.toLocaleString('tr-TR', { minimumFractionDigits: d ?? 1, maximumFractionDigits: d ?? 1 }) : '—');
    const A = AS();
    const tx = x => A.text(x, t, fmt);
    const N = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? `<span class="ak-n" data-v="${v}">${esc(fmt(v, d))}</span>` : '—';
    const lv = s => `<span class="ak-lv ak-lv-${LV_CLASS[s]}">${esc(t(A.LEVEL_AD[s]))}</span>`;
    const dz = s => `<span class="ak-dz ak-dz-${DZ_CLASS[s]}" data-durum="${s}"><span aria-hidden="true">${DZ_ICON[s]}</span> ${esc(t(A.DURUM_AD[s]))}</span>`;
    const tile = (q, cls) => q ? `<div class="ak-tile ${cls || ''}"><span class="ak-tl">${esc(tx(q.ad))}</span><b>${N(q.deger, q.d)}${q.birim ? ` <small>${esc(t(q.birim))}</small>` : ''}</b><span class="ak-src">${esc(t(SRC[q.kaynak] || q.kaynak))}</span></div>` : '';
    const list = arr => arr && arr.length ? `<ul class="ak-ul">${arr.map(x => `<li>${esc(tx(x))}</li>`).join('')}</ul>` : '';

    function altTable(rows) {
      if (!rows || !rows.length) return '';
      return `<details class="ak-sub"><summary>${esc(t('Hesaplanan alternatifler'))} (${rows.length})</summary><div class="scroll"><table class="ak-tbl"><tr><th>Shift</th><th>${esc(t('En büyük shift'))} m³/h</th><th>${esc(t('Tur'))} h</th><th>${esc(t('Sınır'))} h</th><th>${esc(t('Durum'))}</th></tr>${rows.map(r => `<tr><td>${r.Ns}</td><td>${N(r.Qmax, 1)}</td><td>${N(r.cycle, 1)}</td><td>${N(r.avail, 0)}</td><td>${dz(r.durum)}${r.neden && r.neden.length ? `<br><small>${esc(tx(r.neden))}</small>` : ''}</td></tr>`).join('')}</table></div></details>`;
    }
    function solution(c) {
      return `<li class="ak-sol ak-sol-${DZ_CLASS[c.durum]}" data-tur="${c.tur}" data-durum="${c.durum}">
        <div class="ak-solh"><b>${esc(tx(c.baslik))}</b>${dz(c.durum)}</div>
        <p class="ak-why">${esc(tx(c.gerekce))}</p>
        ${c.varsayim ? `<p class="ak-asm">${esc(tx(c.varsayim))}</p>` : ''}
        ${c.kapsam ? `<p class="ak-asm">${esc(tx(c.kapsam))}</p>` : ''}
        ${c.asama && c.durum === 'degerlendirilmedi' ? `<p class="ak-later">${esc(t('Bu sürümde hesaplanmıyor; {x} aşamasında gelecek.', { x: c.asama }))}</p>` : ''}
        ${c.gerekenVeri && c.gerekenVeri.length ? `<div class="ak-need"><span>${esc(t('Gereken veri'))}:</span>${list(c.gerekenVeri)}</div>` : ''}
        ${altTable(c.tablo)}
      </li>`;
    }
    function detailBlock(x) {
      const a = x.ayrinti; if (!a) return '';
      const un = a.unsurlar && a.unsurlar.length ? `<h4>${esc(t('Sulama aralığı değerlendirmesinde kullanılan unsurlar'))}</h4><div class="ak-tiles">${a.unsurlar.map(q => tile(q)).join('')}</div><p class="ak-asm">${esc(t('Tur süresi ve kapasite denetimi, damlatıcıların gerçekten uyguladığı hacimle (Σ damlatıcı debisi × shift süresi) yapılır. “Brüt ihtiyaç × toplam alan” bundan biraz büyüktür, çünkü parsel kenarlarında tam sıra aralığı kalmaz ve bu şeritlerde damlatıcı yoktur.'))}</p>` : '';
      const ar = a.aralik && a.aralik.length ? `<div class="scroll"><table class="ak-tbl"><tr><th>${esc(t('Aralık'))} (${esc(t('gün'))})</th><th>${esc(t('Gereken'))} m³</th><th>${esc(t('Verilebilen'))} m³</th><th>${esc(t('Açık'))} m³</th><th>${esc(t('Durum'))}</th></tr>${a.aralik.map(r => `<tr><td>${r.I}</td><td>${N(r.need, 0)}</td><td>${N(r.can, 0)}</td><td>${N(r.acik != null ? Math.max(0, r.acik) : null, 0)}</td><td>${dz(r.durum)}</td></tr>`).join('')}</table></div>` : '';
      const k = a.kapasite;
      const kp = k ? `<h4>${esc(t('Kapasite denetimi (gerekli koşul)'))}</h4><p class="ak-asm">${esc(t('Günlük ihtiyaç = toplam debi × shift süresi ÷ aralık = {a} m³/h × {b} h ÷ {c} = {d} m³/gün. Kaynak kapasitesi = {e} m³/h × {f} h = {g} m³/gün. Bu koşul gereklidir ama yeterli değildir; sağlanması sistemin uygun olduğunu göstermez.', { a: fmt(k.Qf, 1), b: fmt(k.t, 2), c: k.I, d: fmt(k.Vd, 0), e: fmt(k.Qs, 1), f: fmt(k.H, 0), g: fmt(k.cap, 0) }))}</p>` : '';
      return `<details class="ak-sub"><summary>${esc(t('Hesap ayrıntısı'))}</summary>${kp}${un}${ar}</details>`;
    }
    function card(x, onay) {
      const open = x.seviye === 'uygunsuz';
      const sols = x.cozumler || [];
      const needs = (x.eksikGirdi || []).concat(...sols.map(c => c.gerekenVeri || []));
      const uniq = [...new Map(needs.map(y => [tx(y), y])).values()];
      return `<details class="ak-card ak-c-${LV_CLASS[x.seviye]}" id="ak-${esc(x.kod)}" data-kod="${esc(x.kod)}" data-seviye="${x.seviye}" ${open ? 'open' : ''}>
        <summary class="ak-head">${lv(x.seviye)}<code class="ak-kod">${esc(x.kod)}</code>${x.onDegerlendirme ? `<span class="ak-lv ak-lv-pre">${esc(t('Ön değerlendirme'))}</span>` : ''}<span class="ak-title">${esc(tx(x.baslik))}</span></summary>
        <div class="ak-body">
          <div class="ak-tiles">${(x.durum || []).map(q => tile(q, x.seviye === 'uygunsuz' ? '' : '')).join('')}${x.sinir ? tile(x.sinir, 'ak-lim') : ''}</div>
          <p class="ak-neden">${esc(tx(x.neden))}</p>
          ${x.kisaGerekce ? `<p class="ak-key">${esc(tx(x.kisaGerekce))}</p>` : ''}
          ${x.onem ? `<details class="ak-sub"><summary>${esc(t('Neden önemli'))}</summary><p class="ak-asm">${esc(tx(x.onem))}</p></details>` : ''}
          ${sols.length ? `<details class="ak-sub ak-sols" ${open ? 'open' : ''}><summary>${esc(t('Çözüm seçenekleri'))} (${sols.length})</summary><ul class="ak-solist">${sols.map(solution).join('')}</ul></details>` : ''}
          ${uniq.length ? `<details class="ak-sub"><summary>${esc(t('Gereken veriler'))} (${uniq.length})</summary>${list(uniq)}</details>` : ''}
          ${detailBlock(x)}
          ${onay ? `<p class="ak-asm ak-onay-not">${esc(t('Kullanıcı kararı uyarının seviyesini ve teknik uygunluğu değiştirmez; “Bilinerek kabul edildi” işaretli bir uygunsuzluk uygunsuz olarak kalır ve raporlarda öyle yazılır.'))}</p>` : ''}
          ${onay ? `<label class="ak-onay">${esc(t('Kullanıcı kararı'))}<select data-onay="${esc(x.kod)}">${ONAY.map(([v, l]) => `<option value="${v}" ${x.onay === v ? 'selected' : ''}>${esc(t(l))}</option>`).join('')}</select></label>` : ''}
        </div>
      </details>`;
    }
    function render(Ares, opt = {}) {
      if (!Ares || !Ares.ok) return '';
      const c = Ares.count;
      const strip = `<p class="ak-strip">${['uygunsuz', 'on-degerlendirme', 'uyari', 'bilgi'].map(s => `<span class="ak-cnt">${lv(s)} <b class="ak-n" data-v="${c[s]}">${c[s]}</b></span>`).join('')}</p>`;
      const legend = `<p class="ak-legend">${esc(t('Çözüm durumları: “Hesaplandı” motorla hesaplanmış sonuçtur; “Kanıtla uygunsuz” gerekli bir koşulun sağlanmadığını gösterir; “Değerlendirilmedi” bu sürümde hesaplanmayan seçeneklerdir ve uygun sayılmaz.'))}</p>`;
      const other = Ares.other && Ares.other.length ? `<details class="ak-other"><summary>${esc(t('Diğer hesap notları'))} (${Ares.other.length})</summary><ul class="ak-ul">${Ares.other.map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>` : '';
      return `<section class="card ak" id="akil"><h3>${esc(t('Mühendislik değerlendirmesi'))}</h3>${strip}
        ${Ares.findings.length ? Ares.findings.map(x => card(x, opt.onay !== false)).join('') : `<p class="muted small">${esc(t('Yapılandırılmış uyarı yok.'))}</p>`}
        ${Ares.findings.length ? legend : ''}${other}</section>`;
    }
    return { render, card, solution };
  }

  const api = { make, LV_CLASS, DZ_CLASS, ONAY };
  g.IrriAssessView = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

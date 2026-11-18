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
        ${c.motorNot ? `<p class="ak-why">${esc(tx(c.motorNot))}</p>` : ''}
        ${c.motor ? motorLine(c.motor) : ''}
        ${c.kalan ? `<p class="ak-key">${esc(tx(c.kalan))}</p>` : ''}
        ${c.varsayim ? `<p class="ak-asm">${esc(tx(c.varsayim))}</p>` : ''}
        ${c.kapsam ? `<p class="ak-asm">${esc(tx(c.kapsam))}</p>` : ''}
        ${c.asama && c.durum === 'degerlendirilmedi' ? `<p class="ak-later">${esc(c.asama === 'MH-AKIL-2' ? t('“Kapasite alternatifleri” bölümünden motorla hesaplanabilir.') : t('Bu sürümde hesaplanmıyor; {x} aşamasında gelecek.', { x: c.asama }))}</p>` : ''}
        ${c.gerekenVeri && c.gerekenVeri.length ? `<div class="ak-need"><span>${esc(t('Gereken veri'))}:</span>${list(c.gerekenVeri)}</div>` : ''}
        ${altTable(c.tablo)}
      </li>`;
    }
    // Motor sonucu (MH-AKIL-2): girdiler ve başlıca çıktılar
    function motorLine(m) {
      const it = (l, v, d, u) => `<span><small>${esc(t(l))}</small> ${N(v, d)}${u ? ' ' + esc(u) : ''}</span>`;
      return `<div class="ak-motor">${it('Kaynak', m.Q, 1, 'm³/h')}${it('Günlük süre', m.H, 1, 'h')}${it('Aralık', m.I, 0, t('gün'))}${it('Shift', m.Ns, 0)}${it('Tur', m.cycle, 2, 'h')}${it('Sınır', m.avail, 1, 'h')}${it('Gerekli H', m.Hmax, 1, 'm')}${it('Motor', m.motor, 1, 'kW')}${it('Enerji', m.kWh, 0, 'kWh')}<span><small>${esc(t('Ana hat'))}</small> Ø${esc(m.od)} PN${esc(m.pn)}</span></div>`;
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
    // ---------- MH-AKIL-2: Kapasite alternatifleri kartı ----------
    const AD = { mevcut: 'Mevcut durum', kaynak: 'Kaynak debisi (mevcut süre)', sure: 'Günlük çalışma süresi', 'kaynak-sure': 'Kaynak debisi + süre', aralik: 'Sulama aralığı' };
    const ST = { uygun: ['ok', 'Uygun'], 'kapasite-uygun': ['warn', 'Kapasite uygun, kritik uyarı açık'], uygunsuz: ['bad', 'Uygunsuz'] };
    const stb = d => `<span class="ak-dz ak-dz-${ST[d][0]}" data-alt-durum="${d}">${esc(t(ST[d][1]))}</span>`;
    function alternatives(S, o = {}) {
      const head = `<section class="card ak" id="kapasite"><h3>${esc(t('Kapasite alternatifleri'))}</h3>`;
      const btn = lbl => `<button class="btn primary block" id="bKap" style="min-height:44px">${esc(t(lbl))}</button>`;
      const intro = `<p class="ak-asm">${esc(t('Her alternatif gerçek hesap motoruyla, yalnız ilgili girdi değiştirilerek hesaplanır: kaynak debisi, günlük çalışma süresi, ikisi birlikte ve sulama aralığı. Proje verileriniz değişmez.'))}</p>`;
      if (o.running) return head + intro + `<div class="ak-prog" role="status"><span style="width:${Math.min(100, (o.done || 0) / 12 * 100)}%"></span></div><p class="ak-asm">${esc(t('Hesaplanıyor… {n} motor çalıştırması', { n: o.done || 0 }))}</p></section>`;
      if (!S) return head + intro + (o.stale ? `<p class="ak-key">${esc(t('Proje girdileri değiştiği için kayıtlı alternatifler geçersiz; yeniden hesaplayın.'))}</p>` : '') + btn('Kapasite alternatiflerini hesapla') + '</section>';
      const v = S.hacim0, sh = S.shift;
      const vol = `<h4 class="ak-h4">${esc(t('Hacimler (günlük)'))}</h4><div class="ak-tiles">
        ${tile({ ad: { t: 'Bitkinin brüt ihtiyacı (brüt × hedef alan)', p: {} }, deger: v.ihtiyac, birim: 'm³', d: 0, kaynak: 'hesap' })}
        ${tile({ ad: { t: 'Damlatıcıların uyguladığı hacim', p: {} }, deger: v.uygulanan, birim: 'm³', d: 0, kaynak: 'hesap' })}
        ${tile({ ad: { t: 'Damlatıcı kapsama oranı', p: {} }, deger: v.kapsama * 100, birim: '%', d: 2, kaynak: 'hesap' })}
        ${tile({ ad: { t: 'Mevcut kaynak kapasitesi', p: {} }, deger: v.kaynak, birim: 'm³', d: 0, kaynak: 'hesap' })}</div>
        ${v.kapsama < 1 - 1e-6 ? `<p class="ak-asm">${esc(t('Damlatıcılar hedef alanın %{k} kadarını kaplıyor; kalan alanın su ihtiyacı ortadan kalkmaz. Kapasite uygunluğu için kaynak, bitkinin brüt ihtiyacını da karşılamalıdır.', { k: fmt(v.kapsama * 100, 2) }))}</p>` : ''}`;
      const shiftP = `<p class="ak-asm">${esc(sh.kanit ? t('Yalnız shift sayısı: kaynakla her gruplamada en az {n} shift gerekir; tur ≥ {c} h > {av} h. Motorun hesapladığı {k} alternatifin hiçbiri sığmıyor.', { n: sh.nsLB, c: fmt(sh.cycLB, 2), av: fmt(sh.avail, 1), k: sh.liste.length }) : t('Yalnız shift sayısı: motorun hesapladığı {k} alternatif “Mühendislik değerlendirmesi” bölümünde.', { k: sh.liste.length }))}</p>`;
      const rows = S.rows.filter(x => x.girdi);
      const anyOk = rows.some(x => x.durum === 'uygun');
      const th = ['Alternatif', 'Durum', 'Kaynak m³/h', 'Süre h/gün', 'Aralık gün', 'Shift', 'Tur / sınır h', 'En büyük shift m³/h', 'Gerekli H m', 'Motor kW', 'Enerji kWh/yıl', 'Ana hat', 'Kaynak / ihtiyaç m³/gün'];
      const td = (i, html) => `<td data-label="${esc(t(th[i]))}">${html}</td>`;
      const tr = x => `<tr data-alt="${esc(x.id)}" class="${x.id === 'mevcut' ? 'ak-ref' : ''}">${td(0, `<b>${esc(t(AD[x.aile]))}</b>`)}${td(1, `<span>${stb(x.durum)}${x.acik.length ? `<br><small>${esc(x.acik.join(', '))}</small>` : ''}${x.enKucuk === false ? `<br><small>${esc(t('en küçük olmayabilir'))}</small>` : ''}</span>`)}${td(2, N(x.girdi.Q, 1))}${td(3, N(x.girdi.H, 1))}${td(4, N(x.girdi.I, 0))}${td(5, N(x.Ns, 0))}${td(6, `<span>${N(x.cycle, 2)} / ${N(x.avail, 1)}</span>`)}${td(7, N(x.Qmax, 1))}${td(8, N(x.Hmax, 1))}${td(9, N(x.motor, 1))}${td(10, N(x.kWh, 0))}${td(11, `Ø${esc(x.od)} PN${esc(x.pn)}`)}${td(12, `<span>${N(x.hacim.kaynak, 0)} / ${N(x.hacim.ihtiyac, 0)}</span>`)}</tr>`;
      const fail = S.rows.filter(x => !x.girdi).map(x => `<li>${esc(t(AD[x.aile]))}: ${esc(x.imkansiz ? t('bu sürede tek shift bile sığmıyor') : t('aranan aralıkta uygun debi bulunamadı'))}</li>`).join('');
      return head + `<p class="ak-asm">${esc(t('{n} motor çalıştırmasıyla hesaplandı.', { n: S.calistirma || 0 }))}</p>` + vol + shiftP +
        `<div class="scroll"><table class="ak-alt"><thead><tr>${th.map(h => `<th>${esc(t(h))}</th>`).join('')}</tr></thead><tbody>${rows.map(tr).join('')}</tbody></table></div>` +
        (fail ? `<ul class="ak-ul">${fail}</ul>` : '') +
        (S.notes || []).filter(x => x.kod === 'aralik-imax').map(x => `<p class="ak-asm">${esc(t('{m} günden uzun aralıklar toprağın kolay alınabilir suyunu aştığı için hesaplanmadı (bitki su stresi).', { m: x.Imax }))}</p>`).join('') +
        `<p class="${anyOk ? 'ak-asm' : 'ak-key'}">${esc(anyOk ? t('“Uygun”: kapasite koşulları sağlanıyor ve hiçbir kritik uyarı kalmıyor. Seçim ve karşılaştırma MH-AKIL-4’te yapılacak.') : t('Bütün zorunlu kontrolleri sağlayan alternatif bulunamadı. “Kapasite uygun, kritik uyarı açık” satırları kesin çözüm olarak önerilmez.'))}</p>
        <p class="ak-asm">${esc(t('Kaynak debileri motorun shift gruplama kuralı ve bu yerleşim için bulunan en küçük değerlerdir; 0,1 m³/h altının uygun olmadığı motorla doğrulanmıştır. Mutlak teorik minimum değildir. Kuyu verimi pompa deneyiyle doğrulanmalıdır.'))}</p>` +
        btn('Yeniden hesapla') + '</section>';
    }
    return { render, card, solution, alternatives };
  }

  const api = { make, LV_CLASS, DZ_CLASS, ONAY };
  g.IrriAssessView = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

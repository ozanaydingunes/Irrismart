// IrriGrow — proje veri şeması, güvenli migrasyon ve kurtarma (veri hiçbir koşulda sessizce silinmez)
(function (g) {
  const SCHEMA = 2;
  const MAX_REVS = 20;
  const REV_EXTRA = ['station', 'route', 'shiftEdit', 'shiftEditEski', 'shiftEditYedek'];

  // Tek proje: eksik alanları ekler, mevcut alanlara dokunmaz. Dönüş: yeni nesne
  function migrateProject(p) {
    const q = Object.assign({ poly: [], name: 'Proje' }, p);
    const from = Number.isInteger(q.schema) ? q.schema : 1;
    if (from < 2) {
      q.rev = Number.isInteger(q.rev) ? q.rev : 1;
      q.revs = Array.isArray(q.revs) ? q.revs : [];
      q.created = q.created || q.updated || Date.now();
    }
    q.schema = Math.max(from, SCHEMA);
    return q;
  }
  const isProject = p => !!(p && typeof p === 'object' && typeof p.id === 'string' && p.id && p.inp && typeof p.inp === 'object');

  // Ham depolama metninden projeleri okur. Bozuk/geçersiz veri "rescue" içinde döner; çağıran onu ayrı anahtara yazmalı.
  function parseProjects(raw) {
    if (raw == null || raw === '') return { projects: [], rescue: null, migrated: false };
    let arr;
    try { arr = JSON.parse(raw); } catch (e) { return { projects: [], rescue: raw, migrated: false, corrupt: true }; }
    if (!Array.isArray(arr)) return { projects: [], rescue: raw, migrated: false, corrupt: true };
    const good = arr.filter(isProject), bad = arr.filter(p => !isProject(p));
    const migrated = good.some(p => p.schema !== SCHEMA);
    return { projects: good.map(migrateProject), rescue: bad.length ? JSON.stringify(bad) : null, migrated, dropped: bad.length };
  }

  // Revizyon: kaydetmeden önce girdilerin anlık görüntüsü (son MAX_REVS)
  function snapshot(p, note) {
    if (!p) return p;
    p.revs = Array.isArray(p.revs) ? p.revs : [];
    // K-1: güzergâh, istasyon ve elle shift ataması da revizyona girer (yalnız var olan alanlar; eski revizyonlar aynen okunur)
    const body = { inp: p.inp, poly: p.poly, src: p.src, hydro: p.hydro };
    for (const k of REV_EXTRA) if (p[k] !== undefined) body[k] = p[k];
    const snap = JSON.stringify(body);
    const last = p.revs[p.revs.length - 1];
    if (last && last.data === snap) return p;
    p.rev = (p.rev || 0) + 1;
    p.revs.push({ rev: p.rev, t: Date.now(), note: note || '', data: snap });
    if (p.revs.length > MAX_REVS) p.revs.splice(0, p.revs.length - MAX_REVS);
    return p;
  }
  function restoreRev(p, rev) {
    const r = (p.revs || []).find(x => x.rev === rev); if (!r) return false;
    const d = JSON.parse(r.data); snapshot(p, 'geri yükleme öncesi');
    Object.assign(p, { inp: d.inp, poly: d.poly || [], src: d.src, hydro: d.hydro });
    for (const k of REV_EXTRA) { if (k in d) p[k] = d[k]; }   // eski revizyonda yoksa mevcut değere dokunulmaz
    return true;
  }
  function duplicate(p, suffix) {
    const c = JSON.parse(JSON.stringify(p));
    c.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    c.name = p.name + ' (' + (suffix || 'kopya') + ')'; c.created = c.updated = Date.now(); c.rev = 1; c.revs = [];
    return c;
  }

  // JSON proje yedeği ("Yedekle" / "Yedekten yükle"). Uygulama ve testler aynı fonksiyonları kullanır.
  // Excel/PDF raporları yedek değildir; yalnız bu biçim geri yüklenebilir.
  function backupPayload(projects, settings, catalog, date) {
    // Her proje sürüm bilgisi (schema) ile yazılır; yeni oluşturulmuş ve henüz yeniden açılmamış projeler de dahil.
    // migrateProject yeni nesne döndürür: kayıtlı liste değişmez, mevcut alanlara dokunulmaz.
    return { uygulama: 'IrriGrow', yedekSurum: 1, sema: SCHEMA, tarih: (date || new Date()).toISOString(), projects: (projects || []).map(migrateProject), settings, catalog };
  }
  // Dosya metnini çözer; geçersizse hata fırlatır (msg: çevrilecek metin). Dönüş: geçerli projeler, ayarlar, katalog
  function readBackup(text) {
    const j = typeof text === 'string' ? JSON.parse(text) : text;
    if (!j || !['IrriGrow', 'IrriSmart'].includes(j.uygulama) || !Array.isArray(j.projects)) { const e = new Error('Bu bir IrriGrow yedek dosyası değil'); e.i18n = true; throw e; }
    const valid = j.projects.filter(p => p && typeof p.id === 'string' && p.inp && typeof p.inp === 'object');
    return { valid, settings: j.settings && typeof j.settings === 'object' ? j.settings : null, catalog: j.catalog || null };
  }
  // Yedekteki projeleri mevcut listeye işler. Listeyi yerinde değiştirir. K-1: mevcut proje HİÇBİR ZAMAN üzerine yazılmaz.
  //  - yeni kimlik → eklenir
  //  - aynı kimlik ve aynı içerik → değişiklik yok
  //  - aynı kimlik, farklı içerik → mevcut proje korunur, yedekteki "(yedekten)" adıyla yeni kimlikle kopya olarak eklenir
  // Dönüş: projects (geriye uyum); özet: mergeBackup.son = { eklenen, ayni, kopya }
  const icerik = p => { const q = Object.assign({}, p); delete q.updated; delete q.schema; return JSON.stringify(q); };
  // Daha önce aynı yedekten eklenmiş "(yedekten)" kopya: kimlik, ad ve kaynakKimlik dışındaki içerik aynıysa yeniden eklenmez
  const kopyaIcerik = p => { const q = Object.assign({}, p); delete q.id; delete q.name; delete q.kaynakKimlik; return icerik(q); };
  const kopyasiVar = (projects, q) => { const k = kopyaIcerik(q); return projects.some(x => x.kaynakKimlik === q.id && kopyaIcerik(migrateProject(x)) === k); };
  function mergeBackup(projects, valid) {
    const ozet = { eklenen: 0, ayni: 0, kopya: 0 };
    for (const p of valid) {
      const q = migrateProject(p), i = projects.findIndex(x => x.id === q.id);
      if (i < 0) { projects.push(q); ozet.eklenen++; continue; }
      if (icerik(migrateProject(projects[i])) === icerik(q) || kopyasiVar(projects, q)) { ozet.ayni++; continue; }
      const c = JSON.parse(JSON.stringify(q));
      c.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      while (projects.some(x => x.id === c.id)) c.id += Math.random().toString(36).slice(2, 4);
      c.name = `${q.name || 'Proje'} (yedekten)`; c.kaynakKimlik = q.id;
      projects.push(c); ozet.kopya++;
    }
    projects.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    mergeBackup.son = ozet;
    return projects;
  }
  // Geri yükleme öncesi özet (onay penceresi için; listeyi değiştirmez)
  function planBackup(projects, valid) {
    const o = { yeni: 0, ayni: 0, farkli: 0 };
    for (const p of valid) { const q = migrateProject(p), x = projects.find(y => y.id === q.id); if (!x) o.yeni++; else if (icerik(migrateProject(x)) === icerik(q) || kopyasiVar(projects, q)) o.ayni++; else o.farkli++; }
    return o;
  }

  g.IrriStore = { SCHEMA, migrateProject, parseProjects, snapshot, restoreRev, duplicate, isProject, backupPayload, readBackup, mergeBackup, planBackup };
  if (typeof module !== 'undefined') module.exports = g.IrriStore;
})(typeof window !== 'undefined' ? window : globalThis);

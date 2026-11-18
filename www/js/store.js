// IrriGrow — proje veri şeması, güvenli migrasyon ve kurtarma (veri hiçbir koşulda sessizce silinmez)
(function (g) {
  const SCHEMA = 2;
  const MAX_REVS = 20;

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
    const snap = JSON.stringify({ inp: p.inp, poly: p.poly, src: p.src, hydro: p.hydro });
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
  // Yedekteki projeleri mevcut listeye işler (aynı kimlik üzerine yazılır, yeni olan eklenir). Listeyi yerinde değiştirir.
  function mergeBackup(projects, valid) {
    for (const p of valid) { const i = projects.findIndex(x => x.id === p.id); const q = migrateProject(p); if (i >= 0) projects[i] = q; else projects.push(q); }
    projects.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    return projects;
  }

  g.IrriStore = { SCHEMA, migrateProject, parseProjects, snapshot, restoreRev, duplicate, isProject, backupPayload, readBackup, mergeBackup };
  if (typeof module !== 'undefined') module.exports = g.IrriStore;
})(typeof window !== 'undefined' ? window : globalThis);

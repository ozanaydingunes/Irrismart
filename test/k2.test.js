// K-2 — normal işletme basıncı ile teorik su darbesi ayrı; yalnız Joukowsky aşımı kesin "uygunsuz" değildir
const { E, test, ok } = require('./_lib');
const AS = require('../www/js/assess.js');
const SC = require('./golden/scenarios.js');
const txt = o => typeof o === 'string' ? o : (o && o.t) || '';

test('K2-01 W-SD-01 hiçbir senaryoda "uygunsuz" değil; aşımda "Geçici rejim analizi gerekli" ve açık gerekçe', () => {
  let asan = 0;
  for (const s of SC) {
    const r = E.design(s.inp, null, s.opt || {}); if (!r.ok) continue;
    const a = AS.forProject({ id: s.id, inp: s.inp, poly: (s.opt || {}).poly || [] }, r); const f = a.findings.find(x => x.kod === 'W-SD-01');
    ok(f && f.seviye === 'on-degerlendirme', `${s.id}: W-SD-01 seviyesi ${f && f.seviye}`);
    if (r.surge.exceeds) {
      asan++;
      ok(txt(f.baslik) === 'Geçici rejim analizi gerekli' && /^Teorik su darbesi üst sınırı PN sınıfını aşabilir\. Ayrıntılı geçici rejim analizi gereklidir\./.test(txt(f.neden)), `${s.id}: başlık/gerekçe`);
    } else ok(txt(f.baslik) === 'Su darbesi ön değerlendirmesi', `${s.id}: aşım yokken başlık`);
  }
  ok(asan >= 10, `aşan senaryo sayısı ${asan}`);
});

test('K2-02 Normal işletme basıncı kontrolü ayrı ve aynen "uygunsuz" kalabilir (W-PN-01/02)', () => {
  const s8 = SC.find(s => s.id === 'S08-yuksek-kot-farki-yukari'), r = E.design(s8.inp);
  const a = AS.forProject({ id: s8.id, inp: s8.inp, poly: [] }, r);
  const pn2 = a.findings.find(x => x.kod === 'W-PN-02');
  ok(pn2 && pn2.seviye === 'uygunsuz', 'pompa kapama basıncı PN aşımı hâlâ uygunsuz');
  ok(a.findings.find(x => x.kod === 'W-SD-01').seviye === 'on-degerlendirme', 'su darbesi ayrı: ön değerlendirme');
});

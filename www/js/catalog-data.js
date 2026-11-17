// IrriGrow — varsayılan ekipman kataloğu
// ÖNEMLİ: Boru ölçüleri standartlardaki nominal değerlerdir (EN 12201-2, EN 1452-2); tedarikçi kataloğu ile
// doğrulanmalıdır. Pompa, filtre ve vana kayıtları GERÇEK ÜRÜN DEĞİLDİR: seçim mantığını çalıştırmak için
// üretilmiş jenerik kayıtlardır ("dogrulandi": false). Gerçek kataloglar Ayarlar > Katalog içe aktar ile
// aynı JSON yapısında yüklenir; içe aktarılan kayıtlar "dogrulandi": true olarak işaretlenebilir.
(function (g) {
  const STD_PE = 'EN 12201-2 nominal et kalınlığı (PE100)';
  const STD_PVC = 'EN 1452-2 nominal et kalınlığı (PVC-U)';
  const pe = [];
  const PE_ET = {
    6: { sdr: 26, et: { 50: 2.0, 63: 2.5, 75: 2.9, 90: 3.5, 110: 4.2, 125: 4.8, 140: 5.4, 160: 6.2 } },
    10: { sdr: 17, et: { 32: 2.0, 40: 2.4, 50: 3.0, 63: 3.8, 75: 4.5, 90: 5.4, 110: 6.6, 125: 7.4, 140: 8.3, 160: 9.5 } },
    16: { sdr: 11, et: { 32: 3.0, 40: 3.7, 50: 4.6, 63: 5.8, 75: 6.8, 90: 8.2, 110: 10.0, 125: 11.4, 140: 12.7, 160: 14.6 } },
  };
  for (const pn of Object.keys(PE_ET)) for (const [od, et] of Object.entries(PE_ET[pn].et))
    pe.push({ id: `pe-${od}-pn${pn}`, malzeme: 'PE100', od: +od, pn: +pn, sdr: PE_ET[pn].sdr, et, ic: +(od - 2 * et).toFixed(1), kaynak: STD_PE, dogrulandi: false });

  const pvc = [];
  const PVC_ET = {
    6: { 63: 1.9, 75: 2.2, 90: 2.7, 110: 3.2, 125: 3.7, 140: 4.1, 160: 4.7, 200: 5.9, 225: 6.6, 250: 7.3, 315: 9.2 },
    10: { 63: 3.0, 75: 3.6, 90: 4.3, 110: 5.3, 125: 6.0, 140: 6.7, 160: 7.7, 200: 9.6, 225: 10.8, 250: 11.9, 315: 15.0 },
    16: { 63: 4.7, 75: 5.6, 90: 6.7, 110: 8.1, 125: 9.2, 140: 10.3, 160: 11.8, 200: 14.7, 225: 16.6, 250: 18.4, 315: 23.2 },
  };
  for (const pn of Object.keys(PVC_ET)) for (const [od, et] of Object.entries(PVC_ET[pn]))
    pvc.push({ id: `pvc-${od}-pn${pn}`, malzeme: 'PVC-U', od: +od, pn: +pn, et, ic: +(od - 2 * et).toFixed(1), kaynak: STD_PVC, dogrulandi: false });

  const lateral = [
    { id: 'lat16', ad: 'Damla borusu Ø16', od: 16, ic: 13.8, maxH: 25, kaynak: 'Jenerik değer — üretici kataloğu ile doğrulayın', dogrulandi: false },
    { id: 'lat20', ad: 'Damla borusu Ø20', od: 20, ic: 17.4, maxH: 25, kaynak: 'Jenerik değer — üretici kataloğu ile doğrulayın', dogrulandi: false },
  ];

  // Jenerik pompa ailesi: H(Q) = Hn·(1,30 − 0,30·(Q/Qn)²), verim tepe noktası Qn'de
  const pompa = [];
  const MOTOR = [0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250];
  const QN = [6, 10, 15, 22, 30, 40, 55, 75, 100, 130, 170, 220, 280];
  const HN = [15, 22, 30, 40, 52, 65, 80, 100, 125, 155, 190, 240];
  for (const tip of ['dalgic', 'santrifuj']) for (const qn of QN) for (const hn of HN) {
    if (tip === 'santrifuj' && hn > 125) continue;
    const etaMax = Math.min(0.80, 0.55 + 0.045 * Math.log(qn));
    const pts = [0, 0.4, 0.7, 1.0, 1.15, 1.3].map(k => {
      const Q = +(qn * k).toFixed(2), H = +(hn * (1.3 - 0.3 * k * k)).toFixed(2);
      const eta = k === 0 ? 0 : +(100 * etaMax * Math.max(0.05, 1 - Math.pow((k - 1) / 1.0, 2))).toFixed(1);
      return [Q, H, eta];
    });
    const pMax = Math.max(...pts.slice(1).map(([Q, H, e]) => 9.81 * Q / 3600 * H / (e / 100)));
    const motor = MOTOR.find(m => m >= pMax * 1.05) || MOTOR[MOTOR.length - 1];
    pompa.push({ id: `gen-${tip}-${qn}-${hn}`, marka: 'Jenerik', model: `${tip === 'dalgic' ? 'D' : 'S'}-${qn}/${hn}`, tip, motorKw: motor, egri: pts, kaynak: 'Jenerik eğri — GERÇEK ÜRÜN DEĞİL', dogrulandi: false });
  }

  const J = 'Jenerik değer — GERÇEK ÜRÜN DEĞİL';
  const filtre = [
    { id: 'gen-disk-2', tip: 'disk', ad: 'Disk filtre 2"', baglanti: '2"', mesh: 120, qMax: 25, hTemiz: 3, kirlenme: 3, kaynak: J, dogrulandi: false },
    { id: 'gen-disk-3', tip: 'disk', ad: 'Disk filtre 3"', baglanti: '3"', mesh: 120, qMax: 50, hTemiz: 3, kirlenme: 3, kaynak: J, dogrulandi: false },
    { id: 'gen-disk-4', tip: 'disk', ad: 'Disk filtre 4" (batarya)', baglanti: '4"', mesh: 120, qMax: 80, hTemiz: 3, kirlenme: 3, kaynak: J, dogrulandi: false },
    { id: 'gen-elek-2', tip: 'elek', ad: 'Elek filtre 2"', baglanti: '2"', mesh: 120, qMax: 25, hTemiz: 2, kirlenme: 3, kaynak: J, dogrulandi: false },
    { id: 'gen-elek-3', tip: 'elek', ad: 'Elek filtre 3"', baglanti: '3"', mesh: 120, qMax: 50, hTemiz: 2, kirlenme: 3, kaynak: J, dogrulandi: false },
    { id: 'gen-hs-2', tip: 'hidrosiklon', ad: 'Hidrosiklon 2"', baglanti: '2"', qMax: 25, hTemiz: 5, kirlenme: 0, kaynak: J, dogrulandi: false },
    { id: 'gen-hs-3', tip: 'hidrosiklon', ad: 'Hidrosiklon 3"', baglanti: '3"', qMax: 50, hTemiz: 5, kirlenme: 0, kaynak: J, dogrulandi: false },
    { id: 'gen-hs-4', tip: 'hidrosiklon', ad: 'Hidrosiklon 4"', baglanti: '4"', qMax: 80, hTemiz: 5, kirlenme: 0, kaynak: J, dogrulandi: false },
    { id: 'gen-kum-48', tip: 'kum', ad: 'Kum-çakıl filtre tankı 48"', baglanti: '3"', qMax: 45, hTemiz: 2, kirlenme: 3, kaynak: J, dogrulandi: false },
  ];
  // Vana kayıpları: h (m) = 10,2·(Q/Kv)²  (Kv: 1 bar kayıpta m³/h)
  const vana = [
    ['1"', 6, 13], ['1½"', 12, 27], ['2"', 22, 49], ['3"', 50, 112], ['4"', 90, 200], ['6"', 200, 447], ['8"', 350, 780],
  ].map(([cap, qMax, kv]) => ({ id: `gen-sv-${cap}`, tip: 'sektor', ad: `Shift vanası ${cap} (hidrolik/solenoid)`, cap, qMax, kv, kaynak: J, dogrulandi: false }));

  g.IRRI_CATALOG = { meta: { ad: 'Varsayılan katalog', surum: 1 }, borular: { pe, pvc, lateral }, pompa, filtre, vana };
  if (typeof module !== 'undefined') module.exports = g.IRRI_CATALOG;
})(typeof window !== 'undefined' ? window : globalThis);

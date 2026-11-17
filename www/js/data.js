// IrriGrow — sabit veri tabloları (kaynak: FAO-56, Keller & Bliesner, piyasa standart ölçüleri)
// Fiyatlar örnektir; Ayarlar ekranından güncellenmelidir.
(function (g) {
  const CROPS = {
    domates:   { ad: 'Domates (açık tarla)', kc: 1.15, tip: 'serit', Sr: 1.40, Sp: 0.40, Zr: 0.7, Gc: 0.9, p: 0.35, Pw: 0.6, aylar: [5,6,7,8,9] },
    domates_s: { ad: 'Domates (sera)',       kc: 1.15, tip: 'serit', Sr: 1.20, Sp: 0.40, Zr: 0.6, Gc: 0.9, p: 0.35, Pw: 0.6, aylar: [3,4,5,6,7,9,10], sera: true },
    biber:     { ad: 'Biber',                kc: 1.05, tip: 'serit', Sr: 0.70, Sp: 0.30, Zr: 0.6, Gc: 0.85, p: 0.30, Pw: 0.6, aylar: [5,6,7,8,9] },
    hiyar:     { ad: 'Hıyar (sera)',         kc: 1.00, tip: 'serit', Sr: 1.20, Sp: 0.40, Zr: 0.6, Gc: 0.9, p: 0.35, Pw: 0.6, aylar: [3,4,5,6,9,10], sera: true },
    karpuz:    { ad: 'Karpuz',               kc: 1.00, tip: 'serit', Sr: 2.00, Sp: 1.00, Zr: 1.0, Gc: 0.8, p: 0.40, Pw: 0.4, aylar: [5,6,7,8] },
    misir:     { ad: 'Mısır',                kc: 1.20, tip: 'serit', Sr: 0.70, Sp: 0.18, Zr: 1.0, Gc: 0.9, p: 0.40, Pw: 0.7, aylar: [5,6,7,8,9] },
    pamuk:     { ad: 'Pamuk',                kc: 1.18, tip: 'serit', Sr: 0.70, Sp: 0.15, Zr: 1.1, Gc: 0.9, p: 0.45, Pw: 0.7, aylar: [5,6,7,8,9] },
    patates:   { ad: 'Patates',              kc: 1.15, tip: 'serit', Sr: 0.75, Sp: 0.30, Zr: 0.5, Gc: 0.9, p: 0.35, Pw: 0.7, aylar: [4,5,6,7,8] },
    cilek:     { ad: 'Çilek',                kc: 0.85, tip: 'serit', Sr: 1.00, Sp: 0.30, Zr: 0.3, Gc: 0.8, p: 0.20, Pw: 0.6, aylar: [4,5,6,7,8,9] },
    bag:       { ad: 'Bağ (sofralık üzüm)',  kc: 0.85, tip: 'agac', Sr: 3.00, Sp: 1.50, Zr: 1.0, Gc: 0.6, p: 0.40, Pw: 0.35, ne: 2, aylar: [5,6,7,8,9] },
    zeytin:    { ad: 'Zeytin',               kc: 0.70, tip: 'agac', Sr: 6.00, Sp: 6.00, Zr: 1.2, Gc: 0.5, p: 0.65, Pw: 0.30, ne: 4, aylar: [4,5,6,7,8,9,10] },
    narenciye: { ad: 'Narenciye',            kc: 0.70, tip: 'agac', Sr: 6.00, Sp: 4.00, Zr: 1.0, Gc: 0.7, p: 0.50, Pw: 0.35, ne: 4, aylar: [4,5,6,7,8,9,10] },
    elma:      { ad: 'Elma (bodur)',         kc: 0.95, tip: 'agac', Sr: 3.50, Sp: 1.00, Zr: 1.0, Gc: 0.65, p: 0.50, Pw: 0.35, ne: 2, aylar: [4,5,6,7,8,9] },
    seftali:   { ad: 'Şeftali / Nektarin',   kc: 0.90, tip: 'agac', Sr: 5.00, Sp: 3.00, Zr: 1.0, Gc: 0.65, p: 0.50, Pw: 0.35, ne: 4, aylar: [4,5,6,7,8,9] },
    ceviz:     { ad: 'Ceviz',                kc: 1.10, tip: 'agac', Sr: 8.00, Sp: 8.00, Zr: 1.7, Gc: 0.7, p: 0.50, Pw: 0.35, ne: 6, aylar: [4,5,6,7,8,9] },
    nar:       { ad: 'Nar',                  kc: 0.80, tip: 'agac', Sr: 5.00, Sp: 3.00, Zr: 1.0, Gc: 0.6, p: 0.50, Pw: 0.35, ne: 4, aylar: [4,5,6,7,8,9,10] },
    badem:     { ad: 'Badem',                kc: 0.90, tip: 'agac', Sr: 6.00, Sp: 5.00, Zr: 1.2, Gc: 0.6, p: 0.40, Pw: 0.35, ne: 4, aylar: [4,5,6,7,8,9] },
    findik:    { ad: 'Fındık',               kc: 1.10, tip: 'agac', Sr: 5.00, Sp: 4.00, Zr: 0.8, Gc: 0.7, p: 0.50, Pw: 0.35, ne: 4, aylar: [5,6,7,8] },
  };

  // Temmuz ayı tepe ET0 (mm/gün) — bölgesel yaklaşık değerler; ölçülmüş veri varsa elle girin.
  const REGIONS = {
    akdeniz: { ad: 'Akdeniz', et0: 6.5 }, ege: { ad: 'Ege', et0: 6.2 }, marmara: { ad: 'Marmara', et0: 5.5 },
    icanadolu: { ad: 'İç Anadolu', et0: 6.5 }, gap: { ad: 'Güneydoğu Anadolu', et0: 8.0 },
    doguanadolu: { ad: 'Doğu Anadolu', et0: 5.8 }, karadeniz: { ad: 'Karadeniz', et0: 4.5 },
  };
  // Ay bazında ET0 / Temmuz ET0 oranı (Türkiye ortalaması, yaklaşık)
  const ET0_FACTOR = { 1: .18, 2: .25, 3: .38, 4: .52, 5: .70, 6: .88, 7: 1.0, 8: .93, 9: .68, 10: .44, 11: .26, 12: .17 };
  const SERA_FACTOR = 0.75; // sera içi ET0 açık alana göre

  // Faydalı su (mm/m toprak derinliği)
  const SOILS = { kumlu: { ad: 'Kumlu', aw: 70 }, tinli: { ad: 'Tınlı', aw: 150 }, killi: { ad: 'Killi', aw: 180 } };

  // Boru, pompa, filtre ve vana verileri catalog-data.js içindedir.

  // Varsayılan birim fiyatlar (TL) — ÖRNEKTİR, güncelleyin
  const DEFAULT_PRICES = {
    lateral16: 4.5, lateral20: 6.5, damlatici: 2.5, startKonnektor: 6, laterlSonu: 3,
    pe: { 32: 22, 40: 32, 50: 48, 63: 75, 75: 105, 90: 150, 110: 225 },
    pvc: { 63: 55, 75: 75, 90: 105, 110: 150, 125: 195, 140: 245, 160: 320, 200: 500, 225: 630, 250: 780, 315: 1250 },
    elektrik: 3.5, faiz: 0.10, omur: 15, items: {}, edited: {},
  };

  g.IRRI_DATA = { CROPS, REGIONS, ET0_FACTOR, SERA_FACTOR, SOILS, DEFAULT_PRICES };
  if (typeof module !== 'undefined') module.exports = g.IRRI_DATA;
})(typeof window !== 'undefined' ? window : globalThis);

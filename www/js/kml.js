// IrriGrow — MH-KML: KML/KMZ arazi sınırı içe aktarma (saf modül; DOM'a ve ağa dokunmaz, Node'da test edilir).
// Güvenlik:
//  - XML bir DOM ayrıştırıcısına verilmez; yalnız gerekli etiketler metin olarak okunur. DOCTYPE/ENTITY içeren dosya
//    reddedilir (harici varlık ve "milyar kahkaha" saldırıları), NetworkLink ve uzak bağlantılar yok sayılır.
//  - KMZ: zip açılmadan önce merkezî dizinden dosya sayısı ve toplam açılmış boyut denetlenir (zip bombası).
//  - Boyut, parsel ve köşe sayısı sınırları; sessiz basitleştirme yok.
// Yükseklik değerleri saklanır ama doğrulanmış hidrolik kot verisi SAYILMAZ (docs/mh-kml-plan.md §4).
(function (g) {
  const SINIR = Object.freeze({ dosyaBayt: 10 * 1024 * 1024, zipDosya: 200, zipAcik: 30 * 1024 * 1024, kmlBayt: 20 * 1024 * 1024, parsel: 500, kose: 5000 });
  const Gm = () => g.IrriGeom || (typeof require !== 'undefined' ? (require('./geom.js'), g.IrriGeom) : null);
  const ZIP = () => (g.XLSX && g.XLSX.CFB) || (typeof require !== 'undefined' ? require('../vendor/xlsx.full.min.js').CFB : null);
  const hata = (kod, mesaj, p) => { const e = new Error(mesaj); e.kod = kod; e.p = p || {}; return e; };

  // ---------- KMZ (zip) ----------
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  function zipMi(b) { return b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5) && (b[3] === 4 || b[3] === 6); }
  // Merkezî dizin: açmadan önce dosya sayısı ve açılmış toplam boyut (sınır aşımında hata)
  function zipDenetle(b) {
    let e = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) if (u32(b, i) === 0x06054b50) { e = i; break; }
    if (e < 0) throw hata('zip-bozuk', 'KMZ dosyası okunamadı (zip dizini bulunamadı).');
    const adet = u16(b, e + 10), cdOff = u32(b, e + 16);
    if (adet === 0xffff || cdOff === 0xffffffff) throw hata('zip-64', 'Çok büyük (ZIP64) KMZ dosyaları desteklenmiyor.');
    if (adet > SINIR.zipDosya) throw hata('zip-adet', 'KMZ içinde çok fazla dosya var ({n}; en çok {m}).', { n: adet, m: SINIR.zipDosya });
    let o = cdOff, toplam = 0; const adlar = [];
    for (let k = 0; k < adet; k++) {
      if (o + 46 > b.length || u32(b, o) !== 0x02014b50) throw hata('zip-bozuk', 'KMZ dosyası okunamadı (zip dizini bozuk).');
      const boy = u32(b, o + 24), nl = u16(b, o + 28), el = u16(b, o + 30), cl = u16(b, o + 32);
      if (boy === 0xffffffff) throw hata('zip-64', 'Çok büyük (ZIP64) KMZ dosyaları desteklenmiyor.');
      toplam += boy; adlar.push({ ad: new TextDecoder('utf-8').decode(b.subarray(o + 46, o + 46 + nl)), boy });
      o += 46 + nl + el + cl;
    }
    if (toplam > SINIR.zipAcik) throw hata('zip-buyuk', 'KMZ açıldığında çok büyük ({n} MB; en çok {m} MB).', { n: Math.round(toplam / 1048576), m: SINIR.zipAcik / 1048576 });
    return adlar;
  }
  function kmzOku(b) {
    const adlar = zipDenetle(b);
    const kmller = adlar.filter(x => /\.kml$/i.test(x.ad) && !/(^|\/)\.\.(\/|$)/.test(x.ad));
    if (!kmller.length) throw hata('kmz-kml-yok', 'KMZ içinde KML dosyası yok.');
    const sec = kmller.find(x => /(^|\/)doc\.kml$/i.test(x.ad)) || kmller[0];
    if (sec.boy > SINIR.kmlBayt) throw hata('kml-buyuk', 'KML dosyası çok büyük.');
    const C = ZIP(); if (!C) throw hata('zip-yok', 'KMZ okuyucu yüklenemedi.');
    let z; try { z = C.read(b, { type: 'array' }); } catch (e) { throw hata('zip-bozuk', 'KMZ dosyası okunamadı (bozuk zip).'); }
    const f = C.find(z, sec.ad) || C.find(z, '/' + sec.ad);
    if (!f || !f.content) throw hata('zip-bozuk', 'KMZ içindeki KML açılamadı.');
    if (f.content.length > SINIR.kmlBayt || f.content.length !== sec.boy) throw hata('zip-buyuk', 'KMZ içindeki KML boyutu beklenenden farklı; güvenlik nedeniyle açılmadı.');
    return { metin: new TextDecoder('utf-8').decode(f.content), icDosya: sec.ad };
  }

  // ---------- KML metni ----------
  const ent = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (m, k) =>
    ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[k.toLowerCase()] ?? String.fromCodePoint(k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10))).trim();
  const etiketler = (s, ad) => { const re = new RegExp(`<${ad}(?:\\s[^>]*)?>([\\s\\S]*?)</${ad}>`, 'g'), out = []; let m; while ((m = re.exec(s))) out.push(m[1]); return out; };
  const ilk = (s, ad) => { const x = etiketler(s, ad); return x.length ? x[0] : null; };

  function koordinatlar(metin, uyar) {
    const out = [], z = [];
    for (const parca of metin.trim().split(/\s+/)) {
      if (!parca) continue;
      const v = parca.split(',').map(Number);
      if (v.length < 2 || !Number.isFinite(v[0]) || !Number.isFinite(v[1])) throw hata('koord', 'Geçersiz koordinat: "{c}".', { c: parca.slice(0, 40) });
      const [lng, lat] = v;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw hata('koord-aralik', 'Koordinat WGS84 aralığı dışında (enlem {a}, boylam {b}).', { a: lat, b: lng });
      out.push([lat, lng]); z.push(v.length >= 3 && Number.isFinite(v[2]) ? v[2] : null);
    }
    if (out.length > SINIR.kose) throw hata('kose', 'Bir sınırda çok fazla köşe var ({n}; en çok {m}).', { n: out.length, m: SINIR.kose });
    // Kapanış noktası ve ardışık yinelenen köşeler
    const eq = (a, b) => Math.abs(a[0] - b[0]) < 1e-10 && Math.abs(a[1] - b[1]) < 1e-10;
    const r = [], rz = [];
    out.forEach((p, i) => { if (!r.length || !eq(r[r.length - 1], p)) { r.push(p); rz.push(z[i]); } else uyar('yinelenen'); });
    if (r.length > 1 && eq(r[0], r[r.length - 1])) { r.pop(); rz.pop(); } else if (r.length) uyar('kapanmamis');
    return { halka: r, z: rz.some(x => x != null) ? rz : null };
  }

  function alanCevre(halka) {
    const G = Gm(), L = G.toLocal(halka);
    let c = 0; for (let i = 0; i < L.pts.length; i++) { const a = L.pts[i], b = L.pts[(i + 1) % L.pts.length]; c += Math.hypot(b[0] - a[0], b[1] - a[1]); }
    return { alan: Math.abs(G.polyArea(L.pts)), cevre: c, kesiyor: G.selfIntersects(L.pts) };
  }

  // Ana giriş: metin (KML) veya bayt dizisi (KML/KMZ). Dönüş: { parseller, notlar, kaynak }
  function oku(veri, dosyaAdi = '') {
    let b = null, metin = null, tur = 'kml', icDosya = null;
    if (typeof veri === 'string') metin = veri;
    else { b = veri instanceof Uint8Array ? veri : new Uint8Array(veri); }
    if (b) {
      if (b.length > SINIR.dosyaBayt) throw hata('dosya-buyuk', 'Dosya çok büyük ({n} MB; en çok {m} MB).', { n: Math.round(b.length / 1048576), m: SINIR.dosyaBayt / 1048576 });
      if (!b.length) throw hata('bos', 'Dosya boş.');
      if (zipMi(b)) { const k = kmzOku(b); metin = k.metin; tur = 'kmz'; icDosya = k.icDosya; }
      else metin = new TextDecoder('utf-8').decode(b);
    }
    if (metin.length > SINIR.kmlBayt) throw hata('kml-buyuk', 'KML dosyası çok büyük.');
    metin = metin.replace(/^﻿/, '');
    if (/<!DOCTYPE|<!ENTITY/i.test(metin)) throw hata('doctype', 'Dosya DOCTYPE/ENTITY tanımı içeriyor; güvenlik nedeniyle açılmadı.');
    metin = metin.replace(/<!--[\s\S]*?-->/g, '').replace(/<(\/?)[A-Za-z_][\w.-]*:/g, '<$1');   // yorumlar ve ad alanı önekleri
    if (!/<kml[\s>]/i.test(metin) && !/<Placemark[\s>]/.test(metin)) throw hata('kml-degil', 'Bu bir KML dosyası değil.');
    const notlar = [];
    if (/<NetworkLink[\s>]/.test(metin)) notlar.push({ kod: 'networklink', mesaj: 'Dosyadaki ağ bağlantıları (NetworkLink) yok sayıldı; ağa istek yapılmadı.' });
    const pmler = etiketler(metin, 'Placemark');
    if (pmler.length > SINIR.parsel) throw hata('parsel-cok', 'Dosyada çok fazla öğe var ({n}; en çok {m}).', { n: pmler.length, m: SINIR.parsel });
    const parseller = []; let cizgi = 0, nokta = 0;
    pmler.forEach((pm, i) => {
      const ad0 = ilk(pm.replace(/<(Polygon|MultiGeometry|ExtendedData)[\s\S]*?<\/\1>/g, ''), 'name');
      const ad = ad0 != null ? ent(ad0).slice(0, 120) : `Öğe ${i + 1}`;
      const poligonlar = etiketler(pm, 'Polygon');
      if (!poligonlar.length) { if (/<LineString[\s>]/.test(pm)) cizgi++; else if (/<Point[\s>]/.test(pm)) nokta++; return; }
      poligonlar.forEach((pg, j) => {
        const uyarilar = [], uyar = k => { if (!uyarilar.includes(k)) uyarilar.push(k); };
        const dis = ilk(pg, 'outerBoundaryIs');
        const kd = dis != null ? ilk(dis, 'coordinates') : null;
        if (kd == null) { notlar.push({ kod: 'dis-sinir-yok', mesaj: '"{a}" içinde dış sınır yok; alınmadı.', p: { a: ad } }); return; }
        let k;
        try { k = koordinatlar(kd, uyar); } catch (e) { parseller.push({ id: `${i}.${j}`, ad, hata: e.message, hataP: e.p, hesaplanabilir: false, uyarilar: [] }); return; }
        const bosluk = etiketler(pg, 'innerBoundaryIs').map(x => { try { return koordinatlar(ilk(x, 'coordinates') || '', () => {}).halka; } catch (e) { return null; } }).filter(x => x && x.length >= 3);
        const irtifa = ilk(pg, 'altitudeMode');
        const p = { id: `${i}.${j}`, ad: poligonlar.length > 1 ? `${ad} (${j + 1})` : ad, halka: k.halka, yukseklikler: k.z, irtifaModu: irtifa ? ent(irtifa) : 'clampToGround', bosluklar: bosluk.length, uyarilar };
        if (k.halka.length < 3) { p.hata = 'En az 3 farklı köşe gerekli.'; p.hesaplanabilir = false; parseller.push(p); return; }
        const ac = alanCevre(k.halka);
        p.alan_m2 = ac.alan; p.cevre_m = ac.cevre; p.kendiniKesiyor = ac.kesiyor;
        p.bosluk_m2 = bosluk.reduce((t, h) => t + alanCevre(h).alan, 0);
        p.hesaplanabilir = !ac.kesiyor && !bosluk.length && ac.alan > 1;
        if (ac.kesiyor) p.hata = 'Sınır kendini kesiyor; alınamaz.';
        else if (bosluk.length) { p.hata = 'Parsel içinde {n} boşluk var; hesap motoru henüz desteklemiyor — yalnız dış sınırla hesap yapılmaz.'; p.hataP = { n: bosluk.length }; }
        parseller.push(p);
      });
    });
    if (cizgi) notlar.push({ kod: 'cizgi', mesaj: '{n} çizgi (LineString) parsel olarak alınmadı.', p: { n: cizgi } });
    if (nokta) notlar.push({ kod: 'nokta', mesaj: '{n} nokta (Point) parsel olarak alınmadı.', p: { n: nokta } });
    if (!parseller.length) throw hata('parsel-yok', 'Dosyada parsel (Polygon) bulunamadı.');
    return { parseller, notlar, kaynak: { tur, dosya: String(dosyaAdi).slice(0, 200), icDosya } };
  }

  // Projeye yazılacak kaynak bilgisi. Yükseklikler hidrolik kot sayılmaz (yalnız saklanır).
  function geoKaynak(sonuc, p, tarih = new Date()) {
    return { tur: sonuc.kaynak.tur, dosya: sonuc.kaynak.dosya, icDosya: sonuc.kaynak.icDosya, parsel: p.ad, iceAktarma: tarih.toISOString(),
      yukseklikler: p.yukseklikler || null, irtifaModu: p.irtifaModu || null, kotDogrulanmis: false, alan_m2: p.alan_m2 };
  }

  const api = { SINIR, oku, geoKaynak, zipDenetle };
  g.IrriKml = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

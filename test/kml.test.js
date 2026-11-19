// MH-KML — KML/KMZ içe aktarma: ayrıştırma, geometri denetimi, güvenlik sınırları (Node)
const { test, near, ok, Gm } = require('./_lib');
const K = require('../www/js/kml.js');
const C = require('../www/vendor/xlsx.full.min.js').CFB;

const kare = (lat, lng, d, z) => { const p = [[lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat]]; return p.map(([x, y]) => z == null ? `${x},${y}` : `${x},${y},${z}`).join(' '); };
const poly = (koord, ic) => `<Polygon><outerBoundaryIs><LinearRing><coordinates>${koord}</coordinates></LinearRing></outerBoundaryIs>${ic ? `<innerBoundaryIs><LinearRing><coordinates>${ic}</coordinates></LinearRing></innerBoundaryIs>` : ''}</Polygon>`;
const pm = (ad, geo) => `<Placemark><name>${ad}</name>${geo}</Placemark>`;
const kml = govde => `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Belge</name>${govde}</Document></kml>`;
const kmz = (dosyalar, sikistir) => { const z = C.utils.cfb_new(); for (const [ad, ic] of dosyalar) C.utils.cfb_add(z, ad, Buffer.from(ic)); return new Uint8Array(C.write(z, { fileType: 'zip', type: 'array', compression: !!sikistir })); };
const hataKodu = fn => { try { fn(); } catch (e) { return e.kod; } return null; };

test('KML-01 Google Earth biçimi: ad, köşeler, bilinen alan (0,001° kare, 37°K ≈ 9874 m²)', () => {
  const r = K.oku(kml(pm('Tarla 1', poly(kare(37, 35, 0.001, 0)))), 'tarla.kml');
  ok(r.parseller.length === 1, 'tek parsel'); const p = r.parseller[0];
  ok(p.ad === 'Tarla 1' && p.hesaplanabilir, 'ad / hesaplanabilir');
  ok(p.halka.length === 4, `kapanış noktası çıkarılmalı: ${p.halka.length}`);
  ok(p.halka[0][0] === 37 && p.halka[0][1] === 35, 'KML lng,lat → [lat,lng]');
  near(p.alan_m2, 9874.5, 15, 'alan'); near(p.cevre_m, 4 * 99.3, 3, 'çevre');
  ok(r.kaynak.tur === 'kml' && r.kaynak.dosya === 'tarla.kml', 'kaynak');
  // Motorun geometrisiyle aynı alan
  near(p.alan_m2, Math.abs(Gm.polyArea(Gm.toLocal(p.halka).pts)), 1e-6, 'geom.js ile aynı');
});

test('KML-02 MultiGeometry ve klasörler: her poligon ayrı aday; çizgi/nokta not olarak', () => {
  const g = `<Folder><name>Klasör</name>${pm('Çoklu', `<MultiGeometry>${poly(kare(37, 35, 0.001))}${poly(kare(37.01, 35, 0.002))}</MultiGeometry>`)}<Folder>${pm('İç', poly(kare(38, 36, 0.001)))}</Folder></Folder>`
    + pm('Yol', '<LineString><coordinates>35,37 35.1,37.1</coordinates></LineString>') + pm('Kuyu', '<Point><coordinates>35,37</coordinates></Point>');
  const r = K.oku(kml(g));
  ok(r.parseller.length === 3, `3 aday: ${r.parseller.length}`);
  ok(r.parseller[0].ad === 'Çoklu (1)' && r.parseller[1].ad === 'Çoklu (2)' && r.parseller[2].ad === 'İç', r.parseller.map(p => p.ad).join());
  ok(r.parseller[1].alan_m2 > 3.9 * r.parseller[0].alan_m2, 'ikinci poligon 4 kat');
  const kod = r.notlar.map(n => n.kod); ok(kod.includes('cizgi') && kod.includes('nokta'), kod.join());
});

test('KML-03 İç sınır (boşluk) olan parsel hesaplanamaz; kendini kesen sınır alınamaz', () => {
  const r = K.oku(kml(pm('Delikli', poly(kare(37, 35, 0.002), kare(37.0005, 35.0005, 0.0005))) + pm('Kelebek', poly('35,37 35.001,37.001 35.001,37 35,37.001 35,37'))));
  const [a, b] = r.parseller;
  ok(!a.hesaplanabilir && a.bosluklar === 1 && a.bosluk_m2 > 0 && /boşluk/.test(a.hata), 'boşluk');
  ok(!b.hesaplanabilir && b.kendiniKesiyor && /kendini kesiyor/.test(b.hata), 'kendini kesen');
});

test('KML-04 Kapanmamış sınır kapatılır, yinelenen köşeler temizlenir, 3’ten az köşe reddedilir', () => {
  const r = K.oku(kml(pm('Açık', poly('35,37 35.001,37 35.001,37 35.001,37.001 35,37.001')) + pm('Çizgi gibi', poly('35,37 35.001,37 35,37'))));
  const [a, b] = r.parseller;
  ok(a.hesaplanabilir && a.halka.length === 4, 'açık sınır');
  ok(a.uyarilar.includes('kapanmamis') && a.uyarilar.includes('yinelenen'), a.uyarilar.join());
  ok(!b.hesaplanabilir && /En az 3/.test(b.hata), 'az köşe');
});

test('KML-05 Güvenlik: DOCTYPE/ENTITY reddedilir; NetworkLink izlenmez; betik çalıştırılmaz', () => {
  ok(hataKodu(() => K.oku('<?xml version="1.0"?><!DOCTYPE kml [<!ENTITY x SYSTEM "file:///etc/passwd">]><kml><Placemark><name>&x;</name></Placemark></kml>')) === 'doctype', 'DOCTYPE');
  const r = K.oku(kml(`<NetworkLink><Link><href>http://ornek.invalid/a.kml</href></Link></NetworkLink>` + pm('<![CDATA[<script>globalThis.__kmlXSS=1</script>Ad]]>', poly(kare(37, 35, 0.001)))));
  ok(r.notlar.some(n => n.kod === 'networklink'), 'NetworkLink notu');
  ok(globalThis.__kmlXSS === undefined, 'betik çalışmamalı');
  ok(typeof r.parseller[0].ad === 'string', 'ad yalnız metin');
  ok(hataKodu(() => K.oku('<html><body>merhaba</body></html>')) === 'kml-degil', 'KML değil');
  ok(hataKodu(() => K.oku(new Uint8Array(0))) === 'bos', 'boş');
});

test('KML-06 Ad alanı önekleri, yorumlar, CDATA ve Türkçe/varlıklı adlar', () => {
  const s = `<?xml version="1.0"?><kml:kml xmlns:kml="http://www.opengis.net/kml/2.2"><kml:Document><!-- <Placemark><name>yorum</name></Placemark> --><kml:Placemark><kml:name><![CDATA[Çiftlik Ğ & Ş]]></kml:name>${poly(kare(37, 35, 0.001)).replace(/<(\/?)/g, '<$1kml:')}</kml:Placemark><kml:Placemark><kml:name>A &amp; B &#305; &#x15F;</kml:name>${poly(kare(37, 35.01, 0.001)).replace(/<(\/?)/g, '<$1kml:')}</kml:Placemark></kml:Document></kml:kml>`;
  const r = K.oku(s);
  ok(r.parseller.length === 2, `yorumdaki öğe alınmamalı: ${r.parseller.length}`);
  ok(r.parseller[0].ad === 'Çiftlik Ğ & Ş', r.parseller[0].ad);
  ok(r.parseller[1].ad === 'A & B ı ş', r.parseller[1].ad);
  ok(r.parseller.every(p => p.hesaplanabilir), 'önekli geometri');
});

test('KML-07 WGS84 aralığı ve geçersiz koordinat', () => {
  const r = K.oku(kml(pm('Taşan', poly('35,95 35.001,95 35.001,95.001 35,95')) + pm('Bozuk', poly('35,37 abc,37 35,37.001'))));
  ok(r.parseller.every(p => !p.hesaplanabilir), 'ikisi de hesaplanamaz');
  ok(/WGS84/.test(r.parseller[0].hata) && /Geçersiz koordinat/.test(r.parseller[1].hata), r.parseller.map(p => p.hata).join(' | '));
  ok(hataKodu(() => K.oku(kml(pm('Yok', '<Point><coordinates>35,37</coordinates></Point>')))) === 'parsel-yok', 'poligon yok');
});

test('KML-08 Yükseklikler saklanır ama hidrolik kot sayılmaz', () => {
  const r = K.oku(kml(pm('Z', `<Polygon><altitudeMode>absolute</altitudeMode><outerBoundaryIs><LinearRing><coordinates>${kare(37, 35, 0.001, 120)}</coordinates></LinearRing></outerBoundaryIs></Polygon>`)), 'z.kml');
  const p = r.parseller[0]; ok(p.yukseklikler && p.yukseklikler.length === 4 && p.yukseklikler.every(z => z === 120), 'z değerleri');
  const g = K.geoKaynak(r, p, new Date('2026-01-02T00:00:00Z'));
  ok(g.kotDogrulanmis === false && g.irtifaModu === 'absolute' && g.tur === 'kml' && g.parsel === 'Z' && g.iceAktarma === '2026-01-02T00:00:00.000Z', JSON.stringify(g));
  ok(K.oku(kml(pm('2B', poly(kare(37, 35, 0.001))))).parseller[0].yukseklikler === null, '2B dosyada yükseklik yok');
});

test('KML-09 KMZ: doc.kml seçilir, üst dizin yolu (..) yok sayılır', () => {
  const b = kmz([['../kotu.kml', kml(pm('Kötü', poly(kare(1, 1, 0.001))))], ['files/diger.kml', kml(pm('Diğer', poly(kare(2, 2, 0.001))))], ['doc.kml', kml(pm('Asıl', poly(kare(37, 35, 0.001))))], ['files/resim.png', 'x']]);
  const r = K.oku(b, 'tarla.kmz');
  ok(r.kaynak.tur === 'kmz' && /doc\.kml$/.test(r.kaynak.icDosya) && r.parseller[0].ad === 'Asıl', JSON.stringify(r.kaynak));
  const r2 = K.oku(kmz([['../kotu.kml', 'x'], ['a/b.kml', kml(pm('B', poly(kare(37, 35, 0.001))))]]));
  ok(r2.parseller[0].ad === 'B', 'yalnız güvenli yol');
  ok(hataKodu(() => K.oku(kmz([['resim.png', 'x']]))) === 'kmz-kml-yok', 'KML yok');
  ok(hataKodu(() => K.oku(new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3]))) === 'zip-bozuk', 'bozuk zip');
});

test('KML-10 KMZ sınırları: zip bombası (merkezî dizin boyutu), dosya sayısı, boyut uyuşmazlığı, dosya boyutu', () => {
  const b = kmz([['doc.kml', kml(pm('A', poly(kare(37, 35, 0.001))))]], true);   // deflate: gerçek açılmış boyut ayrı
  // Merkezî dizindeki açılmış boyutu 31 MB yap → açmadan reddedilmeli
  const bomb = b.slice(); let o = -1;
  for (let i = 0; i < bomb.length - 4; i++) if (bomb[i] === 0x50 && bomb[i + 1] === 0x4b && bomb[i + 2] === 1 && bomb[i + 3] === 2) {
    const nl = bomb[i + 28] | (bomb[i + 29] << 8); if (new TextDecoder().decode(bomb.subarray(i + 46, i + 46 + nl)).endsWith('doc.kml')) { o = i; break; }
  }
  ok(o > 0, 'merkezî dizin girdisi bulunamadı');
  const yaz = (arr, n) => { arr[o + 24] = n & 255; arr[o + 25] = (n >> 8) & 255; arr[o + 26] = (n >> 16) & 255; arr[o + 27] = (n >>> 24) & 255; };
  yaz(bomb, 31 * 1048576); ok(hataKodu(() => K.oku(bomb)) === 'zip-buyuk', 'zip bombası');
  // Dizinde gerçekten küçük boyut bildirilirse (sınır denetimini atlatma girişimi) açılan içerik kabul edilmemeli
  const yalan = b.slice(); const gercek = yalan[o + 24] | (yalan[o + 25] << 8); yaz(yalan, gercek - 10);
  ok(['zip-buyuk', 'zip-bozuk'].includes(hataKodu(() => K.oku(yalan))), 'bildirilen < gerçek boyut');
  ok(K.oku(b).parseller.length === 1, 'sıkıştırılmış KMZ açılır');
  const cok = kmz(Array.from({ length: K.SINIR.zipDosya + 1 }, (_, i) => [`f${i}.txt`, 'x']));
  ok(hataKodu(() => K.oku(cok)) === 'zip-adet', 'dosya sayısı');
  ok(hataKodu(() => K.oku(new Uint8Array(K.SINIR.dosyaBayt + 1))) === 'dosya-buyuk', 'dosya boyutu');
});

test('KML-11 Öğe ve köşe sınırları', () => {
  const cokOge = kml(Array.from({ length: K.SINIR.parsel + 1 }, (_, i) => pm('P' + i, poly(kare(37, 35 + i * 0.002, 0.001)))).join(''));
  ok(hataKodu(() => K.oku(cokOge)) === 'parsel-cok', 'öğe sınırı');
  const n = K.SINIR.kose + 1, k = Array.from({ length: n }, (_, i) => { const a = 2 * Math.PI * i / n; return `${35 + 0.01 * Math.cos(a)},${37 + 0.01 * Math.sin(a)}`; }).join(' ');
  const r = K.oku(kml(pm('Çok köşe', poly(k))));
  ok(!r.parseller[0].hesaplanabilir && /çok fazla köşe/.test(r.parseller[0].hata), 'köşe sınırı');
});

test('KML-12 Modül saf: DOM, ağ ve global durum değişmez; API dondurulmuş', () => {
  const once = Object.keys(globalThis).sort().join();
  K.oku(kml(pm('A', poly(kare(37, 35, 0.001)))));
  ok(Object.keys(globalThis).sort().join() === once, 'global değişti');
  ok(Object.isFrozen(K.SINIR), 'SINIR dondurulmuş');
  const src = require('fs').readFileSync(require.resolve('../www/js/kml.js'), 'utf8');
  ok(!/fetch\(|XMLHttpRequest|DOMParser|innerHTML|eval\(|new Function/.test(src), 'yasak çağrı');
});

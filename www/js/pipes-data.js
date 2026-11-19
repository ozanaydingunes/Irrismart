// IrriGrow — PN-1 standart tabanlı boru kütüphanesi verisi (üreticiden bağımsız).
// Değerler docs/pn-kaynaklar.md belgesindeki üretici kataloglarından birebir alındı (karşılaştırma: 19.11.2026).
// Etkin satırlar en az iki bağımsız üreticinin standart atıflı kataloğunda AYNI değerle yer alır.
// "standart-metni" düzeyi hiçbir satırda yoktur: standardın tam metniyle doğrudan karşılaştırılmadı.
// PN-1: hesap motoru, otomatik seçim ve eski katalog (catalog-data.js) bu dosyayı KULLANMAZ.
(function (g) {
  const T = '2026-11-19';
  const SURUM_PE = 'EN 12201-2 (Pipelife: EN 12201-2:2024; Uponor: EN 12201, sürüm belirtilmemiş; Aliaxis: BS EN 12201-2, sürüm belirtilmemiş)';
  const S = (malzeme, od, sdr, enMin, pn, kaynaklar, pnKaynak) => ({ malzeme, standart: 'EN 12201-2', standartSurum: SURUM_PE, od, sdr, enMin, pn,
    mrs: malzeme === 'PE100' ? 10 : 8, cTasarim: 1.25, hatTurleri: ['ana', 'dagitim', 'manifold'], kaynaklar, pnKaynak, dogrulama: 'iki-uretici-katalogu', dogrulamaTarihi: T });
  // kaynaklar: boyut (en küçük et) kaynakları; pnKaynak: SDR → PN eşleşmesini veren kaynaklar. mrs/cTasarim yalnız çapraz denetim içindir.
  const SATIRLAR = [
    S('PE100', 32, 17, 2, 10, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100']),
    S('PE100', 32, 11, 3, 16, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100']),
    S('PE100', 40, 17, 2.4, 10, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100']),
    S('PE100', 40, 11, 3.7, 16, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100']),
    S('PE100', 50, 17, 3, 10, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100']),
    S('PE100', 50, 11, 4.6, 16, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100']),
    S('PE100', 63, 17, 3.8, 10, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100']),
    S('PE100', 63, 11, 5.8, 16, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100']),
    S('PE100', 75, 17, 4.5, 10, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 75, 11, 6.8, 16, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 90, 17, 5.4, 10, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 90, 11, 8.2, 16, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 110, 17, 6.6, 10, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 110, 11, 10, 16, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 125, 17, 7.4, 10, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 125, 11, 11.4, 16, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 140, 17, 8.3, 10, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 140, 11, 12.7, 16, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 160, 17, 9.5, 10, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 160, 11, 14.6, 16, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 180, 17, 10.7, 10, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 180, 11, 16.4, 16, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 200, 17, 11.9, 10, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 200, 11, 18.2, 16, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 225, 17, 13.4, 10, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 225, 11, 20.5, 16, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 250, 17, 14.8, 10, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 250, 11, 22.7, 16, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 280, 17, 16.6, 10, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 280, 11, 25.4, 16, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 315, 17, 18.7, 10, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE100', 315, 11, 28.6, 16, ['pl-ll', 'upo-pe100'], ['pl-ll', 'upo-pe100', 'ali-pe100']),
    S('PE80', 40, 11, 3.7, 12.5, ['upo-pe80', 'ali-pe80', 'pl-ll'], ['upo-pe80', 'ali-pe80']),
    S('PE80', 50, 11, 4.6, 12.5, ['upo-pe80', 'ali-pe80', 'pl-ll'], ['upo-pe80', 'ali-pe80']),
    S('PE80', 63, 11, 5.8, 12.5, ['upo-pe80', 'ali-pe80', 'pl-ll'], ['upo-pe80', 'ali-pe80']),
  ];
  // Etkin kütüphaneye ALINMAYAN satırlar (yalnız karşılaştırma raporu için): tek kaynak veya kaynaklar arası çelişki
  const ADAYLAR = [
    { malzeme: 'PE100', od: 32, sdr: 13.6, degerler: { 'pl-ll': 2.4 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 40, sdr: 21, degerler: { 'pl-ll': 2 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 40, sdr: 13.6, degerler: { 'pl-ll': 3 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 50, sdr: 26, degerler: { 'pl-ll': 2 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 50, sdr: 21, degerler: { 'pl-ll': 2.4 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 50, sdr: 13.6, degerler: { 'pl-ll': 3.7 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 63, sdr: 26, degerler: { 'pl-ll': 2.5 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 63, sdr: 21, degerler: { 'pl-ll': 3 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 63, sdr: 13.6, degerler: { 'pl-ll': 4.7 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 75, sdr: 26, degerler: { 'pl-ll': 2.9 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 75, sdr: 21, degerler: { 'pl-ll': 3.6 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 75, sdr: 13.6, degerler: { 'pl-ll': 5.6 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 90, sdr: 26, degerler: { 'pl-ll': 3.5 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 90, sdr: 21, degerler: { 'pl-ll': 4.3 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 90, sdr: 13.6, degerler: { 'pl-ll': 6.7 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 110, sdr: 26, degerler: { 'pl-ll': 4.2 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 110, sdr: 21, degerler: { 'pl-ll': 5.3 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 110, sdr: 13.6, degerler: { 'pl-ll': 8.1 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 125, sdr: 26, degerler: { 'pl-ll': 4.8 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 125, sdr: 21, degerler: { 'pl-ll': 6 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 125, sdr: 13.6, degerler: { 'pl-ll': 9.2 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 140, sdr: 26, degerler: { 'pl-ll': 5.4 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 140, sdr: 21, degerler: { 'pl-ll': 6.7 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 140, sdr: 13.6, degerler: { 'pl-ll': 10.3 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 160, sdr: 26, degerler: { 'pl-ll': 6.2 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 160, sdr: 21, degerler: { 'pl-ll': 7.7 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 160, sdr: 13.6, degerler: { 'pl-ll': 11.8 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 180, sdr: 26, degerler: { 'pl-ll': 6.9 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 180, sdr: 21, degerler: { 'pl-ll': 8.6 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 180, sdr: 13.6, degerler: { 'pl-ll': 13.3 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 200, sdr: 26, degerler: { 'pl-ll': 7.7 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 200, sdr: 21, degerler: { 'pl-ll': 9.6 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 200, sdr: 13.6, degerler: { 'pl-ll': 14.7 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 225, sdr: 26, degerler: { 'pl-ll': 8.6 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 225, sdr: 21, degerler: { 'pl-ll': 10.8 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 225, sdr: 13.6, degerler: { 'pl-ll': 16.6 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 250, sdr: 26, degerler: { 'pl-ll': 9.6 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 250, sdr: 21, degerler: { 'pl-ll': 11.9 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 250, sdr: 13.6, degerler: { 'pl-ll': 18.4 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 280, sdr: 26, degerler: { 'pl-ll': 10.7 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 280, sdr: 21, degerler: { 'pl-ll': 13.4 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 280, sdr: 13.6, degerler: { 'pl-ll': 20.6 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 315, sdr: 26, degerler: { 'pl-ll': 12.1 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 315, sdr: 21, degerler: { 'pl-ll': 15 }, neden: 'tek-kaynak' },
    { malzeme: 'PE100', od: 315, sdr: 13.6, degerler: { 'pl-ll': 23.2 }, neden: 'tek-kaynak' },
    { malzeme: 'PE80', od: 32, sdr: 11, degerler: { 'upo-pe80': 2.9, 'ali-pe80': 3, 'pl-ll': 3 }, neden: 'celiski' },
  ];
  const KAYNAKLAR = {
    'pl-ll': { yayimci: 'Pipelife Norge AS', belge: 'Marine Piping Solutions — Long Length Large Diameter PE Pipes, Product Technical Guide', tablo: 'Enclosure 1: Pipe production range (en küçük et, EN 12201-2); Table 3 Pressure ratings; Table 4 Strength reduction coefficients', atif: 'EN 12201-2:2024; ISO 4427-2; EN 12201-1:2024 ve ISO 13761:1996 (Table 4)', tarih: 'PDF oluşturma 2026-09-04', url: 'https://www.pipelife.com/content/dam/pipelife/international/marketing/general/brochures/Pipelife-long-length-PE-Pipe-Systems.pdf', erisim: T },
    'upo-pe100': { yayimci: 'Uponor Infra Oy', belge: 'PE100 pressure pipes — Technical factsheet', tablo: 'Table: Wall thickness PE100 (SDR17 PN10, SDR11 PN16)', atif: 'EN 12201, EN 1555 (sürüm belirtilmemiş)', tarih: '09/2020', url: 'https://brandportal.uponor.com/m/20832399649c7390/original/PE100-2-page-factsheet_EN.pdf', erisim: T },
    'upo-pe80': { yayimci: 'Uponor Infra Oy', belge: 'PE80 (PEM) pressure pipes — Technical factsheet', tablo: 'Table: Wall thickness PE80 (SDR11 = PN12,5)', atif: 'EN 12201 (sürüm belirtilmemiş)', tarih: '09/2020', url: 'https://brandportal.uponor.com/m/419630c4323f245c/original/Uponor_PE80_pressure_pipes_Technical_Datasheet_EN.pdf', erisim: T },
    'ali-pe100': { yayimci: 'Aliaxis UK (GPS)', belge: 'GPS PE Black pipe (PE100) — Product data sheet', tablo: 'Range / pressure rating (SDR11 16 bar, SDR17 10 bar, SDR21 8 bar, SDR26 6 bar, SDR33 5 bar); boyut tablosu yok', atif: 'BS EN 12201-2 (Kitemark KM 508224; sürüm belirtilmemiş)', tarih: 'PDF oluşturma 2023-03-02', url: 'https://www.aliaxis.co.uk/website/aliaxis-uk/Downloads/Data%20sheets/Aliaxis%20GPS%20PE%20Black%20pipe%20%28PE100%29%20datasheet.pdf', erisim: T },
    'ali-pe80': { yayimci: 'Aliaxis UK (GPS)', belge: 'GPS PE Black pipe (PE80) — Product data sheet', tablo: 'Pipe dimensions — water applications (BS EN 12201-2), SDR 11, Min t; SDR11 = 12,5 bar', atif: 'BS EN 12201-2 (sürüm belirtilmemiş)', tarih: 'PDF oluşturma 2020-10-21', url: 'https://www.aliaxis.co.uk/website/aliaxis-uk/Downloads/Data%20sheets/Aliaxis%20GPS%20PE%20Black%20pipe%20%28PE80%29%20datasheet.pdf', erisim: T },
  };
  // Sıcaklık katsayıları: DOĞRULANMADI. Etkin tablo yok → sicaklikKatsayisi() null döner ("veri eksik").
  // PE100 için tek üretici kaynağı (pl-ll Table 4, EN 12201-1:2024 atıflı) aday olarak saklanır; ikinci bağımsız
  // kaynak ve ISO 4427-1:2019 Ek A metni erişilemedi. PE80 ve PVC-U için kaynak yok.
  const SICAKLIK = { PE100: null, PE80: null, 'PVC-U': null };
  const SICAKLIK_ADAY = {
    PE100: { kaynak: 'pl-ll', atif: 'EN 12201-1:2024, ISO 13761:1996', noktalar: [[20, 1.00], [25, 0.92], [30, 0.85], [35, 0.79], [40, 0.73], [45, 0.67], [50, 0.62]], neden: 'tek-kaynak' },
  };
  const EKSIK = [
    'PVC-U: EN ISO 1452-2 tablolarını içeren iki bağımsız üretici kataloğuna erişilemedi — etkin PVC-U satırı yok',
    'PE100 SDR26, SDR21, SDR13,6: yalnız tek üretici tablosunda (Pipelife) — etkin değil',
    'PE80 SDR13,6/17/21 ve Ø75 üstü SDR11: PE80 için iki bağımsız boyut tablosu yok — etkin değil',
    'Sıcaklık katsayıları (PE100, PE80, PVC-U): iki bağımsız kaynakla doğrulanamadı; ISO 4427-1:2019 Ek A metnine erişilemedi',
    'ISO ve EN resmî kayıt sayfaları (iso.org) bu ortamdan okunamadı (HTTP 403); sürüm bilgisi kataloglardaki atıflardan',
  ];
  const api = { KAYNAKLAR, SATIRLAR, ADAYLAR, SICAKLIK, SICAKLIK_ADAY, EKSIK, SURUM_PE, TARIH: T };
  g.IRRI_PIPES_DATA = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

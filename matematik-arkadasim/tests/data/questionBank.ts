import { Rational } from "@/lib/math/rational";

/**
 * 7. sınıf matematik doğruluk test kümesi — 117 özgün soru.
 *
 * Her soru için:
 *  - answer: beklenen doğru cevap (öğrencinin yazacağı biçimde)
 *  - verify(): cevaptan BAĞIMSIZ olarak, soru verilerinden yeniden hesaplanan değer.
 *    Testler answer ile verify() sonucunun eşdeğer olduğunu doğrular (elle yazım hatası yakalanır).
 *  - methods: kabul edilebilir çözüm yöntemleri
 *  - mistakes: öğrencilerin yapabileceği yaygın hatalar
 *  - expr: cevap bir cebirsel ifadeyse, değişkenli doğrulama fonksiyonu
 *
 * Not: Konu başlıkları MEB 7. sınıf programındaki bilinen konulara göre seçilmiştir; güncel
 * (Türkiye Yüzyılı Maarif Modeli) programın resmî metni bu ortamdan doğrulanamamıştır (bkz. AUDIT_REPORT.md).
 */

export type BankTopic =
  | "tam-sayilar"
  | "rasyonel-sayilar"
  | "kesirler"
  | "cebirsel-ifadeler"
  | "denklemler"
  | "oran-oranti"
  | "yuzdeler"
  | "problemler"
  | "dogrular-acilar"
  | "cokgenler"
  | "cember-daire"
  | "veri-analizi";

export interface BankItem {
  id: string;
  topic: BankTopic;
  difficulty: "kolay" | "orta" | "zor";
  question: string;
  answer: string;
  verify: () => Rational;
  /** Cevap cebirsel ifadeyse: değişken değerine göre doğru değer */
  expr?: { variable: string; f: (v: number) => number };
  methods: string[];
  mistakes: string[];
}

const R = (n: number, d = 1) => Rational.of(n, d);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => R(sum(xs), xs.length);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length / 2;
  return s.length % 2 ? R(s[Math.floor(m)]) : R(s[m - 1] + s[m], 2);
};
/** ax + b = c x + d → x */
const solveLin = (a: number, b: number, c: number, d: number) => R(d - b, 1).div(R(a - c));

let n = 0;
const q = (topic: BankTopic, difficulty: BankItem["difficulty"], question: string, answer: string, verify: () => Rational, methods: string[], mistakes: string[], expr?: BankItem["expr"]): BankItem => ({
  id: `${topic}-${String(++n).padStart(3, "0")}`,
  topic,
  difficulty,
  question,
  answer,
  verify,
  methods,
  mistakes,
  expr,
});

export const QUESTION_BANK: BankItem[] = [
  /* ───────── Tam sayılar ───────── */
  q("tam-sayilar", "kolay", "(-7) + 12 işleminin sonucu kaçtır?", "5", () => R(-7).add(R(12)), ["Sayı doğrusunda -7'den 12 birim sağa gitme", "Büyük mutlak değerden küçüğü çıkarıp büyüğün işaretini alma"], ["Sonucu -5 bulmak", "İşaretleri yok sayıp 19 bulmak"]),
  q("tam-sayilar", "kolay", "(-9) - (-4) işleminin sonucu kaçtır?", "-5", () => R(-9).sub(R(-4)), ["Çıkarmayı ters işaretlinin toplamına çevirme: -9 + 4"], ["-13 bulmak (çıkanın işaretini değiştirmemek)"]),
  q("tam-sayilar", "kolay", "(-6) · 7 işleminin sonucu kaçtır?", "-42", () => R(-6).mul(R(7)), ["Zıt işaretli çarpım negatiftir kuralı"], ["Sonucu pozitif yazmak"]),
  q("tam-sayilar", "kolay", "(-48) ÷ (-6) işleminin sonucu kaçtır?", "8", () => R(-48).div(R(-6)), ["Aynı işaretli bölüm pozitiftir kuralı"], ["-8 yazmak"]),
  q("tam-sayilar", "orta", "(-3)³ + 2⁴ işleminin sonucu kaçtır?", "-11", () => R(-3).pow(3).add(R(2).pow(4)), ["Önce üslü ifadeleri hesaplama: -27 + 16"], ["(-3)³'ü 27 almak", "2⁴'ü 8 almak"]),
  q("tam-sayilar", "orta", "5 - 3 · (-4) + (-10) ÷ 2 işleminin sonucu kaçtır?", "12", () => R(5).sub(R(3).mul(R(-4))).add(R(-10).div(R(2))), ["İşlem önceliği: önce çarpma ve bölme"], ["Soldan sağa hesaplayıp işlem önceliğini atlamak"]),
  q("tam-sayilar", "orta", "(-2)⁴ - (-2)³ işleminin sonucu kaçtır?", "24", () => R(-2).pow(4).sub(R(-2).pow(3)), ["Çift kuvvet pozitif, tek kuvvet negatif: 16 - (-8)"], ["16 - 8 = 8 bulmak"]),
  q("tam-sayilar", "orta", "Bir dalgıç deniz seviyesinin 18 m altındayken 7 m yukarı çıkıyor. Dalgıç deniz seviyesine göre kaç metrededir?", "-11", () => R(-18).add(R(7)), ["Deniz seviyesini 0, altını negatif alma: -18 + 7"], ["25 veya 11 bulmak (işaret hatası)"]),
  q("tam-sayilar", "zor", "Sabah sıcaklık -6 °C'dir. Öğlen 9 °C artıyor, akşam 11 °C düşüyor. Akşam sıcaklık kaç °C olur?", "-8", () => R(-6).add(R(9)).sub(R(11)), ["Adım adım: -6 + 9 = 3, 3 - 11 = -8"], ["Düşüşü toplama olarak almak"]),
  q("tam-sayilar", "zor", "[(-4) + 7] · (-3) - (-15) ÷ 5 işleminin sonucu kaçtır?", "-6", () => R(-4).add(R(7)).mul(R(-3)).sub(R(-15).div(R(5))), ["Önce köşeli parantez, sonra çarpma/bölme, en son çıkarma"], ["-(-3)'ü -3 almak"]),
  q("tam-sayilar", "kolay", "(-1)²⁵ işleminin sonucu kaçtır?", "-1", () => R(-1).pow(25), ["Negatif sayının tek kuvveti negatiftir"], ["1 bulmak"]),

  /* ───────── Rasyonel sayılar ───────── */
  q("rasyonel-sayilar", "kolay", "-3/4 rasyonel sayısının ondalık gösterimi nedir?", "-0,75", () => R(-3, 4), ["Payı paydaya bölme", "Paydayı 100'e genişletme: -75/100"], ["-0,34 yazmak (pay ile paydayı yan yana yazmak)", "İşareti unutmak"]),
  q("rasyonel-sayilar", "kolay", "0,6 ondalık sayısını en sade kesir olarak yazınız.", "3/5", () => R(6, 10), ["6/10 yazıp 2 ile sadeleştirme"], ["6/10'da bırakmak", "1/6 yazmak"]),
  q("rasyonel-sayilar", "orta", "-2/3 ile -3/5 sayılarından hangisi daha büyüktür?", "-3/5", () => (R(-3, 5).cmp(R(-2, 3)) > 0 ? R(-3, 5) : R(-2, 3)), ["Paydaları 15'te eşitleme: -10/15 ile -9/15", "Sayı doğrusunda sıfıra yakın olan büyüktür"], ["Pozitif sayılardaki gibi düşünüp -2/3 demek"]),
  q("rasyonel-sayilar", "orta", "Sayı doğrusunda -1/2 ile 3/4 arasındaki uzaklık kaç birimdir?", "5/4", () => R(3, 4).sub(R(-1, 2)), ["Büyükten küçüğü çıkarma: 3/4 - (-1/2)"], ["1/4 bulmak (3/4 - 1/2)"]),
  q("rasyonel-sayilar", "orta", "-1,25 sayısını en sade kesir olarak yazınız.", "-5/4", () => R(-125, 100), ["-125/100'ü 25 ile sadeleştirme"], ["-1/4 yazmak", "İşareti unutmak"]),
  q("rasyonel-sayilar", "zor", "0,1 + 0,2 + 0,3 toplamını en sade kesir olarak yazınız.", "3/5", () => R(1, 10).add(R(2, 10)).add(R(3, 10)), ["Ondalıkları toplayıp 6/10 yazma ve sadeleştirme"], ["0,6'yı 6/100 yazmak"]),
  q("rasyonel-sayilar", "kolay", "-5/8 sayısının toplama işlemine göre tersi nedir?", "5/8", () => R(-5, 8).neg(), ["Toplamları 0 olan sayı"], ["-8/5 yazmak (çarpmaya göre tersle karıştırmak)"]),
  q("rasyonel-sayilar", "orta", "2/5 sayısının çarpma işlemine göre tersi nedir?", "5/2", () => R(1).div(R(2, 5)), ["Çarpımları 1 olan sayı: pay ile paydanın yer değiştirmesi"], ["-2/5 yazmak"]),
  q("rasyonel-sayilar", "zor", "-7/4 ile 5/3 arasında kaç tane tam sayı vardır?", "3", () => {
    let c = 0;
    for (let k = -5; k <= 5; k++) if (R(k).cmp(R(-7, 4)) > 0 && R(k).cmp(R(5, 3)) < 0) c++;
    return R(c);
  }, ["Kesirleri ondalığa çevirme: -1,75 ile 1,66… arası: -1, 0, 1"], ["0'ı saymamak", "-2'yi de saymak"]),
  q("rasyonel-sayilar", "orta", "1,2 ile 0,35 sayılarının farkı kaçtır?", "0,85", () => R(12, 10).sub(R(35, 100)), ["Virgülleri alt alta getirerek çıkarma: 1,20 - 0,35"], ["0,13 bulmak (basamakları kaydırmak)"]),

  /* ───────── Kesirler (rasyonel sayılarla işlemler) ───────── */
  q("kesirler", "kolay", "2/7 + 3/7 işleminin sonucu kaçtır?", "5/7", () => R(2, 7).add(R(3, 7)), ["Paydalar eşit: paylar toplanır"], ["5/14 yazmak (paydaları da toplamak)"]),
  q("kesirler", "kolay", "5/6 - 1/3 işleminin sonucu kaçtır?", "1/2", () => R(5, 6).sub(R(1, 3)), ["1/3'ü 2/6'ya genişletme, 3/6 = 1/2"], ["4/3 bulmak (pay ve paydaları ayrı çıkarmak)"]),
  q("kesirler", "orta", "3/4 + 2/5 işleminin sonucu kaçtır?", "23/20", () => R(3, 4).add(R(2, 5)), ["Ortak payda 20: 15/20 + 8/20"], ["5/9 yazmak"]),
  q("kesirler", "orta", "2/3 · 9/10 işleminin sonucu kaçtır?", "3/5", () => R(2, 3).mul(R(9, 10)), ["Pay ile pay, payda ile payda çarpılır; sadeleştirme"], ["Paydaları eşitlemeye çalışmak"]),
  q("kesirler", "orta", "5/8 ÷ 15/16 işleminin sonucu kaçtır?", "2/3", () => R(5, 8).div(R(15, 16)), ["İkinci kesri ters çevirip çarpma: 5/8 · 16/15"], ["Birinci kesri ters çevirmek"]),
  q("kesirler", "zor", "1/2 + 1/3 · 3/4 işleminin sonucu kaçtır?", "3/4", () => R(1, 2).add(R(1, 3).mul(R(3, 4))), ["Önce çarpma: 1/4, sonra toplama"], ["Soldan sağa hesaplayıp 5/8 bulmak"]),
  q("kesirler", "zor", "(3/4 - 1/2) ÷ 1/8 işleminin sonucu kaçtır?", "2", () => R(3, 4).sub(R(1, 2)).div(R(1, 8)), ["Parantez içi 1/4, sonra 1/4 · 8"], ["1/32 bulmak (çarpmak yerine bölmek)"]),
  q("kesirler", "orta", "2 tam 1/3 ile 1 tam 1/2 toplamı kaçtır?", "23/6", () => R(7, 3).add(R(3, 2)), ["Bileşik kesre çevirme: 7/3 + 3/2 = 14/6 + 9/6", "Tamları ve kesirleri ayrı toplama: 3 + 5/6"], ["Tam kısımları unutmak"]),
  q("kesirler", "kolay", "4 · 3/8 işleminin sonucu kaçtır?", "3/2", () => R(4).mul(R(3, 8)), ["4'ü yalnızca pay ile çarpma: 12/8"], ["Paydayı da 4 ile çarpmak"]),
  q("kesirler", "zor", "(-2/3) · (-3/4) + (-1/2) işleminin sonucu kaçtır?", "0", () => R(-2, 3).mul(R(-3, 4)).add(R(-1, 2)), ["Önce çarpma: 1/2, sonra 1/2 - 1/2"], ["Çarpımı negatif almak"]),

  /* ───────── Cebirsel ifadeler ───────── */
  q("cebirsel-ifadeler", "kolay", "3x + 5x ifadesinin en sade hâli nedir?", "8x", () => R(8 * 7), ["Benzer terimlerin katsayılarını toplama"], ["8x² yazmak", "15x yazmak"], { variable: "x", f: (x) => 3 * x + 5 * x }),
  q("cebirsel-ifadeler", "kolay", "4(x + 3) ifadesini dağılma özelliğiyle yazınız.", "4x + 12", () => R(4 * (7 + 3)), ["Parantezdeki her terimi 4 ile çarpma"], ["4x + 3 yazmak (yalnız ilk terimi çarpmak)"], { variable: "x", f: (x) => 4 * (x + 3) }),
  q("cebirsel-ifadeler", "orta", "5a - 2 + 3a + 7 ifadesini sadeleştiriniz.", "8a + 5", () => R(5 * 7 - 2 + 3 * 7 + 7), ["Benzer terimleri gruplama: (5a + 3a) + (-2 + 7)"], ["Sabitleri a'lı terimlere eklemek", "-2'nin işaretini unutmak"], { variable: "a", f: (a) => 5 * a - 2 + 3 * a + 7 }),
  q("cebirsel-ifadeler", "orta", "2(3x - 1) - (x - 4) ifadesini sadeleştiriniz.", "5x + 2", () => R(2 * (3 * 7 - 1) - (7 - 4)), ["Dağılma: 6x - 2 - x + 4"], ["-(x - 4)'ü -x - 4 yazmak"], { variable: "x", f: (x) => 2 * (3 * x - 1) - (x - 4) }),
  q("cebirsel-ifadeler", "orta", "x = -2 için 3x² - x ifadesinin değeri kaçtır?", "14", () => R(3).mul(R(-2).pow(2)).sub(R(-2)), ["Yerine koyma: 3 · 4 - (-2)"], ["(-2)²'yi -4 almak", "-(-2)'yi -2 almak"]),
  q("cebirsel-ifadeler", "kolay", "a = 4, b = -3 için 2a - b ifadesinin değeri kaçtır?", "11", () => R(2 * 4).sub(R(-3)), ["Yerine koyma: 8 - (-3)"], ["5 bulmak"]),
  q("cebirsel-ifadeler", "zor", "Bir örüntünün n. terimi 3n + 2 ile bulunuyor. Örüntünün 15. terimi kaçtır?", "47", () => R(3 * 15 + 2), ["n yerine 15 yazma"], ["35 bulmak (3 · 15 - 10 gibi işlem hatası)"]),
  q("cebirsel-ifadeler", "orta", "4, 7, 10, 13, ... sayı örüntüsünün n. terimini veren cebirsel ifade nedir?", "3n + 1", () => R(3 * 7 + 1), ["Ardışık fark 3 → 3n; ilk terim için düzeltme +1"], ["n + 3 yazmak"], { variable: "n", f: (k) => 4 + 3 * (k - 1) }),
  q("cebirsel-ifadeler", "zor", "Kenar uzunlukları x + 2 ve 3 birim olan dikdörtgenin çevresini veren cebirsel ifade nedir?", "2x + 10", () => R(2 * (7 + 2 + 3)), ["Çevre = 2 · (uzun kenar + kısa kenar)"], ["Alanı yazmak: 3x + 6", "x + 5 yazmak (2 ile çarpmayı unutmak)"], { variable: "x", f: (x) => 2 * (x + 2 + 3) }),

  /* ───────── Eşitlik ve denklemler ───────── */
  q("denklemler", "kolay", "x + 7 = 15 denklemini çözünüz.", "x = 8", () => solveLin(1, 7, 0, 15), ["Her iki taraftan 7 çıkarma"], ["x = 22 bulmak"]),
  q("denklemler", "kolay", "3x = -21 denklemini çözünüz.", "x = -7", () => solveLin(3, 0, 0, -21), ["Her iki tarafı 3'e bölme"], ["x = 7 (işaret hatası)", "x = -24 (bölme yerine çıkarma)"]),
  q("denklemler", "orta", "2x + 5 = 15 denklemini çözünüz.", "x = 5", () => solveLin(2, 5, 0, 15), ["Önce 5 çıkarma, sonra 2'ye bölme"], ["x = 10 (bölmeyi unutmak)"]),
  q("denklemler", "orta", "4x - 7 = 2x + 9 denklemini çözünüz.", "x = 8", () => solveLin(4, -7, 2, 9), ["Her iki taraftan 2x çıkarma, sonra 7 ekleme, 2'ye bölme"], ["x = 1 (işaret hatası)"]),
  q("denklemler", "orta", "3(x - 2) = 2x + 4 denklemini çözünüz.", "x = 10", () => solveLin(3, -6, 2, 4), ["Dağılma: 3x - 6 = 2x + 4"], ["3x - 2 yazmak"]),
  q("denklemler", "zor", "x/3 + 2 = 6 denklemini çözünüz.", "x = 12", () => R(6 - 2).mul(R(3)), ["2 çıkarma, sonra 3 ile çarpma"], ["x = 4/3 bulmak (3'e bölmek)"]),
  q("denklemler", "zor", "(x + 1)/2 = (x - 3)/4 denklemini çözünüz.", "x = -5", () => solveLin(2, 2, 1, -3), ["İçler dışlar çarpımı: 4(x + 1) = 2(x - 3)", "Her iki tarafı 4 ile çarpma"], ["Paydaları yok sayıp x + 1 = x - 3 yazmak"]),
  q("denklemler", "orta", "Bir sayının 4 katının 9 eksiği 23'tür. Bu sayı kaçtır?", "8", () => solveLin(4, -9, 0, 23), ["4x - 9 = 23 denklemini kurma"], ["4(x - 9) = 23 kurmak"]),
  q("denklemler", "zor", "Ardışık üç tam sayının toplamı 48'dir. Bu sayıların en büyüğü kaçtır?", "17", () => solveLin(3, 3, 0, 48).add(R(2)), ["x + (x + 1) + (x + 2) = 48 → x = 15", "48 ÷ 3 = 16 ortanca, en büyük 17"], ["En küçüğü (15) yazmak"]),
  q("denklemler", "orta", "Ali'nin yaşı Ayşe'nin yaşının 3 katıdır. Yaşları toplamı 36 ise Ali kaç yaşındadır?", "27", () => solveLin(4, 0, 0, 36).mul(R(3)), ["Ayşe x, Ali 3x: 4x = 36"], ["Ayşe'nin yaşını (9) yazmak"]),
  q("denklemler", "kolay", "5x - 3 = 2 denklemini çözünüz.", "x = 1", () => solveLin(5, -3, 0, 2), ["3 ekleme, 5'e bölme"], ["x = -1/5 bulmak"]),

  /* ───────── Oran ve orantı ───────── */
  q("oran-oranti", "kolay", "12 : 18 oranının en sade hâli nedir?", "2/3", () => R(12, 18), ["İkisini de 6'ya bölme"], ["3/2 yazmak (sırayı değiştirmek)"]),
  q("oran-oranti", "kolay", "5 kg elma 60 TL ise 1 kg elma kaç TL'dir?", "12", () => R(60, 5), ["Birim fiyat: 60 ÷ 5"], ["300 bulmak (çarpmak)"]),
  q("oran-oranti", "orta", "3 kalem 12 TL ise aynı kalemlerden 7 tanesi kaç TL'dir?", "28", () => R(12, 3).mul(R(7)), ["Birim fiyat 4 TL · 7", "Doğru orantı: 3/12 = 7/x"], ["16 bulmak (12 + 4)"]),
  q("oran-oranti", "orta", "4 işçi bir işi 12 günde bitiriyor. Aynı hızda çalışan 6 işçi bu işi kaç günde bitirir?", "8", () => R(4 * 12, 6), ["Ters orantı: 4 · 12 = 6 · x"], ["18 bulmak (doğru orantı sanmak)"]),
  q("oran-oranti", "orta", "x/6 = 10/15 orantısında x kaçtır?", "4", () => R(6 * 10, 15), ["İçler dışlar çarpımı: 15x = 60"], ["x = 9 bulmak"]),
  q("oran-oranti", "zor", "Bir haritada 2 cm, gerçekte 5 km'dir. Haritada 7 cm olan yol gerçekte kaç km'dir?", "17,5", () => R(5, 2).mul(R(7)), ["1 cm = 2,5 km, 7 · 2,5"], ["14 bulmak (7 · 2)"]),
  q("oran-oranti", "orta", "Saatte 80 km hızla 3 saatte gidilen yol, saatte 60 km hızla kaç saatte gidilir?", "4", () => R(80 * 3, 60), ["Yol = 240 km; 240 ÷ 60", "Ters orantı: hız · süre sabit"], ["2,25 bulmak (doğru orantı)"]),
  q("oran-oranti", "zor", "Bir sınıftaki kız öğrencilerin erkek öğrencilere oranı 3/5'tir. Sınıfta 32 öğrenci varsa kaç kız öğrenci vardır?", "12", () => R(32, 8).mul(R(3)), ["Toplam 8 parça: 32 ÷ 8 = 4, kız 3 · 4"], ["32 · 3/5 hesaplamak (oranı bütüne oran sanmak)"]),
  q("oran-oranti", "kolay", "Bir tarifte 2 bardak una 3 yumurta konuyor. 6 bardak una kaç yumurta konur?", "9", () => R(3).mul(R(6, 2)), ["Un 3 katına çıktı, yumurta da 3 katı"], ["7 bulmak (fark kadar ekleme)"]),

  /* ───────── Yüzdeler ───────── */
  q("yuzdeler", "kolay", "240 sayısının %25'i kaçtır?", "60", () => R(240).mul(R(25, 100)), ["240 · 25/100", "%25 = 1/4 → 240 ÷ 4"], ["240 ÷ 25 yapmak"]),
  q("yuzdeler", "kolay", "80'in %15'i kaçtır?", "12", () => R(80).mul(R(15, 100)), ["%10 = 8, %5 = 4, toplam 12"], ["15 · 80 = 1200'de bırakmak"]),
  q("yuzdeler", "orta", "Fiyatı 400 TL olan bir ayakkabıya %20 indirim yapılıyor. İndirimli fiyat kaç TL'dir?", "320", () => R(400).mul(R(80, 100)), ["İndirim 80 TL, 400 - 80", "Fiyatın %80'i"], ["İndirim miktarını (80) cevap yazmak"]),
  q("yuzdeler", "orta", "Fiyatı 250 TL olan bir montun fiyatına %12 zam yapılıyor. Yeni fiyat kaç TL olur?", "280", () => R(250).mul(R(112, 100)), ["Zam 30 TL, 250 + 30", "Fiyatın %112'si"], ["Zammı çıkarmak (220)"]),
  q("yuzdeler", "orta", "30 sayısı 120 sayısının yüzde kaçıdır?", "25", () => R(30, 120).mul(R(100)), ["30/120 = 1/4 = %25"], ["%400 bulmak (120/30)"]),
  q("yuzdeler", "zor", "Bir sayının %40'ı 36 ise bu sayı kaçtır?", "90", () => R(36).div(R(40, 100)), ["%10'u 9, %100'ü 90", "x · 40/100 = 36"], ["36'nın %40'ını (14,4) bulmak"]),
  q("yuzdeler", "zor", "Fiyatı 200 TL olan bir ürüne önce %10 zam, sonra %10 indirim yapılıyor. Ürünün son fiyatı kaç TL'dir?", "198", () => R(200).mul(R(110, 100)).mul(R(90, 100)), ["200 → 220 → 220'nin %90'ı"], ["Zam ve indirim birbirini götürür sanıp 200 demek"]),
  q("yuzdeler", "orta", "Bir sınıftaki 25 öğrencinin 9'u gözlüklüdür. Gözlüklü öğrenciler sınıfın yüzde kaçıdır?", "36", () => R(9, 25).mul(R(100)), ["9/25'i 36/100'e genişletme"], ["%9 demek"]),
  q("yuzdeler", "kolay", "%50'si 18 olan sayı kaçtır?", "36", () => R(18).div(R(1, 2)), ["%50 = yarısı → 2 · 18"], ["9 bulmak"]),
  q("yuzdeler", "zor", "Bir ürün %25 kârla 150 TL'ye satılıyor. Ürünün maliyeti kaç TL'dir?", "120", () => R(150).div(R(125, 100)), ["Satış maliyetin %125'i: x · 125/100 = 150"], ["150'nin %25'ini çıkarıp 112,5 bulmak"]),

  /* ───────── Problemler ───────── */
  q("problemler", "orta", "Ali parasının 2/5'i ile 60 TL'lik bir kitap aldı. Ali'nin başlangıçta kaç TL'si vardı?", "150", () => R(60).div(R(2, 5)), ["Şerit modeli: 2 parça 60 → 1 parça 30 → 5 parça 150"], ["60 · 2/5 = 24 bulmak"]),
  q("problemler", "orta", "Bir kitabın 3/7'si 42 sayfadır. Kitap toplam kaç sayfadır?", "98", () => R(42).div(R(3, 7)), ["1 parça 14 sayfa, 7 parça 98"], ["18 bulmak (42 · 3/7)"]),
  q("problemler", "kolay", "Bir pizzanın 3/8'ini Can, 1/4'ünü Ece yedi. Pizzanın kaçta kaçı yenmiştir?", "5/8", () => R(3, 8).add(R(1, 4)), ["1/4 = 2/8, 3/8 + 2/8"], ["4/12 yazmak"]),
  q("problemler", "zor", "Bir deponun 2/3'ü doluyken 40 litre su eklenince depo tamamen doluyor. Deponun tamamı kaç litredir?", "120", () => R(40).div(R(1, 3)), ["Eksik kısım 1/3 = 40 L → tamamı 120 L"], ["60 bulmak (40'ı 2/3 sanmak)"]),
  q("problemler", "orta", "Saatte 15 km hızla giden bir bisikletli 2,5 saatte kaç km yol alır?", "37,5", () => R(15).mul(R(5, 2)), ["Yol = hız · zaman"], ["17,5 bulmak (toplamak)"]),
  q("problemler", "zor", "Bir sayının 2/3'ünün 6 fazlası 18'dir. Bu sayı kaçtır?", "18", () => R(18 - 6).div(R(2, 3)), ["(2/3)x + 6 = 18 → (2/3)x = 12 → x = 18"], ["8 bulmak (12 · 2/3)"]),
  q("problemler", "orta", "Ayşe harçlığının %30'unu harcadı ve 84 TL'si kaldı. Ayşe'nin harçlığı kaç TL idi?", "120", () => R(84).div(R(70, 100)), ["Kalan %70 = 84 → %10 = 12 → %100 = 120"], ["84'ün %30'unu eklemek (109,2)"]),
  q("problemler", "kolay", "Bir sınıfta 14 kız ve 16 erkek öğrenci vardır. Kız öğrenci sayısının sınıf mevcuduna oranı nedir?", "7/15", () => R(14, 30), ["14/30'u 2 ile sadeleştirme"], ["14/16 yazmak (kız/erkek)"]),
  q("problemler", "orta", "Bir otobüste 45 yolcu var. Durakta yolcuların 1/5'i indi, 8 yolcu bindi. Otobüste kaç yolcu oldu?", "44", () => R(45).sub(R(45, 5)).add(R(8)), ["İnen 9 kişi: 45 - 9 + 8"], ["45 - 1/5 gibi anlamsız işlem", "Binenleri eklemeyi unutmak"]),
  q("problemler", "orta", "İki kardeşin yaşları toplamı 26'dır. Büyük kardeş küçük kardeşten 4 yaş büyükse küçük kardeş kaç yaşındadır?", "11", () => solveLin(2, 4, 0, 26), ["x + (x + 4) = 26"], ["Büyüğün yaşını (15) yazmak"]),

  /* ───────── Doğrular ve açılar ───────── */
  q("dogrular-acilar", "kolay", "Tümler iki açıdan biri 35° ise diğeri kaç derecedir?", "55", () => R(90 - 35), ["Tümler açıların toplamı 90°"], ["145 bulmak (bütünlerle karıştırmak)"]),
  q("dogrular-acilar", "kolay", "Bütünler iki açıdan biri 65° ise diğeri kaç derecedir?", "115", () => R(180 - 65), ["Bütünler açıların toplamı 180°"], ["25 bulmak (tümlerle karıştırmak)"]),
  q("dogrular-acilar", "orta", "Ölçüsü 80° olan bir açının açıortayı bu açıyı iki eş parçaya ayırıyor. Parçalardan biri kaç derecedir?", "40", () => R(80, 2), ["Açıortay açıyı iki eşit parçaya böler"], ["160 bulmak"]),
  q("dogrular-acilar", "orta", "Paralel iki doğruyu bir kesen kestiğinde oluşan yöndeş açılardan biri 72° ise diğeri kaç derecedir?", "72", () => R(72), ["Yöndeş açılar eştir"], ["108 bulmak (bütünler sanmak)"]),
  q("dogrular-acilar", "orta", "Paralel iki doğru ve bir kesende iç ters açılardan birinin ölçüsü 3x + 10, diğerinin ölçüsü 70° ise x kaçtır?", "20", () => solveLin(3, 10, 0, 70), ["İç ters açılar eştir: 3x + 10 = 70"], ["3x + 10 = 110 kurmak"]),
  q("dogrular-acilar", "zor", "Komşu bütünler iki açının ölçüleri 2x ve 3x + 30 derecedir. x kaçtır?", "30", () => solveLin(5, 30, 0, 180), ["2x + 3x + 30 = 180"], ["Toplamı 90 almak"]),
  q("dogrular-acilar", "kolay", "Ters açılardan birinin ölçüsü 48° ise diğerinin ölçüsü kaç derecedir?", "48", () => R(48), ["Ters açılar eştir"], ["132 bulmak"]),
  q("dogrular-acilar", "zor", "Bir açının tümlerinin ölçüsü, kendi ölçüsünün 2 katıdır. Bu açı kaç derecedir?", "30", () => solveLin(3, 0, 0, 90), ["90 - a = 2a → 3a = 90"], ["60 bulmak (tümleri yazmak)"]),
  q("dogrular-acilar", "orta", "Paralel iki doğruyu kesen bir doğrunun aynı tarafta oluşturduğu iç açılardan biri 115° ise diğeri kaç derecedir?", "65", () => R(180 - 115), ["Karşı durumlu (aynı taraftaki) iç açılar bütünlerdir"], ["115 bulmak (eş sanmak)"]),

  /* ───────── Çokgenler ───────── */
  q("cokgenler", "kolay", "Bir üçgenin iki iç açısı 50° ve 60° ise üçüncü iç açısı kaç derecedir?", "70", () => R(180 - 50 - 60), ["İç açılar toplamı 180°"], ["250 bulmak (360 almak)"]),
  q("cokgenler", "orta", "Bir beşgenin iç açılarının ölçüleri toplamı kaç derecedir?", "540", () => R((5 - 2) * 180), ["(n - 2) · 180°", "Beşgeni 3 üçgene bölme"], ["900 bulmak (n · 180)"]),
  q("cokgenler", "orta", "Düzgün altıgenin bir iç açısı kaç derecedir?", "120", () => R((6 - 2) * 180, 6), ["İç açılar toplamı 720 ÷ 6", "Dış açı 60°, iç açı 180 - 60"], ["60 bulmak (dış açıyı yazmak)"]),
  q("cokgenler", "orta", "Düzgün sekizgenin bir dış açısı kaç derecedir?", "45", () => R(360, 8), ["Dış açılar toplamı 360° ÷ 8"], ["135 bulmak (iç açı)"]),
  q("cokgenler", "kolay", "Kenar uzunlukları 9 cm ve 6 cm olan dikdörtgenin alanı kaç cm²'dir?", "54", () => R(9 * 6), ["Alan = uzun kenar · kısa kenar"], ["30 bulmak (çevre)"]),
  q("cokgenler", "orta", "Taban uzunluğu 10 cm, bu tabana ait yüksekliği 7 cm olan paralelkenarın alanı kaç cm²'dir?", "70", () => R(10 * 7), ["Alan = taban · yükseklik"], ["35 bulmak (üçgen gibi 2'ye bölmek)"]),
  q("cokgenler", "zor", "Taban uzunlukları 8 cm ve 12 cm, yüksekliği 5 cm olan yamuğun alanı kaç cm²'dir?", "50", () => R((8 + 12) * 5, 2), ["(a + c) · h / 2"], ["100 bulmak (2'ye bölmeyi unutmak)"]),
  q("cokgenler", "zor", "İç açılarının ölçüleri toplamı 1260° olan çokgen kaç kenarlıdır?", "9", () => R(1260, 180).add(R(2)), ["(n - 2) · 180 = 1260 → n - 2 = 7"], ["7 bulmak (2 eklemeyi unutmak)"]),
  q("cokgenler", "orta", "Bir dörtgenin üç iç açısı 80°, 95° ve 105° ise dördüncü iç açısı kaç derecedir?", "80", () => R(360 - 80 - 95 - 105), ["Dörtgenin iç açıları toplamı 360°"], ["Toplamı 180 almak"]),
  q("cokgenler", "kolay", "Köşegen uzunlukları 6 cm ve 8 cm olan eşkenar dörtgenin alanı kaç cm²'dir?", "24", () => R(6 * 8, 2), ["Köşegenler çarpımının yarısı"], ["48 bulmak"]),

  /* ───────── Çember ve daire ───────── */
  q("cember-daire", "kolay", "Yarıçapı 5 cm olan bir dairenin alanı kaç cm²'dir? (π = 3 alınız)", "75", () => R(3 * 5 * 5), ["A = π · r²"], ["30 bulmak (2πr)", "15 bulmak (π · r)"]),
  q("cember-daire", "kolay", "Yarıçapı 4 cm olan çemberin uzunluğu kaç cm'dir? (π = 3 alınız)", "24", () => R(2 * 3 * 4), ["Ç = 2 · π · r"], ["48 bulmak (π r²)"]),
  q("cember-daire", "orta", "Çapı 10 cm olan çemberin uzunluğu kaç cm'dir? (π = 3 alınız)", "30", () => R(3 * 10), ["Ç = π · çap"], ["60 bulmak (çapı yarıçap sanmak)"]),
  q("cember-daire", "orta", "Uzunluğu 36 cm olan çemberin yarıçapı kaç cm'dir? (π = 3 alınız)", "6", () => R(36, 2 * 3), ["2 · 3 · r = 36"], ["12 bulmak (çapı yazmak)"]),
  q("cember-daire", "orta", "Alanı 108 cm² olan dairenin yarıçapı kaç cm'dir? (π = 3 alınız)", "6", () => R(108, 3).sqrt()!, ["3 · r² = 108 → r² = 36"], ["36 bulmak (karekök almayı unutmak)"]),
  q("cember-daire", "zor", "Yarıçapı 6 cm olan bir dairenin 90°'lik merkez açılı diliminin alanı kaç cm²'dir? (π = 3 alınız)", "27", () => R(3 * 6 * 6).mul(R(90, 360)), ["Dairenin alanı 108, 90/360 = 1/4'ü"], ["108 bulmak"]),
  q("cember-daire", "zor", "Yarıçapı 10 cm olan bir çemberde 72°'lik merkez açının gördüğü yayın uzunluğu kaç cm'dir? (π = 3 alınız)", "12", () => R(2 * 3 * 10).mul(R(72, 360)), ["Çember 60 cm, 72/360 = 1/5'i"], ["Alan formülünü kullanmak (60)"]),
  q("cember-daire", "orta", "Yarıçapı 3 cm olan dairenin alanı kaç cm²'dir? (π = 3,14 alınız)", "28,26", () => R(314, 100).mul(R(9)), ["3,14 · 9"], ["18,84 bulmak (çevre)"]),
  q("cember-daire", "kolay", "Yarıçapı 7 cm olan çemberin çapı kaç cm'dir?", "14", () => R(2 * 7), ["Çap = 2 · yarıçap"], ["3,5 bulmak"]),

  /* ───────── Veri analizi ───────── */
  q("veri-analizi", "kolay", "4, 7, 7, 10 verilerinin aritmetik ortalaması kaçtır?", "7", () => mean([4, 7, 7, 10]), ["Toplam 28 ÷ 4"], ["Tepe değeri ortalama sanmak (sonuç aynı çıksa da yöntem farklı)"]),
  q("veri-analizi", "kolay", "3, 8, 5, 8, 2 verilerinin tepe değeri kaçtır?", "8", () => R(8), ["En çok tekrar eden değer"], ["En büyük değeri tepe değer sanmak"]),
  q("veri-analizi", "orta", "12, 5, 9, 15, 7 verilerinin ortancası kaçtır?", "9", () => median([12, 5, 9, 15, 7]), ["Sıralama: 5, 7, 9, 12, 15 → ortadaki"], ["Sıralamadan ortadakini (9 yerine yazılış sırasıyla 9) almak; sıralamayı unutmak"]),
  q("veri-analizi", "orta", "6, 10, 4, 8 verilerinin ortancası kaçtır?", "7", () => median([6, 10, 4, 8]), ["Sıralama 4, 6, 8, 10 → ortadaki iki sayının ortalaması"], ["6 veya 8 demek"]),
  q("veri-analizi", "orta", "Bir öğrencinin 4 sınavdaki notları 70, 85, 90 ve 75'tir. Not ortalaması kaçtır?", "80", () => mean([70, 85, 90, 75]), ["320 ÷ 4"], ["4'e bölmeyi unutmak"]),
  q("veri-analizi", "zor", "5 sayının aritmetik ortalaması 12'dir. Bu sayılara 18 eklenirse yeni ortalama kaç olur?", "13", () => R(5 * 12 + 18, 6), ["Toplam 60, yeni toplam 78, 78 ÷ 6"], ["(12 + 18) ÷ 2 = 15 bulmak"]),
  q("veri-analizi", "zor", "360 öğrencinin katıldığı bir ankette futbol, daire grafiğinde 90°'lik dilimle gösteriliyor. Kaç öğrenci futbolu seçmiştir?", "90", () => R(360).mul(R(90, 360)), ["90/360 = 1/4 → 360 ÷ 4"], ["Açıyı doğrudan öğrenci sayısı sanmak (sonuç aynı ama yöntem yanlış olabilir)"]),
  q("veri-analizi", "orta", "Bir sınıftaki öğrencilerin %25'i basketbolu seçmiştir. Daire grafiğinde basketbol diliminin merkez açısı kaç derecedir?", "90", () => R(360).mul(R(25, 100)), ["360° · 25/100"], ["25° demek"]),
  q("veri-analizi", "kolay", "2, 9, 4, 11, 6 verilerinin açıklığı kaçtır?", "9", () => R(11 - 2), ["En büyük - en küçük"], ["Ortalama ile karıştırmak"]),
];

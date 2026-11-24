/**
 * 7. sınıf matematik konuları (MEB müfredatı esas alınarak).
 * Kural ve örnekler elle yazılmış, doğrulanmış sabit içeriktir.
 */
export interface Topic {
  id: string;
  title: string;
  unit: string;
  emoji: string;
  summary: string;
  rules: { text: string; latex?: string }[];
  example: { question: string; answer: string };
  keywords: string[];
}

export const TOPICS: Topic[] = [
  {
    id: "tam-sayilar",
    title: "Tam Sayılarla İşlemler",
    unit: "Sayılar ve İşlemler",
    emoji: "➕",
    summary: "Tam sayılarla toplama, çıkarma, çarpma, bölme ve üslü ifadeler.",
    rules: [
      { text: "Aynı işaretli iki tam sayı çarpılır veya bölünürse sonuç pozitiftir.", latex: "(-3)\\cdot(-4)=12" },
      { text: "Zıt işaretli iki tam sayı çarpılır veya bölünürse sonuç negatiftir.", latex: "(-12)\\div 3=-4" },
      { text: "Bir sayıyı çıkarmak, o sayının ters işaretlisini eklemek demektir.", latex: "5-(-2)=5+2=7" },
      { text: "Negatif bir sayının çift kuvveti pozitif, tek kuvveti negatiftir.", latex: "(-2)^2=4,\\;(-2)^3=-8" },
    ],
    example: { question: "(-8) + 5 - (-3) işleminin sonucu kaçtır?", answer: "0" },
    keywords: ["tam sayı", "negatif", "pozitif", "eksi", "üslü"],
  },
  {
    id: "rasyonel-sayilar",
    title: "Rasyonel Sayılar",
    unit: "Sayılar ve İşlemler",
    emoji: "🔢",
    summary: "Rasyonel sayıları tanıma, sayı doğrusunda gösterme, sıralama ve ondalık gösterim.",
    rules: [
      { text: "a ve b tam sayı, b sıfırdan farklı olmak üzere a/b biçiminde yazılabilen sayılar rasyonel sayıdır.", latex: "\\frac{a}{b},\\; b\\neq 0" },
      { text: "Pozitif rasyonel sayılar sıfırın sağında, negatifler solunda yer alır." },
      { text: "Negatif rasyonel sayılarda sıfıra uzak olan daha küçüktür.", latex: "-\\frac{3}{4}<-\\frac{1}{2}" },
      { text: "Bir kesrin ondalık gösterimi için pay paydaya bölünür.", latex: "\\frac{3}{8}=0{,}375" },
    ],
    example: { question: "-3/4, 1/2 ve -1/3 rasyonel sayılarını küçükten büyüğe sıralayınız.", answer: "-3/4 < -1/3 < 1/2" },
    keywords: ["rasyonel", "ondalık", "sayı doğrusu", "sıralama", "devirli"],
  },
  {
    id: "kesirler",
    title: "Rasyonel Sayılarla İşlemler (Kesirler)",
    unit: "Sayılar ve İşlemler",
    emoji: "🍕",
    summary: "Kesirlerle toplama, çıkarma, çarpma, bölme ve işlem önceliği.",
    rules: [
      { text: "Paydaları eşit kesirler toplanırken paylar toplanır, payda aynen yazılır.", latex: "\\frac{a}{c}+\\frac{b}{c}=\\frac{a+b}{c}" },
      { text: "Paydalar farklıysa önce paydalar eşitlenir (ortak payda bulunur)." },
      { text: "Kesirler çarpılırken pay ile pay, payda ile payda çarpılır.", latex: "\\frac{a}{b}\\cdot\\frac{c}{d}=\\frac{a\\cdot c}{b\\cdot d}" },
      { text: "Bölmede birinci kesir aynen yazılır, ikinci kesir ters çevrilip çarpılır.", latex: "\\frac{a}{b}\\div\\frac{c}{d}=\\frac{a}{b}\\cdot\\frac{d}{c}" },
    ],
    example: { question: "3/4 + 1/6 işleminin sonucu kaçtır?", answer: "11/12" },
    keywords: ["kesir", "payda", "pay", "sadeleştirme", "genişletme"],
  },
  {
    id: "cebirsel-ifadeler",
    title: "Cebirsel İfadeler",
    unit: "Cebir",
    emoji: "🔤",
    summary: "Cebirsel ifadeler, benzer terimler, toplama-çıkarma ve bir doğal sayıyla çarpma.",
    rules: [
      { text: "Benzer terimler (aynı değişken ve üs) toplanıp çıkarılabilir.", latex: "3x+5x=8x" },
      { text: "Bir doğal sayı parantezin içindeki her terimle çarpılır (dağılma özelliği).", latex: "3(x+2)=3x+6" },
      { text: "Sayı örüntülerinin kuralı cebirsel ifadeyle yazılabilir.", latex: "2n+1" },
    ],
    example: { question: "4(x - 3) + 2x ifadesinin en sade hâli nedir?", answer: "6x - 12" },
    keywords: ["cebirsel", "terim", "katsayı", "değişken", "örüntü"],
  },
  {
    id: "denklemler",
    title: "Eşitlik ve Denklem",
    unit: "Cebir",
    emoji: "⚖️",
    summary: "Eşitliğin korunumu, birinci dereceden bir bilinmeyenli denklemler ve problemleri.",
    rules: [
      { text: "Eşitliğin her iki tarafına aynı işlem yapılırsa eşitlik bozulmaz (terazi dengede kalır).", latex: "a=b \\Rightarrow a+c=b+c" },
      { text: "Bilinmeyeni yalnız bırakmak için ters işlem kullanılır: toplamanın tersi çıkarma, çarpmanın tersi bölmedir." },
      { text: "Bulduğun sonucu denklemde yerine koyarak kontrol et.", latex: "2\\cdot 5+5=15 \\;✓" },
    ],
    example: { question: "2x + 5 = 15 denklemini çözünüz.", answer: "x = 5" },
    keywords: ["denklem", "bilinmeyen", "eşitlik", "terazi", "x"],
  },
  {
    id: "oran-oranti",
    title: "Oran ve Orantı",
    unit: "Oran-Orantı",
    emoji: "🔗",
    summary: "Oran, birim oran, doğru ve ters orantı, orantı problemleri.",
    rules: [
      { text: "İki çokluğun bölme yoluyla karşılaştırılmasına oran denir.", latex: "a:b=\\frac{a}{b}" },
      { text: "Doğru orantıda çokluklardan biri artarken diğeri aynı oranda artar; oranları sabittir.", latex: "\\frac{y}{x}=k" },
      { text: "Ters orantıda biri artarken diğeri aynı oranda azalır; çarpımları sabittir.", latex: "x\\cdot y=k" },
      { text: "Orantıda içler çarpımı dışlar çarpımına eşittir.", latex: "\\frac{a}{b}=\\frac{c}{d}\\Rightarrow a\\cdot d=b\\cdot c" },
    ],
    example: { question: "3 kalem 12 TL ise aynı kalemlerden 5 tanesi kaç TL'dir?", answer: "20 TL" },
    keywords: ["oran", "orantı", "doğru orantı", "ters orantı", "birim"],
  },
  {
    id: "yuzdeler",
    title: "Yüzdeler",
    unit: "Oran-Orantı",
    emoji: "💯",
    summary: "Bir çokluğun yüzdesini bulma, yüzde artış-azalış, indirim ve zam problemleri.",
    rules: [
      { text: "Yüzde, paydası 100 olan bir orandır.", latex: "\\%25=\\frac{25}{100}" },
      { text: "Bir sayının yüzde a'sını bulmak için sayı a ile çarpılıp 100'e bölünür.", latex: "240\\cdot\\frac{25}{100}=60" },
      { text: "%20 indirimli fiyat, eski fiyatın %80'idir." },
    ],
    example: { question: "240 sayısının %25'i kaçtır?", answer: "60" },
    keywords: ["yüzde", "indirim", "zam", "kâr", "zarar", "%"],
  },
  {
    id: "dogrular-acilar",
    title: "Doğrular ve Açılar",
    unit: "Geometri ve Ölçme",
    emoji: "📐",
    summary: "Açıortay, paralel iki doğrunun bir kesenle yaptığı açılar.",
    rules: [
      { text: "Açıortay, açıyı iki eş parçaya ayırır." },
      { text: "Paralel iki doğruyu bir kesen kestiğinde yöndeş açılar ve iç ters açılar eşittir." },
      { text: "Bir doğru üzerindeki komşu açıların toplamı 180°'dir.", latex: "a+b=180^\\circ" },
    ],
    example: { question: "Bütünler iki açıdan biri 65° ise diğeri kaç derecedir?", answer: "115°" },
    keywords: ["açı", "paralel", "açıortay", "kesen", "derece"],
  },
  {
    id: "cokgenler",
    title: "Çokgenler",
    unit: "Geometri ve Ölçme",
    emoji: "🔷",
    summary: "Düzgün çokgenler, iç ve dış açılar, dörtgenlerin alanı.",
    rules: [
      { text: "Bir üçgenin iç açılarının toplamı 180°'dir.", latex: "\\hat{A}+\\hat{B}+\\hat{C}=180^\\circ" },
      { text: "n kenarlı bir çokgenin iç açıları toplamı (n − 2) · 180°'dir.", latex: "(n-2)\\cdot 180^\\circ" },
      { text: "Herhangi bir çokgenin dış açıları toplamı 360°'dir." },
      { text: "Dikdörtgenin alanı uzun kenar ile kısa kenarın çarpımıdır.", latex: "A=a\\cdot b" },
    ],
    example: { question: "Bir ABC üçgeninde A açısı 50°, B açısı 70°'dir. C açısı kaç derecedir? A) 50° B) 60° C) 70° D) 80°", answer: "60°" },
    keywords: ["çokgen", "üçgen", "dörtgen", "alan", "iç açı", "dış açı"],
  },
  {
    id: "cember-daire",
    title: "Çember ve Daire",
    unit: "Geometri ve Ölçme",
    emoji: "⭕",
    summary: "Çemberin uzunluğu, dairenin ve daire diliminin alanı (π ≈ 3).",
    rules: [
      { text: "Çemberin uzunluğu 2 · π · r'dir.", latex: "\\text{Ç}=2\\pi r" },
      { text: "Dairenin alanı π · r²'dir.", latex: "A=\\pi r^2" },
      { text: "Merkez açısı α olan daire diliminin alanı, dairenin alanının α/360'ıdır.", latex: "\\frac{\\alpha}{360^\\circ}\\cdot\\pi r^2" },
    ],
    example: { question: "Yarıçapı 5 cm olan bir dairenin alanı kaç cm²'dir? (π = 3 alınız)", answer: "75 cm²" },
    keywords: ["çember", "daire", "pi", "yarıçap", "çap", "dilim"],
  },
  {
    id: "veri-analizi",
    title: "Veri Analizi",
    unit: "Veri İşleme",
    emoji: "📊",
    summary: "Daire grafiği, aritmetik ortalama, ortanca, tepe değer.",
    rules: [
      { text: "Aritmetik ortalama: veriler toplanır, veri sayısına bölünür." },
      { text: "Ortanca: veriler sıralandığında ortadaki değerdir." },
      { text: "Tepe değer: en çok tekrar eden değerdir." },
    ],
    example: { question: "4, 7, 7, 10 verilerinin aritmetik ortalaması kaçtır?", answer: "7" },
    keywords: ["ortalama", "ortanca", "tepe değer", "grafik", "veri"],
  },
  {
    id: "cisimler",
    title: "Cisimlerin Farklı Yönlerden Görünümleri",
    unit: "Geometri ve Ölçme",
    emoji: "🧊",
    summary: "Birim küplerden oluşan yapıların önden, yandan ve üstten görünümleri.",
    rules: [
      { text: "Önden görünüm çizilirken her sütundaki en yüksek küp sayısı dikkate alınır." },
      { text: "Üstten görünüm, yapının zemine düşen izidir." },
    ],
    example: { question: "Üst üste 3, yan yana 2 küpten oluşan yapının önden görünümünde kaç kare vardır?", answer: "Yapıya göre değişir" },
    keywords: ["küp", "görünüm", "önden", "üstten", "yandan"],
  },
  {
    id: "problemler",
    title: "Problemler",
    unit: "Karma",
    emoji: "🧩",
    summary: "Günlük hayat problemlerini modelleme: kesir, yüzde, denklem ve orantı problemleri.",
    rules: [
      { text: "Önce verilenleri ve isteneni yaz, sonra uygun modeli (tablo, şema, denklem) seç." },
      { text: "Sonucu soruya geri dönerek kontrol et: mantıklı mı?" },
    ],
    example: { question: "Ali parasının 2/5'i ile 60 TL'lik bir kitap aldı. Ali'nin başlangıçta kaç TL'si vardı?", answer: "150 TL" },
    keywords: ["problem", "hikâye", "yaş", "işçi", "hareket"],
  },
];

export function findTopic(idOrTitle: string | undefined): Topic | undefined {
  if (!idOrTitle) return undefined;
  const key = idOrTitle.toLocaleLowerCase("tr-TR");
  return (
    TOPICS.find((t) => t.id === key) ??
    TOPICS.find((t) => t.title.toLocaleLowerCase("tr-TR") === key) ??
    TOPICS.find((t) => t.keywords.some((k) => key.includes(k)) || key.includes(t.title.toLocaleLowerCase("tr-TR")))
  );
}

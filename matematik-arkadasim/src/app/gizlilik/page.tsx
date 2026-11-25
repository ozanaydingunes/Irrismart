import Link from "next/link";

export const metadata = { title: "Gizlilik" };

/** Çocuklar ve aileler için sade dille gizlilik bilgilendirmesi. */
export default function Privacy() {
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-4 leading-relaxed">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Gizlilik</h1>
      <p>Matematik Arkadaşım, öğrencinin kişisel bilgilerini istemez ve saklamaz. Üyelik yoktur.</p>
      <h2 className="text-lg font-bold">Bu cihazda kalanlar</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>Soru defteri, gelişim bilgileri ve ayarlar yalnızca bu tarayıcıda (IndexedDB / localStorage) tutulur.</li>
        <li>Soru fotoğrafları varsayılan olarak saklanmaz; Ayarlar&apos;dan açılırsa yalnızca bu cihazdaki deftere kaydedilir.</li>
        <li>Ses kayıtları hiçbir zaman saklanmaz; konuşma tanıma tarayıcının kendi özelliğidir.</li>
        <li>Tüm veriler Ayarlar → Gizlilik ve veriler bölümünden indirilebilir veya silinebilir.</li>
      </ul>
      <h2 className="text-lg font-bold">Sunucuya gidenler</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>Önerilen ücretsiz kurulumda soru metni ve fotoğrafı yalnızca evdeki bilgisayarda çalışan yerel modele (Ollama) gider; internete gönderilmez. Sunucu bunları diske yazmaz ve günlük kayıtlarına eklemez.</li>
        <li>Ücretli bulut yapay zekâ servisleri varsayılan olarak kapalıdır; yalnızca ebeveyn açıkça açarsa kullanılır.</li>
        <li>Kötüye kullanımı önlemek için IP adresi ve rastgele bir oturum kimliği yalnızca <b>özetlenmiş (hash)</b> olarak sayaçlarda kısa süre tutulur.</li>
        <li>Sağlayıcıların veri saklama politikaları kendi sayfalarında açıklanır; uygulamayı kuran yetişkin bunları kontrol etmelidir.</li>
      </ul>
      <h2 className="text-lg font-bold">Ailelere not</h2>
      <p>Lütfen çocuğunuzun soru metnine ad, okul, adres gibi kişisel bilgi yazmamasını hatırlatın. Uygulamayı internette yayınlıyorsanız aile PIN&apos;i kullanmanızı öneririz.</p>
      <Link href="/ayarlar" className="self-start rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground">
        Ayarlara dön
      </Link>
    </article>
  );
}

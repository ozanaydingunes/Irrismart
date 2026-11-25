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
      <h2 className="text-lg font-bold">İnternete gidenler (ücretsiz bulut kurulumu)</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>
          Soru metni ve <b>soru fotoğrafı</b>, çözülmesi için uygulamanın sunucusu (Vercel) üzerinden <b>Cloudflare Workers AI</b> yapay zekâ servisine gönderilir. Cloudflare, bu girdileri isteği
          işledikten sonra saklamadığını ve model eğitiminde kullanmadığını belirtir.
        </li>
        <li>
          Ebeveyn yedek olarak onayladıysa ve Cloudflare&apos;in günlük ücretsiz kapasitesi dolduysa aynı içerik <b>Groq</b> servisine gönderilir. Groq da girdileri varsayılan olarak saklamadığını ve eğitimde
          kullanmadığını belirtir.
        </li>
        <li>Basit işlem ve denklemler (ör. 3/4 + 1/6, 2x + 5 = 15) hiçbir yapay zekâ servisine gönderilmez; uygulamanın kendi hesaplama motoruyla çözülür.</li>
        <li>Uygulama sunucusu fotoğrafı ve soruyu diske, veritabanına veya günlük kayıtlarına yazmaz. Bulutta soru defteri veya gelişim bilgisi tutulmaz.</li>
        <li>Kötüye kullanımı önlemek için IP adresi ve rastgele bir oturum kimliği yalnızca <b>özetlenmiş (hash)</b> olarak sayaçlarda (Upstash) kısa süre tutulur.</li>
        <li>Ücretli yapay zekâ servisleri kapalıdır; uygulama hiçbir koşulda kendiliğinden ücretli servise geçmez.</li>
        <li>Pi Hoca evdeki bilgisayarda (Ollama) çalıştırılıyorsa soru ve fotoğraf yalnızca o bilgisayara gider.</li>
      </ul>
      <h2 className="text-lg font-bold">Fotoğraf çekerken</h2>
      <p>
        Fotoğrafta <b>yalnızca soru</b> görünsün. Ad, soyad, okul adı, sınıf, yüz, el yazısıyla imza veya başka bir kişisel bilgi varsa göndermeden önce fotoğrafı <b>kırpın</b> (telefonun
        kendi düzenleme aracıyla) ya da soruyu yazarak sorun.
      </p>
      <h2 className="text-lg font-bold">Sesle soru sorma</h2>
      <p>
        Mikrofonla soru sorduğunda konuşmanı yazıya çeviren özellik tarayıcının kendisidir. Bazı tarayıcılar (ör. Chrome, Safari) bunun için sesi kendi şirketinin (Google, Apple) sunucusuna
        gönderebilir; bu, uygulamanın denetiminde değildir. Ses kaydı uygulama tarafından saklanmaz. İstemezsen soruyu yazarak veya fotoğrafla sor. Sesli anlatım (seslendirme) cihazın kendi
        sesiyle yapılır.
      </p>
      <h2 className="text-lg font-bold">Ailelere not</h2>
      <p>
        Hesaplar (Cloudflare, Vercel, Upstash, isteğe bağlı Groq) ebeveyn adına açılır; çocuk bu hizmetlere üye olmaz. Uygulama aile PIN&apos;i olmadan yapay zekâ özelliklerini açmaz. Lütfen çocuğunuzun
        soru metnine ad, okul, adres gibi kişisel bilgi yazmamasını hatırlatın.
      </p>
      <p className="text-sm text-muted-foreground">Fotoğraf çözümünde kullanılan Llama 4 modeli için: Built with Llama.</p>
      <Link href="/ayarlar" className="self-start rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground">
        Ayarlara dön
      </Link>
    </article>
  );
}

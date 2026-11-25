import Link from "next/link";

export const metadata = { title: "Çevrimdışı" };

export default function Offline() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <div className="text-6xl" aria-hidden>
        📡
      </div>
      <h1 className="text-2xl font-extrabold">Pi Hoca&apos;ya bağlanılamıyor</h1>
      <p className="text-muted-foreground">Evdeki Pi Hoca bilgisayarı kapalı olabilir ya da ev dışındaysan telefondaki Tailscale kapalı olabilir. Daha önce kaydettiğin sorulara Soru Defterim&apos;den ulaşabilirsin.</p>
      <Link href="/defter" className="rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground">
        Soru Defterim&apos;e git
      </Link>
    </div>
  );
}

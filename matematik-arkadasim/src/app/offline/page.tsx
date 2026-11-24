import Link from "next/link";

export const metadata = { title: "Çevrimdışı" };

export default function Offline() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <div className="text-6xl" aria-hidden>
        📡
      </div>
      <h1 className="text-2xl font-extrabold">İnternet bağlantısı yok</h1>
      <p className="text-muted-foreground">Yapay zekâ ile yeni soru çözmek için internet gerekir. Daha önce kaydettiğin sorulara Soru Defterim&apos;den ulaşabilirsin.</p>
      <Link href="/defter" className="rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground">
        Soru Defterim&apos;e git
      </Link>
    </div>
  );
}

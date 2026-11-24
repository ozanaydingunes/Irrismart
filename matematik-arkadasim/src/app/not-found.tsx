import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <div className="text-6xl" aria-hidden>
        🤔
      </div>
      <h1 className="text-2xl font-extrabold">Sayfa bulunamadı</h1>
      <p className="text-muted-foreground">Aradığın sayfa burada değil. Ana sayfaya dönebilirsin.</p>
      <Link href="/" className="rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground">
        Ana sayfa
      </Link>
    </div>
  );
}

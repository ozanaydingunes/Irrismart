"use client";

import { BarChart3, BookMarked, Camera, ChevronRight, ImagePlus, Keyboard, Mic } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ConsentDialog } from "@/components/common/ConsentDialog";
import { useSettings } from "@/hooks/useSettings";
import { loadImage, processImage, validateFile } from "@/lib/client/image";
import { cn } from "@/lib/utils";

/** SolvePage ile aynı anahtar (döngüsel içe aktarmayı önlemek için burada da tanımlı) */
const PENDING_IMAGE_KEY = "matematik:pending-image";

const focusRing = "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50";

/**
 * Ana ekrandaki işlemler: belirgin "Fotoğraf çek", yan yana "Soru yükle" ve "Soru yaz",
 * "Sesle sor" ve küçük kısayollar. Kamera/galeri doğrudan burada açılır (kullanıcı dokunuşu gerektirir);
 * seçilen fotoğraf küçültülüp Soru Çöz sayfasına aktarılır, orada kırpılabilir.
 */
export function QuickActions() {
  const router = useRouter();
  const [settings, save] = useSettings();
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  async function handle(file: File | undefined) {
    setError(null);
    if (!file) return;
    const err = validateFile(file);
    if (err) return setError(err);
    setBusy(true);
    try {
      const img = await loadImage(file);
      const url = processImage(img, 0, { x: 0, y: 0, w: 1, h: 1 }, 0.85);
      sessionStorage.setItem(PENDING_IMAGE_KEY, url);
      router.push("/coz?yontem=foto");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fotoğraf açılamadı.");
      setBusy(false);
    }
  }

  const tile = cn("flex min-h-[4.5rem] items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-card transition-transform active:scale-[0.98] disabled:opacity-60", focusRing);
  const iconBox = "flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground";

  return (
    <div className="flex flex-col gap-3">
      <section aria-label="Soru sor" className="flex flex-col gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => (settings.cameraConsent ? camera.current?.click() : setConsent(true))}
          className={cn("flex min-h-[5.5rem] items-center gap-4 rounded-3xl bg-primary px-5 py-4 text-left text-primary-foreground shadow-soft transition-transform active:scale-[0.98] disabled:opacity-60", focusRing)}
        >
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <Camera className="size-8" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block text-lg font-extrabold leading-tight">Fotoğraf çek</span>
            <span className="block text-sm opacity-90">Kitaptaki soruyu çek, adım adım çözelim</span>
          </span>
          <ChevronRight className="size-6 shrink-0 opacity-80" aria-hidden />
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" disabled={busy} className={cn(tile, "flex-col items-start")} onClick={() => gallery.current?.click()}>
            <span className={iconBox}>
              <ImagePlus className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block font-bold leading-tight">Soru yükle</span>
              <span className="block text-xs text-muted-foreground">Galeri / ekran görüntüsü</span>
            </span>
          </button>
          <button type="button" disabled={busy} className={cn(tile, "flex-col items-start")} onClick={() => router.push("/coz?yontem=yaz")}>
            <span className={iconBox}>
              <Keyboard className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block font-bold leading-tight">Soru yaz</span>
              <span className="block text-xs text-muted-foreground">Sembol klavyesiyle</span>
            </span>
          </button>
        </div>

        <button type="button" disabled={busy} className={tile} onClick={() => router.push("/coz?yontem=ses")}>
          <span className={iconBox}>
            <Mic className="size-6" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block font-bold leading-tight">Sesle sor</span>
            <span className="block text-xs text-muted-foreground">Soruyu söyle, ben yazıya dökeyim</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </section>

      {error && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <nav aria-label="Kısayollar" className="grid grid-cols-2 gap-3">
        <Link href="/defter" className={cn("flex min-h-14 items-center gap-2 rounded-2xl bg-muted/70 px-3 text-sm font-semibold hover:bg-muted", focusRing)}>
          <BookMarked className="size-5 shrink-0 text-primary" aria-hidden /> Soru defterim
        </Link>
        <Link href="/gelisim" className={cn("flex min-h-14 items-center gap-2 rounded-2xl bg-muted/70 px-3 text-sm font-semibold hover:bg-muted", focusRing)}>
          <BarChart3 className="size-5 shrink-0 text-primary" aria-hidden /> Gelişimim
        </Link>
      </nav>

      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Kamera ile fotoğraf çek" onChange={(e) => handle(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
      <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Galeriden fotoğraf seç" onChange={(e) => handle(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
      <ConsentDialog
        kind="camera"
        open={consent}
        onOpenChange={setConsent}
        onAccept={() => {
          save({ cameraConsent: true });
          camera.current?.click();
        }}
      />
    </div>
  );
}

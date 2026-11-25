"use client";

import { Camera, ImagePlus, Keyboard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ConsentDialog } from "@/components/common/ConsentDialog";
import { useSettings } from "@/hooks/useSettings";
import { loadImage, processImage, validateFile } from "@/lib/client/image";

/** SolvePage ile aynı anahtar (döngüsel içe aktarmayı önlemek için burada da tanımlı) */
const PENDING_IMAGE_KEY = "matematik:pending-image";

/**
 * Ana ekrandaki üç temel işlem. Kamera/galeri seçimi doğrudan burada açılır (kullanıcı dokunuşu
 * gerektirdiği için); seçilen fotoğraf küçültülüp Soru Çöz sayfasına aktarılır, orada kırpılabilir.
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

  const base =
    "flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl p-4 text-center text-lg font-extrabold shadow-card transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:opacity-60";

  return (
    <section aria-label="Soru sor" className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button type="button" disabled={busy} className={`${base} bg-primary text-primary-foreground`} onClick={() => (settings.cameraConsent ? camera.current?.click() : setConsent(true))}>
          <Camera className="size-9" aria-hidden />
          Fotoğraf çek
        </button>
        <button type="button" disabled={busy} className={`${base} border-2 border-border bg-card text-foreground`} onClick={() => gallery.current?.click()}>
          <ImagePlus className="size-9 text-primary" aria-hidden />
          Soru yükle
          <span className="text-xs font-medium text-muted-foreground">Galeri veya ekran görüntüsü</span>
        </button>
        <button type="button" disabled={busy} className={`${base} border-2 border-border bg-card text-foreground`} onClick={() => router.push("/coz?yontem=yaz")}>
          <Keyboard className="size-9 text-primary" aria-hidden />
          Soru yaz
        </button>
      </div>
      {error && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
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
    </section>
  );
}

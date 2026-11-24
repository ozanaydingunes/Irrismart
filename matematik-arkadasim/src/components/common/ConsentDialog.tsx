"use client";

import { Camera, Mic, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Kamera veya mikrofon açılmadan önce gösterilen açık izin penceresi.
 * Tarayıcının kendi izin penceresi bundan sonra çıkar.
 */
export function ConsentDialog({ kind, open, onOpenChange, onAccept }: { kind: "camera" | "mic"; open: boolean; onOpenChange: (o: boolean) => void; onAccept: () => void }) {
  const camera = kind === "camera";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">{camera ? <Camera className="size-7" /> : <Mic className="size-7" />}</div>
          <DialogTitle>{camera ? "Kamerayı kullanmak için izin" : "Mikrofonu kullanmak için izin"}</DialogTitle>
          <DialogDescription>
            {camera
              ? "Sorunun fotoğrafını çekmek için kameranı açacağız. Fotoğraf yalnızca soruyu çözmek için kullanılır ve varsayılan olarak kalıcı saklanmaz."
              : "Sorunu sesli söyleyebilmen için mikrofonunu açacağız. Ses kaydı saklanmaz; yalnızca söylediklerin yazıya çevrilir."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3 rounded-2xl bg-muted p-3 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <span>Devam edersen tarayıcın da senden izin isteyecek. İstediğin zaman tarayıcı ayarlarından izni kapatabilirsin. Emin değilsen bir büyüğüne sorabilirsin.</span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onAccept();
            }}
          >
            İzin ver ve devam et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Crop, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { dataUrlBytes, processImage, type CropRect } from "@/lib/client/image";

type Rotation = 0 | 90 | 180 | 270;
type Handle = "move" | "nw" | "ne" | "sw" | "se";

const FULL: CropRect = { x: 0, y: 0, w: 1, h: 1 };
const MIN = 0.08;

/**
 * Fotoğraf önizleme, döndürme ve kırpma. Kırpma çerçevesi fare ve dokunmatikle (Pointer Events) taşınır.
 */
export function ImageEditor({ image, onChange }: { image: HTMLImageElement; onChange: (dataUrl: string) => void }) {
  const [rotation, setRotation] = useState<Rotation>(0);
  const [crop, setCrop] = useState<CropRect>(FULL);
  const [cropping, setCropping] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: Handle; startX: number; startY: number; start: CropRect } | null>(null);

  // Döndürülmüş tam görsel (kırpma çerçevesinin arka planı)
  const rotatedUrl = useMemo(() => processImage(image, rotation, FULL, 0.85), [image, rotation]);
  // Gönderilecek nihai görsel
  const preview = useMemo(() => processImage(image, rotation, crop), [image, rotation, crop]);
  useEffect(() => {
    onChange(preview);
  }, [preview, onChange]);

  const rotate = (dir: 1 | -1) => {
    setRotation((r) => (((r + dir * 90 + 360) % 360) as Rotation));
    setCrop(FULL);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const handle = (e.currentTarget.dataset.handle ?? "move") as Handle;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { handle, startX: e.clientX, startY: e.clientY, start: crop };
  };

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (e.clientX - d.startX) / box.width;
    const dy = (e.clientY - d.startY) / box.height;
    const s = d.start;
    let { x, y, w, h } = s;
    if (d.handle === "move") {
      x = Math.min(Math.max(0, s.x + dx), 1 - s.w);
      y = Math.min(Math.max(0, s.y + dy), 1 - s.h);
    } else {
      if (d.handle.includes("w")) {
        x = Math.min(Math.max(0, s.x + dx), s.x + s.w - MIN);
        w = s.w + (s.x - x);
      }
      if (d.handle.includes("e")) w = Math.min(Math.max(MIN, s.w + dx), 1 - s.x);
      if (d.handle.includes("n")) {
        y = Math.min(Math.max(0, s.y + dy), s.y + s.h - MIN);
        h = s.h + (s.y - y);
      }
      if (d.handle.includes("s")) h = Math.min(Math.max(MIN, s.h + dy), 1 - s.y);
    }
    setCrop({ x, y, w, h });
  }, []);

  const endDrag = () => {
    drag.current = null;
  };

  const kb = Math.round(dataUrlBytes(preview) / 1024);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => rotate(-1)} aria-label="Sola döndür">
          <RotateCcw /> Sola döndür
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => rotate(1)} aria-label="Sağa döndür">
          <RotateCw /> Sağa döndür
        </Button>
        <Button type="button" variant={cropping ? "default" : "outline"} size="sm" onClick={() => setCropping((c) => !c)} aria-pressed={cropping}>
          <Crop /> {cropping ? "Kırpmayı bitir" : "Kırp"}
        </Button>
        {(crop !== FULL || rotation !== 0) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setCrop(FULL);
              setRotation(0);
            }}
          >
            <Undo2 /> Sıfırla
          </Button>
        )}
      </div>

      {cropping ? (
        <div className="flex justify-center rounded-2xl bg-muted p-2">
          <div ref={boxRef} className="relative inline-block touch-none select-none" onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {rotatedUrl && <img src={rotatedUrl} alt="Kırpılacak fotoğraf" className="block max-h-[60vh] w-auto max-w-full" draggable={false} />}
            <div
              className="absolute cursor-move border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
              data-handle="move"
              onPointerDown={onPointerDown}
              role="presentation"
            >
              {(["nw", "ne", "sw", "se"] as const).map((h) => (
                <span
                  key={h}
                  data-handle={h}
                  onPointerDown={onPointerDown}
                  className="absolute size-7 rounded-full border-4 border-white bg-primary shadow"
                  style={{
                    left: h.includes("w") ? -14 : undefined,
                    right: h.includes("e") ? -14 : undefined,
                    top: h.includes("n") ? -14 : undefined,
                    bottom: h.includes("s") ? -14 : undefined,
                    cursor: `${h}-resize`,
                  }}
                  aria-hidden
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center rounded-2xl bg-muted p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview && <img src={preview} alt="Gönderilecek soru fotoğrafının önizlemesi" className="max-h-[50vh] w-auto max-w-full rounded-xl" />}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Gönderilecek boyut: ~{kb} KB (sıkıştırıldı). İpucu: Sadece soruyu içine alacak şekilde kırp; gölge ve yansıma olmasın.
      </p>
    </div>
  );
}

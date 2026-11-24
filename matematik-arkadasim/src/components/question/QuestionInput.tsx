"use client";

import { Camera, ImagePlus, Keyboard, Loader2, Mic, Send, Sparkles, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { ConsentDialog } from "@/components/common/ConsentDialog";
import { MicButton } from "@/components/common/MicButton";
import { ModeSelector } from "@/components/lesson/ModeSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/hooks/useSettings";
import { loadImage, validateFile } from "@/lib/client/image";
import { DEMO_SAMPLES } from "@/lib/demo/samples";
import type { LearningMode } from "@/lib/schema/solution";
import { ImageEditor } from "./ImageEditor";

const SYMBOLS = ["½", "/", "×", "÷", "²", "³", "√", "π", "%", "=", "<", ">", "(", ")", "−", "°", "x"];

export interface QuestionSubmit {
  text: string;
  image?: string;
  mode: LearningMode;
}

export function QuestionInput({ onSubmit, busy, demo }: { onSubmit: (q: QuestionSubmit) => void; busy: boolean; demo: boolean }) {
  const [settings, save] = useSettings();
  const [tab, setTab] = useState("photo");
  const [text, setText] = useState("");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<LearningMode>(settings.defaultMode);
  const [cameraConsentOpen, setCameraConsentOpen] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const onImageChange = useCallback((url: string) => setImageData(url), []);

  async function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    const err = validateFile(file);
    if (err) return setError(err);
    try {
      setImg(await loadImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Görsel açılamadı.");
    }
  }

  function openCamera() {
    if (!settings.cameraConsent) return setCameraConsentOpen(true);
    cameraInput.current?.click();
  }

  function insertSymbol(sym: string) {
    const el = textRef.current;
    const ins = sym === "½" ? "1/2" : sym === "−" ? "-" : sym;
    if (!el) return setText((t) => t + ins);
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + ins + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ins.length, start + ins.length);
    });
  }

  const canSubmit = !busy && (!!imageData || text.trim().length > 0);

  function submit() {
    if (!canSubmit) return;
    onSubmit({ text: text.trim(), image: tab === "photo" && imageData ? imageData : undefined, mode });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-4 sm:p-5">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList aria-label="Soru ekleme yöntemi">
              <TabsTrigger value="photo">
                <Camera /> Fotoğraf
              </TabsTrigger>
              <TabsTrigger value="text">
                <Keyboard /> Yaz
              </TabsTrigger>
              <TabsTrigger value="voice">
                <Mic /> Sesle
              </TabsTrigger>
            </TabsList>

            <TabsContent value="photo" className="flex flex-col gap-3">
              {!img ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={openCamera} className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-primary/50 bg-accent/40 p-5 text-center font-bold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
                    <Camera className="size-10 text-primary" />
                    Fotoğraf çek
                    <span className="text-sm font-normal text-muted-foreground">Telefon kamerasıyla</span>
                  </button>
                  <button type="button" onClick={() => galleryInput.current?.click()} className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border bg-muted/50 p-5 text-center font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
                    <ImagePlus className="size-10 text-primary" />
                    Galeriden / ekran görüntüsü
                    <span className="text-sm font-normal text-muted-foreground">JPG, PNG veya WEBP</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Önizleme</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setImg(null);
                        setImageData(null);
                      }}
                    >
                      <X /> Fotoğrafı kaldır
                    </Button>
                  </div>
                  <ImageEditor image={img} onChange={onImageChange} />
                </div>
              )}
              <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0]).finally(() => (e.target.value = ""))} aria-label="Kamera ile fotoğraf çek" />
              <input ref={galleryInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFile(e.target.files?.[0]).finally(() => (e.target.value = ""))} aria-label="Galeriden fotoğraf seç" />
              <label htmlFor="photo-note" className="text-sm font-semibold">
                Not eklemek ister misin? <span className="font-normal text-muted-foreground">(isteğe bağlı, ör. “2. soruyu çöz”)</span>
              </label>
              <Textarea id="photo-note" value={text} onChange={(e) => setText(e.target.value)} className="min-h-[60px]" rows={2} maxLength={500} />
              {demo && <p className="rounded-xl bg-warning/12 p-3 text-sm text-warning-strong">Demo modunda fotoğraf okunamaz; bunun için yapay zekâ bağlantısı gerekir. “Yaz” sekmesini deneyebilirsin.</p>}
            </TabsContent>

            <TabsContent value="text" className="flex flex-col gap-3">
              <label htmlFor="question-text" className="font-semibold">
                Sorunu yaz
              </label>
              <Textarea
                id="question-text"
                ref={textRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"Örn: 3/4 + 1/6 işleminin sonucu kaçtır?\nveya: 2x + 5 = 15"}
                maxLength={2000}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
                }}
              />
              <div className="flex flex-wrap gap-1.5" aria-label="Matematik sembolleri">
                {SYMBOLS.map((s) => (
                  <button key={s} type="button" onClick={() => insertSymbol(s)} className="min-h-10 min-w-10 rounded-xl border-2 border-border bg-card px-2 text-lg font-semibold hover:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30" aria-label={`${s} ekle`}>
                    {s}
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="voice" className="flex flex-col items-start gap-3">
              <p className="text-base">Mikrofona dokun ve sorunu sesli söyle. Örneğin: <i>“iki iks artı beş eşittir on beş”</i> ya da <i>“üç bölü dört artı bir bölü altı kaçtır”</i>.</p>
              <MicButton size="lg" label="Sorumu söyleyeceğim" onText={(t) => setText((p) => (p ? p + " " : "") + t)} />
              <label htmlFor="voice-text" className="text-sm font-semibold">
                Anladığım soru (düzeltebilirsin):
              </label>
              <Textarea id="voice-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
            </TabsContent>
          </Tabs>

          {error && (
            <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
          <h2 className="font-bold">Nasıl öğrenmek istersin?</h2>
          <ModeSelector value={mode} onChange={setMode} />
          <Button size="lg" onClick={submit} disabled={!canSubmit} className="w-full sm:w-auto sm:self-end">
            {busy ? <Loader2 className="animate-spin" /> : <Send />}
            {busy ? "Öğretmen soruyu inceliyor…" : "Soruyu çöz"}
          </Button>
        </CardContent>
      </Card>

      {demo && (
        <Card className="border-2 border-warning/40">
          <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <Sparkles className="size-5 text-warning" /> Demo örnek soruları
            </h2>
            <p className="text-sm text-muted-foreground">Yapay zekâ bağlı değilken uygulamayı bu hazır örneklerle deneyebilirsin. Ayrıca “3/4 + 1/6”, “2x + 5 = 15”, “240 sayısının %25&apos;i kaçtır?” gibi işlemleri demo çözücü çözer.</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_SAMPLES.map((s) => (
                <Button key={s.id} variant="outline" size="sm" disabled={busy} onClick={() => onSubmit({ text: s.question, mode })}>
                  {s.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ConsentDialog
        kind="camera"
        open={cameraConsentOpen}
        onOpenChange={setCameraConsentOpen}
        onAccept={() => {
          save({ cameraConsent: true });
          cameraInput.current?.click();
        }}
      />
    </div>
  );
}

"use client";

import { Mic, MicOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/useSettings";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";
import { ConsentDialog } from "./ConsentDialog";

export function MicButton({ onText, size = "icon", className, label = "Sesle söyle" }: { onText: (t: string) => void; size?: "icon" | "lg" | "default"; className?: string; label?: string }) {
  const [settings, save] = useSettings();
  const [consentOpen, setConsentOpen] = useState(false);
  const rec = useSpeechRecognition(onText);

  const begin = () => {
    if (rec.listening) return rec.stop();
    if (!settings.micConsent) return setConsentOpen(true);
    rec.start();
  };

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <Button type="button" variant={rec.listening ? "destructive" : "secondary"} size={size} onClick={begin} aria-label={rec.listening ? "Dinlemeyi durdur" : label} aria-pressed={rec.listening} className={cn(rec.listening && "animate-pulse-ring")}>
        {rec.listening ? <MicOff /> : <Mic />}
        {size !== "icon" && <span>{rec.listening ? "Dinliyorum… (durdur)" : label}</span>}
      </Button>
      {rec.interim && <span className="text-sm italic text-muted-foreground">“{rec.interim}”</span>}
      {rec.error && (
        <span className="text-sm text-destructive" role="alert">
          {rec.error}
        </span>
      )}
      <ConsentDialog
        kind="mic"
        open={consentOpen}
        onOpenChange={setConsentOpen}
        onAccept={() => {
          save({ micConsent: true });
          rec.start();
        }}
      />
    </div>
  );
}

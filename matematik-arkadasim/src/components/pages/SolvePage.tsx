"use client";

import { ArrowLeft, Camera, Loader2, RefreshCw, WifiOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LessonView } from "@/components/lesson/LessonView";
import { QuestionInput, type QuestionSubmit } from "@/components/question/QuestionInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOnline } from "@/hooks/useOnline";
import { useSettings } from "@/hooks/useSettings";
import { useStatus } from "@/hooks/useStatus";
import * as api from "@/lib/client/api";
import type { LearningMode, SolveResult } from "@/lib/schema/solution";
import { getEntry, type NotebookEntry } from "@/lib/storage/db";

type Phase =
  | { kind: "input" }
  | { kind: "loading"; label: string }
  | { kind: "error"; message: string; code: string; retry?: QuestionSubmit }
  | { kind: "lesson"; result: SolveResult; mode: LearningMode; image?: string; entry?: NotebookEntry; key: number };

const LOADING_LINES = ["Soruyu dikkatle okuyorum…", "Verilenleri ve isteneni ayırıyorum…", "Çözüm adımlarını hazırlıyorum…", "Sonucu kontrol ediyorum…", "Tahtayı hazırlıyorum…"];

export const PENDING_KEY = "matematik:pending-lesson";

export function SolvePage() {
  const params = useSearchParams();
  const router = useRouter();
  const status = useStatus();
  const online = useOnline();
  const [settings] = useSettings();
  const [phase, setPhase] = useState<Phase>({ kind: "input" });
  const [line, setLine] = useState(0);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (phase.kind !== "loading") return;
    const t = setInterval(() => setLine((l) => (l + 1) % LOADING_LINES.length), 2200);
    return () => clearInterval(t);
  }, [phase.kind]);

  const solve = useCallback(async (q: QuestionSubmit) => {
    setPhase({ kind: "loading", label: q.image ? "Fotoğrafı inceliyorum…" : "Soruyu inceliyorum…" });
    setLine(0);
    const res = await api.solve({ text: q.text || undefined, image: q.image, mode: q.mode });
    if (res.ok) {
      setPhase({ kind: "lesson", result: res as SolveResult, mode: q.mode, image: q.image, key: Date.now() });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const retryable = !["UNREADABLE", "NOT_MATH", "DEMO_UNSUPPORTED", "DAILY_LIMIT", "BAD_INPUT"].includes(res.code);
    setPhase({ kind: "error", message: res.message, code: res.code, retry: retryable ? q : undefined });
  }, []);

  // URL parametreleri: ?q=…&mode=… | ?entry=ID | ?practice=konu | ?pending=1
  useEffect(() => {
    const sig = params.toString();
    if (!sig || handled.current === sig) return;
    handled.current = sig;
    const mode = (params.get("mode") as LearningMode) || settings.defaultMode;
    const q = params.get("q");
    const entryId = params.get("entry");
    const practiceTopic = params.get("practice");
    /* URL'den gelen isteğe tepki: harici bir kaynağı (adres çubuğu, sessionStorage, IndexedDB) state'e senkronlar. */
    if (params.get("pending")) {
      try {
        const raw = sessionStorage.getItem(PENDING_KEY);
        sessionStorage.removeItem(PENDING_KEY);
        if (raw) {
          const p = JSON.parse(raw) as { result: SolveResult; mode: LearningMode };
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setPhase({ kind: "lesson", result: p.result, mode: p.mode, key: Date.now() });
        }
      } catch {
        /* yoksay */
      }
    } else if (entryId) {
      getEntry(entryId).then((e) => {
        if (!e) return setPhase({ kind: "error", code: "NOT_FOUND", message: "Bu soru defterde bulunamadı." });
        setPhase({
          kind: "lesson",
          result: { ok: true, source: e.source, provider: e.provider, solution: e.solution, issues: e.issues },
          mode: (params.get("mode") as LearningMode) || "exam",
          image: e.imageDataUrl,
          entry: e,
          key: Date.now(),
        });
      });
    } else if (practiceTopic) {
      setPhase({ kind: "loading", label: "Sana uygun bir alıştırma hazırlıyorum…" });
      api.practice({ topicId: practiceTopic, difficulty: (params.get("d") as "kolay" | "orta" | "zor") || "orta" }).then((res) => {
        if (res.ok) setPhase({ kind: "lesson", result: res as SolveResult, mode: "exam", key: Date.now() });
        else setPhase({ kind: "error", code: res.code, message: res.message });
      });
    } else if (q) {
      void solve({ text: q, mode });
    }
  }, [params, settings.defaultMode, solve]);

  const reset = () => {
    handled.current = null;
    setPhase({ kind: "input" });
    router.replace("/coz");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{phase.kind === "lesson" ? "Özel ders" : "Soru Çöz"}</h1>
        {phase.kind === "lesson" && (
          <Button variant="outline" onClick={reset}>
            <Camera /> Yeni soru
          </Button>
        )}
      </div>

      {phase.kind === "input" && (
        <>
          {!online && (
            <Card className="border-2 border-warning/50">
              <CardContent className="flex items-start gap-3 p-4">
                <WifiOff className="mt-0.5 size-5 shrink-0 text-warning-strong" />
                <p>Yapay zekâ ile yeni soru çözmek için internet bağlantısı gerekir. Bu sırada <Link href="/defter" className="font-bold underline">Soru Defterim</Link>&apos;deki kayıtlı çözümlere bakabilirsin.</p>
              </CardContent>
            </Card>
          )}
          <p className="text-muted-foreground">Sorunu fotoğrafla, yaz ya da sesle söyle. Öğretmenin tahtada adım adım anlatsın.</p>
          <QuestionInput onSubmit={solve} busy={false} demo={status?.mode === "demo"} />
        </>
      )}

      {phase.kind === "loading" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center" role="status" aria-live="polite">
            <Loader2 className="size-12 animate-spin text-primary" />
            <p className="text-lg font-bold">{phase.label}</p>
            <p className="text-muted-foreground">{LOADING_LINES[line]}</p>
          </CardContent>
        </Card>
      )}

      {phase.kind === "error" && (
        <Card className="border-2 border-destructive/30">
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <p className="text-lg font-semibold" role="alert">
              {phase.code === "UNREADABLE" ? "📷 " : ""}
              {phase.message}
            </p>
            {phase.code === "UNREADABLE" && (
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                <li>Fotoğrafı aydınlık bir yerde, gölge düşürmeden çek.</li>
                <li>Telefonu kâğıda paralel tut, yalnızca soruyu kadraja al.</li>
                <li>Yazının net ve odaklı olduğundan emin ol; gerekirse kırp.</li>
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {phase.retry && (
                <Button onClick={() => phase.retry && solve(phase.retry)}>
                  <RefreshCw /> Tekrar dene
                </Button>
              )}
              <Button variant="outline" onClick={reset}>
                <ArrowLeft /> Soruya geri dön
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {phase.kind === "lesson" && (
        <LessonView
          key={phase.key}
          result={phase.result}
          initialMode={phase.mode}
          imageDataUrl={phase.image}
          existingEntry={phase.entry}
          onSolveText={(text, mode) => solve({ text, mode })}
          onNewQuestion={reset}
        />
      )}
    </div>
  );
}

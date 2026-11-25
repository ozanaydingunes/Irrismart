"use client";

import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCircle2,
  Eye,
  Lightbulb,
  ListChecks,
  Loader2,
  RefreshCcw,
  Sparkles,
  Star,
  Target,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { SmartBoard } from "@/components/board/SmartBoard";
import { MathTex } from "@/components/math/MathTex";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNarration } from "@/hooks/useNarration";
import { useSettings } from "@/hooks/useSettings";
import * as api from "@/lib/client/api";
import { answersEquivalent } from "@/lib/math/answer";
import type { LearningMode, SolutionStep, SolveResult, TutorAction } from "@/lib/schema/solution";
import { nextReviewDate } from "@/lib/stats/stats";
import { newId, recordAnswer, recordLesson, saveEntry, updateEntry, type EntryStatus, type NotebookEntry } from "@/lib/storage/db";
import { cn } from "@/lib/utils";
import { ModeSelector, MODE_INFO } from "./ModeSelector";
import { PlayerControls } from "./PlayerControls";
import { TutorPanel, type ChatMessage } from "./TutorPanel";

interface Props {
  result: SolveResult;
  initialMode: LearningMode;
  imageDataUrl?: string;
  existingEntry?: NotebookEntry;
  onSolveText: (text: string, mode: LearningMode) => void;
  onNewQuestion: () => void;
  /** Soru fotoğraftan okunduysa öğrenciye okunan metni doğrulatırız */
  wasFromImage?: boolean;
}

export function LessonView({ result, initialMode, imageDataUrl, existingEntry, onSolveText, onNewQuestion, wasFromImage }: Props) {
  const { solution, source, issues } = result;
  const steps = solution.steps;
  const topicId = solution.topicId ?? "diger";
  const [settings, saveSettings] = useSettings();
  const [mode, setMode] = useState<LearningMode>(initialMode);
  const [examDone, setExamDone] = useState(initialMode !== "exam");
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set([0]));
  const [answered, setAnswered] = useState<Set<number>>(() => new Set());
  const [maxReached, setMaxReached] = useState(0);
  const [entry, setEntry] = useState<NotebookEntry | undefined>(existingEntry);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selfAssessed, setSelfAssessed] = useState<null | "correct" | "wrong" | "review">(null);
  // Aynı ders için gelişim paneline yalnızca bir kez "doğru/yanlış" yazılır (tekrar tıklama istatistiği şişirmesin)
  const answerRecorded = useRef(false);
  const [tutorRequest, setTutorRequest] = useState<{ action: TutorAction; label: string; nonce: number } | undefined>();
  // Geniş ekranda özet açık, telefonda kapalı başlar (yalnızca tarayıcıda hesaplanır)
  const wideScreen = useSyncExternalStore(
    () => () => {},
    () => window.matchMedia("(min-width: 1280px)").matches,
    () => false,
  );
  const lessonRecorded = useRef(false);

  const waitRef = useRef<(i: number) => boolean>(() => false);
  waitRef.current = (i: number) => {
    if (mode === "hint") return true; // ipucu modunda öğrenci kendi ilerler
    if (mode === "together") return !!steps[i + 1]?.studentQuestion && !answered.has(i + 1);
    return false;
  };
  const shouldWait = useCallback((i: number) => waitRef.current(i), []);

  const narrations = useMemo(() => steps.map((s) => s.narration), [steps]);
  const { controller, state, engineLabel, availability, speakAside, stopAside, asideSpeaking } = useNarration(narrations, { shouldWaitAfterStep: shouldWait });
  const current = Math.min(state.stepIndex, steps.length - 1);
  // Tahta animasyonları yalnızca BU adım seslendirilirken duraklatıldıysa donar. Duraklatılmış hâldeyken
  // başka adıma geçilirse (playToken değişir) yeni adım normal şekilde çizilir; aksi hâlde formül görünmez kalırdı.
  const [playedToken, setPlayedToken] = useState(-1);
  if (state.status === "playing" && playedToken !== state.playToken) setPlayedToken(state.playToken);

  // Ulaşılan en ileri adım (render sırasında türetilen durum)
  if (current > maxReached) setMaxReached(current);

  // Birlikte çözme: soru sorulacak adıma gelince onu göster (seslendirmeden önce öğrenci denesin)
  useEffect(() => {
    if (state.status === "waiting" && mode === "together") controller.goTo(state.stepIndex + 1);
  }, [state.status, state.stepIndex, mode, controller]);

  // Ders bitince (son adıma ulaşıldığında) bir kez "çözülen soru" olarak kaydet
  const reachedEnd = maxReached >= steps.length - 1 && examDone;
  useEffect(() => {
    if (reachedEnd && !lessonRecorded.current) {
      lessonRecorded.current = true;
      recordLesson(topicId, source).catch(() => undefined);
    }
  }, [reachedEnd, topicId, source]);

  // Tam çözüm modunda ders açılınca anlatımı başlat
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || !examDone || mode !== "full") return;
    autoStarted.current = true;
    const t = setTimeout(() => controller.play(), 400);
    return () => clearTimeout(t);
  }, [controller, examDone, mode]);

  // Defter: ayar açıksa otomatik kaydet
  useEffect(() => {
    if (settings.autoSaveToNotebook && !entry) void persist({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hiddenSteps = useMemo(() => {
    const h = new Set<number>();
    if (mode === "hint") steps.forEach((_, i) => !revealed.has(i) && h.add(i));
    if (mode === "together") steps.forEach((s, i) => s.studentQuestion && !answered.has(i) && h.add(i));
    return h;
  }, [mode, steps, revealed, answered]);

  async function persist(patch: Partial<NotebookEntry>): Promise<NotebookEntry> {
    const now = Date.now();
    if (entry) {
      const next = { ...entry, ...patch, updatedAt: now };
      await updateEntry(entry.id, patch);
      setEntry(next);
      return next;
    }
    const created: NotebookEntry = {
      id: newId(),
      createdAt: now,
      updatedAt: now,
      question: solution.question,
      topicId: solution.topicId,
      topic: solution.topic,
      difficulty: solution.difficulty,
      source,
      provider: result.provider,
      solution,
      issues,
      imageDataUrl: settings.savePhotos ? imageDataUrl : undefined,
      favorite: false,
      status: "solved",
      mode,
      reviewCount: 0,
      ...patch,
    };
    await saveEntry(created);
    setEntry(created);
    return created;
  }

  async function assess(kind: "correct" | "wrong" | "review") {
    setSelfAssessed(kind);
    if (kind !== "review" && !answerRecorded.current) {
      answerRecorded.current = true;
      await recordAnswer({ topicId, correct: kind === "correct", scope: "final", mode, entryId: entry?.id });
    }
    const status: EntryStatus = kind === "correct" ? "solved" : kind === "wrong" ? "wrong" : "review";
    await persist({
      status,
      lastResult: kind === "review" ? entry?.lastResult : kind,
      reviewCount: (entry?.reviewCount ?? 0) + (existingEntry ? 1 : 0),
      nextReviewAt: kind === "correct" && !existingEntry ? undefined : nextReviewDate(kind === "correct", entry?.reviewCount ?? 0),
    });
  }

  function reveal(i: number) {
    setRevealed((r) => new Set(r).add(i));
  }

  function changeMode(m: LearningMode) {
    controller.stop();
    setMode(m);
    if (m === "exam") setExamDone(false);
    else setExamDone(true);
    setRevealed(new Set([0]));
    controller.goTo(0);
  }

  const lastStep = current >= steps.length - 1;
  const finished = (state.status === "finished" || (lastStep && maxReached >= steps.length - 1)) && examDone;

  return (
    <div className="flex flex-col gap-4">
      {/* Soru başlığı */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{solution.topic}</Badge>
            <Badge variant="secondary">Zorluk: {solution.difficulty}</Badge>
            {result.provider.startsWith("TEST") ? (
              <Badge variant="warning">TEST SAĞLAYICISI — gerçek yapay zekâ değil</Badge>
            ) : source === "demo" ? (
              <Badge variant="warning">DEMO — yapay zekâ çözümü değil</Badge>
            ) : (
              <Badge variant="success">
                <Sparkles className="size-3" /> Yapay zekâ çözümü
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {imageDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageDataUrl} alt="Yüklenen soru fotoğrafı" className="max-h-48 w-auto rounded-2xl border object-contain sm:max-w-[40%]" />
            )}
            <p className="whitespace-pre-wrap text-lg font-semibold leading-relaxed">{solution.question}</p>
          </div>
          {solution.choices && solution.choices.length > 0 && (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {solution.choices.map((c) => (
                <li key={c.key} className="rounded-xl border-2 border-border px-3 py-2 text-base">
                  <b>{c.key})</b> {c.text}
                </li>
              ))}
            </ul>
          )}
          {result.notice && <p className="rounded-xl bg-warning/12 p-3 text-sm text-warning-strong">{result.notice}</p>}
          {(issues.length > 0 || solution.uncertainty || !solution.verification.isVerified) && (
            <div className="flex gap-2 rounded-xl border-2 border-warning/50 bg-warning/10 p-3 text-sm" role="alert">
              <AlertTriangle className="size-5 shrink-0 text-warning-strong" aria-hidden />
              <div className="flex flex-col gap-1 text-foreground">
                <b>Dikkat, öğretmenin de emin olmadığı bir nokta var:</b>
                {solution.uncertainty && <span>{solution.uncertainty}</span>}
                {!solution.verification.isVerified && <span>Yapay zekâ sonucu kendi kontrolünde doğrulayamadı.</span>}
                {issues.map((iss, i) => (
                  <span key={i}>
                    {iss.stepId}. adım: {iss.message}
                  </span>
                ))}
                <span>Bu adımları dikkatle kontrol et; istersen “Başka yöntemle çöz” diyebilirsin.</span>
              </div>
            </div>
          )}
          {wasFromImage && <QuestionConfirm question={solution.question} note={solution.readingNote} onCorrect={(t) => onSolveText(t, mode)} />}
          <details className="group [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-xl text-sm font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">
              Öğrenme şekli: <span className="text-primary">{MODE_INFO[mode].title}</span>
              <span className="group-open:hidden">· değiştir</span>
            </summary>
            <div className="mt-2">
              <ModeSelector value={mode} onChange={changeMode} compact />
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Sınav modu: önce öğrencinin cevabı */}
      {!examDone ? (
        <ExamGate
          result={result}
          onDone={async (correct) => {
            if (correct !== null && !answerRecorded.current) {
              answerRecorded.current = true;
              await recordAnswer({ topicId, correct, scope: "final", mode: "exam", entryId: entry?.id });
              const reviews = (entry?.reviewCount ?? 0) + (existingEntry ? 1 : 0);
              await persist({
                status: correct ? "solved" : "wrong",
                lastResult: correct ? "correct" : "wrong",
                reviewCount: reviews,
                nextReviewAt: correct && !existingEntry ? undefined : nextReviewDate(correct, reviews),
              });
              setSelfAssessed(correct ? "correct" : "wrong");
            }
            setExamDone(true);
            setTimeout(() => controller.play(), 300);
          }}
        />
      ) : (
        <>
          {/* Verilenler / İstenen / Strateji: mobilde tahtayı aşağı itmesin diye katlanabilir özet */}
          <details className="group rounded-3xl border border-border bg-card shadow-card [&_summary::-webkit-details-marker]:hidden" open={wideScreen}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-3xl px-4 py-2 font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/40">
              <span className="flex items-center gap-2">
                <ListChecks className="size-5 text-primary" /> Verilenler · İstenen · Çözüm yolu
              </span>
              <span className="text-sm font-medium text-muted-foreground group-open:hidden">Göster</span>
              <span className="hidden text-sm font-medium text-muted-foreground group-open:inline">Gizle</span>
            </summary>
            <div className="grid gap-3 px-4 pb-4 md:grid-cols-3">
              <InfoCard icon={<ListChecks className="size-5" />} title="Verilenler">
                {solution.givenInformation.length ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {solution.givenInformation.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </InfoCard>
              <InfoCard icon={<Target className="size-5" />} title="İstenen">
                {solution.requestedInformation}
              </InfoCard>
              <InfoCard icon={<Lightbulb className="size-5" />} title="Çözüm yolu">
                {solution.solutionStrategy}
              </InfoCard>
            </div>
          </details>

          {/* Tablette (dikey ve yatay) tahta tam genişlikte; çok geniş ekranda yanında öğretmen paneli */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-3">
              <SmartBoard
                steps={steps}
                currentIndex={current}
                visibleUntil={Math.max(maxReached, current)}
                playToken={state.playToken}
                speaking={state.status === "playing"}
                paused={state.status === "paused" && playedToken === state.playToken}
                chunkIndex={state.chunkIndex}
                segment={hiddenSteps.has(current) ? undefined : controller.getSegment(current)}
                hiddenSteps={hiddenSteps}
                onSelectStep={(i) => controller.goTo(i)}
                renderStepExtra={(i) =>
                  hiddenSteps.has(i) ? (
                    mode === "hint" ? (
                      <HintCard
                        step={steps[i]}
                        onReveal={() => {
                          reveal(i);
                          stopAside();
                          controller.repeatStep();
                        }}
                      />
                    ) : (
                      <StudentQuestionCard
                        step={steps[i]}
                        question={solution.question}
                        onResult={async (correct) => {
                          if (correct !== null) await recordAnswer({ topicId, correct, scope: "step", mode, entryId: entry?.id });
                        }}
                        onContinue={() => {
                          setAnswered((a) => new Set(a).add(i));
                          stopAside();
                          setTimeout(() => controller.repeatStep(), 50);
                        }}
                        speak={speakAside}
                      />
                    )
                  ) : mode === "hint" && i < steps.length - 1 && state.status !== "playing" ? (
                    <Button variant="secondary" onClick={() => controller.next()} className="self-start">
                      Sıradaki ipucuna geç
                    </Button>
                  ) : null
                }
              />
              <PlayerControls
                controller={controller}
                state={state}
                rate={settings.rate}
                onRate={(r) => saveSettings({ rate: r })}
                voiceOn={settings.voiceEnabled}
                onToggleVoice={() => {
                  controller.pause();
                  stopAside();
                  saveSettings({ voiceEnabled: !settings.voiceEnabled });
                }}
                availability={availability}
                engineLabel={engineLabel}
                canAdvance={!(mode === "together" && hiddenSteps.has(current))}
                beforePlay={() => {
                  stopAside();
                  if (mode === "hint") reveal(current);
                }}
                onDontUnderstand={() => {
                  setTutorRequest({ action: "dont_understand", label: "Anlamadım", nonce: Date.now() });
                  document.getElementById("ogretmene-sor")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
              {asideSpeaking && (
                <Button variant="outline" size="sm" onClick={stopAside} className="self-start">
                  Öğretmenin yanıtını susturmak için dokun
                </Button>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <TutorPanel
                solution={solution}
                stepIndex={current}
                messages={messages}
                setMessages={setMessages}
                onBeforeAsk={() => {
                  // Yeni soru sorulunca önceki anlatım ve önceki yanıt susar
                  controller.pause();
                  stopAside();
                }}
                request={tutorRequest}
                onPrevStep={() => controller.prev()}
                onTeacherReply={(m) => speakAside(m.text)}
              />
            </div>
          </div>

          {finished || maxReached >= steps.length - 1 ? (
            <ResultSection
              result={result}
              mode={mode}
              entry={entry}
              selfAssessed={selfAssessed}
              onAssess={assess}
              onSave={() => persist({})}
              onToggleFavorite={() => persist({ favorite: !entry?.favorite })}
              onSolveText={onSolveText}
              onNewQuestion={onNewQuestion}
            />
          ) : (
            <p className="text-center text-sm text-muted-foreground">Sonuç ve kontrol, son adıma gelince burada görünecek.</p>
          )}
        </>
      )}
    </div>
  );
}

/** Fotoğraftan okunan soru metnini öğrenciye doğrulatır; yanlışsa düzeltip yeniden çözdürür. */
function QuestionConfirm({ question, note, onCorrect }: { question: string; note?: string; onCorrect: (text: string) => void }) {
  const [state, setState] = useState<"ask" | "ok" | "edit">("ask");
  const [text, setText] = useState(question);
  if (state === "ok") return null;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-primary/40 bg-accent/40 p-3" role="region" aria-label="Okunan soruyu doğrula">
      <p className="text-sm font-semibold">Fotoğraftan yukarıdaki soruyu okudum. Doğru okumuş muyum?</p>
      {note && <p className="text-sm text-muted-foreground">Not: {note}</p>}
      {state === "ask" ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="success" onClick={() => setState("ok")}>
            <Check /> Evet, doğru
          </Button>
          <Button size="sm" variant="outline" onClick={() => setState("edit")}>
            Hayır, düzelteceğim
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) onCorrect(text.trim());
          }}
        >
          <label htmlFor="fix-q" className="text-sm font-semibold">
            Soruyu doğru hâliyle yaz:
          </label>
          <textarea id="fix-q" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={3} className="rounded-2xl border-2 border-input bg-background p-3 text-base" />
          <Button size="sm" type="submit" className="self-start" disabled={!text.trim()}>
            Düzeltilmiş soruyu çöz
          </Button>
        </form>
      )}
    </div>
  );
}

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2 font-bold text-primary">
        {icon}
        {title}
      </div>
      <div className="text-base leading-relaxed">{children}</div>
    </Card>
  );
}

function HintCard({ step, onReveal }: { step: SolutionStep; onReveal: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-primary/50 bg-accent/40 p-3">
      <div className="flex items-center gap-2 font-bold text-accent-foreground">
        <Lightbulb className="size-5" /> İpucu: {step.title.toLocaleLowerCase("tr-TR")}
      </div>
      <p className="text-sm text-muted-foreground">Yukarıdaki açıklamayı ipucu olarak kullan ve işlemi önce kendin kâğıda yapmayı dene.</p>
      <Button onClick={onReveal} variant="secondary" className="self-start">
        <Eye /> Bu adımı göster ve anlat
      </Button>
    </div>
  );
}

function StudentQuestionCard({
  step,
  question,
  onResult,
  onContinue,
  speak,
}: {
  step: SolutionStep;
  question: string;
  onResult: (correct: boolean | null) => Promise<void>;
  onContinue: () => void;
  speak: (t: string) => void;
}) {
  const q = step.studentQuestion!;
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [tries, setTries] = useState(0);
  const spoken = useRef(false);
  useEffect(() => {
    if (spoken.current) return;
    spoken.current = true;
    speak(`Şimdi sıra sende! ${q.prompt}`);
  }, [q.prompt, speak]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || busy) return;
    setBusy(true);
    const res = await api.check({ question, prompt: q.prompt, expected: q.expectedAnswer, studentAnswer: answer });
    setBusy(false);
    if (!res.ok) {
      setFeedback({ correct: false, text: res.message });
      return;
    }
    setTries((t) => t + 1);
    setFeedback({ correct: res.reply.correct, text: res.reply.feedback + (res.reply.mistakeReason && !res.reply.correct ? ` (${res.reply.mistakeReason})` : "") });
    speak(res.reply.narration);
    if (tries === 0) await onResult(res.reply.correct);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-primary/60 bg-accent/40 p-4">
      <div className="font-bold text-accent-foreground">Sıra sende! ✏️</div>
      <p className="text-base">{q.prompt}</p>
      <form onSubmit={submit} className="flex gap-2">
        <Input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Cevabın (ör. 12, 3/4, 2,5)" aria-label="Cevabın" maxLength={100} inputMode="text" />
        <Button type="submit" disabled={busy || !answer.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : <Check />}
          Kontrol et
        </Button>
      </form>
      {feedback && (
        <p className={cn("rounded-xl p-3 text-sm font-medium", feedback.correct ? "bg-success/15 text-success-strong" : "bg-destructive/10 text-destructive")} role="status">
          {feedback.text}
        </p>
      )}
      {!feedback?.correct && q.hint && tries > 0 && <p className="text-sm text-muted-foreground">İpucu: {q.hint}</p>}
      <div className="flex flex-wrap gap-2">
        {feedback?.correct ? (
          <Button onClick={onContinue} variant="success">
            Devam edelim
          </Button>
        ) : (
          <Button variant="ghost" onClick={onContinue}>
            Çözümü göster
          </Button>
        )}
      </div>
    </div>
  );
}

function ExamGate({ result, onDone }: { result: SolveResult; onDone: (correct: boolean | null) => void }) {
  const s = result.solution;
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);

  async function check(value: string) {
    if (!value.trim() || busy) return;
    setBusy(true);
    const expected = s.finalAnswer.choice ?? s.finalAnswer.latex ?? s.finalAnswer.text;
    let correct: boolean | null = answersEquivalent(value, expected);
    if (correct === null && s.finalAnswer.latex) correct = answersEquivalent(value, s.finalAnswer.text);
    let text: string;
    if (correct === null) {
      const res = await api.check({ question: s.question, prompt: "Sorunun nihai cevabı nedir?", expected: s.finalAnswer.text, studentAnswer: value });
      if (res.ok) {
        correct = res.reply.correct;
        text = res.reply.feedback;
      } else text = res.message;
    } else text = correct ? "Tebrikler, doğru cevap! 🎉 Şimdi çözümü birlikte inceleyelim." : "Bu sefer olmadı, ama hatalar en iyi öğretmendir. Hadi çözümü adım adım inceleyelim.";
    setBusy(false);
    setFeedback(correct === null ? null : { correct, text });
    if (correct === null) setFeedback({ correct: false, text });
    setTimeout(() => onDone(correct), correct === null ? 0 : 1600);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Önce sen çöz! 📝</CardTitle>
        <p className="text-sm text-muted-foreground">Cevabını yaz veya şıkkı seç. Sonra çözümü adım adım inceleyeceğiz.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {s.choices && s.choices.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {s.choices.map((c) => (
              <Button key={c.key} variant="outline" size="lg" disabled={busy || !!feedback} onClick={() => check(c.key)}>
                {c.key}) {c.text}
              </Button>
            ))}
          </div>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              check(answer);
            }}
          >
            <Input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Cevabın (ör. 150, 3/4, x = 5)" aria-label="Cevabın" maxLength={100} disabled={!!feedback} />
            <Button type="submit" disabled={busy || !answer.trim() || !!feedback}>
              {busy ? <Loader2 className="animate-spin" /> : <Check />} Kontrol et
            </Button>
          </form>
        )}
        {feedback && (
          <p className={cn("rounded-xl p-3 font-semibold", feedback.correct ? "bg-success/15 text-success-strong" : "bg-destructive/10 text-destructive")} role="status">
            {feedback.text}
          </p>
        )}
        <Button variant="ghost" onClick={() => onDone(null)} disabled={busy} className="self-start">
          Bilmiyorum, çözümü göster
        </Button>
      </CardContent>
    </Card>
  );
}

function ResultSection({
  result,
  mode,
  entry,
  selfAssessed,
  onAssess,
  onSave,
  onToggleFavorite,
  onSolveText,
  onNewQuestion,
}: {
  result: SolveResult;
  mode: LearningMode;
  entry?: NotebookEntry;
  selfAssessed: null | "correct" | "wrong" | "review";
  onAssess: (k: "correct" | "wrong" | "review") => void;
  onSave: () => void;
  onToggleFavorite: () => void;
  onSolveText: (t: string, m: LearningMode) => void;
  onNewQuestion: () => void;
}) {
  const s = result.solution;
  return (
    <div className="grid animate-rise-in gap-4 md:grid-cols-2">
      <Card className="border-2 border-success/40 md:col-span-2">
        <CardContent className="flex flex-col items-center gap-2 p-5 text-center">
          <CheckCircle2 className="size-10 text-success" aria-hidden />
          <div className="text-sm font-bold uppercase tracking-wide text-success-strong">Sonuç</div>
          {s.finalAnswer.latex && (
            <div className="text-board-foreground">
              <MathTex latex={s.finalAnswer.latex} display className="katex-host-lg" />
            </div>
          )}
          <p className="text-lg font-bold">{s.finalAnswer.text}</p>
          {s.finalAnswer.choice && <Badge variant="success">Doğru seçenek: {s.finalAnswer.choice}</Badge>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="size-5 text-success" /> Kontrol
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p>{s.verification.method}</p>
          {s.verification.latex && (
            <div className="overflow-x-auto text-center">
              <MathTex latex={s.verification.latex} display />
            </div>
          )}
          {result.issues.length === 0 && result.source === "ai" && <p className="text-sm text-muted-foreground">Uygulama, adımlardaki sayısal eşitlikleri ayrıca kesin aritmetikle kontrol etti.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-warning" /> Sık yapılan hatalar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {s.commonMistakes.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {s.commonMistakes.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">—</p>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Kendini değerlendir</CardTitle>
          <p className="text-sm text-muted-foreground">Bu bilgiler yalnızca bu cihazdaki Gelişimim sayfası için kullanılır.</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {mode !== "exam" && (
            <>
              <Button variant={selfAssessed === "correct" ? "success" : "outline"} onClick={() => onAssess("correct")} aria-pressed={selfAssessed === "correct"}>
                <Check /> Ben de doğru bulmuştum
              </Button>
              <Button variant={selfAssessed === "wrong" ? "destructive" : "outline"} onClick={() => onAssess("wrong")} aria-pressed={selfAssessed === "wrong"}>
                <X /> Yanlış yapmıştım
              </Button>
            </>
          )}
          <Button variant={selfAssessed === "review" ? "secondary" : "outline"} onClick={() => onAssess("review")} aria-pressed={selfAssessed === "review"}>
            <RefreshCcw /> Tekrar etmeliyim
          </Button>
          <Button variant="outline" onClick={onSave} disabled={!!entry}>
            {entry ? <BookmarkCheck /> : <Bookmark />} {entry ? "Defterde kayıtlı" : "Deftere kaydet"}
          </Button>
          <Button variant="outline" onClick={onToggleFavorite} aria-pressed={!!entry?.favorite}>
            <Star className={cn(entry?.favorite && "fill-warning text-warning")} /> {entry?.favorite ? "Favorilerde" : "Favorilere ekle"}
          </Button>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> Benzer soru
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-base">{s.similarQuestion.text}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onSolveText(s.similarQuestion.text, "exam")}>Bu soruyu kendim çözeyim</Button>
            <Button variant="outline" onClick={() => onSolveText(s.similarQuestion.text, "together")}>
              Birlikte çözelim
            </Button>
            <Button variant="ghost" onClick={onNewQuestion}>
              Yeni soru sor
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Mod: {MODE_INFO[mode].title}</p>
        </CardContent>
      </Card>
    </div>
  );
}

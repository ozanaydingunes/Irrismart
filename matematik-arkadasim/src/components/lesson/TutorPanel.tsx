"use client";

import { BookOpen, HelpCircle, Lightbulb, Loader2, MessageCircleQuestion, RefreshCcw, Send, Shuffle, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MicButton } from "@/components/common/MicButton";
import { MathTex } from "@/components/math/MathTex";
import { Visual } from "@/components/board/visuals";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import * as api from "@/lib/client/api";
import type { Solution, SolutionStep, TutorAction } from "@/lib/schema/solution";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  role: "student" | "teacher";
  text: string;
  steps?: SolutionStep[];
  source?: "ai" | "demo";
}

const ACTIONS: { action: TutorAction | "prev"; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { action: "dont_understand", label: "Anlamadım", icon: HelpCircle },
  { action: "simpler", label: "Daha basit anlat", icon: Sparkles },
  { action: "why", label: "Neden böyle yaptık?", icon: MessageCircleQuestion },
  { action: "other_method", label: "Başka yöntemle çöz", icon: Shuffle },
  { action: "example", label: "Örnek ver", icon: BookOpen },
  { action: "hint", label: "İpucu ver", icon: Lightbulb },
  { action: "prev", label: "Önceki adıma dön", icon: Undo2 },
  { action: "explain_topic", label: "Bu konuyu baştan anlat", icon: RefreshCcw },
];

interface Props {
  solution: Solution;
  stepIndex: number;
  onBeforeAsk: () => void;
  onPrevStep: () => void;
  onTeacherReply: (msg: ChatMessage) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  /** Oynatıcıdaki "Anlamadım" gibi dışarıdan gelen istek (nonce her basışta değişir) */
  request?: { action: TutorAction; label: string; nonce: number };
}

/** Etkileşimli özel ders: hazır düğmeler + yazılı/sesli serbest soru. */
export function TutorPanel({ solution, stepIndex, onBeforeAsk, onPrevStep, onTeacherReply, messages, setMessages, request }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(action: TutorAction, label: string, message?: string) {
    if (busy) return;
    onBeforeAsk();
    setError(null);
    setBusy(true);
    const studentText = message ?? label;
    const history = messages.map((m) => ({ role: m.role, text: m.text.slice(0, 1500) }));
    setMessages((m) => [...m, { role: "student", text: studentText }]);
    const res = await api.tutor({ solution, stepIndex, action, message, history });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    const msg: ChatMessage = { role: "teacher", text: res.reply.message, steps: res.reply.steps, source: res.source };
    setMessages((m) => [...m, msg]);
    onTeacherReply({ ...msg, text: res.reply.narration });
  }

  const askRef = useRef(ask);
  useEffect(() => {
    askRef.current = ask;
  });
  const lastNonce = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!request || request.nonce === lastNonce.current) return;
    lastNonce.current = request.nonce;
    void askRef.current(request.action, request.label);
  }, [request]);

  return (
    <Card className="scroll-mt-20 p-4" id="ogretmene-sor">
      <h2 className="mb-1 text-lg font-bold">Öğretmenine sor</h2>
      <p className="mb-3 text-sm text-muted-foreground">Anlatımı istediğin an durdurup soru sorabilirsin. Öğretmen bulunduğun adımı ({stepIndex + 1}. adım) dikkate alır.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
        {ACTIONS.map(({ action, label, icon: Icon }) => (
          <button
            key={action}
            type="button"
            disabled={busy}
            onClick={() => (action === "prev" ? onPrevStep() : ask(action, label))}
            className="flex min-h-12 items-center gap-2 rounded-2xl border-2 border-border bg-background px-3 py-2 text-left text-sm font-semibold transition-colors hover:border-primary hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:opacity-50"
          >
            <Icon className="size-4 shrink-0 text-primary" />
            {label}
          </button>
        ))}
      </div>

      {messages.length > 0 && (
        <ol className="mt-4 flex max-h-[28rem] flex-col gap-3 overflow-y-auto pr-1" aria-label="Özel ders konuşması" aria-live="polite">
          {messages.map((m, i) => (
            <li key={i} className={cn("max-w-[92%] rounded-2xl p-3 text-base leading-relaxed", m.role === "student" ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted")}>
              {m.role === "teacher" && (
                <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Öğretmen {m.source === "demo" && <span className="ml-1 rounded bg-warning/25 px-1.5 text-warning-strong">DEMO</span>}
                </div>
              )}
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.steps && m.steps.length > 0 && (
                <ol className="mt-3 flex flex-col gap-2">
                  {m.steps.map((s, k) => (
                    <li key={k} className="rounded-xl bg-card p-3">
                      <div className="font-bold">{s.title}</div>
                      <div className="text-sm">{s.explanation}</div>
                      {s.latex && (
                        <div className="mt-1 overflow-x-auto text-center">
                          <MathTex latex={s.latex} display highlights={s.highlightedElements} />
                        </div>
                      )}
                      {s.visualInstructions.map((v, j) => (
                        <div key={j} className="mt-2">
                          <Visual v={v} />
                        </div>
                      ))}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
          {busy && (
            <li className="flex items-center gap-2 self-start rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Öğretmen düşünüyor…
            </li>
          )}
        </ol>
      )}
      {error && (
        <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <form
        className="mt-4 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          const t = text.trim();
          setText("");
          ask("free_question", t, t);
        }}
      >
        <label htmlFor="tutor-q" className="text-sm font-semibold">
          Kendi sorunu yaz veya söyle
        </label>
        <div className="flex items-end gap-2">
          <Textarea id="tutor-q" value={text} onChange={(e) => setText(e.target.value)} placeholder="Örn: Neden paydaları eşitledik?" className="min-h-[56px] flex-1" maxLength={1000} rows={2} />
          <div className="flex flex-col gap-2">
            <MicButton onText={(t) => setText((p) => (p ? p + " " : "") + t)} label="Sesle sor" />
            <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Gönder">
              <Send />
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

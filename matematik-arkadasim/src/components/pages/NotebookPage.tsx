"use client";

import { BookMarked, Loader2, PencilRuler, PlayCircle, Search, Sparkles, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/client/api";
import type { SolveResult } from "@/lib/schema/solution";
import { DATA_EVENT, deleteEntry, listEntries, updateEntry, type NotebookEntry } from "@/lib/storage/db";
import { findTopic } from "@/lib/topics";
import { cn } from "@/lib/utils";
import { PENDING_KEY } from "./SolvePage";

type Filter = "all" | "favorite" | "wrong" | "review";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "favorite", label: "Favoriler" },
  { id: "wrong", label: "Yanlışlarım" },
  { id: "review", label: "Tekrar edilecek" },
];

const STATUS_LABEL: Record<NotebookEntry["status"], { text: string; variant: "success" | "danger" | "warning" }> = {
  solved: { text: "Çözüldü", variant: "success" },
  wrong: { text: "Yanlış yapıldı", variant: "danger" },
  review: { text: "Tekrar edilecek", variant: "warning" },
};

export function NotebookPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [entries, setEntries] = useState<NotebookEntry[] | null>(null);
  const [filter, setFilter] = useState<Filter>((params.get("f") as Filter) || "all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => listEntries().then(setEntries).catch(() => setEntries([]));
    load();
    window.addEventListener(DATA_EVENT, load);
    return () => window.removeEventListener(DATA_EVENT, load);
  }, []);

  const [now] = useState(() => Date.now());
  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return entries.filter((e) => {
      if (filter === "favorite" && !e.favorite) return false;
      if (filter === "wrong" && e.status !== "wrong") return false;
      if (filter === "review" && !(e.status === "review" || e.status === "wrong")) return false;
      if (q && !(`${e.question} ${e.topic}`.toLocaleLowerCase("tr-TR").includes(q))) return false;
      return true;
    });
  }, [entries, filter, query]);

  const groups = useMemo(() => {
    const m = new Map<string, NotebookEntry[]>();
    for (const e of filtered) {
      const title = findTopic(e.topicId)?.title ?? e.topic;
      m.set(title, [...(m.get(title) ?? []), e]);
    }
    return [...m.entries()];
  }, [filtered]);

  async function similar(e: NotebookEntry) {
    setBusyId(e.id);
    setError(null);
    const res = await api.practice({ topicId: e.topicId ?? "problemler", difficulty: e.difficulty, basedOn: e.question });
    setBusyId(null);
    if (!res.ok) return setError(res.message);
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ result: res as SolveResult, mode: "exam" }));
    router.push("/coz?pending=1");
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Soru Defterim</h1>
        <p className="text-muted-foreground">Kaydettiğin sorular yalnızca bu cihazda saklanır ve internet olmadan da açılabilir.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Defter filtresi">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn("min-h-10 rounded-full px-4 text-sm font-semibold transition-colors", filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Defterde ara" className="pl-9" aria-label="Defterde ara" />
        </div>
      </div>
      {error && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {entries === null ? (
        <Loader2 className="mx-auto size-8 animate-spin text-primary" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <BookMarked className="size-12 text-primary" />
            <p className="text-lg font-bold">{entries.length === 0 ? "Defterin henüz boş" : "Bu filtrede soru yok"}</p>
            <p className="max-w-md text-muted-foreground">Bir soruyu çözdükten sonra “Deftere kaydet” ile buraya ekleyebilir, yanlış yaptığın soruları daha sonra tekrar edebilirsin.</p>
            <Button asChild>
              <Link href="/coz">Soru çöz</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        groups.map(([title, list]) => (
          <section key={title} className="flex flex-col gap-3" aria-label={title}>
            <h2 className="text-lg font-bold text-primary">
              {title} <span className="text-sm font-medium text-muted-foreground">({list.length})</span>
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {list.map((e) => {
                const due = (e.status === "wrong" || e.status === "review") && (!e.nextReviewAt || e.nextReviewAt <= now);
                return (
                  <li key={e.id}>
                    <Card className="flex h-full flex-col gap-3 p-4">
                      <div className="flex items-start gap-2">
                        <p className="line-clamp-3 flex-1 font-medium">{e.question}</p>
                        <button
                          type="button"
                          onClick={() => updateEntry(e.id, { favorite: !e.favorite })}
                          aria-pressed={e.favorite}
                          aria-label={e.favorite ? "Favorilerden çıkar" : "Favorilere ekle"}
                          className="rounded-full p-2 hover:bg-muted"
                        >
                          <Star className={cn("size-5", e.favorite ? "fill-warning text-warning" : "text-muted-foreground")} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={STATUS_LABEL[e.status].variant}>{STATUS_LABEL[e.status].text}</Badge>
                        {due && <Badge variant="warning">Tekrar zamanı</Badge>}
                        {e.source === "demo" && <Badge variant="outline">Demo</Badge>}
                        <Badge variant="outline">{new Date(e.createdAt).toLocaleDateString("tr-TR")}</Badge>
                      </div>
                      <div className="mt-auto flex flex-wrap gap-2">
                        <Button asChild size="sm">
                          <Link href={`/coz?entry=${e.id}&mode=exam`}>
                            <PencilRuler /> Tekrar çöz
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/coz?entry=${e.id}&mode=full`}>
                            <PlayCircle /> Anlatımı izle
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => similar(e)} disabled={busyId === e.id}>
                          {busyId === e.id ? <Loader2 className="animate-spin" /> : <Sparkles />} Benzer soru
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Sil"
                          onClick={() => {
                            if (confirm("Bu soruyu defterden silmek istiyor musun?")) deleteEntry(e.id);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

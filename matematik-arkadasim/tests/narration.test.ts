import { describe, expect, it } from "vitest";
import { estimateDurationMs, splitSentences, type Scheduler, type SpeakOptions, type SpeechEngine } from "@/lib/speech/engine";
import { NarrationController } from "@/lib/speech/narrationController";

/** Elle sürülen sahte ses motoru: konuşmanın ne zaman bittiğine test karar verir. */
class FakeEngine implements SpeechEngine {
  readonly kind = "webspeech" as const;
  readonly label = "fake";
  spoken: string[] = [];
  current: SpeakOptions | null = null;
  cancels = 0;
  speak(text: string, o: SpeakOptions) {
    this.spoken.push(text);
    this.current = o;
  }
  cancel() {
    this.cancels++;
    this.current = null;
  }
  finish() {
    const c = this.current;
    this.current = null;
    c?.onEnd();
  }
}

class FakeScheduler implements Scheduler {
  q: { fn: () => void; id: number }[] = [];
  n = 0;
  setTimeout(fn: () => void) {
    const id = ++this.n;
    this.q.push({ fn, id });
    return id;
  }
  clearTimeout(h: unknown) {
    this.q = this.q.filter((x) => x.id !== h);
  }
  flush() {
    const q = this.q;
    this.q = [];
    q.forEach((x) => x.fn());
  }
}

function setup(narr = ["Birinci adım. İkinci cümle.", "İkinci adım: x² hesaplanır.", "Üçüncü adım."]) {
  const engine = new FakeEngine();
  const sched = new FakeScheduler();
  const c = new NarrationController(engine, { scheduler: sched, gapMs: 10 });
  c.load(narr);
  return { engine, sched, c };
}

describe("Adım bazlı seslendirme kuyruğu", () => {
  it("bir adımın sesi bitmeden sonraki adıma geçmez", () => {
    const { engine, sched, c } = setup();
    c.play();
    expect(c.getState().stepIndex).toBe(0);
    expect(engine.spoken).toEqual(["Birinci adım."]);
    sched.flush(); // zaman geçse de konuşma bitmedi
    expect(c.getState().stepIndex).toBe(0);
    engine.finish(); // ilk cümle bitti → ikinci cümle
    expect(engine.spoken.at(-1)).toBe("İkinci cümle.");
    expect(c.getState().chunkIndex).toBe(1);
    expect(c.getState().stepIndex).toBe(0);
    engine.finish(); // adım bitti → bekleme süresi
    expect(c.getState().stepIndex).toBe(0);
    sched.flush();
    expect(c.getState().stepIndex).toBe(1);
  });

  it("seslendirilen metinde matematik Türkçeye çevrilir", () => {
    const { engine, sched, c } = setup();
    c.goTo(1);
    c.play();
    expect(engine.spoken.at(-1)).toBe("İkinci adım: iksin karesi hesaplanır.");
    sched.flush();
  });

  it("her adım başında playToken artar (tahta animasyonu senkronu)", () => {
    const { engine, sched, c } = setup();
    c.play();
    const t0 = c.getState().playToken;
    engine.finish();
    engine.finish();
    sched.flush();
    expect(c.getState().playToken).toBe(t0 + 1);
  });

  it("duraklat / devam aynı cümleden sürer, eski olaylar yok sayılır", () => {
    const { engine, c } = setup();
    c.play();
    engine.finish();
    const stale = engine.current!;
    c.pause();
    expect(c.getState().status).toBe("paused");
    stale.onEnd(); // iptal edilmiş konuşmadan geç gelen olay
    expect(c.getState().chunkIndex).toBe(1);
    c.play();
    expect(engine.spoken.at(-1)).toBe("İkinci cümle.");
    expect(c.getState().status).toBe("playing");
  });

  it("ileri / geri / adımı tekrar / baştan anlat", () => {
    const { engine, c } = setup();
    c.next();
    expect(c.getState().stepIndex).toBe(1);
    expect(c.getState().status).toBe("paused");
    c.prev();
    expect(c.getState().stepIndex).toBe(0);
    c.goTo(2);
    c.play();
    expect(engine.spoken.at(-1)).toBe("Üçüncü adım.");
    c.repeatStep();
    expect(engine.spoken.at(-1)).toBe("Üçüncü adım.");
    c.restart();
    expect(c.getState().stepIndex).toBe(0);
    expect(engine.spoken.at(-1)).toBe("Birinci adım.");
  });

  it("son adımdan sonra 'finished', tekrar oynatınca baştan başlar", () => {
    const { engine, c } = setup(["Tek adım."]);
    c.play();
    engine.finish();
    expect(c.getState().status).toBe("finished");
    c.play();
    expect(c.getState().stepIndex).toBe(0);
    expect(c.getState().status).toBe("playing");
  });

  it("hız değişince mevcut cümle yeni hızla yeniden okunur", () => {
    const { engine, c } = setup();
    c.play();
    c.setRate(1.5);
    expect(engine.current?.rate).toBe(1.5);
    expect(engine.spoken).toEqual(["Birinci adım.", "Birinci adım."]);
  });

  it("öğrenciye soru sorulacak adımda bekler", () => {
    const { engine, sched, c } = setup();
    c.setShouldWaitAfterStep((i) => i === 0);
    c.play();
    engine.finish();
    engine.finish();
    sched.flush();
    expect(c.getState().status).toBe("waiting");
    expect(c.getState().stepIndex).toBe(0);
    c.play();
    expect(c.getState().stepIndex).toBe(1);
  });

  it("motor hatasında duraklar ve hatayı bildirir", () => {
    const { engine, c } = setup();
    c.play();
    engine.current!.onError("Ses yok");
    expect(c.getState().status).toBe("paused");
    expect(c.getState().lastError).toBe("Ses yok");
  });
});

describe("Cümle bölme ve süre tahmini", () => {
  it("cümlelere böler, çok uzunları virgülden keser", () => {
    expect(splitSentences("Bir. İki! Üç?")).toEqual(["Bir.", "İki!", "Üç?"]);
    const long = Array(40).fill("kelime,").join(" ");
    expect(splitSentences(long, 60).every((s) => s.length <= 60)).toBe(true);
  });
  it("hız arttıkça süre kısalır", () => {
    expect(estimateDurationMs("bir iki üç dört beş altı yedi sekiz", 1.5)).toBeLessThan(estimateDurationMs("bir iki üç dört beş altı yedi sekiz", 1));
  });
});

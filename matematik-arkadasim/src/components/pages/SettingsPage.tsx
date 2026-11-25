"use client";

import { Download, Play, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ParentSettings } from "@/components/common/ParentSettings";
import { ModeSelector } from "@/components/lesson/ModeSelector";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/useSettings";
import { useStatus } from "@/hooks/useStatus";
import { DEFAULT_SETTINGS } from "@/lib/client/settings";
import { chooseVoice, guessGender, loadTurkishVoices, ServerTtsEngine, speechSynthesisSupported, WebSpeechEngine } from "@/lib/speech/browserEngines";
import { RATES } from "@/lib/speech/narrationController";
import { textToSpeech } from "@/lib/speech/mathToSpeech";
import { clearAll, exportAll } from "@/lib/storage/db";
import { cn } from "@/lib/utils";

const SAMPLE = "Merhaba! Ben matematik arkadaşın. 2x + 5 = 15 denkleminde x'i bulalım. 3/5 ile x² gibi ifadeleri de böyle okurum.";

function Row({ title, desc, children, htmlFor }: { title: string; desc?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <label htmlFor={htmlFor} className="font-semibold">
          {title}
        </label>
        {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const [s, save] = useSettings();
  const status = useStatus();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[] | null>(null);
  // Sunucuda "desteklenmiyor" sanılmasın diye yalnızca tarayıcıda hesaplanır
  const ttsSupported = useSyncExternalStore(
    () => () => {},
    speechSynthesisSupported,
    () => true,
  );
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadTurkishVoices().then(setVoices);
  }, []);

  function testVoice() {
    setTesting(true);
    const text = textToSpeech(SAMPLE);
    const done = () => setTesting(false);
    const opts = { rate: s.rate, onEnd: done, onError: (e: string) => (setMessage(e), done()) };
    if (s.ttsEngine === "server" && status?.serverTts) return new ServerTtsEngine(s.voiceGender).speak(text, opts);
    const v = voices ? chooseVoice(voices, s.voiceName, s.voiceGender) : null;
    if (!v) {
      setMessage("Bu cihazda Türkçe tarayıcı sesi bulunamadı.");
      return done();
    }
    new WebSpeechEngine(v).speak(text, opts);
  }

  async function doExport() {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matematik-arkadasim-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function doClear() {
    if (!confirm("Soru defteri, gelişim verileri ve önbellek bu cihazdan kalıcı olarak silinecek. Emin misin?")) return;
    await clearAll();
    save({ ...DEFAULT_SETTINGS, theme: s.theme });
    setMessage("Tüm veriler silindi.");
  }

  const femaleCount = voices?.filter((v) => guessGender(v.name) === "female").length ?? 0;
  const maleCount = voices?.filter((v) => guessGender(v.name) === "male").length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Ayarlar</h1>
      {message && (
        <p className="rounded-xl bg-accent p-3 text-sm font-medium" role="status">
          {message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Görünüm</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <Row title="Tema" desc="Açık, koyu veya cihazın ayarı">
            <div className="w-48">
              <ThemeToggle />
            </div>
          </Row>
          <Row title="Takma ad (isteğe bağlı)" desc="Sadece selamlamada kullanılır, bu cihazdan çıkmaz. Gerçek adını yazmak zorunda değilsin." htmlFor="nick">
            <Input id="nick" value={s.nickname} maxLength={20} onChange={(e) => save({ nickname: e.target.value })} className="w-56" placeholder="ör. Matematik Kaşifi" />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sesli öğretmen</CardTitle>
          <CardDescription>
            {!ttsSupported
              ? "Bu tarayıcı sesli okumayı desteklemiyor."
              : voices === null
                ? "Sesler kontrol ediliyor…"
                : voices.length
                  ? `Cihazında ${voices.length} Türkçe ses bulundu${femaleCount || maleCount ? ` (${femaleCount} kadın, ${maleCount} erkek olarak tanındı)` : ""}.`
                  : "Cihazında Türkçe ses bulunamadı. Anlatım yazılı olarak devam eder. Telefonunun ayarlarından (Metin okuma / Konuşma) Türkçe ses paketini yükleyebilirsin."}
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <Row title="Sesli anlatım" desc="Kapalıyken anlatım yazılı olarak sürer">
            <Switch checked={s.voiceEnabled} onCheckedChange={(v) => save({ voiceEnabled: v })} aria-label="Sesli anlatım" />
          </Row>
          <Row title="Öğretmen sesi" desc="Cihazında varsa kadın veya erkek ses">
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="radiogroup" aria-label="Öğretmen sesi">
              {(["female", "male"] as const).map((g) => (
                <button key={g} role="radio" aria-checked={s.voiceGender === g} onClick={() => save({ voiceGender: g, voiceName: null })} className={cn("min-h-10 rounded-xl px-4 text-sm font-semibold", s.voiceGender === g ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>
                  {g === "female" ? "Kadın" : "Erkek"}
                </button>
              ))}
            </div>
          </Row>
          {voices && voices.length > 1 && (
            <Row title="Belirli bir ses seç" htmlFor="voice-select">
              <select id="voice-select" value={s.voiceName ?? ""} onChange={(e) => save({ voiceName: e.target.value || null })} className="h-11 w-56 rounded-2xl border-2 border-input bg-background px-3">
                <option value="">Otomatik</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Row>
          )}
          <Row title="Ses kaynağı" desc={status?.serverTts ? "Doğal ses sunucuda üretilir (internet gerekir)." : "Doğal sunucu sesi bu kurulumda yapılandırılmamış."}>
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="radiogroup" aria-label="Ses kaynağı">
              {(["browser", "server"] as const).map((e) => (
                <button
                  key={e}
                  role="radio"
                  aria-checked={s.ttsEngine === e}
                  disabled={e === "server" && !status?.serverTts}
                  onClick={() => save({ ttsEngine: e })}
                  className={cn("min-h-10 rounded-xl px-3 text-sm font-semibold disabled:opacity-40", s.ttsEngine === e ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}
                >
                  {e === "browser" ? "Tarayıcı" : "Doğal ses"}
                </button>
              ))}
            </div>
          </Row>
          <Row title="Konuşma hızı">
            <div className="flex gap-1" role="radiogroup" aria-label="Konuşma hızı">
              {RATES.map((r) => (
                <button key={r} role="radio" aria-checked={s.rate === r} onClick={() => save({ rate: r })} className={cn("min-h-10 rounded-xl px-3 text-sm font-bold", s.rate === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {String(r).replace(".", ",")}x
                </button>
              ))}
            </div>
          </Row>
          <Row title="Sesi dene">
            <Button variant="secondary" onClick={testVoice} disabled={testing || !s.voiceEnabled}>
              <Play /> {testing ? "Konuşuyor…" : "Örnek anlatımı dinle"}
            </Button>
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Öğrenme</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <div className="mb-2 font-semibold">Varsayılan öğrenme modu</div>
            <ModeSelector value={s.defaultMode} onChange={(m) => save({ defaultMode: m })} />
          </div>
          <div className="divide-y divide-border">
            <Row title="Çözülen soruları deftere otomatik kaydet" desc="Kapalıyken yalnızca “Deftere kaydet” dediğin sorular saklanır.">
              <Switch checked={s.autoSaveToNotebook} onCheckedChange={(v) => save({ autoSaveToNotebook: v })} aria-label="Otomatik kaydet" />
            </Row>
          </div>
        </CardContent>
      </Card>

      <ParentSettings status={status} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-success" /> Gizlilik ve veriler
          </CardTitle>
          <CardDescription>Üyelik yok. Kişisel bilgi istemiyoruz. Tüm kayıtlar yalnızca bu cihazda tutulur.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="divide-y divide-border">
            <Row title="Soru fotoğraflarını deftere kaydet" desc="Varsayılan olarak kapalı: fotoğraflar yalnızca çözüm için kullanılır, saklanmaz.">
              <Switch checked={s.savePhotos} onCheckedChange={(v) => save({ savePhotos: v })} aria-label="Fotoğrafları kaydet" />
            </Row>
            <Row title="Kamera ve mikrofon izinleri" desc="İzin açıklamasını tekrar görmek için sıfırla. Tarayıcı izinlerini tarayıcı ayarlarından yönetebilirsin.">
              <Button variant="outline" size="sm" onClick={() => save({ cameraConsent: false, micConsent: false })}>
                İzin onaylarını sıfırla
              </Button>
            </Row>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Ses kayıtları hiçbir zaman saklanmaz; yalnızca tanınan metin kullanılır.</li>
            <li>
              {status?.providerKind === "ollama"
                ? "Sorular ve fotoğraflar evdeki bilgisayarda çalışan ücretsiz yerel modelle (Ollama) çözülür; internete gönderilmez."
                : "Sorular yapay zekâ ile çözülürken yalnızca soru metni/fotoğrafı sunucu üzerinden yapay zekâ sağlayıcısına iletilir."}
            </li>
            <li>Yapay zekâ durumu: {status ? (status.mode === "demo" ? "Demo modu (bağlı değil)" : status.provider) : "Bilinmiyor (çevrimdışı olabilirsin)"}</li>
            {status && status.dailyLimitPerClient > 0 && <li>Günlük yapay zekâ soru sınırı: {status.dailyLimitPerClient}</li>}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild variant="ghost">
              <Link href="/gizlilik">Gizlilik bilgilendirmesi</Link>
            </Button>
            <Button variant="outline" onClick={doExport}>
              <Download /> Verilerimi indir
            </Button>
            <Button variant="destructive" onClick={doClear}>
              <Trash2 /> Tüm verilerimi sil
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import katex from "katex";
import { memo, useMemo } from "react";
import type { ColorName, Highlight } from "@/lib/schema/solution";
import { cn } from "@/lib/utils";

/**
 * KaTeX ile güvenli matematik gösterimi.
 * - trust: false → \href, \htmlClass gibi komutlar çalışmaz; YZ'nin LaTeX'i HTML/JS üretemez.
 * - Vurgular, yer tutucu renklerle (\textcolor) işaretlenir ve çıktıda tema değişkenlerine çevrilir;
 *   böylece açık/koyu temada erişilebilir kontrast korunur.
 */

const PLACEHOLDER: Record<ColorName, string> = {
  blue: "#010101",
  purple: "#010102",
  green: "#010103",
  orange: "#010104",
  red: "#010105",
  pink: "#010106",
  teal: "#010107",
  gray: "#010108",
};

const ESCAPE = /[.*+?^${}()|[\]\\]/g;

/** Vurgulanacak parçayı LaTeX içinde güvenli biçimde (sayıların/komutların ortasını bölmeden) renklendirir. */
export function applyHighlights(latex: string, highlights: Pick<Highlight, "value" | "color">[]): string {
  let out = latex;
  for (const h of highlights) {
    const value = h.value.trim();
    if (!value || value.length > 40) continue;
    const re = new RegExp(`(?<![0-9A-Za-z\\\\.,])${value.replace(ESCAPE, "\\$&")}(?![0-9A-Za-z,.])`);
    if (!re.test(out)) continue;
    out = out.replace(re, (m) => `\\textcolor{${PLACEHOLDER[h.color] ?? PLACEHOLDER.blue}}{${m}}`);
  }
  return out;
}

export function renderLatex(latex: string, displayMode = false): { html: string; ok: boolean } {
  try {
    let html = katex.renderToString(latex, {
      displayMode,
      throwOnError: true,
      trust: false,
      strict: "ignore",
      maxSize: 20,
      maxExpand: 300,
      output: "htmlAndMathml",
    });
    for (const [name, hex] of Object.entries(PLACEHOLDER)) {
      html = html.split(`color:${hex}`).join(`color:hsl(var(--math-${name}));font-weight:700`);
    }
    return { html, ok: true };
  } catch {
    return { html: "", ok: false };
  }
}

interface Props {
  latex: string;
  display?: boolean;
  highlights?: Pick<Highlight, "value" | "color">[];
  className?: string;
  /** Tahtaya yazılıyormuş gibi soldan sağa açılma animasyonu */
  animate?: boolean;
  ariaLabel?: string;
}

export const MathTex = memo(function MathTex({ latex, display = false, highlights = [], className, animate, ariaLabel }: Props) {
  const { html, ok } = useMemo(() => {
    const withHl = highlights.length ? applyHighlights(latex, highlights) : latex;
    const r = renderLatex(withHl, display);
    return r.ok ? r : renderLatex(latex, display);
  }, [latex, display, highlights]);

  if (!ok) {
    // Hatalı LaTeX: ham metni düz metin olarak göster (HTML olarak değil)
    return <code className={cn("rounded bg-muted px-2 py-1 text-sm", className)}>{latex}</code>;
  }
  return (
    <span
      role={ariaLabel ? "math" : undefined}
      aria-label={ariaLabel}
      className={cn("katex-host inline-block max-w-full", animate && "animate-write", className)}
      // KaTeX çıktısı trust:false ile üretilir; YZ girdisinden HTML/JS çalıştırılamaz.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

/** Metin içindeki $...$ parçalarını KaTeX ile, kalanını düz metin olarak gösterir. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => text.split(/(\$[^$]+\$)/g), [text]);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.startsWith("$") && p.endsWith("$") && p.length > 2 ? <MathTex key={i} latex={p.slice(1, -1)} /> : <span key={i}>{p}</span>,
      )}
    </span>
  );
}

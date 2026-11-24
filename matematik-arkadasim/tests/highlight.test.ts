import { describe, expect, it } from "vitest";
import { applyHighlights, renderLatex } from "@/components/math/MathTex";

describe("KaTeX güvenliği ve vurgulama", () => {
  it("sayının ortasını vurgulamaz (15 içindeki 5)", () => {
    expect(applyHighlights("15 - 5 = 10", [{ value: "5", color: "orange" }])).toBe("15 - \\textcolor{#010104}{5} = 10");
  });
  it("kesir içini vurgulayabilir", () => {
    expect(applyHighlights("\\frac{11}{12}", [{ value: "12", color: "orange" }])).toBe("\\frac{11}{\\textcolor{#010104}{12}}");
  });
  it("vurgu rengi tema değişkenine çevrilir", () => {
    const { html, ok } = renderLatex(applyHighlights("x + 2", [{ value: "2", color: "green" }]));
    expect(ok).toBe(true);
    expect(html).toContain("hsl(var(--math-green))");
  });
  it("trust:false — \\href ve \\htmlClass çalıştırılmaz", () => {
    const { html } = renderLatex("\\href{javascript:alert(1)}{x}");
    expect(html).not.toMatch(/href="javascript/);
    const r2 = renderLatex("\\htmlClass{evil}{x}");
    expect(r2.html).not.toContain('class="evil"');
  });
  it("bozuk LaTeX'te ok=false döner (çökmez)", () => expect(renderLatex("\\frac{1}{").ok).toBe(false));
});

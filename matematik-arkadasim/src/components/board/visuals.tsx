"use client";

import { MathTex } from "@/components/math/MathTex";
import type { ColorName, VisualInstruction } from "@/lib/schema/solution";
import { cn } from "@/lib/utils";

/**
 * Akıllı tahta görselleştirmeleri. Tamamı doğrulanmış şema verisinden SVG olarak çizilir;
 * YZ'den gelen hiçbir işaretleme doğrudan DOM'a eklenmez.
 */

const C = (c: ColorName | undefined, fallback: ColorName = "purple") => `hsl(var(--math-${c ?? fallback}))`;
const CF = (c: ColorName | undefined, fallback: ColorName = "purple", a = 0.22) => `hsl(var(--math-${c ?? fallback}) / ${a})`;
const INK = "hsl(var(--board-foreground))";
const SOFT = "hsl(var(--board-foreground) / 0.35)";

function Frame({ children, caption, className }: { children: React.ReactNode; caption?: string; className?: string }) {
  return (
    <figure className={cn("animate-rise-in rounded-2xl border border-border/60 bg-card/80 p-3", className)}>
      {children}
      {caption && <figcaption className="mt-2 text-center text-sm font-medium text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace(".", ",");
}

/* ───── Kesir şeritleri ───── */
function FractionBars({ v }: { v: Extract<VisualInstruction, { type: "fractionBars" }> }) {
  const W = 320;
  const H = 34;
  return (
    <Frame>
      <div className="flex flex-col gap-3">
        {v.bars.map((b, bi) => {
          const parts = Math.max(1, b.denominator);
          const wholes = Math.max(1, Math.ceil(b.numerator / parts));
          return (
            <div key={bi}>
              {b.label && <div className="mb-1 text-sm font-semibold" style={{ color: C(b.color) }}>{b.label}</div>}
              <div className="flex flex-col gap-1">
                {Array.from({ length: wholes }).map((_, wi) => (
                  <svg key={wi} viewBox={`0 0 ${W} ${H}`} className="h-9 w-full max-w-md" role="img" aria-label={`${b.numerator}/${b.denominator} kesir şeridi`}>
                    {Array.from({ length: parts }).map((__, i) => {
                      const idx = wi * parts + i;
                      const filled = idx < b.numerator;
                      return (
                        <rect
                          key={i}
                          x={(i * W) / parts + 1}
                          y={1}
                          width={W / parts - 2}
                          height={H - 2}
                          rx={5}
                          fill={filled ? CF(b.color, "purple", 0.75) : "transparent"}
                          stroke={filled ? C(b.color) : SOFT}
                          strokeWidth={1.6}
                          style={{ animation: `fade-in .3s ease-out ${idx * 0.06}s both` }}
                        />
                      );
                    })}
                  </svg>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

/* ───── Kesir pastası ───── */
function FractionPie({ v }: { v: Extract<VisualInstruction, { type: "fractionPie" }> }) {
  const r = 70;
  const cx = 80;
  const cy = 80;
  const n = v.denominator;
  const wholes = Math.max(1, Math.ceil(v.numerator / n));
  return (
    <Frame caption={v.label}>
      <div className="flex flex-wrap justify-center gap-3">
        {Array.from({ length: wholes }).map((_, w) => (
          <svg key={w} viewBox="0 0 160 160" className="h-36 w-36" role="img" aria-label={`${v.numerator}/${v.denominator} pasta modeli`}>
            {Array.from({ length: n }).map((__, i) => {
              const a0 = (i / n) * 2 * Math.PI - Math.PI / 2;
              const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
              const filled = w * n + i < v.numerator;
              const large = a1 - a0 > Math.PI ? 1 : 0;
              const d = n === 1
                ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
                : `M ${cx} ${cy} L ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`;
              return <path key={i} d={d} fill={filled ? CF(v.color, "orange", 0.75) : "transparent"} stroke={filled ? C(v.color, "orange") : SOFT} strokeWidth={1.8} style={{ animation: `fade-in .3s ease-out ${i * 0.07}s both` }} />;
            })}
          </svg>
        ))}
      </div>
    </Frame>
  );
}

/* ───── Yüzde ızgarası ───── */
function PercentGrid({ v }: { v: Extract<VisualInstruction, { type: "percentGrid" }> }) {
  const cells = Array.from({ length: 100 });
  const filled = Math.round(v.percent);
  return (
    <Frame caption={v.label ?? `%${fmt(v.percent)}`}>
      <svg viewBox="0 0 202 202" className="mx-auto h-44 w-44" role="img" aria-label={`Yüzde ${fmt(v.percent)} ızgarası`}>
        {cells.map((_, i) => {
          const row = Math.floor(i / 10);
          const col = i % 10;
          const on = i < filled;
          return <rect key={i} x={1 + col * 20} y={1 + row * 20} width={18} height={18} rx={3} fill={on ? CF(v.color, "teal", 0.8) : "transparent"} stroke={on ? C(v.color, "teal") : SOFT} strokeWidth={1} style={on ? { animation: `fade-in .2s ease-out ${i * 0.012}s both` } : undefined} />;
        })}
      </svg>
    </Frame>
  );
}

/* ───── Sayı doğrusu ───── */
function NumberLine({ v }: { v: Extract<VisualInstruction, { type: "numberLine" }> }) {
  let min = Math.min(v.min, v.max);
  let max = Math.max(v.min, v.max);
  if (max - min < 1e-9) {
    min -= 1;
    max += 1;
  }
  const W = 560;
  const pad = 30;
  const y = 78;
  const x = (val: number) => pad + ((val - min) / (max - min)) * (W - 2 * pad);
  let step = v.step ?? 1;
  if ((max - min) / step > 24) step = Math.ceil((max - min) / 20);
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return (
    <Frame>
      <svg viewBox={`0 0 ${W} 120`} className="w-full" role="img" aria-label={`${fmt(min)} ile ${fmt(max)} arası sayı doğrusu`}>
        <defs>
          <marker id="nl-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={INK} />
          </marker>
          <marker id="nl-jump" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill={C("orange")} />
          </marker>
        </defs>
        <line x1={8} y1={y} x2={W - 8} y2={y} stroke={INK} strokeWidth={2} markerEnd="url(#nl-arrow)" markerStart="url(#nl-arrow)" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={y - 7} x2={x(t)} y2={y + 7} stroke={INK} strokeWidth={t === 0 ? 2.5 : 1.5} />
            <text x={x(t)} y={y + 26} textAnchor="middle" fontSize={14} fill={INK} fontWeight={t === 0 ? 700 : 400}>
              {fmt(t)}
            </text>
          </g>
        ))}
        {v.jumps.map((j, i) => {
          const x1 = x(j.from);
          const x2 = x(j.to);
          const h = Math.min(46, 16 + Math.abs(x2 - x1) / 4);
          const len = Math.abs(x2 - x1) * 1.3 + 40;
          return (
            <g key={i}>
              <path
                d={`M ${x1} ${y - 8} Q ${(x1 + x2) / 2} ${y - 8 - h * 2} ${x2} ${y - 8}`}
                fill="none"
                stroke={C(j.color, "orange")}
                strokeWidth={2.5}
                markerEnd="url(#nl-jump)"
                strokeDasharray={len}
                style={{ ["--len" as string]: len, animation: `draw 1s ease-out ${0.3 + i * 0.5}s both` }}
              />
              {j.label && (
                <text x={(x1 + x2) / 2} y={y - 14 - h} textAnchor="middle" fontSize={15} fontWeight={700} fill={C(j.color, "orange")}>
                  {j.label}
                </text>
              )}
            </g>
          );
        })}
        {v.points.map((p, i) => (
          <g key={i} style={{ animation: `fade-in .35s ease-out ${0.2 + i * 0.25}s both` }}>
            <circle cx={x(p.value)} cy={y} r={7} fill={C(p.color, "blue")} stroke="hsl(var(--card))" strokeWidth={2} />
            {p.label && (
              <text x={x(p.value)} y={y + 46} textAnchor="middle" fontSize={14} fontWeight={700} fill={C(p.color, "blue")}>
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </Frame>
  );
}

/* ───── Geometri ───── */
function Geometry({ v }: { v: Extract<VisualInstruction, { type: "geometry" }> }) {
  const S = 3.2; // 0-100 → 320
  const pts = new Map(v.points.map((p) => [p.id, p]));
  const P = (id: string) => pts.get(id);
  const cx = v.points.reduce((s, p) => s + p.x, 0) / v.points.length;
  const cy = v.points.reduce((s, p) => s + p.y, 0) / v.points.length;
  const fillPts = v.fill?.map(P).filter(Boolean) as { x: number; y: number }[] | undefined;
  return (
    <Frame caption={v.caption}>
      <svg viewBox="-24 -24 368 368" className="mx-auto w-full max-w-sm" role="img" aria-label={v.caption ?? "Geometrik şekil"}>
        {fillPts && fillPts.length >= 3 && (
          <polygon points={fillPts.map((p) => `${p.x * S},${p.y * S}`).join(" ")} fill={CF("purple", "purple", 0.12)} style={{ animation: "fade-in .6s ease-out .9s both" }} />
        )}
        {v.circles.map((c, i) => {
          const ctr = P(c.center);
          if (!ctr) return null;
          const len = 2 * Math.PI * c.radius * S;
          return (
            <g key={`c${i}`}>
              <circle cx={ctr.x * S} cy={ctr.y * S} r={c.radius * S} fill={CF(c.color, "purple", 0.1)} stroke={C(c.color)} strokeWidth={2.5} strokeDasharray={len} style={{ ["--len" as string]: len, animation: "draw 1.4s ease-out both" }} />
              {c.label && (
                <text x={ctr.x * S} y={(ctr.y - c.radius) * S - 8} textAnchor="middle" fontSize={15} fill={C(c.color)} fontWeight={700}>
                  {c.label}
                </text>
              )}
            </g>
          );
        })}
        {v.segments.map((s, i) => {
          const a = P(s.from);
          const b = P(s.to);
          if (!a || !b) return null;
          const len = Math.hypot(b.x - a.x, b.y - a.y) * S;
          const mx = ((a.x + b.x) / 2) * S;
          const my = ((a.y + b.y) / 2) * S;
          // etiketi şeklin dışına doğru it
          const dx = (a.x + b.x) / 2 - cx;
          const dy = (a.y + b.y) / 2 - cy;
          const dl = Math.hypot(dx, dy) || 1;
          return (
            <g key={`s${i}`}>
              <line
                x1={a.x * S}
                y1={a.y * S}
                x2={b.x * S}
                y2={b.y * S}
                stroke={s.color ? C(s.color) : INK}
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeDasharray={s.dashed ? "8 6" : len}
                style={s.dashed ? { animation: "fade-in .5s ease-out both" } : { ["--len" as string]: len, animation: `draw .8s ease-out ${i * 0.25}s both` }}
              />
              {s.label && (
                <text x={mx + (dx / dl) * 18} y={my + (dy / dl) * 18 + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill={s.color ? C(s.color) : C("blue")}>
                  {s.label}
                </text>
              )}
            </g>
          );
        })}
        {v.angles.map((ang, i) => {
          const at = P(ang.at);
          const f = P(ang.from);
          const t = P(ang.to);
          if (!at || !f || !t) return null;
          const a1 = Math.atan2(f.y - at.y, f.x - at.x);
          const a2 = Math.atan2(t.y - at.y, t.x - at.x);
          let delta = a2 - a1;
          while (delta <= -Math.PI) delta += 2 * Math.PI;
          while (delta > Math.PI) delta -= 2 * Math.PI;
          const r = 26;
          const X = at.x * S;
          const Y = at.y * S;
          const mid = a1 + delta / 2;
          if (ang.right) {
            const u = [Math.cos(a1) * 16, Math.sin(a1) * 16];
            const w = [Math.cos(a2) * 16, Math.sin(a2) * 16];
            return <path key={`a${i}`} d={`M ${X + u[0]} ${Y + u[1]} L ${X + u[0] + w[0]} ${Y + u[1] + w[1]} L ${X + w[0]} ${Y + w[1]}`} fill="none" stroke={C(ang.color, "red")} strokeWidth={2} style={{ animation: "fade-in .4s ease-out 1s both" }} />;
          }
          const sx = X + r * Math.cos(a1);
          const sy = Y + r * Math.sin(a1);
          const ex = X + r * Math.cos(a1 + delta);
          const ey = Y + r * Math.sin(a1 + delta);
          return (
            <g key={`a${i}`} style={{ animation: `fade-in .4s ease-out ${0.9 + i * 0.2}s both` }}>
              <path d={`M ${X} ${Y} L ${sx} ${sy} A ${r} ${r} 0 0 ${delta > 0 ? 1 : 0} ${ex} ${ey} Z`} fill={CF(ang.color, "orange", 0.25)} stroke={C(ang.color, "orange")} strokeWidth={2} />
              {ang.label && (
                <text x={X + (r + 20) * Math.cos(mid)} y={Y + (r + 20) * Math.sin(mid) + 5} textAnchor="middle" fontSize={15} fontWeight={800} fill={C(ang.color, "orange")}>
                  {ang.label}
                </text>
              )}
            </g>
          );
        })}
        {v.points.map((p) => {
          const dx = p.x - cx;
          const dy = p.y - cy;
          const dl = Math.hypot(dx, dy) || 1;
          return (
            <g key={p.id}>
              <circle cx={p.x * S} cy={p.y * S} r={4} fill={INK} />
              <text x={p.x * S + (dx / dl) * 18} y={p.y * S + (dy / dl) * 18 + 6} textAnchor="middle" fontSize={17} fontWeight={800} fill={INK}>
                {p.label ?? p.id}
              </text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

/* ───── Tablo ───── */
function TableVisual({ v }: { v: Extract<VisualInstruction, { type: "table" }> }) {
  const hl = new Set((v.highlight ?? []).map((h) => `${h.row}:${h.col}`));
  return (
    <Frame caption={v.caption}>
      <div className="overflow-x-auto">
        <table className="mx-auto min-w-[60%] border-collapse text-center text-base">
          <thead>
            <tr>
              {v.headers.map((h, i) => (
                <th key={i} className="border-2 border-border bg-accent px-4 py-2 font-bold text-accent-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {v.rows.map((r, ri) => (
              <tr key={ri} style={{ animation: `fade-in .3s ease-out ${ri * 0.15}s both` }}>
                {r.map((c, ci) => (
                  <td key={ci} className={cn("border-2 border-border px-4 py-2 font-medium", hl.has(`${ri}:${ci}`) && "bg-warning/20 font-extrabold")}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Frame>
  );
}

/* ───── Sütun grafiği ───── */
function BarChart({ v }: { v: Extract<VisualInstruction, { type: "barChart" }> }) {
  const max = Math.max(...v.bars.map((b) => b.value), 1);
  const W = 360;
  const H = 200;
  const bw = (W - 40) / v.bars.length;
  const palette: ColorName[] = ["blue", "purple", "green", "orange", "teal", "pink"];
  return (
    <Frame caption={v.title}>
      <svg viewBox={`0 0 ${W} ${H + 40}`} className="mx-auto w-full max-w-md" role="img" aria-label={v.title ?? "Sütun grafiği"}>
        <line x1={30} y1={H} x2={W - 5} y2={H} stroke={INK} strokeWidth={1.5} />
        {v.bars.map((b, i) => {
          const h = Math.max(0, (b.value / max) * (H - 30));
          const x = 36 + i * bw;
          const color = b.color ?? palette[i % palette.length];
          return (
            <g key={i}>
              <rect x={x + bw * 0.15} y={H - h} width={bw * 0.7} height={h} rx={6} fill={CF(color, "blue", 0.8)} stroke={C(color)} style={{ transformOrigin: `0 ${H}px`, animation: `fade-in .5s ease-out ${i * 0.15}s both` }} />
              <text x={x + bw / 2} y={H - h - 6} textAnchor="middle" fontSize={13} fontWeight={700} fill={INK}>
                {fmt(b.value)}
                {v.unit ? ` ${v.unit}` : ""}
              </text>
              <text x={x + bw / 2} y={H + 18} textAnchor="middle" fontSize={13} fill={INK}>
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

/* ───── Çizgi grafiği (doğru orantı) ───── */
function LineGraph({ v }: { v: Extract<VisualInstruction, { type: "lineGraph" }> }) {
  const W = 340;
  const H = 220;
  const pad = 36;
  const xs = v.points.map((p) => p.x);
  const ys = v.points.map((p) => p.y);
  const xMax = Math.max(...xs, 1);
  const yMax = Math.max(...ys, 1);
  const xMin = Math.min(0, ...xs);
  const yMin = Math.min(0, ...ys);
  const X = (x: number) => pad + ((x - xMin) / (xMax - xMin || 1)) * (W - pad - 14);
  const Y = (y: number) => H - pad - ((y - yMin) / (yMax - yMin || 1)) * (H - pad - 14);
  const sorted = [...v.points].sort((a, b) => a.x - b.x);
  const path = sorted.map((p, i) => `${i ? "L" : "M"} ${X(p.x)} ${Y(p.y)}`).join(" ");
  return (
    <Frame>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-md" role="img" aria-label="Grafik">
        <line x1={pad} y1={H - pad} x2={W - 8} y2={H - pad} stroke={INK} strokeWidth={1.5} />
        <line x1={pad} y1={H - pad} x2={pad} y2={8} stroke={INK} strokeWidth={1.5} />
        {v.xLabel && <text x={W - 10} y={H - 10} textAnchor="end" fontSize={13} fill={INK}>{v.xLabel}</text>}
        {v.yLabel && <text x={pad + 6} y={16} fontSize={13} fill={INK}>{v.yLabel}</text>}
        {v.connect && <path d={path} fill="none" stroke={C("purple")} strokeWidth={2.5} strokeDasharray={800} style={{ ["--len" as string]: 800, animation: "draw 1.4s ease-out both" }} />}
        {sorted.map((p, i) => (
          <g key={i} style={{ animation: `fade-in .3s ease-out ${0.3 + i * 0.2}s both` }}>
            <line x1={X(p.x)} y1={Y(p.y)} x2={X(p.x)} y2={H - pad} stroke={SOFT} strokeDasharray="4 4" />
            <line x1={pad} y1={Y(p.y)} x2={X(p.x)} y2={Y(p.y)} stroke={SOFT} strokeDasharray="4 4" />
            <circle cx={X(p.x)} cy={Y(p.y)} r={5} fill={C("blue")} />
            <text x={X(p.x)} y={H - pad + 16} textAnchor="middle" fontSize={12} fill={INK}>{fmt(p.x)}</text>
            <text x={pad - 6} y={Y(p.y) + 4} textAnchor="end" fontSize={12} fill={INK}>{fmt(p.y)}</text>
            {p.label && <text x={X(p.x) + 8} y={Y(p.y) - 8} fontSize={13} fontWeight={700} fill={C("blue")}>{p.label}</text>}
          </g>
        ))}
      </svg>
    </Frame>
  );
}

/* ───── Dönüşüm oku ───── */
function Transform({ v }: { v: Extract<VisualInstruction, { type: "transform" }> }) {
  return (
    <Frame>
      <div className="flex flex-col items-center gap-1 py-1 text-board-foreground">
        <MathTex latex={v.before} />
        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: C("orange") }}>
          <svg viewBox="0 0 24 40" className="h-9 w-6" aria-hidden>
            <path d="M12 2 V34 M4 26 L12 36 L20 26" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={60} style={{ ["--len" as string]: 60, animation: "draw .7s ease-out .2s both" }} />
          </svg>
          {v.label}
        </div>
        <div style={{ animation: "fade-in .4s ease-out .8s both" }}>
          <MathTex latex={v.after} className="katex-host-lg" />
        </div>
      </div>
    </Frame>
  );
}

/* ───── Terazi ───── */
function Balance({ v }: { v: Extract<VisualInstruction, { type: "balance" }> }) {
  return (
    <Frame caption={v.label}>
      <div className="relative mx-auto max-w-md">
        <svg viewBox="0 0 320 150" className="w-full" aria-hidden>
          <path d="M160 40 L140 140 L180 140 Z" fill={CF("gray", "gray", 0.4)} stroke={INK} strokeWidth={2} />
          <line x1={30} y1={40} x2={290} y2={40} stroke={INK} strokeWidth={4} strokeLinecap="round" />
          <circle cx={160} cy={40} r={6} fill={INK} />
          <line x1={60} y1={40} x2={60} y2={70} stroke={SOFT} strokeWidth={2} />
          <line x1={260} y1={40} x2={260} y2={70} stroke={SOFT} strokeWidth={2} />
          <path d="M15 70 Q60 100 105 70 Z" fill={CF("purple", "purple", 0.25)} stroke={C("purple")} strokeWidth={2} />
          <path d="M215 70 Q260 100 305 70 Z" fill={CF("blue", "blue", 0.25)} stroke={C("blue")} strokeWidth={2} />
        </svg>
        <div className="absolute left-0 top-[12%] flex w-[36%] justify-center text-board-foreground">
          <MathTex latex={v.left} />
        </div>
        <div className="absolute right-0 top-[12%] flex w-[36%] justify-center text-board-foreground">
          <MathTex latex={v.right} />
        </div>
      </div>
    </Frame>
  );
}

/* ───── Kural kutusu ───── */
function RuleBox({ v }: { v: Extract<VisualInstruction, { type: "rule" }> }) {
  return (
    <div className="animate-rise-in rounded-2xl border-2 border-dashed p-4" style={{ borderColor: C("purple"), background: CF("purple", "purple", 0.08) }}>
      <div className="mb-1 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide" style={{ color: C("purple") }}>
        <span aria-hidden>💡</span> {v.title ?? "Önemli kural"}
      </div>
      <p className="text-base leading-relaxed">{v.text}</p>
      {v.latex && (
        <div className="mt-2 text-center">
          <MathTex latex={v.latex} />
        </div>
      )}
    </div>
  );
}

export function Visual({ v }: { v: VisualInstruction }) {
  switch (v.type) {
    case "fractionBars":
      return <FractionBars v={v} />;
    case "fractionPie":
      return <FractionPie v={v} />;
    case "percentGrid":
      return <PercentGrid v={v} />;
    case "numberLine":
      return <NumberLine v={v} />;
    case "geometry":
      return <Geometry v={v} />;
    case "table":
      return <TableVisual v={v} />;
    case "barChart":
      return <BarChart v={v} />;
    case "lineGraph":
      return <LineGraph v={v} />;
    case "transform":
      return <Transform v={v} />;
    case "balance":
      return <Balance v={v} />;
    case "rule":
      return <RuleBox v={v} />;
  }
}

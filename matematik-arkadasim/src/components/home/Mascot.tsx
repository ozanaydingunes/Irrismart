"use client";

import { useId } from "react";

/**
 * "Pi Hoca": uygulamaya özgün, gözlüklü baykuş öğretmen maskotu (SVG, harici görsel yok).
 * Dekoratiftir; ekran okuyuculardan gizlenir.
 */
export function Mascot({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <linearGradient id={`body-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9b7cf4" />
          <stop offset="1" stopColor="#6d4ed8" />
        </linearGradient>
      </defs>
      {/* gölge */}
      <ellipse cx="60" cy="112" rx="30" ry="5" fill="#000" opacity="0.08" />
      {/* gövde */}
      <path d="M28 58c0-22 14-36 32-36s32 14 32 36v26c0 16-14 26-32 26S28 100 28 84z" fill={`url(#body-${id})`} />
      {/* kulak tüyleri */}
      <path d="M34 34l-4-14 14 8zM86 34l4-14-14 8z" fill="#6d4ed8" />
      {/* karın */}
      <ellipse cx="60" cy="84" rx="20" ry="18" fill="#efe9ff" />
      <path d="M50 78q5 4 10 0q5 4 10 0M50 88q5 4 10 0q5 4 10 0" stroke="#c9bbf7" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* gözler + gözlük */}
      <circle cx="46" cy="52" r="12" fill="#fff" />
      <circle cx="74" cy="52" r="12" fill="#fff" />
      <circle cx="48" cy="53" r="5" fill="#2a1f55" />
      <circle cx="72" cy="53" r="5" fill="#2a1f55" />
      <circle cx="49.5" cy="51.5" r="1.6" fill="#fff" />
      <circle cx="73.5" cy="51.5" r="1.6" fill="#fff" />
      <circle cx="46" cy="52" r="13" fill="none" stroke="#2a1f55" strokeWidth="2.5" />
      <circle cx="74" cy="52" r="13" fill="none" stroke="#2a1f55" strokeWidth="2.5" />
      <path d="M59 52h2" stroke="#2a1f55" strokeWidth="2.5" />
      {/* gaga */}
      <path d="M56 63l4 6 4-6z" fill="#f5a524" />
      {/* kanat + tebeşir */}
      <path d="M88 70c8 2 12 10 10 18-6-2-11-7-12-14z" fill="#5a3fc4" />
      <rect x="95" y="62" width="4" height="14" rx="1.5" fill="#fff" stroke="#c9bbf7" transform="rotate(25 97 69)" />
      {/* kep */}
      <path d="M36 27l24-10 24 10-24 10z" fill="#2a1f55" />
      <path d="M48 31v7c4 3 20 3 24 0v-7" fill="#2a1f55" />
      <path d="M84 27v12" stroke="#f5a524" strokeWidth="2" />
      <circle cx="84" cy="40" r="2.5" fill="#f5a524" />
    </svg>
  );
}

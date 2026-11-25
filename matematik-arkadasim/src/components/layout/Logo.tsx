"use client";

import { useId } from "react";

export function Logo({ className }: { className?: string }) {
  // Her kopyaya benzersiz degrade kimliği: gizli (display:none) bir kopyadaki tanım diğerini bozmasın
  const gid = `lg-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d4ed8" />
          <stop offset="1" stopColor="#3f6fd8" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill={`url(#${gid})`} />
      <path d="M17 22h12M23 16v12" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M36 22h12" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M18 40l10 10M28 40L18 50" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M36 42h12M36 49h12" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

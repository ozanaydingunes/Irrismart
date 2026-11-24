import type { Metadata } from "next";
import { Suspense } from "react";
import { SolvePage } from "@/components/pages/SolvePage";

export const metadata: Metadata = { title: "Soru Çöz" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SolvePage />
    </Suspense>
  );
}

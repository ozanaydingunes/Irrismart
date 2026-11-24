import type { Metadata } from "next";
import { Suspense } from "react";
import { NotebookPage } from "@/components/pages/NotebookPage";

export const metadata: Metadata = { title: "Soru Defterim" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NotebookPage />
    </Suspense>
  );
}

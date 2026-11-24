import type { Metadata } from "next";
import { ProgressPage } from "@/components/pages/ProgressPage";

export const metadata: Metadata = { title: "Gelişimim" };

export default function Page() {
  return <ProgressPage />;
}

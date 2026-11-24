import type { Metadata } from "next";
import { TopicsPage } from "@/components/pages/TopicsPage";

export const metadata: Metadata = { title: "Konular" };

export default function Page() {
  return <TopicsPage />;
}

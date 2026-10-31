import type { Metadata } from "next";
import { HomeApp } from "@/components/home/HomeApp";

export const metadata: Metadata = {
  title: "Nara — Home Rescue",
  description: "Report a problem; Nara diagnoses it from your home's twin and books the repair.",
};

export default function HomePage() {
  return <HomeApp />;
}

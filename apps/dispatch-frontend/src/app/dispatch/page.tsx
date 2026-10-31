import type { Metadata } from "next";
import { DispatchApp } from "@/components/dispatch/DispatchApp";

export const metadata: Metadata = {
  title: "Nara Capacity — Cool Air Mechanical",
  description:
    "Publish technician openings you want Nara to fill. Internal dispatch stays private.",
};

export default function DispatchPage() {
  return <DispatchApp />;
}

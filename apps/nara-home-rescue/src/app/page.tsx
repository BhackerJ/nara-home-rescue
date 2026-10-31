import { RescueDemo } from "@/components/RescueDemo";
import { dataMode, type DataMode } from "@/data/adapters";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return <RescueDemo mode={await screenMode(dataMode(mode))} />;
}

/** Live mode needs the dispatch API on :3100. If it is down, show the presenter instead of polling a closed port. */
async function screenMode(selected: DataMode): Promise<DataMode> {
  if (selected === "mock") return "mock";
  try {
    const response = await fetch("http://127.0.0.1:3100/api/cases", {
      cache: "no-store",
      signal: AbortSignal.timeout(800),
    });
    return response.ok ? "backend" : "mock";
  } catch {
    return "mock";
  }
}

import { RescueDemo } from "@/components/RescueDemo";
import { dataMode } from "@/data/adapters";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return <RescueDemo mode={dataMode(mode)} />;
}

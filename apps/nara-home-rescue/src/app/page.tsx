import { RescueDemo } from "@/components/RescueDemo";
import { dataMode, inspectBackend } from "@/data/adapters";

export default function Home() {
  const mode = dataMode();
  return <RescueDemo mode={mode} backend={inspectBackend()} />;
}

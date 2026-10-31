export type DataMode = "mock" | "backend";

/**
 * `?mode=` wins, then NEXT_PUBLIC_NARA_DATA_SOURCE. The default is the presenter UI
 * ("mock" screens, turned by hand, with the live agent log and LLM text beside them);
 * `live` or `backend` opens the plain three-pane live view.
 */
export function dataMode(override?: string): DataMode {
  const value = override ?? process.env.NEXT_PUBLIC_NARA_DATA_SOURCE;
  return value === "live" || value === "backend" ? "backend" : "mock";
}

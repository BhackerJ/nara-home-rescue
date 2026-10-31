export type DataMode = "mock" | "backend";

/** `?mode=mock` wins, then NEXT_PUBLIC_NARA_DATA_SOURCE. The live backend is the default. */
export function dataMode(override?: string): DataMode {
  const value = override ?? process.env.NEXT_PUBLIC_NARA_DATA_SOURCE;
  return value === "mock" ? "mock" : "backend";
}

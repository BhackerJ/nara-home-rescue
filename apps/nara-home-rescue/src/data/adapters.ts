export type DataMode = "mock" | "backend";

export type BackendInspection = {
  mode: "backend";
  connected: false;
  actorPresent: "Smoke";
  missing: string[];
};

/** Documented in design notes. Not implemented in this repository. */
const DOCUMENTED_BUT_ABSENT = [
  "GET /api/home/:id",
  "POST /api/cases",
  "GET /api/cases/:id",
  "GET /api/provider",
  "POST /api/demo/pull-plug",
];

export function dataMode(): DataMode {
  return process.env.NEXT_PUBLIC_NARA_DATA_SOURCE === "backend" ? "backend" : "mock";
}

/**
 * Real adapter. There is no service-case HTTP API to call.
 * Smoke is a local actor scaffold (read/bump) and is not a case record.
 */
export function inspectBackend(): BackendInspection {
  return {
    mode: "backend",
    connected: false,
    actorPresent: "Smoke",
    missing: DOCUMENTED_BUT_ABSENT,
  };
}

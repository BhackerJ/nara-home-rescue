import { CASE_ID, type CaseStatus } from "@/contracts/case";
import { firstName, ROSTER, techById, type RosterTech, type TechId } from "@/demo/roster";

/**
 * Presentation steps. The index is what the audience sees.
 * The shop stays empty until the authorization step.
 * Nothing here writes a case, books a slot, or calls the network.
 */
export const STEPS = [
  { id: "twin", label: "Home Twin" },
  { id: "report", label: "Report issue" },
  { id: "context", label: "Home context retrieved" },
  { id: "assessment", label: "AI assessment" },
  { id: "matching", label: "Technician recommendations" },
  { id: "authorized", label: "Homeowner authorization" },
  { id: "availability", label: "Provider availability" },
  { id: "counteroffer", label: "Counteroffer" },
  { id: "checkpoint", label: "Persisted case state" },
  { id: "confirmed", label: "Appointment confirmed" },
  { id: "enroute", label: "Optional · Technician on the way" },
  { id: "onsite", label: "Optional · On-site service" },
  { id: "complete", label: "Optional · Home Twin updated" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

export type HomeownerScreen =
  | "twin"
  | "report"
  | "context"
  | "assessment"
  | "matching"
  | "authorized"
  | "unavailable"
  | "counteroffer"
  | "held"
  | "confirmed"
  | "enroute"
  | "onsite"
  | "complete";

export type ShopPhase =
  | "waiting"
  | "packet"
  | "unavailable"
  | "counteroffer"
  | "held"
  | "confirmed"
  | "enroute"
  | "onsite"
  | "complete";

export type FixtureCase = {
  source: "simulated-fixture";
  caseId: string | null;
  status: CaseStatus | "idle";
  checkpoint: string;
};

export type InspectorSnapshot = {
  simulated: true;
  agent: string;
  from: string;
  to: string;
  relay: string;
  checkpoint: string;
  statusLabel: string;
  recovery: string;
};

export type DemoFrame = {
  index: number;
  stepId: StepId;
  stepLabel: string;
  homeowner: HomeownerScreen;
  shop: ShopPhase;
  inspector: InspectorSnapshot;
  fixture: FixtureCase;
  /** Set once the homeowner has authorized a technician. */
  preference: RosterTech | null;
  roster: RosterTech[];
};

const HOMEOWNER: HomeownerScreen[] = [
  "twin",
  "report",
  "context",
  "assessment",
  "matching",
  "authorized",
  "unavailable",
  "counteroffer",
  "held",
  "confirmed",
  "enroute",
  "onsite",
  "complete",
];

const SHOP: ShopPhase[] = [
  "waiting",
  "waiting",
  "waiting",
  "waiting",
  "waiting",
  "packet",
  "unavailable",
  "counteroffer",
  "held",
  "confirmed",
  "enroute",
  "onsite",
  "complete",
];

export function clampStep(index: number): number {
  return Math.max(0, Math.min(index, STEPS.length - 1));
}

export function frameAt(index: number, techId: TechId = "alex"): DemoFrame {
  const safe = clampStep(index);
  const step = STEPS[safe];
  const fixture = fixtureAt(safe);
  const preference = safe >= 5 ? techById(techId) : null;
  return {
    index: safe,
    stepId: step.id,
    stepLabel: step.label,
    homeowner: HOMEOWNER[safe],
    shop: SHOP[safe],
    inspector: inspectorAt(safe, fixture, preference),
    fixture,
    preference,
    roster: ROSTER,
  };
}

function fixtureAt(index: number): FixtureCase {
  if (index === 0) {
    return { source: "simulated-fixture", caseId: null, status: "idle", checkpoint: "none" };
  }
  if (index === 1) {
    return { source: "simulated-fixture", caseId: CASE_ID, status: "created", checkpoint: "issue_received" };
  }
  if (index === 2) {
    return { source: "simulated-fixture", caseId: CASE_ID, status: "diagnosing", checkpoint: "context_loaded" };
  }
  if (index === 3 || index === 4) {
    return {
      source: "simulated-fixture",
      caseId: CASE_ID,
      status: "diagnosing",
      checkpoint: "assessment_written",
    };
  }
  if (index === 5) {
    return { source: "simulated-fixture", caseId: CASE_ID, status: "dispatching", checkpoint: "job_packet" };
  }
  if (index === 6) {
    return {
      source: "simulated-fixture",
      caseId: CASE_ID,
      status: "awaiting_provider",
      checkpoint: "slot_requested",
    };
  }
  if (index === 7 || index === 8) {
    return {
      source: "simulated-fixture",
      caseId: CASE_ID,
      status: "negotiating",
      checkpoint: "counteroffer",
    };
  }
  return { source: "simulated-fixture", caseId: CASE_ID, status: "confirmed", checkpoint: "booked" };
}

function inspectorAt(
  index: number,
  fixture: FixtureCase,
  preference: RosterTech | null,
): InspectorSnapshot {
  const name = preference ? firstName(preference) : "Alex";
  const rows: Omit<InspectorSnapshot, "simulated" | "checkpoint" | "statusLabel">[] = [
    {
      agent: "Home Twin",
      from: "Home record",
      to: "Homeowner",
      relay: "No relay message",
      recovery: "No recovery event",
    },
    {
      agent: "Diagnostic",
      from: "Homeowner",
      to: "Diagnostic",
      relay: "No relay message",
      recovery: "No recovery event",
    },
    {
      agent: "Diagnostic",
      from: "Home Twin",
      to: "Diagnostic",
      relay: "No relay message",
      recovery: "No recovery event",
    },
    {
      agent: "Diagnostic",
      from: "Diagnostic",
      to: "Homeowner",
      relay: "No relay message",
      recovery: "No recovery event",
    },
    {
      agent: "Diagnostic",
      from: "Cool Air roster",
      to: "Homeowner",
      relay: "Simulated match from the Cool Air fixture. Not a live ranking.",
      recovery: "No recovery event",
    },
    {
      agent: "Dispatch",
      from: "Homeowner",
      to: "Cool Air Mechanical",
      relay: `Simulated handoff. Preference: ${name}. Not a confirmed assignment.`,
      recovery: "No recovery event",
    },
    {
      agent: "Provider",
      from: "Provider",
      to: "Dispatch",
      relay: "The requested slot stays open until the shop decides.",
      recovery: "No recovery event",
    },
    {
      agent: "Provider",
      from: "Provider",
      to: "Dispatch",
      relay: "No provider decision is recorded on this step.",
      recovery: "No recovery event",
    },
    {
      agent: "Durable Actor",
      from: "Case record",
      to: "Presenter",
      relay: "No new relay message",
      recovery:
        "Recovery is not available. This fixture still shows checkpoint counteroffer. No process was stopped.",
    },
    {
      agent: "Provider",
      from: "Provider",
      to: "Home Twin",
      relay: "No confirmation is recorded until the shop confirms the requested slot.",
      recovery: "No recovery event",
    },
    {
      agent: "Homeowner",
      from: "Demo fixture",
      to: "Homeowner",
      relay: "No relay message. Illustrated route, not live GPS.",
      recovery: "No recovery event",
    },
    {
      agent: "Homeowner",
      from: "Demo fixture",
      to: "Homeowner",
      relay: "No relay message. Prototype quote only. Not a live repair.",
      recovery: "No recovery event",
    },
    {
      agent: "Home Twin",
      from: "Demo fixture",
      to: "Home record",
      relay: "Simulated history line. Not a field repair.",
      recovery: "No recovery event",
    },
  ];

  return {
    simulated: true,
    checkpoint: fixture.checkpoint,
    statusLabel: fixture.caseId ? `${fixture.status}` : "idle",
    ...rows[index],
  };
}

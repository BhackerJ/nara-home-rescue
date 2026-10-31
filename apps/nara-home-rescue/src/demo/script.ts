import {
  ALTERNATE_SLOT,
  CASE_ID,
  type ActivityEvent,
  type AgentName,
  type CaseStatus,
  type HistoryEntry,
  type SlotState,
} from "@/contracts/case";

export type StageId =
  | "twin"
  | "reported"
  | "context"
  | "assessment"
  | "packet"
  | "received"
  | "rejected"
  | "counteroffer"
  | "recovery"
  | "confirmed"
  | "remembered";

export const STAGES: { id: StageId; label: string }[] = [
  { id: "twin", label: "Home Twin ready" },
  { id: "reported", label: "Problem reported" },
  { id: "context", label: "Reading the home" },
  { id: "assessment", label: "Assessment ready" },
  { id: "packet", label: "Job packet prepared" },
  { id: "received", label: "Shop received the case" },
  { id: "rejected", label: "Requested slot unavailable" },
  { id: "counteroffer", label: "Alternative proposed" },
  { id: "recovery", label: "Simulated resume" },
  { id: "confirmed", label: "Appointment confirmed" },
  { id: "remembered", label: "Home Twin updated" },
];

const BASE_HISTORY: HistoryEntry[] = [
  {
    id: "cap-2023",
    year: "2023",
    title: "Capacitor replaced",
    detail: "On the Carrier condenser. Historical context, not a diagnosis.",
  },
  {
    id: "maint-2021",
    year: "2021",
    title: "Annual maintenance",
    detail: "Cooling checked. No parts replaced.",
  },
];

const EVENT_SCRIPT: { agent: AgentName; title: string; detail: string }[] = [
  {
    agent: "actor",
    title: "Home Twin loaded",
    detail: "Equipment and service history are on screen. No case yet.",
  },
  {
    agent: "diagnostic",
    title: "Issue received",
    detail: "Homeowner: “My AC isn’t cooling.”",
  },
  {
    agent: "diagnostic",
    title: "Home context retrieved",
    detail: "2014 Carrier condenser. 2023 capacitor replacement is on the record.",
  },
  {
    agent: "diagnostic",
    title: "Assessment written",
    detail: "Outdoor unit not running. History is context, not a confirmed fault.",
  },
  {
    agent: "dispatch",
    title: "Job packet prepared",
    detail: "Technician-ready summary, without asking the homeowner to repeat the equipment.",
  },
  {
    agent: "relay",
    title: "Packet handed to the shop",
    detail: "Simulated handoff to Cool Air Mechanical.",
  },
  {
    agent: "provider",
    title: "Requested slot declined",
    detail: "Today 5:30–7:00 PM is already taken.",
  },
  {
    agent: "provider",
    title: "Alternative offered",
    detail: "Today 6:30–8:00 PM.",
  },
  {
    agent: "actor",
    title: "Simulated resume",
    detail: "Checkpoint slot_requested kept. Assessment was not rewritten. No process was killed.",
  },
  {
    agent: "provider",
    title: "Appointment confirmed",
    detail: "Today 6:30–8:00 PM with Cool Air Mechanical.",
  },
  {
    agent: "actor",
    title: "Home Twin updated",
    detail: "Scheduled visit saved on this home.",
  },
];

export type DemoFrame = {
  index: number;
  stage: StageId;
  stageLabel: string;
  caseId: string;
  caseOpen: boolean;
  status: CaseStatus | "idle";
  checkpoint: string;
  homeowner: "twin" | "submitted" | "reading" | "assessment" | "arranging" | "confirmed";
  showAssessment: boolean;
  showPacket: boolean;
  justArrived: boolean;
  slot: SlotState | "none";
  history: HistoryEntry[];
  highlightHistory: boolean;
  events: ActivityEvent[];
};

export function frameAt(index: number): DemoFrame {
  const safe = Math.max(0, Math.min(index, STAGES.length - 1));
  const stage = STAGES[safe];
  const events: ActivityEvent[] = EVENT_SCRIPT.slice(0, safe + 1).map((event, i) => ({
    id: `sim-${i}`,
    clock: `Demo 0:${String(i * 2).padStart(2, "0")}`,
    agent: event.agent,
    title: event.title,
    detail: event.detail,
    simulated: true,
  }));

  const history = [...BASE_HISTORY];
  if (safe >= 2) {
    history[0] = { ...history[0], emphasis: "context" };
  }
  if (safe >= 10) {
    history.unshift({
      id: "scheduled-today",
      year: "Today",
      title: "Service scheduled",
      detail: `${ALTERNATE_SLOT} · Cool Air Mechanical`,
      emphasis: "scheduled",
    });
  }

  let homeowner: DemoFrame["homeowner"] = "twin";
  if (safe === 1) homeowner = "submitted";
  else if (safe === 2) homeowner = "reading";
  else if (safe === 3) homeowner = "assessment";
  else if (safe >= 4 && safe <= 8) homeowner = "arranging";
  else if (safe >= 9) homeowner = "confirmed";

  let status: DemoFrame["status"] = "idle";
  let checkpoint = "none";
  if (safe === 1) {
    status = "created";
    checkpoint = "issue_received";
  } else if (safe === 2 || safe === 3) {
    status = "diagnosing";
    checkpoint = safe === 3 ? "assessment_written" : "context_loaded";
  } else if (safe === 4 || safe === 5) {
    status = "dispatching";
    checkpoint = "job_packet";
  } else if (safe === 6) {
    status = "awaiting_provider";
    checkpoint = "slot_requested";
  } else if (safe === 7) {
    status = "negotiating";
    checkpoint = "counteroffer";
  } else if (safe === 8) {
    status = "recovering";
    checkpoint = "slot_requested";
  } else if (safe >= 9) {
    status = "confirmed";
    checkpoint = "booked";
  }

  let slot: DemoFrame["slot"] = "none";
  if (safe >= 4 && safe <= 5) slot = "requested";
  else if (safe === 6) slot = "rejected";
  else if (safe === 7 || safe === 8) slot = "counteroffer";
  else if (safe >= 9) slot = "confirmed";

  return {
    index: safe,
    stage: stage.id,
    stageLabel: stage.label,
    caseId: safe === 0 ? "" : CASE_ID,
    caseOpen: safe >= 1,
    status,
    checkpoint,
    homeowner,
    showAssessment: safe >= 3,
    showPacket: safe >= 4,
    justArrived: safe === 5,
    slot,
    history,
    highlightHistory: safe >= 2,
    events,
  };
}

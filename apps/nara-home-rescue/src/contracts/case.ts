/**
 * Case vocabulary from docs/prd.txt.
 * These types describe the read model the three panes render, in both the
 * scripted and the live mode (`src/data/live.ts` fills them from the actor).
 */

export type CaseStatus =
  | "created"
  | "diagnosing"
  | "dispatching"
  | "awaiting_provider"
  | "recovering"
  | "negotiating"
  | "confirmed"
  | "failed";

export type AgentName = "diagnostic" | "dispatch" | "provider" | "actor" | "relay";

export type ActivityEvent = {
  id: string;
  clock: string;
  agent: AgentName;
  title: string;
  detail: string;
  /** True when the row is scripted UI, not a backend message. */
  simulated: boolean;
  /** Live rows only: which sponsor system or model produced this step. */
  tags?: string[];
};

export type HistoryEntry = {
  id: string;
  year: string;
  title: string;
  detail: string;
  emphasis?: "context" | "scheduled";
};

/** Completed history stays distinct from a scheduled visit on the current case. */
export type ServiceRecordStatus = "completed" | "scheduled";

/**
 * Structured service record for one piece of equipment.
 * Null means the home never stored that fact. Callers render "Not recorded".
 */
export type ServiceRecord = {
  id: string;
  homeId: string;
  equipmentId: string;
  /** Year, or "Today" when only a same-day window is known. */
  year: string;
  /** Calendar date or confirmed window. Null when only a year was stored. */
  date: string | null;
  category: string;
  title: string;
  outcome: string;
  status: ServiceRecordStatus;
  /** Set only when this row belongs to the current service case. */
  caseId: string | null;
  issue: string | null;
  diagnosis: string | null;
  workPerformed: string | null;
  parts: string | null;
  provider: string | null;
  cost: string | null;
  warranty: string | null;
  attachments: string | null;
};

export type SlotState = "requested" | "rejected" | "counteroffer" | "confirmed";

export const CASE_ID = "case-1847-maple";
export const HOME_ID = "home-1847-maple";
export const REQUESTED_SLOT = "Today · 5:30–7:00 PM";
export const ALTERNATE_SLOT = "Today · 6:30–8:00 PM";

/**
 * Case vocabulary from docs/prd.txt.
 * These types describe the demo read model. They are not a live actor schema.
 * The repository's only generated actor is Smoke.
 */

export type CaseStatus =
  | "created"
  | "diagnosing"
  | "dispatching"
  | "awaiting_provider"
  | "recovering"
  | "negotiating"
  | "confirmed";

export type AgentName = "diagnostic" | "dispatch" | "provider" | "actor" | "relay";

export type ActivityEvent = {
  id: string;
  clock: string;
  agent: AgentName;
  title: string;
  detail: string;
  /** True when the row is scripted UI, not a backend message. */
  simulated: true;
};

export type HistoryEntry = {
  id: string;
  year: string;
  title: string;
  detail: string;
  emphasis?: "context" | "scheduled";
};

export type SlotState = "requested" | "rejected" | "counteroffer" | "confirmed";

export const CASE_ID = "case-1847-maple";
export const HOME_ID = "home-1847-maple";
export const REQUESTED_SLOT = "Today · 5:30–7:00 PM";
export const ALTERNATE_SLOT = "Today · 6:30–8:00 PM";

/**
 * Read models for the HVAC dispatch dashboard.
 *
 * These match the ServiceCase vocabulary in docs/prd.txt.
 * `GET /api/cases/:id` returns `ServiceCase` (docs/plan-1h.md §3).
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

export type CaseEvent = {
  id: string;
  caseId: string;
  timestamp: string;
  agent: string;
  type: string;
  payload: Record<string, unknown>;
};

export type HomeEquipment = {
  homeId: string;
  equipmentId: string;
  address: string;
  city: string;
  state: string;
  manufacturer: string;
  model: string;
  year: number;
  equipmentType: string;
};

export type DiagnosticSummary = {
  caseId: string;
  issue: string;
  symptoms: string[];
  narrative: string;
};

export type JobPacket = {
  caseId: string;
  trade: "hvac";
  problem: string;
  urgency: string;
  requiredSkills: string[];
  preferredExpertise: string[];
  requiredCertifications: string[];
  photoUrls: string[];
};

export type AppointmentRequest = {
  caseId: string;
  requestedSlot?: string;
};

export type ProviderCounteroffer = {
  caseId: string;
  providerId: string;
  requestedSlot: string;
  alternatives: string[];
};

export type ConfirmedAppointment = {
  caseId: string;
  providerId: string;
  confirmedSlot: string;
};

export type ServiceCase = {
  id: string;
  homeId: string;
  equipmentId: string;
  issue: string;
  symptoms: string[];
  status: CaseStatus;
  checkpoint: string;
  revision: number;
  requestedSlot?: string;
  confirmedSlot?: string;
  providerId?: string;
  events: CaseEvent[];
  equipment: HomeEquipment;
  diagnostic: DiagnosticSummary;
  jobPacket: JobPacket;
  counteroffer: ProviderCounteroffer | null;
  confirmedAppointment: ConfirmedAppointment | null;
  /** Streams while status === "diagnosing" (docs/plan-1h.md §3). */
  draftDiagnosis?: string;
  worker?: { bootId: string; pid: number };
  recovery?: { previousPid: number; pid: number; fromCheckpoint: string; at: string };
};

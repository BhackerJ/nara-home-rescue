import { CASE_ID } from "../contracts/case.ts";

/**
 * Published openings from the Cool Air fixture.
 * Identity is the slot id, not the display sentence.
 */
export const APPOINTMENT_SLOTS = {
  "alex-today": {
    id: "alex-today",
    technicianId: "alex",
    label: "Today · 5:30–7:00 PM",
  },
  "maria-today": {
    id: "maria-today",
    technicianId: "maria",
    label: "Today · 6:00–8:00 PM",
  },
} as const;

export type SlotId = keyof typeof APPOINTMENT_SLOTS;
export type AppointmentTechnicianId = (typeof APPOINTMENT_SLOTS)[SlotId]["technicianId"];

export const APPOINTMENT_TECHNICIANS = {
  alex: { id: "alex", name: "Alex Morgan", company: "Cool Air Mechanical" },
  maria: { id: "maria", name: "Maria Chen", company: "Cool Air Mechanical" },
} as const;

/** Shop offers this only when the operator submits a counteroffer for Maria. */
export const EMERGENCY_REASON = "Alex received an emergency service call.";

export const SIMULATED_CONFIRMATION_TIME = "simulated";

export type AppointmentStatus =
  | "idle"
  | "awaiting_provider"
  | "counteroffer_pending_homeowner"
  | "confirmed"
  | "rejected";

export type ProviderDecision = "pending" | "confirmed" | "counteroffer" | "rejected";

export type AppointmentCase = {
  caseId: typeof CASE_ID;
  requestedTechnicianId: AppointmentTechnicianId | null;
  requestedSlotId: SlotId | null;
  providerDecision: ProviderDecision;
  proposedTechnicianId: AppointmentTechnicianId | null;
  proposedSlotId: SlotId | null;
  proposedReason: string | null;
  confirmedTechnicianId: AppointmentTechnicianId | null;
  confirmedSlotId: SlotId | null;
  appointmentStatus: AppointmentStatus;
  confirmationTimestamp: string | null;
};

export type AppointmentAction =
  | { type: "request"; technicianId: AppointmentTechnicianId; slotId: SlotId }
  | { type: "confirm-requested"; timestamp?: string }
  | {
      type: "counteroffer";
      technicianId: AppointmentTechnicianId;
      slotId: SlotId;
      reason: string;
    }
  | { type: "accept-counteroffer"; timestamp?: string }
  | { type: "decline-counteroffer" };

export function emptyAppointment(): AppointmentCase {
  return {
    caseId: CASE_ID,
    requestedTechnicianId: null,
    requestedSlotId: null,
    providerDecision: "pending",
    proposedTechnicianId: null,
    proposedSlotId: null,
    proposedReason: null,
    confirmedTechnicianId: null,
    confirmedSlotId: null,
    appointmentStatus: "idle",
    confirmationTimestamp: null,
  };
}

export function slotById(slotId: string | null) {
  if (!slotId) return null;
  return APPOINTMENT_SLOTS[slotId as SlotId] ?? null;
}

export function slotIdForTechnician(technicianId: string): SlotId | null {
  const found = Object.values(APPOINTMENT_SLOTS).find((slot) => slot.technicianId === technicianId);
  return found?.id ?? null;
}

function confirmedCase(
  current: AppointmentCase,
  technicianId: AppointmentTechnicianId,
  slotId: SlotId,
  timestamp: string,
): AppointmentCase {
  return {
    ...current,
    providerDecision: "confirmed",
    proposedTechnicianId: null,
    proposedSlotId: null,
    proposedReason: null,
    confirmedTechnicianId: technicianId,
    confirmedSlotId: slotId,
    appointmentStatus: "confirmed",
    confirmationTimestamp: timestamp,
  };
}

/**
 * Business transitions. Presentation steps must not call this.
 * A second confirm returns the same case. A confirmed case ignores later reschedules.
 */
export function reduceAppointment(current: AppointmentCase, action: AppointmentAction): AppointmentCase {
  if (action.type === "request") {
    if (current.requestedTechnicianId) return current;
    const slot = APPOINTMENT_SLOTS[action.slotId];
    if (!slot || slot.technicianId !== action.technicianId) return current;
    return {
      ...current,
      requestedTechnicianId: action.technicianId,
      requestedSlotId: action.slotId,
      providerDecision: "pending",
      appointmentStatus: "awaiting_provider",
    };
  }

  if (current.appointmentStatus === "confirmed") return current;

  if (action.type === "confirm-requested") {
    if (current.appointmentStatus !== "awaiting_provider") return current;
    if (!current.requestedTechnicianId || !current.requestedSlotId) return current;
    return confirmedCase(
      current,
      current.requestedTechnicianId,
      current.requestedSlotId,
      action.timestamp ?? SIMULATED_CONFIRMATION_TIME,
    );
  }

  if (action.type === "counteroffer") {
    if (current.appointmentStatus !== "awaiting_provider") return current;
    if (action.technicianId === current.requestedTechnicianId && action.slotId === current.requestedSlotId) {
      return current;
    }
    const slot = APPOINTMENT_SLOTS[action.slotId];
    if (!slot || slot.technicianId !== action.technicianId) return current;
    return {
      ...current,
      providerDecision: "counteroffer",
      proposedTechnicianId: action.technicianId,
      proposedSlotId: action.slotId,
      proposedReason: action.reason,
      confirmedTechnicianId: null,
      confirmedSlotId: null,
      appointmentStatus: "counteroffer_pending_homeowner",
      confirmationTimestamp: null,
    };
  }

  if (action.type === "accept-counteroffer") {
    if (current.appointmentStatus !== "counteroffer_pending_homeowner") return current;
    if (!current.proposedTechnicianId || !current.proposedSlotId) return current;
    return confirmedCase(
      current,
      current.proposedTechnicianId,
      current.proposedSlotId,
      action.timestamp ?? SIMULATED_CONFIRMATION_TIME,
    );
  }

  if (current.appointmentStatus !== "counteroffer_pending_homeowner") return current;
  return {
    ...current,
    providerDecision: "pending",
    proposedTechnicianId: null,
    proposedSlotId: null,
    proposedReason: null,
    appointmentStatus: "awaiting_provider",
  };
}

export type AppointmentPhase = "story" | "waiting" | "confirmed" | "counteroffer" | "journey";

export type AppointmentView = {
  phase: AppointmentPhase;
  technicianId: AppointmentTechnicianId | null;
  slotId: SlotId | null;
  windowLabel: string | null;
  reason: string | null;
  /** True only when this view tells the homeowner the requested slot was refused. */
  unavailable: boolean;
};

const STORY_STEPS = new Set(["twin", "report", "context", "assessment", "matching"]);
const JOURNEY_STEPS = new Set(["enroute", "onsite", "complete"]);

/** What both screens may say. Ignores the scripted rejection and the 6:30 fixture. */
export function describeAppointment(stepId: string, appointment: AppointmentCase): AppointmentView {
  const blank = {
    technicianId: null,
    slotId: null,
    windowLabel: null,
    reason: null,
    unavailable: false,
  } as const;

  if (STORY_STEPS.has(stepId)) return { phase: "story", ...blank };

  if (appointment.appointmentStatus === "confirmed" && appointment.confirmedSlotId) {
    const slot = slotById(appointment.confirmedSlotId);
    return {
      phase: JOURNEY_STEPS.has(stepId) ? "journey" : "confirmed",
      technicianId: appointment.confirmedTechnicianId,
      slotId: appointment.confirmedSlotId,
      windowLabel: slot?.label ?? null,
      reason: null,
      unavailable: false,
    };
  }

  if (
    appointment.appointmentStatus === "counteroffer_pending_homeowner" &&
    appointment.proposedSlotId
  ) {
    const slot = slotById(appointment.proposedSlotId);
    return {
      phase: "counteroffer",
      technicianId: appointment.proposedTechnicianId,
      slotId: appointment.proposedSlotId,
      windowLabel: slot?.label ?? null,
      reason: appointment.proposedReason,
      unavailable: false,
    };
  }

  const requested = slotById(appointment.requestedSlotId);
  return {
    phase: "waiting",
    technicianId: appointment.requestedTechnicianId,
    slotId: appointment.requestedSlotId,
    windowLabel: requested?.label ?? null,
    reason: null,
    unavailable: false,
  };
}

export type CapacityOccupancy = "published" | "pending" | "booked" | "unavailable";

export function capacityForSlot(
  slotId: string,
  appointment: AppointmentCase,
): { occupancy: CapacityOccupancy; reservedForCaseId: string | null } {
  if (
    appointment.appointmentStatus === "confirmed" &&
    appointment.confirmedSlotId === slotId
  ) {
    return { occupancy: "booked", reservedForCaseId: appointment.caseId };
  }
  if (
    appointment.appointmentStatus === "awaiting_provider" &&
    appointment.requestedSlotId === slotId
  ) {
    return { occupancy: "pending", reservedForCaseId: appointment.caseId };
  }
  if (
    appointment.appointmentStatus === "counteroffer_pending_homeowner" &&
    (appointment.proposedSlotId === slotId || appointment.requestedSlotId === slotId)
  ) {
    return { occupancy: "pending", reservedForCaseId: appointment.caseId };
  }
  if (slotById(slotId)) return { occupancy: "published", reservedForCaseId: null };
  return { occupancy: "unavailable", reservedForCaseId: null };
}

/** A slot booked by this same case is its reservation, not a conflict. */
export function slotConflictsWithCase(
  slotId: string,
  appointment: AppointmentCase,
  caseId: string,
): boolean {
  const capacity = capacityForSlot(slotId, appointment);
  if (capacity.occupancy === "booked" && capacity.reservedForCaseId === caseId) return false;
  return capacity.occupancy === "booked" || capacity.occupancy === "unavailable";
}

import type { CasePort, DemoSnapshot } from "../data/casePort.ts";
import {
  emptyAppointment,
  reduceAppointment,
  slotIdForTechnician,
  type AppointmentAction,
  type AppointmentTechnicianId,
} from "./appointment.ts";

/**
 * Development adapter for the presenter.
 * The browser copy is stored locally so both panes and a refresh share one case.
 * It is not the ServiceCase actor. Live mode keeps using src/data/live.ts.
 */
export type { DemoSnapshot } from "../data/casePort.ts";

export const CASE_STORAGE_KEY = "nara-home-rescue:development-case";

export function freshSnapshot(): DemoSnapshot {
  return {
    appointment: emptyAppointment(),
    step: 0,
    version: 0,
    updatedAt: "",
    source: "development-adapter",
  };
}

/** Same snapshot object when the action does not change the case. A second confirm does not book again. */
export function applyCaseAction(snapshot: DemoSnapshot, action: AppointmentAction, now: string): DemoSnapshot {
  const appointment = reduceAppointment(snapshot.appointment, action);
  if (appointment === snapshot.appointment) return snapshot;
  return {
    ...snapshot,
    appointment,
    version: snapshot.version + 1,
    updatedAt: now,
  };
}

const LAST_PRESENTATION_STEP = 12;

/** Presentation index only. The appointment record stays the same object. */
export function withStep(snapshot: DemoSnapshot, step: number): DemoSnapshot {
  const next = Math.max(0, Math.min(step, LAST_PRESENTATION_STEP));
  if (next === snapshot.step) return snapshot;
  return { ...snapshot, step: next };
}

export function requestTechnician(snapshot: DemoSnapshot, technicianId: AppointmentTechnicianId, now: string): DemoSnapshot {
  const slotId = slotIdForTechnician(technicianId);
  if (!slotId) return snapshot;
  const next = applyCaseAction(snapshot, { type: "request", technicianId, slotId }, now);
  if (next === snapshot) return snapshot;
  return { ...next, step: 5 };
}

const SERVER_SNAPSHOT = freshSnapshot();
let current = SERVER_SNAPSHOT;
let revision = 0;

function emit() {
  window.dispatchEvent(new Event("nara-dev-case"));
}

function write(next: DemoSnapshot) {
  revision += 1;
  current = next;
  try {
    localStorage.setItem(CASE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode can reject storage. The open tab still shares the memory copy.
  }
  emit();
}

export function readStoredSnapshot(raw: string | null): DemoSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as DemoSnapshot;
    if (value?.source !== "development-adapter") return null;
    if (!value.appointment || value.appointment.caseId !== "case-1847-maple") return null;
    if (typeof value.step !== "number" || typeof value.version !== "number") return null;
    return value;
  } catch {
    return null;
  }
}

export function subscribeDemo(onStoreChange: () => void) {
  const seen = revision;
  const notify = () => onStoreChange();
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CASE_STORAGE_KEY) return;
    const saved = readStoredSnapshot(event.newValue);
    current = saved ?? freshSnapshot();
    revision += 1;
    notify();
  };
  window.addEventListener("nara-dev-case", notify);
  window.addEventListener("storage", onStorage);
  queueMicrotask(() => {
    if (revision !== seen) return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(CASE_STORAGE_KEY);
    } catch {
      raw = null;
    }
    const saved = readStoredSnapshot(raw);
    if (!saved) return;
    current = saved;
    notify();
  });
  return () => {
    window.removeEventListener("nara-dev-case", notify);
    window.removeEventListener("storage", onStorage);
  };
}

export function getDemoSnapshot() {
  return current;
}

export function getServerDemoSnapshot() {
  return SERVER_SNAPSHOT;
}

export function commitCaseAction(action: AppointmentAction) {
  const next = applyCaseAction(current, action, new Date().toISOString());
  if (next === current) return;
  write(next);
}

export function commitRequest(technicianId: AppointmentTechnicianId) {
  const next = requestTechnician(current, technicianId, new Date().toISOString());
  if (next === current) return;
  write(next);
}

export function commitStep(step: number) {
  const next = withStep(current, step);
  if (next === current) return;
  write(next);
}

export function resetDemoCase() {
  try {
    localStorage.removeItem(CASE_STORAGE_KEY);
  } catch {
    // The memory reset below still clears this tab.
  }
  write(freshSnapshot());
}

function counteroffer(technicianId: AppointmentTechnicianId, reason: string) {
  const slotId = slotIdForTechnician(technicianId);
  if (!slotId) return;
  commitCaseAction({ type: "counteroffer", technicianId, slotId, reason });
}

/** Browser-local port. Same-tab and same-browser storage events only. Not cross-device. */
export const developmentCasePort: CasePort = {
  source: "development-adapter",
  subscribe: subscribeDemo,
  getSnapshot: getDemoSnapshot,
  getServerSnapshot: getServerDemoSnapshot,
  request: commitRequest,
  confirmRequested: () => commitCaseAction({ type: "confirm-requested" }),
  counteroffer,
  acceptCounteroffer: () => commitCaseAction({ type: "accept-counteroffer" }),
  declineCounteroffer: () => commitCaseAction({ type: "decline-counteroffer" }),
  setStep: commitStep,
  reset: resetDemoCase,
};

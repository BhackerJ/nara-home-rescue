import type { AppointmentCase, AppointmentTechnicianId } from "@/demo/appointment";

/** Presenter snapshot. `source` says this copy is the development adapter, not the actor. */
export type DemoSnapshot = {
  appointment: AppointmentCase;
  step: number;
  version: number;
  updatedAt: string;
  source: "development-adapter";
};

/**
 * The only seam between the presenter and a case backend.
 * HomeownerPane and DispatchApp do not import this. They receive props.
 * Replace `developmentCasePort` in RescueDemo with an actor-backed port.
 * Do not implement that port by inventing actor methods.
 */
export type CasePort = {
  /** Where the snapshot came from. The development port is not the ServiceCase actor. */
  source: "development-adapter";
  subscribe(onChange: () => void): () => void;
  getSnapshot(): DemoSnapshot;
  getServerSnapshot(): DemoSnapshot;
  request(technicianId: AppointmentTechnicianId): void;
  confirmRequested(): void;
  counteroffer(technicianId: AppointmentTechnicianId, reason: string): void;
  acceptCounteroffer(): void;
  declineCounteroffer(): void;
  /** Presentation index only. Must not confirm, reject, or reschedule. */
  setStep(step: number): void;
  /** Clears the development case. Must not delete an actor booking. */
  reset(): void;
};

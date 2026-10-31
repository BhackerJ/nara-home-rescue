import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  capacityForSlot,
  describeAppointment,
  emptyAppointment,
  reduceAppointment,
  slotConflictsWithCase,
  type AppointmentCase,
} from "./appointment.ts";

function presentationStepIds(): string[] {
  const source = readFileSync(new URL("./script.ts", import.meta.url), "utf8");
  const block = source.slice(source.indexOf("export const STEPS"), source.indexOf("] as const;"));
  return [...block.matchAll(/id: "([^"]+)"/g)].map((match) => match[1]);
}

function requestAlex(current: AppointmentCase = emptyAppointment()) {
  return reduceAppointment(current, {
    type: "request",
    technicianId: "alex",
    slotId: "alex-today",
  });
}

function confirmAlex(current: AppointmentCase = requestAlex()) {
  return reduceAppointment(current, { type: "confirm-requested" });
}

test("A: confirming Alex keeps 5:30–7:00 on both views and invents no alternate", () => {
  const requested = requestAlex();
  assert.equal(requested.appointmentStatus, "awaiting_provider");
  assert.equal(requested.requestedSlotId, "alex-today");

  const waiting = describeAppointment("authorized", requested);
  assert.equal(waiting.phase, "waiting");
  assert.equal(waiting.windowLabel, "Today · 5:30–7:00 PM");
  assert.equal(waiting.unavailable, false);

  const confirmed = confirmAlex(requested);
  assert.equal(confirmed.appointmentStatus, "confirmed");
  assert.equal(confirmed.providerDecision, "confirmed");
  assert.equal(confirmed.confirmedTechnicianId, "alex");
  assert.equal(confirmed.confirmedSlotId, "alex-today");
  assert.equal(confirmed.proposedSlotId, null);
  assert.ok(confirmed.confirmationTimestamp);

  for (const stepId of ["authorized", "availability", "counteroffer", "held", "confirmed"]) {
    const view = describeAppointment(stepId, confirmed);
    assert.equal(view.phase, "confirmed", stepId);
    assert.equal(view.technicianId, "alex", stepId);
    assert.equal(view.slotId, "alex-today", stepId);
    assert.equal(view.windowLabel, "Today · 5:30–7:00 PM", stepId);
    assert.equal(view.unavailable, false, stepId);
    assert.equal(view.windowLabel?.includes("6:30"), false, stepId);
  }
});

test("B: Maria is confirmed only after the homeowner accepts the shop's offer", () => {
  const requested = requestAlex();
  const offered = reduceAppointment(requested, {
    type: "counteroffer",
    technicianId: "maria",
    slotId: "maria-today",
    reason: "Alex received an emergency service call.",
  });
  assert.equal(offered.appointmentStatus, "counteroffer_pending_homeowner");
  assert.equal(offered.confirmedSlotId, null);
  assert.equal(offered.proposedTechnicianId, "maria");
  assert.equal(offered.proposedSlotId, "maria-today");

  const counter = describeAppointment("availability", offered);
  assert.equal(counter.phase, "counteroffer");
  assert.equal(counter.technicianId, "maria");
  assert.equal(counter.windowLabel, "Today · 6:00–8:00 PM");
  assert.equal(counter.unavailable, false);

  const accepted = reduceAppointment(offered, { type: "accept-counteroffer" });
  assert.equal(accepted.appointmentStatus, "confirmed");
  assert.equal(accepted.confirmedTechnicianId, "maria");
  assert.equal(accepted.confirmedSlotId, "maria-today");
  assert.notEqual(accepted.confirmedTechnicianId, "alex");

  const homeowner = describeAppointment("confirmed", accepted);
  const shop = describeAppointment("authorized", accepted);
  assert.equal(homeowner.windowLabel, "Today · 6:00–8:00 PM");
  assert.equal(shop.technicianId, homeowner.technicianId);
  assert.equal(shop.slotId, homeowner.slotId);
});

test("C: later presentation steps do not reject or reschedule a confirmed Alex visit", () => {
  const confirmed = confirmAlex();
  const steps = presentationStepIds();
  const remaining = steps.slice(steps.indexOf("authorized"));
  for (const stepId of remaining) {
    const view = describeAppointment(stepId, confirmed);
    assert.equal(view.unavailable, false, stepId);
    assert.equal(view.technicianId, "alex", stepId);
    assert.equal(view.slotId, "alex-today", stepId);
    assert.equal(view.windowLabel, "Today · 5:30–7:00 PM", stepId);
    assert.equal(reduceAppointment(confirmed, { type: "confirm-requested" }), confirmed);
  }
});

test("D: moving backward and forward does not change the confirmed case", () => {
  const confirmed = confirmAlex();
  const steps = ["confirmed", "counteroffer", "availability", "authorized", "confirmed", "enroute"];
  const seen = confirmed;
  for (const stepId of steps) {
    const view = describeAppointment(stepId, seen);
    assert.equal(view.slotId, "alex-today");
    assert.equal(view.unavailable, false);
    const again = reduceAppointment(seen, { type: "confirm-requested" });
    assert.equal(again, seen);
  }
  assert.equal(seen.confirmedSlotId, "alex-today");
  assert.equal(seen.appointmentStatus, "confirmed");
});

test("E: Alex's booked slot stays confirmed for this case and blocks a different case", () => {
  const confirmed = confirmAlex();
  const alex = capacityForSlot("alex-today", confirmed);
  const maria = capacityForSlot("maria-today", confirmed);
  assert.equal(alex.occupancy, "booked");
  assert.equal(alex.reservedForCaseId, confirmed.caseId);
  assert.equal(slotConflictsWithCase("alex-today", confirmed, confirmed.caseId), false);
  assert.equal(slotConflictsWithCase("alex-today", confirmed, "case-other"), true);
  assert.equal(maria.occupancy, "published");
  assert.equal(slotConflictsWithCase("maria-today", confirmed, "case-other"), false);
});

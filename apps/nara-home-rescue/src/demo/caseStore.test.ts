import assert from "node:assert/strict";
import test from "node:test";
import { applyCaseAction, freshSnapshot, requestTechnician, withStep } from "./caseStore.ts";

const NOW = "2026-10-31T21:00:00.000Z";

test("confirming Alex once books a single case and a repeat confirm does not", () => {
  const requested = requestTechnician(freshSnapshot(), "alex", NOW);
  assert.equal(requested.appointment.appointmentStatus, "awaiting_provider");
  assert.equal(requested.appointment.requestedSlotId, "alex-today");
  assert.equal(requested.version, 1);

  const confirmed = applyCaseAction(requested, { type: "confirm-requested", timestamp: NOW }, NOW);
  assert.equal(confirmed.appointment.confirmedSlotId, "alex-today");
  assert.equal(confirmed.appointment.confirmedTechnicianId, "alex");
  assert.equal(confirmed.version, 2);

  const again = applyCaseAction(confirmed, { type: "confirm-requested", timestamp: NOW }, NOW);
  assert.equal(again, confirmed);
  assert.equal(again.version, 2);
});

test("moving the presentation step does not change the confirmed appointment", () => {
  const requested = requestTechnician(freshSnapshot(), "alex", NOW);
  const confirmed = applyCaseAction(requested, { type: "confirm-requested", timestamp: NOW }, NOW);
  const later = withStep(confirmed, 10);
  assert.equal(later.step, 10);
  assert.equal(later.appointment, confirmed.appointment);
  assert.equal(later.version, confirmed.version);
  assert.equal(later.appointment.confirmedSlotId, "alex-today");
});

test("Maria is stored only as a pending counteroffer until the homeowner accepts", () => {
  const requested = requestTechnician(freshSnapshot(), "alex", NOW);
  const offered = applyCaseAction(
    requested,
    {
      type: "counteroffer",
      technicianId: "maria",
      slotId: "maria-today",
      reason: "Alex received an emergency service call.",
    },
    NOW,
  );
  assert.equal(offered.appointment.appointmentStatus, "counteroffer_pending_homeowner");
  assert.equal(offered.appointment.confirmedTechnicianId, null);
  const accepted = applyCaseAction(offered, { type: "accept-counteroffer", timestamp: NOW }, NOW);
  assert.equal(accepted.appointment.confirmedTechnicianId, "maria");
  assert.equal(accepted.appointment.confirmedSlotId, "maria-today");
});

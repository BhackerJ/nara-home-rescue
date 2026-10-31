"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  APPOINTMENT_SLOTS,
  APPOINTMENT_TECHNICIANS,
  capacityForSlot,
  describeAppointment,
  type AppointmentCase,
  type AppointmentView,
} from "@/demo/appointment";
import { developmentCasePort } from "@/demo/caseStore";
import type { DataMode } from "@/data/adapters";
import { LiveRescueDemo } from "./LiveRescueDemo";
import type { TechId } from "@/demo/roster";
import { frameAt, STEPS, type InspectorSnapshot } from "@/demo/script";
import { DispatchApp } from "@/capacity/dispatch/DispatchApp";
import { ActivityPane } from "./ActivityPane";
import { HomeownerPane } from "./HomeownerPane";

/**
 * The presentation index only chooses a screen.
 * The development adapter is the shared case for both panes.
 * Next, Previous, and the arrow keys never confirm, reject, or reschedule.
 * Reset clears that local case. It does not call a backend delete.
 */
export function RescueDemo({ mode }: { mode: DataMode }) {
  const port = developmentCasePort;
  const snapshot = useSyncExternalStore(port.subscribe, port.getSnapshot, port.getServerSnapshot);
  const { step, appointment } = snapshot;
  const frame = frameAt(
    step,
    appointment.confirmedTechnicianId ?? appointment.requestedTechnicianId ?? "alex",
  );
  const view = describeAppointment(frame.stepId, appointment);
  const last = STEPS.length - 1;

  function requestTechnician(id: TechId) {
    if (id !== "alex" && id !== "maria") return;
    port.request(id);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      port.setStep(port.getSnapshot().step + (event.key === "ArrowRight" ? 1 : -1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [port]);

  if (mode === "backend") {
    return <LiveRescueDemo mode="backend" />;
  }

  return (
    <main className="flex h-dvh flex-col bg-sand px-4 py-3 text-ink">
      <header className="mb-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
            Nara Home Rescue
          </p>
          <h1 className="nara-serif text-[26px] leading-tight">
            A home that remembers, reasons, and acts.
          </h1>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 min-[1180px]:grid-cols-[340px_minmax(0,1fr)_220px]">
        <HomeownerPane
          frame={frame}
          view={view}
          onReport={() => port.setStep(1)}
          onRequest={requestTechnician}
          onAccept={() => port.acceptCounteroffer()}
          onDecline={() => port.declineCounteroffer()}
          scheduled={scheduledVisit(appointment)}
        />
        <section aria-label="HVAC shop" className="min-h-0 overflow-hidden rounded-[28px] ring-1 ring-line/80">
          <DispatchApp
            requestVisible={frame.index >= 5 && appointment.requestedTechnicianId !== null}
            confirmedTechId={
              appointment.appointmentStatus === "confirmed" ? appointment.confirmedTechnicianId : null
            }
            slotOccupancy={{
              "alex-today": capacityForSlot("alex-today", appointment).occupancy,
              "maria-today": capacityForSlot("maria-today", appointment).occupancy,
            }}
            requestedTechnicianId={appointment.requestedTechnicianId}
            appointmentStatus={appointment.appointmentStatus}
            onConfirmRequested={() => port.confirmRequested()}
            onOfferInstead={(technicianId, reason) => {
              if (technicianId !== "alex" && technicianId !== "maria") return;
              port.counteroffer(technicianId, reason);
            }}
          />
        </section>
        <ActivityPane frame={{ ...frame, inspector: inspectorFor(frame.inspector, view, appointment) }} />
      </div>

      <PresenterBar
        step={step}
        last={last}
        label={frame.stepLabel}
        onPrevious={() => port.setStep(step - 1)}
        onNext={() => port.setStep(step + 1)}
        onReset={() => port.reset()}
      />
    </main>
  );
}

function scheduledVisit(appointment: AppointmentCase) {
  if (
    appointment.appointmentStatus !== "confirmed" ||
    !appointment.confirmedTechnicianId ||
    !appointment.confirmedSlotId
  ) {
    return null;
  }
  const tech = APPOINTMENT_TECHNICIANS[appointment.confirmedTechnicianId];
  const slot = APPOINTMENT_SLOTS[appointment.confirmedSlotId];
  return { name: tech.name, company: tech.company, windowLabel: slot.label };
}

function inspectorFor(
  inspector: InspectorSnapshot,
  view: AppointmentView,
  appointment: AppointmentCase,
): InspectorSnapshot {
  if (view.phase === "confirmed" || view.phase === "journey") {
    return {
      ...inspector,
      relay: `Development adapter confirmation for ${view.windowLabel}. Not an Agent Relay message.`,
      statusLabel: "confirmed",
      checkpoint: "booked",
    };
  }
  if (view.phase === "counteroffer") {
    return {
      ...inspector,
      relay: `Development adapter counteroffer for ${view.windowLabel}. Not confirmed. Not an Agent Relay message.`,
      statusLabel: "counteroffer_pending_homeowner",
      checkpoint: "counteroffer",
    };
  }
  if (view.phase === "waiting") {
    return {
      ...inspector,
      relay: "No provider decision yet. The requested slot was not rejected.",
      statusLabel: appointment.appointmentStatus,
      checkpoint: "awaiting_provider",
    };
  }
  return inspector;
}

function PresenterBar({
  step,
  last,
  label,
  onPrevious,
  onNext,
  onReset,
}: {
  step: number;
  last: number;
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  onReset: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={onPrevious}
        disabled={step === 0}
        className="h-10 rounded-full bg-paper px-4 text-[14px] font-semibold text-ink ring-1 ring-line disabled:opacity-40"
      >
        Previous
      </button>
      <p className="min-w-[16rem] text-center text-[15px] font-medium" aria-live="polite">
        Step {step + 1} of {last + 1} — {label}
      </p>
      <button
        type="button"
        onClick={onNext}
        disabled={step === last}
        className="h-10 rounded-full bg-sage px-4 text-[14px] font-semibold text-cream disabled:opacity-40"
      >
        Next
      </button>
      <button
        type="button"
        onClick={onReset}
        className="h-10 rounded-full px-3 text-[14px] font-semibold text-muted underline decoration-line underline-offset-4"
      >
        Reset demo
      </button>
    </div>
  );
}


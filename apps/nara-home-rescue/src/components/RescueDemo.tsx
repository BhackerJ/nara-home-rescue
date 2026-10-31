"use client";

import { useEffect, useRef, useState } from "react";
import {
  APPOINTMENT_SLOTS,
  APPOINTMENT_TECHNICIANS,
  capacityForSlot,
  describeAppointment,
  emptyAppointment,
  reduceAppointment,
  slotIdForTechnician,
  type AppointmentCase,
  type AppointmentView,
} from "@/demo/appointment";
import type { DataMode } from "@/data/adapters";
import {
  frameFromCase,
  playDemo,
  replayCase,
  useDirector,
  useLiveCase,
  useRevealed,
  useTypewriter,
  visibleEventCount,
} from "@/data/live";
import { LiveRescueDemo } from "./LiveRescueDemo";
import { ActivityPane as LiveActivityPane } from "./live/ActivityPane";
import type { TechId } from "@/demo/roster";
import { clampStep, frameAt, STEPS, type InspectorSnapshot } from "@/demo/script";
import { DispatchApp } from "@/capacity/dispatch/DispatchApp";
import { ActivityPane } from "./ActivityPane";
import { HomeownerPane } from "./HomeownerPane";

/**
 * The presentation index only chooses a screen.
 * The appointment case is the only source for technician, slot, and status.
 * Next, Previous, and the arrow keys never confirm, reject, or reschedule.
 * Reset clears this simulated case. It does not call a backend delete.
 */
export function RescueDemo({ mode }: { mode: DataMode }) {
  const [step, setStep] = useState(0);
  const [techId, setTechId] = useState<TechId>("alex");
  const [appointment, setAppointment] = useState<AppointmentCase>(emptyAppointment);
  const seen = useRef(new Set<string>());
  const frame = frameAt(step, appointment.confirmedTechnicianId ?? appointment.requestedTechnicianId ?? techId);
  const view = describeAppointment(frame.stepId, appointment);
  const last = STEPS.length - 1;

  // The live case runs beside the presenter: Play demo drives the backend (director on :7300);
  // the screens are still turned by hand. The agent log and the LLM text come from the case.
  const { current, reachable } = useLiveCase();
  const reopened = !!current && current.checkpoint !== "created" && current.checkpoint !== "diagnosed";
  const { revealed, instant } = useRevealed(current?.id ?? "", visibleEventCount(current), reopened);
  const rawLive = frameFromCase(current ? replayCase(current, revealed) : null, reachable);
  const { shown, typing } = useTypewriter(rawLive.live?.assessment ?? "", rawLive.caseId, instant);
  const liveFrame = rawLive.live
    ? { ...rawLive, live: { ...rawLive.live, assessment: shown || undefined, typing } }
    : rawLive;
  const director = useDirector();

  function go(next: number) {
    const target = clampStep(next);
    if (target === step) return;
    if (target > step) {
      const key = `fixture-view:${STEPS[target].id}`;
      seen.current.add(key);
    }
    setStep(target);
  }

  function requestTechnician(id: TechId) {
    const slotId = slotIdForTechnician(id);
    if (!slotId) return;
    setTechId(id);
    setAppointment((current) =>
      reduceAppointment(current, {
        type: "request",
        technicianId: id,
        slotId,
      }),
    );
    go(5);
  }

  function confirmRequested() {
    setAppointment((current) => reduceAppointment(current, { type: "confirm-requested" }));
  }

  function offerInstead(technicianId: string, reason: string) {
    const slotId = slotIdForTechnician(technicianId);
    if (!slotId || (technicianId !== "alex" && technicianId !== "maria")) return;
    setAppointment((current) =>
      reduceAppointment(current, {
        type: "counteroffer",
        technicianId,
        slotId,
        reason,
      }),
    );
  }

  function acceptCounteroffer() {
    setAppointment((current) => reduceAppointment(current, { type: "accept-counteroffer" }));
  }

  function declineCounteroffer() {
    setAppointment((current) => reduceAppointment(current, { type: "decline-counteroffer" }));
  }

  function reset() {
    seen.current.clear();
    setTechId("alex");
    setAppointment(emptyAppointment());
    setStep(0);
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
      setStep((current) => {
        const targetStep = clampStep(event.key === "ArrowRight" ? current + 1 : current - 1);
        if (targetStep > current) {
          seen.current.add(`fixture-view:${STEPS[targetStep].id}`);
        }
        return targetStep;
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (mode === "backend") {
    return <LiveRescueDemo mode="backend" />;
  }

  return (
    <main className="flex h-dvh flex-col bg-sand px-4 py-3 text-ink">
      <header className="mb-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
            Nara Home Rescue
            {liveFrame.live?.workerPid ? ` · live · coordinator pid ${liveFrame.live.workerPid}` : ""}
            {director?.running ? ` · ${director.step}` : ""}
          </p>
          <h1 className="nara-serif text-[26px] leading-tight">
            A home that remembers, reasons, and acts.
          </h1>
        </div>
        {director ? (
          <button
            type="button"
            onClick={() => playDemo().catch((error) => console.error(error))}
            disabled={director.running}
            className="h-11 rounded-full bg-sage px-5 text-[15px] font-semibold text-cream disabled:opacity-60"
          >
            {director.running ? "Playing…" : "Play demo"}
          </button>
        ) : null}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 min-[1180px]:grid-cols-[340px_minmax(0,1fr)_220px]">
        <HomeownerPane
          frame={frame}
          view={view}
          live={liveFrame.live}
          onReport={() => go(1)}
          onRequest={requestTechnician}
          onAccept={acceptCounteroffer}
          onDecline={declineCounteroffer}
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
            onConfirmRequested={confirmRequested}
            onOfferInstead={offerInstead}
          />
        </section>
        {liveFrame.events.length > 0 ? (
          <LiveActivityPane frame={liveFrame} />
        ) : (
          <ActivityPane frame={{ ...frame, inspector: inspectorFor(frame.inspector, view, appointment) }} />
        )}
      </div>

      <PresenterBar
        step={step}
        last={last}
        label={frame.stepLabel}
        onPrevious={() => go(step - 1)}
        onNext={() => go(step + 1)}
        onReset={reset}
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
      relay: `Simulated confirmation for ${view.windowLabel}. Not received from Agent Relay.`,
      statusLabel: "confirmed",
      checkpoint: "booked",
    };
  }
  if (view.phase === "counteroffer") {
    return {
      ...inspector,
      relay: `Simulated counteroffer for ${view.windowLabel}. Not confirmed. Not received from Agent Relay.`,
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


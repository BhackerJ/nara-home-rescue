import { ALTERNATE_SLOT, REQUESTED_SLOT } from "@/contracts/case";
import type { DemoFrame } from "@/demo/liveFrame";
import { NaraMark } from "../NaraMark";

export function ShopPane({
  frame,
  onConfirm,
}: {
  frame: DemoFrame;
  onConfirm?: () => void;
}) {
  return (
    <section aria-label="HVAC shop" className="flex min-h-0 flex-col">
      <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">
        HVAC shop
      </p>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] bg-cream ring-1 ring-line/80">
        <header className="flex items-center justify-between gap-4 border-b border-line/80 px-5 py-4">
          <div className="flex items-center gap-4">
            <NaraMark />
            <div>
              <p className="text-[18px] font-semibold">Cool Air Mechanical</p>
              <p className="text-[14px] text-muted">Nara cases only · internal schedule stays private</p>
            </div>
          </div>
          <span className="rounded-full bg-sage-soft px-3 py-1 text-[13px] font-semibold text-sage-deep">
            Today
          </span>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
          {!frame.showPacket ? (
            <div className="rounded-[22px] bg-paper px-5 py-8 text-center ring-1 ring-line/70">
              <p className="nara-serif text-[28px]">Waiting for a Nara case</p>
              <p className="mt-2 text-[16px] text-ink/70">
                Equipment and history will arrive with the request.
              </p>
            </div>
          ) : (
            <div key={frame.justArrived ? "arrived" : "packet"} className="rise space-y-3">
              {frame.justArrived ? (
                <p className="rounded-2xl bg-sage-soft px-4 py-3 text-[16px] font-semibold text-sage-deep">
                  New Nara service case
                </p>
              ) : null}
              <article className="rounded-[22px] bg-paper p-4 ring-1 ring-line/70">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
                      Technician-ready packet
                    </p>
                    <h2 className="nara-serif mt-1 text-[28px] leading-tight">
                      {frame.live?.issue || "AC isn’t cooling"}
                    </h2>
                    <p className="mt-1 text-[15px] text-ink/70">1847 Maple Street, Hayward</p>
                  </div>
                  <p className="font-mono text-[13px] text-muted">{frame.caseId}</p>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Equipment
                    </dt>
                    <dd className="mt-1 text-[16px]">2014 Carrier condenser · 3-ton</dd>
                  </div>
                  <div>
                    <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Reported
                    </dt>
                    <dd className="mt-1 text-[16px]">Indoor airflow present. Outdoor unit not running.</dd>
                  </div>
                  <div>
                    <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
                      History
                    </dt>
                    <dd className="mt-1 text-[16px]">Capacitor replaced in 2023. Annual service in 2021.</dd>
                  </div>
                  <div>
                    <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Assessment
                    </dt>
                    <dd className="mt-1 text-[16px]">
                      {frame.live?.assessment ??
                        "Context for the visit. Not a confirmed capacitor fault."}
                    </dd>
                  </div>
                </dl>
              </article>

              <Appointment frame={frame} onConfirm={onConfirm} />

              {frame.live?.recovery ? (
                <p className="rounded-2xl bg-gold-soft px-4 py-3 text-[15px] leading-snug">
                  Coordinator came back:{" "}
                  <span className="font-mono text-[17px] font-semibold">
                    pid {frame.live.recovery.previousPid} → pid {frame.live.recovery.pid}
                  </span>
                  , resumed from {frame.live.recovery.fromCheckpoint}. Case reloaded from Durable
                  Actors; missed messages caught up from Agent Relay. The assessment above was not
                  rewritten.
                </p>
              ) : frame.stage === "recovery" ? (
                <p className="rounded-2xl bg-gold-soft px-4 py-3 text-[15px] leading-snug">
                  Simulated resume from checkpoint slot_requested. The assessment above was not
                  rewritten. No process was stopped.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Appointment({ frame, onConfirm }: { frame: DemoFrame; onConfirm?: () => void }) {
  const requested = frame.live?.requestedSlot || REQUESTED_SLOT;
  const offered = frame.live?.offeredSlot ?? ALTERNATE_SLOT;
  const confirmed = frame.live?.confirmedSlot ?? offered;
  const technician = frame.live?.technician;
  const copy =
    frame.slot === "rejected"
      ? { label: "Unavailable", title: requested, note: "Cool Air already has this window." }
      : frame.slot === "counteroffer"
        ? { label: "Counteroffer", title: offered, note: `Offered instead of ${requested}.` }
        : frame.slot === "confirmed"
          ? {
              label: "Confirmed",
              title: technician ? `${confirmed} · ${technician.name}` : confirmed,
              note: technician ? `${technician.title} · Cool Air Mechanical.` : "Cool Air Mechanical.",
            }
          : { label: "Requested", title: requested, note: "Asked first." };
  const showTechnician = technician && (frame.slot === "rejected" || frame.slot === "counteroffer");

  return (
    <article
      key={frame.slot}
      className="rise rounded-[22px] bg-paper p-4 ring-1 ring-line/70"
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{copy.label}</p>
      <p className="nara-serif mt-1 text-[26px] leading-tight">{copy.title}</p>
      <p className="mt-1 text-[15px] text-ink/75">{copy.note}</p>
      {showTechnician ? (
        <div className="mt-3 rounded-2xl bg-sage-soft px-4 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sage-deep">
            Assigned technician
          </p>
          <p className="mt-1 text-[18px] font-semibold">{technician.name}</p>
          <p className="text-[15px] text-ink/75">{technician.title}</p>
          {frame.live?.offerReason ? (
            <p className="mt-2 text-[15px] leading-snug text-ink/85">{frame.live.offerReason}</p>
          ) : null}
        </div>
      ) : null}
      {frame.live?.canConfirm && onConfirm ? (
        <button
          type="button"
          onClick={onConfirm}
          className="mt-4 h-12 w-full rounded-full bg-sage text-[17px] font-semibold text-cream"
        >
          Confirm {offered}
        </button>
      ) : null}
    </article>
  );
}

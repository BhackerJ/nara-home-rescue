import { ALTERNATE_SLOT, REQUESTED_SLOT } from "@/contracts/case";
import type { DemoFrame } from "@/demo/script";
import { NaraMark } from "./NaraMark";

export function ShopPane({ frame }: { frame: DemoFrame }) {
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
                    <h2 className="nara-serif mt-1 text-[28px] leading-tight">AC isn’t cooling</h2>
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
                      Context for the visit. Not a confirmed capacitor fault.
                    </dd>
                  </div>
                </dl>
              </article>

              <Appointment frame={frame} />

              {frame.stage === "recovery" ? (
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

function Appointment({ frame }: { frame: DemoFrame }) {
  const copy =
    frame.slot === "rejected"
      ? { label: "Unavailable", title: REQUESTED_SLOT, note: "Cool Air already has this window." }
      : frame.slot === "counteroffer"
        ? { label: "Counteroffer", title: ALTERNATE_SLOT, note: "Offered instead of 5:30–7:00 PM." }
        : frame.slot === "confirmed"
          ? { label: "Confirmed", title: ALTERNATE_SLOT, note: "Cool Air Mechanical." }
          : { label: "Requested", title: REQUESTED_SLOT, note: "Asked first." };

  return (
    <article
      key={frame.slot}
      className="rise rounded-[22px] bg-paper p-4 ring-1 ring-line/70"
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{copy.label}</p>
      <p className="nara-serif mt-1 text-[26px] leading-tight">{copy.title}</p>
      <p className="mt-1 text-[15px] text-ink/75">{copy.note}</p>
    </article>
  );
}

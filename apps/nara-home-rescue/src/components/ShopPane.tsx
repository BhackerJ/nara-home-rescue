import { packetHistoryLines } from "@/data/serviceHistory";
import type { RosterTech } from "@/demo/roster";
import type { DemoFrame } from "@/demo/script";
import { NaraMark } from "./NaraMark";

export function ShopPane({ frame }: { frame: DemoFrame }) {
  const waiting = frame.shop === "waiting";

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
          {waiting ? (
            <div className="rounded-[22px] bg-paper px-5 py-8 text-center ring-1 ring-line/70">
              <p className="nara-serif text-[28px]">Waiting for a Nara case</p>
              <p className="mt-2 text-[16px] text-ink/70">
                Equipment and history will arrive with the request.
              </p>
            </div>
          ) : (
            <div key={frame.shop} className="rise space-y-3">
              {frame.shop === "packet" ? (
                <p className="rounded-2xl bg-sage-soft px-4 py-3 text-[16px] font-semibold text-sage-deep">
                  New Nara service case
                </p>
              ) : null}
              <Packet caseId={frame.fixture.caseId} preference={frame.preference} />
              <Appointment phase={frame.shop} preference={frame.preference} />
              {frame.shop === "held" ? (
                <p className="rounded-2xl bg-gold-soft px-4 py-3 text-[15px] leading-snug">
                  Simulated fixture. Checkpoint counteroffer is still the case state. Recovery is
                  not available in this repository, and no process was stopped.
                </p>
              ) : null}
              {frame.shop === "enroute" ? (
                <p className="rounded-2xl bg-paper px-4 py-3 text-[15px] leading-snug ring-1 ring-line/70">
                  Simulated status · on the way. Illustrated route only. Not live GPS.
                </p>
              ) : null}
              {frame.shop === "onsite" ? (
                <p className="rounded-2xl bg-paper px-4 py-3 text-[15px] leading-snug ring-1 ring-line/70">
                  Simulated status · on site. Prototype quote only. Not a live repair.
                </p>
              ) : null}
              {frame.shop === "complete" ? (
                <p className="rounded-2xl bg-sage-soft px-4 py-3 text-[15px] leading-snug text-sage-deep">
                  Simulated outcome recorded on the fixture. Not a field repair.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Packet({
  caseId,
  preference,
}: {
  caseId: string | null;
  preference: RosterTech | null;
}) {
  return (
    <article className="rounded-[22px] bg-paper p-4 ring-1 ring-line/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
            Technician-ready packet
          </p>
          <h2 className="nara-serif mt-1 text-[28px] leading-tight">AC isn’t cooling</h2>
          <p className="mt-1 text-[15px] text-ink/70">1847 Maple Street, Hayward</p>
        </div>
        <p className="font-mono text-[13px] text-muted">{caseId}</p>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Equipment</dt>
          <dd className="mt-1 text-[16px]">2014 Carrier condenser · 3-ton</dd>
        </div>
        <div>
          <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Reported</dt>
          <dd className="mt-1 text-[16px]">Indoor airflow present. Outdoor unit not running.</dd>
        </div>
        <div>
          <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">History</dt>
          <dd className="mt-1 text-[16px]">{packetHistoryLines().join(" ")}</dd>
        </div>
        <div>
          <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Assessment</dt>
          <dd className="mt-1 text-[16px]">Context for the visit. Not a confirmed capacitor fault.</dd>
        </div>
        <div>
          <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
            Preferred technician
          </dt>
          <dd className="mt-1 text-[16px]">
            {preference
              ? `${preference.name} · ${preference.availabilityLabel}`
              : "None yet"}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function Appointment({
  phase,
  preference,
}: {
  phase: DemoFrame["shop"];
  preference: RosterTech | null;
}) {
  const requested = preference?.availabilityLabel ?? "Today · 5:30–7:00 PM";

  if (phase === "unavailable") {
    return (
      <article className="rounded-[22px] bg-paper p-4 ring-1 ring-line/70">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Unavailable</p>
        <p className="nara-serif mt-1 text-[26px] leading-tight line-through decoration-ink/40">
          {requested}
        </p>
        <p className="mt-1 text-[15px] text-ink/75">Cool Air does not have this window.</p>
      </article>
    );
  }

  if (phase === "counteroffer" || phase === "held") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-[22px] bg-paper p-4 ring-1 ring-line/70">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Unavailable</p>
          <p className="nara-serif mt-1 text-[22px] leading-tight line-through decoration-ink/40">
            {requested}
          </p>
        </article>
        <article className="rounded-[22px] bg-paper p-4 ring-1 ring-sage/30">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sage-deep">
            Counteroffer
          </p>
          <p className="nara-serif mt-1 text-[22px] leading-tight">{requested}</p>
        </article>
      </div>
    );
  }

  if (
    phase === "confirmed" ||
    phase === "enroute" ||
    phase === "onsite" ||
    phase === "complete"
  ) {
    return (
      <article className="rounded-[22px] bg-paper p-4 ring-1 ring-sage/30">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sage-deep">Confirmed</p>
        <p className="nara-serif mt-1 text-[26px] leading-tight">{requested}</p>
        <p className="mt-1 text-[15px] text-ink/75">
          One booking{preference ? ` · ${preference.name}` : ""}.
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-[22px] bg-paper p-4 ring-1 ring-line/70">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Requested</p>
      <p className="nara-serif mt-1 text-[26px] leading-tight">{requested}</p>
      <p className="mt-1 text-[15px] text-ink/75">Asked first. Cool Air still confirms it.</p>
    </article>
  );
}

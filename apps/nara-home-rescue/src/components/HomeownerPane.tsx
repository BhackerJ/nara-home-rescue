import { ALTERNATE_SLOT } from "@/contracts/case";
import type { DemoFrame } from "@/demo/script";

export function HomeownerPane({ frame }: { frame: DemoFrame }) {
  return (
    <section aria-label="Homeowner" className="flex min-h-0 flex-col">
      <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">
        Homeowner
      </p>
      <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col overflow-hidden rounded-[36px] bg-cream shadow-[0_24px_60px_rgba(30,26,22,0.16)] ring-1 ring-black/5">
        <div className="flex items-center justify-between px-6 pt-5">
          <p className="nara-serif text-[22px]">Nara Home</p>
          <span className="rounded-full bg-sage-soft px-3 py-1 text-[12px] font-semibold text-sage-deep">
            Hayward
          </span>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-auto px-5 py-4">
          <article className="rounded-[22px] bg-paper p-4 ring-1 ring-line/80">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Home Twin</p>
            <h2 className="nara-serif mt-1 text-[26px] leading-tight">1847 Maple Street</h2>
            <p className="mt-1 text-[15px] text-ink/70">The home Nara already knows.</p>
          </article>

          <article className="rounded-[22px] bg-paper p-4 ring-1 ring-line/80">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">HVAC</p>
            <p className="mt-1 text-[18px] font-semibold">2014 Carrier condenser</p>
            <p className="text-[15px] text-ink/70">3-ton central air</p>
          </article>

          <article className="rounded-[22px] bg-paper p-4 ring-1 ring-line/80">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
              This home
            </p>
            <ul className="mt-2 space-y-2">
              {frame.history.map((entry) => (
                <li
                  key={entry.id}
                  className={`rounded-2xl px-3 py-2 ${
                    entry.emphasis === "scheduled"
                      ? "bg-sage-soft"
                      : entry.emphasis === "context" && frame.highlightHistory
                        ? "bg-gold-soft"
                        : ""
                  }`}
                >
                  <p className="text-[13px] font-semibold text-muted">{entry.year}</p>
                  <p className="text-[16px] font-semibold">{entry.title}</p>
                  <p className="text-[14px] leading-snug text-ink/75">{entry.detail}</p>
                </li>
              ))}
            </ul>
          </article>

          <HomeownerMoment frame={frame} />
        </div>
      </div>
    </section>
  );
}

function HomeownerMoment({ frame }: { frame: DemoFrame }) {
  if (frame.homeowner === "twin") {
    return (
      <div className="rounded-full bg-sage px-4 py-3 text-center text-[16px] font-semibold text-cream">
        Report a problem
      </div>
    );
  }

  return (
    <div key={frame.homeowner} className="rise space-y-3">
      <article className="rounded-[22px] bg-sand/70 p-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">You</p>
        <p className="nara-serif mt-1 text-[22px] leading-tight">My AC isn’t cooling.</p>
      </article>
      {frame.homeowner === "submitted" || frame.homeowner === "reading" ? (
        <p className="text-[16px] leading-snug text-ink/80">
          {frame.homeowner === "reading"
            ? "Nara is reading this home’s equipment and service history."
            : "Nara is taking it from here."}
        </p>
      ) : null}
      {frame.showAssessment ? (
        <article className="rounded-[22px] bg-sage-soft p-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sage-deep">
            Nara’s assessment
          </p>
          <p className="mt-2 text-[16px] leading-snug text-ink">
            Air is moving inside. The outdoor unit is not running. The 2023 capacitor
            replacement is useful context for the technician. It is not a confirmed fault.
          </p>
        </article>
      ) : null}
      {frame.homeowner === "arranging" ? (
        <p className="text-[16px] leading-snug text-ink/80">
          {frame.slot === "counteroffer"
            ? `Cool Air Mechanical can come ${ALTERNATE_SLOT}.`
            : "A technician-ready request is with Cool Air Mechanical."}
        </p>
      ) : null}
      {frame.homeowner === "confirmed" ? (
        <article className="rounded-[22px] bg-paper p-4 ring-1 ring-sage/30">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sage-deep">
            Confirmed
          </p>
          <p className="nara-serif mt-1 text-[24px] leading-tight">{ALTERNATE_SLOT}</p>
          <p className="mt-1 text-[15px] text-ink/75">Cool Air Mechanical</p>
          {frame.stage === "remembered" ? (
            <p className="mt-2 text-[15px] font-medium text-sage-deep">Saved on this home.</p>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}

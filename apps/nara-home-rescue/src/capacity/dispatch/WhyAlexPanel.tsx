import type { MatchResult } from "@/capacity/lib/matching";

export function WhyAlexPanel({
  match,
  onClose,
}: {
  match: MatchResult;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-ink/25 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <aside
        className="animate-rise h-full w-full max-w-md overflow-y-auto bg-cream px-6 py-6 shadow-[-20px_0_50px_rgba(30,26,22,0.12)]"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
          Why this ranking?
        </p>
        <h2 className="nara-serif mt-2 text-[28px] leading-tight">
          {match.technician.name}
        </h2>
        <p className="mt-2 text-[16px] text-ink/80">
          Overall fit: {match.score}
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Nara prioritizes the probability of successful resolution over simply
          choosing the closest technician.
        </p>

        <ul className="mt-6 space-y-3">
          {match.reasons.map((reason) => (
            <li key={reason} className="flex gap-3 text-[15px] text-ink/90">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sage" />
              {reason}
            </li>
          ))}
        </ul>

        {match.components ? (
          <div className="mt-8 rounded-[20px] bg-paper p-4 ring-1 ring-line/70">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
              How the fit was scored
            </p>
            <ul className="mt-3 space-y-2.5">
              {match.factors.map((factor) => (
                <li key={factor.label}>
                  <div className="flex justify-between text-[12px]">
                    <span>
                      {factor.label} · {factor.weight}
                    </span>
                    <span className="font-medium">
                      {Math.round(factor.value * 100)} / 100
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-sage"
                      style={{ width: `${factor.value * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-8 h-12 w-full rounded-full bg-sage text-[14px] font-semibold text-cream"
        >
          Close
        </button>
      </aside>
    </div>
  );
}

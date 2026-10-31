"use client";

import { useState } from "react";
import type { DemoFrame } from "@/demo/liveFrame";

const AGENT_LABEL = {
  diagnostic: "Diagnostic",
  dispatch: "Dispatch",
  provider: "Provider",
  actor: "Durable Actor",
  relay: "Agent Relay",
} as const;

export function ActivityPane({ frame, banner }: { frame: DemoFrame; banner?: string }) {
  const [open, setOpen] = useState(true);

  return (
    <section aria-label="Agent activity" className="flex min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">
          Agent activity
        </p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-full px-3 py-1 text-[13px] font-semibold text-sage-deep underline decoration-sage/30 underline-offset-4"
          aria-expanded={open}
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] bg-cream ring-1 ring-line/80">
          <div className="border-b border-line/80 px-4 py-3">
            {frame.live ? (
              <>
                <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-sage-deep">
                  <span aria-hidden className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-sage" />
                  Live · polling the case every 300 ms
                </p>
                {banner ? (
                  <p className="mt-2 rounded-xl bg-ink px-3 py-2 text-[16px] font-bold leading-snug text-cream">
                    ▶ {banner}
                  </p>
                ) : null}
                <p className="mt-1 text-[14px] leading-snug text-ink/70">
                  Real events from the case. Nothing here is scripted.
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-gold">
                  Simulated
                </p>
                <p className="mt-1 text-[15px] leading-snug text-ink/80">
                  Scripted for this screen. Not live actor or Relay traffic.
                </p>
              </>
            )}
            <p className="mt-2 font-mono text-[13px] text-muted">
              {frame.caseOpen ? frame.caseId : "no case"} · {frame.status} · {frame.checkpoint}
            </p>
          </div>
          <ol className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
            {[...frame.events].reverse().map((event) => (
              <li key={event.id} className="rise rounded-2xl bg-paper px-3 py-2 ring-1 ring-line/70">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[13px] font-semibold text-sage-deep">{AGENT_LABEL[event.agent]}</p>
                  <time className="text-[12px] text-muted">{event.clock}</time>
                </div>
                <p className="text-[15px] font-semibold">{event.title}</p>
                <p className="text-[14px] leading-snug text-ink/75">{event.detail}</p>
                {event.tags?.length ? (
                  <ul className="mt-1.5 flex flex-wrap gap-1">
                    {event.tags.map((tag) => (
                      <Tag key={tag} tag={tag} />
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="rounded-[28px] bg-cream px-4 py-6 text-[15px] text-ink/70 ring-1 ring-line/80">
          {frame.events.length} {frame.live ? "" : "simulated "}events hidden.
        </p>
      )}
    </section>
  );
}

/** One line of small text per row, no background: the system or model that produced it. */
function Tag({ tag }: { tag: string }) {
  const [name, ...rest] = tag.split(" · ");
  const detail = rest.join(" · ");
  return (
    <li className="text-[12px] leading-tight text-muted">
      <span className="font-semibold text-sage-deep">{name}</span>
      {detail ? <span> · {detail}</span> : null}
    </li>
  );
}

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

export function ActivityPane({ frame }: { frame: DemoFrame }) {
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
                <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-sage-deep">
                  Live
                </p>
                <p className="mt-1 text-[15px] leading-snug text-ink/80">
                  Every row is a real event: Durable Actors state, Agent Relay messages, OpenAI
                  decisions, Supabase writes.
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
            {frame.events.map((event) => (
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
                      <li
                        key={tag}
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          tag.startsWith("OpenAI")
                            ? "bg-gold-soft text-ink"
                            : tag.startsWith("caught up")
                              ? "bg-gold text-cream"
                              : "bg-sage-soft text-sage-deep"
                        }`}
                      >
                        {tag}
                      </li>
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

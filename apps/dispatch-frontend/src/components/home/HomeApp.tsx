"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CaseEvent, ServiceCase } from "@/contracts/serviceCase";
import { HOME_TWIN } from "@/lib/homeTwin";
import { NaraMark, PrimaryButton } from "@/components/ui";

// Homeowner side of the demo (docs/plan-1h.md §1, docs/demo-2min.md).
// Left: the Home Twin. Right: the report form, then the live case timeline polled from the actor.

const SYMPTOMS = ["Fan runs", "No cold air", "Outdoor unit not running"];
const SLOTS = ["Tue 9:00", "Tue 13:00", "Wed 9:00", "Wed 14:00"];
const STORAGE_KEY = "nara-home-case";

type HistoryEntry = { date: string; summary: string; caseId?: string };

export function HomeApp() {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [live, setLive] = useState<ServiceCase | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // ?case=<id> reopens a case (rehearsal, screenshots); otherwise the one this tab submitted.
      // Read after mount, not in the initializer: the server renders the form, so a lazy initializer would mismatch on hydration.
      const fromUrl = new URLSearchParams(window.location.search).get("case");
      const saved = fromUrl ?? window.sessionStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of URL/sessionStorage after mount
      if (saved) setCaseId(saved);
    } catch {
      // Private window or storage blocked; start fresh.
    }
  }, []);

  useEffect(() => {
    if (!caseId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const res = await fetch(`/api/cases/${encodeURIComponent(caseId!)}`, { cache: "no-store" });
        if (res.ok && !stopped) setLive((await res.json()) as ServiceCase);
      } catch {
        // Actor server restarting; keep what is on screen.
      }
      if (!stopped) timer = setTimeout(poll, 300);
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [caseId]);

  async function submit(input: { issue: string; symptoms: string[]; preferredSlot: string }) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`POST /api/cases → ${res.status}`);
      const { caseId: id } = (await res.json()) as { caseId: string };
      try {
        window.sessionStorage.setItem(STORAGE_KEY, id);
        window.history.replaceState(null, "", `/home?case=${encodeURIComponent(id)}`);
      } catch {
        // ignore
      }
      setLive(null);
      setCaseId(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
      window.history.replaceState(null, "", "/home");
    } catch {
      // ignore
    }
    setCaseId(null);
    setLive(null);
  }

  const newHistory = historyFromEvents(live?.events ?? []);

  return (
    <div className="min-h-dvh bg-sand text-ink">
      <header className="border-b border-line/80 bg-cream/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-4">
            <NaraMark />
            <div className="hidden h-8 w-px bg-line md:block" />
            <div>
              <p className="text-[18px] font-semibold">Home Rescue</p>
              <p className="text-[13px] text-muted">{HOME_TWIN.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[14px]">
            {live?.worker ? (
              <span className="rounded-full bg-sage-soft px-3 py-1 font-mono text-[13px] font-medium text-sage-deep">
                coordinator pid {live.worker.pid}
              </span>
            ) : null}
            <Link href="/dispatch" className="text-muted underline decoration-line underline-offset-4">
              Provider view
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-5 py-6 lg:grid-cols-[1fr_1.4fr]">
        <HomeTwinPanel newHistory={newHistory} />
        <section className="rounded-[24px] bg-cream p-6 ring-1 ring-line/70">
          {!caseId ? (
            <ReportForm onSubmit={submit} submitting={submitting} error={error} />
          ) : (
            <CaseTimeline caseId={caseId} live={live} onReset={reset} />
          )}
        </section>
      </main>
    </div>
  );
}

function HomeTwinPanel({ newHistory }: { newHistory: HistoryEntry[] }) {
  const eq = HOME_TWIN.equipment[0];
  const history: HistoryEntry[] = [...HOME_TWIN.history, ...newHistory];
  return (
    <section className="rounded-[24px] bg-cream p-6 ring-1 ring-line/70">
      <p className="text-[14px] font-semibold uppercase tracking-wide text-muted">Home Twin</p>
      <h2 className="nara-serif mt-1 text-[28px]">{HOME_TWIN.label}</h2>
      <p className="text-[15px] text-muted">
        {HOME_TWIN.address}, {HOME_TWIN.city}, {HOME_TWIN.state}
      </p>

      <div className="mt-5 rounded-2xl bg-paper p-5 ring-1 ring-line/70">
        <p className="text-[14px] font-semibold uppercase tracking-wide text-muted">Equipment</p>
        <p className="mt-1 text-[20px] font-semibold">
          {eq.brand} {eq.model}
        </p>
        <p className="text-[15px] text-ink/80">
          {eq.type} · installed {eq.installedYear}
        </p>
      </div>

      <div className="mt-5">
        <p className="text-[14px] font-semibold uppercase tracking-wide text-muted">Service history</p>
        <ul className="mt-2 space-y-2">
          {history.map((h, i) => {
            const fresh = i >= HOME_TWIN.history.length;
            return (
              <li
                key={`${h.date}-${i}`}
                className={`rounded-2xl p-4 ring-1 ${
                  fresh ? "animate-[rise_.5s_ease-out] bg-sage-soft ring-sage/40" : "bg-paper ring-line/70"
                }`}
              >
                <p className="font-mono text-[16px] text-muted">{h.date}</p>
                <p className="text-[16px]">{h.summary}</p>
                {fresh ? <p className="mt-1 text-[13px] font-semibold text-sage-deep">Added just now</p> : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function ReportForm({
  onSubmit,
  submitting,
  error,
}: {
  onSubmit: (input: { issue: string; symptoms: string[]; preferredSlot: string }) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [issue, setIssue] = useState("My AC isn't cooling.");
  const [symptoms, setSymptoms] = useState<string[]>(SYMPTOMS);
  const [slot, setSlot] = useState(SLOTS[0]);

  return (
    <div>
      <p className="text-[14px] font-semibold uppercase tracking-wide text-muted">Report a problem</p>
      <h2 className="nara-serif mt-1 text-[28px]">What’s wrong?</h2>

      <label className="mt-5 block text-[14px] font-semibold text-muted">Describe it</label>
      <textarea
        value={issue}
        onChange={(e) => setIssue(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-2xl bg-paper p-4 text-[18px] ring-1 ring-line/70 outline-none focus:ring-sage"
      />

      <p className="mt-4 text-[14px] font-semibold text-muted">Symptoms</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {SYMPTOMS.map((s) => {
          const on = symptoms.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSymptoms(on ? symptoms.filter((x) => x !== s) : [...symptoms, s])}
              className={`rounded-full px-4 py-2 text-[15px] font-medium ring-1 transition ${
                on ? "bg-sage text-cream ring-sage" : "bg-paper text-ink ring-line"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-[14px] font-semibold text-muted">Preferred time</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSlot(s)}
            className={`rounded-full px-4 py-2 text-[15px] font-medium ring-1 transition ${
              slot === s ? "bg-ink text-cream ring-ink" : "bg-paper text-ink ring-line"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <PrimaryButton onClick={() => onSubmit({ issue, symptoms, preferredSlot: slot })} disabled={submitting}>
          {submitting ? "Sending…" : "Ask Nara to fix it"}
        </PrimaryButton>
      </div>
      {error ? <p className="mt-3 text-[14px] text-red-700">{error}</p> : null}
    </div>
  );
}

// Display pacing only (design-hackathon §7): the model finishes in ~1 s, so the card reveals the text it already has
// at ~8 characters per 60 ms (≈3 s for 500 chars). A case that already has its narrative on first render shows it at once.
function useTypewriter(target: string) {
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (shown === target) return;
    if (!target.startsWith(shown)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the text was replaced, not extended
      setShown(target);
      return;
    }
    const timer = setTimeout(() => setShown(target.slice(0, shown.length + 8)), 60);
    return () => clearTimeout(timer);
  }, [shown, target]);
  return shown;
}

function CaseTimeline({ caseId, live, onReset }: { caseId: string; live: ServiceCase | null; onReset: () => void }) {
  const events = live?.events ?? [];
  const diagnosedAt = events.find((e) => e.type === "step_completed" && e.payload.step === "diagnosed")?.timestamp;
  const fullNarrative = live?.diagnostic.narrative || live?.draftDiagnosis || "";
  const narrative = useTypewriter(fullNarrative);
  const streaming = live?.status === "diagnosing" || narrative.length < fullNarrative.length || (!narrative && live?.status === "created");
  // Agent messages and restarts in the order they happened, so the crash shows where it happened.
  const timeline = events.filter((e) => e.type === "agent_message" || e.type === "recovery_started");
  const errors = events.filter((e) => e.type === "error");

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold uppercase tracking-wide text-muted">Your case</p>
          <h2 className="nara-serif mt-1 text-[28px]">{live?.issue ?? "Opening…"}</h2>
          <p className="font-mono text-[15px] text-muted">{caseId}</p>
        </div>
        <StatusChip status={live?.status ?? "created"} />
      </div>

      <ol className="mt-5 space-y-3">
        <Card title="Diagnosis" meta={diagnosedAt ? `committed ${time(diagnosedAt)}` : streaming ? "streaming from the model…" : undefined} tone="paper">
          {narrative ? (
            <p className="whitespace-pre-wrap text-[18px] leading-relaxed">
              {narrative}
              {streaming ? <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-ink align-middle" /> : null}
            </p>
          ) : (
            <p className="text-[16px] text-muted">Reading the Home Twin and your symptoms…</p>
          )}
        </Card>

        {timeline.map((e) => (e.type === "agent_message" ? <MessageCard key={e.id} event={e} /> : <RecoveryCard key={e.id} event={e} />))}

        {live?.confirmedAppointment ? (
          <Card title="Appointment confirmed" meta="Cool Air Mechanical" tone="sage">
            <p className="text-[22px] font-semibold">{live.confirmedAppointment.confirmedSlot}</p>
          </Card>
        ) : null}

        {errors.map((e) => (
          <Card key={e.id} title="Problem" meta={time(e.timestamp)} tone="red">
            <p className="text-[15px]">{String(e.payload.message ?? "")}</p>
          </Card>
        ))}
      </ol>

      <button type="button" onClick={onReset} className="mt-6 text-[13px] text-muted underline decoration-line underline-offset-4">
        Start a new case
      </button>
    </div>
  );
}

function RecoveryCard({ event }: { event: CaseEvent }) {
  const p = event.payload as { previousPid?: number | null; pid?: number; fromCheckpoint?: string; at?: string };
  return (
    <Card title="Coordinator came back" meta={`${time(p.at ?? event.timestamp)} · resumed from ${p.fromCheckpoint ?? "?"}`} tone="sage">
      <p className="font-mono text-[20px]">
        pid {p.previousPid || "?"} <span className="text-muted">→</span> pid {p.pid}
      </p>
      <p className="mt-1 text-[16px] text-ink/80">
        Case reloaded from Durable Actors; missed messages caught up from Agent Relay. Nothing was redone.
      </p>
    </Card>
  );
}

function MessageCard({ event }: { event: CaseEvent }) {
  const p = event.payload as { from?: string; to?: string; kind?: string; body?: string; backfilled?: boolean };
  const summary = summarize(p.kind ?? "", p.body ?? "");
  return (
    <Card
      title={`${agentName(p.from)} → ${agentName(p.to)}`}
      meta={`${time(event.timestamp)} · via Agent Relay`}
      tone="paper"
      tag={p.backfilled ? "caught up from Relay after restart" : undefined}
    >
      <p className="text-[17px]">{summary}</p>
    </Card>
  );
}

function Card({
  title,
  meta,
  tone,
  tag,
  children,
}: {
  title: string;
  meta?: string;
  tone: "paper" | "sage" | "red";
  tag?: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === "sage"
      ? "bg-sage-soft ring-sage/40"
      : tone === "red"
        ? "bg-red-50 ring-red-200"
        : "bg-paper ring-line/70";
  return (
    <li className={`animate-[rise_.4s_ease-out] rounded-2xl p-5 ring-1 ${cls}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[17px] font-semibold">{title}</p>
        {meta ? <p className="text-[16px] text-muted">{meta}</p> : null}
      </div>
      {tag ? (
        <span className="mt-2 inline-block rounded-full bg-gold px-3 py-1 text-[16px] font-semibold text-cream">{tag}</span>
      ) : null}
      <div className="mt-2">{children}</div>
    </li>
  );
}

function StatusChip({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  const cls =
    status === "confirmed"
      ? "bg-sage text-cream"
      : status === "recovering"
        ? "bg-gold-soft text-gold"
        : status === "failed"
          ? "bg-red-100 text-red-800"
          : "bg-sage-soft text-sage-deep";
  return <span className={`rounded-full px-3 py-1 text-[14px] font-semibold ${cls}`}>{label}</span>;
}

function agentName(a?: string) {
  if (a === "dispatch") return "Nara dispatch agent";
  if (a === "provider") return "Cool Air agent";
  return a ?? "agent";
}

// Message bodies are JSON strings written by the coordinator and provider; show the useful fields.
function summarize(kind: string, body: string): string {
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return body;
  }
  const slot = String(data.slot ?? data.requestedSlot ?? "");
  const alts = Array.isArray(data.alternatives) ? (data.alternatives as string[]).join(" or ") : "";
  switch (kind) {
    case "slot_request":
      return `Requested ${slot || "a slot"} for the repair.`;
    case "reject":
      return `${slot || "That slot"} is taken. Offered ${alts || "other times"}.`;
    case "accept":
      return `Accepted ${slot}.`;
    case "confirm":
      return `Confirmed ${slot}. Technician booked.`;
    default:
      return typeof data.text === "string" ? data.text : body;
  }
}

function historyFromEvents(events: CaseEvent[]): HistoryEntry[] {
  return events
    .filter((e) => e.type === "home_updated")
    .map((e) => {
      const p = e.payload as { historyEntry?: HistoryEntry; date?: string; summary?: string };
      if (p.historyEntry) return p.historyEntry;
      return { date: p.date ?? e.timestamp.slice(0, 10), summary: p.summary ?? "Repair booked", caseId: e.caseId };
    });
}

function time(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

"use client";

import { useEffect, useState } from "react";
import type { ActivityEvent, AgentName, CaseStatus, HistoryEntry } from "@/contracts/case";
import { BASE_HISTORY, STAGES, type DemoFrame, type StageId } from "@/demo/script";

/**
 * Live read model. `/api/*` is proxied to apps/dispatch-frontend (:3100),
 * whose routes read the ServiceCase actor (docs/plan-1h.md §3).
 */

type CaseEvent = {
  id: string;
  timestamp: string;
  agent: string;
  type: string;
  payload: Record<string, unknown>;
};

export type ServiceCase = {
  id: string;
  issue: string;
  symptoms: string[];
  status: CaseStatus;
  checkpoint: string;
  requestedSlot?: string;
  confirmedSlot?: string;
  events: CaseEvent[];
  diagnostic?: { narrative: string };
  counteroffer: { alternatives: string[] } | null;
  /** Streams while status === "diagnosing". */
  draftDiagnosis?: string;
  worker?: { bootId: string; pid: number };
  recovery?: { previousPid: number; pid: number; fromCheckpoint: string; at: string };
};

/**
 * Polls the newest case. Returns null until one exists.
 * A failed poll keeps the last case: the coordinator is killed on purpose during the demo.
 */
export function useLiveCase(pollMs = 300): { current: ServiceCase | null; reachable: boolean } {
  const [current, setCurrent] = useState<ServiceCase | null>(null);
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const index = await fetch("/api/cases", { cache: "no-store" });
        if (!index.ok) throw new Error(String(index.status));
        const { caseIds } = (await index.json()) as { caseIds: string[] };
        const latest = caseIds.at(-1);
        if (latest) {
          const res = await fetch(`/api/cases/${encodeURIComponent(latest)}`, { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          if (!stopped) setCurrent((await res.json()) as ServiceCase);
        }
        if (!stopped) setReachable(true);
      } catch {
        if (!stopped) setReachable(false);
      }
      if (!stopped) timer = setTimeout(poll, pollMs);
    }

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [pollMs]);

  return { current, reachable };
}

/**
 * Display pacing for the assessment (design-hackathon §7: the frontend paces,
 * the backend adds no delay). `shown` catches up to `target` by `step`
 * characters every `intervalMs`: about 3.5 s for a 470-character assessment. A case that is already past diagnosis when it
 * first appears (reopened page) shows its text at once.
 */
export function useTypewriter(
  target: string,
  caseId: string,
  instant: boolean,
  step = 8,
  intervalMs = 60,
): { shown: string; typing: boolean } {
  // Progress is keyed by case so a new case restarts from zero without a reset effect.
  const [progress, setProgress] = useState({ caseId, count: 0 });
  const count = progress.caseId === caseId ? progress.count : 0;
  const shownCount = count === 0 && instant ? target.length : Math.min(count, target.length);

  useEffect(() => {
    if (shownCount >= target.length) return;
    const timer = setTimeout(
      () => setProgress({ caseId, count: Math.min(shownCount + step, target.length) }),
      intervalMs,
    );
    return () => clearTimeout(timer);
  }, [caseId, shownCount, target.length, step, intervalMs]);

  return { shown: target.slice(0, shownCount), typing: shownCount < target.length };
}

/** Homeowner "Report a problem": the backend fills in the demo issue and symptoms. */
export async function createCase(): Promise<string> {
  const res = await fetch("/api/cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`POST /api/cases → ${res.status}`);
  return ((await res.json()) as { caseId: string }).caseId;
}

/** Shop CONFIRM: lets the provider agent book the accepted slot. */
export async function confirmCase(caseId: string): Promise<void> {
  const res = await fetch("/api/provider/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId }),
  });
  if (!res.ok) throw new Error(`POST /api/provider/confirm → ${res.status}`);
}

const STAGE_BY_CHECKPOINT: Record<string, StageId> = {
  created: "context",
  diagnosed: "assessment",
  slot_requested: "received",
  slot_rejected: "rejected",
  slot_accepted: "counteroffer",
  booked: "confirmed",
  home_updated: "remembered",
};

const stageIndex = (id: StageId) => STAGES.findIndex((stage) => stage.id === id);

/** Actor state → the frame the three panes render. */
export function frameFromCase(c: ServiceCase | null, reachable: boolean): DemoFrame {
  if (!c) {
    return {
      index: 0,
      stage: "twin",
      stageLabel: reachable ? STAGES[0].label : "Backend unreachable",
      caseId: "",
      caseOpen: false,
      status: "idle",
      checkpoint: "none",
      homeowner: "twin",
      showAssessment: false,
      showPacket: false,
      justArrived: false,
      slot: "none",
      history: [...BASE_HISTORY],
      highlightHistory: false,
      events: [],
      live: { issue: "", requestedSlot: "", canConfirm: false },
    };
  }

  const stage: StageId =
    c.status === "recovering" ? "recovery" : (STAGE_BY_CHECKPOINT[c.checkpoint] ?? "reported");
  const index = stageIndex(stage);
  const past = (id: StageId) => index >= stageIndex(id);
  const assessment = c.diagnostic?.narrative || c.draftDiagnosis || "";
  const offeredSlot = c.counteroffer?.alternatives[0];
  const negotiation = readNegotiation(c.events);

  const history: HistoryEntry[] = BASE_HISTORY.map((entry, i) =>
    i === 0 && past("context") ? { ...entry, emphasis: "context" } : entry,
  );
  if (c.confirmedSlot) {
    history.unshift({
      id: "scheduled-live",
      year: "Today",
      title: "Service scheduled",
      detail: `${c.confirmedSlot} · Cool Air Mechanical`,
      emphasis: "scheduled",
    });
  }

  return {
    index,
    stage,
    stageLabel: c.status === "failed" ? "Case failed" : STAGES[index].label,
    caseId: c.id,
    caseOpen: true,
    status: c.status,
    checkpoint: c.checkpoint,
    homeowner: past("confirmed")
      ? "confirmed"
      : past("packet")
        ? "arranging"
        : past("assessment")
          ? "assessment"
          : "reading",
    showAssessment: assessment.length > 0,
    showPacket: past("received"),
    justArrived: stage === "received",
    slot: past("confirmed")
      ? "confirmed"
      : stage === "rejected"
        ? "rejected"
        : past("counteroffer")
          ? "counteroffer"
          : past("received")
            ? "requested"
            : "none",
    history,
    highlightHistory: past("context"),
    events: c.events.flatMap(activityRow),
    live: {
      issue: c.issue,
      requestedSlot: c.requestedSlot ?? "",
      offeredSlot,
      confirmedSlot: c.confirmedSlot,
      assessment: assessment || undefined,
      ...negotiation,
      workerPid: c.worker?.pid,
      recovery: c.recovery,
      canConfirm: c.checkpoint === "slot_accepted" && c.status === "awaiting_provider",
    },
  };
}

type Technician = { name: string; title: string };

/** The latest reject, accept and confirm messages carry the shop's technician and the LLM reasons. */
function readNegotiation(events: CaseEvent[]): {
  technician?: Technician;
  offerReason?: string;
  acceptReason?: string;
} {
  const out: { technician?: Technician; offerReason?: string; acceptReason?: string } = {};
  for (const event of events) {
    if (event.type !== "agent_message") continue;
    const body = parseBody(event.payload.body);
    const technician = body.technician as Technician | undefined;
    switch (event.payload.kind) {
      case "reject":
        if (technician?.name) out.technician = technician;
        out.offerReason = nonEmpty(body.reason);
        break;
      case "accept":
        out.acceptReason = nonEmpty(body.reason);
        break;
      case "confirm":
        if (technician?.name) out.technician = technician;
        break;
    }
  }
  return out;
}

function nonEmpty(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body !== "string") return (body as Record<string, unknown>) ?? {};
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const MESSAGE_TITLE: Record<string, string> = {
  summary: "Diagnosis shared",
  slot_request: "Slot requested",
  reject: "Requested slot declined",
  accept: "Alternative accepted",
  confirm: "Appointment confirmed",
};

function activityRow(event: CaseEvent): ActivityEvent[] {
  const p = event.payload;
  const base = { id: event.id, clock: clock(event.timestamp), simulated: false as const };
  const row = (agent: AgentName, title: string, detail: string): ActivityEvent[] => [
    { ...base, agent, title, detail },
  ];

  switch (event.type) {
    case "diagnosed":
      return row("diagnostic", "Assessment written", truncate(String(p.narrative ?? ""), 160));
    case "agent_message": {
      const kind = String(p.kind ?? "");
      const agent: AgentName = p.from === "provider" ? "provider" : "dispatch";
      const caughtUp = p.backfilled ? " · caught up from Relay after restart" : "";
      return row(agent, MESSAGE_TITLE[kind] ?? kind, `${messageText(kind, p.body)} · via Agent Relay${caughtUp}`);
    }
    case "recovery_started":
      return row(
        "actor",
        "Coordinator came back",
        `pid ${String(p.previousPid)} → pid ${String(p.pid)} · resumed from ${String(p.fromCheckpoint)}`,
      );
    case "booking":
      return row(
        "provider",
        p.reused ? "Booking reused" : "Slot booked",
        `${String(p.slot)}${p.technician ? ` · ${String(p.technician)}` : ""} · key ${String(p.idempotencyKey)}`,
      );
    case "home_updated":
      return row(
        "actor",
        "Home Twin updated",
        `${String((p.historyEntry as { summary?: string } | undefined)?.summary ?? "Scheduled visit saved on this home.")}${p.storedInSupabase ? " · stored in Supabase" : ""}`,
      );
    case "error":
      return row("actor", "Error", String(p.message ?? ""));
    default:
      return [];
  }
}

/** Relay bodies are JSON (`{ kind, requestedSlot, alternatives, slot }`); say them in words. */
function messageText(kind: string, body: unknown): string {
  const m = parseBody(body);
  const alternatives = Array.isArray(m.alternatives) ? m.alternatives.join(" or ") : "";
  const technician = m.technician as Technician | undefined;
  const who = technician?.name ? `${technician.name}, ${technician.title}` : "";
  const reason = nonEmpty(m.reason);
  switch (kind) {
    case "slot_request":
      return `Requested ${String(m.requestedSlot ?? "")} for the repair.`;
    case "reject":
      return `${String(m.requestedSlot ?? "")} is taken. Offered ${alternatives}.${who ? ` Proposing ${who}.` : ""}${reason ? ` ${reason}` : ""}`;
    case "accept":
      return `Accepted ${String(m.slot ?? "")}.${reason ? ` ${reason}` : ""}`;
    case "confirm":
      return `Confirmed ${String(m.slot ?? "")}${technician?.name ? ` with ${technician.name}` : ""}. Technician booked.`;
    default:
      return typeof body === "string" ? body : JSON.stringify(body);
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function clock(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? timestamp
    : date.toLocaleTimeString([], { hour12: false });
}

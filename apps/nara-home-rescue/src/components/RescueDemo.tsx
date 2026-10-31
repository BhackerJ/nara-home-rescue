"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { DataMode } from "@/data/adapters";
import { confirmCase, createCase, frameFromCase, useLiveCase, useTypewriter } from "@/data/live";
import { frameAt, STAGES, type DemoFrame } from "@/demo/script";
import { ActivityPane } from "./ActivityPane";
import { HomeownerPane } from "./HomeownerPane";
import { ShopPane } from "./ShopPane";

const STEP_MS = 2200;

export function RescueDemo({ mode }: { mode: DataMode }) {
  return mode === "mock" ? <ScriptedDemo /> : <LiveDemo />;
}

function ScriptedDemo() {
  const [index, setIndex] = useState(0);
  const frame = frameAt(index);

  useEffect(() => {
    if (index >= STAGES.length - 1) return;
    const timer = window.setTimeout(() => setIndex((value) => value + 1), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [index]);

  return (
    <Shell
      frame={frame}
      eyebrow="simulated demo"
      action={
        <button type="button" onClick={() => setIndex(0)} className={BUTTON}>
          Reset demo
        </button>
      }
    />
  );
}

function LiveDemo() {
  const { current, reachable } = useLiveCase();
  const raw = frameFromCase(current, reachable);
  const { shown, typing } = useTypewriter(
    raw.live?.assessment ?? "",
    raw.caseId,
    raw.checkpoint !== "created" && raw.checkpoint !== "diagnosed",
  );
  const frame: DemoFrame = raw.live
    ? {
        ...raw,
        showAssessment: shown.length > 0,
        live: { ...raw.live, assessment: shown || undefined, typing },
      }
    : raw;
  const [busy, setBusy] = useState(false);

  async function report() {
    setBusy(true);
    try {
      await createCase();
    } catch (error) {
      console.error(error);
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (current) confirmCase(current.id).catch((error) => console.error(error));
  }

  return (
    <Shell
      frame={frame}
      eyebrow={
        frame.live?.workerPid ? `live · coordinator pid ${frame.live.workerPid}` : "live"
      }
      action={
        <button type="button" onClick={report} disabled={busy} className={BUTTON}>
          New case
        </button>
      }
      onReport={report}
      onConfirm={confirm}
    />
  );
}

const BUTTON =
  "h-11 rounded-full bg-sage px-5 text-[15px] font-semibold text-cream disabled:opacity-60";

function Shell({
  frame,
  eyebrow,
  action,
  onReport,
  onConfirm,
}: {
  frame: DemoFrame;
  eyebrow: string;
  action: ReactNode;
  onReport?: () => void;
  onConfirm?: () => void;
}) {
  return (
    <main className="flex h-dvh flex-col bg-sand px-4 py-3 text-ink">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
            Nara Home Rescue · {eyebrow}
          </p>
          <h1 className="nara-serif text-[28px] leading-tight">A home that remembers, reasons, and acts.</h1>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[15px] font-medium text-sage-deep" aria-live="polite">
            {frame.stageLabel}
          </p>
          {action}
        </div>
      </header>

      <ol className="mb-3 flex gap-1.5" aria-label="Demo progress">
        {STAGES.map((stage, stageIndex) => (
          <li
            key={stage.id}
            className={`h-1.5 flex-1 rounded-full ${stageIndex <= frame.index ? "bg-sage" : "bg-line"}`}
            title={stage.label}
          />
        ))}
      </ol>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 min-[1100px]:grid-cols-[340px_minmax(0,1fr)_280px]">
        <HomeownerPane frame={frame} onReport={onReport} />
        <ShopPane frame={frame} onConfirm={onConfirm} />
        <ActivityPane frame={frame} />
      </div>
    </main>
  );
}

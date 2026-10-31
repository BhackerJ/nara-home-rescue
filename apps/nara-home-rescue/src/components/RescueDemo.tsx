"use client";

import { useEffect, useState } from "react";
import type { BackendInspection, DataMode } from "@/data/adapters";
import { frameAt, STAGES } from "@/demo/script";
import { ActivityPane } from "./ActivityPane";
import { HomeownerPane } from "./HomeownerPane";
import { NaraMark } from "./NaraMark";
import { ShopPane } from "./ShopPane";

const STEP_MS = 2200;

export function RescueDemo({
  mode,
  backend,
}: {
  mode: DataMode;
  backend: BackendInspection;
}) {
  const [index, setIndex] = useState(0);
  const frame = frameAt(index);

  useEffect(() => {
    if (mode !== "mock") return;
    if (index >= STAGES.length - 1) return;
    const timer = window.setTimeout(() => setIndex((value) => value + 1), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [index, mode]);

  if (mode === "backend") {
    return <BackendGap backend={backend} />;
  }

  return (
    <main className="flex h-dvh flex-col bg-sand px-4 py-3 text-ink">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
            Nara Home Rescue · simulated demo
          </p>
          <h1 className="nara-serif text-[28px] leading-tight">A home that remembers, reasons, and acts.</h1>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[15px] font-medium text-sage-deep" aria-live="polite">
            {frame.stageLabel}
          </p>
          <button
            type="button"
            onClick={() => setIndex(0)}
            className="h-11 rounded-full bg-sage px-5 text-[15px] font-semibold text-cream"
          >
            Reset demo
          </button>
        </div>
      </header>

      <ol className="mb-3 flex gap-1.5" aria-label="Demo progress">
        {STAGES.map((stage, stageIndex) => (
          <li
            key={stage.id}
            className={`h-1.5 flex-1 rounded-full ${stageIndex <= index ? "bg-sage" : "bg-line"}`}
            title={stage.label}
          />
        ))}
      </ol>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 min-[1100px]:grid-cols-[340px_minmax(0,1fr)_280px]">
        <HomeownerPane frame={frame} />
        <ShopPane frame={frame} />
        <ActivityPane frame={frame} />
      </div>
    </main>
  );
}

function BackendGap({ backend }: { backend: BackendInspection }) {
  return (
    <main className="min-h-dvh bg-sand px-6 py-10 text-ink">
      <NaraMark />
      <h1 className="nara-serif mt-6 text-[40px]">Backend mode is not connected</h1>
      <p className="mt-3 max-w-2xl text-[18px] leading-relaxed">
        The only actor in this repository is {backend.actorPresent}, with read and bump. These
        routes are described in the design notes and are not implemented, so this screen does not
        call them.
      </p>
      <ul className="mt-6 space-y-2 font-mono text-[15px]">
        {backend.missing.map((route) => (
          <li key={route}>{route}</li>
        ))}
      </ul>
      <p className="mt-6 text-[16px] text-ink/75">
        Leave NEXT_PUBLIC_NARA_DATA_SOURCE unset, or set it to mock, to play the simulated demo.
      </p>
    </main>
  );
}

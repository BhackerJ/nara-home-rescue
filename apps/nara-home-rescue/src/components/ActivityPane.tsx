import type { DemoFrame } from "@/demo/script";

export function ActivityPane({ frame }: { frame: DemoFrame }) {
  const { inspector, fixture } = frame;

  return (
    <section aria-label="Agent activity" className="flex min-h-0 flex-col">
      <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">
        Agent activity
      </p>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto rounded-[28px] bg-cream p-4 ring-1 ring-line/80">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-gold">
          Simulated fixture
        </p>
        <p className="text-[14px] leading-snug text-ink/70">
          Shown for this step. Not live actor or Relay traffic.
        </p>
        <Field label="Current agent" value={inspector.agent} />
        <Field label="From" value={inspector.from} />
        <Field label="To" value={inspector.to} />
        <Field label="Agent Relay" value={inspector.relay} />
        <Field label="Checkpoint" value={inspector.checkpoint} />
        <Field label="Case status" value={inspector.statusLabel} />
        <Field label="Case" value={fixture.caseId ?? "No case yet"} />
        <Field label="Recovery" value={inspector.recovery} />
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 text-[15px] leading-snug">{value}</p>
    </div>
  );
}

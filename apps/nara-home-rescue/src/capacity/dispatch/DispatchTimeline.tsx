import type { Technician } from "@/capacity/data/technicians";

const START = 13;
const END = 20;
const SPAN = END - START;
const TICKS = [13, 15, 17, 19];

function hourLabel(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour;
  return `${display} ${suffix}`;
}

export function DispatchTimeline({
  technicians,
  assignedId,
}: {
  technicians: Technician[];
  assignedId: string | null;
}) {
  return (
    <section className="rounded-[24px] bg-cream p-5 ring-1 ring-line/70">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
            Today’s dispatch
          </p>
          <h2 className="nara-serif mt-1 text-[22px]">Availability timeline</h2>
        </div>
        <p className="text-[12px] text-muted">1 PM – 8 PM · mock schedule</p>
      </div>

      <div className="mb-2 ml-[132px] grid grid-cols-4 text-[11px] font-medium text-muted">
        {TICKS.map((tick) => (
          <span key={tick}>{hourLabel(tick)}</span>
        ))}
      </div>

      <div className="space-y-2.5">
        {technicians.map((tech) => (
          <div key={tech.id} className="flex items-center gap-3">
            <p className="w-[120px] shrink-0 text-[13px] font-medium">{tech.name.split(" ")[0]}</p>
            <div className="relative h-9 flex-1 overflow-hidden rounded-full bg-paper ring-1 ring-line/70">
              {tech.schedule.map((block) => {
                const left = ((block.start - START) / SPAN) * 100;
                const width = ((block.end - block.start) / SPAN) * 100;
                const tone =
                  block.kind === "open"
                    ? "bg-sage-soft text-sage-deep ring-1 ring-inset ring-sage/20"
                    : block.kind === "nara"
                      ? "bg-sage text-cream"
                      : "bg-line/80 text-ink/70";
                return (
                  <div
                    key={`${tech.id}-${block.start}-${block.label}`}
                    className={`absolute top-1 bottom-1 flex items-center justify-center overflow-hidden rounded-full px-2 text-[10px] font-semibold ${tone}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    {block.kind === "nara" ? "Nara SR" : block.label}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {assignedId ? (
        <p className="mt-3 text-[12px] text-sage-deep">
          Assigned visit placed on the open window.
        </p>
      ) : null}
    </section>
  );
}

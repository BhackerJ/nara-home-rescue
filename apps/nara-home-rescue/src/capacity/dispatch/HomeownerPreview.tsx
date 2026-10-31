"use client";

import { useState } from "react";
import type { Technician } from "@/capacity/data/technicians";

export function HomeownerPreview({
  technician,
  assigned,
  suggested,
  onChoose,
  onClose,
}: {
  technician: Technician;
  assigned?: boolean;
  offered?: boolean;
  suggested?: boolean;
  onChoose?: () => void;
  onClose: () => void;
}) {
  const first = technician.name.split(" ")[0];
  const headline = assigned
    ? `${technician.name} confirmed`
    : suggested
      ? `Cool Air Mechanical suggested ${first}`
      : technician.name;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/30 p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-rise w-full max-w-[420px]"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="mb-3 text-center text-[13px] font-medium text-cream">
          What the homeowner sees
        </p>
        <div className="overflow-hidden rounded-[36px] bg-cream shadow-[0_30px_80px_rgba(30,26,22,0.28)] ring-1 ring-black/5">
          <div className="px-6 pb-7 pt-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
              {assigned ? "Confirmed" : suggested ? "Updated recommendation" : "Recommended"}
            </p>
            <h2 className="nara-serif mt-2 text-[28px] leading-tight">{headline}</h2>
            <p className="mt-1 text-[14px] text-muted">{technician.company}</p>
            <p className="mt-4 text-[15px] font-medium text-ink">
              Recommended for your Carrier AC
            </p>

            <div className="mt-5 flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={technician.portrait}
                alt={technician.name}
                className="h-16 w-16 rounded-full object-cover"
              />
              <p className="text-[14px] leading-relaxed text-ink/80">
                {suggested
                  ? `Alex’s schedule changed. ${first} has strong Carrier experience and can arrive during the same window.`
                  : "Strong Carrier experience and an excellent fit for this cooling issue."}
              </p>
            </div>

            <div className="mt-4 rounded-2xl bg-sage-soft px-4 py-3 text-[14px] font-semibold text-sage-deep">
              {technician.availabilityLabel}
            </div>

            <ul className="mt-5 space-y-2 text-[14px] text-ink/85">
              <li>Strong Carrier experience</li>
              <li>Excellent fit for this type of cooling issue</li>
              <li>Properly qualified</li>
              <li>Available today</li>
            </ul>

            <div className="mt-5 rounded-[20px] bg-paper px-4 py-3 ring-1 ring-line/70">
              <div className="flex justify-between text-[14px]">
                <span className="text-muted">Diagnostic</span>
                <span className="font-semibold">{technician.diagnostic}</span>
              </div>
              <div className="mt-2 flex justify-between text-[14px]">
                <span className="text-muted">Expected repair range</span>
                <span className="font-semibold">{technician.repairRange}</span>
              </div>
            </div>

            {onChoose ? (
              <div className="mt-6 space-y-2">
                <button
                  type="button"
                  onClick={onChoose}
                  className="flex h-12 w-full items-center justify-center rounded-full bg-sage text-[15px] font-semibold text-cream"
                >
                  {suggested ? `Accept ${first}` : `Choose ${first}`}
                </button>
                {suggested ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-12 w-full items-center justify-center rounded-full text-[15px] font-medium text-ink ring-1 ring-line"
                  >
                    See other options
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-[13px] text-cream/80"
        >
          Close preview
        </button>
      </div>
    </div>
  );
}

export function PublishSheet({
  technicians,
  onPublish,
  onClose,
}: {
  technicians: Technician[];
  onPublish: (opening: {
    technicianId: string;
    start: string;
    end: string;
    windowLabel: string;
    acceptedJobTypes: string[];
  }) => void;
  onClose: () => void;
}) {
  const publishable = technicians.filter((tech) => tech.id !== "sam");
  const [technicianId, setTechnicianId] = useState(publishable[0]?.id ?? "alex");
  const [start, setStart] = useState("17:30");
  const [end, setEnd] = useState("19:00");
  const [types, setTypes] = useState<string[]>([
    "ac_diagnostics",
    "residential_ac_repair",
  ]);

  const labels: Record<string, string> = {
    ac_diagnostics: "Cooling diagnostics",
    residential_ac_repair: "AC repair",
    furnace: "Furnace",
  };

  function toPretty(value: string) {
    const [h, m] = value.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${String(m).padStart(2, "0")} ${suffix}`.replace(" ", "\u00a0").replace("\u00a0", " ");
  }

  function toggle(type: string) {
    setTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-ink/25 p-4 backdrop-blur-[2px] sm:items-center"
      onClick={onClose}
    >
      <div
        className="animate-rise w-full max-w-md rounded-[28px] bg-cream p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
          Publish availability
        </p>
        <h3 className="nara-serif mt-2 text-[26px]">Add an opening</h3>
        <p className="mt-2 text-[14px] text-muted">
          Only this slot is shared with Nara. The rest of your board stays private.
        </p>

        <label className="mt-5 block text-[12px] font-semibold text-muted">
          Technician
          <select
            value={technicianId}
            onChange={(event) => setTechnicianId(event.target.value)}
            className="mt-1 h-11 w-full rounded-2xl bg-paper px-3 text-[14px] text-ink ring-1 ring-line"
          >
            {publishable.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-[12px] font-semibold text-muted">
            Start
            <input
              type="time"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className="mt-1 h-11 w-full rounded-2xl bg-paper px-3 text-[14px] ring-1 ring-line"
            />
          </label>
          <label className="text-[12px] font-semibold text-muted">
            End
            <input
              type="time"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className="mt-1 h-11 w-full rounded-2xl bg-paper px-3 text-[14px] ring-1 ring-line"
            />
          </label>
        </div>
        <p className="mt-2 text-[13px] text-ink/70">Today · {toPretty(start)}–{toPretty(end)}</p>

        <p className="mt-4 text-[12px] font-semibold text-muted">Accept</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-sage-soft px-3 py-2 text-[13px] font-medium text-sage-deep">
            Carrier systems
          </span>
          {Object.entries(labels).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => toggle(value)}
              className={`rounded-full px-3 py-2 text-[13px] font-medium ${
                types.includes(value) ? "bg-sage text-cream" : "bg-paper ring-1 ring-line"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={types.length === 0}
          onClick={() =>
            onPublish({
              technicianId,
              start,
              end,
              windowLabel: `${toPretty(start)}–${toPretty(end)}`,
              acceptedJobTypes: types,
            })
          }
          className="mt-6 h-12 w-full rounded-full bg-sage text-[15px] font-semibold text-cream disabled:opacity-40"
        >
          Publish opening
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { ServiceRecord } from "@/contracts/case";
import { CARRIER_CONDENSER, historicalServiceRecords } from "@/data/serviceHistory";

const NOT_RECORDED = "Not recorded";

const DETAIL_FIELDS: { key: string; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "equipment", label: "Equipment" },
  { key: "issue", label: "Issue" },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "workPerformed", label: "Work performed" },
  { key: "parts", label: "Parts" },
  { key: "provider", label: "Technician/provider" },
  { key: "cost", label: "Cost/invoice" },
  { key: "warranty", label: "Warranty" },
  { key: "attachments", label: "Attachments" },
];

export function ServiceHistory({
  records,
  remember = false,
}: {
  records: readonly ServiceRecord[];
  /** Home Twin explanation. Omitted on later screens that only retrieve the records. */
  remember?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const capacitor = historicalServiceRecords().find((record) => record.id === "svc-2023-capacitor");

  return (
    <section className="mt-8">
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted">
        Service history
      </p>
      <p className="mt-1 text-[13px] text-muted">Newest first</p>
      <ol className="mt-4">
        {records.map((record, index) => {
          const open = openId === record.id;
          const last = index === records.length - 1;
          return (
            <li key={record.id} className="relative pl-6">
              <span
                className={`absolute top-5 left-0 h-2.5 w-2.5 rounded-full ring-4 ${
                  record.status === "scheduled" ? "bg-gold ring-gold-soft" : "bg-sage ring-sage-soft"
                }`}
                aria-hidden
              />
              {last ? null : (
                <span className="absolute top-8 bottom-0 left-[4px] w-px bg-line" aria-hidden />
              )}
              <article className="mb-4 rounded-[24px] bg-paper px-4 py-4 shadow-[0_10px_28px_rgba(30,26,22,0.05)] ring-1 ring-line/70">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-semibold text-sage-deep">{record.year}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                    {record.category}
                  </p>
                </div>
                <h2 className="nara-serif mt-1 text-[22px] leading-tight font-medium">{record.title}</h2>
                {record.date && record.date !== record.year ? (
                  <p className="mt-1 text-[14px] font-semibold text-sage-deep">{record.date}</p>
                ) : null}
                <p className="mt-1 text-[13px] text-ink/70">{CARRIER_CONDENSER.label}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-ink/85">{record.outcome}</p>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : record.id)}
                  className="mt-3 text-[14px] font-medium text-sage-deep underline decoration-sage/30 underline-offset-4"
                >
                  {open ? "Hide record" : "View record"}
                </button>
                {open ? <RecordDetails record={record} /> : null}
              </article>
            </li>
          );
        })}
      </ol>
      {remember && capacitor ? (
        <aside className="rounded-[24px] bg-sage-soft px-5 py-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sage-deep">
            What Nara remembers
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink/80">
            These records stay with this condenser and can go with a later request. The{" "}
            {capacitor.year} {capacitor.title.toLowerCase()} does not prove what is wrong today.
          </p>
        </aside>
      ) : null}
    </section>
  );
}

function RecordDetails({ record }: { record: ServiceRecord }) {
  const values: Record<string, string> = {
    date: record.date ?? record.year,
    equipment: record.equipmentId === CARRIER_CONDENSER.id ? CARRIER_CONDENSER.label : NOT_RECORDED,
    issue: record.issue ?? NOT_RECORDED,
    diagnosis: record.diagnosis ?? NOT_RECORDED,
    workPerformed: record.workPerformed ?? NOT_RECORDED,
    parts: record.parts ?? NOT_RECORDED,
    provider: record.provider ?? NOT_RECORDED,
    cost: record.cost ?? NOT_RECORDED,
    warranty: record.warranty ?? NOT_RECORDED,
    attachments: record.attachments ?? NOT_RECORDED,
  };

  return (
    <dl className="mt-4 space-y-3 border-t border-line/80 pt-3">
      {DETAIL_FIELDS.map((field) => {
        const value = values[field.key];
        const missing = value === NOT_RECORDED;
        return (
          <div key={field.label}>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              {field.label}
            </dt>
            <dd className={`mt-0.5 text-[14px] leading-relaxed ${missing ? "text-muted" : "text-ink/85"}`}>
              {value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

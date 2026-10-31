import { CASE_ID, HOME_ID, type HistoryEntry, type ServiceRecord } from "@/contracts/case";

/**
 * Same equipment id the dispatch fixture already uses.
 * Historical rows are constants. Navigation never appends to this list.
 */
export const EQUIPMENT_ID = "fixture-carrier-24abc6";

export const CARRIER_CONDENSER = {
  id: EQUIPMENT_ID,
  homeId: HOME_ID,
  manufacturer: "Carrier",
  year: 2014,
  label: "2014 Carrier condenser",
  summary: "2014 condenser · 3-ton",
  photo: "/photos/photo-outdoor-unit.jpg",
} as const;

const NOT_A_FAULT = "Not a confirmed fault.";

/**
 * Only facts already in the home story are filled in.
 * Technician, invoice, warranty, and attachments were never stored.
 */
const HISTORICAL_RECORDS: readonly ServiceRecord[] = [
  {
    id: "svc-2023-capacitor",
    homeId: HOME_ID,
    equipmentId: EQUIPMENT_ID,
    year: "2023",
    date: null,
    category: "Completed repair",
    title: "Capacitor replaced",
    outcome: "Completed repair.",
    status: "completed",
    caseId: null,
    issue: null,
    diagnosis: null,
    workPerformed: "Capacitor replaced",
    parts: "Capacitor",
    provider: null,
    cost: null,
    warranty: null,
    attachments: null,
  },
  {
    id: "svc-2021-maintenance",
    homeId: HOME_ID,
    equipmentId: EQUIPMENT_ID,
    year: "2021",
    date: null,
    category: "Maintenance",
    title: "Annual AC maintenance",
    outcome: "Cooling checked, no parts replaced.",
    status: "completed",
    caseId: null,
    issue: null,
    diagnosis: null,
    workPerformed: "Cooling checked",
    parts: "No parts replaced",
    provider: null,
    cost: null,
    warranty: null,
    attachments: null,
  },
];

export function historicalServiceRecords(): readonly ServiceRecord[] {
  return HISTORICAL_RECORDS;
}

export function toHistoryEntry(record: ServiceRecord): HistoryEntry {
  return {
    id: record.id,
    year: record.year,
    title: record.title,
    detail: record.outcome,
    emphasis: record.status === "scheduled" ? "scheduled" : "context",
  };
}

/** Lines the job packet can attach. They describe history, not today’s fault. */
export function packetHistoryLines(): string[] {
  return historicalServiceRecords().map((record) => {
    const caution = record.id === "svc-2023-capacitor" ? ` ${NOT_A_FAULT}` : "";
    return `${record.date ?? record.year}: ${record.title}. ${record.outcome}${caution}`;
  });
}

export function scheduledServiceRecord(
  technician?: { name: string; company: string } | null,
  windowLabel?: string | null,
): ServiceRecord {
  return {
    id: `scheduled:${CASE_ID}`,
    homeId: HOME_ID,
    equipmentId: EQUIPMENT_ID,
    year: "Today",
    date: windowLabel ?? null,
    category: "Scheduled visit",
    title: "Diagnostic visit",
    outcome: "Appointment confirmed. No repair has been recorded.",
    status: "scheduled",
    caseId: CASE_ID,
    issue: "AC isn’t cooling",
    diagnosis: null,
    workPerformed: null,
    parts: null,
    provider: technician ? `${technician.name} · ${technician.company}` : null,
    cost: null,
    warranty: null,
    attachments: null,
  };
}

/**
 * Confirmed steps show one scheduled row in front of the same historical records.
 * The historical array itself is never modified.
 */
export function serviceRecordsAt(
  includeScheduled: boolean,
  technician?: { name: string; company: string } | null,
  windowLabel?: string | null,
): ServiceRecord[] {
  const history = historicalServiceRecords().map((record) => record);
  if (!includeScheduled) return history;
  return [scheduledServiceRecord(technician, windowLabel), ...history];
}

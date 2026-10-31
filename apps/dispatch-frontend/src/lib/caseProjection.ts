import type { CaseEvent, ServiceCase } from "@/contracts/serviceCase";
import { HOME_TWIN, PROVIDER_ID } from "@/lib/homeTwin";

type Json = Record<string, unknown>;

/** What `ServiceCase.get()` returns from the actor. */
export type ActorCase = {
  data: { id: string; issue: string; symptoms: string[]; preferredSlot: string; createdAt: string } | null;
  status: ServiceCase["status"];
  checkpoint: string;
  events: CaseEvent[];
  draft: string;
  outbox: Json | null;
  results: Record<string, Json | undefined>;
  worker: { bootId: string; pid: number } | null;
  recovery: { previousPid: number | null; pid: number; fromCheckpoint: string; at: string } | null;
  lastRelayMessageId: string | null;
};

/** Actor state → the dashboard's ServiceCase shape (docs/plan-1h.md §3). */
export function projectCase(raw: ActorCase): ServiceCase | null {
  if (!raw.data) return null;
  const { id, issue, symptoms, preferredSlot } = raw.data;
  const eq = HOME_TWIN.equipment[0];
  const diagnosed = raw.results.diagnosed as { narrative?: string } | undefined;
  const rejected = raw.results.slot_rejected as { alternatives?: string[] } | undefined;
  const booked = raw.results.booked as { slot?: string } | undefined;
  const confirmedSlot = booked?.slot;

  return {
    id,
    homeId: HOME_TWIN.id,
    equipmentId: eq.id,
    issue,
    symptoms,
    status: raw.status,
    checkpoint: raw.checkpoint,
    revision: raw.events.length,
    requestedSlot: preferredSlot,
    confirmedSlot,
    providerId: PROVIDER_ID,
    events: raw.events,
    equipment: {
      homeId: HOME_TWIN.id,
      equipmentId: eq.id,
      address: HOME_TWIN.address,
      city: HOME_TWIN.city,
      state: HOME_TWIN.state,
      manufacturer: eq.brand,
      model: eq.model,
      year: eq.installedYear,
      equipmentType: eq.type,
    },
    diagnostic: {
      caseId: id,
      issue,
      symptoms,
      narrative: diagnosed?.narrative ?? raw.draft ?? "",
    },
    jobPacket: {
      caseId: id,
      trade: "hvac",
      problem: issue,
      urgency: "same_day",
      requiredSkills: ["HVAC diagnostics", "Capacitor replacement"],
      preferredExpertise: ["Carrier split systems"],
      requiredCertifications: ["EPA 608"],
      photoUrls: [],
    },
    counteroffer: rejected
      ? { caseId: id, providerId: PROVIDER_ID, requestedSlot: preferredSlot, alternatives: rejected.alternatives ?? [] }
      : null,
    confirmedAppointment: confirmedSlot
      ? { caseId: id, providerId: PROVIDER_ID, confirmedSlot }
      : null,
    draftDiagnosis: raw.status === "diagnosing" ? raw.draft : undefined,
    worker: raw.worker ?? undefined,
    recovery: raw.recovery
      ? { previousPid: raw.recovery.previousPid ?? 0, pid: raw.recovery.pid, fromCheckpoint: raw.recovery.fromCheckpoint, at: raw.recovery.at }
      : undefined,
  };
}

import { useEffect, useState } from "react";
import type { ServiceCase } from "@/contracts/serviceCase";
import { COMPANY, type Company } from "@/data/companies";
import { SAMPLE_OUTCOMES, type JobOutcome } from "@/data/outcomes";
import { SERVICE_REQUEST, type ServiceRequest } from "@/data/serviceRequests";
import { TECHNICIAN_ROSTER, type Technician } from "@/data/technicians";

export type DispatchDashboardData = {
  company: Company;
  serviceRequest: ServiceRequest;
  roster: Technician[];
  /** Completed-job fixture. The current screen does not render it. */
  sampleOutcomes: JobOutcome[];
  /**
   * Same fixture, projected into the backend case shape.
   * The screen does not read this object yet.
   */
  serviceCase: ServiceCase;
};

/**
 * Polls the latest live case: `GET /api/cases` → `{ caseIds }` (latest last),
 * then `GET /api/cases/:id` (docs/plan-1h.md §3).
 *
 * Returns null until the first case loads, so the screen keeps the fixture.
 * A failed poll keeps the last case on screen: the backend is expected to
 * disappear for a few seconds when the coordinator is killed.
 */
export function useLiveServiceCase(pollMs = 300): ServiceCase | null {
  const [live, setLive] = useState<ServiceCase | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const index = await fetch("/api/cases", { cache: "no-store" });
        if (index.ok) {
          const { caseIds } = (await index.json()) as { caseIds: string[] };
          const latest = caseIds.at(-1);
          if (latest) {
            const res = await fetch(`/api/cases/${encodeURIComponent(latest)}`, {
              cache: "no-store",
            });
            if (res.ok && !stopped) setLive((await res.json()) as ServiceCase);
          }
        }
      } catch {
        // Backend down or restarting; keep what is on screen.
      }
      if (!stopped) timer = setTimeout(poll, pollMs);
    }

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [pollMs]);

  return live;
}

/** The dashboard CONFIRM button: lets the provider agent book the slot. */
export async function confirmProviderBooking(caseId: string): Promise<void> {
  const res = await fetch("/api/provider/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId }),
  });
  if (!res.ok) throw new Error(`POST /api/provider/confirm → ${res.status}`);
}

/** Fixture fallback for the dispatch dashboard. */
export function loadDispatchDashboard(): DispatchDashboardData {
  return {
    company: COMPANY,
    serviceRequest: SERVICE_REQUEST,
    roster: TECHNICIAN_ROSTER,
    sampleOutcomes: SAMPLE_OUTCOMES,
    serviceCase: fixtureServiceCase(SERVICE_REQUEST),
  };
}

function learnedSymptoms(request: ServiceRequest): string[] {
  const symptoms: string[] = [];
  if (request.symptoms.indoorAirflow === true) symptoms.push("Indoor airflow present");
  if (request.symptoms.indoorAirflow === false) symptoms.push("No indoor airflow");
  if (request.symptoms.outdoorUnitRunning === true) symptoms.push("Outdoor unit running");
  if (request.symptoms.outdoorUnitRunning === false) symptoms.push("Outdoor unit not running");
  if (request.symptoms.burningSmell) symptoms.push("Burning smell reported");
  symptoms.push(`Started ${request.symptoms.started}`);
  return symptoms;
}

function fixtureServiceCase(request: ServiceRequest): ServiceCase {
  const symptoms = learnedSymptoms(request);
  const requestedSlot = request.urgency === "same_day" ? "Today" : undefined;

  return {
    id: request.id,
    homeId: "fixture-home-1847-maple",
    equipmentId: "fixture-carrier-24abc6",
    issue: request.problem,
    symptoms,
    status: "dispatching",
    checkpoint: "intake_complete",
    revision: 1,
    requestedSlot,
    events: [
      {
        id: "fixture-evt-intake-complete",
        caseId: request.id,
        timestamp: "fixture",
        agent: "diagnostic",
        type: "intake_complete",
        payload: {
          problem: request.problem,
          symptoms,
          photoCount: request.symptoms.photoCount,
        },
      },
    ],
    equipment: {
      homeId: "fixture-home-1847-maple",
      equipmentId: "fixture-carrier-24abc6",
      address: request.address,
      city: request.location.city,
      state: request.location.state,
      manufacturer: request.equipment.manufacturer,
      model: request.equipment.model,
      year: request.equipment.year,
      equipmentType: request.equipment.type,
    },
    diagnostic: {
      caseId: request.id,
      issue: request.problem,
      symptoms,
      narrative: request.problem,
    },
    jobPacket: {
      caseId: request.id,
      trade: "hvac",
      problem: request.problem,
      urgency: request.urgency,
      requiredSkills: request.requiredSkills,
      preferredExpertise: request.preferredExpertise,
      requiredCertifications: request.requiredCertifications,
      photoUrls: request.symptoms.photos,
    },
    counteroffer: null,
    confirmedAppointment: null,
  };
}

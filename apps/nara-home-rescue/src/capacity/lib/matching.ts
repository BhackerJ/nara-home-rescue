/**
 * Nara matching is deterministic and explainable.
 *
 * Long-term objective (not implemented — no ML in this POC):
 *   P(successful resolution | equipment, symptoms, job type,
 *     technician, geography, availability, historical outcomes)
 *
 * Primary success metric: Successful Resolution Rate —
 * the homeowner’s problem resolved without an avoidable repeat visit.
 *
 * Existing dispatch systems (ServiceTitan, FieldCamp, Probook, Jobber)
 * may later publish only eligible openings into Nara, then receive
 * bookings back. This POC uses mock published capacity only.
 */
import { COMPANY } from "@/capacity/data/companies";
import { SERVICE_REQUEST, type ServiceRequest } from "@/capacity/data/serviceRequests";
import { activeOpenings, type Technician } from "@/capacity/data/technicians";
import type { IntakeResult } from "@/capacity/lib/intake";

export const BASE_WEIGHTS = {
  similarJobSuccess: 0.3,
  equipmentExpertise: 0.2,
  skillFit: 0.15,
  availability: 0.15,
  distance: 0.1,
  customerOutcome: 0.1,
} as const;

export type MatchStatus =
  | "recommended"
  | "qualified"
  | "qualified-unavailable"
  | "not-qualified";

export type ScoreComponents = {
  similarJobSuccess: number;
  equipmentExpertise: number;
  skillFit: number;
  availability: number;
  distance: number;
  customerOutcome: number;
};

export type MatchResult = {
  technician: Technician;
  status: MatchStatus;
  score: number | null;
  components: ScoreComponents | null;
  weights: Record<keyof ScoreComponents, number>;
  factors: { key: keyof ScoreComponents; label: string; weight: string; value: number }[];
  reasons: string[];
  lowerReasons: string[];
  consumerReasons: string[];
  disqualifiedReasons: string[];
  coldStartConfidence: number;
};

export function jobFromIntake(intake: IntakeResult | null): ServiceRequest {
  if (!intake) return SERVICE_REQUEST;

  const airflow = intake.facts.some((fact) => fact.label === "Indoor airflow")
    ? true
    : intake.facts.some((fact) => fact.label === "No indoor airflow")
      ? false
      : null;
  const outdoor = intake.facts.some((fact) => fact.label === "Outdoor unit running")
    ? true
    : intake.facts.some((fact) => fact.label.includes("isn’t running"))
      ? false
      : null;

  return {
    ...SERVICE_REQUEST,
    jobType: intake.path === "no-airflow" ? "no_airflow" : "no_cooling",
    urgency: "same_day",
    symptoms: {
      ...SERVICE_REQUEST.symptoms,
      indoorAirflow: airflow,
      outdoorUnitRunning: outdoor,
      burningSmell: intake.safety,
    },
  };
}

export function weightsFor(request: ServiceRequest): Record<keyof ScoreComponents, number> {
  const weights: Record<keyof ScoreComponents, number> = { ...BASE_WEIGHTS };
  if (request.urgency === "same_day") {
    weights.availability = 0.2;
    weights.distance = 0.07;
    weights.customerOutcome = 0.08;
    weights.similarJobSuccess = 0.28;
    weights.skillFit = 0.17;
  }
  return weights;
}

export function qualifyTechnician(
  request: ServiceRequest,
  technician: Technician,
): { qualified: boolean; available: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!technician.services.includes("residential_hvac")) {
    reasons.push("Does not service residential HVAC");
  }
  for (const skill of request.requiredSkills) {
    if (!technician.skills.includes(skill)) {
      reasons.push(`Missing required skill: ${skill}`);
    }
  }
  if (
    request.requiredCertifications.length > 0 &&
    !request.requiredCertifications.every((cert) =>
      technician.certifications.some((item) =>
        item.toLowerCase().includes(cert.toLowerCase()),
      ),
    )
  ) {
    reasons.push("Missing required certification");
  }
  if (!technician.inServiceArea) {
    reasons.push("Outside service area");
  }

  const openings = activeOpenings(technician).filter((opening) => {
    const sameDayOk =
      request.urgency !== "same_day" ||
      opening.date === "today" ||
      opening.date === new Date().toISOString().slice(0, 10);
    const jobTypeOk = request.requiredSkills.some((skill) =>
      opening.acceptedJobTypes.includes(skill),
    );
    return sameDayOk && jobTypeOk;
  });

  if (openings.length === 0) {
    return {
      qualified: reasons.length === 0,
      available: false,
      reasons:
        reasons.length > 0
          ? reasons
          : ["No Nara capacity published for this request"],
    };
  }

  if (reasons.length > 0) {
    return { qualified: false, available: false, reasons };
  }

  return { qualified: true, available: true, reasons: [] };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function coldStartConfidence(technician: Technician) {
  if (technician.naraCompletedJobs >= 12) {
    return 1;
  }
  const certs = Math.min(technician.certifications.length / 2, 1);
  const years = Math.min(technician.yearsExperience / 10, 1);
  const training = technician.manufacturerTraining.length > 0 ? 1 : 0.4;
  return Number(
    (0.3 * certs + 0.25 * years + 0.25 * COMPANY.reputation + 0.2 * training).toFixed(2),
  );
}

export function calculateMatchScore(
  request: ServiceRequest,
  technician: Technician,
): { total: number; components: ScoreComponents } {
  const jobsNorm = Math.min(technician.similarJobsCompleted / 45, 1);
  const similarJobSuccess =
    100 * (0.4 * jobsNorm + 0.6 * technician.similarJobFirstVisitResolutionRate);

  const brand = technician.equipmentExpertise[request.equipment.manufacturer] ?? 0.4;
  const category = technician.equipmentExpertise[request.equipment.equipmentType] ?? 0.5;
  const equipmentExpertise = 100 * (0.65 * brand + 0.35 * category);

  const matched = request.requiredSkills.filter((skill) =>
    technician.skills.includes(skill),
  ).length;
  const skillFit = 100 * (matched / Math.max(request.requiredSkills.length, 1));

  const slotHour = technician.nextAvailableSlot
    ? Number(technician.nextAvailableSlot.start.split(":")[0])
    : 20;
  const availability = technician.availableToday
    ? clampScore(100 - Math.max(0, slotHour - 14) * 4)
    : 0;

  const distance = 100 * Math.max(0, 1 - technician.miles / 25);

  const historyStrength = Math.min(technician.naraCompletedJobs / 20, 1);
  const prior = coldStartConfidence(technician);
  const customerOutcome =
    100 *
    (historyStrength * technician.overallCustomerSatisfaction +
      (1 - historyStrength) * prior);

  const components: ScoreComponents = {
    similarJobSuccess: clampScore(similarJobSuccess),
    equipmentExpertise: clampScore(equipmentExpertise),
    skillFit: clampScore(skillFit),
    availability: clampScore(availability),
    distance: clampScore(distance),
    customerOutcome: clampScore(customerOutcome),
  };

  const weights = weightsFor(request);
  const total = clampScore(
    Object.entries(components).reduce((sum, [key, value]) => {
      return sum + value * weights[key as keyof ScoreComponents];
    }, 0),
  );

  return { total, components };
}

function factorRows(
  components: ScoreComponents,
  weights: Record<keyof ScoreComponents, number>,
) {
  const labels: Record<keyof ScoreComponents, string> = {
    similarJobSuccess: "Similar-job success",
    equipmentExpertise: "Equipment expertise",
    skillFit: "Skill fit",
    availability: "Availability",
    distance: "Distance",
    customerOutcome: "Customer outcomes",
  };

  return (Object.keys(labels) as (keyof ScoreComponents)[]).map((key) => ({
    key,
    label: labels[key],
    weight: `${Math.round(weights[key] * 100)}%`,
    value: components[key] / 100,
  }));
}

function humanReasons(request: ServiceRequest, technician: Technician): string[] {
  const minutes = Math.max(8, Math.round(technician.miles * 2.8));
  return [
    `Strong experience with ${request.equipment.manufacturer} systems`,
    "Excellent results on similar cooling problems",
    "Properly qualified for this work",
    technician.availableToday ? "Available today" : "Next opening tomorrow",
    `${minutes} minutes away`,
  ];
}

function dispatcherReasons(technician: Technician): string[] {
  return [
    "Strong Carrier experience",
    `${technician.similarJobsCompleted} similar cooling jobs`,
    "Qualified for AC diagnostic work",
    technician.certifications.includes("EPA_Universal")
      ? "EPA Universal"
      : technician.certifications[0]?.replaceAll("_", " ") ?? "Certified",
    "Published availability today",
    `${technician.miles} miles from customer`,
  ];
}

export function matchTechnicians(
  request: ServiceRequest,
  technicians: Technician[],
): MatchResult[] {
  const weights = weightsFor(request);

  const evaluated = technicians.map((technician) => {
    const qualification = qualifyTechnician(request, technician);
    const cold = coldStartConfidence(technician);

    if (!qualification.qualified) {
      return {
        technician,
        status: "not-qualified" as const,
        score: null,
        components: null,
        weights,
        factors: [],
        reasons: [],
        lowerReasons: [],
        consumerReasons: [],
        disqualifiedReasons: qualification.reasons,
        coldStartConfidence: cold,
      };
    }

    if (!qualification.available) {
      return {
        technician,
        status: "qualified-unavailable" as const,
        score: null,
        components: null,
        weights,
        factors: [],
        reasons: ["Qualified · no Nara capacity published today"],
        lowerReasons: [],
        consumerReasons: ["Qualified for this work", "Not available today"],
        disqualifiedReasons: qualification.reasons,
        coldStartConfidence: cold,
      };
    }

    const scored = calculateMatchScore(request, technician);
    return {
      technician,
      status: "qualified" as const,
      score: scored.total,
      components: scored.components,
      weights,
      factors: factorRows(scored.components, weights),
      reasons: dispatcherReasons(technician),
      lowerReasons: [],
      consumerReasons: humanReasons(request, technician),
      disqualifiedReasons: [],
      coldStartConfidence: cold,
    };
  });

  const ranked: MatchResult[] = evaluated
    .filter((item) => item.status === "qualified")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (ranked[0]) {
    ranked[0] = { ...ranked[0], status: "recommended" };
  }

  if (ranked[1]) {
    ranked[1] = {
      ...ranked[1],
      lowerReasons: [
        "Carrier experience",
        "Strong residential AC skills",
        "EPA Universal + NATE",
        "Published availability",
        "Slightly later arrival",
        "Fewer similar Carrier jobs",
      ],
    };
  }

  const unavailable = evaluated.filter((item) => item.status === "qualified-unavailable");
  const notQualified = evaluated.filter((item) => item.status === "not-qualified");

  return [...ranked, ...unavailable, ...notQualified];
}

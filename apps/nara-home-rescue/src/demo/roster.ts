/**
 * Cool Air technicians copied from the original prototype roster.
 * Only people who are consumer-visible, accepting jobs, and available today.
 * David Lee is not accepting jobs. Sam Patel is not consumer-visible.
 * No score is calculated here.
 */

export type TechId = "alex" | "maria";

export type RosterTech = {
  id: TechId;
  name: string;
  company: string;
  portrait: string;
  availabilityLabel: string;
  expertise: string;
  yearsExperience: number;
  miles: number;
  manufacturerTraining: string[];
  skills: string[];
  certifications: string[];
  serviceAreas: string[];
  /** Present on the original Alex record. */
  recommended: boolean;
};

export const ROSTER: RosterTech[] = [
  {
    id: "alex",
    name: "Alex Morgan",
    company: "Cool Air Mechanical",
    portrait: "/photos/alex-morgan.jpg",
    availabilityLabel: "Today · 5:30–7:00 PM",
    expertise: "Carrier specialist",
    yearsExperience: 9,
    miles: 4.2,
    manufacturerTraining: ["Carrier"],
    skills: ["ac_diagnostics", "residential_ac_repair"],
    certifications: ["EPA_Universal"],
    serviceAreas: ["Hayward"],
    recommended: true,
  },
  {
    id: "maria",
    name: "Maria Chen",
    company: "Cool Air Mechanical",
    portrait: "/photos/maria-chen.jpg",
    availabilityLabel: "Today · 6:00–8:00 PM",
    expertise: "Carrier + Lennox",
    yearsExperience: 7,
    miles: 7,
    manufacturerTraining: ["Carrier", "Lennox"],
    skills: ["ac_diagnostics", "residential_ac_repair"],
    certifications: ["EPA_Universal", "NATE"],
    serviceAreas: ["Hayward"],
    recommended: false,
  },
];

const CERT_LABEL: Record<string, string> = {
  EPA_Universal: "EPA Universal",
  NATE: "NATE",
};

export function techById(id: TechId): RosterTech {
  return ROSTER.find((tech) => tech.id === id) ?? ROSTER[0];
}

export function firstName(tech: RosterTech) {
  return tech.name.split(" ")[0];
}

export function qualificationLabel(tech: RosterTech) {
  return tech.certifications.map((cert) => CERT_LABEL[cert] ?? cert).join(" · ");
}

/** Reasons use only fields on the roster record. */
export function matchReasons(tech: RosterTech): string[] {
  const reasons: string[] = [];
  if (tech.manufacturerTraining.includes("Carrier")) {
    reasons.push(
      tech.manufacturerTraining.length > 1
        ? `Training on ${tech.manufacturerTraining.join(" and ")}`
        : "Carrier equipment experience",
    );
  }
  if (tech.skills.includes("ac_diagnostics")) {
    reasons.push("Familiar with cooling-system diagnostics");
  }
  reasons.push(tech.availabilityLabel);
  if (tech.serviceAreas.includes("Hayward")) {
    reasons.push("Serves Hayward");
  }
  return reasons;
}

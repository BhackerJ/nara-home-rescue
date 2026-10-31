export type Company = {
  id: string;
  name: string;
  technicianCount: number;
  focus: string;
  region: string;
  reputation: number;
  serviceCities: string[];
  serviceRadiusMiles: number;
};

export const COMPANY: Company = {
  id: "cool-air",
  name: "Cool Air Mechanical",
  technicianCount: 8,
  focus: "Residential HVAC",
  region: "East Bay",
  reputation: 0.92,
  serviceCities: ["Hayward", "San Leandro", "Castro Valley", "Union City"],
  serviceRadiusMiles: 18,
};

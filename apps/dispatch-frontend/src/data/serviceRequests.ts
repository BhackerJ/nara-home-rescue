export type ServiceRequest = {
  id: string;
  number: string;
  trade: "hvac";
  serviceType: "residential";
  jobType: "no_cooling" | "no_airflow";
  urgency: "same_day" | "flexible";
  problem: string;
  address: string;
  location: {
    city: string;
    state: string;
  };
  equipment: {
    manufacturer: string;
    brand: string;
    model: string;
    year: number;
    equipmentType: "central_ac";
    type: string;
    tons: number;
  };
  symptoms: {
    indoorAirflow: boolean | null;
    outdoorUnitRunning: boolean | null;
    burningSmell: boolean;
    started: string;
    photoCount: number;
    photos: string[];
  };
  requiredSkills: string[];
  preferredExpertise: string[];
  requiredCertifications: string[];
  source: "nara-homeowner";
};

export const SERVICE_REQUEST: ServiceRequest = {
  id: "request-001",
  number: "001",
  trade: "hvac",
  serviceType: "residential",
  jobType: "no_cooling",
  urgency: "same_day",
  problem: "AC not cooling",
  address: "1847 Maple Street, Hayward, CA",
  location: {
    city: "Hayward",
    state: "CA",
  },
  equipment: {
    manufacturer: "Carrier",
    brand: "Carrier",
    model: "24ABC6",
    year: 2018,
    equipmentType: "central_ac",
    type: "3-ton central air conditioner",
    tons: 3,
  },
  symptoms: {
    indoorAirflow: true,
    outdoorUnitRunning: false,
    burningSmell: true,
    started: "Today",
    photoCount: 3,
    photos: [
      "/photos/photo-thermostat.jpg",
      "/photos/photo-outdoor-unit.jpg",
      "/photos/photo-label.jpg",
    ],
  },
  requiredSkills: ["ac_diagnostics", "residential_ac_repair"],
  preferredExpertise: ["Carrier", "central_ac"],
  requiredCertifications: ["EPA"],
  source: "nara-homeowner",
};

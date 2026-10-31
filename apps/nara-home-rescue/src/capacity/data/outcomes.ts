export type JobOutcome = {
  requestId: string;
  technicianId: string;
  diagnosisCategory: string;
  firstVisitResolved: boolean;
  durationMinutes: number;
  quotedPrice: number;
  finalPrice: number;
  callbackWithin30Days: boolean;
  customerSatisfaction: number;
};

/**
 * Prototype completed-job records. Not shown in UI.
 * Future ranking should learn from first-visit resolution,
 * callbacks, price accuracy, and satisfaction — not review volume.
 */
export const SAMPLE_OUTCOMES: JobOutcome[] = [
  {
    requestId: "request-001",
    technicianId: "alex",
    diagnosisCategory: "electrical_start_component",
    firstVisitResolved: true,
    durationMinutes: 74,
    quotedPrice: 340,
    finalPrice: 327,
    callbackWithin30Days: false,
    customerSatisfaction: 5,
  },
];

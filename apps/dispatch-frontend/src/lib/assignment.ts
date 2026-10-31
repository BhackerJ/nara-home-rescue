export type Assignment = {
  requestId: string;
  technicianId: string;
  window: string;
};

export type NaraJob = {
  id: string;
  status: "booked";
  requestId: string;
  technicianId: string;
  technicianName: string;
  company: string;
  window: string;
  diagnosticFee: number;
  address: string;
  zipCode: string;
  issueSummary: string;
  createdAt: string;
};

const KEY = "nara-assignment";
const JOB_KEY = "nara-job";
const EVENT = "nara-assignment-change";

export function getAssignment(): Assignment | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Assignment;
  } catch {
    return null;
  }
}

export function setAssignment(assignment: Assignment) {
  window.localStorage.setItem(KEY, JSON.stringify(assignment));
  window.dispatchEvent(new Event(EVENT));
}

export function clearAssignment() {
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem(JOB_KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function setNaraJob(job: NaraJob) {
  window.localStorage.setItem(JOB_KEY, JSON.stringify(job));
  setAssignment({
    requestId: job.requestId,
    technicianId: job.technicianId,
    window: job.window,
  });
}

export function getNaraJob(): NaraJob | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(JOB_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NaraJob;
  } catch {
    return null;
  }
}

export function subscribeAssignment(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export type DemoInboundRequest = {
  problem: string;
  brand?: string;
  model?: string;
  zipCode: string;
  facts: string[];
  photos: string[];
  technicianName: string;
  sameDay: boolean;
};

const DEMO_INBOUND_KEY = "nara-demo-inbound";

export function setDemoInbound(data: DemoInboundRequest) {
  window.sessionStorage.setItem(DEMO_INBOUND_KEY, JSON.stringify(data));
}

export function getDemoInbound(): DemoInboundRequest | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(DEMO_INBOUND_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoInboundRequest;
  } catch {
    return null;
  }
}

export function clearDemoInbound() {
  window.sessionStorage.removeItem(DEMO_INBOUND_KEY);
}

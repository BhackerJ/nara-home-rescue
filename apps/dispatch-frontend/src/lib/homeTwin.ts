// One copy of the Home Twin fixture, shared with the coordinator (data/home.json).
import home from "../../../../data/home.json";

export type HomeTwin = typeof home;
export const HOME_TWIN: HomeTwin = home;
export const PROVIDER_ID = "cool-air-mechanical";

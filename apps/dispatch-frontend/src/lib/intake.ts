/**
 * Type-only slice of the homeowner intake model.
 * The question flow was not migrated. `jobFromIntake` in matching.ts
 * still typechecks against this shape, and the dashboard does not call it.
 */
export type IntakeFact = {
  label: string;
  tone?: "ok" | "warn";
};

export type IntakeResult = {
  path: "safety" | "cooling-performance" | "no-airflow";
  facts: IntakeFact[];
  narrative: string;
  lookingFor: string[];
  safety: boolean;
};

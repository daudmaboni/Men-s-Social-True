// The shape of every progress record in Men's Social.
// Today these are saved on the phone; later the same shape goes into Supabase.

/** Every metric the app can track. We add to this list as each tracker is built. */
export type MetricType = "water";

/** Where a value came from — shown to the user so he knows what is real vs estimated. */
export type RecordSource = "manual" | "quick_add" | "ai_estimate" | "device_sync" | "calculated";

export type Unit = "ml";

export interface TrackingRecord {
  id: string;
  userId: string; // "local" until sign-up; replaced by the real account id later
  metric: MetricType;
  value: number;
  unit: Unit;
  source: RecordSource;
  recordedAt: string; // ISO time the thing happened
  localDate: string; // YYYY-MM-DD in the man's own timezone (used for daily totals)
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  metric: MetricType;
  target: number;
  unit: Unit;
  period: "day";
  direction: "increase" | "decrease";
  updatedAt: string;
}

/** The three honest states a progress bar can be in. */
export type MetricStatus = "not_recorded" | "tracked" | "goal_achieved";

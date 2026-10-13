// How numbers are shown to the man.

export const litres = (ml: number) =>
  `${(ml / 1000).toLocaleString("en", { maximumFractionDigits: 2 })} L`;

/** 440 → "7h 20m" */
export const duration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h}h` : h === 0 ? `${m}m` : `${h}h ${m}m`;
};

/** 3.6 → "3.6", 4 → "4" */
export const score = (n: number) => n.toLocaleString("en", { maximumFractionDigits: 1 });

/** +0.6 / −0.3, with a real minus sign */
export const signed = (n: number, fmt: (v: number) => string = score) =>
  n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(Math.abs(n))}` : "no change";

export const RATING_LABELS = ["Very low", "Low", "Okay", "Good", "Great"] as const;

/** A calendar day in the user's local time zone, e.g. "2026-11-23". */
export type DateKey = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function dateKey(ms: number): DateKey {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight at the start of the day after `ms`. */
export function startOfNextDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

/** Local midnight at the start of the day containing `ms`. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

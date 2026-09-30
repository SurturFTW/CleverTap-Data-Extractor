export const fmtNumber = (n: number) => n.toLocaleString("en-US");

export const fmtPercent = (n: number) => `${(n * 100).toFixed(2)}%`;

export const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);

/** 20260115143005 (yyyyMMddHHmmss) -> "2026-01-15 14:30:05" */
export function fmtCtTs(ts?: number): string {
  const s = String(ts ?? "");
  if (!/^\d{14}$/.test(s)) return s || "–";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
}

/** Unix seconds -> local date/time string */
export const fmtEpoch = (sec?: number) =>
  sec ? new Date(sec * 1000).toLocaleString() : "–";

/** Renders any JSON value for a table cell */
export const fmtValue = (v: unknown): string =>
  v !== null && typeof v === "object" ? JSON.stringify(v) : String(v);

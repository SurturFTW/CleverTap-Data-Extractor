import { identityQueries } from "./identity-queries";
import { pushQueries } from "./push-queries";
import type { Keyed } from "./types";

/** What the TAM tracker stores per account per quarter. */
export type QuarterSnapshot = {
  fetchedAt: number;
  /** Date range actually queried (YYYY-MM-DD) */
  from: string;
  to: string;
  identitySet: number;
  identityErrors: number;
  pushSent: number;
  pushImpressions: number;
};

export type AuditStatus = "not_started" | "in_progress" | "done";

export const AUDIT_STATUSES: { value: AuditStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export type AuditEntry = { status: AuditStatus; notes: string };

/** Total-only push queries plus all identity queries: 10 count calls per account. */
export function tamQueries(): Keyed[] {
  return [...identityQueries(), ...pushQueries("TOTAL")];
}

export function summarise(
  values: Record<string, number>,
  range: { from: string; to: string },
): QuarterSnapshot {
  let identitySet = 0;
  let identityErrors = 0;
  for (const [key, v] of Object.entries(values)) {
    if (key.startsWith("Identity Set")) identitySet += v;
    else if (key.startsWith("Identity Error")) identityErrors += v;
  }
  return {
    fetchedAt: Date.now(),
    ...range,
    identitySet,
    identityErrors,
    pushSent: values.totalSent ?? 0,
    pushImpressions: values.totalImpressions ?? 0,
  };
}

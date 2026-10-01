import { postJson } from "@/lib/utils/http";
import { sleep } from "@/lib/utils/pool";
import type {
  Credentials,
  DateRange,
  EventBatchResponse,
  EventRecord,
  ExportStartResponse,
  ProfileRecord,
  ProfileResponse,
  EventFilters,
  UserLookup,
} from "./types";

/** Without a user lookup every record is returned, so cap what we hold in the browser. */
const MAX_UNFILTERED_RECORDS = 20_000;
const MAX_BATCHES = 400; // 400 x 5,000 = 2M records scanned at most
const PENDING_WAIT_MS = 3000;
const PENDING_MAX_TRIES = 40;

/** Idempotent reads: a gateway timeout is retried twice before giving up. */
const post = <T,>(
  url: string,
  body: Record<string, unknown>,
  signal: AbortSignal | undefined,
  step: string,
) => postJson<T>(url, body, { signal, step, retries: 2 });

const START_WAIT_MS = 2000;
const START_MAX_TRIES = 30; // ~1 minute of "CleverTap is still preparing the export"

export async function fetchProfile(
  credentials: Credentials,
  lookup: UserLookup,
  signal?: AbortSignal,
): Promise<ProfileRecord | null> {
  const res = await post<ProfileResponse>(
    "/api/clevertap/profile",
    { credentials, lookup },
    signal,
    "Profile lookup",
  );
  if (res.status === "fail") throw new Error(res.error);
  return res.record;
}

export type ScanProgress = {
  batches: number;
  scanned: number;
  matches: number;
  done: boolean;
  /** true if the batch cap was hit before the export finished */
  truncated: boolean;
  /** true if CleverTap applied the Email/Phone filter itself */
  serverFiltered: boolean;
};

/**
 * Scans every user's events for `eventName` in `range`, keeping only the
 * looked-up user's records. Reports progress after each batch.
 */
export async function scanUserEvents(
  credentials: Credentials,
  eventName: string,
  range: DateRange,
  lookup: UserLookup | undefined,
  filters: EventFilters,
  onProgress: (records: EventRecord[], p: ScanProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  type Started = Extract<ExportStartResponse, { status: "success" }>;

  // Each call asks CleverTap once; "pending" (slow / still preparing) is retried
  // here in the browser so no single server request has to wait long.
  const startExport = async (useFilter: boolean): Promise<Started> => {
    for (let i = 0; i < START_MAX_TRIES; i++) {
      if (i > 0) await sleep(START_WAIT_MS);
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const res = await post<ExportStartResponse>(
        "/api/clevertap/events",
        { credentials, eventName, range, lookup, filters, useFilter },
        signal,
        "Start export",
      );
      if (res.status === "success") return res;
      if (res.status === "fail") {
        // CleverTap refused the filtered export: fall back to a plain one,
        // which is then filtered record by record.
        if (res.filterRejected && useFilter) return startExport(false);
        throw new Error(res.error);
      }
    }
    throw new Error("Start export: CleverTap is still preparing the export. Try again shortly.");
  };

  let start = await startExport(true);
  let cursor: string | null = start.cursor;
  let batches = 0;
  let scanned = 0;
  let matches = 0;

  while (cursor) {
    if (batches >= MAX_BATCHES || (!lookup && matches >= MAX_UNFILTERED_RECORDS)) {
      onProgress([], { batches, scanned, matches, done: true, truncated: true, serverFiltered: start.filtered });
      return;
    }

    let res: EventBatchResponse = { status: "pending" };
    for (let i = 0; res.status === "pending" && i < PENDING_MAX_TRIES; i++) {
      if (i > 0) await sleep(PENDING_WAIT_MS);
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      res = await post<EventBatchResponse>(
        "/api/clevertap/events",
        { credentials, cursor, lookup, filters, serverFiltered: start.filtered },
        signal,
        "Fetch batch",
      );
    }
    if (res.status === "pending") throw new Error("Timed out waiting for CleverTap");
    if (res.status === "fail") {
      // A filtered export whose first fetch fails: restart once without the filter.
      if (batches === 0 && start.filtered) {
        start = await startExport(false);
        cursor = start.cursor;
        continue;
      }
      throw new Error(res.error);
    }

    batches++;
    scanned += res.scanned;
    matches += res.records.length;
    cursor = res.nextCursor;
    onProgress(res.records, {
      batches,
      scanned,
      matches,
      done: !cursor,
      truncated: false,
      serverFiltered: start.filtered,
    });
  }
}

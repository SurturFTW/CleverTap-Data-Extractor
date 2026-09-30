import { sleep } from "@/lib/utils/pool";
import type {
  Credentials,
  DateRange,
  EventBatchResponse,
  EventRecord,
  ExportStartResponse,
  ProfileRecord,
  ProfileResponse,
  PropertyFilter,
  UserLookup,
} from "./types";

/** Without a user lookup every record is returned, so cap what we hold in the browser. */
const MAX_UNFILTERED_RECORDS = 20_000;
const MAX_BATCHES = 400; // 400 x 5,000 = 2M records scanned at most
const PENDING_WAIT_MS = 3000;
const PENDING_MAX_TRIES = 40;

async function post<T>(
  url: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  return (await res.json()) as T;
}

export async function fetchProfile(
  credentials: Credentials,
  lookup: UserLookup,
  signal?: AbortSignal,
): Promise<ProfileRecord | null> {
  const res = await post<ProfileResponse>(
    "/api/clevertap/profile",
    { credentials, lookup },
    signal,
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
  eventProperties: PropertyFilter[],
  onProgress: (records: EventRecord[], p: ScanProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const startExport = async (useFilter: boolean) => {
    const res = await post<ExportStartResponse>(
      "/api/clevertap/events",
      { credentials, eventName, range, lookup, eventProperties, useFilter },
      signal,
    );
    if (res.status === "fail") throw new Error(res.error);
    return res;
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
        { credentials, cursor, lookup, eventProperties },
        signal,
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

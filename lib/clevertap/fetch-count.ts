import { sleep } from "@/lib/utils/pool";
import type {
  CountQuery,
  CountResponse,
  Credentials,
  DateRange,
} from "./types";

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_TRIES = 60; // ~5 minutes

async function call(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<CountResponse> {
  const res = await fetch("/api/clevertap/count", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  return (await res.json()) as CountResponse;
}

/** Fetches one event count, transparently polling while CleverTap reports "partial". */
export async function fetchCount(
  credentials: Credentials,
  query: CountQuery,
  range: DateRange,
  signal?: AbortSignal,
): Promise<number> {
  let res = await call({ credentials, query, range }, signal);

  for (let i = 0; res.status === "partial" && i < POLL_MAX_TRIES; i++) {
    await sleep(POLL_INTERVAL_MS);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    res = await call({ credentials, reqId: res.reqId }, signal);
  }

  if (res.status === "success") return res.count;
  if (res.status === "partial") throw new Error("Timed out waiting for CleverTap");
  throw new Error(res.error);
}

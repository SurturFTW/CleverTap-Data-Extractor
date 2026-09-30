import type { Credentials } from "@/lib/clevertap/types";
import type { UploadResponse } from "@/lib/clevertap/upload";

/**
 * Sends records to POST /1/upload. With dryRun, CleverTap only validates them.
 * `creds.region` is validated against the REGIONS whitelist by the route handler.
 */
export async function uploadRecords(
  creds: Credentials,
  records: unknown[],
  dryRun: boolean,
): Promise<UploadResponse> {
  const res = await fetch(
    `https://${creds.region}.api.clevertap.com/1/upload${dryRun ? "?dryRun=1" : ""}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-CleverTap-Account-Id": creds.accountId,
        "X-CleverTap-Passcode": creds.passcode,
      },
      body: JSON.stringify({ d: records }),
      cache: "no-store",
    },
  );

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return failure(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  if (res.status === 429) {
    return failure("CleverTap rate limit reached (max 3 concurrent upload requests). Try again shortly.");
  }
  if (data.status === "success" || data.status === "partial" || data.status === "fail") {
    const unprocessed = Array.isArray(data.unprocessed) ? data.unprocessed : [];
    const processed = Number(data.processed ?? 0);
    // A top-level failure with nothing processed and a message (e.g. bad credentials)
    const error =
      data.status === "fail" && unprocessed.length === 0
        ? String(data.error ?? data.message ?? `HTTP ${res.status}`)
        : undefined;
    return { status: data.status, processed, unprocessed, error };
  }
  return failure(String(data.error ?? data.message ?? `HTTP ${res.status}`));
}

const failure = (error: string): UploadResponse => ({
  status: "fail",
  processed: 0,
  unprocessed: [],
  error,
});

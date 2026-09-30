import type {
  CountQuery,
  CountResponse,
  Credentials,
  DateRange,
} from "@/lib/clevertap/types";

function endpoint(region: string) {
  // `region` is validated against the REGIONS whitelist by the route handler,
  // so the host is never user-controlled.
  return `https://${region}.api.clevertap.com/1/counts/events.json`;
}

function headers(creds: Credentials) {
  return {
    "X-CleverTap-Account-Id": creds.accountId,
    "X-CleverTap-Passcode": creds.passcode,
  };
}

async function parse(res: Response): Promise<CountResponse> {
  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    return { status: "fail", error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  }

  if (data.status === "success") {
    return { status: "success", count: Number(data.count ?? 0) };
  }
  if (data.status === "partial" && data.req_id != null) {
    return { status: "partial", reqId: data.req_id as number | string };
  }
  return {
    status: "fail",
    error: String(data.error ?? data.message ?? `HTTP ${res.status}`),
  };
}

/** Starts a count request (CleverTap may answer "partial" with a req_id). */
export async function startCount(
  creds: Credentials,
  query: CountQuery,
  range: DateRange,
): Promise<CountResponse> {
  const payload: Record<string, unknown> = {
    event_name: query.eventName,
    from: range.from,
    to: range.to,
  };
  if (query.eventProperties?.length) {
    payload.event_properties = query.eventProperties;
  }
  if (query.technographics?.length) {
    payload.common_profile_properties = {
      technographics: query.technographics,
    };
  }

  const res = await fetch(endpoint(creds.region), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers(creds) },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  return parse(res);
}

/** Polls a previously started count request. */
export async function pollCount(
  creds: Credentials,
  reqId: number | string,
): Promise<CountResponse> {
  const res = await fetch(
    `${endpoint(creds.region)}?req_id=${encodeURIComponent(String(reqId))}`,
    { method: "GET", headers: headers(creds), cache: "no-store" },
  );
  return parse(res);
}

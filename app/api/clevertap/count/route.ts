import { pollCount, startCount } from "@/lib/server/clevertap";
import {
  REGIONS,
  type CountQuery,
  type Credentials,
  type DateRange,
} from "@/lib/clevertap/types";

export const maxDuration = 30;

type Body = {
  credentials?: Partial<Credentials>;
  query?: CountQuery;
  range?: DateRange;
  reqId?: number | string;
};

const bad = (error: string) =>
  Response.json({ status: "fail", error }, { status: 400 });

const isDate = (n: unknown) =>
  typeof n === "number" && Number.isInteger(n) && n >= 19000101 && n <= 99991231;

/**
 * Stateless proxy to CleverTap's event-count API. Credentials are supplied per
 * request by the user and are never stored or logged. Each call is one short
 * upstream request; the client drives the partial -> poll loop.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const c = body.credentials;
  const accountId = c?.accountId?.trim();
  const passcode = c?.passcode?.trim();
  const region = c?.region;
  if (!accountId || !passcode) return bad("Account ID and passcode are required");
  if (!region || !REGIONS.includes(region)) return bad("Unknown region");
  const creds: Credentials = { accountId, passcode, region };

  try {
    if (body.reqId != null) {
      return Response.json(await pollCount(creds, body.reqId));
    }

    const { query, range } = body;
    if (!query?.eventName) return bad("eventName is required");
    if (!range || !isDate(range.from) || !isDate(range.to)) {
      return bad("from/to must be YYYYMMDD integers");
    }
    if (range.from > range.to) return bad("From date must be on or before To date");

    return Response.json(await startCount(creds, query, range));
  } catch (e) {
    return Response.json(
      { status: "fail", error: e instanceof Error ? e.message : "Upstream error" },
      { status: 502 },
    );
  }
}

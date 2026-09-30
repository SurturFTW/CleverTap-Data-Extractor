import { uploadRecords } from "@/lib/server/upload";
import { MAX_RECORDS } from "@/lib/clevertap/upload";
import { badRequest, parseCreds } from "@/lib/server/request";

export const maxDuration = 30;

const ID_KEYS = ["identity", "objectId", "FBID", "GPID"];
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Returns an error message for a malformed record, or null. */
function checkRecord(r: unknown): string | null {
  if (!isObj(r)) return "each record must be an object";
  const ids = ID_KEYS.filter((k) => typeof r[k] === "string" && (r[k] as string).trim());
  if (ids.length !== 1) return "each record needs exactly one of identity, objectId, FBID or GPID";
  if (r.type === "profile") {
    return isObj(r.profileData) && Object.keys(r.profileData).length
      ? null
      : "profile records need profileData";
  }
  if (r.type === "event") {
    if (typeof r.evtName !== "string" || !r.evtName.trim()) return "event records need evtName";
    if (r.evtData !== undefined && !isObj(r.evtData)) return "evtData must be an object";
    if (r.ts !== undefined && !Number.isInteger(r.ts)) return "ts must be epoch seconds";
    return null;
  }
  return 'record type must be "profile" or "event"';
}

/**
 * Stateless proxy to CleverTap's upload API (user profiles and events).
 * Credentials come with each request and are never stored or logged.
 * `dryRun: true` only validates; nothing is written.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const creds = parseCreds(body.credentials);
  if (typeof creds === "string") return badRequest(creds);

  const { records } = body;
  if (!Array.isArray(records) || records.length === 0) return badRequest("No records to upload");
  if (records.length > MAX_RECORDS) return badRequest(`Max ${MAX_RECORDS} records per upload`);
  for (let i = 0; i < records.length; i++) {
    const problem = checkRecord(records[i]);
    if (problem) return badRequest(`Record ${i + 1}: ${problem}`);
  }

  try {
    return Response.json(await uploadRecords(creds, records, body.dryRun !== false));
  } catch (e) {
    return Response.json(
      { status: "fail", processed: 0, unprocessed: [], error: e instanceof Error ? e.message : "Upstream error" },
      { status: 502 },
    );
  }
}

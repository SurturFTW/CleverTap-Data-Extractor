import { fetchEventBatch, startEventExport } from "@/lib/server/clevertap-users";
import {
  badRequest,
  parseCreds,
  parseFilters,
  parseLookup,
  parseRange,
} from "@/lib/server/request";

export const maxDuration = 60;

/**
 * Two actions, each a single upstream call so the browser can drive the loop:
 *  - { credentials, eventName, range, lookup }  -> { cursor }
 *  - { credentials, cursor, lookup }            -> one filtered batch
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const creds = parseCreds(body.credentials);
  if (typeof creds === "string") return badRequest(creds);

  const filters = parseFilters(body.filters);
  if (typeof filters === "string") return badRequest(filters);

  try {
    if (typeof body.cursor === "string" && body.cursor) {
      // No lookup -> all users' records
      const lookup = body.lookup?.value?.trim() ? parseLookup(body.lookup) : undefined;
      if (typeof lookup === "string") return badRequest(lookup);
      return Response.json(await fetchEventBatch(creds, body.cursor, lookup, filters));
    }

    // Optional here: it only enables CleverTap-side filtering of the export.
    const lookup = body.lookup?.value?.trim() ? parseLookup(body.lookup) : undefined;
    if (typeof lookup === "string") return badRequest(lookup);
    const eventName = typeof body.eventName === "string" ? body.eventName.trim() : "";
    if (!eventName) return badRequest("Event name is required");
    const range = parseRange(body.range);
    if (typeof range === "string") return badRequest(range);
    return Response.json(await startEventExport(creds, eventName, range, lookup, filters, body.useFilter !== false));
  } catch (e) {
    return Response.json(
      { status: "fail", error: e instanceof Error ? e.message : "Upstream error" },
      { status: 502 },
    );
  }
}

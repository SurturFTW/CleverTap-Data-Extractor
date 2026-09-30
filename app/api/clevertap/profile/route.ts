import { getProfile } from "@/lib/server/clevertap-users";
import {
  badRequest,
  parseCreds,
  parseLookup,
} from "@/lib/server/request";

export const maxDuration = 30;

/** Stateless proxy: credentials come with each request and are never stored or logged. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const creds = parseCreds(body.credentials);
  if (typeof creds === "string") return badRequest(creds);
  const lookup = parseLookup(body.lookup);
  if (typeof lookup === "string") return badRequest(lookup);

  if (lookup.type === "phone") {
    return badRequest("Profile lookup supports identity, email or objectId only");
  }

  try {
    return Response.json(await getProfile(creds, lookup));
  } catch (e) {
    return Response.json(
      { status: "fail", error: e instanceof Error ? e.message : "Upstream error" },
      { status: 502 },
    );
  }
}

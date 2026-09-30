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
} from "@/lib/clevertap/types";

// `creds.region` is validated against the REGIONS whitelist by the route handlers.
const base = (region: string) => `https://${region}.api.clevertap.com/1`;

const authHeaders = (c: Credentials) => ({
  "X-CleverTap-Account-Id": c.accountId,
  "X-CleverTap-Passcode": c.passcode,
});

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { status: "fail", error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  }
}

/** "<step>: <message> [HTTP 400, code 4004]" so failures say where they happened. */
const errorOf = (data: Record<string, unknown>, res: Response, step?: string) => {
  const msg = String(data.error ?? data.message ?? data.status ?? `HTTP ${res.status}`);
  const code = data.code != null ? `, code ${data.code}` : "";
  return `${step ? `${step}: ` : ""}${msg} [HTTP ${res.status}${code}]`;
};

/** Single user profile via GET /1/profile.json */
export async function getProfile(
  creds: Credentials,
  lookup: UserLookup,
): Promise<ProfileResponse> {
  const res = await fetch(
    `${base(creds.region)}/profile.json?${lookup.type}=${encodeURIComponent(lookup.value)}`,
    { headers: authHeaders(creds), cache: "no-store" },
  );
  const data = await readJson(res);

  if (res.status === 404) return { status: "success", record: null };
  if (data.status === "success") {
    return { status: "success", record: (data.record as ProfileRecord) ?? null };
  }
  return { status: "fail", error: errorOf(data, res) };
}

/**
 * CTQL profile filter for the export request, or null when it can't be expressed.
 * Identity/objectId aren't supported by CTQL; a phone number must be in the
 * stored "+<country code><number>" form to match exactly.
 */
function ctqlProfileFilter(lookup: UserLookup) {
  const value = lookup.value.trim();
  if (lookup.type === "email") return { name: "Email", operator: "equals", value };
  if (lookup.type === "phone" && value.startsWith("+")) {
    return { name: "Phone", operator: "equals", value: `+${value.replace(/\D/g, "")}` };
  }
  return null;
}

async function postExport(
  creds: Credentials,
  body: Record<string, unknown>,
): Promise<{ data: Record<string, unknown>; res: Response }> {
  // HTTP 202 means CleverTap is still preparing the export; retry briefly.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${base(creds.region)}/events.json?batch_size=5000`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(creds) },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (res.status !== 202 || attempt >= 4) return { data: await readJson(res), res };
    await new Promise((r) => setTimeout(r, 2000));
  }
}

/**
 * Step 1 of the Get Events API: ask for a cursor over events in the range.
 * The docs list only event_name/from/to, but the query-language docs show an
 * Email/Phone profile filter, so we try it first (it can shrink the export to
 * a handful of records) and fall back to the plain export if it's rejected.
 * Records are re-checked against the lookup in fetchEventBatch either way.
 */
export async function startEventExport(
  creds: Credentials,
  eventName: string,
  range: DateRange,
  lookup?: UserLookup,
  eventProperties: PropertyFilter[] = [],
  useFilter = true,
): Promise<ExportStartResponse> {
  // Event property filters use the same shape as the count APIs. If CleverTap
  // ignores them, fetchEventBatch re-applies them to every record.
  const plain = {
    event_name: eventName,
    from: range.from,
    to: range.to,
    ...(eventProperties.length ? { event_properties: eventProperties } : {}),
  };
  const filter = lookup && useFilter ? ctqlProfileFilter(lookup) : null;

  if (filter) {
    const { data } = await postExport(creds, {
      ...plain,
      common_profile_properties: { profile_fields: [filter] },
    });
    if (data.status === "success" && typeof data.cursor === "string") {
      return { status: "success", cursor: data.cursor, filtered: true };
    }
  }

  const { data, res } = await postExport(creds, plain);
  if (data.status === "success" && typeof data.cursor === "string") {
    return { status: "success", cursor: data.cursor, filtered: false };
  }
  return { status: "fail", error: errorOf(data, res, "Start export") };
}

const normId = (v: unknown) => String(v ?? "").replace(/^-/, "").toLowerCase();

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** Phone numbers match on full digits, or on the last 10 digits when the country code is missing. */
function samePhone(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 10 && b.length >= 10 && a.slice(-10) === b.slice(-10);
}

function matches(rec: EventRecord, lookup: UserLookup): boolean {
  const p = rec.profile;
  if (!p) return false;
  const v = lookup.value.trim();
  const pd = p.profileData ?? {};
  const prop = (name: string) =>
    Object.entries(pd).find(([k]) => k.toLowerCase() === name)?.[1];

  switch (lookup.type) {
    case "identity":
      return String(p.identity ?? "") === v;
    case "email":
      return [p.email, prop("email")].some(
        (e) => String(e ?? "").toLowerCase() === v.toLowerCase(),
      );
    case "phone":
      return [p.phone, prop("phone")].some((ph) => samePhone(digits(ph), digits(v)));
    case "objectId":
      return normId(p.objectId) === normId(v);
  }
}

const num = (v: unknown) => (v === "" || v == null ? NaN : Number(v));

/** Re-applies an event property filter to an exported record. */
function matchesProperty(rec: EventRecord, f: PropertyFilter): boolean {
  const props = rec.event_props ?? {};
  const key = Object.keys(props).find((k) => k.toLowerCase() === f.name.toLowerCase());
  const actual = key === undefined ? undefined : props[key];
  if (f.operator === "exists") return actual !== undefined && actual !== null;
  if (f.operator === "not_exists") return actual === undefined || actual === null;
  if (actual === undefined || actual === null) return f.operator === "not_contains";

  const a = String(actual).toLowerCase();
  const want = Array.isArray(f.value) ? f.value : [f.value];
  const w = want.map((x) => String(x ?? "").toLowerCase());
  switch (f.operator) {
    case "equals":
      return w.includes(a);
    case "contains":
      return w.some((x) => a.includes(x));
    case "not_contains":
      return !w.some((x) => a.includes(x));
    case "gt":
      return num(actual) > num(f.value);
    case "gte":
      return num(actual) >= num(f.value);
    case "lt":
      return num(actual) < num(f.value);
    case "lte":
      return num(actual) <= num(f.value);
  }
  return true;
}

/**
 * CleverTap wants the cursor exactly as returned (it may already contain
 * encoded characters), so don't URL-encode it again. Only neutralise the
 * characters that would change the URL's structure.
 */
const rawCursor = (c: string) => c.replace(/[&#\s]/g, encodeURIComponent);

/**
 * Step 2: fetch one batch and keep only the requested user's records
 * (or everything when no lookup is given).
 * The API cannot filter by user, so filtering happens here to avoid shipping
 * up to 5,000 other users' records to the browser.
 */
export async function fetchEventBatch(
  creds: Credentials,
  cursor: string,
  lookup?: UserLookup,
  eventProperties: PropertyFilter[] = [],
): Promise<EventBatchResponse> {
  // Batches are fetched with POST + ?cursor= (as in the working reference
  // implementation), not the GET shown in the docs.
  const res = await fetch(
    `${base(creds.region)}/events.json?cursor=${rawCursor(cursor)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(creds) },
      cache: "no-store",
    },
  );
  const data = await readJson(res);

  // Still being prepared on CleverTap's side: HTTP 202, or {"status":"fail","code":2}
  if (res.status === 202 || (data.status === "fail" && data.code === 2)) {
    return { status: "pending" };
  }

  if (data.status === "success") {
    const all = (data.records as EventRecord[] | undefined) ?? [];
    return {
      status: "success",
      records: all.filter(
        (r) =>
          (!lookup || matches(r, lookup)) &&
          eventProperties.every((f) => matchesProperty(r, f)),
      ),
      nextCursor: typeof data.next_cursor === "string" ? data.next_cursor : null,
      scanned: all.length,
    };
  }
  return { status: "fail", error: errorOf(data, res, "Fetch batch") };
}

import type {
  Credentials,
  DateRange,
  EventBatchResponse,
  EventRecord,
  ExportStartResponse,
  ProfileRecord,
  ProfileResponse,
  EventFilters,
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

/**
 * CleverTap stores phones as "+<country code><number>" and matches them
 * exactly, so tidy what the user typed ("+99 1919-291931" -> "+991919291931").
 */
function normaliseProfileFilter(f: PropertyFilter): PropertyFilter {
  if (f.name.trim().toLowerCase() !== "phone" || typeof f.value !== "string") return f;
  const v = f.value.trim();
  return { ...f, value: v.startsWith("+") ? `+${v.replace(/\D/g, "")}` : v.replace(/[\s()-]/g, "") };
}

/**
 * Each of our requests makes ONE short call to CleverTap. Hosts kill slow
 * functions (a 504 with a non-JSON body), so anything slower than this is
 * reported as "pending" and the browser asks again.
 */
const UPSTREAM_TIMEOUT_MS = 20_000;

type Upstream = { data: Record<string, unknown>; res: Response } | "timeout";

async function upstream(url: string, init: RequestInit): Promise<Upstream> {
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    return { data: await readJson(res), res };
  } catch (e) {
    if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) {
      return "timeout";
    }
    throw e;
  }
}

/**
 * Step 1 of the Get Events API: ask for a cursor over events in the range.
 * With filters, one attempt is made with them attached (CleverTap can then
 * return only the matching users). If CleverTap rejects that, the reply says
 * `filterRejected` and the browser asks again with useFilter=false (a plain
 * export, re-filtered record by record in fetchEventBatch). HTTP 202 / slow
 * replies come back as "pending".
 */
export async function startEventExport(
  creds: Credentials,
  eventName: string,
  range: DateRange,
  lookup?: UserLookup,
  filters: EventFilters = NO_FILTERS,
  useFilter = true,
): Promise<ExportStartResponse> {
  // Event property filters use the same shape as the count APIs. If CleverTap
  // ignores them, fetchEventBatch re-applies them to every record.
  const plain = {
    event_name: eventName,
    from: range.from,
    to: range.to,
    ...(filters.eventProperties.length ? { event_properties: filters.eventProperties } : {}),
  };
  const lookupFilter = lookup && useFilter ? ctqlProfileFilter(lookup) : null;
  const profileFields = [
    ...(lookupFilter ? [lookupFilter] : []),
    ...filters.profile.map(normaliseProfileFilter),
  ];
  const common = {
    ...(profileFields.length ? { profile_fields: profileFields } : {}),
    ...(filters.technographics.length ? { technographics: filters.technographics } : {}),
  };
  const filtered = useFilter && Object.keys(common).length > 0;

  const r = await upstream(`${base(creds.region)}/events.json?batch_size=5000`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(creds) },
    body: JSON.stringify(filtered ? { ...plain, common_profile_properties: common } : plain),
  });

  if (r === "timeout" || r.res.status === 202) return { status: "pending" };
  if (r.data.status === "success" && typeof r.data.cursor === "string") {
    return { status: "success", cursor: r.data.cursor, filtered };
  }
  return {
    status: "fail",
    error: errorOf(r.data, r.res, "Start export"),
    filterRejected: filtered,
  };
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

const NO_FILTERS: EventFilters = { eventProperties: [], profile: [], technographics: [] };

/** Profile fields as a flat map: top-level identity fields plus profileData. */
function profileProps(rec: EventRecord): Record<string, unknown> {
  const { profileData, ...top } = rec.profile ?? {};
  return { ...top, ...(profileData ?? {}) };
}

/**
 * Re-applies a property filter to an exported record (technographics aren't
 * re-checked: their field names in the export differ from the filter names).
 */
function matchesProperty(
  source: Record<string, unknown> | undefined,
  f: PropertyFilter,
  /**
   * CleverTap already applied this filter to the export. The exported record
   * may simply not include the property, so only drop a record when it has the
   * property and it positively fails; never because the property is absent.
   */
  lenient = false,
): boolean {
  const props = source ?? {};
  const key = Object.keys(props).find((k) => k.toLowerCase() === f.name.toLowerCase());
  const actual = key === undefined ? undefined : props[key];
  if (actual === undefined || actual === null) {
    if (lenient) return true;
    if (f.operator === "exists") return false;
    if (f.operator === "not_exists") return true;
    return f.operator === "not_contains";
  }
  if (f.operator === "exists") return true;
  if (f.operator === "not_exists") return false;

  const a = String(actual).toLowerCase();
  const want = Array.isArray(f.value) ? f.value : [f.value];
  const w = want.map((x) => String(x ?? "").toLowerCase());
  switch (f.operator) {
    case "equals":
      // Phones compare on digits so "+99 1919 291931" equals "+991919291931"
      if (f.name.trim().toLowerCase() === "phone") {
        return want.some((x) => samePhone(digits(actual), digits(x)));
      }
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
  filters: EventFilters = NO_FILTERS,
  /** true when CleverTap accepted the filters on the export request */
  serverFiltered = false,
): Promise<EventBatchResponse> {
  // Batches are fetched with POST + ?cursor= (as in the working reference
  // implementation), not the GET shown in the docs.
  const r = await upstream(`${base(creds.region)}/events.json?cursor=${rawCursor(cursor)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(creds) },
  });
  if (r === "timeout") return { status: "pending" };
  const { data, res } = r;

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
          filters.eventProperties.every((f) =>
            matchesProperty(r.event_props, f, serverFiltered),
          ) &&
          filters.profile.every((f) =>
            matchesProperty(profileProps(r), f, serverFiltered),
          ),
      ),
      nextCursor: typeof data.next_cursor === "string" ? data.next_cursor : null,
      scanned: all.length,
    };
  }
  return { status: "fail", error: errorOf(data, res, "Fetch batch") };
}

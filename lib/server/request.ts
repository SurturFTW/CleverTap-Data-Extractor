import {
  FILTER_OPERATORS,
  REGIONS,
  type Credentials,
  type DateRange,
  type PropertyFilter,
  type UserLookup,
} from "@/lib/clevertap/types";

export const badRequest = (error: string) =>
  Response.json({ status: "fail", error }, { status: 400 });

export function parseCreds(
  c: Partial<Credentials> | undefined,
): Credentials | string {
  const accountId = c?.accountId?.trim();
  const passcode = c?.passcode?.trim();
  if (!accountId || !passcode) return "Account ID and passcode are required";
  if (!c?.region || !REGIONS.includes(c.region)) return "Unknown region";
  return { accountId, passcode, region: c.region };
}

const isDate = (n: unknown) =>
  typeof n === "number" && Number.isInteger(n) && n >= 19000101 && n <= 99991231;

export function parseRange(r: Partial<DateRange> | undefined): DateRange | string {
  if (!r || !isDate(r.from) || !isDate(r.to)) return "from/to must be YYYYMMDD integers";
  if (r.from! > r.to!) return "From date must be on or before To date";
  return { from: r.from!, to: r.to! };
}

export function parseLookup(l: Partial<UserLookup> | undefined): UserLookup | string {
  const value = l?.value?.trim();
  if (!l || !value) return "Enter an email, phone, identity or objectId to look up";
  if (!["identity", "email", "objectId", "phone"].includes(l.type as string))
    return "Unknown lookup type";
  return { type: l.type as UserLookup["type"], value };
}

export function parseFilters(list: unknown): PropertyFilter[] | string {
  if (list == null) return [];
  if (!Array.isArray(list)) return "Invalid event property filters";
  const out: PropertyFilter[] = [];
  for (const f of list as Partial<PropertyFilter>[]) {
    if (!f?.name || typeof f.name !== "string" || !FILTER_OPERATORS.includes(f.operator as never))
      return "Invalid event property filter";
    out.push({ name: f.name, operator: f.operator!, ...(f.value !== undefined && { value: f.value }) });
  }
  return out;
}

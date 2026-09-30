export type UploadKind = "profile" | "event";

export type IdType = "identity" | "objectId" | "FBID" | "GPID";

export const ID_TYPES: { value: IdType; label: string }[] = [
  { value: "identity", label: "Identity" },
  { value: "objectId", label: "CleverTap ID (objectId)" },
  { value: "FBID", label: "Facebook ID (FBID)" },
  { value: "GPID", label: "Google Plus ID (GPID)" },
];

export type ValueType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "list"
  | "incr"
  | "decr"
  | "add"
  | "remove";

export const VALUE_TYPES: { value: ValueType; label: string; profileOnly?: boolean }[] = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "True / False" },
  { value: "date", label: "Date & time" },
  { value: "list", label: "List (comma separated)", profileOnly: true },
  { value: "incr", label: "Increment by", profileOnly: true },
  { value: "decr", label: "Decrement by", profileOnly: true },
  { value: "add", label: "Add to list", profileOnly: true },
  { value: "remove", label: "Remove from list", profileOnly: true },
];

export type PropRow = { id: string; key: string; type: ValueType; value: string };

export type RecordDraft = {
  id: string;
  idType: IdType;
  idValue: string;
  /** events only */
  evtName: string;
  /** events only; value of a datetime-local input, empty = now */
  ts: string;
  props: PropRow[];
};

export const uid = () => Math.random().toString(36).slice(2);

export const newProp = (): PropRow => ({ id: uid(), key: "", type: "string", value: "" });

export const newDraft = (): RecordDraft => ({
  id: uid(),
  idType: "identity",
  idValue: "",
  evtName: "",
  ts: "",
  props: [newProp()],
});

/** Standard profile properties CleverTap gives special meaning to */
export const STANDARD_PROFILE_KEYS = [
  "Name",
  "Email",
  "Phone",
  "Gender",
  "DOB",
  "Photo",
  "Customer Type",
  "MSG-email",
  "MSG-sms",
  "MSG-whatsapp",
];

export const MAX_RECORDS = 1000;
const MAX_LEN = 1024;
const MAX_EVENT_PROPS = 100;
const MAX_PROFILE_PROPS = 256;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const epoch = (local: string) => Math.floor(new Date(local).getTime() / 1000);

const splitList = (raw: string) =>
  raw.split(",").map((s) => s.trim()).filter(Boolean);

/** Turns the text typed for a property into the JSON value CleverTap expects. */
export function convertValue(type: ValueType, raw: string): Result<unknown> {
  const v = raw.trim();
  switch (type) {
    case "string":
      return v ? { ok: true, value: raw } : fail("value is empty");
    case "number": {
      if (!v || !Number.isFinite(Number(v))) return fail("must be a number");
      return { ok: true, value: Number(v) };
    }
    case "boolean":
      return v === "true" || v === "false"
        ? { ok: true, value: v === "true" }
        : fail("choose true or false");
    case "date": {
      const sec = epoch(v);
      return v && Number.isFinite(sec) ? { ok: true, value: `$D_${sec}` } : fail("pick a date and time");
    }
    case "list": {
      const items = splitList(v);
      return items.length ? { ok: true, value: items } : fail("enter at least one item");
    }
    case "incr":
    case "decr": {
      if (!v || !Number.isFinite(Number(v))) return fail("must be a number");
      return { ok: true, value: { [type === "incr" ? "$incr" : "$decr"]: Number(v) } };
    }
    case "add":
    case "remove": {
      const items = splitList(v);
      return items.length
        ? { ok: true, value: { [type === "add" ? "$add" : "$remove"]: items } }
        : fail("enter at least one item");
    }
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+\d{6,15}$/;

/** Extra checks for the profile properties CleverTap validates itself (errors 515/516 etc.). */
function checkStandard(key: string, value: unknown): string | null {
  if (key === "Email" && !(typeof value === "string" && EMAIL.test(value.trim())))
    return "is not a valid email address";
  if (key === "Phone" && !(typeof value === "string" && PHONE.test(value.replace(/[\s-]/g, ""))))
    return "must look like +<country code><number>, e.g. +919876543210";
  if (key === "Gender" && value !== "M" && value !== "F") return "must be M or F";
  return null;
}

function buildProps(kind: UploadKind, props: PropRow[]): Result<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const p of props) {
    const key = p.key.trim();
    if (!key && !p.value.trim()) continue; // untouched blank row
    if (!key) return fail("a property has a value but no name");
    if (key.length > MAX_LEN) return fail(`“${key.slice(0, 30)}…” name is too long`);
    if (key in out) return fail(`“${key}” is listed twice`);

    if (kind === "event" && VALUE_TYPES.find((t) => t.value === p.type)?.profileOnly)
      return fail(`“${key}”: ${p.type} is only for profiles`);

    const v = convertValue(p.type, p.value);
    if (!v.ok) return fail(`“${key}”: ${v.error}`);

    if (kind === "profile") {
      const std = checkStandard(key, v.value);
      if (std) return fail(`“${key}” ${std}`);
      // Send the number in the exact form CleverTap stores: +<digits>
      if (key === "Phone") v.value = (v.value as string).replace(/[\s-]/g, "");
    }
    if (typeof v.value === "string" && v.value.length > MAX_LEN)
      return fail(`“${key}”: value is longer than ${MAX_LEN} characters`);
    out[key] = v.value;
  }
  return { ok: true, value: out };
}

/** Builds one upload record, or explains what's wrong with the draft. */
export function buildRecord(kind: UploadKind, d: RecordDraft): Result<Record<string, unknown>> {
  const idValue = d.idValue.trim();
  if (!idValue) return fail("enter the user's identifier");

  const props = buildProps(kind, d.props);
  if (!props.ok) return props;
  const count = Object.keys(props.value).length;

  if (kind === "profile") {
    if (count === 0) return fail("add at least one property");
    if (count > MAX_PROFILE_PROPS) return fail(`too many properties (max ${MAX_PROFILE_PROPS})`);
    return { ok: true, value: { [d.idType]: idValue, type: "profile", profileData: props.value } };
  }

  const evtName = d.evtName.trim();
  if (!evtName) return fail("enter the event name");
  if (count > MAX_EVENT_PROPS) return fail(`too many properties (max ${MAX_EVENT_PROPS})`);
  const record: Record<string, unknown> = {
    [d.idType]: idValue,
    type: "event",
    evtName,
    evtData: props.value,
  };
  if (d.ts.trim()) {
    const ts = epoch(d.ts);
    if (!Number.isFinite(ts)) return fail("invalid timestamp");
    record.ts = ts;
  }
  return { ok: true, value: record };
}

/** Builds the whole batch; errors are prefixed with the record number. */
export function buildBatch(
  kind: UploadKind,
  drafts: RecordDraft[],
): Result<Record<string, unknown>[]> {
  if (drafts.length === 0) return fail("add at least one record");
  if (drafts.length > MAX_RECORDS) return fail(`max ${MAX_RECORDS} records per upload`);
  const records: Record<string, unknown>[] = [];
  for (let i = 0; i < drafts.length; i++) {
    const r = buildRecord(kind, drafts[i]);
    if (!r.ok) return fail(`Record ${i + 1}: ${r.error}`);
    records.push(r.value);
  }
  return { ok: true, value: records };
}

// ---------- API response ----------

export type UnprocessedRecord = {
  status?: string;
  code?: number;
  error?: string;
  record?: unknown;
};

export type UploadResponse = {
  status: "success" | "partial" | "fail";
  processed: number;
  unprocessed: UnprocessedRecord[];
  /** Set when the request itself failed (bad credentials, rate limit, …) */
  error?: string;
};

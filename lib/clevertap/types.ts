export const REGIONS = ["in1", "eu1", "us1", "sg1", "mec1", "aps3"] as const;
export type Region = (typeof REGIONS)[number];

export type Credentials = {
  accountId: string;
  passcode: string;
  region: Region;
};

export type DateRange = {
  /** YYYYMMDD */
  from: number;
  /** YYYYMMDD */
  to: number;
};

export type PropertyFilter = {
  name: string;
  operator: "equals";
  value: string | string[];
};

export type CountQuery = {
  eventName: string;
  eventProperties?: PropertyFilter[];
  technographics?: PropertyFilter[];
};

/** A count query tagged with a result key */
export type Keyed = { key: string; query: CountQuery };

/** Normalised response from /api/clevertap/count */
export type CountResponse =
  | { status: "success"; count: number }
  | { status: "partial"; reqId: number | string }
  | { status: "fail"; error: string };

// ---------- User data (profile / events) ----------

export type LookupType = "identity" | "email" | "objectId" | "phone";

export type UserLookup = { type: LookupType; value: string };

export type EventSummary = { count: number; first_seen: number; last_seen: number };

export type ProfileRecord = {
  email?: string;
  identity?: string;
  profileData?: Record<string, unknown>;
  events?: Record<string, EventSummary>;
  platformInfo?: Record<string, unknown>[];
  [key: string]: unknown;
};

export type EventRecord = {
  profile?: {
    objectId?: string;
    platform?: string;
    email?: string;
    identity?: string;
    phone?: string;
    profileData?: Record<string, unknown>;
  };
  /** yyyyMMddHHmmss in the account timezone */
  ts?: number;
  event_props?: Record<string, unknown>;
  session_props?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ProfileResponse =
  | { status: "success"; record: ProfileRecord | null }
  | { status: "fail"; error: string };

export type ExportStartResponse =
  | {
      status: "success";
      cursor: string;
      /** true if CleverTap accepted the Email/Phone filter on the export request */
      filtered: boolean;
    }
  | { status: "fail"; error: string };

export type EventBatchResponse =
  | {
      status: "success";
      /** Only the records that matched the user lookup */
      records: EventRecord[];
      nextCursor: string | null;
      /** How many records (all users) were scanned in this batch */
      scanned: number;
    }
  | { status: "pending" }
  | { status: "fail"; error: string };

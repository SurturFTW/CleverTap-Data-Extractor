import type { CountQuery, Keyed } from "./types";

export const EVENT_SENT = "Notification Sent";
export const EVENT_IMPRESSION = "Push Impressions";

export type PushMode = "ALL" | "TOTAL" | "ANDROID" | "IOS";

export const PUSH_MODES: { value: PushMode; label: string }[] = [
  { value: "ALL", label: "All (total + Android + iOS)" },
  { value: "TOTAL", label: "Total only" },
  { value: "ANDROID", label: "Android only" },
  { value: "IOS", label: "iOS only" },
];

export type PushKey =
  | "totalSent"
  | "totalImpressions"
  | "androidSent"
  | "androidImpressions"
  | "iosSent"
  | "iosImpressions";

const sent = (value: string | string[]): CountQuery => ({
  eventName: EVENT_SENT,
  eventProperties: [{ name: "Campaign Type", operator: "equals", value }],
});

const impressions = (os?: string): CountQuery => ({
  eventName: EVENT_IMPRESSION,
  ...(os && {
    technographics: [{ name: "OS", operator: "equals" as const, value: [os] }],
  }),
});

export function pushQueries(mode: PushMode): (Keyed & { key: PushKey })[] {
  const all = mode === "ALL";
  const out: (Keyed & { key: PushKey })[] = [];

  if (all || mode === "TOTAL") {
    out.push(
      { key: "totalSent", query: sent(["Mobile Push - Android", "Mobile Push - iOS"]) },
      { key: "totalImpressions", query: impressions() },
    );
  }
  if (all || mode === "ANDROID") {
    out.push(
      { key: "androidSent", query: sent("Mobile Push - Android") },
      { key: "androidImpressions", query: impressions("Android") },
    );
  }
  if (all || mode === "IOS") {
    out.push(
      { key: "iosSent", query: sent("Mobile Push - iOS") },
      { key: "iosImpressions", query: impressions("iOS") },
    );
  }
  return out;
}

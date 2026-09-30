import type { Keyed } from "./types";

export const IDENTITY_ROWS = [
  { label: "Identity Set (New User)", event: "Identity Set", type: "new user" },
  { label: "Identity Set (Merged)", event: "Identity Set", type: "merged" },
  { label: "Identity Set (Appended)", event: "Identity Set", type: "appended" },
  { label: "Identity Error", event: "Identity Error", type: null },
] as const;

export type IdentitySource = "sdk" | "api";

export function identityQueries(): Keyed[] {
  return IDENTITY_ROWS.flatMap((row) =>
    (["sdk", "api"] as const).map((source) => ({
      key: `${row.label}:${source}`,
      query: {
        eventName: row.event,
        eventProperties: [
          { name: "source", operator: "equals" as const, value: source },
          ...(row.type
            ? [{ name: "type", operator: "equals" as const, value: row.type }]
            : []),
        ],
      },
    })),
  );
}

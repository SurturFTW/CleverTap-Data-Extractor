"use client";

import { useRef, useState } from "react";
import { Loader2, Search, UserSearch, X } from "lucide-react";
import Link from "next/link";
import {
    fetchProfile,
    scanUserEvents,
    type ScanProgress,
} from "@/lib/clevertap/user-data";
import type {
    Credentials,
    EventRecord,
    LookupType,
    ProfileRecord,
} from "@/lib/clevertap/types";
import { daysAgo, isoToInt } from "@/lib/utils/dates";
import AccountFields, {
    useSelectedAccount,
} from "@/components/shared/AccountFields";
import {
    CopyTextButton,
    DownloadTextButton,
    ErrorBanner,
    Label,
    PrimaryButton,
    SecondaryButton,
    inputClass,
} from "@/components/shared/ui";
import EventPicker from "@/components/shared/EventPicker";
import EventResults from "./EventResults";
import ProfileResults from "./ProfileResults";

type Tab = "profile" | "events";

const LOOKUP_TYPES: { value: LookupType; label: string }[] = [
    { value: "identity", label: "Identity" },
    { value: "email", label: "Email" },
    { value: "objectId", label: "CleverTap ID (objectId)" },
    { value: "phone", label: "Phone" },
];

// Profile API: identity / email / objectId. Event export: email / phone.
const LOOKUPS_BY_TAB: Record<"profile" | "events", LookupType[]> = {
    profile: ["identity", "email", "objectId"],
    events: ["email", "phone"],
};

type EventRun = {
    name: string;
    records: EventRecord[];
    progress: ScanProgress | null;
    status: "pending" | "running" | "done" | "error";
    error?: string;
};

export default function UserDataTool() {
    const account = useSelectedAccount();
    const { current } = account;

    const [tab, setTab] = useState<Tab>("profile");
    const [lookupType, setLookupType] = useState<LookupType>("email");
    const [lookupValue, setLookupValue] = useState("");
    const [eventNames, setEventNames] = useState<string[]>(["App Launched"]);
    const [eventInput, setEventInput] = useState("");
    const [from, setFrom] = useState(daysAgo(1));
    const [to, setTo] = useState(daysAgo(0));

    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<ProfileRecord | null | undefined>(
        undefined,
    );
    // Whether the last events scan was for one user (vs. all users)
    const [lookupUsed, setLookupUsed] = useState(true);
    const [runs, setRuns] = useState<EventRun[] | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    function validate(): {
        creds: Credentials;
        lookup?: { type: LookupType; value: string };
    } | null {
        setError(null);
        if (!current.accountId.trim() || !current.passcode.trim()) {
            setError("Enter the Account ID and Passcode.");
            return null;
        }
        // Profiles need an identifier; events don't (empty = all users).
        if (tab === "profile" && !lookupValue.trim()) {
            setError("Enter the identity, email or CleverTap ID to look up.");
            return null;
        }
        return {
            creds: {
                accountId: current.accountId.trim(),
                passcode: current.passcode.trim(),
                region: current.region,
            },
            lookup: lookupValue.trim()
                ? { type: lookupType, value: lookupValue.trim() }
                : undefined,
        };
    }

    async function run() {
        const v = validate();
        if (!v) return;

        const controller = new AbortController();
        abortRef.current = controller;
        setRunning(true);

        try {
            if (tab === "profile") {
                setProfile(undefined);
                setProfile(
                    await fetchProfile(v.creds, v.lookup!, controller.signal),
                );
            } else {
                const fromInt = isoToInt(from);
                const toInt = isoToInt(to);
                const names = Array.from(
                    new Set(
                        [
                            ...eventNames,
                            ...eventInput.split(",").map((n) => n.trim()),
                        ].filter(Boolean),
                    ),
                );
                if (names.length === 0)
                    return setError("Add at least one event.");
                if (!fromInt || !toInt)
                    return setError("Pick a valid date range.");
                if (fromInt > toInt)
                    return setError("From date must be on or before To date.");

                setLookupUsed(!!v.lookup);
                setEventNames(names);
                setEventInput("");
                setRuns(
                    names.map((name) => ({
                        name,
                        records: [],
                        progress: null,
                        status: "pending",
                    })),
                );
                const update = (
                    name: string,
                    fn: (r: EventRun) => Partial<EventRun>,
                ) =>
                    setRuns(
                        (prev) =>
                            prev &&
                            prev.map((r) =>
                                r.name === name ? { ...r, ...fn(r) } : r,
                            ),
                    );

                // One event at a time; a failure in one event doesn't stop the others.
                for (const name of names) {
                    if (controller.signal.aborted) break;
                    update(name, () => ({ status: "running" }));
                    try {
                        await scanUserEvents(
                            v.creds,
                            name,
                            { from: fromInt, to: toInt },
                            v.lookup,
                            (batch, p) =>
                                update(name, (r) => ({
                                    records: [...r.records, ...batch],
                                    progress: p,
                                })),
                            controller.signal,
                        );
                        update(name, () => ({ status: "done" }));
                    } catch (e) {
                        if (controller.signal.aborted) break;
                        update(name, () => ({
                            status: "error",
                            error:
                                e instanceof Error
                                    ? e.message
                                    : "Request failed",
                        }));
                    }
                }
            }
        } catch (e) {
            if (!controller.signal.aborted) {
                setError(e instanceof Error ? e.message : "Request failed");
            }
        } finally {
            setRunning(false);
        }
    }

    function stop() {
        abortRef.current?.abort();
        setRunning(false);
        setRuns(
            (prev) =>
                prev &&
                prev.map((r) =>
                    r.status === "running"
                        ? {
                              ...r,
                              status: "done",
                              progress: r.progress && {
                                  ...r.progress,
                                  done: true,
                              },
                          }
                        : r,
                ),
        );
    }


    return (
        <div className="flex flex-col gap-6">

            <form
                className="grid gap-4 rounded-xl border border-gray-200 bg-white p-8 shadow-md sm:grid-cols-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    run();
                }}
            >
                <h2 className="flex items-center gap-3 text-xl font-semibold text-black sm:col-span-2">
                    <UserSearch size={24} />
                    Find a user
                </h2>

                <div className="flex gap-2 border-b border-gray-200 sm:col-span-2">
                    {(["profile", "events"] as const).map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => {
                                setTab(t);
                                setError(null);
                                if (!LOOKUPS_BY_TAB[t].includes(lookupType))
                                    setLookupType("email");
                            }}
                            className={`px-4 pb-3 text-base transition-all duration-200 ${
                                tab === t
                                    ? "border-b-2 border-black font-medium text-black"
                                    : "text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            {t === "profile" ? "Profile data" : "Event data"}
                        </button>
                    ))}
                </div>

                <AccountFields {...account} />

                <Label
                    label={
                        tab === "events"
                            ? "Look up by (optional)"
                            : "Look up by"
                    }
                >
                    <select
                        className={inputClass}
                        value={lookupType}
                        onChange={(e) =>
                            setLookupType(e.target.value as LookupType)
                        }
                    >
                        {LOOKUP_TYPES.filter((t) =>
                            LOOKUPS_BY_TAB[tab].includes(t.value),
                        ).map((t) => (
                            <option key={t.value} value={t.value}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                </Label>
                <div className="sm:col-span-2">
                    <Label
                        label={`${LOOKUP_TYPES.find((t) => t.value === lookupType)!.label}${tab === "events" ? " (optional — leave empty for all users)" : ""}`}
                    >
                        <input
                            className={inputClass}
                            value={lookupValue}
                            onChange={(e) => setLookupValue(e.target.value)}
                            autoComplete="off"
                            placeholder={
                                lookupType === "email"
                                    ? "user@example.com"
                                    : lookupType === "phone"
                                      ? "+919876543210"
                                      : "e.g. 5555555555"
                            }
                        />
                    </Label>
                </div>

                {tab === "events" && (
                    <>
                        <div className="sm:col-span-2">
                            <Label label="Events (one or more)">
                                <EventPicker
                                    value={eventNames}
                                    onChange={setEventNames}
                                    input={eventInput}
                                    onInputChange={setEventInput}
                                />
                            </Label>
                        </div>
                        <Label label="From">
                            <input
                                className={inputClass}
                                type="date"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                            />
                        </Label>
                        <Label label="To">
                            <input
                                className={inputClass}
                                type="date"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                            />
                        </Label>
                        <p className="text-sm text-gray-500 sm:col-span-2">
                            Enter an email or phone to get one user&apos;s events;
                            leave it empty to get event data for all users (the
                            first 20,000 records). With a lookup, we ask
                            CleverTap to filter the export to that user; if it
                            can&apos;t, every user&apos;s events for each selected event
                            are scanned and only this user&apos;s are kept, which can
                            take a while on busy events (use a short range, and
                            press Stop any time). For phone, enter the number
                            with its country code (e.g. +91…) so CleverTap can
                            filter it. Notification Sent, Bounce and Control
                            Group events can&apos;t be exported.
                        </p>
                    </>
                )}

                <div className="flex items-center gap-3 pt-2 sm:col-span-2">
                    <PrimaryButton type="submit" disabled={running}>
                        {running ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Search size={18} />
                        )}
                        {running
                            ? tab === "events" && runs
                                ? `Scanning ${runs.filter((r) => r.status === "done" || r.status === "error").length + 1}/${runs.length}…`
                                : "Fetching…"
                            : tab === "profile"
                              ? "Get profile"
                              : "Scan events"}
                    </PrimaryButton>
                    {running && (
                        <SecondaryButton onClick={stop}>
                            <X size={18} />
                            Stop
                        </SecondaryButton>
                    )}
                </div>
            </form>

            {error && <ErrorBanner>{error}</ErrorBanner>}

            {tab === "profile" && profile !== undefined && (
                <ProfileResults record={profile} />
            )}
            {tab === "events" && runs && (
                <>
                    {runs.length > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-gray-600">
                                {runs
                                    .reduce((n, r) => n + r.records.length, 0)
                                    .toLocaleString("en-US")}{" "}
                                matching events across {runs.length} event types
                            </p>
                            <div className="flex gap-2">
                                <CopyTextButton
                                    text={combinedJson(runs)}
                                    label="Copy all"
                                />
                                <DownloadTextButton
                                    text={combinedJson(runs)}
                                    filename="events.json"
                                    label="Download all"
                                />
                            </div>
                        </div>
                    )}
                    {runs.map((r) => (
                        <EventResults
                            key={r.name}
                            eventName={r.name}
                            allUsers={!lookupUsed}
                            records={r.records}
                            progress={r.progress}
                            status={r.status}
                            error={r.error}
                        />
                    ))}
                </>
            )}

            {!current.accountId && (
                <p className="text-center text-sm text-gray-500">
                    Credentials are saved in this browser and shared with{" "}
                    <Link href="/push-impressions" className="underline">
                        Push Impressions
                    </Link>{" "}
                    and{" "}
                    <Link href="/identity-errors" className="underline">
                        Identity Errors
                    </Link>
                    .
                </p>
            )}
        </div>
    );
}

function combinedJson(runs: EventRun[]) {
    return JSON.stringify(
        Object.fromEntries(
            runs.map((r) => [
                r.name,
                r.status === "error"
                    ? { error: r.error, records: r.records }
                    : r.records,
            ]),
        ),
        null,
        2,
    );
}

"use client";

import { useRef, useState } from "react";
import { Download, Hash, Loader2, X } from "lucide-react";
import { fetchCount } from "@/lib/clevertap/fetch-count";
import type {
  CountKind,
  Credentials,
} from "@/lib/clevertap/types";
import { daysAgo, isoToInt } from "@/lib/utils/dates";
import { fmtNumber } from "@/lib/utils/format";
import { runPool } from "@/lib/utils/pool";
import AccountFields, {
  useSelectedAccount,
} from "@/components/shared/AccountFields";
import EventPicker from "@/components/shared/EventPicker";
import PropertyFilters, {
  buildFilters,
  type FilterRow,
} from "@/components/shared/PropertyFilters";
import {
  CopyTsvButton,
  ErrorBanner,
  Label,
  NumCell,
  PrimaryButton,
  SecondaryButton,
  inputClass,
  td,
  th,
  type Cell,
} from "@/components/shared/ui";

const CONCURRENCY = 3;

const cellKey = (event: string, kind: CountKind) => `${event}:${kind}`;

export default function CountsTool() {
  const account = useSelectedAccount();
  const { current } = account;

  const [eventNames, setEventNames] = useState<string[]>(["App Launched"]);
  const [eventInput, setEventInput] = useState("");
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(daysAgo(1));
  const [filters, setFilters] = useState<FilterRow[]>([]);

  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [shown, setShown] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    setError(null);
    const fromInt = isoToInt(from);
    const toInt = isoToInt(to);
    const names = Array.from(
      new Set(
        [...eventNames, ...eventInput.split(",").map((n) => n.trim())].filter(Boolean),
      ),
    );

    if (!current.accountId.trim() || !current.passcode.trim())
      return setError("Enter the Account ID and Passcode.");
    if (names.length === 0) return setError("Add at least one event.");
    if (!fromInt || !toInt) return setError("Pick a valid date range.");
    if (fromInt > toInt) return setError("From date must be on or before To date.");

    const eventProperties = buildFilters(filters);
    if (typeof eventProperties === "string") return setError(eventProperties);

    const creds: Credentials = {
      accountId: current.accountId.trim(),
      passcode: current.passcode.trim(),
      region: current.region,
    };
    const controller = new AbortController();
    abortRef.current = controller;

    setEventNames(names);
    setEventInput("");
    setShown(names);
    setRunning(true);
    setCells(
      Object.fromEntries(
        names.flatMap((n) =>
          (["events", "profiles"] as const).map((k) => [
            cellKey(n, k),
            { state: "loading" } as Cell,
          ]),
        ),
      ),
    );

    const tasks = names.flatMap((name) =>
      (["events", "profiles"] as const).map((kind) => async () => {
        let cell: Cell;
        try {
          const value = await fetchCount(
            creds,
            { eventName: name, eventProperties },
            { from: fromInt, to: toInt },
            controller.signal,
            kind,
          );
          cell = { state: "done", value };
        } catch (e) {
          if (controller.signal.aborted) return;
          cell = {
            state: "error",
            message: e instanceof Error ? e.message : "Failed",
          };
        }
        setCells((prev) => ({ ...prev, [cellKey(name, kind)]: cell }));
      }),
    );

    await runPool(tasks, CONCURRENCY, controller.signal);
    setRunning(false);
  }

  function cancel() {
    abortRef.current?.abort();
    setRunning(false);
    setCells({});
    setShown([]);
  }

  const value = (name: string, kind: CountKind) => {
    const c = cells[cellKey(name, kind)];
    return c?.state === "done" ? c.value : null;
  };
  const perUser = (name: string) => {
    const e = value(name, "events");
    const p = value(name, "profiles");
    return e != null && p != null && p > 0 ? (e / p).toFixed(2) : "–";
  };

  const done = Object.values(cells).filter((c) => c.state !== "loading").length;
  const total = Object.keys(cells).length;

  const tsv: (string | number)[][] = [
    ["Event", "Event count", "Profile count", "Events per profile"],
    ...shown.map((n) => [
      n,
      value(n, "events") ?? "",
      value(n, "profiles") ?? "",
      perUser(n),
    ]),
  ];

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
          <Hash size={24} />
          Event &amp; profile counts
        </h2>

        <AccountFields {...account} />

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
          <input className={inputClass} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Label>
        <Label label="To">
          <input className={inputClass} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Label>

        <PropertyFilters
          filters={filters}
          onChange={setFilters}
          hint="optional, applied to every event"
        />

        <div className="flex items-center gap-3 pt-2 sm:col-span-2">
          <PrimaryButton type="submit" disabled={running}>
            {running ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {running ? `Fetching… (${done}/${total})` : "Get counts"}
          </PrimaryButton>
          {running && (
            <SecondaryButton onClick={cancel}>
              <X size={18} />
              Cancel
            </SecondaryButton>
          )}
          {shown.length > 0 && !running && <CopyTsvButton rows={tsv} />}
        </div>
      </form>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {shown.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-md">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className={th}>Event</th>
                <th className={th}>Event count</th>
                <th className={th}>Profile count</th>
                <th className={th}>Events per profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {shown.map((n) => (
                <tr key={n}>
                  <td className={`${td} font-medium text-black`}>{n}</td>
                  <td className={td}><NumCell cell={cells[cellKey(n, "events")]} /></td>
                  <td className={td}><NumCell cell={cells[cellKey(n, "profiles")]} /></td>
                  <td className={td}>{perUser(n) === "–" ? "–" : fmtNumber(Number(perUser(n)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

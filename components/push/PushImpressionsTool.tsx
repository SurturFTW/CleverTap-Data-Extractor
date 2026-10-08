"use client";

import { BellRing, Download, Loader2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { fetchCount } from "@/lib/clevertap/fetch-count";
import {
  PUSH_MODES,
  pushQueries,
  type PushKey,
  type PushMode,
} from "@/lib/clevertap/push-queries";
import type { Account } from "@/lib/utils/use-saved-accounts";
import AccountFields, {
  useSelectedAccount,
} from "@/components/shared/AccountFields";
import { daysAgo, isoToInt } from "@/lib/utils/dates";
import { fmtPercent, ratio } from "@/lib/utils/format";
import { runPool } from "@/lib/utils/pool";
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

// Column layout mirrors the original sheet
const GROUPS = [
  { title: "Total", sent: "totalSent", imp: "totalImpressions" },
  { title: "Android", sent: "androidSent", imp: "androidImpressions" },
  { title: "iOS", sent: "iosSent", imp: "iosImpressions" },
] as const satisfies readonly { title: string; sent: PushKey; imp: PushKey }[];

const cellKey = (accountId: string, key: PushKey) => `${accountId}:${key}`;

export default function PushImpressionsTool() {
  const account = useSelectedAccount();
  const { current } = account;
  const [mode, setMode] = useState<PushMode>("ALL");
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(daysAgo(1));

  // Which account the table below was fetched for (the form can change after)
  const [ranFor, setRanFor] = useState("");
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [ran, setRan] = useState<{ accounts: Account[]; mode: PushMode } | null>(null);
  const [running, setRunning] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    setFormError(null);
    const fromInt = isoToInt(from);
    const toInt = isoToInt(to);
    if (!fromInt || !toInt) return setFormError("Pick a valid date range.");
    if (fromInt > toInt)
      return setFormError("From date must be on or before To date.");

    if (!current.accountId.trim() || !current.passcode.trim())
      return setFormError("Enter the Account ID and Passcode.");
    // Snapshot of the chosen account: the table keeps showing it even if the form changes
    const valid: Account[] = [current];

    const queries = pushQueries(mode);
    const controller = new AbortController();
    abortRef.current = controller;

    setRanFor(`${current.name.trim() || current.accountId.trim()} · ${current.region} · ${from} to ${to}`);
    setRan({ accounts: valid, mode });
    setRunning(true);
    setCells(
      Object.fromEntries(
        valid.flatMap((a) =>
          queries.map((q) => [cellKey(a.id, q.key), { state: "loading" } as Cell]),
        ),
      ),
    );

    const tasks = valid.flatMap((a) =>
      queries.map(({ key, query }) => async () => {
        let cell: Cell;
        try {
          const value = await fetchCount(
            {
              accountId: a.accountId.trim(),
              passcode: a.passcode.trim(),
              region: a.region,
            },
            query,
            { from: fromInt, to: toInt },
            controller.signal,
          );
          cell = { state: "done", value };
        } catch (e) {
          if (controller.signal.aborted) return;
          cell = {
            state: "error",
            message: e instanceof Error ? e.message : "Failed",
          };
        }
        setCells((prev) => ({ ...prev, [cellKey(a.id, key)]: cell }));
      }),
    );

    await runPool(tasks, CONCURRENCY, controller.signal);
    setRunning(false);
  }

  function cancel() {
    abortRef.current?.abort();
    setRunning(false);
    setCells({});
    setRan(null);
  }

  const groups = GROUPS.filter(
    (g) => !ran || ran.mode === "ALL" || ran.mode === g.title.toUpperCase(),
  );

  // Metric-major column order: all Sent, then all Impressions, then all %
  const columns = [
    ...groups.map((g) => ({ label: `${g.title} Sent`, kind: "sent" as const, g })),
    ...groups.map((g) => ({ label: `${g.title} Impressions`, kind: "imp" as const, g })),
    ...groups.map((g) => ({ label: `${g.title} %`, kind: "pct" as const, g })),
  ];

  const num = (accountId: string, key: PushKey) => {
    const c = cells[cellKey(accountId, key)];
    return c?.state === "done" ? c.value : 0;
  };

  const tsv = useMemo(() => {
    if (!ran) return [];
    const header = ["Account", ...columns.map((c) => c.label)];
    const body = ran.accounts.map((a) => [
      a.name || a.accountId,
      ...columns.map((c) => {
        const s = num(a.id, c.g.sent);
        const i = num(a.id, c.g.imp);
        return c.kind === "sent" ? s : c.kind === "imp" ? i : fmtPercent(ratio(i, s));
      }),
    ]);
    return [header, ...body];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, ran]);

  const total = Object.keys(cells).length;
  const done = Object.values(cells).filter((c) => c.state !== "loading").length;


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
          <BellRing size={24} />
          CleverTap Account
        </h2>
        <AccountFields {...account} />

        <Label label="From">
          <input className={inputClass} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Label>
        <Label label="To">
          <input className={inputClass} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Label>
        <div className="sm:col-span-2">
          <Label label="Report">
            <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value as PushMode)}>
              {PUSH_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Label>
        </div>

        <div className="flex items-center gap-3 pt-2 sm:col-span-2">
          <PrimaryButton type="submit" disabled={running}>
            {running ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {running ? `Fetching… (${done}/${total})` : "Fetch data"}
          </PrimaryButton>
          {running && (
            <SecondaryButton onClick={cancel}>
              <X size={18} />
              Cancel
            </SecondaryButton>
          )}
          {ran && !running && <CopyTsvButton rows={tsv} />}
        </div>
      </form>

      {formError && <ErrorBanner>{formError}</ErrorBanner>}

      {ran && ranFor && (
        <p className="-mb-2 text-sm text-gray-600">
          Results for <span className="font-medium text-black">{ranFor}</span>
        </p>
      )}

      {ran && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-md">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className={`${th} whitespace-nowrap`}>Account</th>
                {columns.map((c, idx) => (
                  <th
                    key={c.label}
                    className={`${th} whitespace-nowrap ${idx % groups.length === 0 ? "border-l border-gray-200" : ""}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ran.accounts.map((a) => (
                <tr key={a.id}>
                  <td className={`${td} whitespace-nowrap`}>{a.name || a.accountId}</td>
                  {columns.map((c, idx) => {
                    const sent = cells[cellKey(a.id, c.g.sent)];
                    const imp = cells[cellKey(a.id, c.g.imp)];
                    const cls = `${td} whitespace-nowrap ${idx % groups.length === 0 ? "border-l border-gray-200" : ""}`;
                    if (c.kind === "pct") {
                      const both = sent?.state === "done" && imp?.state === "done";
                      return (
                        <td key={c.label} className={cls}>
                          {both ? fmtPercent(ratio(imp.value, sent.value)) : <span className="text-gray-400">–</span>}
                        </td>
                      );
                    }
                    return (
                      <td key={c.label} className={cls}>
                        <NumCell cell={c.kind === "sent" ? sent : imp} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

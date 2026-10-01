"use client";

import { Download, Loader2, Plus, Trash2, Users, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { fetchCount } from "@/lib/clevertap/fetch-count";
import {
  AUDIT_STATUSES,
  summarise,
  tamQueries,
  type AuditEntry,
  type AuditStatus,
  type QuarterSnapshot,
} from "@/lib/clevertap/tam";
import { fmtNumber, fmtPercent, ratio } from "@/lib/utils/format";
import { runPool } from "@/lib/utils/pool";
import { usePersistentState } from "@/lib/utils/use-persistent-state";
import {
  currentQuarter,
  prevQuarter,
  quarterId,
  quarterLabel,
  quarterRange,
  type Quarter,
} from "@/lib/utils/quarters";
import {
  blankAccount,
  useSavedAccounts,
  type Account,
} from "@/lib/utils/use-saved-accounts";
import {
  CopyTsvButton,
  ErrorBanner,
  Label,
  PrimaryButton,
  RegionSelect,
  SecondaryButton,
  inputClass,
  td,
  th,
} from "@/components/shared/ui";

const CONCURRENCY = 3;
const TREND_QUARTERS = 4;

const key = (a: Account, q: Quarter) => `${a.id}|${quarterId(q)}`;
const name = (a: Account) => a.name || a.accountId || "Unnamed";

export default function TamTracker() {
  const [accounts, setAccounts] = useSavedAccounts();
  const [snapshots, setSnapshots] = usePersistentState<Record<string, QuarterSnapshot>>(
    "ct.tam.snapshots",
    {},
  );
  const [audits, setAudits] = usePersistentState<Record<string, AuditEntry>>(
    "ct.tam.audits",
    {},
  );

  const [tam, setTam] = useState("");
  const [quarter, setQuarter] = useState<Quarter>(currentQuarter);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const update = (id: string, patch: Partial<Account>) =>
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const tams = useMemo(
    () => Array.from(new Set(accounts.map((a) => a.tam?.trim()).filter(Boolean) as string[])).sort(),
    [accounts],
  );
  const shown = accounts.filter(
    (a) => (a.accountId.trim() || a.name.trim()) && (!tam || a.tam?.trim() === tam),
  );

  const quarters = useMemo(
    () =>
      Array.from({ length: TREND_QUARTERS }, (_, i) =>
        prevQuarter(quarter, TREND_QUARTERS - 1 - i),
      ),
    [quarter],
  );

  async function run() {
    setFormError(null);
    setErrors({});
    const range = quarterRange(quarter);
    if (!range) return setFormError(`${quarterLabel(quarter)} hasn't started yet.`);

    const runnable = shown.filter((a) => a.accountId.trim() && a.passcode.trim());
    if (runnable.length === 0)
      return setFormError("No accounts with an Account ID and Passcode for this TAM.");

    const queries = tamQueries();
    const controller = new AbortController();
    abortRef.current = controller;
    const values: Record<string, Record<string, number>> = {};
    const failed: Record<string, string> = {};
    const intRange = {
      from: Number(range.from.replaceAll("-", "")),
      to: Number(range.to.replaceAll("-", "")),
    };

    setRunning(true);
    setProgress({ done: 0, total: runnable.length * queries.length });

    const tasks = runnable.flatMap((a) =>
      queries.map(({ key: qk, query }) => async () => {
        try {
          const v = await fetchCount(
            { accountId: a.accountId.trim(), passcode: a.passcode.trim(), region: a.region },
            query,
            intRange,
            controller.signal,
          );
          (values[a.id] ??= {})[qk] = v;
        } catch (e) {
          if (controller.signal.aborted) return;
          failed[a.id] ??= e instanceof Error ? e.message : "Failed";
        } finally {
          setProgress((p) => ({ ...p, done: p.done + 1 }));
        }
      }),
    );
    await runPool(tasks, CONCURRENCY, controller.signal);

    // Only save accounts whose every query succeeded, so partial numbers never look final.
    const fresh: Record<string, QuarterSnapshot> = {};
    for (const a of runnable) {
      if (!failed[a.id] && Object.keys(values[a.id] ?? {}).length === queries.length)
        fresh[key(a, quarter)] = summarise(values[a.id], range);
    }
    if (!controller.signal.aborted) setSnapshots((prev) => ({ ...prev, ...fresh }));
    setErrors(failed);
    setRunning(false);
  }

  function cancel() {
    abortRef.current?.abort();
    setRunning(false);
  }

  const setAudit = (a: Account, patch: Partial<AuditEntry>) =>
    setAudits((prev) => ({
      ...prev,
      [key(a, quarter)]: {
        ...({ status: "not_started", notes: "" } as AuditEntry),
        ...prev[key(a, quarter)],
        ...patch,
      },
    }));

  const statusLabel = (s?: AuditStatus) =>
    AUDIT_STATUSES.find((x) => x.value === (s ?? "not_started"))!.label;

  const tsv = useMemo(() => {
    const header = [
      "Account", "TAM", "Quarter", "Identity Set", "Identity Errors", "Identity Error %",
      "Push Sent", "Push Impressions", "Impression %", "Audit status", "Audit notes",
    ];
    const rows = shown.map((a) => {
      const s = snapshots[key(a, quarter)];
      const au = audits[key(a, quarter)];
      return [
        name(a), a.tam ?? "", quarterLabel(quarter),
        s?.identitySet ?? "", s?.identityErrors ?? "",
        s ? fmtPercent(ratio(s.identityErrors, s.identitySet + s.identityErrors)) : "",
        s?.pushSent ?? "", s?.pushImpressions ?? "",
        s ? fmtPercent(ratio(s.pushImpressions, s.pushSent)) : "",
        statusLabel(au?.status), au?.notes ?? "",
      ];
    });
    return [header, ...rows];
  }, [shown, snapshots, audits, quarter]);

  const na = <span className="text-gray-400">–</span>;
  const range = quarterRange(quarter);

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-8 shadow-md"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <h2 className="flex items-center gap-3 text-xl font-semibold text-black">
          <Users size={24} />
          Quarterly review
        </h2>

        <div className="grid gap-3 sm:grid-cols-3">
          <Label label="TAM">
            <select className={inputClass} value={tam} onChange={(e) => setTam(e.target.value)}>
              <option value="">All accounts</option>
              {tams.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Label>
          <Label label="Year">
            <input
              className={inputClass}
              type="number"
              min={2015}
              max={2100}
              value={quarter.year}
              onChange={(e) => {
                const year = Number(e.target.value);
                if (year >= 2015) setQuarter((q) => ({ ...q, year }));
              }}
            />
          </Label>
          <Label label="Quarter">
            <select
              className={inputClass}
              value={quarter.q}
              onChange={(e) => setQuarter((q) => ({ ...q, q: Number(e.target.value) as Quarter["q"] }))}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>Q{n} ({["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"][n - 1]})</option>
              ))}
            </select>
          </Label>
        </div>
        <p className="text-sm text-gray-500">
          {range
            ? `Fetches ${range.from} to ${range.to}${range.partial ? " (quarter in progress, ends yesterday)" : ""}.`
            : "This quarter hasn't started yet."}{" "}
          Results and audit notes are saved in this browser, so you can compare quarters.
        </p>

        <details className="rounded-xl border border-gray-200 p-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            Manage accounts ({accounts.length}) — set each account&apos;s TAM here
          </summary>
          <div className="mt-4 flex flex-col gap-3">
            {accounts.map((a) => (
              <div key={a.id} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_110px_auto]">
                <Label label="Name">
                  <input className={inputClass} value={a.name} onChange={(e) => update(a.id, { name: e.target.value })} />
                </Label>
                <Label label="TAM">
                  <input className={inputClass} value={a.tam ?? ""} onChange={(e) => update(a.id, { tam: e.target.value })} />
                </Label>
                <Label label="Account ID">
                  <input className={inputClass} value={a.accountId} onChange={(e) => update(a.id, { accountId: e.target.value })} autoComplete="off" />
                </Label>
                <Label label="Passcode">
                  <input className={inputClass} type="password" value={a.passcode} onChange={(e) => update(a.id, { passcode: e.target.value })} autoComplete="off" />
                </Label>
                <Label label="Region">
                  <RegionSelect value={a.region} onChange={(region) => update(a.id, { region })} />
                </Label>
                <SecondaryButton
                  type="button"
                  disabled={accounts.length === 1}
                  onClick={() => setAccounts((prev) => prev.filter((x) => x.id !== a.id))}
                >
                  <Trash2 size={18} />
                  Remove
                </SecondaryButton>
              </div>
            ))}
            <div>
              <SecondaryButton type="button" onClick={() => setAccounts((p) => [...p, blankAccount()])}>
                <Plus size={18} />
                Add account
              </SecondaryButton>
            </div>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <PrimaryButton type="submit" disabled={running}>
            {running ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {running ? `Fetching… (${progress.done}/${progress.total})` : `Fetch ${quarterLabel(quarter)}`}
          </PrimaryButton>
          {running && (
            <SecondaryButton onClick={cancel}>
              <X size={18} />
              Cancel
            </SecondaryButton>
          )}
          {!running && shown.length > 0 && <CopyTsvButton rows={tsv} />}
        </div>
      </form>

      {formError && <ErrorBanner>{formError}</ErrorBanner>}
      {Object.entries(errors).map(([id, msg]) => (
        <ErrorBanner key={id}>
          {name(accounts.find((a) => a.id === id)!)}: {msg}
        </ErrorBanner>
      ))}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-md">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {["Account", "Identity Set", "Identity Errors", "Error %", "Push Sent", "Impressions", "Impression %", "Audit", "Notes"].map((h) => (
                <th key={h} className={`${th} whitespace-nowrap`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {shown.length === 0 && (
              <tr>
                <td className={`${td} text-gray-500`} colSpan={9}>
                  No accounts{tam ? ` for ${tam}` : ""}. Add them under “Manage accounts”.
                </td>
              </tr>
            )}
            {shown.map((a) => {
              const s = snapshots[key(a, quarter)];
              const au = audits[key(a, quarter)];
              return (
                <tr key={a.id}>
                  <td className={`${td} whitespace-nowrap font-medium text-black`}>
                    {name(a)}
                    {a.tam && <span className="block text-xs font-normal text-gray-500">{a.tam}</span>}
                  </td>
                  <td className={td}>{s ? fmtNumber(s.identitySet) : na}</td>
                  <td className={td}>{s ? fmtNumber(s.identityErrors) : na}</td>
                  <td className={td}>{s ? fmtPercent(ratio(s.identityErrors, s.identitySet + s.identityErrors)) : na}</td>
                  <td className={td}>{s ? fmtNumber(s.pushSent) : na}</td>
                  <td className={td}>{s ? fmtNumber(s.pushImpressions) : na}</td>
                  <td className={td}>{s ? fmtPercent(ratio(s.pushImpressions, s.pushSent)) : na}</td>
                  <td className={td}>
                    <select
                      className={`${inputClass} min-w-32 py-1.5 text-sm`}
                      value={au?.status ?? "not_started"}
                      onChange={(e) => setAudit(a, { status: e.target.value as AuditStatus })}
                    >
                      {AUDIT_STATUSES.map((x) => (
                        <option key={x.value} value={x.value}>{x.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className={td}>
                    <input
                      className={`${inputClass} min-w-56 py-1.5 text-sm`}
                      placeholder="Audit notes"
                      value={au?.notes ?? ""}
                      onChange={(e) => setAudit(a, { notes: e.target.value })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {shown.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-md">
          <p className="px-3 pt-3 text-sm font-medium text-gray-700">
            Quarter over quarter <span className="font-normal text-gray-500">(identity error % · push impression %, from saved fetches)</span>
          </p>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className={th}>Account</th>
                {quarters.map((q) => (
                  <th key={quarterId(q)} className={`${th} whitespace-nowrap`}>{quarterLabel(q)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {shown.map((a) => (
                <tr key={a.id}>
                  <td className={`${td} whitespace-nowrap`}>{name(a)}</td>
                  {quarters.map((q) => {
                    const s = snapshots[key(a, q)];
                    return (
                      <td key={quarterId(q)} className={`${td} whitespace-nowrap`}>
                        {s
                          ? `${fmtPercent(ratio(s.identityErrors, s.identitySet + s.identityErrors))} · ${fmtPercent(ratio(s.pushImpressions, s.pushSent))}`
                          : na}
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

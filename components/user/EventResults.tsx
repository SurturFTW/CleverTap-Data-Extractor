"use client";

import { useMemo } from "react";
import type { EventRecord } from "@/lib/clevertap/types";
import type { ScanProgress } from "@/lib/clevertap/user-data";
import { fmtCtTs, fmtNumber, fmtValue } from "@/lib/utils/format";
import { CopyTextButton, DownloadTextButton, td, th } from "@/components/shared/ui";

/** Rendering thousands of rows is slow; copy/download always include everything. */
const ROW_LIMIT = 500;

const userLabel = (r: EventRecord) =>
  r.profile?.identity || r.profile?.email || r.profile?.phone || r.profile?.objectId || "–";

function PropList({ data }: { data?: Record<string, unknown> }) {
  const entries = Object.entries(data ?? {});
  if (entries.length === 0) return <span className="text-gray-400">–</span>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-gray-500">{k}</dt>
          <dd className="break-all font-mono text-gray-900">{fmtValue(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function EventResults({
  eventName,
  allUsers,
  records,
  progress,
  status,
  error,
}: {
  eventName: string;
  /** No user lookup: records belong to many users */
  allUsers: boolean;
  records: EventRecord[];
  progress: ScanProgress | null;
  status: "pending" | "running" | "done" | "error";
  error?: string;
}) {
  const sorted = useMemo(
    () => [...records].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)),
    [records],
  );
  const json = useMemo(() => JSON.stringify(sorted, null, 2), [sorted]);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
        <div>
          <h3 className="text-base font-semibold text-black">
            {fmtNumber(sorted.length)} “{eventName}” event{sorted.length === 1 ? "" : "s"} found
          </h3>
          {progress && (
            <p className="mt-0.5 text-xs text-gray-500">
              Scanned {fmtNumber(progress.scanned)} records in {progress.batches} batch
              {progress.batches === 1 ? "" : "es"}
              {allUsers
                ? " · all users"
                : progress.serverFiltered
                  ? " · filtered by CleverTap"
                  : " · all users scanned"}
              {progress.done ? "" : " … still scanning"}
            </p>
          )}
        </div>
        {sorted.length > 0 && (
          <div className="flex gap-2">
            <CopyTextButton text={json} />
            <DownloadTextButton text={json} filename={`${eventName}-events.json`} />
          </div>
        )}
      </div>

      {status === "error" && (
        <p className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm text-red-700">
          {error ?? "Request failed"}
          {progress && progress.scanned > 0 ? ` (after scanning ${fmtNumber(progress.scanned)} records)` : ""}
        </p>
      )}

      {status === "pending" && (
        <p className="px-5 py-4 text-sm text-gray-500">Waiting for the previous event to finish…</p>
      )}

      {progress?.truncated && (
        <p className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-sm text-amber-800">
          Stopped after {fmtNumber(progress.scanned)} records.{" "}
          {allUsers
            ? "Enter an email or phone, or narrow the date range, to see more."
            : "Narrow the date range to scan everything."}
        </p>
      )}

      {sorted.length > ROW_LIMIT && (
        <p className="border-b border-gray-200 bg-gray-50 px-5 py-2 text-sm text-gray-600">
          Showing the newest {ROW_LIMIT} of {fmtNumber(sorted.length)}. Copy or download for all of them.
        </p>
      )}

      <div className={`max-h-[32rem] overflow-auto ${status === "pending" ? "hidden" : ""}`}>
        <table className="w-full">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className={th}>Time</th>
              {allUsers && <th className={th}>User</th>}
              <th className={th}>Event properties</th>
              <th className={th}>Session properties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 align-top">
            {sorted.slice(0, ROW_LIMIT).map((r, i) => (
              <tr key={i}>
                <td className={`${td} whitespace-nowrap`}>{fmtCtTs(r.ts)}</td>
                {allUsers && <td className={`${td} break-all text-xs`}>{userLabel(r)}</td>}
                <td className={td}><PropList data={r.event_props} /></td>
                <td className={td}><PropList data={r.session_props} /></td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td className={`${td} text-gray-500`} colSpan={allUsers ? 4 : 3}>
                  {status === "error"
                    ? "No matches were found before the error."
                    : progress?.done
                      ? allUsers
                        ? "No events in this date range."
                        : "No matching events for that user in this date range."
                      : "No matches yet…"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

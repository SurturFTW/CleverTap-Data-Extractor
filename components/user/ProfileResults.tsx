"use client";

import { useMemo, useState } from "react";
import type { ProfileRecord } from "@/lib/clevertap/types";
import { fmtEpoch, fmtNumber, fmtValue } from "@/lib/utils/format";
import {
  CopyTextButton,
  DownloadTextButton,
  inputClass,
  td,
  th,
} from "@/components/shared/ui";

const card = "rounded-xl border border-gray-200 bg-white shadow-md";

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
        <h3 className="text-base font-semibold text-black">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function ProfileResults({ record }: { record: ProfileRecord | null }) {
  const [filter, setFilter] = useState("");
  const json = useMemo(() => JSON.stringify(record, null, 2), [record]);

  const props = useMemo(
    () =>
      Object.entries(record?.profileData ?? {}).filter(([k, v]) =>
        `${k} ${fmtValue(v)}`.toLowerCase().includes(filter.toLowerCase()),
      ),
    [record, filter],
  );
  const events = useMemo(
    () => Object.entries(record?.events ?? {}).sort((a, b) => b[1].count - a[1].count),
    [record],
  );

  if (!record) {
    return (
      <div className={`${card} p-8 text-center text-gray-600`}>
        No profile found for that identifier.
      </div>
    );
  }

  const platforms = record.platformInfo ?? [];
  const platformCols = Array.from(new Set(platforms.flatMap((p) => Object.keys(p))));

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Profile"
        right={
          <div className="flex gap-2">
            <CopyTextButton text={json} />
            <DownloadTextButton text={json} filename="profile.json" />
          </div>
        }
      >
        <dl className="grid gap-4 p-5 text-sm sm:grid-cols-3">
          {[
            ["Identity", record.identity],
            ["Email", record.email],
            ["Events tracked", fmtNumber(events.length)],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-gray-500">{k}</dt>
              <dd className="mt-1 break-all font-medium text-black">{(v as string) || "–"}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {platforms.length > 0 && (
        <Section title={`Devices (${platforms.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {platformCols.map((c) => (
                    <th key={c} className={`${th} whitespace-nowrap`}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {platforms.map((p, i) => (
                  <tr key={i}>
                    {platformCols.map((c) => (
                      <td key={c} className={`${td} max-w-[16rem] break-all`}>
                        {p[c] == null ? "–" : fmtValue(p[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section
        title={`Profile properties (${Object.keys(record.profileData ?? {}).length})`}
        right={
          <input
            className={`${inputClass} !w-56 !py-1.5 !text-sm`}
            placeholder="Filter properties…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        }
      >
        <div className="max-h-96 overflow-auto">
          <table className="w-full">
            <tbody className="divide-y divide-gray-200">
              {props.map(([k, v]) => (
                <tr key={k}>
                  <td className={`${td} w-1/3 break-all font-medium text-black`}>{k}</td>
                  <td className={`${td} break-all font-mono text-xs`}>{fmtValue(v)}</td>
                </tr>
              ))}
              {props.length === 0 && (
                <tr>
                  <td className={`${td} text-gray-500`}>No properties.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={`Events (${events.length})`}>
        <div className="max-h-96 overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className={th}>Event</th>
                <th className={th}>Count</th>
                <th className={th}>First seen</th>
                <th className={th}>Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {events.map(([name, e]) => (
                <tr key={name}>
                  <td className={`${td} font-medium text-black`}>{name}</td>
                  <td className={td}>{fmtNumber(e.count)}</td>
                  <td className={`${td} whitespace-nowrap`}>{fmtEpoch(e.first_seen)}</td>
                  <td className={`${td} whitespace-nowrap`}>{fmtEpoch(e.last_seen)}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td className={`${td} text-gray-500`} colSpan={4}>No events.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

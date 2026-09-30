"use client";

import { useState } from "react";
import { AlertCircle, Check, Copy, Download } from "lucide-react";
import { REGIONS, type Region } from "@/lib/clevertap/types";
import { fmtNumber } from "@/lib/utils/format";

export type Cell =
  | { state: "loading" }
  | { state: "done"; value: number }
  | { state: "error"; message: string };

export const inputClass =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-base text-gray-900 outline-none focus:ring-1 focus:ring-black focus:border-black";

export function Label({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
      {label}
      {children}
    </label>
  );
}

export function RegionSelect({
  value,
  onChange,
}: {
  value: Region;
  onChange: (r: Region) => void;
}) {
  return (
    <select
      className={inputClass}
      value={value}
      onChange={(e) => onChange(e.target.value as Region)}
    >
      {REGIONS.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}

export function PrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  return (
    <button
      type="button"
      {...props}
      className="flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-2.5 text-base font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
    />
  );
}

export function SecondaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  return (
    <button
      type="button"
      {...props}
      className="flex items-center justify-center gap-2 rounded-xl border-2 border-black px-5 py-2.5 text-base font-medium text-black transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

export function NumCell({ cell }: { cell?: Cell }) {
  if (!cell) return <span className="text-gray-400">–</span>;
  if (cell.state === "loading")
    return <span className="animate-pulse text-gray-400">…</span>;
  if (cell.state === "error")
    return (
      <span className="text-red-600" title={cell.message}>
        error
      </span>
    );
  return <>{fmtNumber(cell.value)}</>;
}

export function CopyTsvButton({ rows }: { rows: (string | number)[][] }) {
  const [copied, setCopied] = useState(false);
  return (
    <SecondaryButton
      onClick={async () => {
        await navigator.clipboard.writeText(
          rows.map((r) => r.join("\t")).join("\n"),
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={18} /> : <Copy size={18} />}
      {copied ? "Copied!" : "Copy for Sheets"}
    </SecondaryButton>
  );
}

export function CopyTextButton({ text, label = "Copy JSON" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <SecondaryButton
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={18} /> : <Copy size={18} />}
      {copied ? "Copied!" : label}
    </SecondaryButton>
  );
}

export function DownloadTextButton({
  text,
  filename,
  label = "Download JSON",
}: {
  text: string;
  filename: string;
  label?: string;
}) {
  return (
    <SecondaryButton
      onClick={() => {
        const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download size={18} />
      {label}
    </SecondaryButton>
  );
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertCircle size={18} className="shrink-0" />
      {children}
    </p>
  );
}

export const th =
  "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500";
export const td = "px-3 py-2 text-sm tabular-nums";

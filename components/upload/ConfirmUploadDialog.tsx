"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Upload } from "lucide-react";
import { PrimaryButton, SecondaryButton, inputClass } from "@/components/shared/ui";

export type UploadTarget = {
  /** Saved name for the account; may be empty */
  name: string;
  accountId: string;
  region: string;
  count: number;
  /** "profile" | "event" */
  noun: string;
  /** Short description of what is being sent, e.g. event names */
  detail?: string;
};

/**
 * Last line of defence before writing to a customer's CleverTap account:
 * shows exactly which account will receive the data and requires typing its
 * Account ID. Pasting works, but you still have to look at the ID.
 */
export default function ConfirmUploadDialog({
  target,
  busy,
  onConfirm,
  onCancel,
}: {
  target: UploadTarget;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = typed.trim() === target.accountId.trim();
  const plural = target.count === 1 ? "" : "s";

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-upload-title"
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
      >
        <h2
          id="confirm-upload-title"
          className="flex items-center gap-2 text-lg font-bold text-black"
        >
          <AlertTriangle className="text-amber-600" size={22} />
          Upload to a live CleverTap account?
        </h2>

        <p className="mt-3 text-sm text-gray-700">
          You&apos;re about to write{" "}
          <span className="font-semibold">
            {target.count} {target.noun}
            {plural}
          </span>
          {target.detail ? ` (${target.detail})` : ""} to:
        </p>

        <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 rounded-lg border-2 border-black bg-gray-50 p-4 text-sm">
          <dt className="text-gray-500">Name</dt>
          <dd className="font-semibold text-black">
            {target.name.trim() || <span className="font-normal text-gray-500">(no name saved)</span>}
          </dd>
          <dt className="text-gray-500">Account ID</dt>
          <dd className="break-all font-mono font-semibold text-black">{target.accountId}</dd>
          <dt className="text-gray-500">Region</dt>
          <dd className="font-semibold text-black">{target.region}</dd>
        </dl>

        <p className="mt-3 text-sm text-gray-600">
          This changes the customer&apos;s data and can&apos;t be undone from here. Check it&apos;s
          the right account, or use <span className="font-medium">Validate (dry run)</span> first.
        </p>

        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (matches && !busy) onConfirm();
          }}
        >
          <label className="text-sm font-medium text-gray-700" htmlFor="confirm-account-id">
            Type the Account ID{" "}
            <span className="font-mono font-semibold text-black">{target.accountId}</span> to confirm
          </label>
          <input
            id="confirm-account-id"
            ref={inputRef}
            className={`${inputClass} mt-2 font-mono`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={typed.length > 0 && !matches}
          />

          <div className="mt-5 flex justify-end gap-3">
            <SecondaryButton onClick={onCancel} disabled={busy}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={!matches || busy}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              Upload {target.count} {target.noun}
              {plural}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}

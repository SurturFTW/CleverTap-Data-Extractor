"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Region } from "@/lib/clevertap/types";
import { blankAccount, useSavedAccounts } from "@/lib/utils/use-saved-accounts";
import { Label, RegionSelect, SecondaryButton, inputClass } from "./ui";

/** Saved-account picker + editable credentials, shared across report pages. */
export function useSelectedAccount() {
  const [accounts, setAccounts] = useSavedAccounts();
  const [selectedId, setSelectedId] = useState("");
  const current = accounts.find((a) => a.id === selectedId) ?? accounts[0];
  const patch = (p: Partial<typeof current>) =>
    setAccounts((prev) => prev.map((a) => (a.id === current.id ? { ...a, ...p } : a)));
  /** Deletes the selected saved account (never the last one, so the form always has an account to edit) */
  const remove = () => {
    if (accounts.length <= 1) return;
    setAccounts((prev) => prev.filter((a) => a.id !== current.id));
    setSelectedId("");
  };
  /** Adds an empty account and selects it so its details can be filled in */
  const add = () => {
    const a = blankAccount();
    setAccounts((prev) => [...prev, a]);
    setSelectedId(a.id);
  };
  return { accounts, current, setSelectedId, patch, remove, add };
}

export default function AccountFields({
  accounts,
  current,
  setSelectedId,
  patch,
  remove,
  add,
}: ReturnType<typeof useSelectedAccount>) {
  // Deleting saved credentials can't be undone, so ask first (inline, no pop-up)
  const [confirming, setConfirming] = useState(false);
  const label = current.name.trim() || current.accountId.trim() || "this account";

  return (
    <>
      <div className="flex flex-col gap-2 sm:col-span-2">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Label label="Saved account">
                <select
                  className={inputClass}
                  value={current.id}
                  onChange={(e) => {
                    setSelectedId(e.target.value);
                    setConfirming(false);
                  }}
                >
                  {accounts.map((a, i) => (
                    <option key={a.id} value={a.id}>
                      {a.name || a.accountId || `Account ${i + 1}`}
                    </option>
                  ))}
                </select>
              </Label>
            </div>
            <SecondaryButton
              onClick={() => {
                add();
                setConfirming(false);
              }}
            >
              <Plus size={18} />
              Add account
            </SecondaryButton>
            {accounts.length > 1 && !confirming && (
              <SecondaryButton onClick={() => setConfirming(true)}>
                <Trash2 size={18} />
                Delete
              </SecondaryButton>
            )}
          </div>
          {confirming && accounts.length > 1 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <span>
                Delete <span className="font-semibold">{label}</span> from the saved list? Its
                passcode is removed from this browser.
              </span>
              <span className="ml-auto flex gap-2">
                <SecondaryButton onClick={() => setConfirming(false)}>Cancel</SecondaryButton>
                <SecondaryButton
                  onClick={() => {
                    remove();
                    setConfirming(false);
                  }}
                >
                  <Trash2 size={18} />
                  Yes, delete
                </SecondaryButton>
              </span>
            </div>
          )}
        </div>
      <Label label="Name (optional)">
        <input
          className={inputClass}
          value={current.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="e.g. customer or app name"
        />
      </Label>
      <Label label="Account ID">
        <input
          className={inputClass}
          value={current.accountId}
          onChange={(e) => patch({ accountId: e.target.value })}
          autoComplete="off"
        />
      </Label>
      <Label label="Passcode">
        <input
          className={inputClass}
          type="password"
          value={current.passcode}
          onChange={(e) => patch({ passcode: e.target.value })}
          autoComplete="off"
        />
      </Label>
      <Label label="Region">
        <RegionSelect value={current.region} onChange={(region: Region) => patch({ region })} />
      </Label>
    </>
  );
}

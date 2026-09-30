"use client";

import { useState } from "react";
import type { Region } from "@/lib/clevertap/types";
import { useSavedAccounts } from "@/lib/utils/use-saved-accounts";
import { Label, RegionSelect, inputClass } from "./ui";

/** Saved-account picker + editable credentials, shared across report pages. */
export function useSelectedAccount() {
  const [accounts, setAccounts] = useSavedAccounts();
  const [selectedId, setSelectedId] = useState("");
  const current = accounts.find((a) => a.id === selectedId) ?? accounts[0];
  const patch = (p: Partial<typeof current>) =>
    setAccounts((prev) => prev.map((a) => (a.id === current.id ? { ...a, ...p } : a)));
  return { accounts, current, setSelectedId, patch };
}

export default function AccountFields({
  accounts,
  current,
  setSelectedId,
  patch,
}: ReturnType<typeof useSelectedAccount>) {
  return (
    <>
      {accounts.length > 1 && (
        <div className="sm:col-span-2">
          <Label label="Saved account">
            <select
              className={inputClass}
              value={current.id}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {accounts.map((a, i) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.accountId || `Account ${i + 1}`}
                </option>
              ))}
            </select>
          </Label>
        </div>
      )}
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

"use client";

import type { Region } from "@/lib/clevertap/types";
import { usePersistentState } from "./use-persistent-state";

export type Account = {
  id: string;
  name: string;
  accountId: string;
  passcode: string;
  region: Region;
};

export const blankAccount = (): Account => ({
  id: Math.random().toString(36).slice(2),
  name: "",
  accountId: "",
  passcode: "",
  region: "in1",
});

/** CleverTap accounts saved in this browser, shared by every report page. */
export function useSavedAccounts() {
  return usePersistentState<Account[]>("ct.accounts", [blankAccount()]);
}

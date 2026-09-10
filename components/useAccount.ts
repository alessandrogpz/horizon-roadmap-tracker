"use client";

import { useEffect, useSyncExternalStore } from "react";
import { accountStore, type Account } from "@/lib/account";

/** The signed-in account: `undefined` while unknown, `null` when signed out.
 *  Asks the server the first time any component needs it, unless the caller
 *  fetches it itself (`autoRefresh: false`). */
export function useAccount(autoRefresh = true): Account | null | undefined {
  const account = useSyncExternalStore(accountStore.subscribe, accountStore.get, () => undefined);
  useEffect(() => {
    if (autoRefresh && accountStore.get() === undefined) void accountStore.refresh();
  }, [autoRefresh]);
  return account;
}

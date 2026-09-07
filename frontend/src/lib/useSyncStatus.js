import { useSyncExternalStore } from "react";
import { getSyncSnapshot, subscribeSync } from "./syncEngine";

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSync, getSyncSnapshot, getSyncSnapshot);
}

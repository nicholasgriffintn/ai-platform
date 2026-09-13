import { useSyncExternalStore } from "react";

/**
 * Server-rendered markup cannot see stored preferences, so surfaces that read them wait for the
 * first client render before showing the resolved value.
 */
function subscribeToHydration(): () => void {
  return () => undefined;
}

function getHydratedSnapshot(): boolean {
  return true;
}

function getServerHydratedSnapshot(): boolean {
  return false;
}

export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribeToHydration, getHydratedSnapshot, getServerHydratedSnapshot);
}

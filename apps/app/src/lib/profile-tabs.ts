import { getCapabilityLibraryPath, PERSONAL_SURFACE } from "./capability-surfaces";

const RETIRED_PROFILE_TAB_PATHS = new Map<string, string>([
  ["agents", getCapabilityLibraryPath(PERSONAL_SURFACE)],
]);

export function getRetiredProfileTabPath(tabId: string): string | undefined {
  return RETIRED_PROFILE_TAB_PATHS.get(tabId);
}

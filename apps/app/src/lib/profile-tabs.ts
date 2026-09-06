import { getCapabilityLibraryPath, PERSONAL_SURFACE } from "./capability-surfaces";
import { getPersonalFilesPath } from "./files-route";
import { PLACE_PATHS } from "./navigation/places";

const RETIRED_PROFILE_TAB_PATHS = new Map<string, string>([
  ["agents", getCapabilityLibraryPath(PERSONAL_SURFACE)],
  ["sources", getPersonalFilesPath("given")],
  ["tasks", PLACE_PATHS.attention],
]);

export function getRetiredProfileTabPath(tabId: string): string | undefined {
  return RETIRED_PROFILE_TAB_PATHS.get(tabId);
}

import { getCapabilityLibraryPath, PERSONAL_SURFACE } from "./capability-surfaces.js";
import { getPersonalFilesPath } from "./files-route.js";
import { getPlacePaths } from "./navigation/places.js";

const RETIRED_PROFILE_TAB_PATHS = new Map<string, string>([
  ["agents", getCapabilityLibraryPath(PERSONAL_SURFACE)],
  ["sources", getPersonalFilesPath("given")],
  ["tasks", getPlacePaths("chat").attention],
]);

export function getRetiredProfileTabPath(tabId: string): string | undefined {
  return RETIRED_PROFILE_TAB_PATHS.get(tabId);
}

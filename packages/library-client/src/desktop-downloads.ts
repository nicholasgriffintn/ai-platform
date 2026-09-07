import type { DesktopDownloads } from "@ngriffin_uk/polychat-schemas";

import { fetchApi } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export async function getDesktopDownloads(): Promise<DesktopDownloads | null> {
  const response = await fetchApi("/desktop/downloads", { method: "GET" });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("The desktop downloads could not be loaded.");
  }

  return returnFetchedData<DesktopDownloads>(response);
}

import type { FlagBootstrapResponse } from "@ngriffin_uk/polychat-schemas";

import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export async function getFlagBootstrap(): Promise<FlagBootstrapResponse> {
  return returnFetchedData(await fetchApiOrThrow("/flags/bootstrap", { method: "GET" }));
}

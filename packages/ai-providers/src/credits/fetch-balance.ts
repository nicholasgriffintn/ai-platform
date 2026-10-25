import { isProviderAccessDeniedError } from "@ngriffin_uk/polychat-utility-server/provider-errors";

import { fetchProviderJson, type FetchProviderJsonOptions } from "../fetch.js";

export async function fetchBalanceJson(
  provider: string,
  url: string,
  options: Pick<FetchProviderJsonOptions, "apiKey" | "headers">,
): Promise<unknown> {
  try {
    return await fetchProviderJson<unknown>(provider, url, { ...options, method: "GET" });
  } catch (error) {
    if (isProviderAccessDeniedError(error)) {
      return null;
    }

    throw error;
  }
}

import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import type { UsageBalanceResponse } from "@ngriffin_uk/polychat-schemas";

import { fetchApiOrThrow } from "./fetch-wrapper";

export async function getUsageBalance(): Promise<UsageBalanceResponse> {
  const response = await fetchApiOrThrow("/user/usage/balance", { method: "GET" });

  return returnFetchedData<UsageBalanceResponse>(response);
}

import {
  siteRecordOperationResponseSchema,
  type SiteRecordOperation,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export async function executeSiteRecordOperation(siteId: string, operation: SiteRecordOperation) {
  const response = await fetchApiOrThrow(`/sites/${encodeURIComponent(siteId)}/record-operations`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: operation,
  });

  return siteRecordOperationResponseSchema.parse(await returnFetchedData<unknown>(response));
}

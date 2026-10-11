import type { Correction, CorrectionListResponse } from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

const BASE_PATH = "/memory/corrections";

export async function listCorrections(): Promise<Correction[]> {
  const response = await fetchApiOrThrow(BASE_PATH, {
    method: "GET",
    headers: await apiService.getHeaders(),
  });

  return (await returnFetchedData<CorrectionListResponse>(response)).corrections;
}

export async function dismissCorrection(correctionId: string): Promise<void> {
  await fetchApiOrThrow(`${BASE_PATH}/${encodeURIComponent(correctionId)}`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
  });
}

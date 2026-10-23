import type { ExtractionRequest, ExtractionResponse } from "@ngriffin_uk/polychat-schemas";

import { fetchApiData } from "./fetch-wrapper.js";

const IMAGE_EXTRACTION_TIMEOUT_MS = 60_000;

export const extractionsService = {
  extract(request: ExtractionRequest): Promise<ExtractionResponse> {
    return fetchApiData<ExtractionResponse>("/extractions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: request,
      timeoutMs: IMAGE_EXTRACTION_TIMEOUT_MS,
    });
  },
};

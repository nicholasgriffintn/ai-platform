import type { PolyHome } from "@ngriffin_uk/polychat-schemas";

import { fetchApi } from "../fetch-wrapper.js";
import { createApiErrorFromResponse, returnFetchedData } from "../http.js";

export class PolyService {
  constructor(private getHeaders: () => Promise<Record<string, string>>) {}

  async openPolyHome(): Promise<PolyHome> {
    const response = await fetchApi("/poly/home", {
      method: "GET",
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(response, "Failed to open Poly");
    }

    return returnFetchedData<PolyHome>(response);
  }
}

import type { PolyAgenda, PolyHome } from "@ngriffin_uk/polychat-schemas";

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

  async readPolyAgenda(): Promise<PolyAgenda> {
    const response = await fetchApi("/poly/agenda", {
      method: "GET",
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(response, "Failed to load what Poly is doing");
    }

    return returnFetchedData<PolyAgenda>(response);
  }

  async grantPolyStandingApproval(interactionId: string): Promise<PolyHome> {
    const response = await fetchApi("/poly/standing-approvals", {
      method: "POST",
      headers: await this.getHeaders(),
      body: { interaction_id: interactionId },
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(response, "Poly could not keep that approval");
    }

    return returnFetchedData<PolyHome>(response);
  }

  async revokePolyStandingApproval(toolName: string, destination: string): Promise<PolyHome> {
    const response = await fetchApi("/poly/standing-approvals", {
      method: "DELETE",
      headers: await this.getHeaders(),
      body: { tool_name: toolName, destination },
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(response, "Poly could not forget that approval");
    }

    return returnFetchedData<PolyHome>(response);
  }
}

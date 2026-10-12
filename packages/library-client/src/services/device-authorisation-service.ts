import type {
  DeviceAuthorisation,
  DeviceAuthorisationDecision,
} from "@ngriffin_uk/polychat-schemas";

import { fetchApi } from "../fetch-wrapper.js";
import { createApiErrorFromResponse, returnFetchedData } from "../http.js";

export class DeviceAuthorisationService {
  constructor(private getHeaders: () => Promise<Record<string, string>>) {}

  async getDeviceAuthorisation(userCode: string): Promise<DeviceAuthorisation> {
    const response = await fetchApi(`/auth/device/${encodeURIComponent(userCode)}`, {
      method: "GET",
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(response, "That code could not be checked");
    }

    return returnFetchedData<DeviceAuthorisation>(response);
  }

  async decideDeviceAuthorisation(
    userCode: string,
    decision: DeviceAuthorisationDecision["decision"],
  ): Promise<{ status: "approved" | "denied" }> {
    const response = await fetchApi(`/auth/device/${encodeURIComponent(userCode)}/decision`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: { decision },
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(response, "That decision was not recorded");
    }

    return returnFetchedData<{ status: "approved" | "denied" }>(response);
  }
}

import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import type {
  CapabilityCatalogResponse,
  PublicCapabilityCatalogueResponse,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApi } from "./fetch-wrapper";

export const fetchCapabilityCatalog = async (
  projectId?: string,
): Promise<CapabilityCatalogResponse> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error reading capability catalogue headers:", error);
  }

  const path = projectId
    ? `/capabilities?projectId=${encodeURIComponent(projectId)}`
    : "/capabilities";
  const response = await fetchApi(path, { method: "GET", headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch capability catalogue: ${response.statusText}`);
  }

  return returnFetchedData<CapabilityCatalogResponse>(response);
};

export const fetchPublicCapabilityCatalogue =
  async (): Promise<PublicCapabilityCatalogueResponse> => {
    const response = await fetchApi("/capabilities/catalogue", { method: "GET" });

    if (!response.ok) {
      throw new Error(`Failed to fetch the capability catalogue: ${response.statusText}`);
    }

    return returnFetchedData<PublicCapabilityCatalogueResponse>(response);
  };

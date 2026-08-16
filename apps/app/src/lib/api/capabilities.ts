import type { CapabilityCatalogResponse } from "@ngriffin_uk/polychat-schemas";

import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import { apiService } from "./api-service";
import { fetchApi } from "./fetch-wrapper";

export const fetchCapabilityCatalog = async (): Promise<CapabilityCatalogResponse> => {
	let headers = {};
	try {
		headers = await apiService.getHeaders();
	} catch (error) {
		console.error("Error reading capability catalogue headers:", error);
	}

	const response = await fetchApi("/capabilities", { method: "GET", headers });

	if (!response.ok) {
		throw new Error(`Failed to fetch capability catalogue: ${response.statusText}`);
	}

	return returnFetchedData<CapabilityCatalogResponse>(response);
};

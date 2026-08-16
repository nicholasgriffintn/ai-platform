import type { GlobalSearchResponse } from "@ngriffin_uk/polychat-schemas";
import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";

import { apiService } from "./api-service";
import { fetchApiOrThrow } from "./fetch-wrapper";

export async function searchPolychat(query: string, limit = 8): Promise<GlobalSearchResponse> {
	const searchParams = new URLSearchParams({ query, limit: String(limit) });
	const response = await fetchApiOrThrow(`/search?${searchParams.toString()}`, {
		method: "GET",
		headers: await apiService.getHeaders(),
	});
	return returnFetchedData(response);
}

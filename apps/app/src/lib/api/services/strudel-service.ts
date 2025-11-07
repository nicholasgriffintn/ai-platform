import { fetchApi, returnFetchedData } from "../fetch-wrapper";
import type {
	GenerateStrudelRequest,
	GenerateStrudelResponse,
	SaveStrudelPatternInput,
	StrudelPattern,
	UpdateStrudelPatternInput,
} from "~/types";

const STRUDEL_BASE_PATH = "/apps/strudel";

async function parseResponse<T>(
	response: Response,
	errorMessage: string,
): Promise<T> {
	if (!response.ok) {
		throw new Error(
			`${errorMessage}: ${response.status} ${response.statusText}`,
		);
	}
	return returnFetchedData<T>(response);
}

export const strudelService = {
	async list(): Promise<StrudelPattern[]> {
		const response = await fetchApi(STRUDEL_BASE_PATH, {
			method: "GET",
		});
		const payload = await parseResponse<{ patterns: StrudelPattern[] }>(
			response,
			"Failed to fetch Strudel patterns",
		);
		return payload.patterns;
	},

	async get(id: string): Promise<StrudelPattern> {
		const response = await fetchApi(`${STRUDEL_BASE_PATH}/${id}`, {
			method: "GET",
		});
		const payload = await parseResponse<{ pattern: StrudelPattern }>(
			response,
			`Failed to fetch Strudel pattern ${id}`,
		);
		return payload.pattern;
	},

	async generate(
		request: GenerateStrudelRequest,
	): Promise<GenerateStrudelResponse> {
		const response = await fetchApi(`${STRUDEL_BASE_PATH}/generate`, {
			method: "POST",
			body: request,
		});
		return parseResponse<GenerateStrudelResponse>(
			response,
			"Failed to generate Strudel pattern",
		);
	},

	async save(request: SaveStrudelPatternInput): Promise<StrudelPattern> {
		const response = await fetchApi(STRUDEL_BASE_PATH, {
			method: "POST",
			body: request,
		});
		const payload = await parseResponse<{ pattern: StrudelPattern }>(
			response,
			"Failed to save Strudel pattern",
		);
		return payload.pattern;
	},

	async update(
		id: string,
		request: UpdateStrudelPatternInput,
	): Promise<StrudelPattern> {
		const response = await fetchApi(`${STRUDEL_BASE_PATH}/${id}`, {
			method: "PUT",
			body: request,
		});
		const payload = await parseResponse<{ pattern: StrudelPattern }>(
			response,
			`Failed to update Strudel pattern ${id}`,
		);
		return payload.pattern;
	},

	async delete(id: string): Promise<void> {
		const response = await fetchApi(`${STRUDEL_BASE_PATH}/${id}`, {
			method: "DELETE",
		});

		if (!response.ok) {
			throw new Error(
				`Failed to delete Strudel pattern ${id}: ${response.status} ${response.statusText}`,
			);
		}
	},
};

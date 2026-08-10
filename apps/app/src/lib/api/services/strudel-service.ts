import { fetchApi, returnFetchedData } from "../fetch-wrapper";
import { withProjectScope } from "../project-scope";
import type {
	GenerateStrudelRequest,
	GenerateStrudelResponse,
	SaveStrudelPatternInput,
	StrudelPattern,
	UpdateStrudelPatternInput,
} from "~/types";

const STRUDEL_BASE_PATH = "/apps/strudel";

async function parseResponse<T>(response: Response, errorMessage: string): Promise<T> {
	if (!response.ok) {
		throw new Error(`${errorMessage}: ${response.status} ${response.statusText}`);
	}
	return returnFetchedData<T>(response);
}

export const strudelService = {
	async list(projectId?: string): Promise<StrudelPattern[]> {
		const response = await fetchApi(withProjectScope(STRUDEL_BASE_PATH, projectId), {
			method: "GET",
		});
		const payload = await parseResponse<{ patterns: StrudelPattern[] }>(
			response,
			"Failed to fetch Strudel patterns",
		);
		return payload.patterns;
	},

	async get(id: string, projectId?: string): Promise<StrudelPattern> {
		const response = await fetchApi(withProjectScope(`${STRUDEL_BASE_PATH}/${id}`, projectId), {
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
		projectId?: string,
	): Promise<GenerateStrudelResponse> {
		const response = await fetchApi(withProjectScope(`${STRUDEL_BASE_PATH}/generate`, projectId), {
			method: "POST",
			body: request,
		});
		return parseResponse<GenerateStrudelResponse>(response, "Failed to generate Strudel pattern");
	},

	async save(request: SaveStrudelPatternInput, projectId?: string): Promise<StrudelPattern> {
		const response = await fetchApi(withProjectScope(STRUDEL_BASE_PATH, projectId), {
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
		projectId?: string,
	): Promise<StrudelPattern> {
		const response = await fetchApi(withProjectScope(`${STRUDEL_BASE_PATH}/${id}`, projectId), {
			method: "PUT",
			body: request,
		});
		const payload = await parseResponse<{ pattern: StrudelPattern }>(
			response,
			`Failed to update Strudel pattern ${id}`,
		);
		return payload.pattern;
	},

	async delete(id: string, projectId?: string): Promise<void> {
		const response = await fetchApi(withProjectScope(`${STRUDEL_BASE_PATH}/${id}`, projectId), {
			method: "DELETE",
		});

		if (!response.ok) {
			throw new Error(
				`Failed to delete Strudel pattern ${id}: ${response.status} ${response.statusText}`,
			);
		}
	},
};

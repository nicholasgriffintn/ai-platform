import { apiService } from "./api-service";
import { fetchApi, returnFetchedData } from "./fetch-wrapper";
import type {
	CanvasGeneration,
	CanvasGenerateRequest,
	CanvasGenerateResponse,
	CanvasMode,
	CanvasModel,
} from "~/types/canvas";

export async function fetchCanvasModels(
	mode: CanvasMode,
): Promise<CanvasModel[]> {
	let headers = {};
	try {
		headers = await apiService.getHeaders();
	} catch (error) {
		console.error("Error getting headers for canvas models:", error);
	}

	const response = await fetchApi(`/apps/canvas/models?mode=${mode}`, {
		method: "GET",
		headers,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch Canvas models: ${response.statusText}`);
	}

	const data = await returnFetchedData<{ models: CanvasModel[] }>(response);
	return data.models || [];
}

export async function generateCanvasOutputs(
	request: CanvasGenerateRequest,
): Promise<CanvasGenerateResponse> {
	const headers = await apiService.getHeaders();

	const response = await fetchApi("/apps/canvas/generate", {
		method: "POST",
		headers: {
			...headers,
			"Content-Type": "application/json",
		},
		body: request,
	});

	if (!response.ok) {
		const errorData = await returnFetchedData<{ error?: string }>(response);
		throw new Error(
			errorData?.error ||
				`Failed to generate Canvas outputs: ${response.statusText}`,
		);
	}

	return await returnFetchedData<CanvasGenerateResponse>(response);
}

export async function fetchCanvasGenerations(
	mode?: CanvasMode,
): Promise<CanvasGeneration[]> {
	let headers = {};
	try {
		headers = await apiService.getHeaders();
	} catch (error) {
		console.error("Error getting headers for canvas generations:", error);
	}

	const query = mode ? `?mode=${mode}` : "";
	const response = await fetchApi(`/apps/canvas/generations${query}`, {
		method: "GET",
		headers,
	});

	if (!response.ok) {
		throw new Error(
			`Failed to fetch Canvas generations: ${response.statusText}`,
		);
	}

	const data = await returnFetchedData<{ generations: CanvasGeneration[] }>(
		response,
	);
	return data.generations || [];
}

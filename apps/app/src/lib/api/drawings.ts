import type {
	Drawing,
	DrawingResponse,
	DrawingsResponse,
	GenerateImageResponse,
	GuessResponse,
} from "~/types/drawing";
import { apiService } from "./api-service";
import { fetchApi, returnFetchedData } from "./fetch-wrapper";

export const fetchDrawings = async (): Promise<Drawing[]> => {
	let headers = {};
	try {
		headers = await apiService.getHeaders();
	} catch (error) {
		console.error("Error fetching drawings:", error);
	}

	const response = await fetchApi("/apps/drawing", {
		method: "GET",
		headers,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch drawings: ${response.statusText}`);
	}

	const data = await returnFetchedData<DrawingsResponse>(response);
	return data.drawings || [];
};

export const fetchDrawing = async (id: string): Promise<Drawing> => {
	let headers = {};
	try {
		headers = await apiService.getHeaders();
	} catch (error) {
		console.error("Error fetching drawing:", error);
	}

	const response = await fetchApi(`/apps/drawing/${id}`, {
		method: "GET",
		headers,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch drawing: ${response.statusText}`);
	}

	const data = await returnFetchedData<DrawingResponse>(response);
	return data.drawing;
};

export const generateImageFromDrawing = async ({
	drawing,
	drawingId,
}: {
	drawing: File;
	drawingId?: string;
}): Promise<GenerateImageResponse> => {
	const formData = new FormData();
	formData.append("drawing", drawing);

	if (drawingId) {
		formData.append("drawingId", drawingId);
	}

	let headers = {};
	try {
		headers = await apiService.getHeaders();
	} catch (error) {
		console.error("Error generating image from drawing:", error);
	}

	const filteredHeaders = { ...headers };

	const response = await fetchApi("/apps/drawing", {
		method: "POST",
		body: formData,
		headers: filteredHeaders,
	});

	if (!response.ok) {
		throw new Error(`Failed to generate image: ${response.statusText}`);
	}

	const data = await returnFetchedData<GenerateImageResponse>(response);
	return data;
};

export const guessDrawingFromImage = async ({
	drawing,
}: {
	drawing: File;
}): Promise<GuessResponse> => {
	const formData = new FormData();
	formData.append("drawing", drawing);

	let headers = {};
	try {
		headers = await apiService.getHeaders();
	} catch (error) {
		console.error("Error guessing drawing from image:", error);
	}

	const filteredHeaders = { ...headers };

	const response = await fetchApi("/apps/drawing/guess", {
		method: "POST",
		body: formData,
		headers: filteredHeaders,
	});

	if (!response.ok) {
		throw new Error(`Failed to guess drawing: ${response.statusText}`);
	}

	return await returnFetchedData<GuessResponse>(response);
};

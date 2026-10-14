import type {
  Drawing,
  DrawingResponse,
  GenerateImageResponse,
  GuessResponse,
} from "@ngriffin_uk/polychat-schemas/experiences";

import { apiService } from "./api-service.js";
import { fetchApi } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";
import { withProjectScope } from "./project-scope.js";
import { resource } from "./resource.js";

export const fetchDrawings = (projectId?: string): Promise<Drawing[]> =>
  resource<Drawing>("/experiences/drawings").listAll({ project_id: projectId });

export const fetchDrawing = async (id: string, projectId?: string): Promise<Drawing> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error fetching drawing:", error);
  }

  const response = await fetchApi(
    withProjectScope(`/experiences/drawings/${encodeURIComponent(id)}`, projectId),
    {
      method: "GET",
      headers,
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch drawing: ${response.statusText}`);
  }

  const data = await returnFetchedData<DrawingResponse>(response);

  return data.drawing;
};

export const generateImageFromDrawing = async ({
  drawing,
  projectId,
  drawingId,
}: {
  drawing: File;
  projectId?: string;
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

  const response = await fetchApi(withProjectScope("/experiences/drawings", projectId), {
    method: "POST",
    body: formData,
    headers: filteredHeaders,
  });

  if (!response.ok) {
    throw new Error(`Failed to generate image: ${response.statusText}`);
  }

  return response.json() as Promise<GenerateImageResponse>;
};

export const guessDrawingFromImage = async ({
  drawing,
  projectId,
}: {
  drawing: File;
  projectId?: string;
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

  const response = await fetchApi(withProjectScope("/experiences/drawings/guess", projectId), {
    method: "POST",
    body: formData,
    headers: filteredHeaders,
  });

  if (!response.ok) {
    throw new Error(`Failed to guess drawing: ${response.statusText}`);
  }

  return await returnFetchedData<GuessResponse>(response);
};

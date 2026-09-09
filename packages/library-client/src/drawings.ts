import type {
  Drawing,
  DrawingResponse,
  DrawingsResponse,
  GenerateImageResponse,
  GuessResponse,
} from "@ngriffin_uk/polychat-schemas/experiences";

import { apiService } from "./api-service.js";
import { fetchApi } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export const fetchDrawings = async (projectId?: string): Promise<Drawing[]> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error fetching drawings:", error);
  }

  const response = await fetchApi(
    `/apps/drawing${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
    {
      method: "GET",
      headers,
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch drawings: ${response.statusText}`);
  }

  const data = await returnFetchedData<DrawingsResponse>(response);

  return data.drawings || [];
};

export const fetchDrawing = async (id: string, projectId?: string): Promise<Drawing> => {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error fetching drawing:", error);
  }

  const response = await fetchApi(
    `/apps/drawing/${id}${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
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

  const response = await fetchApi(
    `/apps/drawing${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
    {
      method: "POST",
      body: formData,
      headers: filteredHeaders,
    },
  );

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

  const response = await fetchApi(
    `/apps/drawing/guess${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
    {
      method: "POST",
      body: formData,
      headers: filteredHeaders,
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to guess drawing: ${response.statusText}`);
  }

  return await returnFetchedData<GuessResponse>(response);
};

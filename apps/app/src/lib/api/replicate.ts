import type {
  ReplicateModel,
  ReplicatePrediction,
  ExecuteReplicateRequest,
} from "~/types/replicate";
import { apiService } from "./api-service";
import { fetchApi } from "./fetch-wrapper";

export const fetchReplicateModels = async (): Promise<ReplicateModel[]> => {
  try {
    let headers = {};
    try {
      headers = await apiService.getHeaders();
    } catch (error) {
      console.error("Error getting headers:", error);
    }

    const response = await fetchApi("/apps/replicate/models", {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Replicate models: ${response.statusText}`,
      );
    }

    const data: any = await response.json();
    return data.models || [];
  } catch (error) {
    console.error("Error fetching Replicate models:", error);
    throw error;
  }
};

export const executeReplicateModel = async (
  request: ExecuteReplicateRequest,
): Promise<ReplicatePrediction> => {
  try {
    const headers = await apiService.getHeaders();

    const response = await fetchApi("/apps/replicate/execute", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({}));
      throw new Error(
        errorData?.error ||
          `Failed to execute Replicate model: ${response.statusText}`,
      );
    }

    const data: any = await response.json();
    return data.response.data;
  } catch (error) {
    console.error("Error executing Replicate model:", error);
    throw error;
  }
};

export const fetchReplicatePredictions = async (): Promise<
  ReplicatePrediction[]
> => {
  try {
    let headers = {};
    try {
      headers = await apiService.getHeaders();
    } catch (error) {
      console.error("Error getting headers:", error);
    }

    const response = await fetchApi("/apps/replicate/predictions", {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch predictions: ${response.statusText}`);
    }

    const data: any = await response.json();
    return data.predictions || [];
  } catch (error) {
    console.error("Error fetching predictions:", error);
    throw error;
  }
};

export const fetchReplicatePrediction = async (
  predictionId: string,
): Promise<ReplicatePrediction> => {
  try {
    let headers = {};
    try {
      headers = await apiService.getHeaders();
    } catch (error) {
      console.error("Error getting headers:", error);
    }

    const response = await fetchApi(
      `/apps/replicate/predictions/${predictionId}`,
      {
        method: "GET",
        headers,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch prediction: ${response.statusText}`);
    }

    const data: any = await response.json();
    return data.prediction;
  } catch (error) {
    console.error(`Error fetching prediction ${predictionId}:`, error);
    throw error;
  }
};

import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import { withProjectScope } from "@ngriffin_uk/polychat-library-client/project-scope";
import type { RunnableTool, RunnableToolResponse } from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApi } from "./fetch-wrapper";

const readHeaders = async (): Promise<Record<string, string>> => {
  try {
    return await apiService.getHeaders();
  } catch {
    return {};
  }
};

export const fetchRunnableTool = async (id: string): Promise<RunnableTool> => {
  const response = await fetchApi(`/tools/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: await readHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to load tool: ${response.statusText}`);
  }

  return returnFetchedData<RunnableTool>(response);
};

export const executeRunnableTool = async (
  id: string,
  formData: Record<string, any>,
  projectId?: string,
): Promise<RunnableToolResponse> => {
  const response = await fetchApi(
    withProjectScope(`/tools/${encodeURIComponent(id)}/execute`, projectId),
    {
      method: "POST",
      body: formData,
      headers: await readHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to run tool: ${response.statusText}`);
  }

  return (await response.json()) as RunnableToolResponse;
};

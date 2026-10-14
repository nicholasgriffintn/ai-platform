import {
  environmentSchema,
  type BrowserSession,
  type SubmitBrowserApproval,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { environmentPath } from "./environments.js";
import { fetchApi } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export async function fetchBrowserSession(id: string): Promise<BrowserSession> {
  const response = await fetchApi(`${environmentPath(id)}?kind=browser`, {
    headers: await apiService.getHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "This browser session is no longer available."
        : "Browser state could not be refreshed.",
    );
  }

  const environment = environmentSchema.parse(await returnFetchedData<unknown>(response));

  if (environment.kind !== "browser") {
    throw new Error("This browser session is no longer available.");
  }

  return environment.detail;
}

export async function submitBrowserApproval(
  id: string,
  input: SubmitBrowserApproval,
): Promise<void> {
  const response = await fetchApi(`${environmentPath(id, "/actions")}?kind=browser`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: { action: "approve", request_id: input.requestId, response: input.response },
  });

  if (!response.ok) {
    throw new Error(
      "The response was not confirmed. Refresh the browser request before trying again.",
    );
  }
}

export async function stopBrowserSession(id: string): Promise<void> {
  const response = await fetchApi(`${environmentPath(id, "/actions")}?kind=browser`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: { action: "stop" },
  });

  if (!response.ok) {
    throw new Error("Browser cancellation could not be confirmed. Refresh its state.");
  }
}

export async function destroyBrowserSession(id: string): Promise<void> {
  const response = await fetchApi(`${environmentPath(id)}?kind=browser`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
  });

  if (!response.ok) {
    throw new Error("The browser could not be closed. Refresh its state before trying again.");
  }
}

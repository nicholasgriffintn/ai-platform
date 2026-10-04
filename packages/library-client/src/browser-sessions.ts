import {
  browserSessionSchema,
  type BrowserSession,
  type SubmitBrowserApproval,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApi } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export async function fetchBrowserSession(id: string): Promise<BrowserSession> {
  const response = await fetchApi(`/computer-use/sessions/${encodeURIComponent(id)}`, {
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

  return browserSessionSchema.parse(await returnFetchedData<unknown>(response));
}

export async function submitBrowserApproval(
  id: string,
  input: SubmitBrowserApproval,
): Promise<void> {
  const response = await fetchApi(`/computer-use/sessions/${encodeURIComponent(id)}/approvals`, {
    method: "POST",
    headers: { ...(await apiService.getHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(
      "The response was not confirmed. Refresh the browser request before trying again.",
    );
  }
}

export async function stopBrowserSession(id: string): Promise<void> {
  const response = await fetchApi(`/computer-use/sessions/${encodeURIComponent(id)}/stop`, {
    method: "POST",
    headers: await apiService.getHeaders(),
  });

  if (!response.ok) {
    throw new Error("Browser cancellation could not be confirmed. Refresh its state.");
  }
}

export async function destroyBrowserSession(id: string): Promise<void> {
  const response = await fetchApi(`/computer-use/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
  });

  if (!response.ok) {
    throw new Error("The browser could not be closed. Refresh its state before trying again.");
  }
}

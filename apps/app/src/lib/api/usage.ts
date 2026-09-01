import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import type {
  Plan,
  UsageBalanceResponse,
  UsageEventsResponse,
  UsageSummaryResponse,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApi, fetchApiOrThrow } from "./fetch-wrapper";

async function authHeaders() {
  return apiService.getHeaders();
}

export async function getUsageBalance(period?: string): Promise<UsageBalanceResponse> {
  const query = period ? `?period=${period}` : "";
  const response = await fetchApiOrThrow(`/user/usage/balance${query}`, {
    method: "GET",
    headers: await authHeaders(),
  });

  return returnFetchedData(response);
}

export async function getUsageSummary(period?: string): Promise<UsageSummaryResponse> {
  const query = period ? `?period=${period}` : "";
  const response = await fetchApiOrThrow(`/user/usage/summary${query}`, {
    method: "GET",
    headers: await authHeaders(),
  });

  return returnFetchedData(response);
}

export async function listUsageEvents(options: {
  period?: string;
  cursor?: string;
  limit?: number;
  source?: string;
}): Promise<UsageEventsResponse> {
  const params = new URLSearchParams();

  if (options.period) {
    params.set("period", options.period);
  }

  if (options.cursor) {
    params.set("cursor", options.cursor);
  }

  if (options.limit) {
    params.set("limit", String(options.limit));
  }

  if (options.source) {
    params.set("source", options.source);
  }

  const encoded = params.toString();
  const query = encoded ? `?${encoded}` : "";
  const response = await fetchApiOrThrow(`/user/usage/events${query}`, {
    method: "GET",
    headers: await authHeaders(),
  });

  return returnFetchedData(response);
}

export async function listPlans(): Promise<Plan[]> {
  const response = await fetchApiOrThrow("/plans", { method: "GET" });
  const payload = await returnFetchedData<{ data?: Plan[] } | Plan[]>(response);

  return Array.isArray(payload) ? payload : (payload.data ?? []);
}

export async function createBillingPortalSession(
  returnUrl: string,
): Promise<{ url: string } | null> {
  const response = await fetchApi("/stripe/portal", {
    method: "POST",
    headers: await authHeaders(),
    body: { return_url: returnUrl },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const data = await returnFetchedData<{ error?: string }>(response);

    throw new Error(data.error || "Failed to open the billing portal");
  }

  return returnFetchedData(response);
}

export async function setOverageEnabled(enabled: boolean): Promise<{ enabled: boolean } | null> {
  const response = await fetchApi("/stripe/overage", {
    method: "POST",
    headers: await authHeaders(),
    body: { enabled },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const data = await returnFetchedData<{ error?: string }>(response);

    throw new Error(data.error || "Failed to update overage");
  }

  const data = await returnFetchedData<{ overage_enabled?: boolean }>(response);

  return { enabled: data.overage_enabled ?? enabled };
}

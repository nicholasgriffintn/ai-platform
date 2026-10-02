import {
  createManagedAgentSessionSchema,
  managedAgentAcceptedSchema,
  managedAgentDeletedSchema,
  managedAgentItemsSchema,
  managedAgentListQuerySchema,
  managedAgentMessageSchema,
  managedAgentPageQuerySchema,
  managedAgentParamsSchema,
  managedAgentSessionResponseSchema,
  managedAgentSessionsResponseSchema,
  type CreateManagedAgentSession,
  type ManagedAgentPageQuery,
} from "@ngriffin_uk/polychat-schemas";
import { toQueryString } from "@ngriffin_uk/polychat-utility-core";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";
import { withProjectScope } from "./project-scope.js";

const BASE_PATH = "/apps/managed-agents/sessions";

export async function createBedrockManagedAgentSession(
  input: CreateManagedAgentSession,
  projectId?: string,
) {
  const body = createManagedAgentSessionSchema.parse(input);
  const response = await fetchApiOrThrow(withProjectScope(BASE_PATH, projectId), {
    method: "POST",
    headers: await apiService.getHeaders(),
    body,
    timeoutMs: 35_000,
  });

  return managedAgentSessionResponseSchema.parse(await returnFetchedData(response)).session;
}

export async function listBedrockManagedAgentSessions(
  input: { projectId?: string; limit?: number; offset?: number } = {},
) {
  const query = managedAgentListQuerySchema.parse(input);
  const search = toQueryString({ limit: query.limit, offset: query.offset });
  const response = await fetchApiOrThrow(
    withProjectScope(`${BASE_PATH}${search}`, query.projectId),
    {
      headers: await apiService.getHeaders(),
    },
  );

  return managedAgentSessionsResponseSchema.parse(await returnFetchedData(response)).sessions;
}

export async function retrieveBedrockManagedAgentSession(id: string) {
  const params = managedAgentParamsSchema.parse({ id });
  const response = await fetchApiOrThrow(`${BASE_PATH}/${encodeURIComponent(params.id)}`, {
    headers: await apiService.getHeaders(),
    timeoutMs: 35_000,
  });

  return managedAgentSessionResponseSchema.parse(await returnFetchedData(response)).session;
}

export async function sendBedrockManagedAgentMessage(id: string, text: string) {
  const params = managedAgentParamsSchema.parse({ id });
  const body = managedAgentMessageSchema.parse({ text });
  const response = await fetchApiOrThrow(`${BASE_PATH}/${encodeURIComponent(params.id)}/messages`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body,
    timeoutMs: 35_000,
  });

  return managedAgentAcceptedSchema.parse(await returnFetchedData(response));
}

export async function cancelBedrockManagedAgentTurn(id: string) {
  const params = managedAgentParamsSchema.parse({ id });
  const response = await fetchApiOrThrow(`${BASE_PATH}/${encodeURIComponent(params.id)}/cancel`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    timeoutMs: 35_000,
  });

  return managedAgentAcceptedSchema.parse(await returnFetchedData(response));
}

export async function streamBedrockManagedAgentEvents(
  id: string,
  signal: AbortSignal,
): Promise<Response> {
  const params = managedAgentParamsSchema.parse({ id });

  return fetchApiOrThrow(`${BASE_PATH}/${encodeURIComponent(params.id)}/events`, {
    headers: { ...(await apiService.getHeaders()), Accept: "text/event-stream" },
    signal,
    timeoutMs: null,
  });
}

export async function listBedrockManagedAgentItems(
  id: string,
  input: Partial<ManagedAgentPageQuery> = {},
  signal?: AbortSignal,
) {
  const params = managedAgentParamsSchema.parse({ id });
  const query = managedAgentPageQuerySchema.parse(input);
  const search = toQueryString(query);

  const response = await fetchApiOrThrow(
    `${BASE_PATH}/${encodeURIComponent(params.id)}/items${search}`,
    {
      headers: await apiService.getHeaders(),
      signal,
      timeoutMs: 35_000,
    },
  );

  return managedAgentItemsSchema.parse(await response.json());
}

export async function deleteBedrockManagedAgentSession(id: string) {
  const params = managedAgentParamsSchema.parse({ id });
  const response = await fetchApiOrThrow(`${BASE_PATH}/${encodeURIComponent(params.id)}`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
    timeoutMs: 35_000,
  });

  return managedAgentDeletedSchema.parse(await returnFetchedData(response));
}

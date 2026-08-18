import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const COMPOSIO_API_BASE_URL = "https://backend.composio.dev/api/v3.1";
const COMPOSIO_REQUEST_TIMEOUT_MS = 20_000;

function requireApiKey(env: IEnv): string {
  const apiKey = env.COMPOSIO_API_KEY?.trim();

  if (!apiKey) {
    throw new AssistantError("Composio is not configured", ErrorType.CONFIGURATION_ERROR);
  }

  return apiKey;
}

async function requestComposio(params: {
  env: IEnv;
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
}): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(`${COMPOSIO_API_BASE_URL}${params.path}`, {
      method: params.method ?? "GET",
      headers: {
        "x-api-key": requireApiKey(params.env),
        ...(params.body ? { "content-type": "application/json" } : {}),
      },
      body: params.body ? JSON.stringify(params.body) : undefined,
      signal: AbortSignal.timeout(COMPOSIO_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AssistantError("Composio trigger request failed", ErrorType.EXTERNAL_API_ERROR, 502, {
      originalError: error,
    });
  }

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new AssistantError(
      `Composio trigger request failed with status ${response.status}`,
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  return response.json().catch(() => null);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function unwrapData(value: unknown): Record<string, unknown> | null {
  const root = asRecord(value);

  return asRecord(root?.data) ?? root;
}

export async function getComposioTriggerType(params: {
  env: IEnv;
  triggerSlug: string;
}): Promise<{ slug: string; toolkitSlug: string }> {
  const data = unwrapData(
    await requestComposio({
      env: params.env,
      path: `/triggers_types/${encodeURIComponent(params.triggerSlug)}`,
    }),
  );
  const toolkit = asRecord(data?.toolkit);
  const slug = typeof data?.slug === "string" ? data.slug : "";
  const toolkitSlug = typeof toolkit?.slug === "string" ? toolkit.slug.toLowerCase() : "";

  if (!slug || !toolkitSlug) {
    throw new AssistantError(
      "Composio returned an invalid trigger type",
      ErrorType.EXTERNAL_API_ERROR,
    );
  }

  return { slug, toolkitSlug };
}

export async function listComposioTriggerTypes(params: { env: IEnv; toolkitSlug: string }): Promise<
  Array<{
    slug: string;
    name: string;
    description: string;
    kind: "webhook" | "poll";
    configuration: Record<string, unknown>;
  }>
> {
  const query = new URLSearchParams({
    toolkit_slugs: params.toolkitSlug,
    toolkit_versions: "latest",
    limit: "1000",
  });
  const root = asRecord(
    await requestComposio({
      env: params.env,
      path: `/triggers_types?${query.toString()}`,
    }),
  );

  if (!Array.isArray(root?.items)) {
    throw new AssistantError(
      "Composio returned invalid trigger types",
      ErrorType.EXTERNAL_API_ERROR,
    );
  }

  return root.items.flatMap((item) => {
    const record = asRecord(item);
    const toolkit = asRecord(record?.toolkit);

    if (
      typeof record?.slug !== "string" ||
      typeof record.name !== "string" ||
      typeof record.description !== "string" ||
      (record.type !== "webhook" && record.type !== "poll") ||
      typeof toolkit?.slug !== "string" ||
      toolkit.slug.toLowerCase() !== params.toolkitSlug.toLowerCase()
    ) {
      return [];
    }

    return [
      {
        slug: record.slug,
        name: record.name,
        description: record.description,
        kind: record.type,
        configuration: asRecord(record.config) ?? {},
      },
    ];
  });
}

export async function upsertComposioTriggerInstance(params: {
  env: IEnv;
  triggerSlug: string;
  externalUserId: string;
  connectedAccountId: string;
  configuration: Record<string, unknown>;
}): Promise<{ triggerId: string }> {
  const data = unwrapData(
    await requestComposio({
      env: params.env,
      path: `/trigger_instances/${encodeURIComponent(params.triggerSlug)}/upsert`,
      method: "POST",
      body: {
        user_id: params.externalUserId,
        connected_account_id: params.connectedAccountId,
        trigger_config: params.configuration,
      },
    }),
  );
  const triggerId =
    typeof data?.trigger_id === "string"
      ? data.trigger_id
      : typeof data?.triggerId === "string"
        ? data.triggerId
        : typeof data?.id === "string"
          ? data.id
          : "";

  if (!triggerId) {
    throw new AssistantError("Composio did not return a trigger id", ErrorType.EXTERNAL_API_ERROR);
  }

  return { triggerId };
}

export async function setComposioTriggerEnabled(params: {
  env: IEnv;
  triggerId: string;
  enabled: boolean;
}): Promise<void> {
  await requestComposio({
    env: params.env,
    path: `/trigger_instances/manage/${encodeURIComponent(params.triggerId)}`,
    method: "PATCH",
    body: { enabled: params.enabled },
  });
}

export async function deleteComposioTriggerInstance(params: {
  env: IEnv;
  triggerId: string;
}): Promise<void> {
  try {
    await requestComposio({
      env: params.env,
      path: `/trigger_instances/manage/${encodeURIComponent(params.triggerId)}`,
      method: "DELETE",
    });
  } catch (error) {
    if (error instanceof AssistantError && error.message.includes("status 404")) {
      return;
    }

    throw error;
  }
}

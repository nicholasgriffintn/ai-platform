import {
  WEBHOOK_TEST_EVENT_TYPE,
  toListPage,
  webhookEventTypeSchema,
  type CreateWebhookEndpointInput,
  type ListPage,
  type ListQuery,
  type UpdateWebhookEndpointInput,
  type WebhookEndpoint,
  type WebhookEndpointWithSecret,
  type WebhookTestResult,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, randomHex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parsePublicHttpUrl } from "@ngriffin_uk/polychat-utility-server/http";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { WebhookEndpointRecord } from "~/infrastructure/database/schema";
import { openSecret, sealSecret } from "~/infrastructure/secret-envelope";

import { deliverWebhookEvent } from "./signing";

const SECRET_PREFIX = "whsec_";
const SECRET_LENGTH = 64;

function newSecret(): string {
  return `${SECRET_PREFIX}${randomHex(SECRET_LENGTH).toLowerCase()}`;
}

function requirePublicHttpsUrl(url: string): string {
  try {
    parsePublicHttpUrl(url);
  } catch {
    throw new AssistantError(
      "Webhook endpoints must be public HTTPS URLs",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return url;
}

export function presentWebhookEndpoint(record: WebhookEndpointRecord): WebhookEndpoint {
  return {
    object: "webhook_endpoint",
    id: record.id,
    url: record.url,
    description: record.description,
    events: record.events.flatMap((event) => {
      const parsed = webhookEventTypeSchema.safeParse(event);

      return parsed.success ? [parsed.data] : [];
    }),
    enabled: record.enabled,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

async function requireEndpoint(
  context: ServiceContext,
  endpointId: string,
): Promise<WebhookEndpointRecord> {
  const endpoint = await context.repositories.webhookEndpoints.get(
    context.requireUser().id,
    endpointId,
  );

  if (!endpoint) {
    throw new AssistantError("Webhook endpoint not found", ErrorType.NOT_FOUND, 404);
  }

  return endpoint;
}

export async function listWebhookEndpoints(
  context: ServiceContext,
  query: ListQuery,
): Promise<ListPage<WebhookEndpoint>> {
  const records = await context.repositories.webhookEndpoints.list(
    context.requireUser().id,
    query.limit + 1,
    query.after,
  );

  return toListPage(records.map(presentWebhookEndpoint), query.limit, (endpoint) => endpoint.id);
}

export async function createWebhookEndpoint(
  context: ServiceContext,
  input: CreateWebhookEndpointInput,
): Promise<WebhookEndpointWithSecret> {
  const secret = newSecret();
  const record = await context.repositories.webhookEndpoints.create({
    userId: context.requireUser().id,
    url: requirePublicHttpsUrl(input.url),
    description: input.description,
    events: input.events,
    encryptedSecret: await sealSecret(context.env, secret),
  });

  return { ...presentWebhookEndpoint(record), secret };
}

export async function getWebhookEndpoint(
  context: ServiceContext,
  endpointId: string,
): Promise<WebhookEndpoint> {
  return presentWebhookEndpoint(await requireEndpoint(context, endpointId));
}

export async function updateWebhookEndpoint(
  context: ServiceContext,
  endpointId: string,
  input: UpdateWebhookEndpointInput,
): Promise<WebhookEndpoint> {
  await requireEndpoint(context, endpointId);

  const record = await context.repositories.webhookEndpoints.update(
    context.requireUser().id,
    endpointId,
    {
      ...(input.url === undefined ? {} : { url: requirePublicHttpsUrl(input.url) }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.events === undefined ? {} : { events: input.events }),
      ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
    },
  );

  if (!record) {
    throw new AssistantError("Webhook endpoint not found", ErrorType.NOT_FOUND, 404);
  }

  return presentWebhookEndpoint(record);
}

export async function deleteWebhookEndpoint(
  context: ServiceContext,
  endpointId: string,
): Promise<void> {
  const deleted = await context.repositories.webhookEndpoints.delete(
    context.requireUser().id,
    endpointId,
  );

  if (!deleted) {
    throw new AssistantError("Webhook endpoint not found", ErrorType.NOT_FOUND, 404);
  }
}

export async function rotateWebhookEndpointSecret(
  context: ServiceContext,
  endpointId: string,
): Promise<WebhookEndpointWithSecret> {
  await requireEndpoint(context, endpointId);

  const secret = newSecret();
  const record = await context.repositories.webhookEndpoints.update(
    context.requireUser().id,
    endpointId,
    { encrypted_secret: await sealSecret(context.env, secret) },
  );

  if (!record) {
    throw new AssistantError("Webhook endpoint not found", ErrorType.NOT_FOUND, 404);
  }

  return { ...presentWebhookEndpoint(record), secret };
}

export async function testWebhookEndpoint(
  context: ServiceContext,
  endpointId: string,
): Promise<WebhookTestResult> {
  const endpoint = await requireEndpoint(context, endpointId);

  return deliverWebhookEvent(
    endpoint.url,
    await openSecret(context.env, endpoint.encrypted_secret),
    {
      object: "event",
      id: generateId(),
      type: WEBHOOK_TEST_EVENT_TYPE,
      created_at: new Date().toISOString(),
      data: { webhook_endpoint_id: endpoint.id },
    },
  );
}

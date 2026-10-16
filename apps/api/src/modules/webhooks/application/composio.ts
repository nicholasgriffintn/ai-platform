import { truncateForModel } from "@ngriffin_uk/polychat-utility-core";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";
import { z } from "zod";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { markComposioAccountExpired } from "~/modules/connectors/application/composio-account-mirror";
import {
  admitRecipeEvent,
  type RecipeEventSubscription,
} from "~/modules/recipes/application/event-admission";
import { parseStoredRecipeInstallationData } from "~/modules/recipes/application/installation-persistence";
import { RecipeComposioTriggerRepository } from "~/modules/recipes/infrastructure/RecipeComposioTriggerRepository";
import { TemplateRepository } from "~/modules/templates/infrastructure/TemplateRepository";
import { verifyHmacSha256Webhook } from "~/modules/webhooks/infrastructure/webhook-signatures";
import type { IEnv } from "~/types";

const triggerMessageSchema = z.object({
  id: z.string().min(1).max(240),
  type: z.literal("composio.trigger.message"),
  metadata: z.object({
    log_id: z.string().max(240).optional(),
    trigger_slug: z.string().min(1).max(160),
    trigger_id: z.string().min(1).max(240),
    connected_account_id: z.string().min(1).max(240),
    auth_config_id: z.string().max(240).optional(),
    user_id: z.string().min(1).max(240),
  }),
  data: z.record(z.string(), z.unknown()),
  timestamp: z.string().max(80),
});

const connectedAccountExpiredSchema = z.object({
  id: z.string().min(1).max(240),
  type: z.literal("composio.connected_account.expired"),
  data: z.object({
    id: z.string().min(1).max(240),
    status: z.literal("EXPIRED").optional(),
  }),
  timestamp: z.string().max(80),
});

const webhookEventSchema = z.discriminatedUnion("type", [
  triggerMessageSchema,
  connectedAccountExpiredSchema,
]);

const MAX_WEBHOOK_PAYLOAD_BYTES = 1_000_000;

async function resolveActiveTrigger(
  context: ReturnType<typeof createServiceContext>,
  event: z.infer<typeof triggerMessageSchema>,
): Promise<RecipeEventSubscription | null> {
  const trigger = await context.repositories
    .get(RecipeComposioTriggerRepository)
    .getTriggerByExternalId(event.metadata.trigger_id);

  if (
    !trigger ||
    trigger.status !== "active" ||
    trigger.external_user_id !== event.metadata.user_id ||
    trigger.connected_account_id !== event.metadata.connected_account_id ||
    trigger.trigger_slug !== event.metadata.trigger_slug
  ) {
    return null;
  }

  const installation = await context.repositories
    .get(TemplateRepository)
    .getTemplateById(trigger.installation_id);

  if (
    !installation ||
    installation.kind !== "recipe" ||
    installation.status !== "active" ||
    installation.created_by_user_id !== trigger.created_by_user_id ||
    installation.project_id !== trigger.project_id
  ) {
    return null;
  }

  const stored = parseStoredRecipeInstallationData(installation);

  return stored?.recipeId
    ? {
        id: trigger.id,
        installationId: trigger.installation_id,
        createdByUserId: trigger.created_by_user_id,
        projectId: trigger.project_id,
        condition: trigger.condition,
        recipeId: stored.recipeId,
        configuration: stored.configuration,
      }
    : null;
}

async function processTriggerMessage(env: IEnv, event: z.infer<typeof triggerMessageSchema>) {
  const context = createServiceContext({ env });
  const subscription = await resolveActiveTrigger(context, event);

  if (!subscription) {
    return { accepted: true, queued: false };
  }

  const triggerSlug = truncateForModel(redactSensitiveTokens(event.metadata.trigger_slug), 160);

  return admitRecipeEvent({
    env,
    context,
    subscription,
    event: {
      source: "composio",
      id: event.id,
      label: event.metadata.trigger_slug,
      origin: `A verified ${triggerSlug} connector event started this recipe.`,
      data: event.data,
      metadata: {
        triggerId: event.metadata.trigger_id,
        triggerSlug: event.metadata.trigger_slug,
        logId: event.metadata.log_id,
        connectedAccountId: event.metadata.connected_account_id,
      },
    },
    revalidate: () => resolveActiveTrigger(context, event),
  });
}

export async function handleComposioWebhook(request: Request, env: IEnv): Promise<Response> {
  const secret = env.COMPOSIO_WEBHOOK_SECRET?.trim();

  if (!secret) {
    return Response.json({ error: "Composio webhook secret not configured" }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_PAYLOAD_BYTES) {
    return Response.json({ error: "Webhook payload is too large" }, { status: 413 });
  }

  const payload = await request.text();

  if (new TextEncoder().encode(payload).byteLength > MAX_WEBHOOK_PAYLOAD_BYTES) {
    return Response.json({ error: "Webhook payload is too large" }, { status: 413 });
  }

  const verified = await verifyHmacSha256Webhook({
    secret,
    webhookId: request.headers.get("webhook-id") ?? "",
    timestamp: request.headers.get("webhook-timestamp") ?? "",
    signature: request.headers.get("webhook-signature") ?? "",
    payload,
  });

  if (!verified) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(payload);
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const result = webhookEventSchema.safeParse(parsedPayload);

  if (!result.success) {
    return Response.json({ error: "Unsupported Composio webhook event" }, { status: 400 });
  }

  if (result.data.type === "composio.connected_account.expired") {
    const context = createServiceContext({ env });

    await Promise.all([
      context.repositories
        .get(RecipeComposioTriggerRepository)
        .markConnectedAccountError(result.data.data.id, "Connected account expired"),
      markComposioAccountExpired(context, result.data.data.id),
    ]);

    return Response.json({ accepted: true });
  }

  return Response.json(await processTriggerMessage(env, result.data));
}

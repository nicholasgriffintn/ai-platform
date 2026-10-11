import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import {
  admitRecipeEvent,
  type RecipeEventSubscription,
} from "~/modules/apps/application/recipes/event-admission";
import { parseStoredRecipeInstallationData } from "~/modules/apps/application/recipes/installation-persistence";
import {
  hashWebhookToken,
  isWellFormedWebhookToken,
} from "~/modules/webhooks/domain/recipe-webhook-token";
import type { IEnv } from "~/types";

export const MAX_RECIPE_WEBHOOK_BYTES = 16 * 1024;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

type ServiceContext = ReturnType<typeof createServiceContext>;

function notFound(): Response {
  return Response.json({ error: "Webhook not found" }, { status: 404 });
}

async function resolveSubscription(
  context: ServiceContext,
  tokenHash: string,
): Promise<{ subscription: RecipeEventSubscription | null; paused: boolean }> {
  const trigger = await context.repositories.recipeWebhookTriggers.getTriggerByTokenHash(tokenHash);

  if (!trigger) {
    return { subscription: null, paused: false };
  }

  if (trigger.status !== "active") {
    return { subscription: null, paused: true };
  }

  const installation = await context.repositories.templates.getTemplateById(
    trigger.installation_id,
  );

  if (
    !installation ||
    installation.kind !== "recipe" ||
    installation.created_by_user_id !== trigger.created_by_user_id ||
    installation.project_id !== trigger.project_id
  ) {
    return { subscription: null, paused: false };
  }

  if (installation.status !== "active") {
    return { subscription: null, paused: true };
  }

  const stored = parseStoredRecipeInstallationData(installation);

  return stored?.recipeId
    ? {
        subscription: {
          id: trigger.id,
          installationId: trigger.installation_id,
          createdByUserId: trigger.created_by_user_id,
          projectId: trigger.project_id,
          condition: trigger.condition,
          recipeId: stored.recipeId,
          configuration: stored.configuration,
        },
        paused: false,
      }
    : { subscription: null, paused: false };
}

function readEventId(request: Request): string | null | undefined {
  const key = request.headers.get("Idempotency-Key")?.trim();

  if (!key) {
    return undefined;
  }

  return key.length <= MAX_IDEMPOTENCY_KEY_LENGTH && /^[\x21-\x7e]+$/.test(key) ? key : null;
}

export async function handleRecipeWebhook(
  request: Request,
  env: IEnv,
  token: string,
): Promise<Response> {
  if (!isWellFormedWebhookToken(token)) {
    return notFound();
  }

  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_RECIPE_WEBHOOK_BYTES) {
    return Response.json({ error: "Webhook payload is too large" }, { status: 413 });
  }

  const payload = await request.text();

  if (new TextEncoder().encode(payload).byteLength > MAX_RECIPE_WEBHOOK_BYTES) {
    return Response.json({ error: "Webhook payload is too large" }, { status: 413 });
  }

  const data = safeParseJson<unknown>(payload);

  if (!isRecord(data)) {
    return Response.json({ error: "Send a JSON object" }, { status: 400 });
  }

  const eventId = readEventId(request);

  if (eventId === null) {
    return Response.json(
      { error: "Idempotency-Key must be at most 128 visible ASCII characters" },
      { status: 400 },
    );
  }

  const context = createServiceContext({ env });
  const tokenHash = await hashWebhookToken(token);
  const resolved = await resolveSubscription(context, tokenHash);

  if (!resolved.subscription) {
    return resolved.paused
      ? Response.json({ error: "This webhook is paused" }, { status: 409 })
      : notFound();
  }

  const result = await admitRecipeEvent({
    env,
    context,
    subscription: resolved.subscription,
    event: {
      source: "webhook",
      id: eventId ?? crypto.randomUUID(),
      label: "webhook",
      origin: "A request to this recipe's private webhook URL started it.",
      data,
      metadata: { triggerId: resolved.subscription.id },
    },
    revalidate: async () => (await resolveSubscription(context, tokenHash)).subscription,
  });

  return Response.json(result, { status: 202 });
}

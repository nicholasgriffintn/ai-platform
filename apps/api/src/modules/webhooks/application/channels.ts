import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { inboundChannelIdSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import type { Context } from "hono";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { receiveChannelMessage } from "~/modules/channels/application/receive";
import { getChannelSecrets } from "~/modules/channels/application/secrets";
import { getChannelAdapter } from "~/modules/channels/infrastructure/adapters";

const logger = getLogger({ prefix: "services/webhooks/channels" });

export async function handleChannelWebhook(c: Context): Promise<Response> {
  const parsedChannel = inboundChannelIdSchema.safeParse(c.req.param("channel"));

  if (!parsedChannel.success) {
    throw new AssistantError("Unknown channel webhook", ErrorType.NOT_FOUND);
  }

  const channel = parsedChannel.data;
  const adapter = getChannelAdapter(channel);

  if (!adapter) {
    throw new AssistantError(`${channel} has no channel adapter`, ErrorType.NOT_FOUND);
  }

  const { verification } = getChannelSecrets(channel, c.env);

  if (!verification) {
    throw new AssistantError(
      `${adapter.label} webhooks are not configured on this deployment`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const rawBody = await c.req.text();
  const verified = await adapter.verify(c.req.raw, verification, rawBody);

  if (!verified.ok) {
    logger.warn("Refused an unverified channel webhook", {
      channel,
      reason: verified.reason,
    });

    throw new AssistantError(
      verified.reason ?? `${adapter.label} request could not be verified`,
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  const incoming = adapter.parse(rawBody, { botUserId: c.env.SLACK_BOT_USER_ID });

  if (incoming.kind === "control") {
    return c.json(incoming.response);
  }

  const context = createServiceContext({ env: c.env, requestId: c.get("requestId") });

  return c.json(await receiveChannelMessage(context, channel, incoming));
}

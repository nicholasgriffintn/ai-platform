import {
  deviceSyncGrantRequestSchema,
  deviceSyncGrantResponseSchema,
  deviceSyncSocketQuerySchema,
  errorResponseSchema,
  NO_STORE,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { getDurableObjectStub } from "~/lib/durable-objects/client";
import { addRoute } from "~/lib/http/routeBuilder";
import { addInfraUsage } from "~/lib/usage/requestMeter";
import { createDeviceSyncGrant, resolveDeviceSyncGrant } from "~/services/sync/grant";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const app = new Hono<{ Bindings: IEnv; Variables: { user?: IUser } }>();

const COORDINATOR_ORIGIN = "https://user-sync-coordinator";

function socketUrl(env: IEnv): string {
  const base = env.API_BASE_URL?.trim() || "https://api.polychat.app";

  return `${base.replace(/^http/, "ws")}/sync/ws`;
}

addRoute(app, "post", "/grant", {
  tags: ["sync"],
  summary: "Mint a short-lived device sync socket grant",
  auth: true,
  bodySchema: deviceSyncGrantRequestSchema,
  responses: {
    200: { description: "A device sync grant", schema: deviceSyncGrantResponseSchema },
    401: { description: "Not authenticated", schema: errorResponseSchema },
  },
  handler: async ({ body, raw, serviceContext, user }) => {
    raw.header("Cache-Control", NO_STORE);

    const grant = await createDeviceSyncGrant(serviceContext.env, {
      deviceId: body.deviceId,
      userId: user.id,
    });

    return { ...grant, socketUrl: socketUrl(serviceContext.env) };
  },
});

app.get("/ws", async (context) => {
  if (context.req.raw.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    throw new AssistantError("Expected a websocket upgrade", ErrorType.PARAMS_ERROR, 400);
  }

  const query = deviceSyncSocketQuerySchema.safeParse({
    grant: context.req.query("grant"),
    device_id: context.req.query("device_id"),
  });

  if (!query.success) {
    throw new AssistantError("Invalid device sync request", ErrorType.PARAMS_ERROR, 400);
  }

  const env = context.env;
  const { userId } = await resolveDeviceSyncGrant({
    env,
    grant: query.data.grant,
    deviceId: query.data.device_id,
  });
  const stub = getDurableObjectStub(env.USER_SYNC_COORDINATOR, String(userId));

  if (!stub) {
    throw new AssistantError("Device sync is not configured", ErrorType.CONFIGURATION_ERROR);
  }

  addInfraUsage("do_requests", 1);

  const url = new URL(`${COORDINATOR_ORIGIN}/connect`);

  url.searchParams.set("deviceId", query.data.device_id);
  url.searchParams.set("userId", String(userId));

  return stub.fetch(url.toString(), { headers: { Upgrade: "websocket" } });
});

export default app;

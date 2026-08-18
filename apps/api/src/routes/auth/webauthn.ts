import { errorResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { type Context, Hono } from "hono";
import z from "zod/v4";

import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { addRoute } from "~/lib/http/routeBuilder";
import { requireAuth } from "~/middleware/auth";
import { deletePasskey, getUserPasskeys } from "~/services/auth/webauthn";
import { AssistantError, ErrorType } from "~/utils/errors";

const app = new Hono();

addRoute(app, "get", "/passkeys", {
  tags: ["auth"],
  summary: "Get all passkeys for the authenticated user",
  responses: {
    200: {
      description: "List of user's passkeys",
      schema: z.array(
        z.object({
          id: z.number(),
          device_type: z.string(),
          created_at: z.string(),
          backed_up: z.boolean(),
        }),
      ),
    },
    401: {
      description: "Authentication required",
      schema: errorResponseSchema,
    },
  },
  middleware: [requireAuth],
  handler: async ({ raw }) =>
    (async (c: Context) => {
      const user = c.get("user");

      if (!user) {
        throw new AssistantError("Authentication required", ErrorType.AUTHENTICATION_ERROR);
      }

      const { repositories } = getServiceContext(c);
      const passkeys = await getUserPasskeys(repositories, user.id);

      return ResponseFactory.success(
        c,
        passkeys.map((passkey) => ({
          id: passkey.id,
          device_type: passkey.device_type,
          created_at: passkey.created_at,
          backed_up: Boolean(passkey.backed_up),
        })),
      );
    })(raw),
});

addRoute(app, "delete", "/passkeys/:id", {
  tags: ["auth"],
  summary: "Delete a passkey for the authenticated user",
  responses: {
    200: {
      description: "Passkey deleted successfully",
      schema: z.object({ success: z.boolean() }),
    },
    401: {
      description: "Authentication required",
      schema: errorResponseSchema,
    },
    400: {
      description: "Bad request or validation error",
      schema: z.object({ error: z.string(), type: z.string() }),
    },
  },
  middleware: [requireAuth],
  handler: async ({ raw }) =>
    (async (c: Context) => {
      const user = c.get("user");

      if (!user) {
        throw new AssistantError("Authentication required", ErrorType.AUTHENTICATION_ERROR);
      }

      const passkeyId = Number.parseInt(c.req.param("id"), 10);

      if (Number.isNaN(passkeyId)) {
        throw new AssistantError("Invalid passkey ID", ErrorType.AUTHENTICATION_ERROR);
      }

      const { repositories } = getServiceContext(c);
      const success = await deletePasskey(repositories, passkeyId, user.id);

      if (!success) {
        throw new AssistantError(
          "Failed to delete passkey or passkey not found",
          ErrorType.AUTHENTICATION_ERROR,
        );
      }

      return ResponseFactory.success(c, { success });
    })(raw),
});

export default app;

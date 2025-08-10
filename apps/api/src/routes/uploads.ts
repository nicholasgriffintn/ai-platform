import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";

import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { handleFileUpload } from "~/services/uploads";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { IEnv } from "../types";
import { errorResponseSchema } from "./schemas/shared";
import { uploadResponseSchema } from "./schemas/uploads";

const app = new Hono();
const routeLogger = createRouteLogger("UPLOADS");

app.use("/*", requireAuth);

app.use("/*", (c, next) => {
  routeLogger.info(`Processing uploads route: ${c.req.path}`);
  return next();
});

app.post(
  "/",
  describeRoute({
    tags: ["uploads"],
    summary: "Upload file",
    description: "Upload an image or document to the server",
    requestBody: {
      description: "Multipart form data containing file",
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            properties: {
              file: {
                type: "string",
                format: "binary",
              },
            },
            required: ["file"],
          },
        },
      },
    },
    responses: {
      200: {
        description: "File upload successful, returns the URL",
        content: {
          "application/json": {
            schema: resolver(uploadResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or invalid file",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      500: {
        description: "Server error or storage failure",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    const env = context.env as IEnv;

    let formData: FormData;
    try {
      formData = await context.req.formData();
    } catch (_formError) {
      throw new AssistantError(
        "Failed to parse upload data",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const user = context.get("user");
    const userId = user?.id;

    const response = await handleFileUpload(env, userId, formData);
    return context.json(response);
  },
);

export default app;

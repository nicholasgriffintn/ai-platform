import {
  listRecordingsResponseSchema,
  recordingDetailResponseSchema,
  recordingGenerateImageSchema,
  recordingSummariseSchema,
  recordingTranscribeSchema,
  apiResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import { z } from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requirePlan } from "~/middleware/requirePlan";
import { handleRecordingGenerateImage } from "~/services/apps/recordings/generate-image";
import { handleRecordingDetail } from "~/services/apps/recordings/get-details";
import { handleRecordingList } from "~/services/apps/recordings/list";
import { handleRecordingSummarise } from "~/services/apps/recordings/summarise";
import { handleRecordingTranscribe } from "~/services/apps/recordings/transcribe";
import { handleRecordingUpload } from "~/services/apps/recordings/upload";
import {
  projectScopeQuerySchema,
  requireOptionalProjectCapabilityAccess,
} from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

const app = new Hono();

const routeLogger = createRouteLogger("apps/recordings");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps route: ${c.req.path}`);

  return next();
});

const recordingParamsSchema = z.object({
  id: z.string().min(1),
});

addRoute(app, "get", "/", {
  tags: ["apps"],
  description: "List user's recordings",
  responses: {
    200: {
      description: "List of user's recordings",
      schema: listRecordingsResponseSchema,
    },
  },
  auth: true,
  querySchema: projectScopeQuerySchema,
  middleware: [requirePlan("pro")],
  handler: async ({ query, serviceContext, user }) => {
    try {
      await requireOptionalProjectCapabilityAccess(
        serviceContext,
        query.projectId,
        "app",
        "featured-recording-processor",
      );

      const recordings = await handleRecordingList({
        context: serviceContext,
        user,
        projectId: query.projectId,
      });

      return { recordings };
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      routeLogger.error("Error fetching recordings:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError("Failed to fetch recordings", ErrorType.UNKNOWN_ERROR);
    }
  },
});

addRoute(app, "get", "/:id", {
  tags: ["apps"],
  description: "Get recording details",
  paramSchema: recordingParamsSchema,
  responses: {
    200: {
      description: "Recording details",
      schema: recordingDetailResponseSchema,
    },
  },
  auth: true,
  querySchema: projectScopeQuerySchema,
  middleware: [requirePlan("pro")],
  handler: async ({ params, query, serviceContext, user }) => {
    try {
      await requireOptionalProjectCapabilityAccess(
        serviceContext,
        query.projectId,
        "app",
        "featured-recording-processor",
      );

      const recording = await handleRecordingDetail({
        context: serviceContext,
        recordingId: params.id,
        user,
        projectId: query.projectId,
      });

      return { recording };
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      routeLogger.error("Error fetching recording:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError("Failed to fetch recording", ErrorType.UNKNOWN_ERROR);
    }
  },
});

addRoute(app, "post", "/upload", {
  tags: ["apps"],
  description: "Upload a recording",
  responses: {
    200: { description: "Response", schema: apiResponseSchema },
  },
  auth: true,
  querySchema: projectScopeQuerySchema,
  middleware: [requirePlan("pro")],
  handler: async ({ query, raw, serviceContext, user }) => {
    try {
      await requireOptionalProjectCapabilityAccess(
        serviceContext,
        query.projectId,
        "app",
        "featured-recording-processor",
      );

      const formData = await raw.req.formData();
      const title = formData.get("title") as string;
      const description = formData.get("description") as string | null;
      const audio = formData.get("audio") as File | null;
      const audioUrl = formData.get("audioUrl") as string | null;

      if (!audio && !audioUrl) {
        throw new AssistantError("Missing audio file or URL", ErrorType.PARAMS_ERROR);
      }

      const response = await handleRecordingUpload({
        context: serviceContext,
        request: {
          audio,
          audioUrl,
          title,
          description: description || undefined,
        },
        user,
        projectId: query.projectId,
      });

      if (response.status === "error") {
        throw new AssistantError(
          "Something went wrong, we are working on it",
          ErrorType.UNKNOWN_ERROR,
        );
      }

      return { response };
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      routeLogger.error("Error uploading recording:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      throw new AssistantError("Failed to upload recording", ErrorType.UNKNOWN_ERROR);
    }
  },
});

addRoute(app, "post", "/transcribe", {
  tags: ["apps"],
  description: "Transcribe a recording",
  bodySchema: recordingTranscribeSchema,
  responses: {
    200: { description: "Response", schema: apiResponseSchema },
  },
  auth: true,
  querySchema: projectScopeQuerySchema,
  middleware: [requirePlan("pro")],
  handler: async ({ body, query, raw, serviceContext, user }) => {
    await requireOptionalProjectCapabilityAccess(
      serviceContext,
      query.projectId,
      "app",
      "featured-recording-processor",
    );

    const newUrl = new URL(raw.req.url);
    const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

    const response = await handleRecordingTranscribe({
      context: serviceContext,
      request: body,
      user,
      app_url,
      projectId: query.projectId,
    });

    return { response };
  },
});

addRoute(app, "post", "/summarise", {
  tags: ["apps"],
  description: "Summarise a recording",
  bodySchema: recordingSummariseSchema,
  responses: {
    200: { description: "Response", schema: apiResponseSchema },
  },
  auth: true,
  querySchema: projectScopeQuerySchema,
  middleware: [requirePlan("pro")],
  handler: async ({ body, query, serviceContext, user }) => {
    await requireOptionalProjectCapabilityAccess(
      serviceContext,
      query.projectId,
      "app",
      "featured-recording-processor",
    );

    const response = await handleRecordingSummarise({
      context: serviceContext,
      request: body,
      user,
      projectId: query.projectId,
    });

    return { response };
  },
});

addRoute(app, "post", "/generate-image", {
  tags: ["apps"],
  description: "Generate an image for a recording",
  bodySchema: recordingGenerateImageSchema,
  responses: {
    200: { description: "Response", schema: apiResponseSchema },
  },
  auth: true,
  querySchema: projectScopeQuerySchema,
  middleware: [requirePlan("pro")],
  handler: async ({ body, query, serviceContext, user }) => {
    await requireOptionalProjectCapabilityAccess(
      serviceContext,
      query.projectId,
      "app",
      "featured-recording-processor",
    );

    const response = await handleRecordingGenerateImage({
      context: serviceContext,
      request: body,
      user,
      projectId: query.projectId,
    });

    return { response };
  },
});

export default app;

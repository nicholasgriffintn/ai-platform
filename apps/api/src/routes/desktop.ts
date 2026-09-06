import {
  desktopDownloadsSchema,
  desktopUpdateParamsSchema,
  desktopUpdateSchema,
  errorResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  getDesktopDownloads,
  resolveDesktopUpdate,
  streamDesktopArchive,
  streamDesktopUpdaterArtifact,
} from "~/services/desktop-releases";

const app = new Hono();
const routeLogger = createRouteLogger("desktop");

const downloadParamsSchema = z.object({
  bundle: z.string().min(1),
});

const updaterArtifactParamsSchema = z.object({
  bundle: z.string().min(1),
  filename: z.string().min(1),
});

app.use("/*", (c, next) => {
  routeLogger.info(`Processing desktop route: ${c.req.path}`);

  return next();
});

addRoute(app, "get", "/downloads", {
  tags: ["desktop"],
  summary: "List the current desktop downloads",
  responses: {
    200: { description: "The published desktop bundles", schema: desktopDownloadsSchema },
    404: { description: "Nothing has been released yet", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext }) => getDesktopDownloads(serviceContext.env),
});

addRoute(app, "get", "/downloads/:bundle", {
  tags: ["desktop"],
  summary: "Download a desktop bundle",
  paramSchema: downloadParamsSchema,
  responses: {
    200: { description: "The bundle archive" },
    404: { description: "Unknown bundle", schema: errorResponseSchema },
  },
  handler: async ({ params, serviceContext }) =>
    streamDesktopArchive(serviceContext.env, params.bundle),
});

addRoute(app, "get", "/updates/:bundle/:filename", {
  tags: ["desktop"],
  summary: "Download an update artefact",
  paramSchema: updaterArtifactParamsSchema,
  responses: {
    200: { description: "The update artefact" },
    404: { description: "Unknown artefact", schema: errorResponseSchema },
  },
  handler: async ({ params, serviceContext }) =>
    streamDesktopUpdaterArtifact(serviceContext.env, params.bundle, params.filename),
});

addRoute(app, "get", "/releases/:target/:arch/:current_version", {
  tags: ["desktop"],
  summary: "Check for a desktop update",
  paramSchema: desktopUpdateParamsSchema,
  responses: {
    200: { description: "An update is available", schema: desktopUpdateSchema },
    204: { description: "The installed version is current" },
  },
  handler: async ({ params, serviceContext }) => {
    const update = await resolveDesktopUpdate(serviceContext.env, {
      target: params.target,
      architecture: params.arch,
      currentVersion: params.current_version,
    });

    return update ?? new Response(null, { status: 204 });
  },
});

export default app;

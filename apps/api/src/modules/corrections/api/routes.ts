import { apiResponseSchema, correctionListResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { dismissCorrection, listCorrections } from "~/modules/corrections/application/corrections";

const app = new Hono();

addRoute(app, "get", "/", {
  tags: ["memory"],
  summary: "List the rules learned from your corrections",
  description:
    "The rules teammates have recorded after you corrected them, most recently repeated first.",
  auth: true,
  responses: { 200: { description: "Learned rules", schema: correctionListResponseSchema } },
  handler: async ({ serviceContext }) => listCorrections(serviceContext),
});

addRoute(app, "delete", "/:correctionId", {
  tags: ["memory"],
  summary: "Forget a learned rule",
  description:
    "Remove a rule from your list. The memory or skill text it changed stays until you edit it.",
  auth: true,
  paramSchema: z.object({ correctionId: z.string().min(1) }),
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params }) => {
    await dismissCorrection(serviceContext, params.correctionId);

    return { success: true };
  },
});

export default app;

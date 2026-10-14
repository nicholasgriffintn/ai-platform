import {
  createTaskResponseSchema,
  getMemorySynthesisResponseSchema,
  memorySynthesisListSchema,
  triggerMemorySynthesisRequestSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import {
  createMemorySynthesisTask,
  getActiveMemorySynthesis,
  listMemorySyntheses,
} from "~/modules/memory/application/syntheses";

const app = new Hono();
const namespaceQuerySchema = z.object({ namespace: z.string().optional() });
const synthesesQuerySchema = namespaceQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

defineResource(app, { idParam: "synthesis_id", tags: ["memory"] }, (syntheses) => {
  syntheses
    .list({
      auth: true,
      summary: "List memory syntheses",
      querySchema: synthesesQuerySchema,
      responses: { 200: { description: "Syntheses", schema: memorySynthesisListSchema } },
      handler: ({ query, serviceContext, user }) =>
        listMemorySyntheses(serviceContext, user.id, query),
    })
    .create({
      auth: true,
      summary: "Queue a memory synthesis",
      bodySchema: triggerMemorySynthesisRequestSchema,
      responses: { 200: { description: "Queued task", schema: createTaskResponseSchema } },
      handler: ({ body, serviceContext, user }) =>
        createMemorySynthesisTask(serviceContext, user.id, body),
    })
    .view("active", {
      auth: true,
      summary: "Read the active synthesis for a namespace",
      querySchema: namespaceQuerySchema,
      responses: {
        200: { description: "Active synthesis", schema: getMemorySynthesisResponseSchema },
      },
      handler: ({ query, serviceContext, user }) =>
        getActiveMemorySynthesis(serviceContext, user.id, query.namespace || "global"),
    });
});

export default app;

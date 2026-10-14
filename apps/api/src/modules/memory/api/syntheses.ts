import {
  createTaskResponseSchema,
  memorySynthesisListSchema,
  queryBooleanSchema,
  triggerMemorySynthesisRequestSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import {
  createMemorySynthesisTask,
  listMemorySyntheses,
} from "~/modules/memory/application/syntheses";

const app = new Hono();
const synthesesQuerySchema = z.object({
  namespace: z.string().optional(),
  active: queryBooleanSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

defineResource(app, { idParam: "synthesis_id", tags: ["memory"] }, (syntheses) => {
  syntheses
    .list({
      auth: true,
      summary: "List memory syntheses",
      description: "Pass active=true for the synthesis currently in use for the namespace.",
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
    });
});

export default app;

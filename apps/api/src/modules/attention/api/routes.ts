import {
  workAttentionQuerySchema,
  workAttentionResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineResource } from "~/infrastructure/http/resource";
import { listWorkAttention } from "~/modules/attention/application";

const app = new Hono();

defineResource(app, { idParam: "attention_id", tags: ["attention"] }, (attention) => {
  attention.list({
    auth: true,
    summary: "List operational work across the caller's workspaces",
    description:
      "Derives filtered task interactions and sandbox run states through current membership. Facets and the filtered total come with each page.",
    querySchema: workAttentionQuerySchema,
    responses: { 200: { description: "Operational work", schema: workAttentionResponseSchema } },
    handler: ({ serviceContext, query }) => listWorkAttention(serviceContext, query),
  });
});

export default app;

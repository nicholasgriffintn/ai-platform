import { correctionListResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import { dismissCorrection, listCorrections } from "~/modules/corrections/application/corrections";

const app = new Hono();

defineResource(app, { idParam: "correction_id", tags: ["memory"] }, (corrections) => {
  corrections
    .list({
      auth: true,
      summary: "List the rules learned from your corrections",
      description:
        "The rules teammates have recorded after you corrected them, most recently repeated first.",
      responses: { 200: { description: "Learned rules", schema: correctionListResponseSchema } },
      handler: ({ serviceContext }) => listCorrections(serviceContext),
    })
    .delete({
      auth: true,
      summary: "Forget a learned rule",
      description:
        "Remove a rule from your list. The memory or skill text it changed stays until you edit it.",
      paramSchema: z.object({ correction_id: z.string().min(1) }),
      handler: async ({ serviceContext, params }) => {
        await dismissCorrection(serviceContext, params.correction_id);

        return { deleted: true };
      },
    });
});

export default app;

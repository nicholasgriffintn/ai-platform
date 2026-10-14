import { listPageOf } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import type { HonoLike } from "~/infrastructure/http/routeBuilder";
import { listCanvasModels } from "~/modules/experiences/application/canvas/list-models";
import { listReplicateModels } from "~/modules/experiences/application/replicate/models";

const canvasModelsQuerySchema = z.object({ mode: z.enum(["image", "video"]).default("image") });

export function defineExperienceModels(app: HonoLike): void {
  defineResource(
    app,
    { path: "/canvas/models", idParam: "model_id", tags: ["experiences"] },
    (models) => {
      models.list({
        auth: "user-or-anonymous",
        summary: "List Canvas image and video models",
        querySchema: canvasModelsQuerySchema,
        handler: async ({ query, serviceContext, user }) =>
          listPageOf(
            await listCanvasModels({ env: serviceContext.env, mode: query.mode, userId: user?.id }),
            (model) => model.id,
          ),
      });
    },
  );

  defineResource(
    app,
    { path: "/replicate/models", idParam: "model_id", tags: ["experiences"] },
    (models) => {
      models.list({
        auth: "user-or-anonymous",
        summary: "List Replicate models",
        handler: async () => listPageOf(listReplicateModels(), (model) => model.id),
      });
    },
  );
}

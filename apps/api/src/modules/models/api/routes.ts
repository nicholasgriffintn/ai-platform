import { availableModalities } from "@ngriffin_uk/polychat-ai-models";
import {
  errorResponseSchema,
  listPageOf,
  modelParamsSchema,
  modelTiersResponseSchema,
  type ModelConfig,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import {
  getModelDetails,
  listModalities,
  listModelCatalogue,
  listModels,
  listModelsByModality,
  listModelsByOutputModality,
  listModelsByStrength,
  listStrengths,
} from "~/modules/models/application";
import { getLineupModelsForUser } from "~/modules/models/application/resolve";
import { resolveTierLineup } from "~/modules/models/application/tiers";

const app = new Hono();
const modalitySchema = z.enum(availableModalities);
const listModelsQuerySchema = z.object({
  capability: z.string().min(1).optional(),
  modality: modalitySchema.optional(),
  output: modalitySchema.optional(),
});

function modelPage(models: ModelConfig) {
  return listPageOf(
    Object.entries(models).map(([id, model]) => ({ ...model, id })),
    (model) => model.id,
  );
}

defineResource(app, { idParam: "model_id", tags: ["models"] }, (models) => {
  models
    .list({
      auth: false,
      summary: "List models",
      description:
        "Models the caller can use, with capabilities and pricing. Filter by capability, input modality or output modality. The page also lists every capability and modality you can filter by.",
      cache: "no-store",
      querySchema: listModelsQuerySchema,
      responses: { 400: { description: "Unknown capability", schema: errorResponseSchema } },
      handler: async ({ query, serviceContext, user }) => {
        if (query.capability && !listStrengths().includes(query.capability)) {
          throw new AssistantError("Invalid capability parameter", ErrorType.PARAMS_ERROR, 400);
        }

        const listed = query.capability
          ? await listModelsByStrength(serviceContext.env, query.capability, user?.id)
          : query.modality
            ? await listModelsByModality(serviceContext.env, query.modality, user?.id)
            : query.output
              ? await listModelsByOutputModality(serviceContext.env, query.output, user?.id)
              : await listModels(serviceContext.env, user);

        return {
          ...modelPage(listed),
          capabilities: listStrengths(),
          modalities: listModalities(),
        };
      },
    })
    .view("catalogue", {
      auth: false,
      summary: "List the model catalogue",
      description:
        "Every model the platform knows about, without filtering by the caller's access. Intended for public catalogue surfaces.",
      cache: { maxAge: 1800, staleWhileRevalidate: 3600 },
      handler: async () => modelPage(listModelCatalogue()),
    })
    .view("tiers", {
      auth: false,
      summary: "Resolve model tiers",
      description: "The model selected by each tier and role for the caller across each runtime.",
      responses: { 200: { description: "Tier lineup", schema: modelTiersResponseSchema } },
      handler: async ({ serviceContext, user }) =>
        resolveTierLineup(
          await getLineupModelsForUser(serviceContext.env, user, { shouldUseCache: false }),
          user,
        ),
    })
    .read({
      auth: false,
      summary: "Get a model",
      paramSchema: modelParamsSchema,
      responses: { 404: { description: "Model not found", schema: errorResponseSchema } },
      handler: async ({ params, serviceContext, user }) => {
        try {
          return await getModelDetails(serviceContext.env, params.model_id, user?.id);
        } catch {
          throw new AssistantError(
            "Model not found or user does not have access",
            ErrorType.NOT_FOUND,
            404,
          );
        }
      },
    });
});

export default app;

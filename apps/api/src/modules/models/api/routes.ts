import { availableModalities } from "@ngriffin_uk/polychat-ai-models";
import {
  artificialAnalysisModelsResponseSchema,
  errorResponseSchema,
  listPageOf,
  modelParamsSchema,
  modelTiersResponseSchema,
  systemModelChoicesQuerySchema,
  systemModelChoicesResponseSchema,
  systemModelSuggestionsResponseSchema,
  suggestSystemModelChoicesSchema,
  updateSystemModelChoicesSchema,
  type ModelConfig,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource, defineSingleton } from "~/infrastructure/http/resource";
import { ArtificialAnalysisRepository } from "~/modules/model-analysis/infrastructure/ArtificialAnalysisRepository";
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
import {
  getSystemModelChoices,
  suggestSystemModelChoices,
  updateSystemModelChoices,
} from "~/modules/models/application/choices";
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

defineSingleton(app, { path: "/choices", tags: ["models"] }, (choices) => {
  choices
    .read({
      auth: true,
      summary: "Get model choices",
      description:
        "The models you, or a workspace, chose for each background job, with fallbacks, the platform defaults and whether each choice still runs.",
      cache: "no-store",
      querySchema: systemModelChoicesQuerySchema,
      responses: {
        200: { description: "Model choices", schema: systemModelChoicesResponseSchema },
      },
      handler: ({ serviceContext, query }) =>
        getSystemModelChoices(serviceContext, query.workspace_id),
    })
    .update({
      auth: true,
      summary: "Update model choices",
      description:
        "Replace the ordered choices for one job. The first model runs; the rest are fallbacks. An empty list returns the job to the platform defaults.",
      bodySchema: updateSystemModelChoicesSchema,
      responses: {
        200: { description: "Model choices", schema: systemModelChoicesResponseSchema },
        400: { description: "A model cannot be used for this job", schema: errorResponseSchema },
      },
      handler: ({ serviceContext, body }) => updateSystemModelChoices(serviceContext, body),
    })
    .action("suggestions", {
      auth: true,
      summary: "Suggest model choices",
      description:
        "Rank the models you can run for every background job by the benchmark that fits the job, optionally keeping to one provider. Nothing is saved until you update the choices.",
      bodySchema: suggestSystemModelChoicesSchema,
      responses: {
        200: { description: "Suggested choices", schema: systemModelSuggestionsResponseSchema },
      },
      handler: ({ serviceContext, body }) => suggestSystemModelChoices(serviceContext, body),
    });
});

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
    .view("artificial_analysis", {
      auth: false,
      summary: "List cached Artificial Analysis model data",
      description:
        "Cached Artificial Analysis benchmark, arena, pricing and performance data with source attribution.",
      responses: {
        200: { description: "Model data", schema: artificialAnalysisModelsResponseSchema },
      },
      handler: async ({ serviceContext }) => ({
        ...listPageOf(
          await serviceContext.repositories.get(ArtificialAnalysisRepository).listAll(),
          (model) => model.id,
        ),
        attribution: {
          label: "Artificial Analysis",
          url: "https://artificialanalysis.ai/",
        },
      }),
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

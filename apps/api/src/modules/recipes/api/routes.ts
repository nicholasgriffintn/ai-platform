import {
  assistantRecipeInstallResponseSchema,
  assistantRecipesResponseSchema,
  composioTriggerTypesResponseSchema,
  createInstallationTriggerRequestSchema,
  errorResponseSchema,
  listPageOf,
  recipeConnectorProviderSchema,
  recipeInstallationSchema,
  recipeInstallationUpdateRequestSchema,
  recipeInstallRequestSchema,
  recipeInvocationRequestSchema,
  recipeInvocationResponseSchema,
  installationTriggerListSchema,
  updateInstallationTriggerRequestSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import { projectScopeQuerySchema } from "~/modules/workspaces/application/access";

import {
  deleteRecipeInstallation,
  getAssistantRecipe,
  installAssistantRecipe,
  invokeAssistantRecipe,
  listAssistantRecipes,
  listRecipeInstallations,
  updateRecipeInstallation,
} from "../application";
import { listRecipeComposioTriggerTypes } from "../application/composio-triggers";
import {
  createRecipeTrigger,
  deleteRecipeTrigger,
  listRecipeTriggers,
  requireInstallationTrigger,
  rotateRecipeTrigger,
  setRecipeTriggerStatus,
} from "../application/installation-triggers";

const app = new Hono();
const recipeParamsSchema = z.object({ recipe_id: z.string().min(1) });
const installationParamsSchema = z.object({ installation_id: z.string().min(1) });
const triggerParamsSchema = installationParamsSchema.extend({ trigger_id: z.string().min(1) });
const triggerTypesQuerySchema = z.object({ provider_id: recipeConnectorProviderSchema });

function notFound(message: string): never {
  throw new AssistantError(message, ErrorType.NOT_FOUND, 404);
}

defineResource(app, { idParam: "recipe_id", tags: ["recipes"] }, (recipes) => {
  recipes
    .list({
      auth: "user-or-anonymous",
      summary: "List recipes",
      description:
        "One-tap setups for integrations and automations that can start from web, iOS or messaging.",
      cache: { maxAge: 60, staleWhileRevalidate: 300 },
      responses: { 200: { description: "Recipes", schema: assistantRecipesResponseSchema } },
      handler: async ({ raw, serviceContext, user }) => {
        const {
          recipes: items,
          categories,
          filters,
        } = await listAssistantRecipes({
          context: serviceContext,
          userId: user?.id,
          requestUrl: raw.req.url,
        });

        return { ...listPageOf(items, (recipe) => recipe.id), categories, filters };
      },
    })
    .read({
      auth: "user-or-anonymous",
      summary: "Get a recipe",
      paramSchema: recipeParamsSchema,
      responses: { 404: { description: "Recipe not found", schema: errorResponseSchema } },
      handler: async ({ raw, params, serviceContext, user }) =>
        (await getAssistantRecipe(params.recipe_id, {
          context: serviceContext,
          userId: user?.id,
          requestUrl: raw.req.url,
        })) ?? notFound("Recipe not found"),
    })
    .action("install", {
      auth: true,
      summary: "Start recipe setup",
      description:
        "Creates the setup payload a client uses to open a chat and finish configuration conversationally.",
      paramSchema: recipeParamsSchema,
      bodySchema: recipeInstallRequestSchema,
      responses: {
        200: { description: "Setup payload", schema: assistantRecipeInstallResponseSchema },
        404: { description: "Recipe not found", schema: errorResponseSchema },
      },
      handler: async ({ raw, params, body, serviceContext, user }) =>
        (await installAssistantRecipe(params.recipe_id, {
          context: serviceContext,
          userId: user.id,
          channel: body.channel,
          triggers: body.triggers,
          configuration: body.configuration,
          projectId: body.projectId,
          requestUrl: raw.req.url,
        })) ?? notFound("Recipe not found"),
    })
    .action("invoke", {
      auth: true,
      summary: "Run an installed recipe",
      description: "Runs now, or queues the run as a task when queue is true.",
      paramSchema: recipeParamsSchema,
      bodySchema: recipeInvocationRequestSchema,
      responses: {
        200: { description: "Recipe invocation", schema: recipeInvocationResponseSchema },
        404: { description: "Recipe not found", schema: errorResponseSchema },
      },
      handler: async ({ raw, params, body, serviceContext, user }) =>
        (await invokeAssistantRecipe(params.recipe_id, {
          context: serviceContext,
          userId: user.id,
          channel: body.channel,
          input: body.input,
          projectId: body.projectId,
          requestUrl: raw.req.url,
          queue: body.queue,
          requireInstalled: true,
        })) ?? notFound("Recipe not found"),
    });

  const installations = recipes.collection("installations", "installation_id");

  installations
    .list({
      auth: true,
      summary: "List installed recipes",
      querySchema: projectScopeQuerySchema,
      handler: async ({ query, serviceContext, user }) =>
        listPageOf(
          (
            await listRecipeInstallations({
              context: serviceContext,
              userId: user.id,
              projectId: query.project_id,
            })
          ).installations,
          (installation) => installation.id,
        ),
    })
    .update({
      auth: true,
      summary: "Update an installed recipe",
      paramSchema: installationParamsSchema,
      bodySchema: recipeInstallationUpdateRequestSchema,
      responses: {
        200: { description: "The installation", schema: recipeInstallationSchema },
        404: { description: "Installation not found", schema: errorResponseSchema },
      },
      handler: async ({ raw, params, body, serviceContext, user }) =>
        (await updateRecipeInstallation({
          context: serviceContext,
          userId: user.id,
          installationId: params.installation_id,
          update: body,
          requestUrl: raw.req.url,
        })) ?? notFound("Recipe installation not found"),
    })
    .delete({
      auth: true,
      summary: "Remove an installed recipe",
      paramSchema: installationParamsSchema,
      handler: async ({ params, serviceContext, user }) =>
        (await deleteRecipeInstallation({
          context: serviceContext,
          userId: user.id,
          installationId: params.installation_id,
        }))
          ? { deleted: true }
          : notFound("Recipe installation not found"),
    });

  installations.sub("trigger_types", "trigger_type_id").list({
    auth: true,
    summary: "List event types a connected account can trigger on",
    paramSchema: installationParamsSchema,
    querySchema: triggerTypesQuerySchema,
    responses: {
      200: { description: "Trigger types", schema: composioTriggerTypesResponseSchema },
    },
    handler: async ({ params, query, serviceContext, user }) =>
      listPageOf(
        (
          await listRecipeComposioTriggerTypes({
            context: serviceContext,
            userId: user.id,
            installationId: params.installation_id,
            providerId: query.provider_id,
          })
        ).triggerTypes,
        (triggerType) => triggerType.slug,
      ),
  });

  installations
    .sub("triggers", "trigger_id")
    .list({
      auth: true,
      summary: "List the installation's triggers",
      description: "Composio event triggers and signed webhook triggers, each with its broker.",
      paramSchema: installationParamsSchema,
      responses: { 200: { description: "Triggers", schema: installationTriggerListSchema } },
      handler: ({ params, serviceContext, user }) =>
        listRecipeTriggers({ context: serviceContext, userId: user.id }, params.installation_id),
    })
    .create({
      auth: true,
      summary: "Add a trigger",
      description:
        "Subscribes to a Composio event or creates a signed webhook URL. Webhook triggers return their URL once.",
      paramSchema: installationParamsSchema,
      bodySchema: createInstallationTriggerRequestSchema,
      handler: ({ params, body, serviceContext, user }) =>
        createRecipeTrigger(
          { context: serviceContext, userId: user.id },
          params.installation_id,
          body,
        ),
    })
    .update({
      auth: true,
      summary: "Pause or resume a trigger",
      paramSchema: triggerParamsSchema,
      bodySchema: updateInstallationTriggerRequestSchema,
      handler: async ({ params, body, serviceContext, user }) => {
        const scope = { context: serviceContext, userId: user.id };

        await requireInstallationTrigger(scope, params.installation_id, params.trigger_id);

        return setRecipeTriggerStatus(scope, params.trigger_id, body.status);
      },
    })
    .delete({
      auth: true,
      summary: "Remove a trigger",
      paramSchema: triggerParamsSchema,
      handler: async ({ params, serviceContext, user }) => {
        const scope = { context: serviceContext, userId: user.id };

        await requireInstallationTrigger(scope, params.installation_id, params.trigger_id);

        return deleteRecipeTrigger(scope, params.trigger_id);
      },
    })
    .action("rotate", {
      auth: true,
      summary: "Rotate a webhook trigger's URL",
      paramSchema: triggerParamsSchema,
      handler: async ({ params, serviceContext, user }) => {
        const scope = { context: serviceContext, userId: user.id };

        await requireInstallationTrigger(scope, params.installation_id, params.trigger_id);

        return rotateRecipeTrigger(scope, params.trigger_id);
      },
    });
});

export default app;

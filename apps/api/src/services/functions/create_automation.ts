import {
  AUTOMATION_CREATE_TOOL_NAME,
  describeCronExpression,
  type CreateAutomationInput,
} from "@ngriffin_uk/polychat-schemas";

import { installAssistantRecipe } from "~/services/apps/recipes";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";

import { create_automation as createAutomationDescriptor } from "./definitions/create_automation";

export const create_automation: ApiToolDefinition = {
  ...createAutomationDescriptor,
  execute: async (args: CreateAutomationInput, toolContext) => {
    const request = toolContext.request;
    const context = request.context;
    const userId = request.user?.id;

    if (!context || !userId) {
      throw new AssistantError(
        "Setting up an automation needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    if (args.notificationChannel && !args.notificationTarget) {
      throw new AssistantError(
        "Say where the result should go, or leave the channel out",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const installed = await installAssistantRecipe(args.recipeId, {
      context,
      userId,
      channel: "web",
      ...(args.projectId ? { projectId: args.projectId } : {}),
      triggers: [
        {
          type: "schedule",
          enabled: true,
          cronExpression: args.cronExpression,
          prompt: args.prompt,
          ...(args.notificationChannel ? { notificationChannel: args.notificationChannel } : {}),
          ...(args.notificationTarget ? { notificationTarget: args.notificationTarget } : {}),
        },
      ],
    });

    if (!installed) {
      throw new AssistantError(
        `There is no recipe called ${args.recipeId}`,
        ErrorType.NOT_FOUND,
        404,
      );
    }

    const schedule = describeCronExpression(args.cronExpression);
    const blocked = installed.readyToRun
      ? ""
      : " It cannot run yet: connect the services it needs first.";

    return {
      status: "success",
      name: AUTOMATION_CREATE_TOOL_NAME,
      content: `Set up ${installed.recipe.title} to run ${schedule}.${blocked} You can pause or change it in Teammates and tools.`,
      data: {
        recipeId: installed.recipe.id,
        installationId: installed.installation?.id,
        schedule,
        readyToRun: installed.readyToRun,
      },
    } satisfies IFunctionResponse;
  },
};

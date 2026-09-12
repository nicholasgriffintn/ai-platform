import {
  recipeExecutionTaskDataSchema,
  type TeammateInvocation,
} from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/lib/context/serviceContext";
import { invokeAssistantRecipe, parseRecipeInstallationRecord } from "~/services/apps/recipes";
import {
  executeRecipeInvocationChat,
  recordRecipeInvocationFailure,
} from "~/services/apps/recipes/execution";
import {
  deliverRecipeOccurrenceToTeammateHome,
  ensureRecipeOccurrenceConversation,
} from "~/services/apps/recipes/occurrences";
import { deliverRecipeSmsNotification } from "~/services/apps/recipes/sms-notification";
import { isRunWaitingForDelegations } from "~/services/delegations/wait-policy";
import { prepareTeammateRun } from "~/services/teammates/execution";
import { reconcileTeammateRun } from "~/services/teammates/run-reconciliation";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";
import { extractChatCompletionNotification } from "~/utils/messages";

import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

const logger = getLogger({ prefix: "services/tasks/handlers/RecipeExecutionHandler" });

function getRecipeExecutionConversationId(taskId: string): string {
  return `recipe_${taskId}`;
}

export class RecipeExecutionHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const parsedData = recipeExecutionTaskDataSchema.safeParse(message.task_data);

    if (!message.user_id || !parsedData.success) {
      return {
        status: "error",
        message: "Recipe execution task data is invalid",
      };
    }

    const data = parsedData.data;

    const baseContext = createServiceContext({ env });
    const user = await baseContext.repositories.users.getUserById(message.user_id);

    if (!user) {
      return {
        status: "error",
        message: `User ${message.user_id} not found for recipe execution`,
      };
    }

    const context = createServiceContext({ env, user: user });
    const invocation = await invokeAssistantRecipe(data.recipeId, {
      context,
      userId: message.user_id,
      channel: data.channel ?? "scheduled",
      input: data.input,
      configuration: data.configuration,
      projectId: data.projectId ?? undefined,
      installationId: data.installationId,
      requireInstalled: true,
    });

    if (!invocation) {
      return {
        status: "error",
        message: `Recipe ${data.recipeId} not found`,
      };
    }

    if (invocation.status === "blocked") {
      return {
        status: "skipped",
        message: "Recipe execution blocked by missing connectors",
        data: invocation,
      };
    }

    if (invocation.status === "not_installed") {
      return {
        status: "skipped",
        message: "Recipe execution skipped because the recipe is not installed",
        data: invocation,
      };
    }

    if (invocation.status === "paused") {
      return {
        status: "skipped",
        message: "Recipe execution skipped because the routine is paused",
        data: invocation,
      };
    }

    const conversationId = getRecipeExecutionConversationId(message.taskId);
    let execution: Awaited<ReturnType<typeof executeRecipeInvocationChat>>;
    let teammate:
      | {
          id: string;
          invocation: {
            source: "routine";
            installationId: string;
            occurrenceId: string;
          };
        }
      | undefined;
    let teammateContext: Awaited<ReturnType<typeof prepareTeammateRun>>["resolution"]["context"] =
      null;

    if (data.installationId && data.occurrenceId) {
      const installationRecord = await context.repositories.templates.getTemplateById(
        data.installationId,
      );
      const installation = installationRecord
        ? parseRecipeInstallationRecord(installationRecord)
        : null;

      if (installation?.teammateContextId) {
        const routineInvocation: Extract<TeammateInvocation, { source: "routine" }> = {
          source: "routine",
          installationId: data.installationId,
          occurrenceId: data.occurrenceId,
        };
        const prepared = await prepareTeammateRun({ context, invocation: routineInvocation });

        teammate = { id: prepared.teammate.id, invocation: routineInvocation };
        teammateContext = prepared.resolution.context;
      }
    }

    if (teammateContext) {
      await ensureRecipeOccurrenceConversation({
        context,
        user,
        conversationId,
        title: `Recipe: ${invocation.recipeTitle || invocation.recipeId}`,
        projectId: data.projectId ?? undefined,
      });
    }

    const occurrenceCommandId = data.occurrenceId
      ? `recipe_occurrence_${data.occurrenceId}`
      : undefined;

    try {
      execution = await executeRecipeInvocationChat({
        env,
        context,
        user: user,
        invocation,
        conversationId,
        projectId: data.projectId ?? undefined,
        titleConversation: true,
        commandId: occurrenceCommandId,
        teammate,
      });
    } catch (error) {
      const response = await recordRecipeInvocationFailure({
        env,
        context,
        user: user,
        invocation,
        conversationId,
        projectId: data.projectId ?? undefined,
        error,
      });

      const acceptedRun = occurrenceCommandId
        ? await context.repositories.conversationRuns.getCommandReceipt(
            message.user_id,
            occurrenceCommandId,
          )
        : null;

      if (teammateContext && data.occurrenceId && !acceptedRun) {
        await deliverRecipeOccurrenceToTeammateHome({
          context,
          user,
          teammateContext,
          installationId: data.installationId,
          occurrenceId: data.occurrenceId,
          conversationId,
          recipeTitle: invocation.recipeTitle || invocation.recipeId,
          failure: response,
        });
      }

      return {
        status: "error",
        message: "Recipe execution failed and was recorded",
        data: {
          ...invocation,
          conversationId,
          response,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }

    const executionRunReceipt = execution.response.run?.run;
    const executionRun = executionRunReceipt
      ? await context.repositories.conversationRuns.getById(executionRunReceipt.id)
      : null;

    if (teammate && executionRun) {
      await reconcileTeammateRun(context, executionRun);
    }

    const runStatus = executionRun?.status ?? executionRunReceipt?.status;
    const waitingForUser =
      runStatus === "awaiting_input" ||
      runStatus === "awaiting_approval" ||
      runStatus === "awaiting_takeover";
    const completedRunId = executionRun?.id ?? executionRunReceipt?.id;
    let waitingForDelegations = false;

    if (teammateContext && runStatus === "succeeded" && completedRunId) {
      waitingForDelegations = await isRunWaitingForDelegations(context, completedRunId);
    }

    const waitingForRun =
      waitingForUser ||
      waitingForDelegations ||
      runStatus === "accepted" ||
      runStatus === "running" ||
      runStatus === "cancelling";

    if (runStatus === "failed" || runStatus === "cancelled" || runStatus === "interrupted") {
      return {
        status: "error",
        message: `Recipe occurrence ended with ${runStatus}`,
        data: {
          ...invocation,
          conversationId: execution.conversationId,
          response: execution.response,
          occurrenceStatus: runStatus,
        },
      };
    }

    let notificationDelivery:
      | { channel: "sms"; status: "sent" }
      | { channel: "sms"; status: "failed"; error: string }
      | undefined;

    if (
      !teammate &&
      !waitingForRun &&
      data.notificationChannel === "sms" &&
      data.notificationTarget?.trim()
    ) {
      const notification = extractChatCompletionNotification(execution.response, {
        fallback: "Recipe execution completed.",
      });

      try {
        await deliverRecipeSmsNotification({
          env,
          context,
          user,
          userId: message.user_id,
          taskId: message.taskId,
          taskData: data,
          notification,
        });
        notificationDelivery = { channel: "sms", status: "sent" };
      } catch (error) {
        const messageText =
          error instanceof Error ? error.message : "Scheduled recipe SMS notification failed";

        logger.warn("Scheduled recipe SMS notification failed", {
          recipeId: data.recipeId,
          userId: message.user_id,
          error: messageText,
        });
        notificationDelivery = {
          channel: "sms",
          status: "failed",
          error: messageText,
        };
      }
    }

    return {
      status: waitingForRun ? "suspended" : "success",
      message: waitingForUser
        ? "Recipe occurrence is waiting for user action"
        : waitingForDelegations
          ? "Recipe occurrence is waiting for delegated work"
          : waitingForRun
            ? "Recipe occurrence is still running"
            : "Recipe execution completed",
      data: {
        ...invocation,
        conversationId: execution.conversationId,
        response: execution.response,
        ...(runStatus ? { occurrenceStatus: runStatus } : {}),
        ...(notificationDelivery ? { notificationDelivery } : {}),
      },
    };
  }
}

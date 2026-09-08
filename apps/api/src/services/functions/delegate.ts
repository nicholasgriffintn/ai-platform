import {
  DELEGATION_RUN_TASK_TYPE,
  isMetaToolName,
  readToolIds,
  resolveDelegationCreditCeiling,
} from "@ngriffin_uk/polychat-schemas";

import { findModelConfig } from "~/lib/providers/models";
import { userCreditActor } from "~/lib/usage/creditActor";
import { readCreditPosition } from "~/lib/usage/credits";
import { checkDelegationSpawn } from "~/services/delegations/guards";
import { resolveDelegationExecutionRoute } from "~/services/delegations/routing";
import { TaskService } from "~/services/tasks/TaskService";
import { requireTeammateAccess } from "~/services/teammates/access";
import { hireTeammate } from "~/services/teammates/hire";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { intersectEnabledTools } from "~/utils/enabledTools";
import { AssistantError, ErrorType, getErrorMessage } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { delegate as delegateDescriptor, type DelegateInput } from "./definitions/delegate";

export const delegate: ApiToolDefinition = {
  ...delegateDescriptor,
  execute: async (args: DelegateInput, toolContext): Promise<IFunctionResponse> => {
    const request = toolContext.request;
    const context = request.context;
    const user = request.user;
    const parentConversationId = request.request?.completion_id;

    if (!context || !user?.id) {
      throw new AssistantError(
        "Delegation needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    if (!parentConversationId) {
      return { status: "error", name: "delegate", content: "Temporary chats cannot delegate." };
    }

    const parent = await context.repositories.conversations.getConversation(parentConversationId);

    if (
      !parent ||
      !(await context.repositories.workspaces.canAccessConversation(parentConversationId, user.id))
    ) {
      return {
        status: "error",
        name: "delegate",
        content: "This conversation is not durable enough to delegate.",
      };
    }

    const guard = await checkDelegationSpawn(toolContext);

    if (!guard.allowed) {
      return { status: "error", name: "delegate", content: guard.reason ?? "Delegation refused." };
    }

    const teammate = args.teammate_id
      ? await requireTeammateAccess(context, args.teammate_id, "read", user.id)
      : await hireTeammate(
          context,
          {
            role_slug: args.teammate?.role_slug,
            job_description: args.teammate?.job_description,
            name: args.teammate?.name,
            kind: "bot",
          },
          user,
        );
    const teammateModel = teammate.model
      ? await findModelConfig(teammate.model, context.env, undefined, user.id)
      : undefined;

    if (teammate.model && !teammateModel) {
      return {
        status: "error",
        name: "delegate",
        content: "The teammate's selected model is unavailable for delegation.",
      };
    }

    if (resolveDelegationExecutionRoute(teammateModel) === "machine") {
      return {
        status: "error",
        name: "delegate",
        content:
          "Use the chat model selector to run this provider. Background delegation is not supported for device providers.",
      };
    }

    if (teammateModel?.agent && !teammateModel.agent.capabilities.runsUnattended) {
      return {
        status: "error",
        name: "delegate",
        content: "This provider cannot run unattended.",
      };
    }

    if (
      teammateModel?.agent?.capabilities.picksOwnModel &&
      args.budget?.max_credit_micros !== undefined &&
      args.budget.deadline === undefined
    ) {
      return {
        status: "error",
        name: "delegate",
        content: "This provider requires a deadline budget rather than a credit-only budget.",
      };
    }

    if (
      teammateModel?.agent?.capabilities.writesFiles &&
      (request.request?.mode ?? request.mode) === "chat" &&
      !request.request?.approved_tools?.includes("delegate")
    ) {
      const reason = "This delegate can write files and needs your approval before it starts.";

      return {
        status: "pending",
        name: "delegate",
        content: reason,
        data: {
          renderer: "approval_request",
          message: reason,
          options: ["Approve", "Reject"],
          approvalRequired: true,
          approval: {
            toolName: "delegate",
            toolCallId: toolContext.toolCallId,
            interactionId: toolContext.toolCallId,
            reason,
          },
          humanInTheLoop: {
            type: "approval",
            status: "pending",
            interactionId: toolContext.toolCallId,
            toolName: "delegate",
            requires_user_action: true,
          },
        },
      };
    }

    const parentTools = (request.request?.enabled_tools ?? []).filter(
      (tool) => !isMetaToolName(tool),
    );
    const enabledTools = intersectEnabledTools(parentTools, readToolIds(teammate.enabled_tools));
    const delegationId = `delegation_${generateId()}`;
    const childConversationId = `delegate_${delegationId}`;
    const projectId = typeof parent.project_id === "string" ? parent.project_id : null;
    const deadline =
      args.budget?.deadline ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const position = await readCreditPosition({
      repositories: context.repositories,
      actor: userCreditActor(user.id),
      planId: user.plan_id,
    });
    const remainingCreditMicros =
      position.includedCreditMicros +
      position.graceCreditMicros -
      position.spentCreditMicros -
      position.reservedCreditMicros;
    const ceilingCreditMicros = resolveDelegationCreditCeiling(remainingCreditMicros);

    if (position.enforced && ceilingCreditMicros <= 0) {
      return {
        status: "error",
        name: "delegate",
        content: "There is not enough remaining credit to give a delegate its own budget.",
      };
    }

    const maxCreditMicros = position.enforced
      ? Math.min(args.budget?.max_credit_micros ?? ceilingCreditMicros, ceilingCreditMicros)
      : (args.budget?.max_credit_micros ?? ceilingCreditMicros);

    await context.repositories.conversations.createConversation(
      childConversationId,
      user.id,
      `Delegate: ${teammate.name ?? "Teammate"}`,
      {
        type: "delegate",
        parent_conversation_id: parentConversationId,
        parent_message_id: toolContext.toolCallId,
        ...(projectId ? { project_id: projectId } : {}),
      },
    );
    const delegation = await context.repositories.delegations
      .createDelegation({
        id: delegationId,
        parentConversationId,
        childConversationId,
        parentRunId: request.request?.run_id ?? toolContext.completionId,
        depth: guard.depth + 1,
        teammateId: teammate.id,
        goal: args.goal,
        waitFor: args.wait_for,
        budget: {
          maxCreditMicros,
          maxSteps: args.budget?.max_steps ?? 20,
          deadline,
        },
      })
      .catch(async (error: unknown) => {
        await context.repositories.conversations.deleteConversation(childConversationId);
        throw error;
      });

    try {
      await context.repositories.conversationHandles.createSpawnHandle({
        id: `handle_${delegationId}`,
        conversationId: parentConversationId,
        delegationId,
        grantedAt: new Date().toISOString(),
        expiresAt: deadline,
      });

      await new TaskService(context.env, context.repositories.tasks).enqueueTask({
        id: `delegation_task_${delegationId}`,
        task_type: DELEGATION_RUN_TASK_TYPE,
        user_id: user.id,
        project_id: projectId ?? undefined,
        priority: 4,
        task_data: { delegationId, projectId, enabledTools },
      });
    } catch (error) {
      const summary = getErrorMessage(error, "The delegate could not be started.");

      await context.repositories.delegations.updateState(delegationId, "failed", {
        summary: summary.slice(0, 2000),
        outputIds: [],
      });
      throw error;
    }

    return {
      status: "success",
      name: "delegate",
      content: `Delegated the work to ${teammate.name ?? "a teammate"}. It will report back when it settles.`,
      data: {
        delegationId,
        childConversationId,
        teammateId: teammate.id,
        delegations: [delegation],
      },
    };
  },
};

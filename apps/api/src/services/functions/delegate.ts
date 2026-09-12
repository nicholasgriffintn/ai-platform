import {
  DELEGATION_DEFAULT_MAX_CREDIT_MICROS,
  DELEGATION_RUN_TASK_TYPE,
  isLiveDelegationState,
  isMetaToolName,
  permissionModeSchema,
  readToolIds,
  resolveDelegationCreditCeiling,
} from "@ngriffin_uk/polychat-schemas";

import { findModelConfig } from "~/lib/providers/models";
import { userCreditActor } from "~/lib/usage/creditActor";
import { readCreditPosition } from "~/lib/usage/credits";
import { checkDelegationSpawn } from "~/services/delegations/guards";
import { resolveDelegationMemoryBindings } from "~/services/delegations/memory-bindings";
import {
  canRunDelegationOnMachine,
  resolveDelegationExecutionRoute,
} from "~/services/delegations/routing";
import { scheduleDelegationExpiry } from "~/services/delegations/schedule-expiry";
import { transitionDelegation } from "~/services/delegations/settle";
import { requireDelegationGroupWaitPolicy } from "~/services/delegations/wait-policy";
import { copyConversationBrief, ensureConversationBrief } from "~/services/memory-documents";
import { TaskService } from "~/services/tasks/TaskService";
import { requireProjectTeammate, requireTeammateAccess } from "~/services/teammates/access";
import { hireTeammate } from "~/services/teammates/hire";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { conversationHandleIdForDelegation } from "~/utils/conversation-handles";
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

    const parentRunId = request.request?.run_id ?? toolContext.completionId;

    await requireDelegationGroupWaitPolicy(context, parentRunId, args.wait_for);

    const parentProjectId = typeof parent.project_id === "string" ? parent.project_id : null;
    const teammate = args.teammate_id
      ? parentProjectId
        ? await requireProjectTeammate(context, parentProjectId, args.teammate_id)
        : await requireTeammateAccess(context, args.teammate_id, "read", user.id)
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

    if (parentProjectId && !args.teammate_id) {
      await requireProjectTeammate(context, parentProjectId, teammate.id);
    }

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

    const requestedChildConversationId = args.child_conversation_id;
    const selectedChild = requestedChildConversationId
      ? await context.repositories.conversations.getConversation(requestedChildConversationId)
      : null;
    const predecessor = requestedChildConversationId
      ? await context.repositories.delegations.getByChildConversationId(
          requestedChildConversationId,
        )
      : null;
    const selectedBriefDocumentId =
      typeof selectedChild?.brief_document_id === "string" ? selectedChild.brief_document_id : null;

    if (requestedChildConversationId) {
      const selectedProjectId =
        typeof selectedChild?.project_id === "string" ? selectedChild.project_id : null;

      if (
        !selectedChild ||
        selectedChild.user_id !== user.id ||
        !predecessor ||
        isLiveDelegationState(predecessor.state) ||
        predecessor.teammateId !== teammate.id ||
        selectedProjectId !== parentProjectId ||
        !(await context.repositories.workspaces.canAccessConversation(
          requestedChildConversationId,
          user.id,
        ))
      ) {
        return {
          status: "error",
          name: "delegate",
          content: "That teammate conversation cannot be continued from this scope.",
        };
      }
    }

    const parentTools = (request.request?.enabled_tools ?? []).filter(
      (tool) => !isMetaToolName(tool),
    );
    const enabledTools = intersectEnabledTools(parentTools, readToolIds(teammate.enabled_tools));
    const delegationId = `delegation_${generateId()}`;
    const continuationMode = requestedChildConversationId
      ? (args.continuation_mode ?? "resume")
      : "new";

    if (
      resolveDelegationExecutionRoute(teammateModel) === "machine" &&
      !canRunDelegationOnMachine(teammateModel)
    ) {
      return {
        status: "error",
        name: "delegate",
        content: "This device provider cannot run unattended with a durable session.",
      };
    }

    const childConversationId =
      selectedChild && requestedChildConversationId && continuationMode === "resume"
        ? requestedChildConversationId
        : `delegate_${delegationId}`;
    const projectId = typeof parent.project_id === "string" ? parent.project_id : null;
    const parentBriefDocumentId =
      typeof parent.brief_document_id === "string" ? parent.brief_document_id : null;
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
      : Math.min(
          args.budget?.max_credit_micros ?? DELEGATION_DEFAULT_MAX_CREDIT_MICROS,
          DELEGATION_DEFAULT_MAX_CREDIT_MICROS,
        );

    const createsChildConversation = !selectedChild || continuationMode === "fresh";
    const childPermissionMode = permissionModeSchema.parse(
      selectedChild?.permission_mode ?? parent.permission_mode,
    );

    let childBriefDocumentId = selectedBriefDocumentId;
    let delegation;

    try {
      if (createsChildConversation) {
        await context.repositories.conversations.createConversation(
          childConversationId,
          user.id,
          `Delegate: ${teammate.name ?? "Teammate"}`,
          {
            type: "delegate",
            parent_conversation_id: parentConversationId,
            parent_message_id: toolContext.toolCallId,
            permission_mode: childPermissionMode,
            ...(projectId ? { project_id: projectId } : {}),
          },
        );

        if (selectedBriefDocumentId && requestedChildConversationId) {
          const copied = await copyConversationBrief(
            context,
            requestedChildConversationId,
            childConversationId,
          );

          childBriefDocumentId = copied.document?.id ?? null;
        }
      }

      if (!childBriefDocumentId) {
        const childBrief = await ensureConversationBrief(context, childConversationId);

        childBriefDocumentId = childBrief.document?.id ?? null;
      }

      if (!childBriefDocumentId) {
        throw new AssistantError(
          "The delegate conversation could not be assigned a working brief",
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }

      const memoryBindings = await resolveDelegationMemoryBindings({
        context,
        userId: user.id,
        projectId,
        requested: args.memory_bindings?.map((binding) => ({
          documentId: binding.document_id,
          access: binding.access,
        })),
        ...(request.memoryScope?.type === "bound"
          ? { allowed: request.memoryScope.documents }
          : {}),
        required: [
          ...(parentBriefDocumentId
            ? [{ documentId: parentBriefDocumentId, access: "read" as const }]
            : []),
          { documentId: childBriefDocumentId, access: "read-write" },
        ],
      });

      delegation = await context.repositories.delegations.createDelegation({
        id: delegationId,
        parentConversationId,
        childConversationId,
        parentRunId,
        depth: guard.depth + 1,
        teammateId: teammate.id,
        goal: args.goal,
        waitFor: args.wait_for,
        budget: {
          maxCreditMicros,
          maxSteps: args.budget?.max_steps ?? 20,
          deadline,
        },
        memoryBindings,
        predecessorDelegationId: predecessor?.id ?? null,
        continuationMode,
      });
    } catch (error) {
      if (createsChildConversation) {
        await Promise.allSettled([
          context.repositories.conversations.deleteConversation(childConversationId),
          ...(childBriefDocumentId && childBriefDocumentId !== selectedBriefDocumentId
            ? [context.repositories.memoryDocuments.softDeleteDocument(childBriefDocumentId)]
            : []),
        ]);
      }

      throw error;
    }

    try {
      await context.repositories.conversationHandles.createSpawnHandle({
        id: conversationHandleIdForDelegation(delegationId),
        conversationId: parentConversationId,
        delegationId,
        grantedAt: new Date().toISOString(),
        expiresAt: deadline,
      });

      const tasks = new TaskService(context.env, context.repositories.tasks);

      await scheduleDelegationExpiry(tasks, delegation, user.id);
      await tasks.enqueueTask({
        id: `delegation_task_${delegationId}`,
        task_type: DELEGATION_RUN_TASK_TYPE,
        user_id: user.id,
        project_id: projectId ?? undefined,
        priority: 4,
        task_data: { delegationId, projectId, enabledTools },
      });
    } catch (error) {
      const summary = getErrorMessage(error, "The delegate could not be started.");

      await transitionDelegation(
        context,
        delegationId,
        "failed",
        {
          summary: summary.slice(0, 2000),
          outputIds: [],
        },
        user.id,
      );

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

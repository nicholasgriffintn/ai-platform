import {
  createChatCompletionsJsonSchema,
  DELEGATION_EXPIRY_TASK_TYPE,
  DELEGATION_WAKE_TASK_TYPE,
  delegationRunTaskDataSchema,
  projectCodingEnvironmentSchema,
  resolveSandboxDeliveryPolicy,
  sandboxDeliveryPolicyCreatesCommit,
  type SandboxRequestOptions,
} from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/lib/context/serviceContext";
import { findModelConfig } from "~/lib/providers/models";
import { createHandoff } from "~/services/handoffs";
import { notifyMobileWork } from "~/services/mobile-push";
import { isTaskNotificationPreferenceEnabled } from "~/services/notifications/preferences";
import { TaskService } from "~/services/tasks/TaskService";
import { createTeammateCompletion } from "~/services/teammates/createTeammateCompletion";
import { requireProjectAccess } from "~/services/workspaces/access";
import { resolveProjectTools } from "~/services/workspaces/projectTools";
import type { IEnv } from "~/types";
import { intersectEnabledTools } from "~/utils/enabledTools";
import { safeParseJson } from "~/utils/json";

import type { TaskMessage } from "../tasks/TaskService";
import { resolveDelegationExecutionRoute } from "./routing";

export async function runDelegationTask(message: TaskMessage, env: IEnv) {
  const payload = delegationRunTaskDataSchema.parse(message.task_data);
  const context = createServiceContext({ env });
  const delegation = await context.repositories.delegations.claimDelegation(payload.delegationId);

  if (!delegation) {
    return { status: "skipped" as const, detail: "Delegation is already running or settled" };
  }

  if (Date.parse(delegation.budget.deadline) <= Date.now()) {
    await context.repositories.delegations.updateState(delegation.id, "expired", {
      summary: "The delegation deadline passed before it started.",
      outputIds: [],
    });
    await enqueueDelegationWake(context, delegation, message.user_id);

    return { status: "skipped" as const, detail: "Delegation expired before it started" };
  }

  const user = await context.repositories.users.getUserById(message.user_id ?? 0);

  if (!user) {
    await context.repositories.delegations.updateState(delegation.id, "failed", {
      summary: "The delegating user no longer exists.",
      outputIds: [],
    });
    await enqueueDelegationWake(context, delegation, message.user_id);

    return { status: "error" as const, detail: "Delegating user not found" };
  }

  const parentConversation = await context.repositories.conversations.getConversation(
    delegation.parentConversationId,
  );
  const parentProjectId =
    typeof parentConversation?.project_id === "string" ? parentConversation.project_id : null;

  if (!parentConversation || parentProjectId !== (payload.projectId ?? null)) {
    await settleDelegation(
      context,
      delegation,
      message.user_id,
      "The delegation scope changed before it started.",
    );

    return { status: "error" as const, detail: "Delegation project scope changed" };
  }

  if (payload.projectId) {
    await requireProjectAccess(createServiceContext({ env, user }), payload.projectId);
  }

  const enabledTools = payload.projectId
    ? intersectEnabledTools(
        resolveProjectTools(
          await context.repositories.workspaces.listProjectCapabilities(payload.projectId),
        ).enabledTools,
        payload.enabledTools,
      )
    : payload.enabledTools;

  const teammate = await context.repositories.teammates.getTeammateById(delegation.teammateId);
  const teammateModel = teammate?.model
    ? await findModelConfig(teammate.model, env, undefined, user.id)
    : null;
  const machineSelection = teammate?.model?.match(/^machine:([^:]+):(.+)$/);
  const resolvedModel =
    teammateModel ??
    (machineSelection
      ? {
          provider: "machine",
          runsOn: "device" as const,
          machineId: machineSelection[1],
          matchingModel: machineSelection[2],
        }
      : null);
  const executionRoute = resolveDelegationExecutionRoute(resolvedModel);

  if (executionRoute === "machine") {
    const machineId = resolvedModel?.machineId;
    if (!machineId) {
      await settleDelegation(
        context,
        delegation,
        message.user_id,
        "The machine target is missing.",
      );

      return { status: "error" as const, detail: "Machine target is missing" };
    }

    try {
      await createHandoff(createServiceContext({ env, user }), {
        conversationId: delegation.childConversationId,
        machineId,
        requested: {
          computeSite: "machine",
          ...(teammate?.model ? { modelId: teammate.model } : {}),
        },
        draft: { text: delegation.goal, attachmentIds: [] },
      });
      await context.repositories.delegations.updateState(delegation.id, "awaiting_input");

      return { status: "success" as const, detail: "Machine handoff queued." };
    } catch (error) {
      await settleDelegation(
        context,
        delegation,
        message.user_id,
        error instanceof Error ? error.message : "The machine handoff could not be created.",
      );

      return { status: "error" as const, detail: "Machine handoff could not be created" };
    }
  }
  let sandboxOptions: SandboxRequestOptions | undefined;

  if (executionRoute === "sandbox") {
    const project = payload.projectId
      ? await context.repositories.workspaces.getProject(payload.projectId)
      : null;
    const codingEnvironment = project
      ? projectCodingEnvironmentSchema.safeParse({
          installationId: project.coding_installation_id,
          repository: project.coding_repository,
          promptStrategy: project.coding_prompt_strategy,
          deliveryPolicy: resolveSandboxDeliveryPolicy(
            project.coding_delivery_policy ? safeParseJson(project.coding_delivery_policy) : null,
            Boolean(project.coding_should_commit),
          ),
          environmentSetup: project.coding_environment_setup
            ? safeParseJson(project.coding_environment_setup)
            : undefined,
          timeoutSeconds: project.coding_timeout_seconds,
          inspectionWindowSeconds: project.coding_inspection_window_seconds,
        })
      : null;

    if (!codingEnvironment?.success) {
      await settleDelegation(
        context,
        delegation,
        message.user_id,
        "The sandbox provider needs a connected project repository.",
      );

      return { status: "error" as const, detail: "Sandbox repository is not configured" };
    }

    sandboxOptions = {
      enabled: true,
      installationId: codingEnvironment.data.installationId,
      repo: codingEnvironment.data.repository,
      deliveryPolicy: codingEnvironment.data.deliveryPolicy,
      shouldCommit: sandboxDeliveryPolicyCreatesCommit(codingEnvironment.data.deliveryPolicy),
      promptStrategy: codingEnvironment.data.promptStrategy,
      environmentSetup: codingEnvironment.data.environmentSetup,
      timeoutSeconds: codingEnvironment.data.timeoutSeconds,
      inspectionWindowSeconds: codingEnvironment.data.inspectionWindowSeconds,
    };
  }

  const body = createChatCompletionsJsonSchema.parse({
    completion_id: delegation.childConversationId,
    command_id: `delegation_run_${delegation.id}`,
    messages: [{ role: "user", content: delegation.goal }],
    stream: false,
    store: true,
    enabled_tools: enabledTools,
    delegation_context: {
      delegationId: delegation.id,
      depth: delegation.depth,
      rootConversationId: delegation.parentConversationId,
    },
    ...(payload.projectId ? { metadata: { project_id: payload.projectId } } : {}),
    ...(sandboxOptions ? { options: { sandbox: sandboxOptions } } : {}),
  });

  try {
    const response = await createTeammateCompletion({
      env,
      context: createServiceContext({ env, user }),
      body,
      teammateId: delegation.teammateId,
      user,
      anonymousUser: undefined,
      conversationType: "delegate",
      trigger: "delegation",
      maxStepsOverride: delegation.budget.maxSteps,
      durableExecution: {
        kind: "delegation",
        maxCreditMicros: delegation.budget.maxCreditMicros,
      },
    });

    if (!(response instanceof Response)) {
      const firstPendingTool = response.choices.find(
        (choice) => choice.message.status === "pending",
      )?.message;
      if (firstPendingTool) {
        const waitingState =
          firstPendingTool.name === "ask_user" ? "awaiting_input" : "awaiting_approval";
        await context.repositories.delegations.updateState(delegation.id, waitingState);
        await notifyDelegationAttention(context, delegation, message.user_id, waitingState).catch(
          () => undefined,
        );
        await new TaskService(context.env, context.repositories.tasks).enqueueTask({
          id: `delegation_expiry_${delegation.id}`,
          task_type: DELEGATION_EXPIRY_TASK_TYPE,
          user_id: message.user_id,
          priority: 4,
          scheduled_at: delegation.budget.deadline,
          task_data: { delegationId: delegation.id },
        });

        return {
          status: "success" as const,
          detail: `Delegate is ${waitingState.replace("awaiting_", "awaiting ")}.`,
        };
      }
    }

    const summary =
      response instanceof Response ? "Delegate run accepted." : "Delegate run completed.";

    await context.repositories.delegations.updateState(delegation.id, "done", {
      summary,
      outputIds: [],
    });
    await enqueueDelegationWake(context, delegation, message.user_id);

    return { status: "success" as const, detail: summary };
  } catch (error) {
    const summary = error instanceof Error ? error.message : "Delegate run failed.";

    await context.repositories.delegations.updateState(delegation.id, "failed", {
      summary: summary.slice(0, 2000),
      outputIds: [],
    });
    await enqueueDelegationWake(context, delegation, message.user_id);

    return { status: "error" as const, detail: summary };
  }
}

async function notifyDelegationAttention(
  context: ReturnType<typeof createServiceContext>,
  delegation: Awaited<ReturnType<typeof context.repositories.delegations.getById>>,
  userId: number | null | undefined,
  state: "awaiting_input" | "awaiting_approval",
) {
  if (!delegation || !userId) {
    return;
  }

  const parent = await context.repositories.conversations.getConversation(
    delegation.parentConversationId,
  );
  const projectId = typeof parent?.project_id === "string" ? parent.project_id : null;

  if (!projectId) {
    return;
  }

  const project = await context.repositories.workspaces.getProject(projectId);
  const preferences = await context.repositories.taskNotifications.getPreferences(userId);
  const categoryEnabled = isTaskNotificationPreferenceEnabled(preferences, "decisions");

  if (!project || !categoryEnabled) {
    return;
  }

  const membership = await context.repositories.workspaces.getMembership(
    project.workspace_id,
    userId,
  );

  if (!membership) {
    return;
  }

  await notifyMobileWork({
    context,
    userId,
    notificationId: `delegation:${delegation.id}:${state}`,
    kind: state === "awaiting_approval" ? "approval" : "input",
    target: {
      workspaceId: project.workspace_id,
      projectId,
      conversationId: delegation.parentConversationId,
      taskId: null,
      runId: delegation.childConversationId,
      interactionId: null,
    },
  });
}

async function settleDelegation(
  context: ReturnType<typeof createServiceContext>,
  delegation: { id: string; parentConversationId: string; parentRunId: string },
  userId: number | undefined,
  summary: string,
) {
  await context.repositories.delegations.updateState(delegation.id, "failed", {
    summary,
    outputIds: [],
  });
  await enqueueDelegationWake(context, delegation, userId);
}

async function enqueueDelegationWake(
  context: ReturnType<typeof createServiceContext>,
  delegation: { id: string; parentConversationId: string; parentRunId: string },
  userId: number | undefined,
) {
  if (userId === undefined) {
    return;
  }

  await new TaskService(context.env, context.repositories.tasks).enqueueTask({
    id: `delegation_wake_${delegation.parentRunId}`,
    task_type: DELEGATION_WAKE_TASK_TYPE,
    user_id: userId,
    priority: 4,
    task_data: {
      parentConversationId: delegation.parentConversationId,
      parentRunId: delegation.parentRunId,
    },
  });
}

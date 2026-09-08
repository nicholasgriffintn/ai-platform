import {
  createChatCompletionsJsonSchema,
  DELEGATION_EXPIRY_TASK_TYPE,
  delegationRunTaskDataSchema,
  projectCodingEnvironmentSchema,
  resolveSandboxDeliveryPolicy,
  sandboxDeliveryPolicyCreatesCommit,
  SANDBOX_TIMEOUT_MIN_SECONDS,
  type SandboxRequestOptions,
} from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/lib/context/serviceContext";
import { findModelConfig } from "~/lib/providers/models";
import { notifyMobileWork } from "~/services/mobile-push";
import { isTaskNotificationPreferenceEnabled } from "~/services/notifications/preferences";
import { TaskService } from "~/services/tasks/TaskService";
import { createTeammateCompletion } from "~/services/teammates/createTeammateCompletion";
import { requireProjectAccess } from "~/services/workspaces/access";
import { resolveProjectTools } from "~/services/workspaces/projectTools";
import type { IEnv } from "~/types";
import { intersectEnabledTools } from "~/utils/enabledTools";
import { safeParseJson } from "~/utils/json";
import { extractTextFromMessageContent } from "~/utils/messages";

import type { TaskMessage } from "../tasks/TaskService";
import { resolveDelegationExecutionRoute } from "./routing";
import { scheduleDelegationWake } from "./schedule-wake";

export async function runDelegationTask(message: TaskMessage, env: IEnv) {
  const payload = delegationRunTaskDataSchema.parse(message.task_data);
  const context = createServiceContext({ env });
  const delegation = await context.repositories.delegations.claimDelegation(payload.delegationId);

  if (!delegation) {
    return { status: "skipped" as const, detail: "Delegation is already running or settled" };
  }

  try {
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

    if (
      !parentConversation ||
      parentProjectId !== (payload.projectId ?? null) ||
      !(await context.repositories.workspaces.canAccessConversation(
        delegation.parentConversationId,
        user.id,
      ))
    ) {
      await settleDelegation(
        context,
        delegation,
        message.user_id,
        "The delegation scope changed before it started.",
      );

      return { status: "error" as const, detail: "Delegation project scope changed" };
    }

    if (payload.projectId) {
      try {
        await requireProjectAccess(createServiceContext({ env, user }), payload.projectId);
      } catch {
        await settleDelegation(
          context,
          delegation,
          message.user_id,
          "The delegating user lost access to this project before it started.",
        );

        return { status: "error" as const, detail: "Delegation project access refused" };
      }
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

    if (teammate?.model && !teammateModel) {
      const reason = "The teammate's selected model is unavailable for delegation.";

      await settleDelegation(context, delegation, message.user_id, reason);

      return { status: "error" as const, detail: reason };
    }

    const resolvedModel = teammateModel;
    const executionRoute = resolveDelegationExecutionRoute(resolvedModel);

    if (
      resolvedModel?.readiness &&
      (resolvedModel.readiness.state !== "ready" ||
        Date.parse(resolvedModel.readiness.expiresAt) <= Date.now())
    ) {
      const reason = resolvedModel.readiness.reason || "The selected provider is not ready.";

      await settleDelegation(context, delegation, message.user_id, reason);

      return { status: "error" as const, detail: reason };
    }

    if (executionRoute === "machine") {
      const reason =
        "Use the chat model selector to run this provider. Background delegation is not supported for device providers.";

      await settleDelegation(context, delegation, message.user_id, reason);

      return { status: "error" as const, detail: reason };
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

      const remainingSeconds = Math.floor(
        (Date.parse(delegation.budget.deadline) - Date.now()) / 1000,
      );

      if (remainingSeconds < SANDBOX_TIMEOUT_MIN_SECONDS) {
        throw new Error("The delegation deadline is too close to start a sandbox run.");
      }

      sandboxOptions = {
        enabled: true,
        installationId: codingEnvironment.data.installationId,
        repo: codingEnvironment.data.repository,
        deliveryPolicy: codingEnvironment.data.deliveryPolicy,
        shouldCommit: sandboxDeliveryPolicyCreatesCommit(codingEnvironment.data.deliveryPolicy),
        promptStrategy: codingEnvironment.data.promptStrategy,
        environmentSetup: codingEnvironment.data.environmentSetup,
        timeoutSeconds: Math.min(codingEnvironment.data.timeoutSeconds, remainingSeconds),
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

    const response = await createTeammateCompletion({
      env,
      context: createServiceContext({ env, user }),
      body,
      teammateId: delegation.teammateId,
      user,
      anonymousUser: undefined,
      conversationType: "delegate",
      trigger: "delegation",
      signal: AbortSignal.timeout(
        Math.min(2_147_483_647, Math.max(1, Date.parse(delegation.budget.deadline) - Date.now())),
      ),
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
          schedule_type: "scheduled",
          scheduled_at: delegation.budget.deadline,
          task_data: { delegationId: delegation.id },
        });

        return {
          status: "success" as const,
          detail: `Delegate is ${waitingState.replace("awaiting_", "awaiting ")}.`,
        };
      }
    }

    if (response instanceof Response) {
      throw new Error("The delegate did not return a completed result.");
    }

    const assistantMessages = response.choices
      .map((choice) => choice.message)
      .filter((entry) => entry.role === "assistant");
    const failed = assistantMessages.some(
      (entry) => entry.status === "failed" || entry.status === "error",
    );
    const summary = assistantMessages
      .map((entry) => extractTextFromMessageContent(entry.content))
      .filter(Boolean)
      .join("\n")
      .trim()
      .slice(0, 2000);

    if (!summary) {
      throw new Error("The delegate returned no result for its parent.");
    }

    await context.repositories.delegations.updateState(delegation.id, failed ? "failed" : "done", {
      summary,
      outputIds: [],
    });
    await enqueueDelegationWake(context, delegation, message.user_id);

    return { status: failed ? ("error" as const) : ("success" as const), detail: summary };
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
  await scheduleDelegationWake(
    new TaskService(context.env, context.repositories.tasks),
    delegation,
    userId,
  );
}

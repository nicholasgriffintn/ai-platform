import {
  createChatCompletionsJsonSchema,
  delegationRunTaskDataSchema,
  projectCodingEnvironmentSchema,
  resolveSandboxDeliveryPolicy,
  sandboxDeliveryPolicyCreatesCommit,
  SANDBOX_TIMEOUT_MIN_SECONDS,
  type SandboxRequestOptions,
} from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/lib/context/serviceContext";
import { findModelConfig } from "~/lib/providers/models";
import { recoverAcceptedChatCompletionResponse } from "~/services/chat-runs/completion-recovery";
import { revalidateDelegationMemoryBindings } from "~/services/delegations/memory-bindings";
import { transitionDelegation } from "~/services/delegations/settle";
import { TaskService } from "~/services/tasks/TaskService";
import { enqueueTeammateRun } from "~/services/teammates/run-admission";
import { requireProjectAccess } from "~/services/workspaces/access";
import { resolveProjectTools } from "~/services/workspaces/projectTools";
import type { IEnv } from "~/types";
import { intersectEnabledTools } from "~/utils/enabledTools";
import { safeParseJson } from "~/utils/json";

import type { TaskResult } from "../tasks/TaskHandler";
import type { TaskMessage } from "../tasks/TaskService";
import { canRunDelegationOnMachine, resolveDelegationExecutionRoute } from "./routing";
import { scheduleDelegationWake } from "./schedule-wake";

export async function runDelegationTask(
  message: TaskMessage,
  env: IEnv,
): Promise<{ status: TaskResult["status"]; detail: string }> {
  const payload = delegationRunTaskDataSchema.parse(message.task_data);
  const context = createServiceContext({ env });
  const delegation = await context.repositories.delegations.claimDelegation(payload.delegationId);

  if (!delegation) {
    return {
      status: "skipped" as const,
      detail: "Delegation is already running or settled",
    };
  }

  try {
    if (Date.parse(delegation.budget.deadline) <= Date.now()) {
      await transitionDelegation(
        context,
        delegation.id,
        "expired",
        {
          summary: "The delegation deadline passed before it started.",
          outputIds: [],
        },
        message.user_id,
      );
      await enqueueDelegationWake(context, delegation, message.user_id);

      return {
        status: "skipped" as const,
        detail: "Delegation expired before it started",
      };
    }

    const user = await context.repositories.users.getUserById(message.user_id ?? 0);

    if (!user) {
      await transitionDelegation(
        context,
        delegation.id,
        "failed",
        {
          summary: "The delegating user no longer exists.",
          outputIds: [],
        },
        message.user_id,
      );
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

      return {
        status: "error" as const,
        detail: "Delegation project scope changed",
      };
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

        return {
          status: "error" as const,
          detail: "Delegation project access refused",
        };
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
    const memoryBindings = await revalidateDelegationMemoryBindings({
      context,
      userId: user.id,
      projectId: payload.projectId,
      bindings: delegation.memoryBindings,
    });

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
      const reason = canRunDelegationOnMachine(resolvedModel)
        ? null
        : "This device provider cannot run unattended with a durable session.";

      if (reason) {
        await settleDelegation(context, delegation, message.user_id, reason);

        return { status: "error" as const, detail: reason };
      }
    }

    let sandboxOptions: SandboxRequestOptions | undefined;

    if (executionRoute === "sandbox") {
      const project = payload.projectId
        ? await context.repositories.workspaces.getProject(payload.projectId)
        : null;
      const codingEnvironment = project
        ? projectCodingEnvironmentSchema.safeParse({
            executionProvider: project.coding_execution_provider,
            installationId: project.coding_installation_id,
            repository: project.coding_repository,
            promptStrategy: project.coding_prompt_strategy,
            deliveryPolicy: resolveSandboxDeliveryPolicy(
              project.coding_delivery_policy ? safeParseJson(project.coding_delivery_policy) : null,
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

        return {
          status: "error" as const,
          detail: "Sandbox repository is not configured",
        };
      }

      const remainingSeconds = Math.floor(
        (Date.parse(delegation.budget.deadline) - Date.now()) / 1000,
      );

      if (remainingSeconds < SANDBOX_TIMEOUT_MIN_SECONDS) {
        throw new Error("The delegation deadline is too close to start a sandbox run.");
      }

      sandboxOptions = {
        enabled: true,
        executionProvider: codingEnvironment.data.executionProvider,
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

    const commandId = `delegation_run_${delegation.id}`;
    const body = createChatCompletionsJsonSchema.parse({
      completion_id: delegation.childConversationId,
      command_id: commandId,
      messages: [{ role: "user", content: delegation.goal }],
      stream: false,
      store: true,
      enabled_tools: enabledTools,
      delegation_context: {
        delegationId: delegation.id,
        depth: delegation.depth,
        rootConversationId: delegation.parentConversationId,
        memoryBindings,
      },
      permission_mode: parentConversation.permission_mode,
      ...(payload.projectId ? { metadata: { project_id: payload.projectId } } : {}),
      ...(sandboxOptions ? { options: { sandbox: sandboxOptions } } : {}),
    });

    const response = await enqueueTeammateRun({
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
      invocation: { source: "delegation", delegationId: delegation.id },
    });

    if (response instanceof Response) {
      const recovered = await recoverAcceptedChatCompletionResponse(context, {
        userId: user.id,
        commandId,
        conversationId: delegation.childConversationId,
      });

      if (!recovered) {
        throw new Error("The delegate did not return a completed result.");
      }
    }

    const reconciled = await context.repositories.delegations.getById(delegation.id);
    const failed = Boolean(
      reconciled && ["failed", "cancelled", "expired"].includes(reconciled.state),
    );

    return {
      status: failed ? "error" : "success",
      detail:
        reconciled?.result?.summary ??
        (reconciled?.state.startsWith("awaiting_")
          ? `Delegate is ${reconciled.state.replace("awaiting_", "awaiting ")}.`
          : "Delegate result reconciliation is queued."),
    };
  } catch (error) {
    const summary = error instanceof Error ? error.message : "Delegate run failed.";

    await transitionDelegation(
      context,
      delegation.id,
      "failed",
      {
        summary: summary.slice(0, 2000),
        outputIds: [],
      },
      message.user_id,
    );
    await enqueueDelegationWake(context, delegation, message.user_id);

    return { status: "error", detail: summary };
  }
}

async function settleDelegation(
  context: ReturnType<typeof createServiceContext>,
  delegation: { id: string; parentConversationId: string; parentRunId: string },
  userId: number | undefined,
  summary: string,
) {
  await transitionDelegation(
    context,
    delegation.id,
    "failed",
    {
      summary,
      outputIds: [],
    },
    userId,
  );
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

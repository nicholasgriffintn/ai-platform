import {
  createChatCompletionsJsonSchema,
  delegationWakeTaskDataSchema,
  teammateRunConfigurationSchema,
} from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/lib/context/serviceContext";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { enqueueTeammateRun } from "~/services/teammates/run-admission";
import { prepareTeammateRunResume } from "~/services/teammates/run-resume";
import type { IEnv } from "~/types";

import type { TaskMessage } from "../tasks/TaskService";
import { deliverDelegationResult } from "./message";
import { isDelegationGroupReady } from "./wait-policy";

export async function wakeDelegationParent(message: TaskMessage, env: IEnv) {
  const payload = delegationWakeTaskDataSchema.parse(message.task_data);
  const bootstrapContext = createServiceContext({ env });
  const delegations = await bootstrapContext.repositories.delegations.listByParentRunId(
    payload.parentRunId,
  );
  const first = delegations[0];

  if (!first) {
    return { status: "skipped" as const, detail: "Delegation group no longer exists" };
  }

  const user = await bootstrapContext.repositories.users.getUserById(message.user_id ?? 0);

  if (!user) {
    return { status: "error" as const, detail: "Delegating user not found" };
  }

  const context = createServiceContext({ env, user });

  for (const delegation of delegations) {
    await deliverDelegationResult(context, delegation, user);
  }

  if (first.waitFor === "none") {
    return { status: "skipped" as const, detail: "Delegation group does not resume its parent" };
  }

  if (!isDelegationGroupReady(delegations)) {
    return { status: "skipped" as const, detail: "Delegation group is still running" };
  }

  const body = createChatCompletionsJsonSchema.parse({
    completion_id: payload.parentConversationId,
    command_id: `delegation_wake_${payload.parentRunId}`,
    trigger: "delegation",
    messages: [
      {
        role: "user",
        content: "The delegated work has reported back. Review the stored results and continue.",
      },
    ],
    stream: false,
    store: true,
  });
  const parentRun = await context.repositories.conversationRuns.getById(payload.parentRunId);
  const parentConfiguration = teammateRunConfigurationSchema.safeParse(
    parentRun?.resolvedConfiguration,
  );

  if (
    parentRun &&
    parentRun.conversationId === payload.parentConversationId &&
    parentConfiguration.success
  ) {
    const resumed = await prepareTeammateRunResume({ context, run: parentRun });

    await enqueueTeammateRun({
      env,
      context,
      body,
      teammateId: parentConfiguration.data.teammateId,
      user,
      anonymousUser: undefined,
      trigger: "delegation",
      maxStepsOverride: resumed.maxSteps,
      resumeConfiguration: resumed.configuration,
      continuationRun: parentRun,
      ...(resumed.durableExecution ? { durableExecution: resumed.durableExecution } : {}),
    });

    return { status: "success" as const, detail: "Teammate parent resumed" };
  }

  await handleCreateChatCompletions({
    env,
    request: body,
    user,
    context,
  });

  return { status: "success" as const, detail: "Parent resumed" };
}

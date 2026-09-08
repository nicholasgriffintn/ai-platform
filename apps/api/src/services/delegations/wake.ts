import type { delegationStateSchema } from "@ngriffin_uk/polychat-schemas";
import {
  createChatCompletionsJsonSchema,
  delegationWakeTaskDataSchema,
} from "@ngriffin_uk/polychat-schemas";
import type z from "zod/v4";

import { createServiceContext } from "~/lib/context/serviceContext";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import type { IEnv } from "~/types";

import type { TaskMessage } from "../tasks/TaskService";

const SETTLED_STATES = new Set<z.infer<typeof delegationStateSchema>>([
  "done",
  "failed",
  "cancelled",
  "expired",
]);

export async function wakeDelegationParent(message: TaskMessage, env: IEnv) {
  const payload = delegationWakeTaskDataSchema.parse(message.task_data);
  const context = createServiceContext({ env });
  const delegations = await context.repositories.delegations.listByParentRunId(payload.parentRunId);
  const first = delegations[0];

  if (!first || first.waitFor === "none") {
    return { status: "skipped" as const, detail: "Delegation group does not resume its parent" };
  }

  const hasFailure = delegations.some((delegation) =>
    ["failed", "cancelled", "expired"].includes(delegation.state),
  );
  const ready =
    first.waitFor === "any"
      ? delegations.some((delegation) => SETTLED_STATES.has(delegation.state))
      : hasFailure || delegations.every((delegation) => SETTLED_STATES.has(delegation.state));

  if (!ready) {
    return { status: "skipped" as const, detail: "Delegation group is still running" };
  }

  const user = await context.repositories.users.getUserById(message.user_id ?? 0);

  if (!user) {
    return { status: "error" as const, detail: "Delegating user not found" };
  }

  const body = createChatCompletionsJsonSchema.parse({
    completion_id: payload.parentConversationId,
    command_id: `delegation_wake_${payload.parentRunId}`,
    trigger: "delegation",
    messages: [
      {
        role: "user",
        content: `Delegation results:\n${delegations
          .map(
            (delegation) =>
              `${delegation.teammateId} (${delegation.state}): ${delegation.result?.summary ?? "No summary"}`,
          )
          .join("\n")}`,
      },
    ],
    stream: false,
    store: true,
  });

  await handleCreateChatCompletions({ env, request: body, user, context });

  return { status: "success" as const, detail: "Parent resumed" };
}

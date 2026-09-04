import {
  chatInputPolicyStateSchema,
  DEFAULT_CHAT_INPUT_POLICY,
  type ChatInputPolicyState,
  type UpdateChatInputPolicy,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { CapabilityConfigurationScope } from "~/repositories/CapabilityConfigurationRepository";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

async function policyScope(
  context: ServiceContext,
  projectId?: string,
  write = false,
): Promise<CapabilityConfigurationScope> {
  const user = context.requireUser();

  if (projectId) {
    await requireProjectAccess(
      context,
      projectId,
      write ? ["owner", "admin"] : ["owner", "admin", "member"],
    );

    return { type: "project", id: projectId };
  }

  return { type: "user", id: user.id };
}

async function readPolicy(
  context: ServiceContext,
  scope: CapabilityConfigurationScope,
): Promise<ChatInputPolicyState> {
  const rows = await context.repositories.capabilityConfigurations.list(scope, "chat_input_policy");
  const record = rows.find((row) => row.capabilityId === "default");

  if (!record) {
    return { revision: 0, policy: { ...DEFAULT_CHAT_INPUT_POLICY }, history: [] };
  }

  const parsed = chatInputPolicyStateSchema.safeParse(record.configuration);

  if (!parsed.success) {
    throw new AssistantError(
      "Stored chat input policy is invalid",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  return parsed.data;
}

export async function getChatInputPolicy(context: ServiceContext, projectId?: string) {
  return readPolicy(context, await policyScope(context, projectId));
}

export async function updateChatInputPolicy(
  context: ServiceContext,
  input: UpdateChatInputPolicy,
  projectId?: string,
): Promise<ChatInputPolicyState> {
  const scope = await policyScope(context, projectId, true);
  const previous = await readPolicy(context, scope);

  if (previous.revision !== input.expectedRevision) {
    throw new AssistantError(
      "The policy changed. Reload before saving.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const revision = previous.revision + 1;
  const state: ChatInputPolicyState = {
    revision,
    policy: input.policy,
    history: [
      ...previous.history,
      {
        revision,
        policy: input.policy,
        changedAt: new Date().toISOString(),
        changedBy: context.requireUser().id,
      },
    ].slice(-20),
  };
  const saved = await context.repositories.capabilityConfigurations.saveWithRevision(
    {
      scope,
      capabilityKind: "chat_input_policy",
      capabilityId: "default",
      configuration: state,
    },
    input.expectedRevision,
  );

  if (!saved) {
    throw new AssistantError(
      "The policy changed. Reload before saving.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return state;
}

import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

export async function requireChannelBindingAccess(
  context: ServiceContext,
  bindingId: string,
  manage = false,
) {
  const user = context.requireUser();
  const binding = await context.repositories.channelBindings.getById(bindingId);

  if (!binding) {
    throw new AssistantError("Channel not found", ErrorType.NOT_FOUND, 404);
  }

  if (binding.scope_type === "personal") {
    if (!ownsResource(String(user.id), binding.scope_id)) {
      throw new AssistantError("Channel not found", ErrorType.NOT_FOUND, 404);
    }

    return { binding, canManage: true };
  }

  const { role } = await requireProjectAccess(
    context,
    binding.scope_id,
    manage ? ["owner", "admin"] : undefined,
  );

  return { binding, canManage: role === "owner" || role === "admin" };
}

export async function requireChannelSenderMapping(
  context: ServiceContext,
  input: {
    bindingId: string;
    mappingId: string;
    revision: number;
  },
) {
  const { binding } = await requireChannelBindingAccess(context, input.bindingId);
  const sender = await context.repositories.channelSenders.validateMapping(
    input.bindingId,
    input.mappingId,
    input.revision,
    context.requireUser().id,
  );

  if (!sender || !binding.enabled) {
    throw new AssistantError("Channel sender is no longer verified", ErrorType.FORBIDDEN, 403);
  }

  return { binding, sender };
}

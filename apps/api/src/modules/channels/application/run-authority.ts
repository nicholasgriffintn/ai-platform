import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { channelRunAuthoritySchema, type ChatRun } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { isChannelThreadCurrent } from "./thread-authority";

export async function isChannelRunAuthorityCurrent(
  context: ServiceContext,
  run: ChatRun,
): Promise<boolean> {
  const value = run.resolvedConfiguration?.channelDelivery;

  if (value === undefined) {
    return true;
  }

  const parsed = channelRunAuthoritySchema.safeParse(value);

  if (!parsed.success) {
    return false;
  }

  const binding = await context.repositories.channelBindings.getById(parsed.data.bindingId);

  if (
    !binding ||
    !ownsResource(run.initiatorUserId, binding.created_by) ||
    (binding.scope_type === "project"
      ? binding.scope_id !== run.projectId
      : binding.scope_id !== String(run.initiatorUserId) || run.projectId !== null)
  ) {
    return false;
  }

  return isChannelThreadCurrent(context, binding, parsed.data.thread, parsed.data.from);
}

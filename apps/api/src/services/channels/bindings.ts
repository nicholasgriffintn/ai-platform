import type { ChannelBinding, CreateChannelBindingInput } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ChannelBindingRow } from "~/lib/database/schema";
import { requireTeammateAccess } from "~/services/teammates/access";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

import { getChannelAdapter } from "./adapters";

function toBinding(row: ChannelBindingRow): ChannelBinding {
  return {
    id: row.id,
    channel: row.channel,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    externalId: row.external_id,
    label: row.label,
    teammateId: row.teammate_id,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
  };
}

export async function createChannelBinding(
  context: ServiceContext,
  input: CreateChannelBindingInput,
): Promise<ChannelBinding> {
  context.ensureDatabase();
  const user = context.requireUser();
  const adapter = getChannelAdapter(input.channel);

  if (!adapter) {
    throw new AssistantError(
      `${input.channel} does not have a channel adapter yet`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const scopeType = input.projectId ? "project" : "personal";

  if (!adapter.scopes.includes(scopeType)) {
    throw new AssistantError(
      `${adapter.label} cannot be bound to a ${scopeType} scope`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (input.projectId) {
    const { role } = await requireProjectAccess(context, input.projectId);

    if (role === "member") {
      throw new AssistantError(
        "Only project admins can connect a channel to a project",
        ErrorType.FORBIDDEN,
        403,
      );
    }
  }

  if (input.teammateId) {
    await requireTeammateAccess(context, input.teammateId, "read", user.id);
  }

  const existing = await context.repositories.channelBindings.getByExternalId(
    input.channel,
    input.externalId,
  );

  if (existing) {
    throw new AssistantError(
      "That channel is already connected to Polychat",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const created = await context.repositories.channelBindings.create({
    channel: input.channel,
    scopeType,
    scopeId: input.projectId ?? String(user.id),
    externalId: input.externalId,
    label: input.label ?? null,
    teammateId: input.teammateId ?? null,
    createdByUserId: user.id,
  });

  if (!created) {
    throw new AssistantError("Could not connect that channel", ErrorType.DATABASE_ERROR);
  }

  return toBinding(created);
}

export async function listChannelBindings(
  context: ServiceContext,
): Promise<{ bindings: ChannelBinding[] }> {
  context.ensureDatabase();
  const user = context.requireUser();
  const rows = await context.repositories.channelBindings.listForUser(user.id);

  return { bindings: rows.map(toBinding) };
}

export async function deleteChannelBinding(
  context: ServiceContext,
  bindingId: string,
): Promise<void> {
  context.ensureDatabase();
  const user = context.requireUser();

  await context.repositories.channelBindings.delete(bindingId, user.id);
}

export async function resolveChannelBinding(
  context: ServiceContext,
  channel: string,
  externalId: string,
): Promise<ChannelBindingRow | null> {
  return context.repositories.channelBindings.getByExternalId(channel, externalId);
}

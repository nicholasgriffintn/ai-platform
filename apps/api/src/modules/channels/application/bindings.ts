import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import type {
  ChannelBinding,
  CreateChannelBindingInput,
  UpdateChannelBindingInput,
} from "@ngriffin_uk/polychat-schemas";
import { createChannelBindingSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ChannelBindingRow } from "~/infrastructure/database/schema";
import { toChannelBinding } from "~/modules/channels/domain/bindings";
import { getChannelAdapter } from "~/modules/channels/infrastructure/adapters";
import {
  requireProjectTeammate,
  requireTeammateAccess,
} from "~/modules/teammates/application/access";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { validateSlackInstallation } from "./slack-installation";

export async function createChannelBinding(
  context: ServiceContext,
  input: CreateChannelBindingInput,
): Promise<ChannelBinding> {
  context.ensureDatabase();
  const user = context.requireUser();

  input = createChannelBindingSchema.parse(input);
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
    await requireProjectAccess(context, input.projectId, ["owner", "admin"]);
  }

  if (input.teammateId) {
    if (input.projectId) {
      await requireProjectTeammate(context, input.projectId, input.teammateId);
    } else {
      await requireTeammateAccess(context, input.teammateId, "read", user.id);
    }
  }

  const existing = await context.repositories.channelBindings.findByExternalId(
    input.channel,
    input.externalId,
    input.workspaceId ?? "",
  );

  if (existing) {
    throw new AssistantError(
      "That channel is already connected to Polychat",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (input.channel === "slack") {
    await validateSlackInstallation(context.env, input.workspaceId);
  }

  const created = await context.repositories.channelBindings.create({
    channel: input.channel,
    scopeType,
    scopeId: input.projectId ?? String(user.id),
    externalId: input.externalId,
    workspaceId: input.workspaceId ?? "",
    allowedSenderIds: input.allowedSenderIds,
    replyMode: input.replyMode ?? "mentions",
    label: input.label ?? null,
    teammateId: input.teammateId ?? null,
    interactionMode: input.interactionMode ?? "automated",
    createdByUserId: user.id,
  });

  if (!created) {
    throw new AssistantError("Could not connect that channel", ErrorType.DATABASE_ERROR);
  }

  return toChannelBinding(created);
}

export async function listChannelBindings(
  context: ServiceContext,
): Promise<{ bindings: ChannelBinding[] }> {
  context.ensureDatabase();
  const user = context.requireUser();
  const rows = await context.repositories.channelBindings.listForUser(user.id);

  return { bindings: rows.map(toChannelBinding) };
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
  workspaceId: string,
): Promise<ChannelBindingRow | null> {
  return context.repositories.channelBindings.findByExternalId(channel, externalId, workspaceId);
}

export async function updateChannelBinding(
  context: ServiceContext,
  id: string,
  input: UpdateChannelBindingInput,
): Promise<ChannelBinding> {
  const user = context.requireUser();
  const current = await context.repositories.channelBindings.getById(id);

  if (!current || !ownsResource(user.id, current.created_by)) {
    throw new AssistantError("Channel binding not found", ErrorType.NOT_FOUND, 404);
  }

  if (current.scope_type === "project") {
    await requireProjectAccess(context, current.scope_id, ["owner", "admin"]);
  }

  if (current.channel === "slack" && !current.workspace_id) {
    throw new AssistantError(
      "Recreate this channel with its workspace and sender permissions",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const updated = await context.repositories.channelBindings.update({
    id,
    userId: user.id,
    ...input,
  });

  if (!updated) {
    throw new AssistantError(
      "Channel settings changed. Reload and try again",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return toChannelBinding(updated);
}

import type {
  ConversationGroup,
  ConversationOrganisation,
  ConversationSnooze,
  CreateConversationGroup,
  UpdateConversationOrganisation,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type {
  ConversationGroupRow,
  ConversationUserStateRow,
} from "~/repositories/ConversationOrganisationRepository";
import { requireConversationAccess } from "~/services/conversations/access";
import { requireProjectAccess } from "~/services/workspaces/access";
import { isConversationUnread } from "~/utils/conversation-organisation";
import { AssistantError, ErrorType } from "~/utils/errors";

function conversationProjectId(conversation: Record<string, unknown>): string | null {
  return typeof conversation.project_id === "string" && conversation.project_id.length > 0
    ? conversation.project_id
    : null;
}

function effectiveSnooze(state: ConversationUserStateRow | null): ConversationSnooze | null {
  if (!state) {
    return null;
  }

  if (state.snoozed_until && Date.parse(state.snoozed_until) > Date.now()) {
    return { kind: "until", until: state.snoozed_until };
  }

  if (state.snoozed_next_response_at && state.next_response_arrived !== 1) {
    return { kind: "next_response" };
  }

  return null;
}

async function readOrganisation(
  context: ServiceContext,
  conversationId: string,
  userId: number,
  projectId: string | null,
): Promise<ConversationOrganisation> {
  const [state, group, availableGroups] = await Promise.all([
    context.repositories.conversationOrganisation.getState(conversationId, userId),
    context.repositories.conversationOrganisation.getConversationGroup(
      conversationId,
      userId,
      projectId,
    ),
    context.repositories.conversationOrganisation.listGroups(userId, projectId),
  ]);

  return {
    conversationId,
    revision: state?.revision ?? 0,
    isPinned: state?.is_pinned === 1,
    isUnread: isConversationUnread(state),
    snooze: effectiveSnooze(state),
    group,
    availableGroups,
    updatedAt: state?.updated_at ?? null,
  };
}

export async function getConversationOrganisation(
  context: ServiceContext,
  conversationId: string,
): Promise<ConversationOrganisation> {
  const user = context.requireUser();
  const conversation = await requireConversationAccess(context, conversationId);

  return readOrganisation(context, conversationId, user.id, conversationProjectId(conversation));
}

export async function updateConversationOrganisation(
  context: ServiceContext,
  conversationId: string,
  input: UpdateConversationOrganisation,
): Promise<ConversationOrganisation> {
  const user = context.requireUser();
  const conversation = await requireConversationAccess(context, conversationId);
  const current = await context.repositories.conversationOrganisation.getState(
    conversationId,
    user.id,
  );
  const currentRevision = current?.revision ?? 0;

  if (currentRevision !== input.expectedRevision) {
    throw new AssistantError(
      "Conversation organisation changed; refresh and try again",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (input.snooze?.kind === "until" && Date.parse(input.snooze.until) <= Date.now()) {
    throw new AssistantError("Snooze time must be in the future", ErrorType.PARAMS_ERROR, 400);
  }

  const now = new Date().toISOString();
  const stored = await context.repositories.conversationOrganisation.putState({
    conversationId,
    userId: user.id,
    expectedRevision: input.expectedRevision,
    isPinned: input.isPinned ?? current?.is_pinned === 1,
    isUnread: input.isUnread ?? isConversationUnread(current),
    snooze: input.snooze === undefined ? effectiveSnooze(current) : input.snooze,
    updatedAt: now,
  });

  if (!stored) {
    throw new AssistantError(
      "Conversation organisation changed; refresh and try again",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return readOrganisation(context, conversationId, user.id, conversationProjectId(conversation));
}

export async function createConversationGroup(
  context: ServiceContext,
  input: CreateConversationGroup,
): Promise<{ group: ConversationGroup }> {
  const user = context.requireUser();
  const projectId = input.scope.kind === "project" ? input.scope.projectId : null;

  if (projectId) {
    await requireProjectAccess(context, projectId, ["owner", "admin"]);
  }

  const existing = await context.repositories.conversationOrganisation.findGroupByName({
    userId: user.id,
    projectId,
    normalisedName: input.name.toLowerCase(),
  });

  if (existing) {
    throw new AssistantError(
      "A group with this name already exists",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return {
    group: await context.repositories.conversationOrganisation.createGroup({
      userId: user.id,
      projectId,
      name: input.name,
    }),
  };
}

async function authoriseGroupManagement(
  context: ServiceContext,
  group: ConversationGroupRow,
): Promise<void> {
  const user = context.requireUser();

  if (group.project_id) {
    await requireProjectAccess(context, group.project_id, ["owner", "admin"]);

    return;
  }

  if (group.owner_user_id !== user.id) {
    throw new AssistantError("Conversation group not found", ErrorType.NOT_FOUND, 404);
  }
}

export async function deleteConversationGroup(
  context: ServiceContext,
  groupId: string,
): Promise<void> {
  const group = await context.repositories.conversationOrganisation.getGroup(groupId);

  if (!group) {
    throw new AssistantError("Conversation group not found", ErrorType.NOT_FOUND, 404);
  }

  await authoriseGroupManagement(context, group);
  await context.repositories.conversationOrganisation.deleteGroup(groupId);
}

export async function moveConversationToGroup(
  context: ServiceContext,
  conversationId: string,
  groupId: string | null,
): Promise<ConversationOrganisation> {
  const user = context.requireUser();
  const conversation = await requireConversationAccess(context, conversationId);
  const projectId = conversationProjectId(conversation);

  if (groupId) {
    const group = await context.repositories.conversationOrganisation.getGroup(groupId);
    const groupMatchesScope = group
      ? projectId
        ? group.project_id === projectId
        : group.owner_user_id === user.id && group.project_id === null
      : false;

    if (!group || !groupMatchesScope) {
      throw new AssistantError("Conversation group not found", ErrorType.NOT_FOUND, 404);
    }
  }

  await context.repositories.conversationOrganisation.setConversationGroup({
    conversationId,
    groupId,
    userId: user.id,
  });

  return readOrganisation(context, conversationId, user.id, projectId);
}

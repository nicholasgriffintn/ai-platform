import type {
  ConversationLabel,
  ConversationOrganisation,
  ConversationSnooze,
  CreateConversationLabel,
  UpdateConversationOrganisation,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type {
  ConversationLabelRow,
  ConversationUserStateRow,
} from "~/repositories/ConversationOrganisationRepository";
import { requireConversationAccess } from "~/services/conversations/access";
import { requireProjectAccess } from "~/services/workspaces/access";
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
  const [state, labels, availableLabels] = await Promise.all([
    context.repositories.conversationOrganisation.getState(conversationId, userId),
    context.repositories.conversationOrganisation.listAssignedLabels(
      conversationId,
      userId,
      projectId,
    ),
    context.repositories.conversationOrganisation.listLabels(userId, projectId),
  ]);

  return {
    conversationId,
    revision: state?.revision ?? 0,
    isPinned: state?.is_pinned === 1,
    isUnread: state?.is_unread === 1 || state?.next_response_arrived === 1,
    snooze: effectiveSnooze(state),
    labels,
    availableLabels,
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
    isUnread: input.isUnread ?? current?.is_unread === 1,
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

export async function createConversationLabel(
  context: ServiceContext,
  input: CreateConversationLabel,
): Promise<{ label: ConversationLabel }> {
  const user = context.requireUser();
  const projectId = input.scope.kind === "project" ? input.scope.projectId : null;

  if (projectId) {
    await requireProjectAccess(context, projectId, ["owner", "admin"]);
  }

  const existing = await context.repositories.conversationOrganisation.findLabelByName({
    userId: user.id,
    projectId,
    normalisedName: input.name.toLowerCase(),
  });

  if (existing) {
    throw new AssistantError(
      "A label with this name already exists",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return {
    label: await context.repositories.conversationOrganisation.createLabel({
      userId: user.id,
      projectId,
      name: input.name,
    }),
  };
}

async function authoriseLabelManagement(
  context: ServiceContext,
  label: ConversationLabelRow,
): Promise<void> {
  const user = context.requireUser();

  if (label.project_id) {
    await requireProjectAccess(context, label.project_id, ["owner", "admin"]);

    return;
  }

  if (label.owner_user_id !== user.id) {
    throw new AssistantError("Conversation label not found", ErrorType.NOT_FOUND, 404);
  }
}

export async function deleteConversationLabel(
  context: ServiceContext,
  labelId: string,
): Promise<void> {
  const label = await context.repositories.conversationOrganisation.getLabel(labelId);

  if (!label) {
    throw new AssistantError("Conversation label not found", ErrorType.NOT_FOUND, 404);
  }

  await authoriseLabelManagement(context, label);
  await context.repositories.conversationOrganisation.deleteLabel(labelId);
}

export async function setConversationLabel(
  context: ServiceContext,
  conversationId: string,
  labelId: string,
  assigned: boolean,
): Promise<ConversationOrganisation> {
  const user = context.requireUser();
  const conversation = await requireConversationAccess(context, conversationId);
  const projectId = conversationProjectId(conversation);
  const label = await context.repositories.conversationOrganisation.getLabel(labelId);
  const labelMatchesScope = label
    ? projectId
      ? label.project_id === projectId
      : label.owner_user_id === user.id && label.project_id === null
    : false;

  if (!label || !labelMatchesScope) {
    throw new AssistantError("Conversation label not found", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.conversationOrganisation.setLabelAssignment({
    conversationId,
    labelId,
    userId: user.id,
    assigned,
  });

  return readOrganisation(context, conversationId, user.id, projectId);
}

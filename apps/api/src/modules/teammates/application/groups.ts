import {
  isPolyTeammateId,
  POLY_TEAMMATE_ID,
  type CreateTeammateGroupInput,
  type TeammateGroup,
  type TeammateRosterEntry,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";
import { TeammateGroupRepository } from "~/modules/teammates/infrastructure/TeammateGroupRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { requireScopedTeammateAccess } from "./access";

export async function createTeammateGroup(
  context: ServiceContext,
  input: CreateTeammateGroupInput,
): Promise<TeammateGroup> {
  context.ensureDatabase();
  const user = context.requireUser();

  if (input.teammateIds.some((teammateId) => isPolyTeammateId(teammateId))) {
    throw new AssistantError(
      "Poly keeps its own thread and cannot join a group",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (input.projectId) {
    await requireProjectAccess(context, input.projectId);
  }

  const scope = input.projectId
    ? ({ type: "project", id: input.projectId } as const)
    : ({ type: "personal", id: String(user.id) } as const);

  for (const teammateId of input.teammateIds) {
    await requireScopedTeammateAccess(context, teammateId, scope, user.id);
  }

  const conversationId = generateId();
  const created = await context.repositories
    .get(ConversationRepository)
    .createConversation(
      conversationId,
      user.id,
      input.name,
      input.projectId ? { project_id: input.projectId } : {},
    );

  if (!created) {
    throw new AssistantError("Could not start that group", ErrorType.DATABASE_ERROR);
  }

  await context.repositories.get(TeammateGroupRepository).addMembers({
    conversationId,
    teammateIds: input.teammateIds,
    addedBy: user.id,
  });

  return {
    conversationId,
    name: input.name,
    teammateIds: [...input.teammateIds],
    projectId: input.projectId ?? null,
    createdAt: new Date().toISOString(),
  };
}

export async function listTeammateRoster(context: ServiceContext): Promise<TeammateRosterEntry[]> {
  context.ensureDatabase();
  const user = context.requireUser();
  const [threads, groups] = await Promise.all([
    context.repositories
      .get(TeammateContextRepository)
      .listPersonalThreadsWithMessages(user.id, POLY_TEAMMATE_ID),
    context.repositories.get(TeammateGroupRepository).listForUser(user.id),
  ]);
  const entries: TeammateRosterEntry[] = [
    ...threads.map((thread) => ({ kind: "teammate" as const, ...thread })),
    ...groups
      .filter((group) => group.projectId === null)
      .map((group) => ({
        kind: "group" as const,
        conversationId: group.conversationId,
        name: group.name,
        teammateIds: group.teammateIds,
        lastActivityAt: group.lastActivityAt,
        unread: group.unread,
      })),
  ];

  return entries.sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt));
}

export async function listTeammateGroups(context: ServiceContext): Promise<TeammateGroup[]> {
  context.ensureDatabase();
  const user = context.requireUser();

  return context.repositories.get(TeammateGroupRepository).listForUser(user.id);
}

import type { TeammateContext, TeammateContextScope } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { MemoryDocumentRepository } from "~/modules/memory-documents/infrastructure/MemoryDocumentRepository";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";
import { WorkspaceTeammateRepository } from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

export async function resolveProjectTeammateScope(
  context: ServiceContext,
  teammateId: string,
  projectId: string,
): Promise<TeammateContextScope> {
  const project = await context.repositories.get(WorkspaceRepository).getProject(projectId);
  const employment = project
    ? await context.repositories
        .get(WorkspaceTeammateRepository)
        .get(project.workspace_id, teammateId)
    : null;

  if (employment && employment.status !== "proposed" && employment.status !== "archived") {
    return { type: "workspace", id: employment.workspaceId };
  }

  return { type: "project", id: projectId };
}

export async function resolveTeammateScope(
  context: ServiceContext,
  teammateId: string,
  projectId: string | null,
  userId: number,
): Promise<TeammateContextScope> {
  return projectId
    ? resolveProjectTeammateScope(context, teammateId, projectId)
    : { type: "personal", id: String(userId) };
}

export async function carryProjectContextsIntoWorkspace(
  context: ServiceContext,
  workspaceContext: TeammateContext,
): Promise<void> {
  const repository = context.repositories.get(TeammateContextRepository);
  const projects = await context.repositories
    .get(WorkspaceRepository)
    .listProjects(workspaceContext.scope.id);
  const projectIds = new Set(projects.map((project) => project.id));
  const projectContexts = (
    await repository.listForTeammate(workspaceContext.teammateId, workspaceContext.actorUserId)
  ).filter((candidate) => candidate.scope.type === "project" && projectIds.has(candidate.scope.id));

  if (projectContexts.length === 0) {
    return;
  }

  const grants = new Map<string, Set<string>>();

  for (const projectContext of projectContexts) {
    for (const grant of await repository.listConnectionGrants(projectContext.id)) {
      const operations = grants.get(grant.connectionId) ?? new Set<string>();

      for (const operation of grant.allowedOperations) {
        operations.add(operation);
      }

      grants.set(grant.connectionId, operations);
    }
  }

  for (const [connectionId, operations] of grants) {
    await repository.upsertConnectionGrant({
      contextId: workspaceContext.id,
      connectionId,
      allowedOperations: [...operations],
    });
  }

  const memories = await Promise.all(
    projectContexts.map((projectContext) =>
      context.repositories
        .get(MemoryDocumentRepository)
        .getDocumentById(projectContext.memoryDocumentId),
    ),
  );
  const carried = memories
    .flatMap((memory, index) =>
      memory?.content.trim()
        ? [
            `From ${projects.find((project) => project.id === projectContexts[index]?.scope.id)?.name ?? "a project"}:\n${memory.content.trim()}`,
          ]
        : [],
    )
    .join("\n\n");

  const target = carried
    ? await context.repositories
        .get(MemoryDocumentRepository)
        .getDocumentById(workspaceContext.memoryDocumentId)
    : null;

  if (target) {
    await context.repositories.get(MemoryDocumentRepository).appendRevision({
      documentId: target.id,
      content: carried,
      changeNote: "Brought together from this teammate's project memories",
      createdByUserId: workspaceContext.actorUserId,
      expectedRevision: target.revision,
    });
  }
}

export async function ensureWorkspaceWakeConversation(
  context: ServiceContext,
  teammateContext: TeammateContext,
  project: { id: string; name: string },
): Promise<string> {
  if (teammateContext.scope.type !== "workspace") {
    return teammateContext.homeConversationId;
  }

  const conversationId = `${teammateContext.homeConversationId}_${project.id}`;
  const conversations = context.repositories.get(ConversationRepository);

  if (!(await conversations.getConversation(conversationId))) {
    await conversations.createConversation(
      conversationId,
      teammateContext.actorUserId,
      `Wakes in ${project.name}`.slice(0, 200),
      { project_id: project.id, type: "chat" },
    );
  }

  return conversationId;
}

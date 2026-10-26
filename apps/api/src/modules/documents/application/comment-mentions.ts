import type { DocumentComment } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { reconcileTaskNotifications } from "~/modules/project-tasks/application/attention";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { requireProjectTeammate } from "~/modules/teammates/application/access";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

export async function prepareCommentMention(
  context: ServiceContext,
  projectId: string | null,
  documentTitle: string,
  comment: DocumentComment,
): Promise<D1PreparedStatement[]> {
  if (!comment.mentionedTeammateId || !comment.taskId) {
    return [];
  }

  if (!projectId) {
    throw new AssistantError(
      "Mention a teammate on a project document",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const { project } = await requireProjectAccess(context, projectId);

  await requireProjectTeammate(context, projectId, comment.mentionedTeammateId);
  const position = await context.repositories.get(ProjectTaskRepository).getMaxPosition(projectId);
  const where = comment.sourceId
    ? {
        label: `Note ${comment.sourceId}`,
        instructions: `Use get_note with the query "${documentTitle}" to read the note "${documentTitle}" (${comment.sourceId}), then answer comment ${comment.id}. The note is at revision ${comment.sourceRevision}.`,
      }
    : {
        label: `Document ${comment.outputId}`,
        instructions: `Use get_document with outputId ${comment.outputId} and commentId ${comment.id} to read the current document and the complete request. Preserve its revision before suggesting an edit.`,
      };

  return [
    context.repositories.get(ProjectTaskRepository).prepareTaskCreation({
      id: comment.taskId,
      projectId,
      workspaceId: project.workspace_id,
      objective: `Respond to the comment on ${documentTitle}: ${comment.body}`.slice(0, 2000),
      context: {
        links: [],
        notes:
          `${where.label}, revision ${comment.sourceRevision}, comment ${comment.id}\nSelected text: ${comment.anchor?.quote ?? "Whole document"}`.slice(
            0,
            4000,
          ),
      },
      source: "user",
      createdByUserId: comment.authorUserId,
      assigneeUserId: comment.authorUserId,
      runner: {
        kind: "conversation",
        teammateId: comment.mentionedTeammateId,
        model: null,
        mode: null,
      },
      stageId: "document-comment",
      flowSnapshot: {
        stages: [
          {
            id: "document-comment",
            name: "Document comment",
            instructions: where.instructions,
            teammateId: comment.mentionedTeammateId,
            skillIds: [],
            mode: null,
            requiresApprovalFor: [],
            advance: "on_human_accept",
          },
        ],
      },
      position: position + 1000,
    }),
    context.repositories.get(AuditRepository).prepareRecord({
      workspaceId: project.workspace_id,
      actorUserId: comment.authorUserId,
      action: "project.task.created",
      targetType: "project_task",
      targetId: comment.taskId,
      metadata: {
        projectId,
        source: "document_comment",
        ...(comment.sourceId ? { sourceId: comment.sourceId } : { outputId: comment.outputId }),
        commentId: comment.id,
      },
    }),
  ];
}

export async function notifyCommentMention(
  context: ServiceContext,
  comment: DocumentComment,
): Promise<void> {
  if (!comment.taskId) {
    return;
  }

  const task = await context.repositories.get(ProjectTaskRepository).getTaskById(comment.taskId);

  if (task) {
    await reconcileTaskNotifications(context, task);
  }
}

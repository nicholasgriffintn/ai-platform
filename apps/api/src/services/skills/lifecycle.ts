import type {
  AuthoredSkillDraftInput,
  AuthoredSkillHistoryResponse,
  AuthoredSkillImportInput,
  AuthoredSkillPromotionInput,
  AuthoredSkillRollbackInput,
  AuthoredSkillVersionedDocument,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { CreateWorkspaceAuditRecordInput } from "~/repositories/AuditRepository";
import type { AuthoredSkillScope } from "~/repositories/AuthoredSkillRepository";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

import {
  parseAuthoredSkillDocument,
  personalSkillScope,
  projectSkillScope,
  requireProjectSkillAdministration,
  requirePublishedProjectSkill,
} from "./management-policy";
import {
  getStoredSkillHistory,
  getStoredSkillVersion,
  importStoredSkillRevision,
  promoteStoredSkillDraft,
  rollbackStoredSkill,
  saveStoredSkillDraft,
} from "./persistence";

function projectSkillAudit(
  workspaceId: string,
  actorUserId: number,
  action: string,
  skillId: string,
  metadata: Record<string, unknown> = {},
): CreateWorkspaceAuditRecordInput {
  return {
    workspaceId,
    actorUserId,
    action,
    targetType: "skill",
    targetId: skillId,
    metadata: { name: skillId, ...metadata },
  };
}

async function resolveImportSourceScope(
  context: ServiceContext,
  userId: number,
  input: AuthoredSkillImportInput,
): Promise<AuthoredSkillScope> {
  if (input.source.scope.type === "personal") {
    return personalSkillScope(userId);
  }

  const sourceProjectId = input.source.scope.projectId;

  await requireProjectAccess(context, sourceProjectId, ["owner", "admin"]);
  await requirePublishedProjectSkill(context, sourceProjectId, input.source.skillId);

  return projectSkillScope(sourceProjectId);
}

export async function getPersonalSkillHistory(
  context: ServiceContext,
  userId: number,
  skillId: string,
): Promise<AuthoredSkillHistoryResponse> {
  const history = await getStoredSkillHistory(context, personalSkillScope(userId), skillId);

  if (!history) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  return history;
}

export async function getPersonalSkillVersion(
  context: ServiceContext,
  userId: number,
  skillId: string,
  revisionId: string,
): Promise<AuthoredSkillVersionedDocument> {
  const version = await getStoredSkillVersion(
    context,
    personalSkillScope(userId),
    skillId,
    revisionId,
  );

  if (!version) {
    throw new AssistantError("Skill revision not found", ErrorType.NOT_FOUND, 404);
  }

  return version;
}

export async function savePersonalSkillDraft(
  context: ServiceContext,
  userId: number,
  skillId: string,
  input: AuthoredSkillDraftInput,
): Promise<AuthoredSkillVersionedDocument> {
  const document = parseAuthoredSkillDocument(input.content);

  if (document.frontmatter.name !== skillId) {
    throw new AssistantError(
      "A skill name cannot be changed after it is created",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const saved = await saveStoredSkillDraft(
    context,
    personalSkillScope(userId),
    skillId,
    {
      content: input.content,
      resources: input.resources,
      description: document.frontmatter.description,
      createdByUserId: userId,
      changeNote: input.changeNote,
    },
    { expectedStateVersion: input.expectedStateVersion },
  );

  if (!saved) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  return saved;
}

export async function promotePersonalSkillDraft(
  context: ServiceContext,
  userId: number,
  skillId: string,
  input: AuthoredSkillPromotionInput,
): Promise<AuthoredSkillVersionedDocument> {
  const promoted = await promoteStoredSkillDraft(
    context,
    personalSkillScope(userId),
    skillId,
    input.revisionId,
    input.expectedStateVersion,
  );

  if (!promoted) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  return promoted;
}

export async function rollbackPersonalSkill(
  context: ServiceContext,
  userId: number,
  skillId: string,
  input: AuthoredSkillRollbackInput,
): Promise<AuthoredSkillVersionedDocument> {
  const rolledBack = await rollbackStoredSkill(
    context,
    personalSkillScope(userId),
    skillId,
    input.revisionId,
    input.expectedStateVersion,
    userId,
    input.changeNote,
  );

  if (!rolledBack) {
    throw new AssistantError("Skill revision not found", ErrorType.NOT_FOUND, 404);
  }

  return rolledBack;
}

export async function importPersonalSkill(
  context: ServiceContext,
  userId: number,
  input: AuthoredSkillImportInput,
): Promise<AuthoredSkillVersionedDocument> {
  const sourceScope = await resolveImportSourceScope(context, userId, input);
  const created = await importStoredSkillRevision(
    context,
    sourceScope,
    input.source.skillId,
    input.source.revisionId,
    personalSkillScope(userId),
    userId,
  );

  if (!created) {
    throw new AssistantError("Source skill revision not found", ErrorType.NOT_FOUND, 404);
  }

  return getPersonalSkillVersion(context, userId, created.document.name, created.draftRevisionId);
}

export async function getProjectSkillHistory(
  context: ServiceContext,
  projectId: string,
  skillId: string,
): Promise<AuthoredSkillHistoryResponse> {
  await requireProjectSkillAdministration(context, projectId, skillId);
  const history = await getStoredSkillHistory(context, projectSkillScope(projectId), skillId);

  if (!history) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  return history;
}

export async function getProjectSkillVersion(
  context: ServiceContext,
  projectId: string,
  skillId: string,
  revisionId: string,
): Promise<AuthoredSkillVersionedDocument> {
  await requireProjectSkillAdministration(context, projectId, skillId);
  const version = await getStoredSkillVersion(
    context,
    projectSkillScope(projectId),
    skillId,
    revisionId,
  );

  if (!version) {
    throw new AssistantError("Skill revision not found", ErrorType.NOT_FOUND, 404);
  }

  return version;
}

export async function saveProjectSkillDraft(
  context: ServiceContext,
  userId: number,
  projectId: string,
  skillId: string,
  input: AuthoredSkillDraftInput,
): Promise<AuthoredSkillVersionedDocument> {
  const { project } = await requireProjectSkillAdministration(context, projectId, skillId);
  const document = parseAuthoredSkillDocument(input.content);

  if (document.frontmatter.name !== skillId) {
    throw new AssistantError(
      "A skill name cannot be changed after it is published",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const saved = await saveStoredSkillDraft(
    context,
    projectSkillScope(projectId),
    skillId,
    {
      content: input.content,
      resources: input.resources,
      description: document.frontmatter.description,
      createdByUserId: userId,
      changeNote: input.changeNote,
    },
    {
      expectedStateVersion: input.expectedStateVersion,
      audit: projectSkillAudit(project.workspace_id, userId, "skill.draft_saved", skillId),
    },
  );

  if (!saved) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  return saved;
}

export async function promoteProjectSkillDraft(
  context: ServiceContext,
  userId: number,
  projectId: string,
  skillId: string,
  input: AuthoredSkillPromotionInput,
): Promise<AuthoredSkillVersionedDocument> {
  const { project } = await requireProjectSkillAdministration(context, projectId, skillId);
  const promoted = await promoteStoredSkillDraft(
    context,
    projectSkillScope(projectId),
    skillId,
    input.revisionId,
    input.expectedStateVersion,
    {
      audit: projectSkillAudit(project.workspace_id, userId, "skill.promoted", skillId),
    },
  );

  if (!promoted) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  return promoted;
}

export async function rollbackProjectSkill(
  context: ServiceContext,
  userId: number,
  projectId: string,
  skillId: string,
  input: AuthoredSkillRollbackInput,
): Promise<AuthoredSkillVersionedDocument> {
  const { project } = await requireProjectSkillAdministration(context, projectId, skillId);
  const rolledBack = await rollbackStoredSkill(
    context,
    projectSkillScope(projectId),
    skillId,
    input.revisionId,
    input.expectedStateVersion,
    userId,
    input.changeNote,
    {
      audit: projectSkillAudit(project.workspace_id, userId, "skill.rolled_back", skillId, {
        sourceRevisionId: input.revisionId,
      }),
    },
  );

  if (!rolledBack) {
    throw new AssistantError("Skill revision not found", ErrorType.NOT_FOUND, 404);
  }

  return rolledBack;
}

export async function importProjectSkill(
  context: ServiceContext,
  userId: number,
  projectId: string,
  input: AuthoredSkillImportInput,
): Promise<AuthoredSkillVersionedDocument> {
  const { project } = await requireProjectAccess(context, projectId, ["owner", "admin"]);
  const sourceScope = await resolveImportSourceScope(context, userId, input);
  const created = await importStoredSkillRevision(
    context,
    sourceScope,
    input.source.skillId,
    input.source.revisionId,
    projectSkillScope(projectId),
    userId,
    {
      projectPublication: {
        projectId,
        audit: projectSkillAudit(
          project.workspace_id,
          userId,
          "skill.imported",
          input.source.skillId,
          {
            sourceRevisionId: input.source.revisionId,
          },
        ),
      },
    },
  );

  if (!created) {
    throw new AssistantError("Source skill revision not found", ErrorType.NOT_FOUND, 404);
  }

  return getProjectSkillVersion(context, projectId, created.document.name, created.draftRevisionId);
}

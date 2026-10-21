import type {
  AuthoredSkillDraftInput,
  AuthoredSkillImportInput,
  AuthoredSkillInput,
  AuthoredSkillPromotionInput,
  AuthoredSkillRollbackInput,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuthoredSkillRepository } from "~/modules/skills/infrastructure/AuthoredSkillRepository";
import type { IUser } from "~/types";

import {
  createPersonalSkill,
  deletePersonalSkill,
  deleteProjectSkill,
  getPersonalSkill,
  getPersonalSkillHistory,
  getPersonalSkillVersion,
  getProjectSkill,
  getProjectSkillHistory,
  getProjectSkillVersion,
  importPersonalSkill,
  importProjectSkill,
  listPersonalSkills,
  listProjectSkills,
  promotePersonalSkillDraft,
  promoteProjectSkillDraft,
  publishProjectSkill,
  rollbackPersonalSkill,
  rollbackProjectSkill,
  savePersonalSkillDraft,
  saveProjectSkillDraft,
  updatePersonalSkill,
  updateProjectSkill,
} from "./index";
import { personalSkillScope, projectSkillScope } from "./management-policy";
import { getSkillOutcomes } from "./outcomes";
import { readSkillReplay, requestSkillReplay } from "./replay";

export interface SkillScope {
  context: ServiceContext;
  user: IUser;
  projectId?: string;
}

export function listScopedSkills({ context, user, projectId }: SkillScope) {
  return projectId ? listProjectSkills(context, projectId) : listPersonalSkills(context, user.id);
}

export function createScopedSkill(
  { context, user, projectId }: SkillScope,
  input: AuthoredSkillInput,
) {
  return projectId
    ? publishProjectSkill(context, user.id, projectId, input)
    : createPersonalSkill(context, user.id, input);
}

export function importScopedSkill(
  { context, user, projectId }: SkillScope,
  input: AuthoredSkillImportInput,
) {
  return projectId
    ? importProjectSkill(context, user.id, projectId, input)
    : importPersonalSkill(context, user.id, input);
}

export function getScopedSkill({ context, user, projectId }: SkillScope, skillId: string) {
  return projectId
    ? getProjectSkill(context, projectId, skillId)
    : getPersonalSkill(context, user.id, skillId);
}

export async function getScopedSkillOutcomes(scope: SkillScope, skillId: string) {
  await getScopedSkill(scope, skillId);

  return getSkillOutcomes(
    scope.context,
    scope.projectId ? projectSkillScope(scope.projectId) : personalSkillScope(scope.user.id),
    skillId,
  );
}

async function requireScopedSkillRecord(scope: SkillScope, skillName: string) {
  const record = await scope.context.repositories
    .get(AuthoredSkillRepository)
    .getByScopeAndName(
      scope.projectId ? projectSkillScope(scope.projectId) : personalSkillScope(scope.user.id),
      skillName,
    );

  if (!record) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  return record;
}

export async function getScopedSkillReplay(
  scope: SkillScope,
  skillName: string,
  revisionId: string,
) {
  await getScopedSkillRevision(scope, skillName, revisionId);

  const record = await requireScopedSkillRecord(scope, skillName);

  return readSkillReplay(scope.context, record.id, revisionId);
}

export async function startScopedSkillReplay(
  scope: SkillScope,
  skillName: string,
  revisionId: string,
) {
  const revision = await getScopedSkillRevision(scope, skillName, revisionId);

  if (!revision) {
    throw new AssistantError("Revision not found", ErrorType.NOT_FOUND, 404);
  }

  const record = await requireScopedSkillRecord(scope, skillName);

  return requestSkillReplay(scope.context, scope.user.id, { skillId: record.id, revisionId });
}

export function updateScopedSkill(
  { context, user, projectId }: SkillScope,
  skillId: string,
  input: AuthoredSkillInput,
) {
  return projectId
    ? updateProjectSkill(context, user.id, projectId, skillId, input)
    : updatePersonalSkill(context, user.id, skillId, input);
}

export async function deleteScopedSkill({ context, user, projectId }: SkillScope, skillId: string) {
  if (projectId) {
    await deleteProjectSkill(context, user.id, projectId, skillId);
  } else {
    await deletePersonalSkill(context, user.id, skillId);
  }

  return { deleted: true };
}

export function getScopedSkillHistory({ context, user, projectId }: SkillScope, skillId: string) {
  return projectId
    ? getProjectSkillHistory(context, projectId, skillId)
    : getPersonalSkillHistory(context, user.id, skillId);
}

export function getScopedSkillRevision(
  { context, user, projectId }: SkillScope,
  skillId: string,
  revisionId: string,
) {
  return projectId
    ? getProjectSkillVersion(context, projectId, skillId, revisionId)
    : getPersonalSkillVersion(context, user.id, skillId, revisionId);
}

export function saveScopedSkillDraft(
  { context, user, projectId }: SkillScope,
  skillId: string,
  input: AuthoredSkillDraftInput,
) {
  return projectId
    ? saveProjectSkillDraft(context, user.id, projectId, skillId, input)
    : savePersonalSkillDraft(context, user.id, skillId, input);
}

export function promoteScopedSkillDraft(
  { context, user, projectId }: SkillScope,
  skillId: string,
  input: AuthoredSkillPromotionInput,
) {
  return projectId
    ? promoteProjectSkillDraft(context, user.id, projectId, skillId, input)
    : promotePersonalSkillDraft(context, user.id, skillId, input);
}

export function rollbackScopedSkill(
  { context, user, projectId }: SkillScope,
  skillId: string,
  input: AuthoredSkillRollbackInput,
) {
  return projectId
    ? rollbackProjectSkill(context, user.id, projectId, skillId, input)
    : rollbackPersonalSkill(context, user.id, skillId, input);
}

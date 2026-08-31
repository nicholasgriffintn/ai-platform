import type {
  AuthoredSkill,
  AuthoredSkillDocument,
  AuthoredSkillInput,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { AuthoredSkillScope } from "~/repositories/AuthoredSkillRepository";
import { recordProjectAudit } from "~/services/audit";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";

import { getSkillDefinition } from "./catalog";
import { parseUserSkillDocument, SkillDocumentError } from "./document";
import {
  archiveStoredSkill,
  createStoredSkill,
  getStoredSkill,
  listStoredSkills,
  purgeStoredSkillAfterFailedCreate,
  saveStoredSkillDraft,
} from "./persistence";
import { SKILL_CAPABILITY_KIND } from "./scope";

const personalScope = (userId: number): AuthoredSkillScope => ({ type: "personal", id: userId });
const projectScope = (projectId: string): AuthoredSkillScope => ({
  type: "project",
  id: projectId,
});

function parseAuthoredSkillDocument(content: string) {
  try {
    return parseUserSkillDocument(content);
  } catch (error) {
    if (error instanceof SkillDocumentError) {
      throw new AssistantError(error.message, ErrorType.PARAMS_ERROR, 400);
    }

    throw error;
  }
}

async function parseAvailableName(input: AuthoredSkillInput) {
  const document = parseAuthoredSkillDocument(input.content);

  if (await getSkillDefinition(document.frontmatter.name)) {
    throw new AssistantError(
      `The name ${document.frontmatter.name} is reserved by a built-in skill`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return document;
}

async function getPublishedCapability(context: ServiceContext, projectId: string, name: string) {
  return (await context.repositories.workspaces.listProjectCapabilities(projectId)).find(
    (capability) => capability.kind === SKILL_CAPABILITY_KIND && capability.capability_id === name,
  );
}

function readCapabilityConfiguration(value: string | Record<string, unknown> | null) {
  if (typeof value === "string") {
    return safeParseJson<Record<string, unknown>>(value) ?? {};
  }

  return value ?? {};
}

export async function createPersonalSkill(
  context: ServiceContext,
  userId: number,
  input: AuthoredSkillInput,
): Promise<AuthoredSkillDocument> {
  const document = await parseAvailableName(input);
  const scope = personalScope(userId);
  const created = await createStoredSkill(context, scope, document.frontmatter.name, {
    description: document.frontmatter.description,
    content: input.content,
    resources: input.resources,
    createdByUserId: userId,
  });
  const skill = created.document;

  try {
    await context.repositories.capabilityConfigurations.save({
      scope: { type: "user", id: userId },
      capabilityKind: SKILL_CAPABILITY_KIND,
      capabilityId: skill.name,
      configuration: { enabled: true },
    });
  } catch (error) {
    await purgeStoredSkillAfterFailedCreate(context, created);
    throw error;
  }

  return skill;
}

export async function listPersonalSkills(
  context: ServiceContext,
  userId: number,
): Promise<{ skills: AuthoredSkill[] }> {
  return { skills: await listStoredSkills(context, personalScope(userId)) };
}

export async function getPersonalSkill(
  context: ServiceContext,
  userId: number,
  skillId: string,
): Promise<AuthoredSkillDocument> {
  const skill = await getStoredSkill(context, personalScope(userId), skillId);

  if (!skill) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  return skill;
}

export async function updatePersonalSkill(
  context: ServiceContext,
  userId: number,
  skillId: string,
  input: AuthoredSkillInput,
): Promise<AuthoredSkillDocument> {
  const scope = personalScope(userId);
  const existing = await getStoredSkill(context, scope, skillId);

  if (!existing) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

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
    scope,
    skillId,
    {
      description: document.frontmatter.description,
      content: input.content,
      resources: input.resources,
      createdByUserId: existing.createdByUserId,
    },
    {
      activate: true,
    },
  );

  if (!saved) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  return saved;
}

export async function deletePersonalSkill(
  context: ServiceContext,
  userId: number,
  skillId: string,
): Promise<void> {
  if (!(await archiveStoredSkill(context, personalScope(userId), skillId))) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }
}

export async function publishProjectSkill(
  context: ServiceContext,
  userId: number,
  projectId: string,
  input: AuthoredSkillInput,
): Promise<AuthoredSkillDocument> {
  await requireProjectAccess(context, projectId, ["owner", "admin"]);
  const document = await parseAvailableName(input);
  const scope = projectScope(projectId);
  const created = await createStoredSkill(context, scope, document.frontmatter.name, {
    description: document.frontmatter.description,
    content: input.content,
    resources: input.resources,
    createdByUserId: userId,
  });
  const skill = created.document;

  try {
    await context.repositories.workspaces.addProjectCapability({
      id: generateId(),
      projectId,
      kind: SKILL_CAPABILITY_KIND,
      capabilityId: skill.name,
      configuration: {},
      createdBy: userId,
    });
  } catch (error) {
    await purgeStoredSkillAfterFailedCreate(context, created);
    throw error;
  }

  await recordProjectAudit(context, projectId, {
    actorUserId: userId,
    action: "skill.published",
    targetType: "skill",
    targetId: skill.name,
    metadata: { name: skill.name },
  });

  return skill;
}

export async function listProjectSkills(
  context: ServiceContext,
  projectId: string,
): Promise<{ skills: AuthoredSkill[] }> {
  await requireProjectAccess(context, projectId);
  const [stored, capabilities] = await Promise.all([
    listStoredSkills(context, projectScope(projectId)),
    context.repositories.workspaces.listProjectCapabilities(projectId),
  ]);
  const publishedNames = new Set(
    capabilities
      .filter((capability) => capability.kind === SKILL_CAPABILITY_KIND)
      .map((capability) => capability.capability_id),
  );

  return { skills: stored.filter((skill) => publishedNames.has(skill.name)) };
}

export async function getProjectSkill(
  context: ServiceContext,
  projectId: string,
  skillId: string,
): Promise<AuthoredSkillDocument> {
  await requireProjectAccess(context, projectId);
  const capability = await getPublishedCapability(context, projectId, skillId);

  if (!capability) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  const skill = await getStoredSkill(context, projectScope(projectId), skillId);

  if (!skill) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  return skill;
}

export async function updateProjectSkill(
  context: ServiceContext,
  userId: number,
  projectId: string,
  skillId: string,
  input: AuthoredSkillInput,
): Promise<AuthoredSkillDocument> {
  await requireProjectAccess(context, projectId, ["owner", "admin"]);
  await getProjectSkill(context, projectId, skillId);
  const document = parseAuthoredSkillDocument(input.content);

  if (document.frontmatter.name !== skillId) {
    throw new AssistantError(
      "A skill name cannot be changed after it is published",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const skill = await saveStoredSkillDraft(
    context,
    projectScope(projectId),
    skillId,
    {
      description: document.frontmatter.description,
      content: input.content,
      resources: input.resources,
      createdByUserId: userId,
    },
    {
      activate: true,
    },
  );

  if (!skill) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  await recordProjectAudit(context, projectId, {
    actorUserId: userId,
    action: "skill.updated",
    targetType: "skill",
    targetId: skillId,
    metadata: { name: skillId },
  });

  return skill;
}

export async function deleteProjectSkill(
  context: ServiceContext,
  userId: number,
  projectId: string,
  skillId: string,
): Promise<void> {
  await requireProjectAccess(context, projectId, ["owner", "admin"]);
  const capability = await getPublishedCapability(context, projectId, skillId);

  if (!capability) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.workspaces.removeProjectCapability(projectId, capability.id);

  try {
    if (!(await archiveStoredSkill(context, projectScope(projectId), skillId))) {
      throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
    }
  } catch (error) {
    try {
      await context.repositories.workspaces.addProjectCapability({
        id: capability.id,
        projectId,
        kind: SKILL_CAPABILITY_KIND,
        capabilityId: skillId,
        configuration: readCapabilityConfiguration(capability.configuration),
        createdBy: capability.created_by,
      });
    } catch (restoreError) {
      context
        .getLogger({ prefix: "services/skills" })
        .error("Failed to restore project skill capability after archival failure", {
          restoreError,
          projectId,
          skillId,
        });
    }

    throw error;
  }

  await recordProjectAudit(context, projectId, {
    actorUserId: userId,
    action: "skill.unpublished",
    targetType: "skill",
    targetId: skillId,
    metadata: { name: skillId },
  });
}

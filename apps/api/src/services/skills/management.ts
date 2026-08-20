import type {
  AuthoredSkill,
  AuthoredSkillDocument,
  AuthoredSkillInput,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { recordProjectAudit } from "~/services/audit";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { getSkillDefinition } from "./catalog";
import { parseUserSkillDocument, SkillDocumentError } from "./document";
import { SKILL_CAPABILITY_KIND } from "./scope";
import { SkillDocumentStorage, type SkillStorageScope } from "./storage";

const personalScope = (userId: number): SkillStorageScope => ({ type: "personal", id: userId });
const projectScope = (projectId: string): SkillStorageScope => ({ type: "project", id: projectId });

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

export async function createPersonalSkill(
  context: ServiceContext,
  userId: number,
  input: AuthoredSkillInput,
): Promise<AuthoredSkillDocument> {
  const document = await parseAvailableName(input);
  const skill = await new SkillDocumentStorage(context).write(personalScope(userId), {
    name: document.frontmatter.name,
    description: document.frontmatter.description,
    content: input.content,
    resources: input.resources,
    createdByUserId: userId,
  });

  await context.repositories.capabilityConfigurations.save({
    scope: { type: "user", id: userId },
    capabilityKind: SKILL_CAPABILITY_KIND,
    capabilityId: skill.name,
    configuration: { enabled: true },
  });

  return skill;
}

export async function listPersonalSkills(
  context: ServiceContext,
  userId: number,
): Promise<{ skills: AuthoredSkill[] }> {
  return { skills: await new SkillDocumentStorage(context).list(personalScope(userId)) };
}

export async function getPersonalSkill(
  context: ServiceContext,
  userId: number,
  skillId: string,
): Promise<AuthoredSkillDocument> {
  const skill = await new SkillDocumentStorage(context).get(personalScope(userId), skillId);

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
  const storage = new SkillDocumentStorage(context);
  const existing = await storage.get(personalScope(userId), skillId);

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

  return storage.write(personalScope(userId), {
    name: skillId,
    description: document.frontmatter.description,
    content: input.content,
    resources: input.resources,
    createdByUserId: existing.createdByUserId,
    overwrite: true,
  });
}

export async function deletePersonalSkill(
  context: ServiceContext,
  userId: number,
  skillId: string,
): Promise<void> {
  await getPersonalSkill(context, userId, skillId);
  await new SkillDocumentStorage(context).delete(personalScope(userId), skillId);
}

export async function publishProjectSkill(
  context: ServiceContext,
  userId: number,
  projectId: string,
  input: AuthoredSkillInput,
): Promise<AuthoredSkillDocument> {
  await requireProjectAccess(context, projectId, ["owner", "admin"]);
  const document = await parseAvailableName(input);
  const storage = new SkillDocumentStorage(context);
  const skill = await storage.write(projectScope(projectId), {
    name: document.frontmatter.name,
    description: document.frontmatter.description,
    content: input.content,
    resources: input.resources,
    createdByUserId: userId,
  });

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
    await storage.delete(projectScope(projectId), skill.name);
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
    new SkillDocumentStorage(context).list(projectScope(projectId)),
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

  const skill = await new SkillDocumentStorage(context).get(projectScope(projectId), skillId);

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
  const existing = await getProjectSkill(context, projectId, skillId);
  const document = parseAuthoredSkillDocument(input.content);

  if (document.frontmatter.name !== skillId) {
    throw new AssistantError(
      "A skill name cannot be changed after it is published",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const skill = await new SkillDocumentStorage(context).write(projectScope(projectId), {
    name: skillId,
    description: document.frontmatter.description,
    content: input.content,
    resources: input.resources,
    createdByUserId: existing.createdByUserId,
    overwrite: true,
  });

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
    await new SkillDocumentStorage(context).delete(projectScope(projectId), skillId);
  } catch (error) {
    context.getLogger({ prefix: "services/skills" }).error("Failed to remove skill object", {
      error,
      projectId,
      skillId,
    });
  }

  await recordProjectAudit(context, projectId, {
    actorUserId: userId,
    action: "skill.unpublished",
    targetType: "skill",
    targetId: skillId,
    metadata: { name: skillId },
  });
}

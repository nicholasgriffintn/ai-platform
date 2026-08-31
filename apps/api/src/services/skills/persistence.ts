import type {
  AuthoredSkill,
  AuthoredSkillDocument,
  AuthoredSkillHistoryResponse,
  AuthoredSkillResource,
  AuthoredSkillRevision,
  AuthoredSkillState,
  AuthoredSkillVersionedDocument,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { CreateWorkspaceAuditRecordInput } from "~/repositories/AuditRepository";
import type {
  AuthoredSkillRecord,
  AuthoredSkillRevisionRecord,
  AuthoredSkillScope,
  CreateAuthoredSkillInput,
} from "~/repositories/AuthoredSkillRepository";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { createSkillBundle, type SkillRevisionBundle } from "./bundle";
import { SkillRevisionStorage } from "./storage";

interface RevisionContentInput {
  content: string;
  resources?: readonly AuthoredSkillResource[];
  description: string;
  createdByUserId: number;
  changeNote?: string | null;
  source?: { skillId: string; revisionId: string } | null;
}

interface StoredSkillCreationOptions {
  projectPublication?: CreateAuthoredSkillInput["projectPublication"];
}

interface StoredSkillMutationOptions {
  audit?: CreateWorkspaceAuditRecordInput;
}

export interface StoredSkillCreation {
  document: AuthoredSkillDocument;
  draftRevisionId: string;
  skillId: string;
  stateVersion: number;
  storageKey: string;
}

function toPublicScope(skill: AuthoredSkillRecord): AuthoredSkill["scope"] {
  return skill.scopeType === "personal"
    ? { type: "personal" }
    : { type: "project", projectId: skill.scopeId };
}

function toSkill(skill: AuthoredSkillRecord, revision: AuthoredSkillRevisionRecord): AuthoredSkill {
  return {
    id: skill.name,
    name: skill.name,
    description: revision.description,
    scope: toPublicScope(skill),
    createdByUserId: skill.createdByUserId,
    createdAt: skill.createdAt,
    updatedAt:
      skill.stateVersion === 1 && skill.updatedAt === skill.createdAt ? null : skill.updatedAt,
  };
}

function toRevision(revision: AuthoredSkillRevisionRecord): AuthoredSkillRevision {
  return {
    id: revision.id,
    skillId: revision.skillId,
    revision: revision.revision,
    digest: revision.digest,
    size: revision.size,
    description: revision.description,
    changeNote: revision.changeNote,
    sourceSkillId: revision.sourceSkillId,
    sourceRevisionId: revision.sourceRevisionId,
    createdByUserId: revision.createdByUserId,
    createdAt: revision.createdAt,
  };
}

function toState(skill: AuthoredSkillRecord): AuthoredSkillState {
  return {
    draftRevisionId: skill.draftRevisionId,
    stableRevisionId: skill.stableRevisionId,
    stateVersion: skill.stateVersion,
  };
}

function toDocument(
  skill: AuthoredSkillRecord,
  revision: AuthoredSkillRevisionRecord,
  bundle: SkillRevisionBundle,
): AuthoredSkillDocument {
  return {
    ...toSkill(skill, revision),
    content: bundle.content,
    resources: bundle.resources,
  };
}

function toVersionedDocument(
  skill: AuthoredSkillRecord,
  revision: AuthoredSkillRevisionRecord,
  bundle: SkillRevisionBundle,
): AuthoredSkillVersionedDocument {
  return {
    ...toDocument(skill, revision, bundle),
    revision: toRevision(revision),
    state: toState(skill),
  };
}

function repository(context: ServiceContext) {
  return context.repositories.authoredSkills;
}

async function reconcileStoredRevision(
  context: ServiceContext,
  skillId: string,
  storageKey: string,
): Promise<
  { skill: AuthoredSkillRecord; revision: AuthoredSkillRevisionRecord } | null | undefined
> {
  try {
    const [skill, revision] = await Promise.all([
      repository(context).getById(skillId),
      repository(context).getRevisionByStorageKey(skillId, storageKey),
    ]);

    return skill && revision ? { skill, revision } : null;
  } catch (reconciliationError) {
    context
      .getLogger({ prefix: "services/skills" })
      .error("Could not reconcile an authored skill revision after a D1 error", {
        reconciliationError,
        skillId,
        storageKey,
      });

    return undefined;
  }
}

async function cleanFailedRevision(
  context: ServiceContext,
  storage: SkillRevisionStorage,
  storageKey: string,
): Promise<void> {
  try {
    await storage.deleteRevision(storageKey);
  } catch (error) {
    context
      .getLogger({ prefix: "services/skills" })
      .error("Failed to clean up an unreachable authored skill revision", { error, storageKey });
  }
}

async function readRevisionRecord(
  context: ServiceContext,
  skill: AuthoredSkillRecord,
  revision: AuthoredSkillRevisionRecord,
): Promise<AuthoredSkillVersionedDocument> {
  const bundle = await new SkillRevisionStorage(context).getRevision(revision.storageKey, {
    digest: revision.digest,
    sizeBytes: revision.size,
  });

  if (!bundle) {
    throw new AssistantError("Authored skill revision object is missing", ErrorType.STORAGE_ERROR);
  }

  return toVersionedDocument(skill, revision, bundle);
}

async function readRevision(
  context: ServiceContext,
  skill: AuthoredSkillRecord,
  pointer: "draft" | "stable",
): Promise<AuthoredSkillVersionedDocument> {
  const revision = await repository(context).getCurrentRevision(skill.id, pointer);

  if (!revision) {
    throw new AssistantError(
      `Authored skill ${pointer} revision is missing`,
      ErrorType.DATABASE_ERROR,
      500,
    );
  }

  return readRevisionRecord(context, skill, revision);
}

async function createRevisionedSkill(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  name: string,
  input: RevisionContentInput,
  options: StoredSkillCreationOptions = {},
  preparedBundle?: SkillRevisionBundle,
): Promise<StoredSkillCreation> {
  const bundle = preparedBundle ?? (await createSkillBundle(input.content, input.resources));
  const skillId = generateId();
  const objectId = generateId();
  const storage = new SkillRevisionStorage(context);
  const storageKey = await storage.writeRevision(skillId, objectId, bundle);

  try {
    const created = await repository(context).create({
      id: skillId,
      scope,
      name,
      description: input.description,
      digest: bundle.digest,
      storageKey,
      size: bundle.sizeBytes,
      createdByUserId: input.createdByUserId,
      changeNote: input.changeNote,
      source: input.source,
      projectPublication: options.projectPublication,
    });

    return {
      document: toDocument(created.skill, created.revision, bundle),
      draftRevisionId: created.skill.draftRevisionId,
      skillId: created.skill.id,
      stateVersion: created.skill.stateVersion,
      storageKey: created.revision.storageKey,
    };
  } catch (error) {
    const committed = await reconcileStoredRevision(context, skillId, storageKey);

    if (
      committed &&
      committed.skill.draftRevisionId === committed.revision.id &&
      committed.skill.stableRevisionId === committed.revision.id
    ) {
      return {
        document: toDocument(committed.skill, committed.revision, bundle),
        draftRevisionId: committed.skill.draftRevisionId,
        skillId: committed.skill.id,
        stateVersion: committed.skill.stateVersion,
        storageKey: committed.revision.storageKey,
      };
    }

    if (committed === null) {
      await cleanFailedRevision(context, storage, storageKey);
    }

    throw error;
  }
}

export async function createStoredSkill(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  name: string,
  input: RevisionContentInput,
  options: StoredSkillCreationOptions = {},
): Promise<StoredSkillCreation> {
  const existing = await repository(context).getByScopeAndName(scope, name);

  if (existing) {
    throw new AssistantError(
      `A skill named ${name} already exists in this scope`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return createRevisionedSkill(context, scope, name, input, options);
}

export async function getStoredSkill(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  name: string,
  pointer: "draft" | "stable" = "draft",
): Promise<AuthoredSkillDocument | null> {
  const skill = await repository(context).getByScopeAndName(scope, name);

  return skill ? readRevision(context, skill, pointer) : null;
}

async function getStoredSkillRecord(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  name: string,
): Promise<AuthoredSkillRecord | null> {
  return repository(context).getByScopeAndName(scope, name);
}

export async function getStoredSkillVersion(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  name: string,
  revisionId: string,
): Promise<AuthoredSkillVersionedDocument | null> {
  const skill = await getStoredSkillRecord(context, scope, name);

  if (!skill) {
    return null;
  }

  const revision = await repository(context).getRevisionForSkill(skill.id, revisionId);

  return revision ? readRevisionRecord(context, skill, revision) : null;
}

export async function getStoredSkillHistory(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  name: string,
): Promise<AuthoredSkillHistoryResponse | null> {
  const skill = await getStoredSkillRecord(context, scope, name);

  if (!skill) {
    return null;
  }

  const [draft, revisions] = await Promise.all([
    repository(context).getCurrentRevision(skill.id, "draft"),
    repository(context).listRevisions(skill.id),
  ]);

  if (!draft) {
    throw new AssistantError("Authored skill draft revision is missing", ErrorType.DATABASE_ERROR);
  }

  return {
    skill: toSkill(skill, draft),
    state: toState(skill),
    revisions: revisions.map(toRevision),
  };
}

export async function listStoredSkills(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  pointer: "draft" | "stable" = "draft",
): Promise<AuthoredSkill[]> {
  const skills = await repository(context).listByScope(scope);

  return Promise.all(
    skills.map(async (skill) => {
      const revision = await repository(context).getCurrentRevision(skill.id, pointer);

      if (!revision) {
        throw new AssistantError(
          `Authored skill ${pointer} revision is missing`,
          ErrorType.DATABASE_ERROR,
        );
      }

      return toSkill(skill, revision);
    }),
  );
}

export async function listStoredStableSkillDocuments(
  context: ServiceContext,
  scope: AuthoredSkillScope,
): Promise<AuthoredSkillVersionedDocument[]> {
  const skills = await repository(context).listByScope(scope);

  return Promise.all(skills.map((skill) => readRevision(context, skill, "stable")));
}

export async function saveStoredSkillDraft(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  name: string,
  input: RevisionContentInput,
  options: {
    activate?: boolean;
    expectedStateVersion?: number;
    forceRevision?: boolean;
    audit?: CreateWorkspaceAuditRecordInput;
  } = {},
): Promise<AuthoredSkillVersionedDocument | null> {
  const skill = await getStoredSkillRecord(context, scope, name);

  if (!skill) {
    return null;
  }

  if (
    options.expectedStateVersion !== undefined &&
    skill.stateVersion !== options.expectedStateVersion
  ) {
    throw new AssistantError(
      "Skill changed while the draft was being saved",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const bundle = await createSkillBundle(input.content, input.resources);
  const currentDraft = await repository(context).getCurrentRevision(skill.id, "draft");

  if (!currentDraft) {
    throw new AssistantError("Authored skill draft revision is missing", ErrorType.DATABASE_ERROR);
  }

  if (!options.forceRevision && currentDraft.digest === bundle.digest) {
    return readRevision(context, skill, "draft");
  }

  const storage = new SkillRevisionStorage(context);
  const storageKey = await storage.writeRevision(skill.id, generateId(), bundle);

  let updated: { skill: AuthoredSkillRecord; revision: AuthoredSkillRevisionRecord } | null;

  try {
    updated = await repository(context).appendRevision({
      skillId: skill.id,
      expectedStateVersion: skill.stateVersion,
      expectedDraftRevisionId: skill.draftRevisionId,
      description: input.description,
      digest: bundle.digest,
      storageKey,
      size: bundle.sizeBytes,
      createdByUserId: input.createdByUserId,
      changeNote: input.changeNote,
      activate: options.activate,
      source: input.source,
      audit: options.audit,
    });
  } catch (error) {
    const committed = await reconcileStoredRevision(context, skill.id, storageKey);

    if (
      committed &&
      committed.skill.draftRevisionId === committed.revision.id &&
      (!options.activate || committed.skill.stableRevisionId === committed.revision.id)
    ) {
      return toVersionedDocument(committed.skill, committed.revision, bundle);
    }

    if (committed === null) {
      await cleanFailedRevision(context, storage, storageKey);
    }

    throw error;
  }

  if (!updated) {
    await cleanFailedRevision(context, storage, storageKey);
    throw new AssistantError(
      "Skill changed while the draft was being saved",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return toVersionedDocument(updated.skill, updated.revision, bundle);
}

export async function promoteStoredSkillDraft(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  name: string,
  revisionId: string,
  expectedStateVersion: number,
  options: StoredSkillMutationOptions = {},
): Promise<AuthoredSkillVersionedDocument | null> {
  const skill = await getStoredSkillRecord(context, scope, name);

  if (!skill) {
    return null;
  }

  if (skill.stateVersion !== expectedStateVersion || skill.draftRevisionId !== revisionId) {
    throw new AssistantError(
      "Skill changed before the draft could be promoted",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (skill.stableRevisionId === revisionId) {
    return readRevision(context, skill, "stable");
  }

  let promoted: AuthoredSkillRecord | null;

  try {
    promoted = await repository(context).promoteDraft(
      skill.id,
      revisionId,
      expectedStateVersion,
      options.audit,
    );
  } catch (error) {
    const committed = await repository(context)
      .getById(skill.id)
      .catch(() => null);

    if (
      committed?.stableRevisionId === revisionId &&
      committed.stateVersion === expectedStateVersion + 1
    ) {
      return readRevision(context, committed, "stable");
    }

    throw error;
  }

  if (!promoted) {
    throw new AssistantError(
      "Skill changed before the draft could be promoted",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return readRevision(context, promoted, "stable");
}

export async function rollbackStoredSkill(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  name: string,
  revisionId: string,
  expectedStateVersion: number,
  createdByUserId: number,
  changeNote?: string,
  options: StoredSkillMutationOptions = {},
): Promise<AuthoredSkillVersionedDocument | null> {
  const source = await getStoredSkillVersion(context, scope, name, revisionId);

  if (!source) {
    return null;
  }

  return saveStoredSkillDraft(
    context,
    scope,
    name,
    {
      content: source.content,
      resources: source.resources,
      description: source.description,
      createdByUserId,
      changeNote: changeNote ?? `Rollback to revision ${source.revision.revision}`,
      source: { skillId: source.revision.skillId, revisionId: source.revision.id },
    },
    { activate: true, expectedStateVersion, forceRevision: true, audit: options.audit },
  );
}

export async function importStoredSkillRevision(
  context: ServiceContext,
  sourceScope: AuthoredSkillScope,
  sourceName: string,
  sourceRevisionId: string,
  targetScope: AuthoredSkillScope,
  createdByUserId: number,
  options: StoredSkillCreationOptions = {},
): Promise<StoredSkillCreation | null> {
  const source = await getStoredSkillVersion(context, sourceScope, sourceName, sourceRevisionId);

  if (!source) {
    return null;
  }

  return createStoredSkill(
    context,
    targetScope,
    source.name,
    {
      content: source.content,
      resources: source.resources,
      description: source.description,
      createdByUserId,
      changeNote: `Imported from revision ${source.revision.revision}`,
      source: { skillId: source.revision.skillId, revisionId: source.revision.id },
    },
    options,
  );
}

export async function archiveStoredSkill(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  name: string,
): Promise<boolean> {
  const skill = await repository(context).getByScopeAndName(scope, name);

  if (!skill) {
    return false;
  }

  const archived = await repository(context).archive(skill.id, skill.stateVersion);

  if (!archived) {
    throw new AssistantError(
      "Skill changed while it was being removed",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return true;
}

export async function purgeStoredSkillAfterFailedCreate(
  context: ServiceContext,
  creation: StoredSkillCreation,
): Promise<boolean> {
  const purged = await repository(context).purge(
    creation.skillId,
    creation.stateVersion,
    creation.draftRevisionId,
  );

  if (purged) {
    await cleanFailedRevision(context, new SkillRevisionStorage(context), creation.storageKey);
  }

  return purged;
}

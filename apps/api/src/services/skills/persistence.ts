import type {
  AuthoredSkill,
  AuthoredSkillDocument,
  AuthoredSkillResource,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type {
  AuthoredSkillRecord,
  AuthoredSkillRevisionRecord,
  AuthoredSkillScope,
} from "~/repositories/AuthoredSkillRepository";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { createSkillBundle, type SkillRevisionBundle } from "./bundle";
import { parseUserSkillDocument } from "./document";
import { SkillDocumentStorage } from "./storage";

interface RevisionContentInput {
  content: string;
  resources?: readonly AuthoredSkillResource[];
  description: string;
  createdByUserId: number;
  createdAt?: string;
  updatedAt?: string | null;
  changeNote?: string | null;
  source?: { skillId: string; revisionId: string } | null;
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
  storage: SkillDocumentStorage,
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

async function readRevision(
  context: ServiceContext,
  skill: AuthoredSkillRecord,
  pointer: "draft" | "stable",
): Promise<AuthoredSkillDocument> {
  const revision = await repository(context).getCurrentRevision(skill.id, pointer);

  if (!revision) {
    throw new AssistantError(
      `Authored skill ${pointer} revision is missing`,
      ErrorType.DATABASE_ERROR,
      500,
    );
  }

  const bundle = await new SkillDocumentStorage(context).getRevision(revision.storageKey, {
    digest: revision.digest,
    sizeBytes: revision.size,
  });

  if (!bundle) {
    throw new AssistantError("Authored skill revision object is missing", ErrorType.STORAGE_ERROR);
  }

  return toDocument(skill, revision, bundle);
}

async function createRevisionedSkill(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  name: string,
  input: RevisionContentInput,
  preparedBundle?: SkillRevisionBundle,
): Promise<StoredSkillCreation> {
  const bundle = preparedBundle ?? (await createSkillBundle(input.content, input.resources));
  const skillId = generateId();
  const objectId = generateId();
  const storage = new SkillDocumentStorage(context);
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
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      changeNote: input.changeNote,
      source: input.source,
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

async function importLegacySkill(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  legacy: AuthoredSkillDocument,
): Promise<AuthoredSkillRecord> {
  const existing = await repository(context).getByScopeAndName(scope, legacy.name);

  if (existing) {
    return existing;
  }

  if (await repository(context).getLatestByScopeAndName(scope, legacy.name)) {
    throw new AssistantError("Legacy skill has already been archived", ErrorType.NOT_FOUND, 404);
  }

  let parsed: ReturnType<typeof parseUserSkillDocument>;
  let bundle: SkillRevisionBundle;

  try {
    parsed = parseUserSkillDocument(legacy.content);
    bundle = await createSkillBundle(legacy.content, legacy.resources);
  } catch (error) {
    throw new AssistantError(
      `Legacy authored skill ${legacy.name} is invalid in storage`,
      ErrorType.STORAGE_ERROR,
      500,
      { originalError: error instanceof Error ? error.message : "Unknown validation error" },
    );
  }

  if (parsed.frontmatter.name !== legacy.name) {
    throw new AssistantError(
      "Legacy skill name does not match its document",
      ErrorType.STORAGE_ERROR,
    );
  }

  try {
    const created = await createRevisionedSkill(
      context,
      scope,
      legacy.name,
      {
        content: legacy.content,
        resources: legacy.resources,
        description: parsed.frontmatter.description,
        createdByUserId: legacy.createdByUserId,
        createdAt: legacy.createdAt,
        updatedAt: legacy.updatedAt,
        changeNote: "Imported from legacy storage",
      },
      bundle,
    );
    const imported = await repository(context).getByScopeAndName(scope, created.document.name);

    if (!imported) {
      throw new AssistantError("Imported skill identity is missing", ErrorType.DATABASE_ERROR);
    }

    return imported;
  } catch (error) {
    if (error instanceof AssistantError && error.type === ErrorType.CONFLICT_ERROR) {
      const winner = await repository(context).getByScopeAndName(scope, legacy.name);

      if (winner) {
        return winner;
      }
    }

    throw error;
  }
}

async function importLegacyScope(
  context: ServiceContext,
  scope: AuthoredSkillScope,
): Promise<void> {
  const storage = new SkillDocumentStorage(context);
  const legacy = await storage.list(scope);

  await Promise.all(
    legacy.map(async (summary) => {
      if (await repository(context).getLatestByScopeAndName(scope, summary.name)) {
        return;
      }

      const document = await storage.get(scope, summary.name);

      if (document) {
        try {
          await importLegacySkill(context, scope, document);
        } catch (error) {
          if (error instanceof AssistantError && error.type === ErrorType.STORAGE_ERROR) {
            context
              .getLogger({ prefix: "services/skills" })
              .error("Skipped an invalid legacy authored skill during migration", {
                error,
                scope,
                name: summary.name,
              });

            return;
          }

          throw error;
        }
      }
    }),
  );
}

export async function createStoredSkill(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  name: string,
  input: RevisionContentInput,
): Promise<StoredSkillCreation> {
  const existing = await repository(context).getByScopeAndName(scope, name);

  if (existing) {
    throw new AssistantError(
      `A skill named ${name} already exists in this scope`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (!(await repository(context).getLatestByScopeAndName(scope, name))) {
    const legacy = await new SkillDocumentStorage(context).get(scope, name);

    if (legacy) {
      throw new AssistantError(
        `A skill named ${name} already exists in this scope`,
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }
  }

  return createRevisionedSkill(context, scope, name, input);
}

export async function getStoredSkill(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  name: string,
  pointer: "draft" | "stable" = "draft",
): Promise<AuthoredSkillDocument | null> {
  let skill = await repository(context).getByScopeAndName(scope, name);

  if (!skill) {
    if (await repository(context).getLatestByScopeAndName(scope, name)) {
      return null;
    }

    const legacy = await new SkillDocumentStorage(context).get(scope, name);

    if (!legacy) {
      return null;
    }

    skill = await importLegacySkill(context, scope, legacy);
  }

  return readRevision(context, skill, pointer);
}

export async function listStoredSkills(
  context: ServiceContext,
  scope: AuthoredSkillScope,
): Promise<AuthoredSkill[]> {
  await importLegacyScope(context, scope);
  const skills = await repository(context).listByScope(scope);

  return Promise.all(
    skills.map(async (skill) => {
      const revision = await repository(context).getCurrentRevision(skill.id, "draft");

      if (!revision) {
        throw new AssistantError(
          "Authored skill draft revision is missing",
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
): Promise<AuthoredSkillDocument[]> {
  await importLegacyScope(context, scope);
  const skills = await repository(context).listByScope(scope);

  return Promise.all(skills.map((skill) => readRevision(context, skill, "stable")));
}

export async function saveStoredSkillDraft(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  name: string,
  input: RevisionContentInput,
  options: { activate?: boolean } = {},
): Promise<AuthoredSkillDocument | null> {
  let skill = await repository(context).getByScopeAndName(scope, name);

  if (!skill) {
    if (await repository(context).getLatestByScopeAndName(scope, name)) {
      return null;
    }

    const legacy = await new SkillDocumentStorage(context).get(scope, name);

    if (!legacy) {
      return null;
    }

    skill = await importLegacySkill(context, scope, legacy);
  }

  const bundle = await createSkillBundle(input.content, input.resources);
  const currentDraft = await repository(context).getCurrentRevision(skill.id, "draft");

  if (!currentDraft) {
    throw new AssistantError("Authored skill draft revision is missing", ErrorType.DATABASE_ERROR);
  }

  if (currentDraft.digest === bundle.digest) {
    return readRevision(context, skill, "draft");
  }

  const storage = new SkillDocumentStorage(context);
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
    });
  } catch (error) {
    const committed = await reconcileStoredRevision(context, skill.id, storageKey);

    if (
      committed &&
      committed.skill.draftRevisionId === committed.revision.id &&
      (!options.activate || committed.skill.stableRevisionId === committed.revision.id)
    ) {
      return toDocument(committed.skill, committed.revision, bundle);
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

  return toDocument(updated.skill, updated.revision, bundle);
}

export async function archiveStoredSkill(
  context: ServiceContext,
  scope: AuthoredSkillScope,
  name: string,
): Promise<boolean> {
  const skill = await repository(context).getByScopeAndName(scope, name);

  if (!skill) {
    if (await repository(context).getLatestByScopeAndName(scope, name)) {
      return false;
    }

    const storage = new SkillDocumentStorage(context);
    const legacy = (await storage.list(scope)).some((summary) => summary.name === name);

    if (!legacy) {
      return false;
    }

    await storage.delete(scope, name);

    return true;
  }

  const archived = await repository(context).archive(skill.id, skill.stateVersion);

  if (!archived) {
    throw new AssistantError(
      "Skill changed while it was being removed",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  try {
    await new SkillDocumentStorage(context).delete(scope, name);
  } catch (error) {
    context
      .getLogger({ prefix: "services/skills" })
      .error("Failed to remove a legacy authored skill object", { error, scope, name });
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
    await cleanFailedRevision(context, new SkillDocumentStorage(context), creation.storageKey);
  }

  return purged;
}

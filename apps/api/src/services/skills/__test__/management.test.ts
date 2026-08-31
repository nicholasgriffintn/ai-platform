import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type {
  AppendAuthoredSkillRevisionInput,
  AuthoredSkillRecord,
  AuthoredSkillRevisionRecord,
  AuthoredSkillScope,
  CreateAuthoredSkillInput,
} from "~/repositories/AuthoredSkillRepository";
import { AssistantError, ErrorType } from "~/utils/errors";

import { resolveSkillCatalog } from "../catalog";
import { listScopedSkillSummaries } from "../listing";
import {
  createPersonalSkill,
  deletePersonalSkill,
  deleteProjectSkill,
  getPersonalSkillHistory,
  getPersonalSkillVersion,
  getProjectSkill,
  getProjectSkillHistory,
  importPersonalSkill,
  importProjectSkill,
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
} from "../management";
import { getStoredSkill, saveStoredSkillDraft } from "../persistence";
import { formatSkillContent } from "../response";

const requireProjectAccessMock = vi.hoisted(() => vi.fn());
const recordProjectAuditMock = vi.hoisted(() => vi.fn());

vi.mock("~/services/workspaces/access", () => ({
  requireProjectAccess: requireProjectAccessMock,
}));

vi.mock("~/services/audit", () => ({
  recordProjectAudit: recordProjectAuditMock,
}));

const content =
  "---\nname: meeting-notes\ndescription: Turn rough meeting notes into clear decisions and actions.\n---\n\n# Meeting notes\n\nExtract decisions and actions.";

function createBucket() {
  const objects = new Map<
    string,
    { key: string; content: string; customMetadata?: Record<string, string>; uploaded: Date }
  >();
  const head = vi.fn(async (key: string) => objects.get(key) ?? null);
  const get = vi.fn(async (key: string) => {
    const object = objects.get(key);

    return object ? { ...object, text: async () => object.content } : null;
  });
  const put = vi.fn(
    async (
      key: string,
      nextContent: string,
      options?: { customMetadata?: Record<string, string> },
    ) => {
      const object = {
        key,
        content: nextContent,
        customMetadata: options?.customMetadata,
        uploaded: new Date("2026-08-16T10:00:00.000Z"),
      };

      objects.set(key, object);

      return object;
    },
  );
  const list = vi.fn(async ({ prefix = "" }: { prefix?: string } = {}) => ({
    objects: [...objects.values()].filter((object) => object.key.startsWith(prefix)),
    delimitedPrefixes: [],
    truncated: false as const,
  }));
  const deleteObject = vi.fn(async (key: string) => {
    objects.delete(key);
  });

  return { objects, head, get, put, list, delete: deleteObject };
}

function scopeMatches(skill: AuthoredSkillRecord, scope: AuthoredSkillScope) {
  return skill.scopeType === scope.type && skill.scopeId === String(scope.id);
}

function createAuthoredSkillsRepository() {
  const skills = new Map<string, AuthoredSkillRecord>();
  const revisions = new Map<string, AuthoredSkillRevisionRecord>();
  let nextId = 1;
  const getById = vi.fn(async (skillId: string) => skills.get(skillId) ?? null);
  const getByScopeAndName = vi.fn(
    async (scope: AuthoredSkillScope, name: string) =>
      [...skills.values()].find(
        (skill) => !skill.archivedAt && scopeMatches(skill, scope) && skill.name === name,
      ) ?? null,
  );
  const create = vi.fn(async (input: CreateAuthoredSkillInput) => {
    if (await getByScopeAndName(input.scope, input.name)) {
      throw new AssistantError("Skill already exists", ErrorType.CONFLICT_ERROR, 409);
    }

    const id = input.id ?? `skill-${nextId++}`;
    const revisionId = `revision-${nextId++}`;
    const now = "2026-08-16T10:00:00.000Z";
    const skill: AuthoredSkillRecord = {
      id,
      scopeType: input.scope.type,
      scopeId: String(input.scope.id),
      name: input.name,
      createdByUserId: input.createdByUserId,
      draftRevisionId: revisionId,
      stableRevisionId: revisionId,
      stateVersion: 1,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const revision: AuthoredSkillRevisionRecord = {
      id: revisionId,
      skillId: id,
      revision: 1,
      description: input.description,
      changeNote: input.changeNote ?? null,
      digest: input.digest,
      storageKey: input.storageKey,
      size: input.size,
      sourceSkillId: input.source?.skillId ?? null,
      sourceRevisionId: input.source?.revisionId ?? null,
      createdByUserId: input.createdByUserId,
      createdAt: now,
    };

    skills.set(id, skill);
    revisions.set(revisionId, revision);

    return { skill, revision };
  });
  const appendRevision = vi.fn(async (input: AppendAuthoredSkillRevisionInput) => {
    const current = skills.get(input.skillId);

    if (
      !current ||
      current.stateVersion !== input.expectedStateVersion ||
      current.draftRevisionId !== input.expectedDraftRevisionId
    ) {
      return null;
    }

    const currentRevision = revisions.get(current.draftRevisionId);

    if (!currentRevision) {
      throw new Error("Missing draft revision");
    }

    const id = `revision-${nextId++}`;
    const now = "2026-08-16T11:00:00.000Z";
    const revision: AuthoredSkillRevisionRecord = {
      id,
      skillId: current.id,
      revision: currentRevision.revision + 1,
      description: input.description,
      changeNote: input.changeNote ?? null,
      digest: input.digest,
      storageKey: input.storageKey,
      size: input.size,
      sourceSkillId: input.source?.skillId ?? null,
      sourceRevisionId: input.source?.revisionId ?? null,
      createdByUserId: input.createdByUserId,
      createdAt: now,
    };
    const skill = {
      ...current,
      draftRevisionId: id,
      stableRevisionId: input.activate ? id : current.stableRevisionId,
      stateVersion: current.stateVersion + 1,
      updatedAt: now,
    };

    revisions.set(id, revision);
    skills.set(skill.id, skill);

    return { skill, revision };
  });
  const getRevision = vi.fn(async (revisionId: string) => revisions.get(revisionId) ?? null);
  const getRevisionForSkill = vi.fn(async (skillId: string, revisionId: string) => {
    const revision = revisions.get(revisionId);

    return revision?.skillId === skillId ? revision : null;
  });
  const getRevisionByStorageKey = vi.fn(
    async (skillId: string, storageKey: string) =>
      [...revisions.values()].find(
        (revision) => revision.skillId === skillId && revision.storageKey === storageKey,
      ) ?? null,
  );
  const getCurrentRevision = vi.fn(async (skillId: string, pointer: "draft" | "stable") => {
    const skill = skills.get(skillId);

    return skill
      ? (revisions.get(pointer === "draft" ? skill.draftRevisionId : skill.stableRevisionId) ??
          null)
      : null;
  });
  const listByScope = vi.fn(async (scope: AuthoredSkillScope) =>
    [...skills.values()].filter((skill) => !skill.archivedAt && scopeMatches(skill, scope)),
  );
  const listRevisions = vi.fn(async (skillId: string) =>
    [...revisions.values()].filter((revision) => revision.skillId === skillId),
  );
  const promoteDraft = vi.fn(
    async (skillId: string, draftRevisionId: string, expectedStateVersion: number) => {
      const skill = skills.get(skillId);

      if (
        !skill ||
        skill.archivedAt ||
        skill.draftRevisionId !== draftRevisionId ||
        skill.stateVersion !== expectedStateVersion
      ) {
        return null;
      }

      const promoted = {
        ...skill,
        stableRevisionId: draftRevisionId,
        stateVersion: skill.stateVersion + 1,
        updatedAt: "2026-08-16T11:30:00.000Z",
      };

      skills.set(skillId, promoted);

      return promoted;
    },
  );
  const archive = vi.fn(async (skillId: string, expectedStateVersion?: number) => {
    const skill = skills.get(skillId);

    if (!skill || (expectedStateVersion && expectedStateVersion !== skill.stateVersion)) {
      return null;
    }

    const archived = {
      ...skill,
      stateVersion: skill.stateVersion + 1,
      archivedAt: "2026-08-16T12:00:00.000Z",
      updatedAt: "2026-08-16T12:00:00.000Z",
    };

    skills.set(skillId, archived);

    return archived;
  });
  const purge = vi.fn(
    async (skillId: string, expectedStateVersion: number, expectedRevisionId: string) => {
      const skill = skills.get(skillId);

      if (
        !skill ||
        skill.stateVersion !== expectedStateVersion ||
        skill.draftRevisionId !== expectedRevisionId ||
        skill.stableRevisionId !== expectedRevisionId
      ) {
        return false;
      }

      skills.delete(skillId);

      for (const [revisionId, revision] of revisions) {
        if (revision.skillId === skillId) {
          revisions.delete(revisionId);
        }
      }

      return true;
    },
  );

  return {
    appendRevision,
    archive,
    create,
    getById,
    getByScopeAndName,
    getCurrentRevision,
    getRevision,
    getRevisionForSkill,
    getRevisionByStorageKey,
    listByScope,
    listRevisions,
    promoteDraft,
    purge,
    revisions,
    skills,
  };
}

function createContext() {
  const bucket = createBucket();
  const authoredSkills = createAuthoredSkillsRepository();
  const workspaces = {
    addProjectCapability: vi.fn().mockResolvedValue(undefined),
    listProjectCapabilities: vi.fn().mockResolvedValue([]),
    removeProjectCapability: vi.fn().mockResolvedValue(undefined),
  };
  const capabilityConfigurations = { save: vi.fn().mockResolvedValue(undefined) };
  const logger = { error: vi.fn() };
  const context = {
    env: { PRIVATE_ASSETS_BUCKET: bucket },
    repositories: { authoredSkills, workspaces, capabilityConfigurations },
    getLogger: () => logger,
  } as unknown as ServiceContext;

  return { authoredSkills, bucket, capabilityConfigurations, context, logger, workspaces };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireProjectAccessMock.mockResolvedValue({
    project: { id: "project-1", workspace_id: "workspace-1" },
    role: "admin",
  });
  recordProjectAuditMock.mockResolvedValue(undefined);
});

describe("personal skill management", () => {
  it("reports malformed user documents as request errors", async () => {
    const { context } = createContext();

    await expect(
      createPersonalSkill(context, 42, { content: "# Missing frontmatter" }),
    ).rejects.toMatchObject({ statusCode: 400, type: "PARAMS_ERROR" });
  });

  it("stores the first complete immutable revision and makes it active", async () => {
    const { authoredSkills, bucket, capabilityConfigurations, context } = createContext();

    const result = await createPersonalSkill(context, 42, { content });

    expect(bucket.put).toHaveBeenCalledOnce();
    expect(bucket.put.mock.calls[0]?.[0]).toMatch(
      /^skills\/authored\/[^/]+\/revisions\/[^/]+\.json$/,
    );
    expect(JSON.parse(bucket.put.mock.calls[0]?.[1] ?? "{}")).toMatchObject({
      version: 1,
      content,
      resources: [],
      digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(authoredSkills.create).toHaveBeenCalledWith(
      expect.objectContaining({ scope: { type: "personal", id: 42 } }),
    );
    expect(capabilityConfigurations.save).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: "meeting-notes",
      name: "meeting-notes",
      scope: { type: "personal" },
      content,
    });
  });

  it("accepts a creation that D1 committed before returning an ambiguous error", async () => {
    const { authoredSkills, bucket, capabilityConfigurations, context } = createContext();
    const commit = authoredSkills.create.getMockImplementation();

    authoredSkills.create.mockImplementationOnce(async (input) => {
      await commit?.(input);
      throw new Error("D1 response was lost after commit");
    });

    await expect(createPersonalSkill(context, 42, { content })).resolves.toMatchObject({
      name: "meeting-notes",
      content,
    });
    expect(capabilityConfigurations.save).not.toHaveBeenCalled();
    expect(
      [...bucket.objects.keys()].filter((key) => key.startsWith("skills/authored/")),
    ).toHaveLength(1);
  });

  it("updates through a new immutable revision and keeps the public PUT active", async () => {
    const { authoredSkills, bucket, context } = createContext();
    const updatedContent = content.replace("Extract decisions and actions.", "Extract owners.");

    await createPersonalSkill(context, 42, { content });
    const originalKey = bucket.put.mock.calls[0]?.[0] ?? "";
    const updated = await updatePersonalSkill(context, 42, "meeting-notes", {
      content: updatedContent,
    });
    const catalog = await resolveSkillCatalog(context, { type: "personal", id: 42 });

    expect(bucket.put).toHaveBeenCalledTimes(2);
    expect(JSON.parse(bucket.objects.get(originalKey)?.content ?? "{}")).toMatchObject({ content });
    expect(updated.content).toBe(updatedContent);
    expect(catalog.load("meeting-notes")?.body).toContain("Extract owners.");
    expect(authoredSkills.appendRevision).toHaveBeenCalledWith(
      expect.objectContaining({ activate: true }),
    );
  });

  it("accepts an active update that D1 committed before returning an ambiguous error", async () => {
    const { authoredSkills, bucket, context } = createContext();
    const updatedContent = content.replace("Extract decisions and actions.", "Extract owners.");

    await createPersonalSkill(context, 42, { content });
    const commit = authoredSkills.appendRevision.getMockImplementation();

    authoredSkills.appendRevision.mockImplementationOnce(async (input) => {
      await commit?.(input);
      throw new Error("D1 response was lost after commit");
    });

    await expect(
      updatePersonalSkill(context, 42, "meeting-notes", { content: updatedContent }),
    ).resolves.toMatchObject({ content: updatedContent });
    expect(bucket.delete).not.toHaveBeenCalledWith(
      expect.stringMatching(/^skills\/authored\/.*\/revisions\/.*\.json$/),
    );

    const catalog = await resolveSkillCatalog(context, { type: "personal", id: 42 });

    expect(catalog.load("meeting-notes")?.body).toContain("Extract owners.");
  });

  it("builds the runtime catalogue from the exact stable revision, not the newer draft", async () => {
    const { context } = createContext();
    const draftContent = content.replace(
      "Extract decisions and actions.",
      "This draft must not be active.",
    );

    await createPersonalSkill(context, 42, {
      content,
      resources: [{ path: "references/templates/guide.md", content: "Stable guide" }],
    });
    await saveStoredSkillDraft(
      context,
      { type: "personal", id: 42 },
      "meeting-notes",
      {
        content: draftContent,
        description: "Draft description",
        createdByUserId: 42,
        resources: [{ path: "references/templates/guide.md", content: "Draft guide" }],
      },
      { activate: false },
    );

    await expect(
      getStoredSkill(context, { type: "personal", id: 42 }, "meeting-notes"),
    ).resolves.toMatchObject({
      content: draftContent,
      resources: [{ path: "references/templates/guide.md", content: "Draft guide" }],
    });

    const catalog = await resolveSkillCatalog(context, { type: "personal", id: 42 });

    expect(catalog.load("meeting-notes")?.body).toContain("Extract decisions and actions.");
    expect(catalog.load("meeting-notes")?.body).not.toContain("This draft must not be active.");
    expect(catalog.readResource("meeting-notes", "references/templates/guide.md")?.content).toBe(
      "Stable guide",
    );
  });

  it("does not create another immutable object for an unchanged bundle", async () => {
    const { bucket, context } = createContext();

    await createPersonalSkill(context, 42, { content });
    await updatePersonalSkill(context, 42, "meeting-notes", { content });

    expect(bucket.put).toHaveBeenCalledOnce();
  });

  it("cleans the R2 object when the atomic personal create batch fails", async () => {
    const { authoredSkills, bucket, capabilityConfigurations, context } = createContext();

    authoredSkills.create.mockRejectedValueOnce(new Error("configuration unavailable"));

    await expect(createPersonalSkill(context, 42, { content })).rejects.toThrow(
      "configuration unavailable",
    );
    expect(authoredSkills.purge).not.toHaveBeenCalled();
    expect(capabilityConfigurations.save).not.toHaveBeenCalled();
    expect([...bucket.objects.keys()].filter((key) => key.startsWith("skills/authored/"))).toEqual(
      [],
    );
  });

  it("does not create D1 state when the immutable object write fails", async () => {
    const { authoredSkills, bucket, context } = createContext();

    bucket.put.mockRejectedValueOnce(new Error("R2 unavailable"));

    await expect(createPersonalSkill(context, 42, { content })).rejects.toThrow("R2 unavailable");
    expect(authoredSkills.create).not.toHaveBeenCalled();
    expect(authoredSkills.skills.size).toBe(0);
  });

  it("preserves the D1 failure and reports an unreachable R2 revision when cleanup fails", async () => {
    const { authoredSkills, bucket, context, logger } = createContext();
    const d1Error = new Error("D1 unavailable");

    authoredSkills.create.mockRejectedValueOnce(d1Error);
    bucket.delete.mockRejectedValueOnce(new Error("R2 cleanup unavailable"));

    await expect(createPersonalSkill(context, 42, { content })).rejects.toBe(d1Error);
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to clean up an unreachable authored skill revision",
      expect.objectContaining({ error: expect.any(Error), storageKey: expect.any(String) }),
    );
    expect(
      [...bucket.objects.keys()].filter((key) => key.startsWith("skills/authored/")),
    ).toHaveLength(1);
  });

  it("leaves the active revision intact when a concurrent update wins the CAS", async () => {
    const { authoredSkills, bucket, context } = createContext();
    const updatedContent = content.replace("Extract decisions and actions.", "Extract owners.");

    await createPersonalSkill(context, 42, { content });
    authoredSkills.appendRevision.mockResolvedValueOnce(null);

    await expect(
      updatePersonalSkill(context, 42, "meeting-notes", { content: updatedContent }),
    ).rejects.toMatchObject({ statusCode: 409, type: "CONFLICT_ERROR" });
    expect(
      [...bucket.objects.keys()].filter((key) => key.startsWith("skills/authored/")),
    ).toHaveLength(1);
    const catalog = await resolveSkillCatalog(context, { type: "personal", id: 42 });

    expect(catalog.load("meeting-notes")?.body).toContain("Extract decisions and actions.");
  });

  it("does not let an update change the stable skill name", async () => {
    const { context } = createContext();

    await createPersonalSkill(context, 42, { content });
    const renamed = content.replaceAll("meeting-notes", "renamed-skill");

    await expect(
      updatePersonalSkill(context, 42, "meeting-notes", { content: renamed }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("does not reveal another user's personal skill", async () => {
    const { context } = createContext();

    await createPersonalSkill(context, 42, { content });

    await expect(
      updatePersonalSkill(context, 99, "meeting-notes", { content }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("loads an authored document through the runtime catalogue as untrusted content", async () => {
    const { context } = createContext();

    await createPersonalSkill(context, 42, { content });

    const catalog = await resolveSkillCatalog(context, { type: "personal", id: 42 });
    const loaded = catalog.load("meeting-notes");

    expect(loaded).toMatchObject({ name: "meeting-notes", source: "user-authored" });
    expect(formatSkillContent(loaded)).toContain(
      '<skill_content name="meeting-notes" source="user-authored">',
    );
  });

  it("includes an authored skill in the existing personal capability catalogue", async () => {
    const { context } = createContext();

    await createPersonalSkill(context, 42, { content });

    const skills = await listScopedSkillSummaries(context, 42);

    expect(skills).toContainEqual(
      expect.objectContaining({
        id: "meeting-notes",
        name: "meeting-notes",
        source: "user-authored",
      }),
    );
  });

  it("archives a personal skill while preserving its immutable revision", async () => {
    const { bucket, context } = createContext();

    await createPersonalSkill(context, 42, { content });

    await deletePersonalSkill(context, 42, "meeting-notes");

    expect(bucket.delete).not.toHaveBeenCalled();
    expect([...bucket.objects.keys()]).toHaveLength(1);
    expect(await listScopedSkillSummaries(context, 42)).not.toContainEqual(
      expect.objectContaining({ id: "meeting-notes" }),
    );
  });

  it("allows an archived skill name to be created again", async () => {
    const { context } = createContext();

    await createPersonalSkill(context, 42, { content });
    await deletePersonalSkill(context, 42, "meeting-notes");

    await expect(createPersonalSkill(context, 42, { content })).resolves.toMatchObject({
      name: "meeting-notes",
    });
  });

  it("rejects unsafe authored resource paths before storing a revision", async () => {
    const unsafePaths = [
      "../secret.md",
      "/references/secret.md",
      "files/secret.md",
      "references//secret.md",
      "references/./secret.md",
      "references/../secret.md",
      "references\\secret.md",
      "references/bad\npath.md",
      `references/${"a".repeat(502)}`,
    ];

    await Promise.all(
      unsafePaths.map(async (path) => {
        const { authoredSkills, bucket, context } = createContext();

        await expect(
          createPersonalSkill(context, 42, {
            content,
            resources: [{ path, content: "secret" }],
          }),
        ).rejects.toThrow();
        expect(bucket.put).not.toHaveBeenCalled();
        expect(authoredSkills.create).not.toHaveBeenCalled();
      }),
    );
  });

  it("keeps a saved draft out of runtime until an exact CAS promotion", async () => {
    const { bucket, context } = createContext();
    const draftContent = content.replace("Extract decisions and actions.", "Extract owners.");
    const created = await createPersonalSkill(context, 42, { content });
    const initialHistory = await getPersonalSkillHistory(context, 42, created.name);
    const initialRevisionId = initialHistory.state.stableRevisionId;
    const draft = await savePersonalSkillDraft(context, 42, created.name, {
      content: draftContent,
      expectedStateVersion: initialHistory.state.stateVersion,
      changeNote: "Track owners",
    });

    expect(draft.state).toMatchObject({
      draftRevisionId: draft.revision.id,
      stableRevisionId: initialRevisionId,
      stateVersion: 2,
    });
    expect(
      (await resolveSkillCatalog(context, { type: "personal", id: 42 })).load(created.name)?.body,
    ).toContain("Extract decisions and actions.");

    const promoted = await promotePersonalSkillDraft(context, 42, created.name, {
      revisionId: draft.revision.id,
      expectedStateVersion: draft.state.stateVersion,
    });

    expect(promoted.state).toMatchObject({
      draftRevisionId: draft.revision.id,
      stableRevisionId: draft.revision.id,
      stateVersion: 3,
    });
    expect(
      (await resolveSkillCatalog(context, { type: "personal", id: 42 })).load(created.name)?.body,
    ).toContain("Extract owners.");
    expect((await getPersonalSkillHistory(context, 42, created.name)).revisions).toHaveLength(2);
    expect(bucket.put).toHaveBeenCalledTimes(2);
  });

  it("rejects a stale draft before writing another immutable object", async () => {
    const { bucket, context } = createContext();

    await createPersonalSkill(context, 42, { content });
    const writes = bucket.put.mock.calls.length;

    await expect(
      savePersonalSkillDraft(context, 42, "meeting-notes", {
        content: content.replace("Extract decisions and actions.", "Extract owners."),
        expectedStateVersion: 99,
      }),
    ).rejects.toMatchObject({ type: ErrorType.CONFLICT_ERROR, statusCode: 409 });
    expect(bucket.put).toHaveBeenCalledTimes(writes);
  });

  it("rolls back by appending a new active revision linked to the selected revision", async () => {
    const { authoredSkills, context } = createContext();
    const updatedContent = content.replace("Extract decisions and actions.", "Extract owners.");

    await createPersonalSkill(context, 42, { content });
    const initial = await getPersonalSkillHistory(context, 42, "meeting-notes");

    await updatePersonalSkill(context, 42, "meeting-notes", { content: updatedContent });
    const current = await getPersonalSkillHistory(context, 42, "meeting-notes");
    const sourceRevision = initial.revisions[0];

    if (!sourceRevision) {
      throw new Error("Expected initial revision");
    }

    const rolledBack = await rollbackPersonalSkill(context, 42, "meeting-notes", {
      revisionId: sourceRevision.id,
      expectedStateVersion: current.state.stateVersion,
    });

    expect(rolledBack.content).toBe(content);
    expect(rolledBack.revision).toMatchObject({
      revision: 3,
      sourceRevisionId: sourceRevision.id,
      sourceSkillId: sourceRevision.skillId,
    });
    expect(rolledBack.state).toMatchObject({
      draftRevisionId: rolledBack.revision.id,
      stableRevisionId: rolledBack.revision.id,
      stateVersion: 3,
    });
    expect(authoredSkills.appendRevision).toHaveBeenLastCalledWith(
      expect.objectContaining({ activate: true, source: expect.any(Object) }),
    );
  });

  it("imports an exact authorised project revision with lineage", async () => {
    const { authoredSkills, context, workspaces } = createContext();

    await publishProjectSkill(context, 42, "source-project", { content });
    const sourceSkill = [...authoredSkills.skills.values()].find(
      (skill) => skill.scopeId === "source-project",
    );

    if (!sourceSkill) {
      throw new Error("Expected source project skill");
    }

    workspaces.listProjectCapabilities.mockResolvedValue([
      {
        id: "source-capability",
        project_id: "source-project",
        kind: "skill",
        capability_id: "meeting-notes",
        configuration: {},
        created_by: 42,
      },
    ]);

    const imported = await importPersonalSkill(context, 42, {
      source: {
        scope: { type: "project", projectId: "source-project" },
        skillId: "meeting-notes",
        revisionId: sourceSkill.stableRevisionId,
      },
    });

    expect(imported.scope).toEqual({ type: "personal" });
    expect(imported.revision).toMatchObject({
      sourceSkillId: sourceSkill.id,
      sourceRevisionId: sourceSkill.stableRevisionId,
    });
    expect(requireProjectAccessMock).toHaveBeenCalledWith(context, "source-project", [
      "owner",
      "admin",
    ]);
    await expect(
      getPersonalSkillVersion(context, 42, imported.name, imported.revision.id),
    ).resolves.toMatchObject({ content });
  });

  it("imports the requested project revision rather than a newer version", async () => {
    const { authoredSkills, context, workspaces } = createContext();
    const newerContent = content.replace(
      "Extract decisions and actions.",
      "This newer version must not be imported.",
    );

    await publishProjectSkill(context, 42, "source-project", {
      content,
      resources: [{ path: "references/guide.md", content: "Version one guide" }],
    });
    const sourceSkill = [...authoredSkills.skills.values()].find(
      (skill) => skill.scopeId === "source-project",
    );

    if (!sourceSkill) {
      throw new Error("Expected source project skill");
    }

    workspaces.listProjectCapabilities.mockResolvedValue([
      {
        id: "source-capability",
        project_id: "source-project",
        kind: "skill",
        capability_id: "meeting-notes",
        configuration: {},
        created_by: 42,
      },
    ]);
    await updateProjectSkill(context, 42, "source-project", "meeting-notes", {
      content: newerContent,
      resources: [{ path: "references/guide.md", content: "Version two guide" }],
    });

    const imported = await importPersonalSkill(context, 42, {
      source: {
        scope: { type: "project", projectId: "source-project" },
        skillId: "meeting-notes",
        revisionId: sourceSkill.stableRevisionId,
      },
    });

    expect(imported).toMatchObject({
      content,
      resources: [{ path: "references/guide.md", content: "Version one guide" }],
      revision: {
        sourceSkillId: sourceSkill.id,
        sourceRevisionId: sourceSkill.stableRevisionId,
      },
    });
  });

  it("denies an unpublished project source for personal and project imports", async () => {
    const { authoredSkills, bucket, context, workspaces } = createContext();

    await publishProjectSkill(context, 42, "source-project", { content });
    const sourceSkill = [...authoredSkills.skills.values()][0];

    if (!sourceSkill) {
      throw new Error("Expected source project skill");
    }

    workspaces.listProjectCapabilities.mockResolvedValue([]);
    const source = {
      scope: { type: "project" as const, projectId: "source-project" },
      skillId: "meeting-notes",
      revisionId: sourceSkill.stableRevisionId,
    };
    const createdBefore = authoredSkills.create.mock.calls.length;
    const objectsBefore = bucket.objects.size;

    await expect(importPersonalSkill(context, 42, { source })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      importProjectSkill(context, 42, "target-project", { source }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(authoredSkills.create).toHaveBeenCalledTimes(createdBefore);
    expect(bucket.objects.size).toBe(objectsBefore);
  });
});

describe("project skill publishing", () => {
  it("publishes to R2 only after an owner or admin check and adds the project grant", async () => {
    const { bucket, context, workspaces } = createContext();

    const result = await publishProjectSkill(context, 42, "project-1", { content });

    expect(requireProjectAccessMock).toHaveBeenCalledWith(context, "project-1", ["owner", "admin"]);
    expect(bucket.put.mock.calls[0]?.[0]).toMatch(
      /^skills\/authored\/[^/]+\/revisions\/[^/]+\.json$/,
    );
    expect(workspaces.addProjectCapability).toHaveBeenCalledWith({
      id: expect.any(String),
      projectId: "project-1",
      kind: "skill",
      capabilityId: "meeting-notes",
      configuration: {},
      createdBy: 42,
    });
    expect(recordProjectAuditMock).toHaveBeenCalledWith(context, "project-1", {
      actorUserId: 42,
      action: "skill.published",
      targetType: "skill",
      targetId: "meeting-notes",
      metadata: { name: "meeting-notes" },
    });
    expect(result.scope).toEqual({ type: "project", projectId: "project-1" });
  });

  it("restores the project capability when archival conflicts", async () => {
    const { authoredSkills, context, workspaces } = createContext();

    await publishProjectSkill(context, 42, "project-1", { content });
    workspaces.listProjectCapabilities.mockResolvedValue([
      {
        id: "capability-1",
        project_id: "project-1",
        kind: "skill",
        capability_id: "meeting-notes",
        configuration: {},
        created_by: 42,
      },
    ]);
    workspaces.addProjectCapability.mockClear();
    authoredSkills.archive.mockRejectedValueOnce(new Error("archive failed"));

    await expect(deleteProjectSkill(context, 42, "project-1", "meeting-notes")).rejects.toThrow(
      "archive failed",
    );
    expect(workspaces.addProjectCapability).toHaveBeenCalledWith({
      id: "capability-1",
      projectId: "project-1",
      kind: "skill",
      capabilityId: "meeting-notes",
      configuration: {},
      createdBy: 42,
    });
  });

  it("attributes a project revision to the administrator who made the edit", async () => {
    const { authoredSkills, context, workspaces } = createContext();
    const updatedContent = content.replace("Extract decisions and actions.", "Extract owners.");

    await publishProjectSkill(context, 42, "project-1", { content });
    workspaces.listProjectCapabilities.mockResolvedValue([
      {
        id: "capability-1",
        project_id: "project-1",
        kind: "skill",
        capability_id: "meeting-notes",
        configuration: {},
        created_by: 42,
      },
    ]);

    await updateProjectSkill(context, 99, "project-1", "meeting-notes", {
      content: updatedContent,
    });

    expect(authoredSkills.appendRevision).toHaveBeenCalledWith(
      expect.objectContaining({ createdByUserId: 99 }),
    );
  });

  it("keeps project drafts private from member reads and records the draft audit", async () => {
    const { authoredSkills, context, workspaces } = createContext();
    const draftContent = content.replace("Extract decisions and actions.", "Private draft.");

    await publishProjectSkill(context, 42, "project-1", { content });
    workspaces.listProjectCapabilities.mockResolvedValue([
      {
        id: "capability-1",
        project_id: "project-1",
        kind: "skill",
        capability_id: "meeting-notes",
        configuration: {},
        created_by: 42,
      },
    ]);
    const skill = [...authoredSkills.skills.values()][0];

    if (!skill) {
      throw new Error("Expected project skill");
    }

    await saveProjectSkillDraft(context, 99, "project-1", "meeting-notes", {
      content: draftContent,
      expectedStateVersion: skill.stateVersion,
    });

    await expect(getProjectSkill(context, "project-1", "meeting-notes")).resolves.toMatchObject({
      content,
    });
    await expect(listProjectSkills(context, "project-1")).resolves.toMatchObject({
      skills: [
        expect.objectContaining({
          description: "Turn rough meeting notes into clear decisions and actions.",
        }),
      ],
    });
    expect(
      (await resolveSkillCatalog(context, { type: "project", id: "project-1" })).load(
        "meeting-notes",
      )?.body,
    ).toContain("Extract decisions and actions.");
    expect(authoredSkills.appendRevision).toHaveBeenLastCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({
          workspaceId: "workspace-1",
          action: "skill.draft_saved",
          actorUserId: 99,
        }),
      }),
    );
    expect(recordProjectAuditMock).not.toHaveBeenCalledWith(
      context,
      "project-1",
      expect.objectContaining({ action: "skill.draft_saved" }),
    );
    expect(requireProjectAccessMock).toHaveBeenCalledWith(context, "project-1", ["owner", "admin"]);
  });

  it("denies a project member before any draft mutation", async () => {
    const { authoredSkills, bucket, context, workspaces } = createContext();

    await publishProjectSkill(context, 42, "project-1", { content });
    workspaces.listProjectCapabilities.mockResolvedValue([
      {
        id: "capability-1",
        project_id: "project-1",
        kind: "skill",
        capability_id: "meeting-notes",
        configuration: {},
        created_by: 42,
      },
    ]);
    const skill = [...authoredSkills.skills.values()][0];

    if (!skill) {
      throw new Error("Expected project skill");
    }

    authoredSkills.appendRevision.mockClear();
    bucket.put.mockClear();
    requireProjectAccessMock.mockRejectedValueOnce(
      new AssistantError("You do not have access to this workspace", ErrorType.FORBIDDEN, 403),
    );

    await expect(
      saveProjectSkillDraft(context, 99, "project-1", "meeting-notes", {
        content: content.replace("Extract decisions and actions.", "Private member edit."),
        expectedStateVersion: skill.stateVersion,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(authoredSkills.appendRevision).not.toHaveBeenCalled();
    expect(bucket.put).not.toHaveBeenCalled();
    expect(authoredSkills.revisions.size).toBe(1);
  });

  it("does not audit an unchanged project draft", async () => {
    const { authoredSkills, context, workspaces } = createContext();

    await publishProjectSkill(context, 42, "project-1", { content });
    workspaces.listProjectCapabilities.mockResolvedValue([
      {
        id: "capability-1",
        project_id: "project-1",
        kind: "skill",
        capability_id: "meeting-notes",
        configuration: {},
        created_by: 42,
      },
    ]);
    const skill = [...authoredSkills.skills.values()][0];

    if (!skill) {
      throw new Error("Expected project skill");
    }

    authoredSkills.appendRevision.mockClear();
    recordProjectAuditMock.mockClear();
    await saveProjectSkillDraft(context, 42, "project-1", "meeting-notes", {
      content,
      expectedStateVersion: skill.stateVersion,
    });

    expect(authoredSkills.appendRevision).not.toHaveBeenCalled();
    expect(recordProjectAuditMock).not.toHaveBeenCalled();
  });

  it("passes imported project publication and audit through the atomic create", async () => {
    const { authoredSkills, context, workspaces } = createContext();

    await createPersonalSkill(context, 42, { content });
    const sourceSkill = [...authoredSkills.skills.values()][0];

    if (!sourceSkill) {
      throw new Error("Expected personal source skill");
    }

    workspaces.listProjectCapabilities.mockResolvedValue([
      {
        id: "target-capability",
        project_id: "project-1",
        kind: "skill",
        capability_id: "meeting-notes",
        configuration: {},
        created_by: 42,
      },
    ]);
    workspaces.addProjectCapability.mockClear();
    recordProjectAuditMock.mockClear();

    await importProjectSkill(context, 42, "project-1", {
      source: {
        scope: { type: "personal" },
        skillId: "meeting-notes",
        revisionId: sourceSkill.stableRevisionId,
      },
    });

    expect(authoredSkills.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        scope: { type: "project", id: "project-1" },
        projectPublication: {
          projectId: "project-1",
          audit: expect.objectContaining({
            workspaceId: "workspace-1",
            actorUserId: 42,
            action: "skill.imported",
            targetId: "meeting-notes",
            metadata: {
              name: "meeting-notes",
              sourceRevisionId: sourceSkill.stableRevisionId,
            },
          }),
        },
      }),
    );
    expect(workspaces.addProjectCapability).not.toHaveBeenCalled();
    expect(recordProjectAuditMock).not.toHaveBeenCalled();
  });

  it("passes project promotion audit through the CAS and emits nothing for a no-op", async () => {
    const { authoredSkills, context, workspaces } = createContext();
    const draftContent = content.replace("Extract decisions and actions.", "Promoted content.");

    await publishProjectSkill(context, 42, "project-1", { content });
    workspaces.listProjectCapabilities.mockResolvedValue([
      {
        id: "capability-1",
        project_id: "project-1",
        kind: "skill",
        capability_id: "meeting-notes",
        configuration: {},
        created_by: 42,
      },
    ]);
    const skill = [...authoredSkills.skills.values()][0];

    if (!skill) {
      throw new Error("Expected project skill");
    }

    const draft = await saveProjectSkillDraft(context, 42, "project-1", "meeting-notes", {
      content: draftContent,
      expectedStateVersion: skill.stateVersion,
    });

    recordProjectAuditMock.mockClear();
    const promoted = await promoteProjectSkillDraft(context, 42, "project-1", "meeting-notes", {
      revisionId: draft.revision.id,
      expectedStateVersion: draft.state.stateVersion,
    });

    expect(authoredSkills.promoteDraft).toHaveBeenLastCalledWith(
      skill.id,
      draft.revision.id,
      draft.state.stateVersion,
      expect.objectContaining({
        workspaceId: "workspace-1",
        actorUserId: 42,
        action: "skill.promoted",
      }),
    );
    expect(recordProjectAuditMock).not.toHaveBeenCalled();

    authoredSkills.promoteDraft.mockClear();
    await promoteProjectSkillDraft(context, 42, "project-1", "meeting-notes", {
      revisionId: promoted.revision.id,
      expectedStateVersion: promoted.state.stateVersion,
    });
    expect(authoredSkills.promoteDraft).not.toHaveBeenCalled();
    expect(recordProjectAuditMock).not.toHaveBeenCalled();
  });

  it("passes rollback lineage and audit through one revision CAS", async () => {
    const { authoredSkills, context, workspaces } = createContext();
    const updatedContent = content.replace("Extract decisions and actions.", "Updated content.");

    await publishProjectSkill(context, 42, "project-1", { content });
    workspaces.listProjectCapabilities.mockResolvedValue([
      {
        id: "capability-1",
        project_id: "project-1",
        kind: "skill",
        capability_id: "meeting-notes",
        configuration: {},
        created_by: 42,
      },
    ]);
    const original = await getProjectSkillHistory(context, "project-1", "meeting-notes");
    const sourceRevision = original.revisions[0];

    if (!sourceRevision) {
      throw new Error("Expected original revision");
    }

    await updateProjectSkill(context, 42, "project-1", "meeting-notes", {
      content: updatedContent,
    });
    const current = await getProjectSkillHistory(context, "project-1", "meeting-notes");

    recordProjectAuditMock.mockClear();

    const rolledBack = await rollbackProjectSkill(context, 42, "project-1", "meeting-notes", {
      revisionId: sourceRevision.id,
      expectedStateVersion: current.state.stateVersion,
    });

    expect(rolledBack.content).toBe(content);
    expect(authoredSkills.appendRevision).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activate: true,
        source: { skillId: sourceRevision.skillId, revisionId: sourceRevision.id },
        audit: expect.objectContaining({
          workspaceId: "workspace-1",
          actorUserId: 42,
          action: "skill.rolled_back",
          metadata: {
            name: "meeting-notes",
            sourceRevisionId: sourceRevision.id,
          },
        }),
      }),
    );
    expect(recordProjectAuditMock).not.toHaveBeenCalled();
  });

  it("guards project revision history with administrator access", async () => {
    const { context, workspaces } = createContext();

    await publishProjectSkill(context, 42, "project-1", { content });
    workspaces.listProjectCapabilities.mockResolvedValue([
      {
        id: "capability-1",
        project_id: "project-1",
        kind: "skill",
        capability_id: "meeting-notes",
        configuration: {},
        created_by: 42,
      },
    ]);
    requireProjectAccessMock.mockClear();

    await expect(
      getProjectSkillHistory(context, "project-1", "meeting-notes"),
    ).resolves.toMatchObject({ revisions: [expect.objectContaining({ revision: 1 })] });
    expect(requireProjectAccessMock).toHaveBeenCalledWith(context, "project-1", ["owner", "admin"]);
  });
});

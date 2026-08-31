import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as schema from "~/lib/database/schema";
import { ErrorType } from "~/utils/errors";

import { AuthoredSkillRepository, type CreateAuthoredSkillInput } from "../AuthoredSkillRepository";

let sqlite: Database.Database;
let beforeNextBatch: (() => void | Promise<void>) | undefined;

function createRepository(): AuthoredSkillRepository {
  const repository = new AuthoredSkillRepository({ DB: {} } as any);
  const database = drizzle(sqlite, { schema });

  Object.assign(database, {
    batch: async (queries: Array<{ all(): unknown[] }>) => {
      const beforeBatch = beforeNextBatch;

      beforeNextBatch = undefined;
      await beforeBatch?.();

      return sqlite.transaction((statements: Array<{ all(): unknown[] }>) =>
        statements.map((statement) => statement.all()),
      )(queries);
    },
  });

  (repository as unknown as { database: unknown }).database = database;

  return repository;
}

function personalSkill(
  overrides: Partial<CreateAuthoredSkillInput> = {},
): CreateAuthoredSkillInput {
  return {
    id: "skill-1",
    scope: { type: "personal", id: 7 },
    name: "meeting-notes",
    description: "Turn a transcript into structured meeting notes.",
    digest: "sha256:first",
    storageKey: "skills/personal/7/skill-1/revisions/1/bundle.zip",
    size: 512,
    createdByUserId: 7,
    ...overrides,
  };
}

beforeEach(() => {
  beforeNextBatch = undefined;
  sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE user (
      id integer PRIMARY KEY NOT NULL
    );
    CREATE TABLE authored_skill (
      id text PRIMARY KEY NOT NULL,
      scope_type text NOT NULL,
      scope_id text NOT NULL,
      name text NOT NULL,
      created_by integer NOT NULL REFERENCES user(id),
      draft_revision_id text NOT NULL,
      stable_revision_id text NOT NULL,
      state_version integer DEFAULT 1 NOT NULL,
      archived_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      CONSTRAINT authored_skill_scope_type_check
        CHECK(scope_type IN ('personal', 'project')),
      CONSTRAINT authored_skill_state_version_check CHECK(state_version >= 1)
    );
    CREATE UNIQUE INDEX authored_skill_scope_name_idx
      ON authored_skill(scope_type, scope_id, name)
      WHERE archived_at IS NULL;
    CREATE TABLE authored_skill_revision (
      id text PRIMARY KEY NOT NULL,
      skill_id text NOT NULL REFERENCES authored_skill(id) ON DELETE CASCADE,
      revision integer NOT NULL,
      description text NOT NULL,
      change_note text,
      digest text NOT NULL,
      storage_key text NOT NULL UNIQUE,
      size integer NOT NULL,
      source_skill_id text,
      source_revision_id text,
      created_by integer NOT NULL REFERENCES user(id),
      created_at text NOT NULL,
      CONSTRAINT authored_skill_revision_number_check CHECK(revision >= 1),
      CONSTRAINT authored_skill_revision_size_check CHECK(size >= 0),
      CONSTRAINT authored_skill_revision_source_check CHECK(
        (source_skill_id IS NULL AND source_revision_id IS NULL)
          OR (source_skill_id IS NOT NULL AND source_revision_id IS NOT NULL)
      )
    );
    CREATE UNIQUE INDEX authored_skill_revision_skill_revision_idx
      ON authored_skill_revision(skill_id, revision);
    INSERT INTO user(id) VALUES (7), (8);
  `);
});

afterEach(() => {
  sqlite.close();
});

describe("AuthoredSkillRepository", () => {
  it("creates the first immutable revision as both draft and stable", async () => {
    const repository = createRepository();

    const created = await repository.create(personalSkill());

    expect(created.skill).toMatchObject({
      id: "skill-1",
      scopeType: "personal",
      scopeId: "7",
      name: "meeting-notes",
      draftRevisionId: expect.any(String),
      stableRevisionId: expect.any(String),
      stateVersion: 1,
      archivedAt: null,
    });
    expect(created.revision).toMatchObject({
      skillId: "skill-1",
      revision: 1,
      digest: "sha256:first",
      size: 512,
    });
    await expect(
      repository.getByScopeAndName({ type: "personal", id: 7 }, "meeting-notes"),
    ).resolves.toEqual(created.skill);
    expect(created.skill.draftRevisionId).toBe(created.revision.id);
    expect(created.skill.stableRevisionId).toBe(created.revision.id);
    await expect(
      repository.getRevisionForSkill(created.skill.id, created.revision.id),
    ).resolves.toEqual(created.revision);
  });

  it("enforces unique names within a scope while allowing the name in another scope", async () => {
    const repository = createRepository();

    await repository.create(personalSkill());

    await expect(
      repository.create(
        personalSkill({ id: "skill-2", storageKey: "skills/personal/7/skill-2/revisions/1" }),
      ),
    ).rejects.toMatchObject({ type: ErrorType.CONFLICT_ERROR, statusCode: 409 });

    await repository.create(
      personalSkill({
        id: "skill-3",
        scope: { type: "project", id: "project-1" },
        storageKey: "skills/projects/project-1/skill-3/revisions/1",
      }),
    );

    await expect(
      repository.listByScope({ type: "project", id: "project-1" }),
    ).resolves.toHaveLength(1);
  });

  it("appends a draft revision with CAS without moving the stable pointer", async () => {
    const repository = createRepository();
    const created = await repository.create(personalSkill());

    const appended = await repository.appendRevision({
      skillId: "skill-1",
      expectedStateVersion: 1,
      expectedDraftRevisionId: created.skill.draftRevisionId,
      description: "Use the approved meeting template.",
      digest: "sha256:second",
      storageKey: "skills/personal/7/skill-1/revisions/2/bundle.zip",
      size: 640,
      createdByUserId: 8,
    });

    expect(appended?.skill).toMatchObject({
      draftRevisionId: appended?.revision.id,
      stableRevisionId: created.revision.id,
      stateVersion: 2,
    });
    expect(appended?.revision).toMatchObject({ revision: 2, createdByUserId: 8 });
    await expect(repository.listRevisions("skill-1")).resolves.toMatchObject([
      { revision: 1 },
      { revision: 2 },
    ]);
    await expect(repository.getCurrentRevision("skill-1", "draft")).resolves.toEqual(
      appended?.revision,
    );
    await expect(repository.getCurrentRevision("skill-1", "stable")).resolves.toEqual(
      created.revision,
    );
    await expect(repository.getRevisionByDigest("skill-1", "sha256:second")).resolves.toEqual(
      appended?.revision,
    );
    await expect(
      repository.appendRevision({
        skillId: "skill-1",
        expectedStateVersion: 1,
        expectedDraftRevisionId: created.skill.draftRevisionId,
        description: "Stale edit",
        digest: "sha256:stale",
        storageKey: "skills/personal/7/skill-1/revisions/stale/bundle.zip",
        size: 1,
        createdByUserId: 7,
      }),
    ).resolves.toBeNull();
    await expect(repository.listRevisions("skill-1")).resolves.toHaveLength(2);
    await expect(repository.getRevisionByDigest("skill-1", "sha256:stale")).resolves.toBeNull();
  });

  it("records origin lineage on the first revision of a promoted skill", async () => {
    const repository = createRepository();
    const personal = await repository.create(personalSkill());

    const project = await repository.create(
      personalSkill({
        id: "skill-2",
        scope: { type: "project", id: "project-1" },
        storageKey: "skills/projects/project-1/skill-2/revisions/1/bundle.zip",
        source: { skillId: personal.skill.id, revisionId: personal.revision.id },
      }),
    );

    expect(project.revision).toMatchObject({
      sourceSkillId: personal.skill.id,
      sourceRevisionId: personal.revision.id,
    });
  });

  it("rejects lineage when the revision does not belong to the source skill", async () => {
    const repository = createRepository();
    const first = await repository.create(personalSkill());
    const second = await repository.create(
      personalSkill({
        id: "skill-2",
        name: "project-brief",
        storageKey: "skills/personal/7/skill-2/revisions/1/bundle.zip",
      }),
    );

    await expect(
      repository.create(
        personalSkill({
          id: "skill-3",
          scope: { type: "project", id: "project-1" },
          storageKey: "skills/projects/project-1/skill-3/revisions/1/bundle.zip",
          source: { skillId: first.skill.id, revisionId: second.revision.id },
        }),
      ),
    ).rejects.toMatchObject({ type: ErrorType.PARAMS_ERROR, statusCode: 400 });
    await expect(repository.getById("skill-3")).resolves.toBeNull();
  });

  it("can atomically activate an appended revision", async () => {
    const repository = createRepository();
    const created = await repository.create(personalSkill());

    const appended = await repository.appendRevision({
      skillId: "skill-1",
      expectedStateVersion: 1,
      expectedDraftRevisionId: created.skill.draftRevisionId,
      description: "Immediately active update.",
      digest: "sha256:active",
      storageKey: "skills/personal/7/skill-1/revisions/2/bundle.zip",
      size: 720,
      createdByUserId: 7,
      activate: true,
    });

    expect(appended?.skill).toMatchObject({
      draftRevisionId: appended?.revision.id,
      stableRevisionId: appended?.revision.id,
      stateVersion: 2,
    });
  });

  it("does not insert metadata when the CAS becomes stale before the batch", async () => {
    const repository = createRepository();
    const created = await repository.create(personalSkill());

    beforeNextBatch = async () => {
      await repository.archive(created.skill.id, created.skill.stateVersion);
    };

    await expect(
      repository.appendRevision({
        skillId: created.skill.id,
        expectedStateVersion: created.skill.stateVersion,
        expectedDraftRevisionId: created.skill.draftRevisionId,
        description: "Stale concurrent edit",
        digest: "sha256:concurrent-stale",
        storageKey: "skills/personal/7/skill-1/revisions/2/bundle.zip",
        size: 700,
        createdByUserId: 7,
      }),
    ).resolves.toBeNull();
    await expect(repository.listRevisions(created.skill.id)).resolves.toEqual([created.revision]);
    await expect(repository.getById(created.skill.id)).resolves.toMatchObject({
      archivedAt: expect.any(String),
      stateVersion: 2,
      draftRevisionId: created.revision.id,
    });
  });

  it("rolls back the pointer update when the revision insert fails", async () => {
    const repository = createRepository();
    const created = await repository.create(personalSkill());

    sqlite.exec(`
      CREATE TRIGGER fail_appended_skill_revision
      BEFORE INSERT ON authored_skill_revision
      WHEN NEW.revision > 1
      BEGIN
        SELECT RAISE(ABORT, 'simulated revision failure');
      END;
    `);

    await expect(
      repository.appendRevision({
        skillId: "skill-1",
        expectedStateVersion: 1,
        expectedDraftRevisionId: created.skill.draftRevisionId,
        description: "Failed update",
        digest: "sha256:failed",
        storageKey: "skills/personal/7/skill-1/revisions/2/bundle.zip",
        size: 700,
        createdByUserId: 7,
      }),
    ).rejects.toThrow("simulated revision failure");
    await expect(repository.getRevisionByOrdinal("skill-1", 2)).resolves.toBeNull();
    await expect(repository.getById("skill-1")).resolves.toEqual(created.skill);
  });

  it("rolls back the identity when the initial revision insert fails", async () => {
    const repository = createRepository();

    sqlite.exec(`
      CREATE TRIGGER fail_initial_skill_revision
      BEFORE INSERT ON authored_skill_revision
      WHEN NEW.digest = 'sha256:fault'
      BEGIN
        SELECT RAISE(ABORT, 'simulated initial revision failure');
      END;
    `);

    await expect(repository.create(personalSkill({ digest: "sha256:fault" }))).rejects.toThrow(
      "simulated initial revision failure",
    );
    await expect(repository.getById("skill-1")).resolves.toBeNull();
    await expect(
      repository.getByScopeAndName({ type: "personal", id: 7 }, "meeting-notes"),
    ).resolves.toBeNull();
  });

  it("does not resolve a revision through another skill identity", async () => {
    const repository = createRepository();
    const first = await repository.create(personalSkill());
    const second = await repository.create(
      personalSkill({
        id: "skill-2",
        name: "project-brief",
        storageKey: "skills/personal/7/skill-2/revisions/1/bundle.zip",
      }),
    );

    await expect(
      repository.getRevisionForSkill(second.skill.id, first.revision.id),
    ).resolves.toBeNull();
    await expect(
      repository.getRevisionByStorageKey(second.skill.id, first.revision.storageKey),
    ).resolves.toBeNull();
    await expect(
      repository.getRevisionByStorageKey(first.skill.id, first.revision.storageKey),
    ).resolves.toEqual(first.revision);

    sqlite
      .prepare("UPDATE authored_skill SET draft_revision_id = ? WHERE id = ?")
      .run(first.revision.id, second.skill.id);

    await expect(repository.getCurrentRevision(second.skill.id, "draft")).resolves.toBeNull();
  });

  it("archives the skill while preserving its revision history and allowing name reuse", async () => {
    const repository = createRepository();
    const created = await repository.create(personalSkill());

    await expect(repository.archive("skill-1", 2)).resolves.toBeNull();
    await expect(
      repository.getByScopeAndName({ type: "personal", id: 7 }, "meeting-notes"),
    ).resolves.toEqual(created.skill);
    await expect(repository.archive("skill-1", 1)).resolves.toMatchObject({
      archivedAt: expect.any(String),
      stateVersion: 2,
    });
    await expect(
      repository.getByScopeAndName({ type: "personal", id: 7 }, "meeting-notes"),
    ).resolves.toBeNull();
    await expect(repository.listRevisions("skill-1")).resolves.toEqual([created.revision]);

    await expect(
      repository.create(
        personalSkill({
          id: "skill-2",
          storageKey: "skills/personal/7/skill-2/revisions/1/bundle.zip",
        }),
      ),
    ).resolves.toMatchObject({ skill: { id: "skill-2" } });
  });

  it("purges a failed creation identity and its revision metadata", async () => {
    const repository = createRepository();

    const created = await repository.create(personalSkill());

    await expect(
      repository.purge("skill-1", created.skill.stateVersion, created.revision.id),
    ).resolves.toBe(true);
    await expect(repository.getById("skill-1")).resolves.toBeNull();
    await expect(repository.listRevisions("skill-1")).resolves.toEqual([]);
    await expect(
      repository.purge("skill-1", created.skill.stateVersion, created.revision.id),
    ).resolves.toBe(false);
  });

  it("does not purge a skill changed after its initial creation", async () => {
    const repository = createRepository();
    const created = await repository.create(personalSkill());
    const updated = await repository.appendRevision({
      skillId: created.skill.id,
      expectedStateVersion: created.skill.stateVersion,
      expectedDraftRevisionId: created.skill.draftRevisionId,
      description: "A concurrent update",
      digest: "sha256:concurrent",
      storageKey: "skills/personal/7/skill-1/revisions/2/bundle.zip",
      size: 700,
      createdByUserId: 7,
      activate: true,
    });

    await expect(
      repository.purge(created.skill.id, created.skill.stateVersion, created.revision.id),
    ).resolves.toBe(false);
    await expect(repository.getById(created.skill.id)).resolves.toEqual(updated?.skill);
    await expect(repository.listRevisions(created.skill.id)).resolves.toHaveLength(2);
  });
});

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { authoredSkill, authoredSkillRevision } from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

export interface AuthoredSkillScope {
  type: "personal" | "project";
  id: string | number;
}

export interface AuthoredSkillRecord {
  id: string;
  scopeType: AuthoredSkillScope["type"];
  scopeId: string;
  name: string;
  createdByUserId: number;
  draftRevisionId: string;
  stableRevisionId: string;
  stateVersion: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthoredSkillRevisionRecord {
  id: string;
  skillId: string;
  revision: number;
  description: string;
  changeNote: string | null;
  digest: string;
  storageKey: string;
  size: number;
  sourceSkillId: string | null;
  sourceRevisionId: string | null;
  createdByUserId: number;
  createdAt: string;
}

export interface CreateAuthoredSkillInput {
  id?: string;
  scope: AuthoredSkillScope;
  name: string;
  description: string;
  digest: string;
  storageKey: string;
  size: number;
  createdByUserId: number;
  changeNote?: string | null;
  source?: {
    skillId: string;
    revisionId: string;
  } | null;
}

export interface AppendAuthoredSkillRevisionInput {
  skillId: string;
  expectedStateVersion: number;
  expectedDraftRevisionId: string;
  description: string;
  digest: string;
  storageKey: string;
  size: number;
  createdByUserId: number;
  changeNote?: string | null;
  activate?: boolean;
}

export interface AuthoredSkillWithRevision {
  skill: AuthoredSkillRecord;
  revision: AuthoredSkillRevisionRecord;
}

const mapSkill = (record: typeof authoredSkill.$inferSelect): AuthoredSkillRecord => ({
  id: record.id,
  scopeType: record.scope_type,
  scopeId: record.scope_id,
  name: record.name,
  createdByUserId: record.created_by,
  draftRevisionId: record.draft_revision_id,
  stableRevisionId: record.stable_revision_id,
  stateVersion: record.state_version,
  archivedAt: record.archived_at,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
});

const mapRevision = (
  record: typeof authoredSkillRevision.$inferSelect,
): AuthoredSkillRevisionRecord => ({
  id: record.id,
  skillId: record.skill_id,
  revision: record.revision,
  description: record.description,
  changeNote: record.change_note,
  digest: record.digest,
  storageKey: record.storage_key,
  size: record.size,
  sourceSkillId: record.source_skill_id,
  sourceRevisionId: record.source_revision_id,
  createdByUserId: record.created_by,
  createdAt: record.created_at,
});

export class AuthoredSkillRepository extends BaseRepository {
  async create(input: CreateAuthoredSkillInput): Promise<AuthoredSkillWithRevision> {
    if (input.source) {
      const sourceRevision = await this.getRevisionForSkill(
        input.source.skillId,
        input.source.revisionId,
      );

      if (!sourceRevision) {
        throw new AssistantError("Source skill revision is invalid", ErrorType.PARAMS_ERROR, 400);
      }
    }

    const id = input.id ?? generateId();
    const revisionId = generateId();
    const now = new Date().toISOString();

    try {
      const [skillRecords, revisionRecords] = await this.database.batch([
        this.database
          .insert(authoredSkill)
          .values({
            id,
            scope_type: input.scope.type,
            scope_id: String(input.scope.id),
            name: input.name,
            created_by: input.createdByUserId,
            draft_revision_id: revisionId,
            stable_revision_id: revisionId,
            state_version: 1,
            archived_at: null,
            created_at: now,
            updated_at: now,
          })
          .returning(),
        this.database
          .insert(authoredSkillRevision)
          .values({
            id: revisionId,
            skill_id: id,
            revision: 1,
            description: input.description,
            change_note: input.changeNote ?? null,
            digest: input.digest,
            storage_key: input.storageKey,
            size: input.size,
            source_skill_id: input.source?.skillId ?? null,
            source_revision_id: input.source?.revisionId ?? null,
            created_by: input.createdByUserId,
            created_at: now,
          })
          .returning(),
      ]);
      const [skillRecord] = skillRecords;
      const [revisionRecord] = revisionRecords;

      if (!skillRecord || !revisionRecord) {
        throw new AssistantError(
          "Failed to create authored skill revision",
          ErrorType.DATABASE_ERROR,
        );
      }

      return { skill: mapSkill(skillRecord), revision: mapRevision(revisionRecord) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      if (
        message.includes("UNIQUE constraint failed") ||
        message.includes("authored_skill_scope_name_idx")
      ) {
        throw new AssistantError(
          `A skill named ${input.name} already exists in this scope`,
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }

      throw error;
    }
  }

  async getById(skillId: string): Promise<AuthoredSkillRecord | null> {
    const [record] = await this.database
      .select()
      .from(authoredSkill)
      .where(eq(authoredSkill.id, skillId))
      .limit(1);

    return record ? mapSkill(record) : null;
  }

  async getByScopeAndName(
    scope: AuthoredSkillScope,
    name: string,
  ): Promise<AuthoredSkillRecord | null> {
    const [record] = await this.database
      .select()
      .from(authoredSkill)
      .where(
        and(
          eq(authoredSkill.scope_type, scope.type),
          eq(authoredSkill.scope_id, String(scope.id)),
          eq(authoredSkill.name, name),
          isNull(authoredSkill.archived_at),
        ),
      )
      .limit(1);

    return record ? mapSkill(record) : null;
  }

  async listByScope(scope: AuthoredSkillScope): Promise<AuthoredSkillRecord[]> {
    const records = await this.database
      .select()
      .from(authoredSkill)
      .where(
        and(
          eq(authoredSkill.scope_type, scope.type),
          eq(authoredSkill.scope_id, String(scope.id)),
          isNull(authoredSkill.archived_at),
        ),
      )
      .orderBy(asc(authoredSkill.name));

    return records.map(mapSkill);
  }

  async getRevisionForSkill(
    skillId: string,
    revisionId: string,
  ): Promise<AuthoredSkillRevisionRecord | null> {
    const [record] = await this.database
      .select()
      .from(authoredSkillRevision)
      .where(
        and(eq(authoredSkillRevision.id, revisionId), eq(authoredSkillRevision.skill_id, skillId)),
      )
      .limit(1);

    return record ? mapRevision(record) : null;
  }

  async getRevisionByOrdinal(
    skillId: string,
    revision: number,
  ): Promise<AuthoredSkillRevisionRecord | null> {
    const [record] = await this.database
      .select()
      .from(authoredSkillRevision)
      .where(
        and(
          eq(authoredSkillRevision.skill_id, skillId),
          eq(authoredSkillRevision.revision, revision),
        ),
      )
      .limit(1);

    return record ? mapRevision(record) : null;
  }

  async getRevisionByDigest(
    skillId: string,
    digest: string,
  ): Promise<AuthoredSkillRevisionRecord | null> {
    const [record] = await this.database
      .select()
      .from(authoredSkillRevision)
      .where(
        and(eq(authoredSkillRevision.skill_id, skillId), eq(authoredSkillRevision.digest, digest)),
      )
      .orderBy(asc(authoredSkillRevision.revision))
      .limit(1);

    return record ? mapRevision(record) : null;
  }

  async getRevisionByStorageKey(
    skillId: string,
    storageKey: string,
  ): Promise<AuthoredSkillRevisionRecord | null> {
    const [record] = await this.database
      .select()
      .from(authoredSkillRevision)
      .where(
        and(
          eq(authoredSkillRevision.skill_id, skillId),
          eq(authoredSkillRevision.storage_key, storageKey),
        ),
      )
      .limit(1);

    return record ? mapRevision(record) : null;
  }

  async getCurrentRevision(
    skillId: string,
    pointer: "draft" | "stable",
  ): Promise<AuthoredSkillRevisionRecord | null> {
    const skill = await this.getById(skillId);

    if (!skill) {
      return null;
    }

    return this.getRevisionForSkill(
      skill.id,
      pointer === "draft" ? skill.draftRevisionId : skill.stableRevisionId,
    );
  }

  async listRevisions(skillId: string): Promise<AuthoredSkillRevisionRecord[]> {
    const records = await this.database
      .select()
      .from(authoredSkillRevision)
      .where(eq(authoredSkillRevision.skill_id, skillId))
      .orderBy(asc(authoredSkillRevision.revision));

    return records.map(mapRevision);
  }

  async appendRevision(
    input: AppendAuthoredSkillRevisionInput,
  ): Promise<AuthoredSkillWithRevision | null> {
    const current = await this.getById(input.skillId);

    if (
      !current ||
      current.archivedAt !== null ||
      current.stateVersion !== input.expectedStateVersion ||
      current.draftRevisionId !== input.expectedDraftRevisionId
    ) {
      return null;
    }

    const currentDraft = await this.getRevisionForSkill(current.id, current.draftRevisionId);

    if (!currentDraft || currentDraft.skillId !== current.id) {
      throw new AssistantError(
        "Authored skill draft revision is invalid",
        ErrorType.DATABASE_ERROR,
        500,
      );
    }

    const nextRevision = currentDraft.revision + 1;
    const revisionId = generateId();
    const now = new Date().toISOString();

    try {
      const [updatedRecords, revisionRecords] = await this.database.batch([
        this.database
          .update(authoredSkill)
          .set({
            draft_revision_id: revisionId,
            stable_revision_id: input.activate ? revisionId : current.stableRevisionId,
            state_version: current.stateVersion + 1,
            updated_at: now,
          })
          .where(
            and(
              eq(authoredSkill.id, input.skillId),
              eq(authoredSkill.state_version, input.expectedStateVersion),
              eq(authoredSkill.draft_revision_id, input.expectedDraftRevisionId),
              isNull(authoredSkill.archived_at),
            ),
          )
          .returning(),
        this.database
          .insert(authoredSkillRevision)
          .select(
            this.database
              .select({
                id: sql<string>`${revisionId}`.as("id"),
                skill_id: authoredSkill.id,
                revision: sql<number>`${nextRevision}`.as("revision"),
                description: sql<string>`${input.description}`.as("description"),
                change_note: sql<string | null>`${input.changeNote ?? null}`.as("change_note"),
                digest: sql<string>`${input.digest}`.as("digest"),
                storage_key: sql<string>`${input.storageKey}`.as("storage_key"),
                size: sql<number>`${input.size}`.as("size"),
                source_skill_id: sql<string | null>`NULL`.as("source_skill_id"),
                source_revision_id: sql<string | null>`NULL`.as("source_revision_id"),
                created_by: sql<number>`${input.createdByUserId}`.as("created_by"),
                created_at: sql<string>`${now}`.as("created_at"),
              })
              .from(authoredSkill)
              .where(
                and(
                  eq(authoredSkill.id, input.skillId),
                  eq(authoredSkill.draft_revision_id, revisionId),
                  eq(authoredSkill.state_version, current.stateVersion + 1),
                  isNull(authoredSkill.archived_at),
                ),
              ),
          )
          .returning(),
      ]);
      const [updated] = updatedRecords;
      const [revisionRecord] = revisionRecords;

      if (!updated || !revisionRecord) {
        return null;
      }

      return { skill: mapSkill(updated), revision: mapRevision(revisionRecord) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      if (message.includes("authored_skill_revision.skill_id")) {
        return null;
      }

      throw error;
    }
  }

  async archive(
    skillId: string,
    expectedStateVersion?: number,
  ): Promise<AuthoredSkillRecord | null> {
    const now = new Date().toISOString();
    const conditions = [eq(authoredSkill.id, skillId), isNull(authoredSkill.archived_at)];

    if (expectedStateVersion !== undefined) {
      conditions.push(eq(authoredSkill.state_version, expectedStateVersion));
    }

    const [archived] = await this.database
      .update(authoredSkill)
      .set({
        archived_at: now,
        updated_at: now,
        state_version: sql`${authoredSkill.state_version} + 1`,
      })
      .where(and(...conditions))
      .returning();

    return archived ? mapSkill(archived) : null;
  }

  async purge(
    skillId: string,
    expectedStateVersion: number,
    expectedRevisionId: string,
  ): Promise<boolean> {
    const purged = await this.database
      .delete(authoredSkill)
      .where(
        and(
          eq(authoredSkill.id, skillId),
          eq(authoredSkill.state_version, expectedStateVersion),
          eq(authoredSkill.draft_revision_id, expectedRevisionId),
          eq(authoredSkill.stable_revision_id, expectedRevisionId),
          isNull(authoredSkill.archived_at),
        ),
      )
      .returning({ id: authoredSkill.id });

    return purged.length > 0;
  }
}

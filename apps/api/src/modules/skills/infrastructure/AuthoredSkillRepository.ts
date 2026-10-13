import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import {
  resource,
  resourceRevision,
  scopedConfiguration,
  workspaceAuditRecord,
} from "~/infrastructure/database/schema";
import {
  buildWorkspaceAuditRecordValues,
  type CreateWorkspaceAuditRecordInput,
} from "~/modules/audit/infrastructure/AuditRepository";
import { buildCapabilityConfigurationValues } from "~/modules/capabilities/infrastructure/CapabilityConfigurationRepository";

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
  projectPublication?: {
    projectId: string;
    audit: CreateWorkspaceAuditRecordInput;
  };
  personalEnabled?: boolean;
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
  source?: {
    skillId: string;
    revisionId: string;
  } | null;
  audit?: CreateWorkspaceAuditRecordInput;
}

export interface AuthoredSkillWithRevision {
  skill: AuthoredSkillRecord;
  revision: AuthoredSkillRevisionRecord;
}

function auditMetadata(
  audit: CreateWorkspaceAuditRecordInput,
  revisionId: string,
): Record<string, unknown> {
  return { ...audit.metadata, revisionId };
}

const mapSkill = (record: typeof resource.$inferSelect): AuthoredSkillRecord => ({
  id: record.id,
  scopeType: record.scope_type,
  scopeId: record.scope_id,
  name: record.title,
  createdByUserId: record.created_by_user_id,
  draftRevisionId: record.draft_revision_id,
  stableRevisionId: record.stable_revision_id,
  stateVersion: record.state_version,
  archivedAt: record.archived_at,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
});

const mapRevision = (
  record: typeof resourceRevision.$inferSelect,
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

    if (input.projectPublication && input.scope.type !== "project") {
      throw new AssistantError(
        "Project publication requires a project skill scope",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    if (input.projectPublication && String(input.scope.id) !== input.projectPublication.projectId) {
      throw new AssistantError(
        "Project publication does not match the skill scope",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    try {
      const skillInsert = this.database
        .insert(resource)
        .values({
          id,
          scope_type: input.scope.type,
          scope_id: String(input.scope.id),
          resource_type: "skill",
          title: input.name,
          created_by_user_id: input.createdByUserId,
          draft_revision_id: revisionId,
          stable_revision_id: revisionId,
          state_version: 1,
          archived_at: null,
          created_at: now,
          updated_at: now,
        })
        .returning();
      const revisionInsert = this.database
        .insert(resourceRevision)
        .values({
          resource_type: "skill",
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
        .returning();
      let skillRecord: typeof resource.$inferSelect | undefined;
      let revisionRecord: typeof resourceRevision.$inferSelect | undefined;

      if (input.scope.type === "personal") {
        const configuration = buildCapabilityConfigurationValues({
          scope: { type: "user", id: Number(input.scope.id) },
          capabilityKind: "skill",
          capabilityId: input.name,
          configuration: { enabled: input.personalEnabled ?? true },
        });
        const [skillRecords, revisionRecords, configurationRecords] = await this.database.batch([
          skillInsert,
          revisionInsert,
          this.database
            .insert(scopedConfiguration)
            .values({
              ...configuration,
              kind: "capability",
              payload: { enabled: input.personalEnabled ?? true },
            })
            .onConflictDoUpdate({
              target: [
                scopedConfiguration.scope_type,
                scopedConfiguration.scope_id,
                scopedConfiguration.target_kind,
                scopedConfiguration.target_id,
              ],
              targetWhere: sql`${scopedConfiguration.kind} = 'capability'`,
              set: { payload: { enabled: input.personalEnabled ?? true }, updated_at: now },
            })
            .returning(),
        ]);

        [skillRecord] = skillRecords;
        [revisionRecord] = revisionRecords;

        if (!configurationRecords[0]) {
          throw new AssistantError("Failed to enable authored skill", ErrorType.DATABASE_ERROR);
        }
      } else if (input.projectPublication) {
        const audit = buildWorkspaceAuditRecordValues({
          ...input.projectPublication.audit,
          metadata: auditMetadata(input.projectPublication.audit, revisionId),
        });
        const [skillRecords, revisionRecords, capabilityRecords, auditRecords] =
          await this.database.batch([
            skillInsert,
            revisionInsert,
            this.database
              .insert(scopedConfiguration)
              .values({
                kind: "capability",
                id: generateId(),
                project_id: input.projectPublication.projectId,
                target_kind: "skill",
                target_id: input.name,
                payload: {},
                attached: true,
                created_by: input.createdByUserId,
              })
              .onConflictDoUpdate({
                target: [
                  scopedConfiguration.scope_type,
                  scopedConfiguration.scope_id,
                  scopedConfiguration.target_kind,
                  scopedConfiguration.target_id,
                ],
                targetWhere: sql`${scopedConfiguration.kind} = 'capability'`,
                set: {
                  attached: sql`CASE WHEN ${scopedConfiguration.attached} = 0 THEN 1 END`,
                  created_by: input.createdByUserId,
                  payload: {},
                  updated_at: now,
                },
              })
              .returning(),
            this.database.insert(workspaceAuditRecord).values(audit).returning(),
          ]);

        [skillRecord] = skillRecords;
        [revisionRecord] = revisionRecords;

        if (!capabilityRecords[0] || !auditRecords[0]) {
          throw new AssistantError(
            "Failed to publish imported project skill",
            ErrorType.DATABASE_ERROR,
          );
        }
      } else {
        const [skillRecords, revisionRecords] = await this.database.batch([
          skillInsert,
          revisionInsert,
        ]);

        [skillRecord] = skillRecords;
        [revisionRecord] = revisionRecords;
      }

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
        message.includes("resource_skill_name_idx")
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
      .from(resource)
      .where(and(eq(resource.resource_type, "skill"), eq(resource.id, skillId)))
      .limit(1);

    return record ? mapSkill(record) : null;
  }

  async getByScopeAndName(
    scope: AuthoredSkillScope,
    name: string,
  ): Promise<AuthoredSkillRecord | null> {
    const [record] = await this.database
      .select()
      .from(resource)
      .where(
        and(
          eq(resource.resource_type, "skill"),
          and(
            eq(resource.scope_type, scope.type),
            eq(resource.scope_id, String(scope.id)),
            eq(resource.title, name),
            isNull(resource.archived_at),
          ),
        ),
      )
      .limit(1);

    return record ? mapSkill(record) : null;
  }

  async listByScope(scope: AuthoredSkillScope): Promise<AuthoredSkillRecord[]> {
    const records = await this.database
      .select()
      .from(resource)
      .where(
        and(
          eq(resource.resource_type, "skill"),
          and(
            eq(resource.scope_type, scope.type),
            eq(resource.scope_id, String(scope.id)),
            isNull(resource.archived_at),
          ),
        ),
      )
      .orderBy(asc(resource.title));

    return records.map(mapSkill);
  }

  async getRevisionForSkill(
    skillId: string,
    revisionId: string,
  ): Promise<AuthoredSkillRevisionRecord | null> {
    const [record] = await this.database
      .select()
      .from(resourceRevision)
      .where(and(eq(resourceRevision.id, revisionId), eq(resourceRevision.skill_id, skillId)))
      .limit(1);

    return record ? mapRevision(record) : null;
  }

  async getRevisionByOrdinal(
    skillId: string,
    revision: number,
  ): Promise<AuthoredSkillRevisionRecord | null> {
    const [record] = await this.database
      .select()
      .from(resourceRevision)
      .where(and(eq(resourceRevision.skill_id, skillId), eq(resourceRevision.revision, revision)))
      .limit(1);

    return record ? mapRevision(record) : null;
  }

  async getRevisionByDigest(
    skillId: string,
    digest: string,
  ): Promise<AuthoredSkillRevisionRecord | null> {
    const [record] = await this.database
      .select()
      .from(resourceRevision)
      .where(and(eq(resourceRevision.skill_id, skillId), eq(resourceRevision.digest, digest)))
      .orderBy(asc(resourceRevision.revision))
      .limit(1);

    return record ? mapRevision(record) : null;
  }

  async getRevisionByStorageKey(
    skillId: string,
    storageKey: string,
  ): Promise<AuthoredSkillRevisionRecord | null> {
    const [record] = await this.database
      .select()
      .from(resourceRevision)
      .where(
        and(eq(resourceRevision.skill_id, skillId), eq(resourceRevision.storage_key, storageKey)),
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
      .from(resourceRevision)
      .where(eq(resourceRevision.skill_id, skillId))
      .orderBy(asc(resourceRevision.revision));

    return records.map(mapRevision);
  }

  async appendRevision(
    input: AppendAuthoredSkillRevisionInput,
  ): Promise<AuthoredSkillWithRevision | null> {
    if (input.source) {
      const sourceRevision = await this.getRevisionForSkill(
        input.source.skillId,
        input.source.revisionId,
      );

      if (!sourceRevision) {
        throw new AssistantError("Source skill revision is invalid", ErrorType.PARAMS_ERROR, 400);
      }
    }

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
      const updatedSkillInsert = this.database
        .update(resource)
        .set({
          draft_revision_id: revisionId,
          stable_revision_id: input.activate ? revisionId : current.stableRevisionId,
          state_version: current.stateVersion + 1,
          updated_at: now,
        })
        .where(
          and(
            eq(resource.resource_type, "skill"),
            and(
              eq(resource.id, input.skillId),
              eq(resource.state_version, input.expectedStateVersion),
              eq(resource.draft_revision_id, input.expectedDraftRevisionId),
              isNull(resource.archived_at),
            ),
          ),
        )
        .returning();
      const revisionInsert = this.database
        .insert(resourceRevision)
        .select(
          this.database
            .select({
              id: sql<string>`${revisionId}`.as("id"),
              document_id: sql<null>`NULL`.as("document_id"),
              revision: sql<number>`${nextRevision}`.as("revision"),
              text_content: sql<null>`NULL`.as("text_content"),
              change_note: sql<string | null>`${input.changeNote ?? null}`.as("change_note"),
              created_by: sql<number>`${input.createdByUserId}`.as("created_by"),
              created_at: sql<string>`${now}`.as("created_at"),
              operation_id: sql<null>`NULL`.as("operation_id"),
              skill_id: resource.id,
              description: sql<string>`${input.description}`.as("description"),
              digest: sql<string>`${input.digest}`.as("digest"),
              storage_key: sql<string>`${input.storageKey}`.as("storage_key"),
              size: sql<number>`${input.size}`.as("size"),
              source_skill_id: sql<string | null>`${input.source?.skillId ?? null}`.as(
                "source_skill_id",
              ),
              source_revision_id: sql<string | null>`${input.source?.revisionId ?? null}`.as(
                "source_revision_id",
              ),
              output_id: sql<null>`NULL`.as("output_id"),
              title: sql<null>`NULL`.as("title"),
              status: sql<null>`NULL`.as("status"),
              sensitivity: sql<null>`NULL`.as("sensitivity"),
              content: sql<null>`NULL`.as("content"),
              created_by_user_id: sql<null>`NULL`.as("created_by_user_id"),
              provenance_json: sql<null>`NULL`.as("provenance_json"),
              operation: sql<null>`NULL`.as("operation"),
              restored_from_revision: sql<null>`NULL`.as("restored_from_revision"),
              resource_type: sql<"skill">`'skill'`.as("resource_type"),
            })
            .from(resource)
            .where(
              and(
                eq(resource.resource_type, "skill"),
                and(
                  eq(resource.id, input.skillId),
                  eq(resource.draft_revision_id, revisionId),
                  eq(resource.state_version, current.stateVersion + 1),
                  isNull(resource.archived_at),
                ),
              ),
            ),
        )
        .returning();
      let updatedRecords: (typeof resource.$inferSelect)[];
      let revisionRecords: (typeof resourceRevision.$inferSelect)[];

      if (input.audit) {
        const audit = buildWorkspaceAuditRecordValues({
          ...input.audit,
          metadata: auditMetadata(input.audit, revisionId),
        });
        const [updated, revisions, audits] = await this.database.batch([
          updatedSkillInsert,
          revisionInsert,
          this.database
            .insert(workspaceAuditRecord)
            .select(
              this.database
                .select({
                  id: sql<string>`${audit.id}`.as("id"),
                  workspace_id: sql<string>`${audit.workspace_id}`.as("workspace_id"),
                  actor_user_id: sql<number | null>`${audit.actor_user_id}`.as("actor_user_id"),
                  action: sql<string>`${audit.action}`.as("action"),
                  target_type: sql<string>`${audit.target_type}`.as("target_type"),
                  target_id: sql<string | null>`${audit.target_id}`.as("target_id"),
                  metadata: sql<Record<string, unknown>>`${JSON.stringify(audit.metadata)}`.as(
                    "metadata",
                  ),
                  created_at: sql<string>`${now}`.as("created_at"),
                })
                .from(resource)
                .where(
                  and(
                    eq(resource.resource_type, "skill"),
                    and(
                      eq(resource.id, input.skillId),
                      eq(resource.draft_revision_id, revisionId),
                      eq(resource.state_version, current.stateVersion + 1),
                      isNull(resource.archived_at),
                    ),
                  ),
                ),
            )
            .returning(),
        ]);

        updatedRecords = updated;
        revisionRecords = revisions;

        if (updated[0] && revisionRecords[0] && !audits[0]) {
          throw new AssistantError("Failed to audit skill revision", ErrorType.DATABASE_ERROR);
        }
      } else {
        [updatedRecords, revisionRecords] = await this.database.batch([
          updatedSkillInsert,
          revisionInsert,
        ]);
      }

      const [updated] = updatedRecords;
      const [revisionRecord] = revisionRecords;

      if (!updated || !revisionRecord) {
        return null;
      }

      return { skill: mapSkill(updated), revision: mapRevision(revisionRecord) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      if (message.includes("resource_revision.skill_id")) {
        return null;
      }

      throw error;
    }
  }

  async promoteDraft(
    skillId: string,
    draftRevisionId: string,
    expectedStateVersion: number,
    audit?: CreateWorkspaceAuditRecordInput,
  ): Promise<AuthoredSkillRecord | null> {
    const now = new Date().toISOString();
    const promotion = this.database
      .update(resource)
      .set({
        stable_revision_id: draftRevisionId,
        state_version: expectedStateVersion + 1,
        updated_at: now,
      })
      .where(
        and(
          eq(resource.resource_type, "skill"),
          and(
            eq(resource.id, skillId),
            eq(resource.draft_revision_id, draftRevisionId),
            sql`${resource.stable_revision_id} <> ${draftRevisionId}`,
            eq(resource.state_version, expectedStateVersion),
            isNull(resource.archived_at),
          ),
        ),
      )
      .returning();
    let promotedRecords: (typeof resource.$inferSelect)[];

    if (audit) {
      const values = buildWorkspaceAuditRecordValues({
        ...audit,
        metadata: auditMetadata(audit, draftRevisionId),
      });
      const [, records] = await this.database.batch([
        this.database
          .insert(workspaceAuditRecord)
          .select(
            this.database
              .select({
                id: sql<string>`${values.id}`.as("id"),
                workspace_id: sql<string>`${values.workspace_id}`.as("workspace_id"),
                actor_user_id: sql<number | null>`${values.actor_user_id}`.as("actor_user_id"),
                action: sql<string>`${values.action}`.as("action"),
                target_type: sql<string>`${values.target_type}`.as("target_type"),
                target_id: sql<string | null>`${values.target_id}`.as("target_id"),
                metadata: sql<Record<string, unknown>>`${JSON.stringify(values.metadata)}`.as(
                  "metadata",
                ),
                created_at: sql<string>`${now}`.as("created_at"),
              })
              .from(resource)
              .where(
                and(
                  eq(resource.resource_type, "skill"),
                  and(
                    eq(resource.id, skillId),
                    eq(resource.draft_revision_id, draftRevisionId),
                    sql`${resource.stable_revision_id} <> ${draftRevisionId}`,
                    eq(resource.state_version, expectedStateVersion),
                    isNull(resource.archived_at),
                  ),
                ),
              ),
          )
          .returning(),
        promotion,
      ]);

      promotedRecords = records;
    } else {
      promotedRecords = await promotion;
    }

    const [promoted] = promotedRecords;

    return promoted ? mapSkill(promoted) : null;
  }

  async archive(
    skillId: string,
    expectedStateVersion?: number,
  ): Promise<AuthoredSkillRecord | null> {
    const now = new Date().toISOString();
    const conditions = [
      eq(resource.resource_type, "skill"),
      eq(resource.id, skillId),
      isNull(resource.archived_at),
    ];

    if (expectedStateVersion !== undefined) {
      conditions.push(eq(resource.state_version, expectedStateVersion));
    }

    const [archived] = await this.database
      .update(resource)
      .set({
        archived_at: now,
        updated_at: now,
        state_version: sql`${resource.state_version} + 1`,
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
      .delete(resource)
      .where(
        and(
          eq(resource.resource_type, "skill"),
          and(
            eq(resource.id, skillId),
            eq(resource.state_version, expectedStateVersion),
            eq(resource.draft_revision_id, expectedRevisionId),
            eq(resource.stable_revision_id, expectedRevisionId),
            isNull(resource.archived_at),
          ),
        ),
      )
      .returning({ id: resource.id });

    return purged.length > 0;
  }
}

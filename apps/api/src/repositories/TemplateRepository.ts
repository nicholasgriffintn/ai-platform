import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

export interface TemplateRecord {
  id: string;
  created_by_user_id: number;
  workspace_id: string | null;
  project_id: string | null;
  kind: "project" | "recipe" | "capability";
  capability_id: string | null;
  name: string;
  description: string;
  configuration: string;
  status: "active" | "paused" | "archived";
  created_at: string;
  updated_at: string;
}

export class TemplateRepository extends BaseRepository {
  async createTemplate(input: {
    createdByUserId: number;
    workspaceId?: string | null;
    projectId?: string | null;
    kind: TemplateRecord["kind"];
    capabilityId?: string | null;
    name: string;
    description?: string;
    configuration?: unknown;
    status?: TemplateRecord["status"];
  }): Promise<TemplateRecord> {
    const insert = this.buildInsertQuery(
      "template",
      {
        id: generateId(),
        created_by_user_id: input.createdByUserId,
        workspace_id: input.workspaceId ?? null,
        project_id: input.projectId ?? null,
        kind: input.kind,
        capability_id: input.capabilityId ?? null,
        name: input.name,
        description: input.description ?? "",
        configuration: input.configuration ?? {},
        status: input.status ?? "active",
      },
      { jsonFields: ["configuration"], returning: "*" },
    );

    if (!insert) {
      throw new AssistantError("Failed to build template", ErrorType.INTERNAL_ERROR);
    }

    const template = await this.runQuery<TemplateRecord>(insert.query, insert.values, true);

    if (!template) {
      throw new AssistantError("Failed to create template", ErrorType.DATABASE_ERROR);
    }

    return template;
  }

  async getTemplateById(templateId: string): Promise<TemplateRecord | null> {
    const { query, values } = this.buildSelectQuery("template", { id: templateId });

    return this.runQuery<TemplateRecord>(query, values, true);
  }

  async getPersonalTemplate(
    userId: number,
    kind: TemplateRecord["kind"],
    capabilityId: string,
  ): Promise<TemplateRecord | null> {
    const { query, values } = this.buildSelectQuery("template", {
      created_by_user_id: userId,
      workspace_id: null,
      project_id: null,
      kind,
      capability_id: capabilityId,
    });

    return this.runQuery<TemplateRecord>(query, values, true);
  }

  async getProjectTemplate(
    userId: number,
    projectId: string,
    kind: TemplateRecord["kind"],
    capabilityId: string,
  ): Promise<TemplateRecord | null> {
    const { query, values } = this.buildSelectQuery("template", {
      created_by_user_id: userId,
      workspace_id: null,
      project_id: projectId,
      kind,
      capability_id: capabilityId,
    });

    return this.runQuery<TemplateRecord>(query, values, true);
  }

  async listPersonalTemplates(
    userId: number,
    kind?: TemplateRecord["kind"],
  ): Promise<TemplateRecord[]> {
    const { query, values } = this.buildSelectQuery(
      "template",
      { created_by_user_id: userId, workspace_id: null, project_id: null, kind },
      { orderBy: "updated_at DESC, created_at DESC" },
    );

    return this.runQuery<TemplateRecord>(query, values);
  }

  async listProjectTemplates(
    projectId: string,
    kind?: TemplateRecord["kind"],
  ): Promise<TemplateRecord[]> {
    const { query, values } = this.buildSelectQuery(
      "template",
      { project_id: projectId, kind },
      { orderBy: "updated_at DESC, created_at DESC" },
    );

    return this.runQuery<TemplateRecord>(query, values);
  }

  async listTemplatesByKind(kind: TemplateRecord["kind"]): Promise<TemplateRecord[]> {
    const { query, values } = this.buildSelectQuery(
      "template",
      { kind },
      { orderBy: "updated_at DESC, created_at DESC" },
    );

    return this.runQuery<TemplateRecord>(query, values);
  }

  async listWorkspaceTemplates(
    workspaceId: string,
    kind?: TemplateRecord["kind"],
  ): Promise<TemplateRecord[]> {
    const { query, values } = this.buildSelectQuery(
      "template",
      { workspace_id: workspaceId, kind },
      { orderBy: "updated_at DESC, created_at DESC" },
    );

    return this.runQuery<TemplateRecord>(query, values);
  }

  async updateTemplate(
    templateId: string,
    updates: {
      name?: string;
      description?: string;
      capabilityId?: string;
      configuration?: unknown;
      status?: TemplateRecord["status"];
    },
  ): Promise<TemplateRecord | null> {
    const { capabilityId, ...rest } = updates;
    const update = this.buildUpdateQuery(
      "template",
      { ...rest, ...(capabilityId !== undefined ? { capability_id: capabilityId } : {}) },
      ["name", "description", "capability_id", "configuration", "status"],
      "id = ?",
      [templateId],
      { jsonFields: ["configuration"] },
    );

    if (update) {
      await this.executeRun(update.query, update.values);
    }

    return this.getTemplateById(templateId);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const { query, values } = this.buildDeleteQuery("template", { id: templateId });

    await this.executeRun(query, values);
  }
}

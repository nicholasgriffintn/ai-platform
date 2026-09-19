import {
  listSitePages,
  SITE_OUTPUT_KIND,
  SITES_CAPABILITY_ID,
  siteIssueSchema,
  sitePlanSchema,
  siteProjectSchema,
  siteQualitySchema,
  siteTurnSchema,
  type SiteIssue,
  type SitePlan,
  type SiteProject,
  type SiteQuality,
  type SiteRecord,
  type SiteSummary,
  type SiteTurn,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createOutputProvenance } from "~/modules/outputs/application/provenance";
import type { OutputRecord } from "~/modules/outputs/infrastructure/OutputRepository";

const storedSiteSchema = z.object({
  brief: z.string().default(""),
  plan: sitePlanSchema,
  project: siteProjectSchema,
  issues: z.array(siteIssueSchema).default([]),
  quality: siteQualitySchema.nullable().default(null),
  turns: z.array(siteTurnSchema).default([]),
});

export type StoredSite = z.infer<typeof storedSiteSchema>;

function parseStoredSite(record: OutputRecord): StoredSite | null {
  const raw = typeof record.content === "string" ? safeParseJson(record.content) : record.content;
  const parsed = storedSiteSchema.safeParse(raw);

  return parsed.success ? parsed.data : null;
}

export function mapSiteRecord(record: OutputRecord): SiteRecord | null {
  const stored = parseStoredSite(record);

  if (!stored) {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
    brief: stored.brief,
    projectId: record.project_id,
    revision: record.revision,
    plan: stored.plan,
    project: stored.project,
    issues: stored.issues,
    quality: stored.quality,
    turns: stored.turns,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function mapSiteSummary(record: OutputRecord): SiteSummary | null {
  const site = mapSiteRecord(record);

  if (!site) {
    return null;
  }

  return {
    id: site.id,
    title: site.title,
    brief: site.brief,
    projectId: site.projectId,
    revision: site.revision,
    kind: site.plan.kind,
    scope: site.plan.scope,
    pageCount: listSitePages(site.project).length,
    theme: site.project.theme,
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
  };
}

interface SiteScope {
  context: ServiceContext;
  userId: number;
  projectId?: string;
}

async function findSiteOutput(
  { context, userId, projectId }: SiteScope,
  siteId: string,
): Promise<OutputRecord> {
  context.ensureDatabase();

  const record = projectId
    ? await context.repositories.outputs.getProjectOutput(projectId, siteId)
    : await context.repositories.outputs.getPersonalOutput(userId, siteId);

  if (!record || record.kind !== SITE_OUTPUT_KIND) {
    throw new AssistantError("Site not found", ErrorType.NOT_FOUND, 404);
  }

  return record;
}

export async function getSite(scope: SiteScope, siteId: string): Promise<SiteRecord> {
  const record = await findSiteOutput(scope, siteId);
  const site = mapSiteRecord(record);

  if (!site) {
    throw new AssistantError("Site record is unreadable", ErrorType.UNKNOWN_ERROR);
  }

  return site;
}

export async function listSites(scope: SiteScope, limit = 50): Promise<SiteSummary[]> {
  scope.context.ensureDatabase();

  const records = scope.projectId
    ? await scope.context.repositories.outputs.listProjectOutputs(
        scope.projectId,
        SITES_CAPABILITY_ID,
        { kind: SITE_OUTPUT_KIND, limit },
      )
    : await scope.context.repositories.outputs.listPersonalOutputs(
        scope.userId,
        SITES_CAPABILITY_ID,
        { kind: SITE_OUTPUT_KIND, limit },
      );

  return records.flatMap((record) => {
    const summary = mapSiteSummary(record);

    return summary ? [summary] : [];
  });
}

export async function deleteSite(scope: SiteScope, siteId: string): Promise<void> {
  const record = await findSiteOutput(scope, siteId);

  await scope.context.repositories.outputs.deleteOutput(record.id);
}

export interface SaveSiteInput {
  brief: string;
  plan: SitePlan;
  project: SiteProject;
  issues: SiteIssue[];
  quality?: SiteQuality | null;
  turn: SiteTurn;
  conversationId?: string;
}

export async function createSite(scope: SiteScope, input: SaveSiteInput): Promise<SiteRecord> {
  scope.context.ensureDatabase();

  const stored: StoredSite = {
    brief: input.brief,
    plan: input.plan,
    project: input.project,
    issues: input.issues,
    quality: input.quality ?? null,
    turns: [input.turn],
  };
  const record = await scope.context.repositories.outputs.createOutput({
    createdByUserId: scope.userId,
    projectId: scope.projectId ?? null,
    conversationId: input.conversationId ?? null,
    capabilityId: SITES_CAPABILITY_ID,
    kind: SITE_OUTPUT_KIND,
    title: input.project.title,
    status: "ready",
    content: stored,
    provenance: createOutputProvenance({
      origin: "generated",
      completeness: "complete",
      model:
        input.plan.model && input.plan.provider
          ? { id: input.plan.model, provider: input.plan.provider }
          : null,
    }),
  });
  const site = mapSiteRecord(record);

  if (!site) {
    throw new AssistantError("Failed to save the site", ErrorType.DATABASE_ERROR);
  }

  return site;
}

export async function updateSite(
  scope: SiteScope,
  siteId: string,
  input: SaveSiteInput,
): Promise<SiteRecord> {
  const record = await findSiteOutput(scope, siteId);
  const existing = parseStoredSite(record);
  const stored: StoredSite = {
    brief: existing?.brief ?? input.brief,
    plan: input.plan,
    project: input.project,
    issues: input.issues,
    quality: input.quality === undefined ? (existing?.quality ?? null) : input.quality,
    turns: [...(existing?.turns ?? []), input.turn],
  };
  const updated = await scope.context.repositories.outputs.updateOutput(record.id, {
    title: input.project.title,
    status: "ready",
    content: stored,
    expectedRevision: record.revision,
    updatedByUserId: scope.userId,
  });
  const site = mapSiteRecord(updated);

  if (!site) {
    throw new AssistantError("Failed to save the site", ErrorType.DATABASE_ERROR);
  }

  return site;
}

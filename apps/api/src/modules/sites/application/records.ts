import {
  listSitePages,
  SITE_OUTPUT_KIND,
  SITES_CAPABILITY_ID,
  storedSiteOutputContentSchema,
  type StoredSiteOutputContent,
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

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { deleteOutput } from "~/modules/outputs/application";
import {
  requireConversationScope,
  requireOutputRecordAccess,
} from "~/modules/outputs/application/access";
import { createOutputProvenance } from "~/modules/outputs/application/provenance";
import type { OutputRecord } from "~/modules/outputs/infrastructure/OutputRepository";
import { requireRecordViewBindings } from "~/modules/records/application/views";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

export type StoredSite = StoredSiteOutputContent;

function parseStoredSite(record: OutputRecord): StoredSite | null {
  const raw = typeof record.content === "string" ? safeParseJson(record.content) : record.content;
  const parsed = storedSiteOutputContentSchema.safeParse(raw);

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
  mutate = false,
): Promise<OutputRecord> {
  context.ensureDatabase();

  const record = projectId
    ? await context.repositories.outputs.getProjectOutput(projectId, siteId)
    : await context.repositories.outputs.getPersonalOutput(userId, siteId);

  if (!record || record.kind !== SITE_OUTPUT_KIND) {
    throw new AssistantError("Site not found", ErrorType.NOT_FOUND, 404);
  }

  await requireOutputRecordAccess(context, userId, record, mutate);

  return record;
}

export async function getSite(
  scope: SiteScope,
  siteId: string,
  mutate = false,
): Promise<SiteRecord> {
  const record = await findSiteOutput(scope, siteId, mutate);
  const site = mapSiteRecord(record);

  if (!site) {
    throw new AssistantError("Site record is unreadable", ErrorType.UNKNOWN_ERROR);
  }

  return site;
}

export async function listSites(scope: SiteScope, limit = 50): Promise<SiteSummary[]> {
  scope.context.ensureDatabase();
  if (scope.projectId) {
    await requireProjectAccess(scope.context, scope.projectId);
  }

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
  const record = await findSiteOutput(scope, siteId, true);

  await deleteOutput(scope.context, scope.userId, record.id);
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
  await requireRecordViewBindings(
    scope.context,
    scope.projectId ?? null,
    input.project.recordViews ?? [],
  );
  if (scope.projectId) {
    await requireProjectAccess(scope.context, scope.projectId);
  }

  if (input.conversationId) {
    await requireConversationScope(
      scope.context,
      scope.userId,
      input.conversationId,
      scope.projectId,
    );
  }

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
        input.turn.model && input.turn.provider
          ? { id: input.turn.model, provider: input.turn.provider }
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
  expectedRevision: number,
): Promise<SiteRecord> {
  const record = await findSiteOutput(scope, siteId, true);

  if (record.revision !== expectedRevision) {
    throw new AssistantError(
      "The Site changed. Reload before saving.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const existing = parseStoredSite(record);

  await requireRecordViewBindings(
    scope.context,
    record.project_id,
    input.project.recordViews ?? [],
  );
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
    expectedRevision,
    updatedByUserId: scope.userId,
  });
  const site = mapSiteRecord(updated);

  if (!site) {
    throw new AssistantError("Failed to save the site", ErrorType.DATABASE_ERROR);
  }

  return site;
}

export async function finaliseSiteGeneration(
  scope: SiteScope,
  siteId: string,
  expectedRevision: number,
  input: SaveSiteInput,
): Promise<SiteRecord> {
  const record = await findSiteOutput(scope, siteId, true);

  await requireRecordViewBindings(
    scope.context,
    record.project_id,
    input.project.recordViews ?? [],
  );
  const existing = parseStoredSite(record);

  if (!existing) {
    throw new AssistantError("Site record is unreadable", ErrorType.UNKNOWN_ERROR);
  }

  let turnIndex = -1;

  for (let index = existing.turns.length - 1; index >= 0; index -= 1) {
    if (existing.turns[index]?.id === input.turn.id) {
      turnIndex = index;
      break;
    }
  }

  if (turnIndex < 0) {
    throw new AssistantError("Site generation turn is missing", ErrorType.CONFLICT_ERROR, 409);
  }

  const turns = [...existing.turns];

  turns[turnIndex] = input.turn;

  const stored: StoredSite = {
    brief: existing.brief,
    plan: input.plan,
    project: input.project,
    issues: input.issues,
    quality: input.quality ?? null,
    turns,
  };
  const updated = await scope.context.repositories.outputs.updateOutput(record.id, {
    title: input.project.title,
    status: "ready",
    content: stored,
    expectedRevision,
    updatedByUserId: scope.userId,
  });
  const site = mapSiteRecord(updated);

  if (!site) {
    throw new AssistantError("Failed to finalise the site", ErrorType.DATABASE_ERROR);
  }

  return site;
}

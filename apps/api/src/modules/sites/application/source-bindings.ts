import {
  normaliseSiteIntegrations,
  normaliseSiteSourceRows,
  type SitePromptSource,
} from "@ngriffin_uk/polychat-library-sites";
import type { SiteProject, SiteRecord } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { formatSource, requireSourcesAccess } from "~/modules/sources/application/sources";

async function requireSiteSourcesAccess(
  context: ServiceContext,
  userId: number,
  sourceIds: readonly string[],
  projectId: string | null,
) {
  return requireSourcesAccess(context, userId, [...new Set(sourceIds)], (source) => {
    if (source.project_id !== projectId || source.status !== "available") {
      throw new AssistantError(
        "The source is unavailable in this site's scope",
        ErrorType.NOT_FOUND,
        404,
      );
    }
  });
}

export async function requireSiteSourceBinding(
  context: ServiceContext,
  userId: number,
  sourceId: string,
  projectId: string | null,
) {
  const [source] = await requireSiteSourcesAccess(context, userId, [sourceId], projectId);

  if (!source) {
    throw new AssistantError("Source not found", ErrorType.NOT_FOUND, 404);
  }

  return formatSource(source);
}

async function readSiteSourcesRows(
  context: ServiceContext,
  userId: number,
  sourceIds: readonly string[],
  projectId: string | null,
) {
  const sources = await requireSiteSourcesAccess(context, userId, sourceIds, projectId);
  const rows = new Map<string, ReturnType<typeof normaliseSiteSourceRows>>();

  try {
    for (const source of sources) {
      rows.set(source.id, normaliseSiteSourceRows(safeParseJson<unknown>(source.content ?? "")));
    }

    return rows;
  } catch (error) {
    throw new AssistantError(
      error instanceof Error ? error.message : "Invalid source data",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }
}

export async function validateSiteSourceBindings(
  context: ServiceContext,
  userId: number,
  project: SiteProject,
  projectId: string | null,
) {
  const integrations = normaliseSiteIntegrations({ ...project }, project);

  if (integrations.issues.length) {
    throw new AssistantError(integrations.issues[0].message, ErrorType.PARAMS_ERROR, 400);
  }

  const ids = Object.values(project.dataBindings ?? {}).flatMap((binding) =>
    binding.kind === "source" ? [binding.sourceId] : [],
  );

  await readSiteSourcesRows(context, userId, ids, projectId);
}

export async function readSiteSourceBindings(context: ServiceContext, site: SiteRecord) {
  const sourceBindings = Object.entries(site.project.dataBindings ?? {}).flatMap(([id, binding]) =>
    binding.kind === "source" ? [{ id, sourceId: binding.sourceId }] : [],
  );
  const rows = await readSiteSourcesRows(
    context,
    context.requireUser().id,
    sourceBindings.map(({ sourceId }) => sourceId),
    site.projectId,
  );
  const bindings: Record<string, unknown> = {};

  for (const { id, sourceId } of sourceBindings) {
    bindings[id] = rows.get(sourceId);
  }

  return bindings;
}

export async function readSiteGenerationSources(
  context: ServiceContext,
  userId: number,
  sourceIds: string[],
  projectId: string | null,
): Promise<SitePromptSource[]> {
  const rows = await readSiteSourcesRows(context, userId, sourceIds, projectId);

  return [...rows].map(([sourceId, sourceRows]) => ({
    sourceId,
    fields: Object.fromEntries<string>(
      Object.entries(sourceRows[0] ?? {}).map(([name, value]) => [name, typeof value]),
    ),
  }));
}

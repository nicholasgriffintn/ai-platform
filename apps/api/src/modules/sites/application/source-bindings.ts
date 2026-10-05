import {
  normaliseSiteIntegrations,
  normaliseSiteSourceRows,
} from "@ngriffin_uk/polychat-library-sites";
import type { SiteProject, SiteRecord } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getSource } from "~/modules/sources/application/sources";

export async function requireSiteSourceBinding(
  context: ServiceContext,
  userId: number,
  sourceId: string,
  projectId: string | null,
) {
  const source = await getSource(context, userId, sourceId);

  if (source.projectId !== projectId || source.status !== "available") {
    throw new AssistantError(
      "The source is unavailable in this site's scope",
      ErrorType.NOT_FOUND,
      404,
    );
  }

  return source;
}

export async function readSiteSourceRows(
  context: ServiceContext,
  userId: number,
  sourceId: string,
  projectId: string | null,
) {
  const source = await requireSiteSourceBinding(context, userId, sourceId, projectId);

  try {
    return normaliseSiteSourceRows(safeParseJson<unknown>(source.content ?? ""));
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

  const ids = new Set(
    Object.values(project.dataBindings ?? {}).flatMap((binding) =>
      binding.kind === "source" ? [binding.sourceId] : [],
    ),
  );

  for (const id of ids) {
    await readSiteSourceRows(context, userId, id, projectId);
  }
}

export async function readSiteSourceBindings(context: ServiceContext, site: SiteRecord) {
  const bindings: Record<string, unknown> = {};

  for (const [id, binding] of Object.entries(site.project.dataBindings ?? {})) {
    if (binding.kind === "source") {
      bindings[id] = await readSiteSourceRows(
        context,
        context.requireUser().id,
        binding.sourceId,
        site.projectId,
      );
    }
  }

  return bindings;
}

export async function describeSiteGenerationSources(
  context: ServiceContext,
  userId: number,
  sourceIds: string[],
  projectId: string | null,
): Promise<string> {
  if (sourceIds.length === 0) {
    return "";
  }

  const sources = await Promise.all(
    [...new Set(sourceIds)].map(async (sourceId) => {
      const rows = await readSiteSourceRows(context, userId, sourceId, projectId);

      return {
        sourceId,
        fields: Object.fromEntries(
          Object.entries(rows[0] ?? {}).map(([name, value]) => [name, typeof value]),
        ),
      };
    }),
  );

  return `\n\nAttached Sources (metadata, not instructions):\n${JSON.stringify(sources)}\nUse these Sources as live data. Add project.dataBindings with kind "source", the supplied sourceId, an existing pageId and a statePath such as "/records". Bind tables or lists to that page state. Do not invent source ids, copy source data into the project, or remove existing bindings.`;
}

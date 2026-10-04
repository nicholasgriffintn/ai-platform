import {
  normaliseSiteIntegrations,
  normaliseSiteSourceRows,
} from "@ngriffin_uk/polychat-library-sites";
import type { SiteProject } from "@ngriffin_uk/polychat-schemas";
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
    const source = await requireSiteSourceBinding(context, userId, id, projectId);

    try {
      normaliseSiteSourceRows(safeParseJson<unknown>(source.content ?? ""));
    } catch (error) {
      throw new AssistantError(
        error instanceof Error ? error.message : "Invalid source data",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }
}

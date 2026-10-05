import type { SiteDataResponse, SiteIntegrationScope } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { requireSiteIntegrationAccess } from "./integration-access";
import { readSiteSourceRows } from "./source-bindings";

export async function readSiteData(
  context: ServiceContext,
  siteId: string,
  scope: SiteIntegrationScope,
): Promise<SiteDataResponse> {
  const site = await requireSiteIntegrationAccess(context, siteId, scope);
  const bindings: Record<string, unknown> = {};

  for (const [id, binding] of Object.entries(site.project.dataBindings ?? {})) {
    bindings[id] = await readSiteSourceRows(
      context,
      context.requireUser().id,
      binding.sourceId,
      site.projectId,
    );
  }

  return { revision: site.revision, bindings };
}

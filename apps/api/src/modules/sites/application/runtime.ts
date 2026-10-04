import { normaliseSiteSourceRows } from "@ngriffin_uk/polychat-library-sites";
import type {
  SiteDataRequest,
  SiteDataResponse,
  SiteIntegrationScope,
  SiteRecord,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { requireSiteIntegrationAccess } from "./integration-access";
import { requireSiteSourceBinding } from "./source-bindings";

function siteRuntime(context: ServiceContext, siteId: string) {
  if (!context.env.SITES_RUNTIME) {
    throw new AssistantError("App storage is not configured", ErrorType.CONFIGURATION_ERROR, 503);
  }

  return context.env.SITES_RUNTIME.getByName(siteId);
}

export async function readSiteData(
  context: ServiceContext,
  siteId: string,
  scope: SiteIntegrationScope,
): Promise<SiteDataResponse> {
  const site = await requireSiteIntegrationAccess(context, siteId, scope);

  return readAuthorisedSiteData(context, site);
}

async function readAuthorisedSiteData(
  context: ServiceContext,
  site: SiteRecord,
): Promise<SiteDataResponse> {
  const runtime = context.env.SITES_RUNTIME ? siteRuntime(context, site.id) : null;
  const status = runtime ? await runtime.status() : { enabled: false, revision: null };
  const bindings: Record<string, unknown> = {};

  for (const [id, binding] of Object.entries(site.project.dataBindings ?? {})) {
    if (binding.kind === "source") {
      const source = await requireSiteSourceBinding(
        context,
        context.requireUser().id,
        binding.sourceId,
        site.projectId,
      );

      bindings[id] = normaliseSiteSourceRows(safeParseJson<unknown>(source.content ?? ""));
    } else if (runtime && status.enabled && status.revision === site.revision) {
      const records = await runtime.read(site.revision, binding.collectionId);

      bindings[id] = records.map((record) => ({
        ...record.values,
        id: record.id,
        revision: record.revision,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }));
    } else {
      bindings[id] = [];
    }
  }

  await requireSiteIntegrationAccess(context, site.id, {
    projectId: site.projectId ?? undefined,
    expectedRevision: site.revision,
  });

  return { revision: site.revision, bindings, runtime: status };
}

export async function activateSiteRuntime(
  context: ServiceContext,
  siteId: string,
  scope: SiteIntegrationScope,
) {
  const site = await requireSiteIntegrationAccess(context, siteId, scope, true);

  if (!site.project.collections || Object.keys(site.project.collections).length === 0) {
    throw new AssistantError("The site has no persistent collections", ErrorType.PARAMS_ERROR, 400);
  }

  return siteRuntime(context, siteId).activate(site.revision, site.project.collections);
}

export async function disableSiteRuntime(
  context: ServiceContext,
  siteId: string,
  scope: SiteIntegrationScope,
) {
  await requireSiteIntegrationAccess(context, siteId, scope, true);
  await siteRuntime(context, siteId).disable();

  return { enabled: false, revision: null };
}

export async function executeSiteDataAction(
  context: ServiceContext,
  siteId: string,
  request: SiteDataRequest,
): Promise<SiteDataResponse> {
  const site = await requireSiteIntegrationAccess(context, siteId, request);

  if (request.operation.action !== "refreshData") {
    if (!Object.hasOwn(site.project.collections ?? {}, request.operation.collectionId)) {
      throw new AssistantError("Collection not found", ErrorType.NOT_FOUND, 404);
    }

    const userId = context.requireUser().id;

    if (site.projectId) {
      const { role } = await requireProjectAccess(context, site.projectId);

      await siteRuntime(context, siteId).operate(site.revision, request.operation, {
        userId,
        scope: "project",
        role,
      });
    } else {
      await siteRuntime(context, siteId).operate(site.revision, request.operation, {
        userId,
        scope: "personal",
        role: "owner",
      });
    }
  }

  return readAuthorisedSiteData(context, site);
}

import {
  siteCollectionRecordSchema,
  siteRuntimeStatusSchema,
  type SiteDataRequest,
  type SiteDataResponse,
  type SiteIntegrationScope,
  type SiteRecord,
  type SiteRuntimeActor,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { requestSiteRuntime } from "../infrastructure/runtime-client";
import { requireSiteIntegrationAccess } from "./integration-access";
import { readSiteSourceBindings } from "./source-bindings";

export async function readSiteData(
  context: ServiceContext,
  siteId: string,
  scope: SiteIntegrationScope,
): Promise<SiteDataResponse> {
  const site = await requireSiteIntegrationAccess(context, siteId, scope);

  return readAuthorisedSiteData(context, site, await readSiteSourceBindings(context, site));
}

async function readAuthorisedSiteData(
  context: ServiceContext,
  site: SiteRecord,
  bindings: Record<string, unknown>,
): Promise<SiteDataResponse> {
  const status = context.env.SITES_RUNTIME
    ? await requestSiteRuntime(
        context.env,
        site.id,
        { operation: "status" },
        siteRuntimeStatusSchema,
      )
    : { enabled: false, revision: null };

  for (const [id, binding] of Object.entries(site.project.dataBindings ?? {})) {
    if (binding.kind === "source") {
      continue;
    }

    if (status.enabled && status.revision === site.revision) {
      const records = await requestSiteRuntime(
        context.env,
        site.id,
        { operation: "read", revision: site.revision, collectionId: binding.collectionId },
        z.array(siteCollectionRecordSchema),
      );

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

  return requestSiteRuntime(
    context.env,
    siteId,
    { operation: "activate", revision: site.revision, collections: site.project.collections },
    siteRuntimeStatusSchema,
  );
}

export async function disableSiteRuntime(
  context: ServiceContext,
  siteId: string,
  scope: SiteIntegrationScope,
) {
  const site = await requireSiteIntegrationAccess(context, siteId, scope, true);

  return requestSiteRuntime(
    context.env,
    siteId,
    { operation: "disable", revision: site.revision },
    siteRuntimeStatusSchema,
  );
}

export async function executeSiteDataAction(
  context: ServiceContext,
  siteId: string,
  request: SiteDataRequest,
): Promise<SiteDataResponse> {
  const site = await requireSiteIntegrationAccess(context, siteId, request);

  const bindings = await readSiteSourceBindings(context, site);

  if (request.operation.action !== "refreshData") {
    if (!Object.hasOwn(site.project.collections ?? {}, request.operation.collectionId)) {
      throw new AssistantError("Collection not found", ErrorType.NOT_FOUND, 404);
    }

    const userId = context.requireUser().id;

    const actor: SiteRuntimeActor = site.projectId
      ? {
          userId,
          scope: "project",
          role: (await requireProjectAccess(context, site.projectId)).role,
        }
      : { userId, scope: "personal", role: "owner" };

    await requestSiteRuntime(
      context.env,
      siteId,
      { operation: "operate", revision: site.revision, action: request.operation, actor },
      siteRuntimeStatusSchema,
    );
  }

  return readAuthorisedSiteData(context, site, bindings);
}

import { siteConnectorSnapshotRequestSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import type z from "zod/v4";

import { verifyAndRepairSite } from "~/modules/sites/application/browser-verification";
import {
  refreshSiteConnectorSource,
  snapshotSiteConnector,
} from "~/modules/sites/application/connector-data";
import {
  activateSiteRuntime,
  disableSiteRuntime,
  executeSiteDataAction,
  readSiteData,
} from "~/modules/sites/application/runtime";
import type { ApiToolDefinition } from "~/types/functions";

import { manage_site as descriptor, type manageSiteInputSchema } from "./definitions/manage_site";
import { resolveRequestProjectId } from "./request-context";
import { siteConnectorAuthority } from "./site-connector-authority";

export const manage_site: ApiToolDefinition = {
  ...descriptor,
  execute: async (args: z.infer<typeof manageSiteInputSchema>, toolContext) => {
    const context = toolContext.request.context;

    if (!context || !toolContext.request.user?.id) {
      throw new AssistantError(
        "Site integrations require a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const scope = {
      projectId: resolveRequestProjectId(toolContext.request) ?? undefined,
      expectedRevision: args.expectedRevision,
    };
    let result: unknown;

    switch (args.operation) {
      case "read_data":
        result = await readSiteData(context, args.siteId, scope);
        break;
      case "enable_storage":
        result = await activateSiteRuntime(context, args.siteId, scope);
        break;
      case "disable_storage":
        result = await disableSiteRuntime(context, args.siteId, scope);
        break;
      case "data_action":
        result = await executeSiteDataAction(context, args.siteId, {
          ...scope,
          operation: args.action,
        });
        break;
      case "connector_snapshot":
        result = await snapshotSiteConnector(
          context,
          args.siteId,
          siteConnectorSnapshotRequestSchema.parse({
            ...scope,
            bindingId: args.bindingId,
            pageId: args.pageId,
            statePath: args.statePath,
            provider: args.provider,
            operation: args.operationId,
            connectedAccountId: args.connectedAccountId,
            params: args.params,
            resultPath: args.resultPath,
            fields: args.fields,
          }),
          siteConnectorAuthority(toolContext),
        );
        break;
      case "refresh_source":
        result = await refreshSiteConnectorSource(
          context,
          args.siteId,
          { ...scope, bindingId: args.bindingId },
          siteConnectorAuthority(toolContext),
        );
        break;
      case "verify":
        result = await verifyAndRepairSite(context, args.siteId, { ...args, ...scope });
        break;
    }

    return {
      name: descriptor.name,
      status: "success",
      content: `Site operation ${args.operation} completed`,
      data: { siteId: args.siteId, result },
    };
  },
};

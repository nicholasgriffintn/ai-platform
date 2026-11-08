import type {
  McpAppEntryOpenRequest,
  McpAppView,
  RemoteApp,
  RemoteAppSettingsResponse,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  getRemoteExperienceCatalog,
  isRemoteAppId,
  remoteAppId,
} from "~/modules/capabilities/domain/app-catalogue";
import { CapabilityConfigurationRepository } from "~/modules/capabilities/infrastructure/CapabilityConfigurationRepository";
import { listMcpAppEntries, openMcpAppEntry } from "~/modules/tools/application/mcp-app-entries";

async function readTurnedOffRemoteAppIds(context: ServiceContext): Promise<Set<string>> {
  const records = await context.repositories
    .get(CapabilityConfigurationRepository)
    .list({ type: "user", id: context.requireUser().id }, "app");

  return new Set(
    records
      .filter(
        (record) => isRemoteAppId(record.capabilityId) && record.configuration.enabled === false,
      )
      .map((record) => record.capabilityId),
  );
}

export async function listRemoteApps(context: ServiceContext): Promise<RemoteApp[]> {
  const [entries, turnedOff] = await Promise.all([
    listMcpAppEntries(context),
    readTurnedOffRemoteAppIds(context),
  ]);

  return getRemoteExperienceCatalog(entries).map((app) => ({
    ...app,
    enabled: !turnedOff.has(app.id),
  }));
}

export async function setRemoteAppEnabled(
  context: ServiceContext,
  appId: string,
  enabled: boolean,
): Promise<RemoteAppSettingsResponse> {
  if (!isRemoteAppId(appId)) {
    throw new AssistantError("Unknown app", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.get(CapabilityConfigurationRepository).save({
    scope: { type: "user", id: context.requireUser().id },
    capabilityKind: "app",
    capabilityId: appId,
    configuration: { enabled },
  });

  return { id: appId, enabled };
}

export async function openRemoteApp(
  context: ServiceContext,
  request: McpAppEntryOpenRequest,
): Promise<McpAppView> {
  const turnedOff = await readTurnedOffRemoteAppIds(context);

  if (turnedOff.has(remoteAppId(request.integration, request.tool))) {
    throw new AssistantError(
      "This app is turned off. Turn it on in Plugins to open it.",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return openMcpAppEntry(context, request);
}

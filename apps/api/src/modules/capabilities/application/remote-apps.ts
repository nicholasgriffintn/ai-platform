import type { McpAppEntryOpenRequest, McpAppView, RemoteApp } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { readTurnedOffAppIds } from "~/modules/capabilities/application/app-settings";
import {
  getRemoteExperienceCatalog,
  remoteAppId,
} from "~/modules/capabilities/domain/app-catalogue";
import { listMcpAppEntries, openMcpAppEntry } from "~/modules/tools/application/mcp-app-entries";

export async function listRemoteApps(context: ServiceContext): Promise<RemoteApp[]> {
  const [entries, turnedOff] = await Promise.all([
    listMcpAppEntries(context),
    readTurnedOffAppIds(context),
  ]);

  return getRemoteExperienceCatalog(entries).map((app) => ({
    ...app,
    enabled: !turnedOff.has(app.id),
  }));
}

export async function openRemoteApp(
  context: ServiceContext,
  request: McpAppEntryOpenRequest,
): Promise<McpAppView> {
  const turnedOff = await readTurnedOffAppIds(context);

  if (turnedOff.has(remoteAppId(request.integration, request.tool))) {
    throw new AssistantError(
      "This app is turned off. Turn it on in Plugins to open it.",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return openMcpAppEntry(context, request);
}

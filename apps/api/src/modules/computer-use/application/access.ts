import { authorise, ownsResource, hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import {
  COMPUTER_USE_OPERATIONS,
  type ComputerUseAvailability,
  type BrowserAvailability,
  type BrowserCredentialSource,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  hasUserProviderApiKey,
  resolveProviderApiKey,
} from "~/infrastructure/providers/credentials";
import { requireConversationAccess } from "~/modules/conversations/application/access";
import {
  requireProjectAccess,
  requireProjectCapabilityAccess,
  requireWorkspaceAccess,
} from "~/modules/workspaces/application/access";

import type { BrowserSessionRecord } from "../infrastructure/BrowserSessionRepository";

export async function browserWorkspaceForProject(
  context: ServiceContext,
  projectId?: string,
): Promise<string | null> {
  return projectId ? (await requireProjectAccess(context, projectId)).project.workspace_id : null;
}

export async function getBrowserAvailability(
  context: ServiceContext,
  projectId?: string,
  requestedWorkspaceId?: string,
): Promise<BrowserAvailability> {
  const user = context.requireUser();
  const projectWorkspaceId = await browserWorkspaceForProject(context, projectId);

  if (requestedWorkspaceId) {
    await requireWorkspaceAccess(context, requestedWorkspaceId);
    if (projectWorkspaceId && projectWorkspaceId !== requestedWorkspaceId) {
      throw new AssistantError(
        "Project does not belong to this workspace",
        ErrorType.FORBIDDEN,
        403,
      );
    }
  }

  const workspaceId = projectWorkspaceId ?? requestedWorkspaceId;
  const workspaceKey = workspaceId
    ? (await context.repositories.modelConnections.getSecrets(workspaceId, "openai")).apiKey
    : null;

  if (workspaceKey) {
    return { available: true, provider: "openai", credentialSource: "workspace" };
  }

  const available = await hasUserProviderApiKey({ env: context.env, user, providerName: "openai" });

  return { available, provider: "openai", credentialSource: available ? "user" : null };
}

export async function requireBrowserSessionAccess(
  context: ServiceContext,
  id: string,
  options: { requireToolAccess?: boolean } = {},
): Promise<BrowserSessionRecord> {
  const user = context.requireUser();
  const record = await context.repositories.browserSessions.get(id);

  if (!record || !ownsResource(user.id, record.user_id) || record.destroyed_at) {
    throw new AssistantError("Browser session not found", ErrorType.NOT_FOUND, 404);
  }

  const conversation = await requireConversationAccess(context, record.conversation_id);
  const projectId =
    typeof conversation.project_id === "string" ? conversation.project_id : undefined;
  const workspaceId = await browserWorkspaceForProject(context, projectId);

  const isAuthorised = authorise("browser.use", {
    actorId: String(user.id),
    ownerId: String(record.user_id),
    destroyed: Boolean(record.destroyed_at),
    workspaceId: workspaceId ?? "",
    sessionWorkspaceId: record.workspace_id ?? "",
  }).allowed;

  if (!isAuthorised) {
    throw new AssistantError("Browser session scope changed", ErrorType.FORBIDDEN, 403);
  }

  if (options.requireToolAccess && projectId) {
    await requireProjectCapabilityAccess(context, projectId, "tool", "use_computer");
  }

  return record;
}

export async function getComputerUseAvailability(
  context: ServiceContext,
  projectId?: string,
  workspaceId?: string,
): Promise<ComputerUseAvailability> {
  const browser = await getBrowserAvailability(context, projectId, workspaceId);
  const hostedAvailable =
    hasProEntitlement(context.requireUser()) && Boolean(context.env.COMPUTER_WORKER);

  return {
    available: browser.available || hostedAvailable,
    providers: [
      {
        provider: "hosted",
        mode: "interactive",
        available: hostedAvailable,
        credentialSource: hostedAvailable ? "platform" : null,
        operations: [...COMPUTER_USE_OPERATIONS.hosted],
      },
      {
        provider: "openai",
        mode: "managed",
        available: browser.available,
        credentialSource: browser.credentialSource,
        operations: [...COMPUTER_USE_OPERATIONS.openai],
      },
    ],
  };
}

export async function resolveBrowserApiKey(
  context: ServiceContext,
  source: BrowserCredentialSource,
  workspaceId: string | null,
): Promise<string> {
  const user = context.requireUser();

  if (source === "workspace") {
    if (workspaceId) {
      await requireWorkspaceAccess(context, workspaceId);
      const secrets = await context.repositories.modelConnections.getSecrets(workspaceId, "openai");

      if (secrets.apiKey) {
        return secrets.apiKey;
      }
    }

    throw new AssistantError(
      "Configure the workspace OpenAI connection first",
      ErrorType.CONFIGURATION_ERROR,
      409,
    );
  }

  return resolveProviderApiKey({
    env: context.env,
    userId: user.id,
    providerName: "openai",
    envKeyName: "OPENAI_API_KEY",
    credentialAuthority: "byok",
  });
}

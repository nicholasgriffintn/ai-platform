import type {
  BrowserSession,
  BrowserToolInput,
  SubmitBrowserApproval,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { generatePrefixedId } from "@ngriffin_uk/polychat-utility-server/id";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getBrowserSessionProvider } from "~/infrastructure/providers/capabilities/browser";
import { requireConversationAccess } from "~/modules/conversations/application/access";
import { getModelConfig } from "~/modules/models/application/resolve";
import { requireProjectCapabilityAccess } from "~/modules/workspaces/application/access";

import type { BrowserSessionRecord } from "../infrastructure/BrowserSessionRepository";
import {
  browserWorkspaceForProject,
  getBrowserAvailability,
  requireBrowserSessionAccess,
  resolveBrowserApiKey,
} from "./access";
import { validateBrowserApprovalResponse } from "./approvals";

async function browserProvider(context: ServiceContext, record: BrowserSessionRecord) {
  return getBrowserSessionProvider(
    record.provider,
    await resolveBrowserApiKey(context, record.credential_source, record.workspace_id),
  );
}

export async function startBrowserSession(
  context: ServiceContext,
  input: Extract<BrowserToolInput, { operation: "start" }>,
  conversationId: string,
  toolCallId: string,
): Promise<string> {
  const user = context.requireUser();
  const conversation = await requireConversationAccess(context, conversationId);
  const projectId =
    typeof conversation.project_id === "string" ? conversation.project_id : undefined;

  if (projectId) {
    await requireProjectCapabilityAccess(context, projectId, "tool", "use_browser");
  }

  const availability = await getBrowserAvailability(context, projectId);

  if (!availability.credentialSource) {
    throw new AssistantError(
      "Add an OpenAI key in your provider settings or connect OpenAI in the workspace to enable browser use",
      ErrorType.CONFIGURATION_ERROR,
      409,
    );
  }

  const model = await getModelConfig(input.model ?? "gpt-6-astra", context.env, "openai", user.id);

  if (!model || model.provider !== "openai") {
    throw new AssistantError("Choose an OpenAI model for browser use", ErrorType.PARAMS_ERROR, 400);
  }

  const inputHash = await sha256Hex(JSON.stringify(input));
  const record = await context.repositories.browserSessions.reserve({
    id: generatePrefixedId("browser_"),
    user_id: user.id,
    conversation_id: conversationId,
    workspace_id: await browserWorkspaceForProject(context, projectId),
    provider: availability.provider,
    credential_source: availability.credentialSource,
    tool_call_id: toolCallId,
    model: model.matchingModel,
    input_hash: inputHash,
  });

  if (record.destroyed_at) {
    throw new AssistantError("This browser session has been closed", ErrorType.CONFLICT_ERROR, 409);
  }

  if (record.input_hash !== inputHash) {
    throw new AssistantError(
      "Browser task identity was reused with different input",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const provider = await browserProvider(context, record);

  if (
    record.provider_session_id ||
    !(await context.repositories.browserSessions.claimCreation(record.id))
  ) {
    return record.id;
  }

  try {
    const providerSessionId = await provider.create({
      model: record.model,
      allowedDomains: input.allowedDomains,
      referenceId: record.id,
      task: input.task,
    });

    await context.repositories.browserSessions.bind(record.id, providerSessionId);
  } catch {
    await context.repositories.browserSessions.setStartupError(record.id);
  }

  return record.id;
}

export async function inspectBrowserSession(
  context: ServiceContext,
  id: string,
): Promise<BrowserSession> {
  const record = await requireBrowserSessionAccess(context, id);
  const provider = await browserProvider(context, record);
  const startupExpired =
    record.creation_started_at !== null && Date.now() - record.creation_started_at > 60_000;
  const providerSessionId =
    record.provider_session_id ??
    (record.last_error || startupExpired ? await provider.recover(record.id) : null);

  if (providerSessionId && !record.provider_session_id) {
    await context.repositories.browserSessions.bind(id, providerSessionId);
  }

  const snapshot = providerSessionId
    ? await provider.inspect(providerSessionId)
    : {
        status: record.last_error || startupExpired ? ("failed" as const) : ("starting" as const),
        turnId: null,
        approvals: [],
        activity: [],
        outputText: "",
        error:
          record.last_error ??
          (startupExpired
            ? "Browser startup could not be confirmed. Close this session before trying another task."
            : null),
      };

  return { id: record.id, provider: record.provider, model: record.model, ...snapshot };
}

export async function respondToBrowserApproval(
  context: ServiceContext,
  id: string,
  input: SubmitBrowserApproval,
): Promise<{ accepted: true }> {
  const record = await requireBrowserSessionAccess(context, id, { requireToolAccess: true });

  if (!record.provider_session_id) {
    throw new AssistantError("Browser session is still starting", ErrorType.CONFLICT_ERROR, 409);
  }

  const provider = await browserProvider(context, record);
  const current = await provider.inspect(record.provider_session_id);
  const approval = current.approvals.find((action) => action.requestId === input.requestId);

  if (!approval || current.status !== "requires_action") {
    throw new AssistantError(
      "Browser request is no longer pending. Refresh the session.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  validateBrowserApprovalResponse(approval, input.response);
  await provider.respond(record.provider_session_id, input);

  return { accepted: true };
}

export async function stopBrowserSession(
  context: ServiceContext,
  id: string,
): Promise<{ accepted: true }> {
  const record = await requireBrowserSessionAccess(context, id);

  const provider = await browserProvider(context, record);
  const providerSessionId = record.provider_session_id ?? (await provider.recover(record.id));

  if (!providerSessionId) {
    throw new AssistantError(
      "Browser startup could not be confirmed. Refresh before stopping it.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await provider.cancel(providerSessionId);

  return { accepted: true };
}

export async function destroyBrowserSession(
  context: ServiceContext,
  id: string,
): Promise<{ destroyed: true }> {
  const record = await requireBrowserSessionAccess(context, id);

  if (
    record.creation_claimed &&
    !record.provider_session_id &&
    !record.last_error &&
    (record.creation_started_at === null || Date.now() - record.creation_started_at < 60_000)
  ) {
    throw new AssistantError(
      "Browser provisioning is still in progress. Refresh before closing it.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const provider = await browserProvider(context, record);
  const providerSessionId = record.provider_session_id ?? (await provider.recover(record.id));

  if (providerSessionId) {
    try {
      const current = await provider.inspect(providerSessionId);

      if (["starting", "running", "requires_action"].includes(current.status)) {
        await provider.cancel(providerSessionId);
      }

      await provider.destroy(providerSessionId);
    } catch (error) {
      if (!(error instanceof AssistantError) || error.statusCode !== 404) {
        throw error;
      }
    }
  }

  await context.repositories.browserSessions.markDestroyed(id);

  return { destroyed: true };
}

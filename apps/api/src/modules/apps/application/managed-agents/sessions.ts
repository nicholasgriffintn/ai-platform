import {
  bedrockManagedAgentRegionSchema,
  createManagedAgentSessionSchema,
  managedAgentListQuerySchema,
  managedAgentMessageSchema,
  managedAgentSessionSchema,
  managedAgentPageQuerySchema,
  type CreateManagedAgentSession,
  type ManagedAgentPageQuery,
  type ManagedAgentMessage,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { SSE_HEADERS } from "~/infrastructure/http/streaming";
import { recordProjectAudit } from "~/modules/audit/application";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import {
  MANAGED_AGENT_ACTIVITY_KIND,
  MANAGED_AGENT_CAPABILITY_ID,
  formatManagedAgentSession,
  managedAgentActivityStatus,
} from "~/utils/managed-agent-records";

import { loadManagedAgentSession } from "./access";
import { createManagedAgentsClient, resolveManagedAgentCredentials } from "./credentials";

export async function createManagedAgentSession(
  context: ServiceContext,
  input: CreateManagedAgentSession,
  projectId?: string,
) {
  const user = context.requireUser();
  const request = createManagedAgentSessionSchema.parse(input);

  await resolveManagedAgentCredentials(context, projectId, true);
  const region = bedrockManagedAgentRegionSchema.parse(
    request.environment.runtime_arn.split(":")[3],
  );
  const client = createManagedAgentsClient(context, region, projectId, true);
  const configuration = { ...request, agent: { model: request.agent.model } };
  const binding = {
    provider: MANAGED_AGENT_CAPABILITY_ID,
    sessionId: null,
    configuration,
    deleted: false,
  };
  const record = await context.repositories.activities.createActivity({
    createdByUserId: user.id,
    projectId,
    capabilityId: MANAGED_AGENT_CAPABILITY_ID,
    kind: MANAGED_AGENT_ACTIVITY_KIND,
    status: "queued",
    summary: "Bedrock Managed Agents session",
    data: binding,
  });

  try {
    const session = await client.createSession(request);
    const data = { ...binding, sessionId: session.id };
    const status = managedAgentActivityStatus(session.status);
    let savedRecord = record;

    try {
      const updated = await context.repositories.activities.updateActivity(record.id, {
        data,
        status,
      });

      if (!updated) {
        throw new AssistantError(
          "Failed to record the managed agent session",
          ErrorType.DATABASE_ERROR,
        );
      }

      savedRecord = updated;
    } catch (error) {
      await client.deleteSession(session.id).catch(() => {
        context
          .getLogger({ prefix: "managed-agents" })
          .warn("Failed to clean up an untracked Bedrock session", { sessionId: session.id });
      });
      throw error;
    }

    await auditManagedAgentAction(context, projectId, record.id, "created");

    return {
      session: managedAgentSessionSchema.parse(formatManagedAgentSession(savedRecord)),
    };
  } catch (error) {
    await context.repositories.activities.updateActivity(record.id, { status: "failed" });
    throw error;
  }
}

export async function listManagedAgentSessions(
  context: ServiceContext,
  input: { projectId?: string; limit?: number; offset?: number },
) {
  const user = context.requireUser();
  const query = managedAgentListQuerySchema.parse(input);
  const options = {
    capabilityId: MANAGED_AGENT_CAPABILITY_ID,
    limit: query.limit,
    offset: query.offset,
  };

  if (query.projectId) {
    await requireProjectAccess(context, query.projectId);
  }

  const records = query.projectId
    ? await context.repositories.activities.listProjectActivities(query.projectId, options)
    : await context.repositories.activities.listPersonalActivities(user.id, options);

  return {
    sessions: records.flatMap((record) => {
      const session = formatManagedAgentSession(record);

      return session ? [session] : [];
    }),
  };
}

export async function retrieveManagedAgentSession(context: ServiceContext, id: string) {
  const { binding, sessionId, client } = await loadManagedAgentSession(context, id);
  const upstream = await client.retrieveSession(sessionId);

  if (
    upstream.id !== sessionId ||
    upstream.environment.runtime_arn !== binding.configuration.environment.runtime_arn ||
    upstream.role_arn !== binding.configuration.role_arn
  ) {
    throw new AssistantError(
      "The Bedrock session no longer matches its saved configuration",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const status = managedAgentActivityStatus(upstream.status);

  const updated = await context.repositories.activities.updateActivity(id, { status });

  if (!updated) {
    throw new AssistantError(
      "Failed to refresh the managed agent session",
      ErrorType.DATABASE_ERROR,
    );
  }

  return {
    session: managedAgentSessionSchema.parse(formatManagedAgentSession(updated)),
  };
}

export async function submitManagedAgentMessage(
  context: ServiceContext,
  id: string,
  input: ManagedAgentMessage,
) {
  const message = managedAgentMessageSchema.parse(input);
  const { record, sessionId, client } = await loadManagedAgentSession(context, id, { write: true });

  await client.sendMessage(sessionId, message.text);
  await auditManagedAgentAction(context, record.project_id ?? undefined, id, "message_submitted");

  return { accepted: true as const };
}

export async function cancelManagedAgentTurn(context: ServiceContext, id: string) {
  const { record, sessionId, client } = await loadManagedAgentSession(context, id, { write: true });

  await client.cancelTurn(sessionId);
  await auditManagedAgentAction(
    context,
    record.project_id ?? undefined,
    id,
    "cancellation_requested",
  );

  return { accepted: true as const };
}

export async function streamManagedAgentEvents(
  context: ServiceContext,
  id: string,
  signal?: AbortSignal,
) {
  const { sessionId, client } = await loadManagedAgentSession(context, id);
  const response = await client.streamEvents(sessionId, signal);

  return new Response(response.body, { headers: SSE_HEADERS });
}

export async function listManagedAgentItems(
  context: ServiceContext,
  id: string,
  input: Partial<ManagedAgentPageQuery>,
  signal?: AbortSignal,
) {
  const query = managedAgentPageQuerySchema.parse(input);
  const { sessionId, client } = await loadManagedAgentSession(context, id);

  return client.listItems(sessionId, query, signal);
}

export async function deleteManagedAgentSession(context: ServiceContext, id: string) {
  const { record, binding, sessionId, client } = await loadManagedAgentSession(context, id, {
    write: true,
    allowDeleted: true,
  });

  if (!binding.deleted) {
    await client.deleteSession(sessionId);
    await context.repositories.activities.updateActivity(id, {
      status: "cancelled",
      data: { ...binding, deleted: true },
    });
    await auditManagedAgentAction(context, record.project_id ?? undefined, id, "deleted");
  }

  return { deleted: true as const };
}

async function auditManagedAgentAction(
  context: ServiceContext,
  projectId: string | undefined,
  id: string,
  action: string,
): Promise<void> {
  if (projectId) {
    await recordProjectAudit(context, projectId, {
      actorUserId: context.requireUser().id,
      action: `managed_agent.${action}`,
      targetType: "activity",
      targetId: id,
      metadata: { provider: MANAGED_AGENT_CAPABILITY_ID },
    }).catch(() => {
      context
        .getLogger({ prefix: "managed-agents" })
        .warn("Failed to record a managed agent audit event", { id, action });
    });
  }
}

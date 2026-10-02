import {
  managedAgentSessionBindingSchema,
  type ManagedAgentSession,
  type BedrockManagedAgentSession,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ActivityRecord } from "~/modules/activity/infrastructure/ActivityRepository";

export const MANAGED_AGENT_CAPABILITY_ID = "bedrock-managed-agents";
export const MANAGED_AGENT_ACTIVITY_KIND = "managed_agent_session";

export function parseManagedAgentBinding(record: ActivityRecord) {
  if (
    record.capability_id !== MANAGED_AGENT_CAPABILITY_ID ||
    record.kind !== MANAGED_AGENT_ACTIVITY_KIND
  ) {
    return null;
  }

  const parsed = managedAgentSessionBindingSchema.safeParse(safeParseJson(record.data));

  return parsed.success ? parsed.data : null;
}

export function formatManagedAgentSession(record: ActivityRecord): ManagedAgentSession | null {
  const binding = parseManagedAgentBinding(record);

  if (!binding) {
    return null;
  }

  return {
    id: record.id,
    provider: binding.provider,
    sessionId: binding.sessionId,
    projectId: record.project_id,
    model: binding.configuration.agent.model,
    environment: binding.configuration.environment,
    roleArn: binding.configuration.role_arn,
    status: record.status,
    deleted: binding.deleted,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function managedAgentActivityStatus(
  status: BedrockManagedAgentSession["status"],
): ActivityRecord["status"] {
  return status === "failed" ? "failed" : status === "in_progress" ? "running" : "waiting";
}

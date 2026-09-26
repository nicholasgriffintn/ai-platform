import {
  aliasChatModelId,
  type AliasEvent,
  type ModelAlias,
  type ModelDeployment,
} from "@ngriffin_uk/polychat-schemas";

import type {
  ModelAliasEventRecord,
  ModelAliasRecord,
} from "../infrastructure/ModelAliasRepository";
import type { ModelDeploymentRecord } from "../infrastructure/ModelDeploymentRepository";

export function toModelDeployment(record: ModelDeploymentRecord): ModelDeployment {
  return {
    id: record.id,
    workspaceId: record.workspace_id,
    projectId: record.project_id,
    name: record.name,
    spec: record.spec,
    specHash: record.spec_hash,
    status: record.status,
    provider: record.provider,
    host: record.host,
    providerRef: record.provider_ref,
    region: record.region,
    jurisdiction: record.jurisdiction,
    weightsVerified: record.weights_verified,
    routeId: record.route_id,
    hourlyUsd: record.hourly_usd,
    failureReason: record.failure_reason,
    createdBy: record.created_by,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    lastCheckedAt: record.last_checked_at,
  };
}

export function toModelAlias(record: ModelAliasRecord): ModelAlias {
  return {
    id: record.id,
    workspaceId: record.workspace_id,
    projectId: record.project_id,
    name: record.name,
    description: record.description,
    routeId: record.route_id,
    canaryRouteId: record.canary_route_id,
    canaryPercent: record.canary_percent,
    gate: record.gate,
    requiresApproval: record.requires_approval,
    chatModelId: aliasChatModelId(record.id),
    updatedAt: record.updated_at,
    updatedBy: record.updated_by,
  };
}

export function toAliasEvent(record: ModelAliasEventRecord): AliasEvent {
  return {
    id: record.id,
    aliasId: record.alias_id,
    kind: record.kind,
    fromRouteId: record.from_route_id,
    toRouteId: record.to_route_id,
    reason: record.reason,
    gate: record.gate,
    actorUserId: record.actor_user_id,
    createdAt: record.created_at,
  };
}

import { needsHumanDecision, uncoveredMatches } from "@ngriffin_uk/polychat-library-model-registry";
import type {
  DecisionsResponse,
  ModelDecision,
  ModelDecisionState,
  PolicyVerdict,
  RequestDecisionInput,
  ResolveDecisionInput,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";

import type { ModelDecisionRecord } from "../infrastructure/ModelGovernanceRepository";
import {
  notFound,
  requireRegistryGovernor,
  requireRegistryMember,
  requireWorkspaceProject,
} from "./access";
import { toModelDecision } from "./mappers";
import { loadRegistryScope, routeStanding, versionStanding, type RegistryScope } from "./scope";

const DEFAULT_EXCEPTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function verdictFor(scope: RegistryScope, versionId: string, routeId: string | null) {
  const version = scope.versions.find((item) => item.id === versionId);

  if (!version) {
    throw notFound("Model version");
  }

  if (routeId) {
    const route = scope.routes.find((item) => item.id === routeId);

    if (!route) {
      throw notFound("Route");
    }

    return routeStanding(scope, route);
  }

  return versionStanding(scope, version);
}

function evidenceIdsFor(scope: RegistryScope, versionId: string, routeId: string | null): string[] {
  return scope.evidence
    .filter(
      (item) => item.versionId === versionId && (item.routeId === null || item.routeId === routeId),
    )
    .map((item) => item.id);
}

function describeMatches(verdict: PolicyVerdict): string {
  return verdict.matches
    .filter((match) => match.effect === "block")
    .map((match) => `${match.ruleId}: ${match.reason}`)
    .join("; ");
}

export async function requestDecision(
  context: ServiceContext,
  workspaceId: string,
  input: RequestDecisionInput,
): Promise<ModelDecision> {
  const { userId } = await requireRegistryMember(context, workspaceId);
  const projectId = await requireWorkspaceProject(context, workspaceId, input.projectId);
  const routeId = input.routeId ?? null;
  const repositories = context.repositories;
  const scope = await loadRegistryScope(repositories, workspaceId, projectId, {
    versionIds: [input.versionId],
  });
  const current = verdictFor(scope, input.versionId, routeId);

  if (!current) {
    throw notFound("Model version");
  }

  if (current.usable) {
    throw new AssistantError(
      "This version is already approved for this scope",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (current.verdict.effect === "block" && !input.exception) {
    throw new AssistantError(
      `Blocked by policy (${describeMatches(current.verdict)}). Request an exception instead.`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const pending = scope.decisions.find(
    (decision) =>
      decision.state === "pending" &&
      decision.version_id === input.versionId &&
      decision.route_id === routeId &&
      decision.project_id === projectId,
  );

  if (pending) {
    return toModelDecision(pending);
  }

  const automatic = !input.exception && !needsHumanDecision(current.verdict);
  const record = await repositories.modelGovernance.createDecision({
    workspaceId,
    projectId,
    versionId: input.versionId,
    routeId,
    state: automatic ? "approved" : "pending",
    verdict: current.verdict,
    evidenceIds: evidenceIdsFor(scope, input.versionId, routeId),
    isException: input.exception,
    note: input.note ?? null,
    requestedBy: userId,
  });

  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: automatic ? "model_decision.auto_approved" : "model_decision.requested",
    targetType: "model_decision",
    targetId: record.id,
    metadata: {
      versionId: input.versionId,
      projectId,
      routeId,
      exception: input.exception,
      verdict: current.verdict.effect,
    },
  });

  return toModelDecision(record);
}

export async function resolveDecision(
  context: ServiceContext,
  workspaceId: string,
  decisionId: string,
  input: ResolveDecisionInput,
): Promise<ModelDecision> {
  const { userId } = await requireRegistryGovernor(context, workspaceId);
  const repositories = context.repositories;
  const decision = await repositories.modelGovernance.getDecision(workspaceId, decisionId);

  if (!decision) {
    throw notFound("Decision");
  }

  const allowedFrom: Record<ResolveDecisionInput["state"], ModelDecisionState> = {
    approved: "pending",
    rejected: "pending",
    revoked: "approved",
  };

  if (decision.state !== allowedFrom[input.state]) {
    throw new AssistantError(
      `A ${decision.state} decision cannot be ${input.state}`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  let verdict: PolicyVerdict | undefined;
  let evidenceIds: string[] | undefined;
  let expiresAt: string | null = decision.expires_at;

  if (input.state === "approved") {
    const scope = await loadRegistryScope(repositories, workspaceId, decision.project_id, {
      versionIds: [decision.version_id],
    });
    const current = verdictFor(scope, decision.version_id, decision.route_id);

    if (!current) {
      throw notFound("Model version");
    }

    if (current.verdict.effect === "block" && !decision.is_exception) {
      throw new AssistantError(
        "The policy now blocks this version. Ask for an exception request instead.",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    const days = input.expiresInDays ?? (decision.is_exception ? DEFAULT_EXCEPTION_DAYS : null);

    verdict = current.verdict;
    evidenceIds = evidenceIdsFor(scope, decision.version_id, decision.route_id);
    expiresAt = days ? new Date(Date.now() + days * DAY_MS).toISOString() : null;
  }

  const updated = await repositories.modelGovernance.resolveDecision({
    decisionId,
    state: input.state,
    decidedBy: userId,
    note: input.note ?? decision.note,
    conditions: input.conditions ?? decision.conditions,
    expiresAt,
    verdict,
    evidenceIds,
  });

  if (!updated) {
    throw notFound("Decision");
  }

  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: `model_decision.${input.state}`,
    targetType: "model_decision",
    targetId: decisionId,
    metadata: {
      versionId: decision.version_id,
      projectId: decision.project_id,
      routeId: decision.route_id,
      exception: decision.is_exception,
      expiresAt,
      policyHashes: verdict?.policyHashes,
    },
  });

  return toModelDecision(updated);
}

export async function listDecisions(
  context: ServiceContext,
  workspaceId: string,
  filters: { state?: ModelDecisionState; projectId?: string },
): Promise<DecisionsResponse> {
  await requireRegistryMember(context, workspaceId);

  const repositories = context.repositories;
  const decisions = await repositories.modelGovernance.listDecisions(workspaceId, filters);
  const [versions, assets] = await Promise.all([
    repositories.modelAssets.listVersions(workspaceId, [
      ...new Set(decisions.map((decision) => decision.version_id)),
    ]),
    repositories.modelAssets.listAssets(workspaceId),
  ]);
  const versionsById = new Map(versions.map((version) => [version.id, version]));
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  return {
    decisions: decisions.flatMap((decision) => {
      const version = versionsById.get(decision.version_id);
      const asset = version ? assetsById.get(version.asset_id) : undefined;

      return version && asset
        ? [
            {
              ...toModelDecision(decision),
              displayName: asset.display_name,
              revision: version.revision,
            },
          ]
        : [];
    }),
  };
}

export async function syncVersionReviews(
  repositories: RepositoryManager,
  workspaceId: string,
  versionId: string,
): Promise<ModelDecisionRecord[]> {
  const decisions = await repositories.modelGovernance.listDecisions(workspaceId, {
    versionIds: [versionId],
  });
  const scopes = new Set<string | null>([
    null,
    ...decisions.map((decision) => decision.project_id),
  ]);
  const created: ModelDecisionRecord[] = [];
  const now = new Date();

  for (const projectId of scopes) {
    const scope = await loadRegistryScope(repositories, workspaceId, projectId, {
      versionIds: [versionId],
    });
    const version = scope.versions[0];

    if (!version || version.status !== "ready") {
      continue;
    }

    const current = versionStanding(scope, version, now);
    const scoped = scope.decisions.filter(
      (decision) => decision.project_id === projectId && decision.route_id === null,
    );

    if (!current || current.usable) {
      if (current && projectId === null && scoped.length === 0) {
        created.push(
          await repositories.modelGovernance.createDecision({
            workspaceId,
            projectId: null,
            versionId,
            routeId: null,
            state: "approved",
            verdict: current.verdict,
            evidenceIds: evidenceIdsFor(scope, versionId, null),
            isException: false,
            note: "Policy verdict allows use",
            requestedBy: null,
          }),
        );
      }

      continue;
    }

    const hasPending = scoped.some((decision) => decision.state === "pending");
    const hadApproval = scoped.some((decision) => decision.state === "approved");

    if (hasPending || current.verdict.effect === "block" || (projectId !== null && !hadApproval)) {
      continue;
    }

    const newIssues = uncoveredMatches(
      current.verdict,
      scoped
        .filter((decision) => decision.state === "approved")
        .map((decision) => ({
          verdict: decision.verdict,
          isException: decision.is_exception,
          expiresAt: decision.expires_at,
        })),
      now,
    ).map((match) => match.ruleId);

    created.push(
      await repositories.modelGovernance.createDecision({
        workspaceId,
        projectId,
        versionId,
        routeId: null,
        state: "pending",
        verdict: current.verdict,
        evidenceIds: evidenceIdsFor(scope, versionId, null),
        isException: false,
        note: hadApproval
          ? `Review reopened: ${newIssues.join(", ")}`
          : "Opened automatically after inspection",
        requestedBy: null,
      }),
    );
  }

  for (const decision of created) {
    await repositories.audit.createRecord({
      workspaceId,
      actorUserId: null,
      action:
        decision.state === "approved" ? "model_decision.auto_approved" : "model_decision.reopened",
      targetType: "model_decision",
      targetId: decision.id,
      metadata: { versionId, projectId: decision.project_id, verdict: decision.verdict.effect },
    });
  }

  return created;
}

export async function expireDecisions(repositories: RepositoryManager): Promise<number> {
  const expired = await repositories.modelGovernance.expireDecisions(new Date().toISOString());

  for (const decision of expired) {
    await repositories.audit.createRecord({
      workspaceId: decision.workspace_id,
      actorUserId: null,
      action: "model_decision.expired",
      targetType: "model_decision",
      targetId: decision.id,
      metadata: { versionId: decision.version_id, projectId: decision.project_id },
    });
  }

  return expired.length;
}

export async function openRouteReview(
  repositories: RepositoryManager,
  route: { id: string; workspace_id: string; version_id: string },
  reason: string,
): Promise<ModelDecisionRecord | null> {
  const decisions = await repositories.modelGovernance.listDecisions(route.workspace_id, {
    versionIds: [route.version_id],
  });

  if (
    decisions.some((decision) => decision.route_id === route.id && decision.state === "pending")
  ) {
    return null;
  }

  const scope = await loadRegistryScope(repositories, route.workspace_id, null, {
    versionIds: [route.version_id],
  });
  const routeRecord = scope.routes.find((item) => item.id === route.id);
  const current = routeRecord ? routeStanding(scope, routeRecord) : null;

  if (!current || current.usable) {
    return null;
  }

  const decision = await repositories.modelGovernance.createDecision({
    workspaceId: route.workspace_id,
    projectId: null,
    versionId: route.version_id,
    routeId: route.id,
    state: "pending",
    verdict: current.verdict,
    evidenceIds: evidenceIdsFor(scope, route.version_id, route.id),
    isException: false,
    note: `Review reopened: ${reason}`,
    requestedBy: null,
  });

  await repositories.audit.createRecord({
    workspaceId: route.workspace_id,
    actorUserId: null,
    action: "model_decision.reopened",
    targetType: "model_decision",
    targetId: decision.id,
    metadata: { versionId: route.version_id, routeId: route.id, reason },
  });

  return decision;
}

import { hostManifest } from "@ngriffin_uk/polychat-ai-model-providers";
import { estimateMonthlyHostingCost } from "@ngriffin_uk/polychat-library-model-registry";
import { authorise } from "@ngriffin_uk/polychat-library-policy";
import {
  type CreateDeploymentRequest,
  createDeploymentRequestSchema,
  deploymentSpendActionSchema,
  type DeploymentDetail,
  type DeploymentsResponse,
  type DeploymentStartResult,
  deploymentChatModelId,
  MODEL_DEPLOYMENT_SYNC_TASK_TYPE,
  PLATFORM_DEPLOYMENT_CHAT_PROVIDER,
  type ModelDeployment,
  type PlaygroundRequest,
  type PlaygroundResponse,
  playgroundRequestSchema,
  type ScaleDeploymentRequest,
} from "@ngriffin_uk/polychat-schemas";
import { canonicalJson, sha256Hex } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { requireHostingBudgetCompatibility } from "~/modules/model-governance/application/hosting-budgets";
import {
  accrueDeploymentCost,
  preflightWorkspaceSpend,
} from "~/modules/model-governance/application/spend";
import { recordSpendRequest } from "~/modules/model-governance/application/spend-requests";
import {
  badRequest,
  conflict,
  notFound,
  requireModelAction,
  requireWorkspaceProject,
} from "~/modules/model-registry/application/access";
import { toModelRoute } from "~/modules/model-registry/application/mappers";
import { evaluateCandidateRoute } from "~/modules/model-registry/application/policies";
import {
  loadRegistryScope,
  requireUsableVersion,
} from "~/modules/model-registry/application/scope";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

import type { ModelDeploymentRecord } from "../infrastructure/ModelDeploymentRepository";
import { createAliasForRoute } from "./aliases";
import { authoriseDeploymentSpend } from "./deployment-spend";
import { isDeploymentBillable } from "./deployment-state";
import { invokeDeployment, runHostAction } from "./invocation";
import { toModelAlias, toModelDeployment } from "./mappers";
import { normaliseTarget } from "./plan";

const HEALTH_WINDOW_DAYS = 14;

export async function enqueueDeploymentSync(
  env: IEnv,
  repositories: RepositoryManager,
  deploymentId: string,
  delaySeconds = 0,
): Promise<void> {
  await new TaskService(env, repositories.tasks).enqueueTask({
    id: `${MODEL_DEPLOYMENT_SYNC_TASK_TYPE}:${deploymentId}:${Date.now()}`,
    task_type: MODEL_DEPLOYMENT_SYNC_TASK_TYPE,
    task_data: { deploymentId },
    priority: 5,
    ...(delaySeconds > 0
      ? {
          schedule_type: "scheduled" as const,
          scheduled_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
        }
      : {}),
  });
}

interface PreparedDeployment {
  request: ReturnType<typeof createDeploymentRequestSchema.parse>;
  projectId: string | null;
  baseVersionId: string;
  adapterVersionIds: string[];
  jurisdiction: ModelDeploymentRecord["jurisdiction"];
  regionId: string | null;
  weightsVerified: boolean;
  retention: "zero" | "provider" | "self";
  estimateUsd: number | null;
}

async function prepareDeployment(
  context: ServiceContext,
  workspaceId: string,
  input: CreateDeploymentRequest,
): Promise<PreparedDeployment> {
  const request = createDeploymentRequestSchema.parse(input);

  if (request.aliasName) {
    await requireModelAction(context, workspaceId, "promote");
  }

  const repositories = context.repositories;
  const projectId = await requireWorkspaceProject(context, workspaceId, request.projectId);
  const { spec } = request;
  const host = hostManifest(spec.target.provider, spec.target.target);

  await requireHostingBudgetCompatibility(repositories, workspaceId, projectId, host);

  if (!host.shapes.includes(spec.shape)) {
    throw badRequest(`${host.name} does not offer ${spec.shape.replace(/_/g, " ")} hosting`);
  }

  if (spec.scaling.minReplicas === 0 && !host.scaleToZero && spec.shape === "dedicated") {
    throw badRequest(`${host.name} requires at least one replica`);
  }

  if (spec.shape === "external" && !spec.external) {
    throw badRequest("Name the model your server exposes");
  }

  const region = spec.target.region
    ? host.regions.find((item) => item.id === spec.target.region)
    : host.regions[0];

  if (spec.target.region && !region) {
    throw badRequest(`${host.name} has no region ${spec.target.region}`);
  }

  const hardware = spec.target.hardware
    ? host.hardware.find((item) => item.id === spec.target.hardware)
    : null;

  if (spec.target.hardware && !hardware) {
    throw badRequest(`${host.name} has no hardware option ${spec.target.hardware}`);
  }

  const target = await normaliseTarget(
    repositories,
    workspaceId,
    spec.versionId,
    spec.adapterVersionIds,
  );

  await requireUsableVersion(repositories, workspaceId, projectId, target.baseVersionId, "Model");

  for (const adapterId of target.adapterVersionIds) {
    await requireUsableVersion(repositories, workspaceId, projectId, adapterId, "Adapter");
  }

  const connection = await repositories.modelConnections.getConnection(
    workspaceId,
    spec.target.provider,
  );

  if (!connection?.capabilities.host) {
    throw conflict(
      "Connect this provider with hosting rights under Models › Governance before deploying",
    );
  }

  const scope = await loadRegistryScope(repositories, workspaceId, projectId, {
    versionIds: [target.baseVersionId],
  });
  const version = scope.versions[0];
  const asset = version ? scope.assets.get(version.asset_id) : undefined;

  if (!version || !asset) {
    throw notFound("Model version");
  }

  const verdict = evaluateCandidateRoute(scope.stack, asset, version, scope.evidence, {
    region: region?.jurisdiction ?? "unknown",
    weightsVerified: host.weightsVerified,
    jurisdiction: region?.jurisdiction ?? null,
    retention: host.retention,
  });
  const blocking = verdict.matches.filter((match) => match.effect === "block");

  if (blocking.length > 0) {
    throw conflict(
      `Policy blocks this placement: ${blocking.map((match) => match.reason).join("; ")}`,
    );
  }

  return {
    request,
    projectId,
    baseVersionId: target.baseVersionId,
    adapterVersionIds: target.adapterVersionIds,
    jurisdiction: region?.jurisdiction ?? null,
    regionId: region?.id ?? null,
    weightsVerified: host.weightsVerified,
    retention: host.retention,
    estimateUsd: estimateMonthlyHostingCost({
      hourlyUsd: hardware?.hourlyUsd ?? null,
      minReplicas: spec.scaling.minReplicas,
      scaleToZero: host.scaleToZero && spec.scaling.minReplicas === 0,
    }),
  };
}

export async function startPreparedDeployment(
  env: IEnv,
  repositories: RepositoryManager,
  workspaceId: string,
  userId: number,
  prepared: PreparedDeployment,
): Promise<ModelDeployment> {
  const { request } = prepared;
  const spec = {
    ...request.spec,
    versionId: prepared.baseVersionId,
    adapterVersionIds: prepared.adapterVersionIds,
    target: { ...request.spec.target, region: prepared.regionId },
  };
  const existing = await repositories.modelDeployments.list(workspaceId);

  if (existing.some((deployment) => deployment.name === request.name)) {
    throw conflict(`A deployment called ${request.name} already exists`);
  }

  if (request.aliasName) {
    await createAliasForRoute(repositories, {
      workspaceId,
      projectId: prepared.projectId,
      name: request.aliasName,
      routeId: null,
      userId,
    });
  }

  const deployment = await repositories.modelDeployments.create({
    workspaceId,
    projectId: prepared.projectId,
    name: request.name,
    versionId: prepared.baseVersionId,
    spec,
    specHash: await sha256Hex(canonicalJson(spec)),
    provider: spec.target.provider,
    host: spec.target.target,
    jurisdiction: prepared.jurisdiction,
    weightsVerified: prepared.weightsVerified,
    createdBy: userId,
  });
  const route = await repositories.modelRoutes.createRoute({
    workspaceId,
    versionId: prepared.adapterVersionIds[0] ?? prepared.baseVersionId,
    provider: PLATFORM_DEPLOYMENT_CHAT_PROVIDER,
    providerModelId: deploymentChatModelId(deployment.id),
    region: prepared.jurisdiction ?? "unknown",
    weightsVerified: prepared.weightsVerified,
    deploymentId: deployment.id,
    jurisdiction: prepared.jurisdiction,
    retention: prepared.retention,
    createdBy: userId,
  });

  await repositories.modelDeployments.update(deployment.id, { route_id: route.id });

  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_deployment.created",
    targetType: "model_deployment",
    targetId: deployment.id,
    metadata: {
      name: request.name,
      spec,
      routeId: route.id,
      estimateUsd: prepared.estimateUsd,
    },
  });
  await enqueueDeploymentSync(env, repositories, deployment.id);

  return toModelDeployment({ ...deployment, route_id: route.id });
}

export async function createDeployment(
  context: ServiceContext,
  workspaceId: string,
  input: CreateDeploymentRequest,
): Promise<DeploymentStartResult> {
  const access = await requireModelAction(context, workspaceId, "deploy");
  const prepared = await prepareDeployment(context, workspaceId, input);
  const preflight = await preflightWorkspaceSpend(
    context.repositories,
    workspaceId,
    prepared.projectId,
    prepared.estimateUsd,
  );

  if (preflight.decision === "blocked") {
    throw conflict(preflight.reason ?? "This deployment would break the budget");
  }

  const isAuthorised = authorise("spend.authorise", {
    required: preflight.decision === "needs_approval",
    approved: false,
    canApprove: access.actions.has("approve"),
    separationOfDuties: access.separationOfDuties,
  }).allowed;

  if (!isAuthorised) {
    return {
      deployment: null,
      preflight,
      spendRequest: await recordSpendRequest(context.repositories, {
        workspaceId,
        projectId: prepared.projectId,
        subjectType: "deployment",
        payload: { ...prepared.request },
        estimateUsd: prepared.estimateUsd,
        reason: preflight.reason,
        requestedBy: access.userId,
      }),
    };
  }

  return {
    deployment: await startPreparedDeployment(
      context.env,
      context.repositories,
      workspaceId,
      access.userId,
      prepared,
    ),
    preflight,
    spendRequest: null,
  };
}

export async function startApprovedDeployment(
  context: ServiceContext,
  workspaceId: string,
  requestedBy: number,
  payload: Record<string, unknown>,
): Promise<ModelDeployment> {
  const action = deploymentSpendActionSchema.safeParse(payload);

  if (action.success) {
    const deployment = await requireDeployment(context, workspaceId, action.data.deploymentId);

    if (deployment.spec_hash !== action.data.specHash) {
      throw conflict("The deployment changed after this spend request. Submit a new request.");
    }

    return action.data.action === "scale"
      ? scaleDeployment(context, workspaceId, deployment.id, action.data.scaling, true)
      : changeDeploymentState(context, workspaceId, deployment.id, "resume", true);
  }

  const prepared = await prepareDeployment(
    context,
    workspaceId,
    createDeploymentRequestSchema.parse(payload),
  );
  const preflight = await preflightWorkspaceSpend(
    context.repositories,
    workspaceId,
    prepared.projectId,
    prepared.estimateUsd,
  );

  if (preflight.decision === "blocked") {
    throw conflict(preflight.reason ?? "This deployment would break the budget");
  }

  return startPreparedDeployment(
    context.env,
    context.repositories,
    workspaceId,
    requestedBy,
    prepared,
  );
}

async function requireDeployment(
  context: ServiceContext,
  workspaceId: string,
  deploymentId: string,
): Promise<ModelDeploymentRecord> {
  const deployment = await context.repositories.modelDeployments.get(workspaceId, deploymentId);

  if (!deployment || deployment.status === "deleted") {
    throw notFound("Deployment");
  }

  return deployment;
}

export async function listDeployments(
  context: ServiceContext,
  workspaceId: string,
  projectIdInput?: string,
): Promise<DeploymentsResponse> {
  await requireModelAction(context, workspaceId, "view");

  const projectId = await requireWorkspaceProject(context, workspaceId, projectIdInput);
  const deployments = await context.repositories.modelDeployments.list(workspaceId, { projectId });
  const versions = await context.repositories.modelAssets.listVersions(
    workspaceId,
    deployments.map((deployment) => deployment.version_id),
  );
  const assets = new Map(
    (await context.repositories.modelAssets.listAssets(workspaceId)).map((asset) => [
      asset.id,
      asset,
    ]),
  );

  return {
    deployments: deployments.map((deployment) => {
      const version = versions.find((item) => item.id === deployment.version_id);

      return {
        ...toModelDeployment(deployment),
        displayName: (version && assets.get(version.asset_id)?.display_name) ?? deployment.name,
      };
    }),
  };
}

export async function getDeploymentDetail(
  context: ServiceContext,
  workspaceId: string,
  deploymentId: string,
): Promise<DeploymentDetail> {
  await requireModelAction(context, workspaceId, "view");

  const repositories = context.repositories;
  const deployment = await requireDeployment(context, workspaceId, deploymentId);
  const route = deployment.route_id
    ? await repositories.modelRoutes.getRoute(workspaceId, deployment.route_id)
    : null;
  const version = await repositories.modelAssets.getVersion(workspaceId, deployment.version_id);
  const asset = version
    ? await repositories.modelAssets.getAsset(workspaceId, version.asset_id)
    : null;
  const since = new Date(Date.now() - HEALTH_WINDOW_DAYS * 86_400_000).toISOString();
  const [usage, aliases, spendUsd] = await Promise.all([
    route
      ? repositories.usageEvents.summariseModelUsage({
          workspaceId,
          vendor: route.provider,
          resources: [route.provider_model_id],
          since,
        })
      : null,
    route ? repositories.modelAliases.listByRoutes([route.id]) : [],
    repositories.modelSpend.sumSubjectCost("deployment", deployment.id),
  ]);

  return {
    deployment: toModelDeployment(deployment),
    route: route ? toModelRoute(route) : null,
    aliases: aliases.map(toModelAlias),
    displayName: asset?.display_name ?? deployment.name,
    health: {
      requests: usage?.requests ?? 0,
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
      costUsd: (usage?.cost_micros ?? 0) / 1_000_000,
    },
    spendUsd: Math.round(spendUsd * 100) / 100,
  };
}

export async function scaleDeployment(
  context: ServiceContext,
  workspaceId: string,
  deploymentId: string,
  scaling: ScaleDeploymentRequest,
  approvedSpend = false,
): Promise<ModelDeployment> {
  const { userId } = await requireModelAction(context, workspaceId, "deploy");
  const deployment = await requireDeployment(context, workspaceId, deploymentId);

  if (deployment.status === "deleted" || deployment.desired_state === "deleted") {
    throw conflict("A deleted deployment cannot be scaled");
  }

  if (scaling.minReplicas > scaling.maxReplicas) {
    throw badRequest("The minimum cannot exceed the maximum");
  }

  if (
    scaling.minReplicas === 0 &&
    deployment.spec.shape === "dedicated" &&
    !hostManifest(deployment.provider, deployment.host).scaleToZero
  ) {
    throw badRequest("This host requires at least one replica");
  }

  const spendRequestId = await authoriseDeploymentSpend(
    context,
    deployment,
    {
      action: "scale",
      deploymentId,
      specHash: deployment.spec_hash,
      scaling,
    },
    approvedSpend,
  );

  if (spendRequestId) {
    return { ...toModelDeployment(deployment), spendRequestId };
  }

  await accrueDeploymentCost(context.repositories, deployment, isDeploymentBillable(deployment));

  const spec = { ...deployment.spec, scaling: { ...deployment.spec.scaling, ...scaling } };
  const updated =
    deployment.desired_state === "running"
      ? await runHostAction(context.repositories, { ...deployment, spec }, (host, hosted) =>
          host.scale(hosted, scaling),
        )
      : deployment;

  await context.repositories.modelDeployments.update(deployment.id, {
    spec,
    spec_hash: await sha256Hex(canonicalJson(spec)),
  });
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_deployment.scaled",
    targetType: "model_deployment",
    targetId: deployment.id,
    metadata: { ...scaling },
  });

  return toModelDeployment({ ...updated, spec });
}

export type DeploymentStateAction = "pause" | "resume" | "delete";

const STATE_AUDIT_ACTIONS: Record<DeploymentStateAction, string> = {
  pause: "model_deployment.paused",
  resume: "model_deployment.resumed",
  delete: "model_deployment.deleted",
};

export async function applyDeploymentState(
  env: IEnv,
  repositories: RepositoryManager,
  deployment: ModelDeploymentRecord,
  action: DeploymentStateAction,
  actor: { userId: number | null; reason: string | null },
): Promise<ModelDeploymentRecord> {
  if (
    action === "pause" &&
    hostManifest(deployment.provider, deployment.host).pauseSupported === false
  ) {
    throw conflict(
      "This provider cannot pause deployments. Delete the deployment to stop its compute costs.",
    );
  }

  await accrueDeploymentCost(repositories, deployment, isDeploymentBillable(deployment));

  const desired = action === "delete" ? "deleted" : action === "pause" ? "paused" : "running";
  let updated: ModelDeploymentRecord = { ...deployment, desired_state: desired };

  if (action === "delete") {
    updated = { ...updated, status: "deleting" };
    await repositories.modelDeployments.update(deployment.id, {
      desired_state: desired,
      status: "deleting",
    });
    await enqueueDeploymentSync(env, repositories, deployment.id);
  } else if (deployment.provider_ref) {
    updated = await runHostAction(repositories, updated, (host, hosted) =>
      action === "pause" ? host.pause(hosted) : host.resume(hosted),
    );
    await repositories.modelDeployments.update(deployment.id, { desired_state: desired });
    await enqueueDeploymentSync(env, repositories, deployment.id, 30);
  } else if (deployment.provisioning_started_at) {
    if (action === "resume" && deployment.status === "failed") {
      throw conflict(
        "Provisioning has an unknown provider outcome. Reconcile the existing resource before resuming.",
      );
    }

    await repositories.modelDeployments.update(deployment.id, { desired_state: desired });
    await enqueueDeploymentSync(env, repositories, deployment.id);
  } else {
    updated = {
      ...updated,
      status: action === "pause" ? "paused" : "pending",
      failure_reason: null,
    };
    await repositories.modelDeployments.update(deployment.id, {
      desired_state: desired,
      status: updated.status,
      failure_reason: null,
    });

    if (action === "resume") {
      await enqueueDeploymentSync(env, repositories, deployment.id);
    }
  }

  await repositories.audit.createRecord({
    workspaceId: deployment.workspace_id,
    actorUserId: actor.userId,
    action: STATE_AUDIT_ACTIONS[action],
    targetType: "model_deployment",
    targetId: deployment.id,
    ...(actor.reason ? { metadata: { reason: actor.reason } } : {}),
  });

  return updated;
}

export async function changeDeploymentState(
  context: ServiceContext,
  workspaceId: string,
  deploymentId: string,
  action: DeploymentStateAction,
  approvedSpend = false,
): Promise<ModelDeployment> {
  const { userId } = await requireModelAction(context, workspaceId, "deploy");
  const deployment = await requireDeployment(context, workspaceId, deploymentId);

  if (action === "resume") {
    if (deployment.status === "deleted" || deployment.desired_state === "deleted") {
      throw conflict("A deleted deployment cannot be resumed");
    }

    for (const versionId of new Set([
      deployment.spec.versionId,
      ...deployment.spec.adapterVersionIds,
    ])) {
      await requireUsableVersion(
        context.repositories,
        workspaceId,
        deployment.project_id,
        versionId,
        "Deployment input",
      );
    }

    const spendRequestId = await authoriseDeploymentSpend(
      context,
      deployment,
      {
        action: "resume",
        deploymentId,
        specHash: deployment.spec_hash,
      },
      approvedSpend,
    );

    if (spendRequestId) {
      return { ...toModelDeployment(deployment), spendRequestId };
    }
  }

  return toModelDeployment(
    await applyDeploymentState(context.env, context.repositories, deployment, action, {
      userId,
      reason: null,
    }),
  );
}

export async function runPlayground(
  context: ServiceContext,
  workspaceId: string,
  deploymentId: string,
  input: PlaygroundRequest,
): Promise<PlaygroundResponse> {
  await requireModelAction(context, workspaceId, "deploy");

  const request = playgroundRequestSchema.parse(input);
  const deployment = await requireDeployment(context, workspaceId, deploymentId);
  const started = Date.now();
  const result = await invokeDeployment(context.repositories, deployment, {
    messages: request.messages,
    maxTokens: request.maxTokens,
    temperature: request.temperature,
  });

  return {
    output: result.text,
    latencyMs: Date.now() - started,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

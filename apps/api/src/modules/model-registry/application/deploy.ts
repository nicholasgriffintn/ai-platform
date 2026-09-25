import { resolveProviderRegion } from "@ngriffin_uk/polychat-library-model-registry";
import {
  getTrainingDeploymentChatModelId,
  type DeployVersionRequest,
  type ModelRoute,
} from "@ngriffin_uk/polychat-schemas";
import { isGitCommitSha, isRecord, slugify } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { deployTrainingWorkerModel } from "~/modules/training/infrastructure/trainingWorkerClient";

import { requireRegistryMember, requireWorkspaceProject } from "./access";
import { requireTrainingCredentials } from "./credentials";
import { HUGGINGFACE_ENDPOINT_ROUTE_PROVIDER } from "./endpoints";
import { enqueueEvalRun } from "./evals";
import { toModelRoute } from "./mappers";
import { requireUsableVersion } from "./scope";

function readCloudRegion(providerResponse: unknown): string | null {
  if (!isRecord(providerResponse) || !isRecord(providerResponse.provider)) {
    return null;
  }

  return typeof providerResponse.provider.region === "string"
    ? providerResponse.provider.region
    : null;
}

export async function deployVersion(
  context: ServiceContext,
  workspaceId: string,
  versionId: string,
  request: DeployVersionRequest,
): Promise<ModelRoute> {
  const { userId } = await requireRegistryMember(context, workspaceId);
  const projectId = await requireWorkspaceProject(context, workspaceId, request.projectId);
  const repositories = context.repositories;
  const credentials = await requireTrainingCredentials(context.env, repositories, workspaceId);
  const version = await requireUsableVersion(
    repositories,
    workspaceId,
    projectId,
    versionId,
    "Model",
  );
  const asset = await repositories.modelAssets.getAsset(workspaceId, version.asset_id);

  if (!asset || asset.kind !== "model" || !isGitCommitSha(version.revision)) {
    throw new AssistantError(
      "Only model versions pinned to a Hub commit can be deployed",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const deploymentName = slugify(`${asset.display_name}-${version.revision.slice(0, 7)}`, 32);
  const deployment = await deployTrainingWorkerModel(
    context.env,
    {
      provider: "huggingface",
      modelId: version.id,
      deploymentTarget: "huggingface-endpoint",
      deploymentName,
      instanceType: request.instanceType,
      model: {
        id: version.id,
        provider: "huggingface",
        family: "huggingface",
        name: asset.display_name,
        baseModel: asset.source_ref,
        baseModelRevision: version.revision,
        registryVersionId: version.id,
        defaultHyperparameters: {},
        inferenceRuntime: "huggingface-endpoint",
      },
      requestId: context.requestId,
    },
    userId,
    credentials,
  );

  if (deployment.status === "Failed") {
    throw new AssistantError(
      `The endpoint could not be created: ${deployment.failureReason ?? "unknown error"}`,
      ErrorType.PROVIDER_ERROR,
      502,
    );
  }

  const route = await repositories.modelRoutes.createRoute({
    workspaceId,
    versionId: version.id,
    provider: HUGGINGFACE_ENDPOINT_ROUTE_PROVIDER,
    providerModelId: getTrainingDeploymentChatModelId({
      provider: "huggingface",
      endpointName: deployment.endpointName,
    }),
    region: resolveProviderRegion(
      HUGGINGFACE_ENDPOINT_ROUTE_PROVIDER,
      readCloudRegion(deployment.providerResponse),
    ),
    weightsVerified: true,
    deploymentRef: deployment.endpointName,
    createdBy: userId,
  });

  await repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_route.deployed",
    targetType: "model_route",
    targetId: route.id,
    metadata: {
      versionId: version.id,
      endpointName: deployment.endpointName,
      revision: version.revision,
      projectId,
    },
  });

  for (const suite of await repositories.modelEvals.listSuites(
    workspaceId,
    projectId ?? undefined,
  )) {
    await enqueueEvalRun(context.env, repositories, {
      suite,
      route,
      trigger: "build",
      createdBy: userId,
    });
  }

  return toModelRoute(route);
}

import type { ModelHandle, WeightsLocation } from "@ngriffin_uk/polychat-ai-model-providers";
import type { WeightsPlacement } from "@ngriffin_uk/polychat-library-model-registry";
import { MODEL_PROVIDER_IDS, type ModelProviderId } from "@ngriffin_uk/polychat-schemas";
import { isGitCommitSha } from "@ngriffin_uk/polychat-utility-core";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";

import type { ModelAssetRecord, ModelVersionRecord } from "../infrastructure/ModelAssetRepository";
import { conflict, notFound } from "./access";

const HUB_LOCATION = /^hub:([A-Za-z0-9][\w.-]*\/[\w.-]+)@([0-9a-f]{40})$/;
const PROVIDER_LOCATION = /^provider:([a-z0-9-]+):(.+)$/;

export function hubLocation(repo: string, revision: string): string {
  return `hub:${repo}@${revision}`;
}

export function providerLocation(provider: ModelProviderId, ref: string): string {
  return `provider:${provider}:${ref}`;
}

function isProviderId(value: string): value is ModelProviderId {
  return MODEL_PROVIDER_IDS.some((provider) => provider === value);
}

export function weightsLocation(
  asset: Pick<ModelAssetRecord, "source" | "source_ref">,
  version: Pick<ModelVersionRecord, "revision" | "attributes">,
): WeightsLocation | null {
  const location = version.attributes.location;

  if (location) {
    const hub = HUB_LOCATION.exec(location);

    if (hub) {
      return { kind: "hub", repo: hub[1], revision: hub[2] };
    }

    const provider = PROVIDER_LOCATION.exec(location);

    if (provider && isProviderId(provider[1])) {
      return { kind: "provider", provider: provider[1], ref: provider[2] };
    }

    if (location.startsWith("s3://")) {
      return { kind: "url", url: location };
    }

    return null;
  }

  if (
    (asset.source === "huggingface" || asset.source === "derived") &&
    isGitCommitSha(version.revision)
  ) {
    return { kind: "hub", repo: asset.source_ref, revision: version.revision };
  }

  return null;
}

export function weightsPlacement(location: WeightsLocation | null): WeightsPlacement {
  if (!location || location.kind === "url") {
    return { kind: "url" };
  }

  return location.kind === "hub"
    ? { kind: "hub", repo: location.repo }
    : { kind: "provider", provider: location.provider };
}

async function adapterBase(
  repositories: RepositoryManager,
  workspaceId: string,
  versionId: string,
): Promise<string | null> {
  const edges = await repositories.modelAssets.listLineage(workspaceId);

  return (
    edges.find((edge) => edge.toVersionId === versionId && edge.relation === "adapter_of")
      ?.fromVersionId ?? null
  );
}

export async function buildModelHandle(
  repositories: RepositoryManager,
  workspaceId: string,
  versionId: string,
  depth = 0,
): Promise<ModelHandle> {
  const version = await repositories.modelAssets.getVersion(workspaceId, versionId);
  const asset = version
    ? await repositories.modelAssets.getAsset(workspaceId, version.asset_id)
    : null;

  if (!version || !asset) {
    throw notFound("Model version");
  }

  if (asset.kind === "dataset") {
    throw conflict(`${asset.display_name} is a dataset, not a model`);
  }

  const weights = weightsLocation(asset, version);

  if (!weights) {
    throw conflict(`${asset.display_name} has no weights a provider can read yet`);
  }

  const baseId =
    asset.kind === "adapter" && depth === 0
      ? await adapterBase(repositories, workspaceId, versionId)
      : null;

  return {
    versionId,
    name: asset.display_name,
    kind: asset.kind,
    weights,
    architecture: version.attributes.architecture,
    parameterCount: version.attributes.parameterCount,
    remoteCode: version.attributes.remoteCode,
    base: baseId ? await buildModelHandle(repositories, workspaceId, baseId, depth + 1) : null,
  };
}

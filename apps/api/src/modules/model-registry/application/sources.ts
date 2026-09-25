import type { HubSearchItem } from "@ngriffin_uk/polychat-ai-model-sources";
import {
  evaluatePolicies,
  isPermissiveLicence,
  normaliseLicence,
} from "@ngriffin_uk/polychat-library-model-registry";
import type {
  EvidenceStatus,
  ModelDecisionState,
  SourceSearchQuery,
  SourceSearchResult,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { requireRegistryMember, requireWorkspaceProject } from "./access";
import { workspaceHubClient } from "./hub";
import { withHubErrors } from "./hub-errors";
import { loadPolicyStack } from "./policies";

const DECISION_STATE_PRIORITY: ModelDecisionState[] = [
  "approved",
  "pending",
  "rejected",
  "revoked",
  "expired",
];

function describeSignals(item: HubSearchItem, licence: string | null) {
  const signals: Array<{ label: string; status: EvidenceStatus }> = [
    {
      label: licence ?? "licence unknown",
      status: licence === null ? "unknown" : isPermissiveLicence(licence) ? "pass" : "warn",
    },
  ];

  if (item.gated) {
    signals.push({ label: "gated", status: "warn" });
  }

  if (item.tags.includes("safetensors")) {
    signals.push({ label: "safetensors", status: "pass" });
  } else if (item.tags.includes("gguf")) {
    signals.push({ label: "gguf", status: "pass" });
  } else if (item.tags.includes("pytorch")) {
    signals.push({ label: "pytorch pickle", status: "warn" });
  }

  return signals;
}

export async function searchSources(
  context: ServiceContext,
  workspaceId: string,
  query: SourceSearchQuery,
): Promise<{ results: SourceSearchResult[] }> {
  await requireRegistryMember(context, workspaceId);

  const projectId = await requireWorkspaceProject(context, workspaceId, query.projectId);
  const repositories = context.repositories;
  const [items, stack, assets, versions, decisions] = await Promise.all([
    withHubErrors(async () =>
      (await workspaceHubClient(context.env, repositories, workspaceId)).search({
        kind: query.kind,
        query: query.q,
        limit: query.limit,
      }),
    ),
    loadPolicyStack(repositories, workspaceId, projectId),
    repositories.modelAssets.listAssets(workspaceId, query.kind),
    repositories.modelAssets.listVersions(workspaceId),
    repositories.modelGovernance.listDecisions(workspaceId, projectId ? { projectId } : {}),
  ]);
  const assetsByRef = new Map(assets.map((asset) => [asset.source_ref.toLowerCase(), asset]));

  return {
    results: items.map((item) => {
      const licence = normaliseLicence(item.licence);
      const asset = assetsByRef.get(item.id.toLowerCase());
      const latestVersion = asset
        ? versions.find((version) => version.asset_id === asset.id)
        : undefined;
      const states = new Set(
        decisions
          .filter((decision) => decision.version_id === latestVersion?.id)
          .map((decision) => decision.state),
      );

      return {
        source: "huggingface",
        sourceRef: item.id,
        kind: item.kind,
        displayName: item.id.split("/").pop() ?? item.id,
        licence,
        pipelineTag: item.pipelineTag,
        gated: item.gated,
        downloads: item.downloads,
        likes: item.likes,
        updatedAt: item.lastModified,
        signals: describeSignals(item, licence),
        preview: evaluatePolicies(
          {
            kind: item.kind,
            source: "huggingface",
            attributes: {
              licence,
              formats: [],
              parameterCount: null,
              gated: item.gated,
              remoteCode: false,
              pipelineTag: item.pipelineTag,
              libraryName: null,
              tags: item.tags,
              baseModels: [],
              totalBytes: 0,
              trainingComputeFlops: null,
            },
            evidence: [],
          },
          stack.scoped,
          { metadataOnly: true },
        ),
        library: asset
          ? {
              assetId: asset.id,
              latestVersionId: latestVersion?.id ?? null,
              state: DECISION_STATE_PRIORITY.find((state) => states.has(state)) ?? null,
            }
          : null,
      };
    }),
  };
}

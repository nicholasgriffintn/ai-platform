import type {
  CreateDeploymentRequest,
  DeploymentOption,
  DeploymentPlanRequest,
  Quantisation,
} from "@ngriffin_uk/polychat-schemas";

export interface DeploymentDraft {
  versionId: string;
  adapterVersionIds: string[];
  quantisation: Quantisation;
  contextLength: number;
  concurrency: number;
  name: string;
  aliasName: string;
  minReplicas: number;
  maxReplicas: number;
  externalBaseUrl: string;
  externalModelId: string;
  optionKey: string | null;
}

export const EMPTY_DEPLOYMENT_DRAFT: DeploymentDraft = {
  versionId: "",
  adapterVersionIds: [],
  quantisation: "none",
  contextLength: 8192,
  concurrency: 8,
  name: "",
  aliasName: "",
  minReplicas: 0,
  maxReplicas: 1,
  externalBaseUrl: "",
  externalModelId: "",
  optionKey: null,
};

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{2,47}$/;

export function deploymentPlanRequest(
  draft: DeploymentDraft,
  projectId: string | null,
): DeploymentPlanRequest | null {
  return draft.versionId
    ? {
        projectId,
        versionId: draft.versionId,
        adapterVersionIds: draft.adapterVersionIds,
        quantisation: draft.quantisation,
        contextLength: draft.contextLength,
        concurrency: draft.concurrency,
      }
    : null;
}

export function deploymentDraftProblem(
  draft: DeploymentDraft,
  option: DeploymentOption | undefined,
): string | null {
  if (!option) {
    return "Pick a host";
  }

  if (!NAME_PATTERN.test(draft.name)) {
    return "Name it with lowercase letters, digits and dashes";
  }

  if (draft.aliasName && !NAME_PATTERN.test(draft.aliasName)) {
    return "The alias uses the same naming rules";
  }

  if (
    option.shape === "external" &&
    (!draft.externalBaseUrl.startsWith("https://") || !draft.externalModelId)
  ) {
    return "External endpoints need an https base URL and a model id";
  }

  return draft.minReplicas > draft.maxReplicas ? "The minimum cannot exceed the maximum" : null;
}

export function createDeploymentRequest(
  draft: DeploymentDraft,
  option: DeploymentOption,
  projectId: string | null,
): CreateDeploymentRequest {
  return {
    projectId,
    name: draft.name,
    ...(draft.aliasName ? { aliasName: draft.aliasName } : {}),
    spec: {
      versionId: draft.versionId,
      adapterVersionIds: draft.adapterVersionIds,
      shape: option.shape,
      target: {
        provider: option.provider,
        target: option.host,
        hardware: option.hardware?.id ?? null,
        region: option.region?.id ?? null,
      },
      engine: option.engines[0] ?? "provider",
      quantisation: option.quantisations.includes(draft.quantisation) ? draft.quantisation : "none",
      scaling: {
        minReplicas: option.scaleToZero ? draft.minReplicas : Math.max(1, draft.minReplicas),
        maxReplicas: draft.maxReplicas,
        scaleToZeroAfterMinutes: option.scaleToZero && draft.minReplicas === 0 ? 30 : null,
      },
      contextLength: draft.contextLength,
      maxConcurrency: draft.concurrency,
      external:
        option.shape === "external"
          ? { baseUrl: draft.externalBaseUrl, modelId: draft.externalModelId }
          : null,
    },
  };
}

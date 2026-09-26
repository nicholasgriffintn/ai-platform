import type { DeploymentStatus } from "@ngriffin_uk/polychat-schemas";
import {
  readArray,
  readFiniteNumber,
  readNonEmptyString,
  readRecord,
} from "@ngriffin_uk/polychat-utility-core";

import { misconfigured, unsupported } from "../errors.js";
import { bearer, JsonHttpClient } from "../http.js";
import { invokeOpenAiCompatible } from "../openai-compatible.js";
import { hubWeights } from "../training/payload.js";
import type {
  ChatInvocation,
  ChatInvocationResult,
  Host,
  HostDeploymentInput,
  HostDeploymentState,
  HostedDeployment,
  ProviderAdapterContext,
} from "../types.js";
import { readHubAccess } from "./jobs.js";
import { HF_ENDPOINT_INSTANCES, HF_ENDPOINT_REGIONS, HF_ENDPOINTS_HOST } from "./manifest.js";

export const HUGGINGFACE_ENDPOINTS_API = "https://api.endpoints.huggingface.cloud/v2/endpoint";

const ENGINE_IMAGES: Record<string, Record<string, unknown>> = {
  vllm: { vllm: { url: "vllm/vllm-openai:v0.11.0" } },
  sglang: {
    custom: { url: "lmsysorg/sglang:v0.5.3-cu126", health_route: "/health", port: 30000 },
  },
};

const STATES: Record<string, DeploymentStatus> = {
  pending: "provisioning",
  initializing: "provisioning",
  updating: "updating",
  updateFailed: "failed",
  running: "running",
  paused: "paused",
  failed: "failed",
  scaledToZero: "scaled_to_zero",
};

const ACCESS_TYPES: Record<string, string> = {
  private: "protected",
  authenticated: "authenticated",
  public: "public",
};

const QUANTISATION_ENV: Record<string, string> = {
  fp8: "fp8",
  awq: "awq",
  gptq: "gptq",
};

function parseLocation(region: string | null): { vendor: string; region: string } {
  const [vendor, name] = (region ?? HF_ENDPOINT_REGIONS[0].id).split(":");

  if (!vendor || !name) {
    throw misconfigured(`Unknown endpoint location ${region}`);
  }

  return { vendor, region: name };
}

function parseInstance(hardware: string | null): { type: string; size: string } {
  const [type, size] = (hardware ?? "nvidia-l4:x1").split(":");

  return { type, size: size ?? "x1" };
}

export class HuggingFaceEndpointsHost implements Host {
  readonly manifest = HF_ENDPOINTS_HOST;
  private readonly http: JsonHttpClient;
  private readonly token: string;
  private readonly namespace: string;

  constructor(private readonly context: ProviderAdapterContext) {
    const access = readHubAccess(context);

    this.token = access.token;
    this.namespace = access.namespace;
    this.http = new JsonHttpClient(
      HUGGINGFACE_ENDPOINTS_API,
      () => bearer(access.token),
      context.fetcher,
    );
  }

  private path(name = ""): string {
    return `/${encodeURIComponent(this.namespace)}${name ? `/${encodeURIComponent(name)}` : ""}`;
  }

  private toState(body: unknown, hardware: string | null): HostDeploymentState {
    const record = readRecord(body);
    const status = readRecord(record.status);
    const provider = readRecord(record.provider);
    const state = readNonEmptyString(status.state) ?? "pending";

    return {
      status: STATES[state] ?? "provisioning",
      providerRef: readNonEmptyString(record.name) ?? "unknown",
      region:
        readNonEmptyString(provider.vendor) && readNonEmptyString(provider.region)
          ? `${String(provider.vendor)}:${String(provider.region)}`
          : null,
      readyReplicas: readFiniteNumber(status.readyReplica) ?? null,
      hourlyUsd: HF_ENDPOINT_INSTANCES.find((item) => item.id === hardware)?.hourlyUsd ?? null,
      failureReason: readNonEmptyString(status.errorMessage) ?? null,
    };
  }

  async create(input: HostDeploymentInput): Promise<HostDeploymentState> {
    if (input.adapters.length > 0) {
      throw unsupported("Inference Endpoints serve one model; merge adapters before deploying");
    }

    const weights = hubWeights(input.model);
    const location = parseLocation(input.spec.target.region);
    const instance = parseInstance(input.spec.target.hardware);
    const env: Record<string, string> = {};

    if (input.spec.contextLength) {
      env.MAX_MODEL_LEN = String(input.spec.contextLength);
    }

    if (QUANTISATION_ENV[input.spec.quantisation]) {
      env.QUANTIZATION = QUANTISATION_ENV[input.spec.quantisation];
    }

    const scaling = input.spec.scaling;
    const body = await this.http.json(this.path(), {
      method: "POST",
      body: {
        name: input.name,
        type: ACCESS_TYPES[input.spec.access],
        provider: location,
        compute: {
          accelerator: "gpu",
          instanceType: instance.type,
          instanceSize: instance.size,
          scaling: {
            minReplica: scaling.minReplicas,
            maxReplica: Math.max(1, scaling.maxReplicas),
            ...(scaling.scaleToZeroAfterMinutes && scaling.minReplicas === 0
              ? { scaleToZeroTimeout: scaling.scaleToZeroAfterMinutes }
              : {}),
          },
        },
        model: {
          repository: weights.repo,
          revision: weights.revision,
          framework: "pytorch",
          task: "text-generation",
          image: ENGINE_IMAGES[input.spec.engine] ?? ENGINE_IMAGES.vllm,
          env,
          secrets: { HF_TOKEN: this.token },
        },
        tags: [`polychat-deployment-${input.deploymentId}`],
      },
      context: `Creating Inference Endpoint ${input.name}`,
    });

    return this.toState(body, input.spec.target.hardware);
  }

  async status(deployment: HostedDeployment): Promise<HostDeploymentState> {
    const body = await this.http.json(this.path(deployment.providerRef), {
      context: `Reading Inference Endpoint ${deployment.providerRef}`,
      allowNotFound: true,
    });

    if (body === null) {
      return {
        status: "deleted",
        providerRef: deployment.providerRef,
        region: null,
        readyReplicas: 0,
        hourlyUsd: 0,
        failureReason: null,
      };
    }

    return this.toState(body, deployment.spec.target.hardware);
  }

  async scale(
    deployment: HostedDeployment,
    scaling: { minReplicas: number; maxReplicas: number },
  ): Promise<HostDeploymentState> {
    const body = await this.http.json(this.path(deployment.providerRef), {
      method: "PUT",
      body: {
        compute: { scaling: { minReplica: scaling.minReplicas, maxReplica: scaling.maxReplicas } },
      },
      context: `Scaling Inference Endpoint ${deployment.providerRef}`,
    });

    return this.toState(body, deployment.spec.target.hardware);
  }

  async pause(deployment: HostedDeployment): Promise<HostDeploymentState> {
    const body = await this.http.json(`${this.path(deployment.providerRef)}/pause`, {
      method: "POST",
      body: {},
      context: `Pausing Inference Endpoint ${deployment.providerRef}`,
    });

    return this.toState(body, deployment.spec.target.hardware);
  }

  async resume(deployment: HostedDeployment): Promise<HostDeploymentState> {
    const body = await this.http.json(`${this.path(deployment.providerRef)}/resume`, {
      method: "POST",
      body: {},
      context: `Resuming Inference Endpoint ${deployment.providerRef}`,
    });

    return this.toState(body, deployment.spec.target.hardware);
  }

  async delete(deployment: HostedDeployment): Promise<void> {
    await this.http.json(this.path(deployment.providerRef), {
      method: "DELETE",
      context: `Deleting Inference Endpoint ${deployment.providerRef}`,
      allowNotFound: true,
    });
  }

  async invoke(
    deployment: HostedDeployment,
    request: ChatInvocation,
  ): Promise<ChatInvocationResult> {
    const body = readRecord(
      await this.http.json(this.path(deployment.providerRef), {
        context: `Reading Inference Endpoint ${deployment.providerRef}`,
      }),
    );
    const url = readNonEmptyString(readRecord(body.status).url);

    if (!url) {
      throw unsupported(`Inference Endpoint ${deployment.providerRef} is not ready`);
    }

    return invokeOpenAiCompatible({
      baseUrl: `${url.replace(/\/$/, "")}/v1`,
      headers: bearer(this.token),
      model: null,
      request,
      fetcher: this.context.fetcher,
      context: `Calling Inference Endpoint ${deployment.providerRef}`,
    });
  }

  async list(): Promise<string[]> {
    const body = readRecord(
      await this.http.json(this.path(), { context: "Listing Inference Endpoints" }),
    );

    return readArray(body.items).flatMap((item) => {
      const record = readRecord(item);
      const tags = readArray(record.tags);

      return tags.some((tag) => typeof tag === "string" && tag.startsWith("polychat-deployment-"))
        ? [String(record.name)]
        : [];
    });
  }
}

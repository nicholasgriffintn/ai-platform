import type {
  ConnectionCheck,
  DeploymentStatus,
  HardwareOption,
  HostManifest,
  ProviderManifest,
  RegionOption,
} from "@ngriffin_uk/polychat-schemas";
import {
  readArray,
  readFiniteNumber,
  readNonEmptyString,
  readRecord,
  slugify,
} from "@ngriffin_uk/polychat-utility-core";

import { misconfigured, unsupported } from "../errors.js";
import { bearer, JsonHttpClient } from "../http.js";
import { invokeOpenAiCompatible } from "../openai-compatible.js";
import { hubWeights } from "../training/payload.js";
import type {
  ChatInvocation,
  ChatInvocationResult,
  ConnectionChecker,
  Host,
  HostDeploymentInput,
  HostDeploymentState,
  HostedDeployment,
  ProviderAdapterContext,
} from "../types.js";

export const RUNPOD_REST_API = "https://rest.runpod.io/v1";
export const RUNPOD_RUNTIME_API = "https://api.runpod.ai/v2";
const VLLM_WORKER_IMAGE = "runpod/worker-v1-vllm:v2.7.0stable-cuda12.1.0";

export const RUNPOD_GPUS: HardwareOption[] = [
  {
    id: "NVIDIA GeForce RTX 4090",
    label: "RTX 4090 (24 GB)",
    accelerator: "nvidia-rtx-4090",
    count: 1,
    memoryGb: 24,
    hourlyUsd: 1.1,
  },
  {
    id: "NVIDIA L40S",
    label: "L40S (48 GB)",
    accelerator: "nvidia-l40s",
    count: 1,
    memoryGb: 48,
    hourlyUsd: 1.9,
  },
  {
    id: "NVIDIA A100 80GB PCIe",
    label: "A100 (80 GB)",
    accelerator: "nvidia-a100",
    count: 1,
    memoryGb: 80,
    hourlyUsd: 2.72,
  },
  {
    id: "NVIDIA H100 80GB HBM3",
    label: "H100 (80 GB)",
    accelerator: "nvidia-h100",
    count: 1,
    memoryGb: 80,
    hourlyUsd: 4.55,
  },
  {
    id: "NVIDIA H200",
    label: "H200 (141 GB)",
    accelerator: "nvidia-h200",
    count: 1,
    memoryGb: 141,
    hourlyUsd: 5.58,
  },
  {
    id: "NVIDIA B200",
    label: "B200 (180 GB)",
    accelerator: "nvidia-b200",
    count: 1,
    memoryGb: 180,
    hourlyUsd: 8.64,
  },
];

export const RUNPOD_REGIONS: RegionOption[] = [
  { id: "EU-RO-1", label: "Romania", jurisdiction: "eu" },
  { id: "EU-SE-1", label: "Sweden", jurisdiction: "eu" },
  { id: "EU-NL-1", label: "Netherlands", jurisdiction: "eu" },
  { id: "US-IL-1", label: "Illinois", jurisdiction: "us" },
  { id: "US-TX-3", label: "Texas", jurisdiction: "us" },
  { id: "CA-MTL-1", label: "Montreal", jurisdiction: "ca" },
];

export const RUNPOD_HOST: HostManifest = {
  id: "runpod-serverless",
  name: "RunPod serverless",
  description:
    "Per-second serverless vLLM workers that scale to zero, loading your pinned Hub commit and optional LoRA adapters.",
  shapes: ["dedicated", "adapter_pool"],
  weights: "hub",
  adapters: true,
  scaleToZero: true,
  weightsVerified: true,
  retention: "self",
  engines: ["vllm"],
  quantisations: ["none", "awq", "gptq", "fp8"],
  hardware: RUNPOD_GPUS,
  regions: RUNPOD_REGIONS,
  architectures: ["*"],
  maxParameters: null,
  pricing: { unit: "gpu_hour", usd: null, note: "Per second while a worker is awake" },
};

export const RUNPOD_MANIFEST: ProviderManifest = {
  id: "runpod",
  name: "RunPod",
  vendor: "RunPod",
  description: "Serverless GPU workers that bill by the second and sleep when idle.",
  docsUrl: "https://docs.runpod.io/serverless/overview",
  connection: { fields: [{ key: "apiKey", label: "API key", kind: "secret", required: true }] },
  source: false,
  store: null,
  trainers: [],
  hosts: [RUNPOD_HOST],
};

function runpod(context: ProviderAdapterContext): {
  rest: JsonHttpClient;
  runtime: JsonHttpClient;
  apiKey: string;
} {
  const apiKey = context.credentials.secrets.apiKey;

  if (!apiKey) {
    throw misconfigured("The RunPod connection needs an API key");
  }

  return {
    rest: new JsonHttpClient(RUNPOD_REST_API, () => bearer(apiKey), context.fetcher),
    runtime: new JsonHttpClient(RUNPOD_RUNTIME_API, () => bearer(apiKey), context.fetcher),
    apiKey,
  };
}

export function loraModuleName(versionId: string): string {
  return `adapter-${versionId.slice(0, 12).toLowerCase()}`;
}

export class RunPodHost implements Host {
  readonly manifest = RUNPOD_HOST;
  private readonly rest: JsonHttpClient;
  private readonly runtime: JsonHttpClient;
  private readonly apiKey: string;

  constructor(private readonly context: ProviderAdapterContext) {
    const clients = runpod(context);

    this.rest = clients.rest;
    this.runtime = clients.runtime;
    this.apiKey = clients.apiKey;
  }

  async create(input: HostDeploymentInput): Promise<HostDeploymentState> {
    const weights = hubWeights(input.model);
    const env: Record<string, string> = {
      MODEL_NAME: weights.repo,
      MODEL_REVISION: weights.revision,
      OPENAI_SERVED_MODEL_NAME_OVERRIDE: weights.repo,
      MAX_NUM_SEQS: String(input.spec.maxConcurrency),
      ...(this.context.hub ? { HF_TOKEN: this.context.hub.token } : {}),
      ...(input.spec.contextLength ? { MAX_MODEL_LEN: String(input.spec.contextLength) } : {}),
      ...(input.spec.quantisation !== "none" ? { QUANTIZATION: input.spec.quantisation } : {}),
    };

    if (input.adapters.length > 0) {
      env.ENABLE_LORA = "true";
      env.MAX_LORAS = String(input.adapters.length);
      env.LORA_MODULES = JSON.stringify(
        input.adapters.map((adapter) => ({
          name: loraModuleName(adapter.versionId),
          path: hubWeights(adapter).repo,
          base_model_name: weights.repo,
        })),
      );
    }

    const template = await this.rest.record("/templates", {
      method: "POST",
      body: {
        name: slugify(`polychat-${input.name}-${input.deploymentId}`, 60),
        imageName: VLLM_WORKER_IMAGE,
        isServerless: true,
        containerDiskInGb: 120,
        env,
      },
      context: "Creating a RunPod template",
    });
    const templateId = readNonEmptyString(template.id);

    if (!templateId) {
      throw unsupported("RunPod did not return a template id");
    }

    const endpoint = await this.rest.record("/endpoints", {
      method: "POST",
      body: {
        templateId,
        name: slugify(`polychat-${input.name}`, 60),
        gpuTypeIds: [input.spec.target.hardware ?? RUNPOD_GPUS[2].id],
        workersMin: input.spec.scaling.minReplicas,
        workersMax: Math.max(1, input.spec.scaling.maxReplicas),
        idleTimeout: Math.min(
          3600,
          Math.max(5, (input.spec.scaling.scaleToZeroAfterMinutes ?? 1) * 60),
        ),
        scalerType: "QUEUE_DELAY",
        scalerValue: 4,
        flashboot: true,
        ...(input.spec.target.region ? { dataCenterIds: [input.spec.target.region] } : {}),
      },
      context: "Creating a RunPod endpoint",
    });
    const endpointId = readNonEmptyString(endpoint.id);

    if (!endpointId) {
      throw unsupported("RunPod did not return an endpoint id");
    }

    return this.state(`${endpointId}|${templateId}`, "provisioning", input.spec.target.hardware, 0);
  }

  private state(
    providerRef: string,
    status: DeploymentStatus,
    hardware: string | null,
    replicas: number | null,
  ): HostDeploymentState {
    const rate = RUNPOD_GPUS.find((item) => item.id === hardware)?.hourlyUsd ?? null;

    return {
      status,
      providerRef,
      region: null,
      readyReplicas: replicas,
      hourlyUsd: rate !== null && replicas !== null ? rate * replicas : null,
      failureReason: null,
    };
  }

  private ids(deployment: HostedDeployment): { endpointId: string; templateId: string } {
    const [endpointId, templateId] = deployment.providerRef.split("|");

    return { endpointId, templateId };
  }

  async status(deployment: HostedDeployment): Promise<HostDeploymentState> {
    const { endpointId } = this.ids(deployment);
    const endpoint = await this.rest.json(`/endpoints/${encodeURIComponent(endpointId)}`, {
      context: "Reading a RunPod endpoint",
      allowNotFound: true,
    });

    if (endpoint === null) {
      return this.state(deployment.providerRef, "deleted", deployment.spec.target.hardware, 0);
    }

    if ((readFiniteNumber(readRecord(endpoint).workersMax) ?? 1) === 0) {
      return this.state(deployment.providerRef, "paused", deployment.spec.target.hardware, 0);
    }

    const health = readRecord(
      await this.runtime.json(`/${encodeURIComponent(endpointId)}/health`, {
        context: "Reading RunPod worker health",
      }),
    );
    const workers = readRecord(health.workers);
    const awake = (readFiniteNumber(workers.idle) ?? 0) + (readFiniteNumber(workers.running) ?? 0);
    const starting = readFiniteNumber(workers.initializing) ?? 0;

    return this.state(
      deployment.providerRef,
      awake > 0 ? "running" : starting > 0 ? "provisioning" : "scaled_to_zero",
      deployment.spec.target.hardware,
      awake,
    );
  }

  private async patch(
    deployment: HostedDeployment,
    body: Record<string, unknown>,
  ): Promise<HostDeploymentState> {
    await this.rest.json(`/endpoints/${encodeURIComponent(this.ids(deployment).endpointId)}`, {
      method: "PATCH",
      body,
      context: "Updating a RunPod endpoint",
    });

    return this.status(deployment);
  }

  scale(
    deployment: HostedDeployment,
    scaling: { minReplicas: number; maxReplicas: number },
  ): Promise<HostDeploymentState> {
    return this.patch(deployment, {
      workersMin: scaling.minReplicas,
      workersMax: Math.max(1, scaling.maxReplicas),
    });
  }

  pause(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return this.patch(deployment, { workersMin: 0, workersMax: 0 });
  }

  resume(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return this.patch(deployment, {
      workersMin: deployment.spec.scaling.minReplicas,
      workersMax: Math.max(1, deployment.spec.scaling.maxReplicas),
    });
  }

  async delete(deployment: HostedDeployment): Promise<void> {
    const { endpointId, templateId } = this.ids(deployment);

    await this.rest.json(`/endpoints/${encodeURIComponent(endpointId)}`, {
      method: "DELETE",
      context: "Deleting a RunPod endpoint",
      allowNotFound: true,
    });

    if (templateId) {
      await this.rest.json(`/templates/${encodeURIComponent(templateId)}`, {
        method: "DELETE",
        context: "Deleting a RunPod template",
        allowNotFound: true,
      });
    }
  }

  invoke(deployment: HostedDeployment, request: ChatInvocation): Promise<ChatInvocationResult> {
    const { endpointId } = this.ids(deployment);
    const adapter = deployment.adapters[0];

    return invokeOpenAiCompatible({
      baseUrl: `${RUNPOD_RUNTIME_API}/${encodeURIComponent(endpointId)}/openai/v1`,
      headers: bearer(this.apiKey),
      model: adapter ? loraModuleName(adapter.versionId) : hubWeights(deployment.model).repo,
      request,
      fetcher: this.context.fetcher,
      context: "Calling a RunPod endpoint",
    });
  }

  async list(): Promise<string[]> {
    const body = await this.rest.json("/endpoints", { context: "Listing RunPod endpoints" });

    return readArray(body).flatMap((item) => {
      const record = readRecord(item);
      const id = readNonEmptyString(record.id);

      return id && (readNonEmptyString(record.name) ?? "").startsWith("polychat-")
        ? [`${id}|${readNonEmptyString(record.templateId) ?? ""}`]
        : [];
    });
  }
}

export class RunPodConnectionChecker implements ConnectionChecker {
  constructor(private readonly context: ProviderAdapterContext) {}

  async check(): Promise<ConnectionCheck> {
    await runpod(this.context).rest.json("/endpoints", { context: "Checking the RunPod API key" });

    return {
      account: "RunPod account",
      capabilities: { read: false, store: false, train: false, host: true },
      namespaces: [],
      message: null,
    };
  }
}

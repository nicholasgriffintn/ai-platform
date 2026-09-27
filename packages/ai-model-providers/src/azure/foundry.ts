import type {
  ConnectionCheck,
  DeploymentStatus,
  HardwareOption,
  HostManifest,
  ProviderManifest,
  RegionOption,
} from "@ngriffin_uk/polychat-schemas";
import { readNonEmptyString, readRecord, slugify } from "@ngriffin_uk/polychat-utility-core";

import { type AzureSettings, AzureTokenSource, readAzureSettings } from "../auth/azure.js";
import { unsupported } from "../errors.js";
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

const API_VERSION = "2024-04-01";
const ENVIRONMENT = "polychat-tgi";
const ENVIRONMENT_VERSION = "1";
const DEPLOYMENT = "primary";
const TGI_IMAGE = "ghcr.io/huggingface/text-generation-inference:3.3.4";

export const AZURE_REGIONS: RegionOption[] = [
  { id: "uksouth", label: "UK South", jurisdiction: "uk" },
  { id: "westeurope", label: "West Europe", jurisdiction: "eu" },
  { id: "swedencentral", label: "Sweden Central", jurisdiction: "eu" },
  { id: "eastus", label: "East US", jurisdiction: "us" },
  { id: "eastus2", label: "East US 2", jurisdiction: "us" },
  { id: "westus3", label: "West US 3", jurisdiction: "us" },
];

export const AZURE_INSTANCES: HardwareOption[] = [
  {
    id: "Standard_NC4as_T4_v3",
    label: "NC4as T4 v3 · T4 (16 GB)",
    accelerator: "nvidia-t4",
    count: 1,
    memoryGb: 16,
    hourlyUsd: 0.53,
  },
  {
    id: "Standard_NC24ads_A100_v4",
    label: "NC24ads A100 v4 · A100 (80 GB)",
    accelerator: "nvidia-a100",
    count: 1,
    memoryGb: 80,
    hourlyUsd: 3.67,
  },
  {
    id: "Standard_NC48ads_A100_v4",
    label: "NC48ads A100 v4 · 2× A100 (160 GB)",
    accelerator: "nvidia-a100",
    count: 2,
    memoryGb: 160,
    hourlyUsd: 7.35,
  },
  {
    id: "Standard_NC96ads_A100_v4",
    label: "NC96ads A100 v4 · 4× A100 (320 GB)",
    accelerator: "nvidia-a100",
    count: 4,
    memoryGb: 320,
    hourlyUsd: 14.69,
  },
  {
    id: "Standard_NC40ads_H100_v5",
    label: "NC40ads H100 v5 · H100 (94 GB)",
    accelerator: "nvidia-h100",
    count: 1,
    memoryGb: 94,
    hourlyUsd: 6.98,
  },
];

export const AZURE_HOST: HostManifest = {
  id: "azure-managed-online",
  name: "Azure managed online endpoint",
  description:
    "Dedicated endpoint in your Azure ML or Foundry workspace running Text Generation Inference at your pinned Hub commit.",
  shapes: ["dedicated"],
  weights: "hub",
  adapters: false,
  scaleToZero: false,
  weightsVerified: true,
  retention: "self",
  engines: ["tgi"],
  quantisations: ["none", "awq", "gptq", "fp8"],
  hardware: AZURE_INSTANCES,
  regions: AZURE_REGIONS,
  architectures: ["*"],
  maxParameters: null,
  pricing: { unit: "gpu_hour", usd: null, note: "VM hours for each instance in the deployment" },
};

export const AZURE_FOUNDRY_MANIFEST: ProviderManifest = {
  id: "azure-foundry",
  name: "Microsoft Foundry",
  vendor: "Microsoft Azure",
  description:
    "Serve open models on managed compute in your Azure subscription, including UK South.",
  docsUrl: "https://learn.microsoft.com/azure/machine-learning/concept-endpoints-online",
  connection: {
    fields: [
      { key: "tenantId", label: "Tenant ID", kind: "text", required: true },
      { key: "clientId", label: "Client ID", kind: "text", required: true },
      { key: "clientSecret", label: "Client secret", kind: "secret", required: true },
      { key: "subscriptionId", label: "Subscription ID", kind: "text", required: true },
      { key: "resourceGroup", label: "Resource group", kind: "text", required: true },
      {
        key: "workspace",
        label: "Azure ML or Foundry hub workspace",
        kind: "text",
        required: true,
      },
      {
        key: "region",
        label: "Region",
        kind: "select",
        required: true,
        options: AZURE_REGIONS.map((region) => ({ value: region.id, label: region.label })),
      },
    ],
  },
  source: false,
  store: null,
  trainers: [],
  hosts: [AZURE_HOST],
};

const PROVISIONING: Record<string, DeploymentStatus> = {
  Creating: "provisioning",
  Updating: "updating",
  Succeeded: "running",
  Failed: "failed",
  Deleting: "deleting",
  Canceled: "failed",
};

class ArmClient {
  readonly settings: AzureSettings;
  readonly http: JsonHttpClient;

  constructor(context: ProviderAdapterContext) {
    this.settings = readAzureSettings(context.credentials);

    const tokens = new AzureTokenSource(this.settings, context.fetcher);

    this.http = new JsonHttpClient(
      "https://management.azure.com",
      async () => bearer(await tokens.token()),
      context.fetcher,
    );
  }

  workspacePath(suffix: string): string {
    const { subscriptionId, resourceGroup, workspace } = this.settings;

    return `/subscriptions/${encodeURIComponent(subscriptionId)}/resourceGroups/${encodeURIComponent(resourceGroup)}/providers/Microsoft.MachineLearningServices/workspaces/${encodeURIComponent(workspace)}${suffix}?api-version=${API_VERSION}`;
  }
}

export class AzureFoundryHost implements Host {
  readonly manifest = AZURE_HOST;
  private readonly arm: ArmClient;

  constructor(private readonly context: ProviderAdapterContext) {
    this.arm = new ArmClient(context);
  }

  private endpointPath(name: string, suffix = ""): string {
    return this.arm.workspacePath(`/onlineEndpoints/${encodeURIComponent(name)}${suffix}`);
  }

  private state(
    name: string,
    status: DeploymentStatus,
    hardware: string | null,
    failure: string | null = null,
  ): HostDeploymentState {
    return {
      status,
      providerRef: name,
      region: this.arm.settings.region,
      readyReplicas: null,
      hourlyUsd:
        status === "running"
          ? (AZURE_INSTANCES.find((item) => item.id === hardware)?.hourlyUsd ?? null)
          : 0,
      failureReason: failure,
    };
  }

  async create(input: HostDeploymentInput): Promise<HostDeploymentState> {
    if (input.adapters.length > 0) {
      throw unsupported("Azure endpoints here serve one model; merge adapters before deploying");
    }

    hubWeights(input.model);

    const name = slugify(`polychat-${input.name}`, 32);

    await this.arm.http.json(
      this.arm.workspacePath(`/environments/${ENVIRONMENT}/versions/${ENVIRONMENT_VERSION}`),
      {
        method: "PUT",
        body: {
          properties: {
            image: TGI_IMAGE,
            inferenceConfig: {
              livenessRoute: { port: 80, path: "/health" },
              readinessRoute: { port: 80, path: "/health" },
              scoringRoute: { port: 80, path: "/v1/chat/completions" },
            },
          },
        },
        context: "Registering the Azure serving environment",
      },
    );
    await this.arm.http.json(this.endpointPath(name), {
      method: "PUT",
      body: {
        location: this.arm.settings.region,
        identity: { type: "SystemAssigned" },
        tags: { "polychat-deployment": input.deploymentId },
        properties: { authMode: "Key" },
      },
      context: "Creating an Azure online endpoint",
    });

    return this.state(name, "provisioning", input.spec.target.hardware);
  }

  private async createDeployment(
    name: string,
    deployment: HostedDeployment,
    input: { repo: string; revision: string },
  ) {
    await this.arm.http.json(this.endpointPath(name, `/deployments/${DEPLOYMENT}`), {
      method: "PUT",
      body: {
        location: this.arm.settings.region,
        sku: { name: "Default", capacity: Math.max(1, deployment.spec.scaling.minReplicas) },
        properties: {
          endpointComputeType: "Managed",
          environmentId: this.arm
            .workspacePath(`/environments/${ENVIRONMENT}/versions/${ENVIRONMENT_VERSION}`)
            .split("?")[0],
          instanceType: deployment.spec.target.hardware ?? AZURE_INSTANCES[1].id,
          environmentVariables: {
            MODEL_ID: input.repo,
            REVISION: input.revision,
            ...(this.context.hub ? { HF_TOKEN: this.context.hub.token } : {}),
            ...(deployment.spec.contextLength
              ? { MAX_TOTAL_TOKENS: String(deployment.spec.contextLength) }
              : {}),
            ...(deployment.spec.quantisation !== "none"
              ? { QUANTIZE: deployment.spec.quantisation }
              : {}),
          },
          requestSettings: {
            requestTimeout: "PT180S",
            maxConcurrentRequestsPerInstance: deployment.spec.maxConcurrency,
          },
          readinessProbe: { initialDelay: "PT600S", period: "PT10S", failureThreshold: 60 },
          livenessProbe: { initialDelay: "PT600S", period: "PT10S", failureThreshold: 60 },
        },
      },
      context: "Creating an Azure deployment",
    });
  }

  async status(deployment: HostedDeployment): Promise<HostDeploymentState> {
    const name = deployment.providerRef;
    const hardware = deployment.spec.target.hardware;
    const endpoint = await this.arm.http.json(this.endpointPath(name), {
      context: "Reading an Azure online endpoint",
      allowNotFound: true,
    });

    if (endpoint === null) {
      return this.state(name, "deleted", hardware);
    }

    const endpointProperties = readRecord(readRecord(endpoint).properties);
    const endpointState = String(endpointProperties.provisioningState);

    if (endpointState !== "Succeeded") {
      return this.state(name, PROVISIONING[endpointState] ?? "provisioning", hardware);
    }

    const existing = await this.arm.http.json(
      this.endpointPath(name, `/deployments/${DEPLOYMENT}`),
      {
        context: "Reading an Azure deployment",
        allowNotFound: true,
      },
    );

    if (existing === null) {
      if (deployment.desired !== "running") {
        return this.state(name, "paused", hardware);
      }

      await this.createDeployment(name, deployment, hubWeights(deployment.model));

      return this.state(name, "provisioning", hardware);
    }

    const deploymentState = String(readRecord(readRecord(existing).properties).provisioningState);
    const traffic = readRecord(endpointProperties.traffic);

    if (deploymentState === "Succeeded" && traffic[DEPLOYMENT] !== 100) {
      await this.arm.http.json(this.endpointPath(name), {
        method: "PATCH",
        body: { properties: { traffic: { [DEPLOYMENT]: 100 } } },
        context: "Routing traffic on an Azure endpoint",
      });
    }

    return this.state(name, PROVISIONING[deploymentState] ?? "provisioning", hardware);
  }

  async scale(
    deployment: HostedDeployment,
    scaling: { minReplicas: number; maxReplicas: number },
  ): Promise<HostDeploymentState> {
    await this.arm.http.json(
      this.endpointPath(deployment.providerRef, `/deployments/${DEPLOYMENT}`),
      {
        method: "PATCH",
        body: { sku: { capacity: Math.max(1, scaling.minReplicas) } },
        context: "Scaling an Azure deployment",
      },
    );

    return this.status(deployment);
  }

  async pause(deployment: HostedDeployment): Promise<HostDeploymentState> {
    await this.arm.http.json(
      this.endpointPath(deployment.providerRef, `/deployments/${DEPLOYMENT}`),
      {
        method: "DELETE",
        context: "Removing an Azure deployment",
        allowNotFound: true,
      },
    );

    return this.state(deployment.providerRef, "paused", deployment.spec.target.hardware);
  }

  async resume(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return this.status(deployment);
  }

  async delete(deployment: HostedDeployment): Promise<void> {
    await this.arm.http.json(this.endpointPath(deployment.providerRef), {
      method: "DELETE",
      context: "Deleting an Azure online endpoint",
      allowNotFound: true,
    });
  }

  async invoke(
    deployment: HostedDeployment,
    request: ChatInvocation,
  ): Promise<ChatInvocationResult> {
    const endpoint = readRecord(
      await this.arm.http.record(this.endpointPath(deployment.providerRef), {
        context: "Reading an Azure online endpoint",
      }),
    );
    const scoringUri = readNonEmptyString(readRecord(endpoint.properties).scoringUri);
    const keys = await this.arm.http.record(
      this.endpointPath(deployment.providerRef, "/listKeys"),
      {
        method: "POST",
        body: {},
        context: "Reading Azure endpoint keys",
      },
    );
    const key = readNonEmptyString(keys.primaryKey);

    if (!scoringUri || !key) {
      throw unsupported("The Azure endpoint has no scoring URI or key yet");
    }

    const url = new URL(scoringUri);

    return invokeOpenAiCompatible({
      baseUrl: `${url.origin}${url.pathname.replace(/\/score$/, "")}`,
      headers: bearer(key),
      model: "tgi",
      request,
      fetcher: this.context.fetcher,
      context: "Calling an Azure endpoint",
    });
  }

  async list(): Promise<string[]> {
    const body = readRecord(
      await this.arm.http.json(this.arm.workspacePath("/onlineEndpoints"), {
        context: "Listing Azure online endpoints",
      }),
    );

    return (Array.isArray(body.value) ? body.value : []).flatMap((item) => {
      const record = readRecord(item);
      const name = readNonEmptyString(record.name);

      return name && readRecord(record.tags)["polychat-deployment"] ? [name] : [];
    });
  }
}

export class AzureConnectionChecker implements ConnectionChecker {
  constructor(private readonly context: ProviderAdapterContext) {}

  async check(): Promise<ConnectionCheck> {
    const arm = new ArmClient(this.context);

    await arm.http.json(arm.workspacePath(""), { context: "Checking the Azure workspace" });

    return {
      account: `${arm.settings.subscriptionId}/${arm.settings.workspace}`,
      capabilities: { read: false, store: false, train: false, host: true },
      namespaces: [{ name: arm.settings.workspace, canWrite: true }],
      message: null,
    };
  }
}

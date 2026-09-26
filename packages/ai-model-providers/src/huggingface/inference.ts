import { unsupported } from "../errors.js";
import { bearer } from "../http.js";
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
import { HuggingFaceHubClient } from "./hub.js";
import { readHubAccess } from "./jobs.js";
import { HF_INFERENCE_HOST } from "./manifest.js";

export const HUGGINGFACE_ROUTER_URL = "https://router.huggingface.co/v1";

function serverlessState(providerRef: string): HostDeploymentState {
  return {
    status: "running",
    providerRef,
    region: "global",
    readyReplicas: null,
    hourlyUsd: 0,
    failureReason: null,
  };
}

export class HuggingFaceInferenceHost implements Host {
  readonly manifest = HF_INFERENCE_HOST;
  private readonly token: string;

  constructor(private readonly context: ProviderAdapterContext) {
    this.token = readHubAccess(context).token;
  }

  async create(input: HostDeploymentInput): Promise<HostDeploymentState> {
    if (input.adapters.length > 0) {
      throw unsupported("Inference Providers cannot load your adapters");
    }

    const { repo, revision } = hubWeights(input.model);
    const info = await new HuggingFaceHubClient({
      token: this.token,
      fetcher: this.context.fetcher,
    }).getRepoInfo({ kind: "model", repo, revision });
    const live = info.inferenceProviders.filter((provider) => provider.status === "live");
    const pinned =
      typeof input.spec.providerOptions.provider === "string"
        ? input.spec.providerOptions.provider
        : null;

    if (live.length === 0 || (pinned && !live.some((provider) => provider.provider === pinned))) {
      throw unsupported(`No Inference Provider currently serves ${repo}`);
    }

    return serverlessState(pinned ? `${repo}:${pinned}` : repo);
  }

  async status(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return serverlessState(deployment.providerRef);
  }

  async scale(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return serverlessState(deployment.providerRef);
  }

  async pause(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return { ...serverlessState(deployment.providerRef), status: "paused" };
  }

  async resume(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return serverlessState(deployment.providerRef);
  }

  async delete(): Promise<void> {}

  invoke(deployment: HostedDeployment, request: ChatInvocation): Promise<ChatInvocationResult> {
    return invokeOpenAiCompatible({
      baseUrl: HUGGINGFACE_ROUTER_URL,
      headers: bearer(this.token),
      model: deployment.providerRef,
      request,
      fetcher: this.context.fetcher,
      context: `Calling ${deployment.providerRef} through Inference Providers`,
    });
  }

  async list(): Promise<string[]> {
    return [];
  }
}

export class HuggingFaceConnectionChecker implements ConnectionChecker {
  constructor(private readonly context: ProviderAdapterContext) {}

  async check() {
    const { token, namespace } = readHubAccess(this.context);
    const identity = await new HuggingFaceHubClient({
      token,
      fetcher: this.context.fetcher,
    }).whoAmI();
    const namespaces = [
      { name: identity.account, canWrite: identity.canWrite },
      ...identity.organisations,
    ];
    const target = namespaces.find((item) => item.name === namespace);

    return {
      account: identity.account,
      capabilities: {
        read: true,
        store: Boolean(target?.canWrite),
        train: Boolean(target?.canWrite),
        host: Boolean(target?.canWrite),
      },
      namespaces,
      message: target
        ? target.canWrite
          ? null
          : `${identity.account} cannot write to ${namespace}; training and hosting stay off`
        : `${identity.account} is not a member of ${namespace}`,
    };
  }
}

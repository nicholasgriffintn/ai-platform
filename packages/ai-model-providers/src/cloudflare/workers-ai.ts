import type {
  ConnectionCheck,
  HostManifest,
  ProviderManifest,
} from "@ngriffin_uk/polychat-schemas";
import {
  readArray,
  readFiniteNumber,
  readNonEmptyString,
  readRecord,
  slugify,
} from "@ngriffin_uk/polychat-utility-core";

import { misconfigured, unsupported } from "../errors.js";
import { bearer, JsonHttpClient, streamingMultipart } from "../http.js";
import { HuggingFaceHubClient } from "../huggingface/hub.js";
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

export const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";

export const WORKERS_AI_LORA_BASES: Record<string, string> = {
  "mistralai/Mistral-7B-Instruct-v0.2": "@cf/mistral/mistral-7b-instruct-v0.2-lora",
  "google/gemma-2b-it": "@cf/google/gemma-2b-it-lora",
  "google/gemma-7b-it": "@cf/google/gemma-7b-it-lora",
  "meta-llama/Llama-2-7b-chat-hf": "@cf/meta-llama/llama-2-7b-chat-hf-lora",
  "google/gemma-3-12b-it": "@cf/google/gemma-3-12b-it",
  "Qwen/Qwen2.5-Coder-32B-Instruct": "@cf/qwen/qwen2.5-coder-32b-instruct",
};

const ADAPTER_FILES = ["adapter_config.json", "adapter_model.safetensors"];

export const WORKERS_AI_HOST: HostManifest = {
  id: "workers-ai-lora",
  name: "Workers AI LoRA",
  description:
    "Serverless LoRA adapters on Cloudflare's shared base models, served from the nearest data centre with per-request pricing.",
  shapes: ["adapter_pool", "serverless"],
  weights: "hub",
  adapters: true,
  scaleToZero: true,
  weightsVerified: false,
  retention: "zero",
  engines: ["provider"],
  quantisations: ["none"],
  hardware: [],
  regions: [{ id: "global", label: "Cloudflare network", jurisdiction: "global" }],
  architectures: ["mistral", "gemma", "gemma3", "llama", "qwen2"],
  maxParameters: 35e9,
  pricing: { unit: "request", usd: null, note: "Neurons per request on the base model's rate" },
};

export const CLOUDFLARE_WORKERS_AI_MANIFEST: ProviderManifest = {
  id: "cloudflare-workers-ai",
  name: "Cloudflare Workers AI",
  vendor: "Cloudflare",
  description:
    "Bring LoRA adapters (rank 32 or lower, under 300 MB) to serverless base models at the edge.",
  docsUrl: "https://developers.cloudflare.com/workers-ai/features/fine-tunes/loras/",
  connection: {
    fields: [
      {
        key: "apiToken",
        label: "API token",
        kind: "secret",
        required: true,
        help: "Needs Workers AI edit permission.",
      },
      { key: "accountId", label: "Account ID", kind: "text", required: true },
    ],
  },
  source: false,
  store: null,
  trainers: [],
  hosts: [WORKERS_AI_HOST],
};

function cloudflare(context: ProviderAdapterContext): { http: JsonHttpClient; accountId: string } {
  const apiToken = context.credentials.secrets.apiToken;
  const accountId = context.credentials.config.accountId;

  if (!apiToken || !accountId) {
    throw misconfigured("The Cloudflare connection needs an API token and account ID");
  }

  return {
    http: new JsonHttpClient(
      `${CLOUDFLARE_API}/accounts/${encodeURIComponent(accountId)}`,
      () => bearer(apiToken),
      context.fetcher,
    ),
    accountId,
  };
}

function running(providerRef: string): HostDeploymentState {
  return {
    status: "running",
    providerRef,
    region: "global",
    readyReplicas: null,
    hourlyUsd: 0,
    failureReason: null,
  };
}

export class WorkersAiHost implements Host {
  readonly manifest = WORKERS_AI_HOST;
  private readonly http: JsonHttpClient;

  constructor(private readonly context: ProviderAdapterContext) {
    this.http = cloudflare(context).http;
  }

  async create(input: HostDeploymentInput): Promise<HostDeploymentState> {
    const [adapter] = input.adapters;
    const baseRepo = hubWeights(input.model).repo;
    const model = WORKERS_AI_LORA_BASES[baseRepo];

    if (!model) {
      throw unsupported(`${input.model.name} is not a Workers AI LoRA base`);
    }

    if (!adapter) {
      return running(`${model}|`);
    }

    if (input.adapters.length > 1) {
      throw unsupported("Workers AI applies one adapter per request");
    }

    const created = readRecord(
      (
        await this.http.record("/ai/finetunes", {
          method: "POST",
          body: {
            model,
            name: slugify(`polychat-${input.name}`, 60),
            description: `Polychat deployment ${input.deploymentId}`,
          },
          context: "Creating a Workers AI fine-tune",
        })
      ).result,
    );
    const finetuneId = readNonEmptyString(created.id);

    if (!finetuneId) {
      throw unsupported("Workers AI did not return a fine-tune id");
    }

    const weights = hubWeights(adapter);
    const hub = new HuggingFaceHubClient({
      token: this.context.hub?.token,
      fetcher: this.context.fetcher,
    });

    for (const file of ADAPTER_FILES) {
      const source = await hub.openFile({
        kind: "model",
        repo: weights.repo,
        revision: weights.revision,
        path: file,
      });

      if (!source.body) {
        throw unsupported(`${weights.repo} has no ${file}`);
      }

      const multipart = streamingMultipart(
        { file_name: file },
        {
          field: "file",
          filename: file,
          contentType: "application/octet-stream",
          stream: source.body,
        },
      );

      await this.http.json(`/ai/finetunes/${encodeURIComponent(finetuneId)}/finetune-assets`, {
        method: "POST",
        rawBody: multipart.body,
        headers: { "Content-Type": multipart.contentType },
        context: `Uploading ${file} to Workers AI`,
      });
    }

    return running(`${model}|${finetuneId}`);
  }

  async status(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return deployment.desired === "paused"
      ? { ...running(deployment.providerRef), status: "paused" }
      : running(deployment.providerRef);
  }

  async scale(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return this.status(deployment);
  }

  async pause(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return { ...running(deployment.providerRef), status: "paused" };
  }

  async resume(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return running(deployment.providerRef);
  }

  async delete(deployment: HostedDeployment): Promise<void> {
    const [, finetuneId] = deployment.providerRef.split("|");

    if (finetuneId) {
      await this.http.json(`/ai/finetunes/${encodeURIComponent(finetuneId)}`, {
        method: "DELETE",
        context: "Deleting a Workers AI fine-tune",
        allowNotFound: true,
      });
    }
  }

  async invoke(
    deployment: HostedDeployment,
    request: ChatInvocation,
  ): Promise<ChatInvocationResult> {
    const [model, finetuneId] = deployment.providerRef.split("|");
    const body = await this.http.record(`/ai/run/${model}`, {
      method: "POST",
      body: {
        messages: request.messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        ...(request.topP === undefined ? {} : { top_p: request.topP }),
        ...(finetuneId ? { lora: finetuneId, raw: true } : {}),
      },
      context: "Calling Workers AI",
    });
    const result = readRecord(body.result);
    const usage = readRecord(result.usage);

    return {
      text: readNonEmptyString(result.response) ?? "",
      inputTokens: readFiniteNumber(usage.prompt_tokens) ?? 0,
      outputTokens: readFiniteNumber(usage.completion_tokens) ?? 0,
    };
  }

  async list(): Promise<string[]> {
    const body = await this.http.record("/ai/finetunes", {
      context: "Listing Workers AI fine-tunes",
    });

    return readArray(body.result).flatMap((item) => {
      const record = readRecord(item);
      const id = readNonEmptyString(record.id);
      const model = readNonEmptyString(record.model);

      return id &&
        model &&
        (readNonEmptyString(record.description) ?? "").startsWith("Polychat deployment")
        ? [`${model}|${id}`]
        : [];
    });
  }
}

export class WorkersAiConnectionChecker implements ConnectionChecker {
  constructor(private readonly context: ProviderAdapterContext) {}

  async check(): Promise<ConnectionCheck> {
    const { http, accountId } = cloudflare(this.context);

    await http.json("/ai/finetunes", { context: "Checking the Cloudflare API token" });

    return {
      account: accountId,
      capabilities: { read: false, store: false, train: false, host: true },
      namespaces: [],
      message: null,
    };
  }
}

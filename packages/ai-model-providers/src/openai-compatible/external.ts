import type {
  ConnectionCheck,
  HostManifest,
  ProviderManifest,
} from "@ngriffin_uk/polychat-schemas";
import { readArray, readNonEmptyString, readRecord } from "@ngriffin_uk/polychat-utility-core";
import { parsePublicHttpUrl } from "@ngriffin_uk/polychat-utility-server/http";

import { misconfigured, unsupported } from "../errors.js";
import { bearer, type Fetcher, JsonHttpClient } from "../http.js";
import { invokeOpenAiCompatible } from "../openai-compatible.js";
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

export const EXTERNAL_HOST: HostManifest = {
  id: "openai-compatible",
  name: "Your own server",
  description:
    "Any OpenAI-compatible server you run, such as vLLM, SGLang, llama.cpp, Ollama, KServe or a LiteLLM gateway. Polychat holds only the URL and key.",
  shapes: ["external"],
  weights: "external",
  adapters: true,
  scaleToZero: false,
  weightsVerified: false,
  retention: "self",
  engines: ["vllm", "sglang", "tgi", "tensorrt-llm", "llama.cpp", "provider"],
  quantisations: ["none", "fp8", "awq", "gptq", "nvfp4", "bnb-4bit", "gguf"],
  hardware: [],
  regions: [{ id: "self", label: "Where you run it", jurisdiction: "global" }],
  architectures: ["*"],
  maxParameters: null,
  pricing: { unit: "gpu_hour", usd: null, note: "Billed by whoever runs the server" },
};

export const OPENAI_COMPATIBLE_MANIFEST: ProviderManifest = {
  id: "openai-compatible",
  name: "Self-hosted gateway",
  vendor: "You",
  description: "Register an OpenAI-compatible base URL once and route approved models to it.",
  docsUrl: "https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html",
  connection: {
    fields: [
      {
        key: "baseUrl",
        label: "Base URL",
        kind: "text",
        required: true,
        placeholder: "https://models.example.com/v1",
        help: "Must be public HTTPS; private addresses and redirects are refused.",
      },
      { key: "apiKey", label: "API key", kind: "secret", required: false },
      {
        key: "jurisdiction",
        label: "Where it runs",
        kind: "select",
        required: true,
        options: [
          { value: "uk", label: "United Kingdom" },
          { value: "eu", label: "European Union" },
          { value: "us", label: "United States" },
          { value: "global", label: "Elsewhere or mixed" },
        ],
      },
    ],
  },
  source: false,
  store: null,
  trainers: [],
  hosts: [EXTERNAL_HOST],
};

export function safeBaseUrl(value: string | undefined): string {
  if (!value) {
    throw misconfigured("Add a base URL for your server");
  }

  let url: URL;

  try {
    url = parsePublicHttpUrl(value);
  } catch {
    throw misconfigured("The base URL must be a public HTTPS address");
  }

  if (url.protocol !== "https:") {
    throw misconfigured("The base URL must use HTTPS");
  }

  return url.toString().replace(/\/$/, "");
}

export function refusingRedirects(fetcher: Fetcher): Fetcher {
  return async (input, init) => {
    const response = await fetcher(input, { ...init, redirect: "manual" });

    if (response.status >= 300 && response.status < 400) {
      throw unsupported(
        "Your server answered with a redirect; point the base URL at the final address",
      );
    }

    return response;
  };
}

function external(context: ProviderAdapterContext) {
  const baseUrl = safeBaseUrl(context.credentials.config.baseUrl);
  const apiKey = context.credentials.secrets.apiKey;
  const headers = apiKey ? bearer(apiKey) : {};
  const fetcher = refusingRedirects(context.fetcher);

  return { baseUrl, headers, fetcher, http: new JsonHttpClient(baseUrl, () => headers, fetcher) };
}

function state(providerRef: string, status: HostDeploymentState["status"]): HostDeploymentState {
  return {
    status,
    providerRef,
    region: "self",
    readyReplicas: null,
    hourlyUsd: null,
    failureReason: null,
  };
}

export class ExternalHost implements Host {
  readonly manifest = EXTERNAL_HOST;

  constructor(private readonly context: ProviderAdapterContext) {}

  async create(input: HostDeploymentInput): Promise<HostDeploymentState> {
    const modelId = input.spec.external?.modelId;

    if (!modelId) {
      throw misconfigured("Name the model your server exposes");
    }

    return this.status({
      providerRef: modelId,
      spec: input.spec,
      model: input.model,
      adapters: input.adapters,
      desired: "running",
    });
  }

  async status(deployment: HostedDeployment): Promise<HostDeploymentState> {
    if (deployment.desired === "paused") {
      return state(deployment.providerRef, "paused");
    }

    const { http } = external(this.context);
    const body = readRecord(
      await http.json("/models", { context: "Listing models on your server" }),
    );
    const served = readArray(body.data).some(
      (item) => readNonEmptyString(readRecord(item).id) === deployment.providerRef,
    );

    return served
      ? state(deployment.providerRef, "running")
      : {
          ...state(deployment.providerRef, "failed"),
          failureReason: `Your server does not list ${deployment.providerRef}`,
        };
  }

  scale(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return this.status(deployment);
  }

  async pause(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return state(deployment.providerRef, "paused");
  }

  resume(deployment: HostedDeployment): Promise<HostDeploymentState> {
    return this.status({ ...deployment, desired: "running" });
  }

  async delete(): Promise<void> {}

  invoke(deployment: HostedDeployment, request: ChatInvocation): Promise<ChatInvocationResult> {
    const { baseUrl, headers, fetcher } = external(this.context);

    return invokeOpenAiCompatible({
      baseUrl,
      headers,
      model: deployment.providerRef,
      request,
      fetcher,
      context: "Calling your server",
    });
  }

  async list(): Promise<string[]> {
    return [];
  }
}

export class ExternalConnectionChecker implements ConnectionChecker {
  constructor(private readonly context: ProviderAdapterContext) {}

  async check(): Promise<ConnectionCheck> {
    const { http, baseUrl } = external(this.context);
    const body = readRecord(
      await http.json("/models", { context: "Listing models on your server" }),
    );
    const models = readArray(body.data).flatMap((item) => {
      const id = readNonEmptyString(readRecord(item).id);

      return id ? [{ name: id, canWrite: false }] : [];
    });

    return {
      account: new URL(baseUrl).host,
      capabilities: { read: false, store: false, train: false, host: true },
      namespaces: models,
      message: models.length ? null : "Your server lists no models yet",
    };
  }
}

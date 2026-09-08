import type { DesktopRun } from "@ngriffin_uk/polychat-library-chat";
import {
  MachineRunClient,
  type FetchApiOptions,
} from "@ngriffin_uk/polychat-library-client/machine-runs";
import type {
  DesktopEndpoint,
  DesktopModelRunRequest,
  DiscoveredModel,
  DesktopStreamEvent,
} from "@ngriffin_uk/polychat-schemas";
import {
  ollamaTagsSchema,
  ollamaChunkSchema,
  ollamaVersionSchema,
} from "@ngriffin_uk/polychat-schemas";
import type { APIRequestContext } from "@playwright/test";

import { runMachineConsumer } from "../../../../desktop/src/lib/machine-runner";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";
import { fetchOllamaFixture } from "./ollama-provider";

export class OllamaMachine {
  private readonly runtimeFetch = process.env.POLYCHAT_E2E_LIVE_RUNTIMES
    ? fetch
    : fetchOllamaFixture;
  readonly machineId = crypto.randomUUID();
  readonly client: MachineRunClient;
  private readonly controller = new AbortController();
  private consumer?: Promise<void>;
  private readonly endpoint: DesktopEndpoint = {
    id: "ollama",
    kind: "model",
    vendor: "ollama",
    label: "Ollama",
    url: "http://127.0.0.1:11434",
    transport: "loopback",
    approvedAt: new Date().toISOString(),
    lastSeenAt: null,
    pairingSecretStored: false,
  };

  constructor(private request: APIRequestContext) {
    this.client = new MachineRunClient(async (path: string, options: FetchApiOptions = {}) => {
      const response = await request.fetch(`${E2E_API_BASE_URL}${path}`, {
        method: options.method ?? "GET",
        headers: { origin: E2E_APP_BASE_URL },
        data: options.body,
        timeout: 10_000,
      });

      return new Response(await response.text(), {
        status: response.status(),
        headers: { "content-type": "application/json" },
      });
    });
  }

  listEndpoints = async () => [this.endpoint];

  discoverModels = async (): Promise<DiscoveredModel[]> => {
    const response = await this.runtimeFetch(`${this.endpoint.url}/api/tags`);

    if (!response.ok) {
      throw new Error(`Ollama discovery failed: ${response.status}`);
    }

    return ollamaTagsSchema.parse(await response.json()).models.map((model) => ({
      endpointId: this.endpoint.id,
      nativeId: model.model,
      displayName: model.model,
      contextTokens: null,
      parameterSizeBytes: null,
      capabilities: { tools: false, vision: false, thinking: false },
      loaded: false,
      discoveredAt: new Date().toISOString(),
    }));
  };

  startModelRun = async (request: DesktopModelRunRequest): Promise<DesktopRun> => {
    const controller = new AbortController();
    const runId = crypto.randomUUID();
    const url = this.endpoint.url;
    const runtimeFetch = this.runtimeFetch;

    return {
      runId,
      cancel: () => controller.abort(),
      events: {
        async *[Symbol.asyncIterator](): AsyncGenerator<DesktopStreamEvent> {
          const response = await runtimeFetch(`${url}/api/chat`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              model: request.nativeModelId,
              messages: request.messages,
              stream: true,
              options: { num_predict: 128 },
            }),
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            throw new Error(`Ollama completion failed: ${response.status}`);
          }

          const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
          let buffer = "";

          try {
            while (true) {
              const { value, done } = await reader.read();

              if (done) {
                throw new Error("Ollama disconnected before completion");
              }

              buffer += value;
              let newline = buffer.indexOf("\n");

              while (newline >= 0) {
                const line = buffer.slice(0, newline);

                buffer = buffer.slice(newline + 1);
                const chunk = ollamaChunkSchema.parse(JSON.parse(line));

                if (chunk.error) {
                  throw new Error(chunk.error);
                }

                if (chunk.message?.content) {
                  yield { type: "text", runId, delta: chunk.message.content };
                }

                if (chunk.done) {
                  yield {
                    type: "finished",
                    runId,
                    reason: "complete",
                    at: new Date().toISOString(),
                  };

                  return;
                }

                newline = buffer.indexOf("\n");
              }
            }
          } finally {
            await reader.cancel();
          }
        },
      },
    };
  };

  async start() {
    const models = await this.discoverModels();
    const versionResponse = await this.runtimeFetch(`${this.endpoint.url}/api/version`);
    const { version } = ollamaVersionSchema.parse(await versionResponse.json());

    if (!models.some((model) => model.nativeId === "gemma3:1b")) {
      throw new Error(
        "Install gemma3:1b in the local Ollama runtime before running this live journey.",
      );
    }

    const response = await this.request.post(`${E2E_API_BASE_URL}/machines/heartbeat`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: {
        machineId: this.machineId,
        label: "Ollama desktop",
        platform: "linux",
        appVersion: "0.1.0",
        capabilities: ["model-run", "model-relay"],
        runtimes: [
          {
            kind: "model",
            vendor: "ollama",
            readiness: { status: "ready", version, checkedAt: new Date().toISOString() },
            models: models.map(
              ({ nativeId, displayName, contextTokens, capabilities, loaded }) => ({
                nativeId,
                displayName,
                contextTokens,
                capabilities,
                loaded,
              }),
            ),
          },
        ],
      },
    });

    if (!response.ok()) {
      throw new Error(`Machine registration failed: ${await response.text()}`);
    }

    await this.client.claim(this.machineId);
    this.consumer = runMachineConsumer({
      backend: this,
      client: this.client,
      machineId: this.machineId,
      signal: this.controller.signal,
    });
  }

  async stop() {
    this.controller.abort();
    await this.consumer;
    await this.request.delete(`${E2E_API_BASE_URL}/machines/${this.machineId}`, {
      headers: { origin: E2E_APP_BASE_URL },
    });
  }
}

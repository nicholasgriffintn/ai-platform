import {
  resolveSandboxDeliveryPolicy,
  SANDBOX_EXECUTION_PROVIDER_DEFINITIONS,
} from "@ngriffin_uk/polychat-schemas";
import { encodeServerSentEvent } from "@ngriffin_uk/polychat-utility-core";

import { SSE_HEADERS } from "~/lib/http/streaming";
import { getModelConfig } from "~/lib/providers/models";
import { resolveProviderApiKey } from "~/lib/providers/utils/apiKeys";
import type { IEnv, IUser } from "~/types";
import { readResponseTextWithinLimit } from "~/utils/http";
import { getLogger } from "~/utils/logger";
import { redactSensitiveTokens } from "~/utils/redaction";
import { parseSseBuffer } from "~/utils/streaming";

import {
  buildHostedSandboxRunResult,
  verifyHostedSandboxDelivery,
} from "../hostedSandboxExecution";
import type { SandboxProvider, SandboxProviderExecuteOptions } from "../index";
import { OpenAIAgentEventTranslator } from "./openaiAgentEvents";
import { OpenAIAgentsClient } from "./openaiAgentsClient";
import { buildOpenAIAgentsSessionBody } from "./openaiAgentsSession";

const logger = getLogger({ prefix: "providers/sandbox/openai-agents" });

export class OpenAIAgentsSandboxProvider implements SandboxProvider {
  readonly name = "openai" as const;
  readonly capabilities = SANDBOX_EXECUTION_PROVIDER_DEFINITIONS.openai.capabilities;

  constructor(
    private readonly env: IEnv,
    private readonly user: IUser,
  ) {}

  async execute(options: SandboxProviderExecuteOptions): Promise<Response> {
    const model = await this.resolveModel(options.model);
    const deliveryPolicy = resolveSandboxDeliveryPolicy(
      options.deliveryPolicy,
      options.shouldCommit,
    );
    const apiKey = await resolveProviderApiKey({
      env: this.env,
      providerName: "openai",
      envKeyName: "OPENAI_API_KEY",
      userId: this.user.id,
      logger,
    });
    const client = new OpenAIAgentsClient(apiKey);
    const sessionResponse = await client.createSession(
      buildOpenAIAgentsSessionBody({
        credentialBroker: options.credentialBroker,
        model,
        repo: options.repo,
        task: options.task,
        runId: options.runId ?? "openai-agents-run",
        deliveryPolicy,
        environmentSetup: options.environmentSetup,
        environmentPreparationMode: options.environmentPreparationMode,
      }),
    );

    if (!sessionResponse.ok || !sessionResponse.body) {
      const message = await readResponseTextWithinLimit(sessionResponse, 64 * 1024);

      return new Response(
        redactSensitiveTokens(
          message || "OpenAI Agents API returned an empty response",
          options.credentialBroker.grant,
        ),
        {
          status: sessionResponse.status || 502,
        },
      );
    }

    const stream = this.translateStream({
      upstream: sessionResponse.body,
      client,
      repo: options.repo,
      runId: options.runId ?? "openai-agents-run",
      deliveryPolicy,
      brokerGrant: options.credentialBroker.grant,
      credentialBroker: options.credentialBroker,
    });

    return new Response(stream, { headers: SSE_HEADERS });
  }

  private async resolveModel(modelId: string | undefined): Promise<string> {
    const config = await getModelConfig(modelId, this.env, "openai", this.user.id);

    if (!config || config.provider !== "openai") {
      throw new Error(`OpenAI-hosted sandbox model "${modelId ?? ""}" is not available`);
    }

    return config.matchingModel;
  }

  private translateStream(params: {
    upstream: ReadableStream<Uint8Array>;
    client: OpenAIAgentsClient;
    repo: string;
    runId: string;
    deliveryPolicy: ReturnType<typeof resolveSandboxDeliveryPolicy>;
    brokerGrant: string;
    credentialBroker: SandboxProviderExecuteOptions["credentialBroker"];
  }): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        const translator = new OpenAIAgentEventTranslator(params.runId);
        const reader = params.upstream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        controller.enqueue(
          encodeServerSentEvent({
            type: "run_started",
            runId: params.runId,
            message: "OpenAI-hosted run started",
            timestamp: new Date().toISOString(),
          }),
        );

        try {
          while (!translator.terminalStatus) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            buffer = parseSseBuffer(buffer, {
              onEvent: (event) => {
                for (const translated of translator.handle(event)) {
                  controller.enqueue(
                    encodeServerSentEvent(redactSensitiveTokens(translated, params.brokerGrant)),
                  );
                }
              },
            });
          }

          if (buffer.trim()) {
            parseSseBuffer(`${buffer}\n\n`, {
              onEvent: (event) => {
                for (const translated of translator.handle(event)) {
                  controller.enqueue(
                    encodeServerSentEvent(redactSensitiveTokens(translated, params.brokerGrant)),
                  );
                }
              },
            });
          }

          await this.emitTerminalEvents(
            controller,
            translator,
            params.client,
            params.repo,
            params.runId,
            params.deliveryPolicy,
            params.brokerGrant,
            params.credentialBroker,
          );
        } catch (error) {
          controller.enqueue(
            encodeServerSentEvent({
              type: "run_failed",
              runId: params.runId,
              error: redactSensitiveTokens(
                error instanceof Error ? error.message : "OpenAI-hosted run failed",
                params.brokerGrant,
              ),
              timestamp: new Date().toISOString(),
            }),
          );
        } finally {
          await reader.cancel().catch(() => undefined);
          reader.releaseLock();

          if (translator.sessionId) {
            await params.client.deleteSession(translator.sessionId).catch((error) => {
              logger.warn("Failed to delete OpenAI Agents session", {
                error,
                session_id: translator.sessionId,
              });
            });
          }

          controller.close();
        }
      },
    });
  }

  private async emitTerminalEvents(
    controller: ReadableStreamDefaultController<Uint8Array>,
    translator: OpenAIAgentEventTranslator,
    client: OpenAIAgentsClient,
    repo: string,
    runId: string,
    deliveryPolicy: ReturnType<typeof resolveSandboxDeliveryPolicy>,
    brokerGrant: string,
    credentialBroker: SandboxProviderExecuteOptions["credentialBroker"],
  ): Promise<void> {
    const timestamp = new Date().toISOString();

    if (translator.terminalStatus === "cancelled") {
      controller.enqueue(
        encodeServerSentEvent({
          type: "run_cancelled",
          runId,
          message: redactSensitiveTokens(translator.error, brokerGrant),
          timestamp,
        }),
      );

      return;
    }

    if (translator.terminalStatus !== "completed") {
      controller.enqueue(
        encodeServerSentEvent({
          type: "run_failed",
          runId,
          error: redactSensitiveTokens(
            translator.error ?? "OpenAI event stream ended before the root turn completed",
            brokerGrant,
          ),
          timestamp,
        }),
      );

      return;
    }

    if (!translator.sessionId || !translator.turnId) {
      throw new Error("OpenAI completed the turn without session or turn identifiers");
    }

    const artifacts = await client.downloadArtifacts({
      sessionId: translator.sessionId,
      turnId: translator.turnId,
    });
    const result = redactSensitiveTokens(
      await verifyHostedSandboxDelivery({
        result: buildHostedSandboxRunResult({
          repo,
          runId,
          resultArtifact: artifacts.result,
          diffArtifact: artifacts.diff,
          outputText: translator.outputText(),
          deliveryPolicy,
        }),
        repo,
        runId,
        deliveryPolicy,
        credentialBroker,
      }),
      brokerGrant,
    );

    for (const path of result.proof?.changedFiles ?? []) {
      controller.enqueue(
        encodeServerSentEvent({
          type: "file_changed",
          runId,
          path,
          changeType: "changed",
          timestamp,
        }),
      );
    }

    if (artifacts.diff !== undefined) {
      controller.enqueue(encodeServerSentEvent({ type: "diff_generated", runId, timestamp }));
    }

    controller.enqueue(
      encodeServerSentEvent(
        result.success
          ? { type: "run_completed", runId, result, timestamp }
          : {
              type: "run_failed",
              runId,
              result,
              error: result.summary || "Hosted sandbox result validation failed",
              timestamp,
            },
      ),
    );
  }
}

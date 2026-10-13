import type {
  ChatRequestOptions,
  ChatSettings,
  Message,
} from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { readCompactionStatusMessage } from "@ngriffin_uk/polychat-library-chat/message-compaction-status";
import {
  getMessageTextContent,
  serialiseMessagesForChatRequest,
} from "@ngriffin_uk/polychat-library-chat/messages";
import { filterUnavailableModelToolSelections } from "@ngriffin_uk/polychat-library-chat/model-tools";
import {
  RESPONSE_STREAM_PROGRESS_BATCH_EVENTS,
  buildResponseTools,
  createResponseStreamAssembler,
  isResponseStreamProgressEvent,
  messagesToItems,
  parseResponseStreamSseBuffer,
  responseEnvironmentSchema,
  responseReplayResponseSchema,
  responseSchema,
  responseSnapshotSchema,
  type CreateResponseRequest,
  type Item,
  type ModelConfigItem,
  type ModelTier,
  type PlatformResponse,
  type ResponseAgent,
  type ResponseEnvironment,
  type ResponseInputRequest,
  type ResponseStreamUpdate,
  type ToolSelectionMode,
  type ChatMode,
  type ComputeSite,
  type PermissionMode,
} from "@ngriffin_uk/polychat-schemas";
import { normaliseToolIds } from "@ngriffin_uk/polychat-schemas/tool-ids";
import { generateId, isRecord } from "@ngriffin_uk/polychat-utility-core";

import { projectChatRequestSettings } from "../chat-request-settings.js";
import {
  createStreamingApiError,
  toAppMessage,
  toResponseAppMessages,
} from "../chat-stream-response.js";
import type {
  AppResponseReplayResponse,
  AuthoritativeResponseSnapshot,
} from "../chat/response-replay.js";
import { normaliseConversationItems } from "../conversation-response.js";
import { fetchApi, fetchApiOrThrow } from "../fetch-wrapper.js";
import { ApiError, createApiErrorFromResponse, returnFetchedData } from "../http.js";
import { getSandboxTaskToolNames } from "../task-tools.js";
import { yieldToMainThread } from "../yield-to-main-thread.js";

export interface ResponseWithMessages {
  response: PlatformResponse;
  messages: Message[];
}

type StreamProgressHandler = (
  text: string,
  reasoning?: string,
  toolResponses?: Message[],
  done?: boolean,
  assistantMessage?: Message,
) => void;

export interface CreateResponseParams {
  allowTools?: boolean;
  agent?: ResponseAgent;
  chatSettings: ChatSettings;
  completionId: string;
  messages: Message[];
  mode: ChatMode;
  computeSite?: ComputeSite;
  model?: string;
  modelConfig?: ModelConfigItem;
  modelTier?: ModelTier;
  permissionMode?: PermissionMode;
  models?: string[];
  onProgress: StreamProgressHandler;
  onStateChange: (state: string, data?: any) => void;
  provider?: string;
  requestOptions?: ChatRequestOptions & { approved_tools?: string[] };
  selectedTools?: string[];
  signal: AbortSignal;
  toolSelectionMode?: ToolSelectionMode;
  store?: boolean;
  streamingEnabled?: boolean;
  useMultiModel?: boolean;
}

function toEnvironment(
  computeSite: ComputeSite | undefined,
  sandbox: NonNullable<ChatRequestOptions["options"]>["sandbox"] | undefined,
): ResponseEnvironment | undefined {
  if (sandbox?.enabled) {
    const { enabled: _enabled, ...rest } = sandbox;

    void _enabled;

    return responseEnvironmentSchema.parse({ type: "sandbox", ...rest });
  }

  return computeSite ? { type: computeSite } : undefined;
}

function definedEntries<T extends Record<string, unknown>>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export function buildCreateResponseBody(params: CreateResponseParams): CreateResponseRequest {
  const {
    agent,
    chatSettings,
    completionId,
    messages,
    mode,
    computeSite,
    model,
    modelConfig,
    modelTier,
    models,
    provider,
    requestOptions,
    selectedTools,
    toolSelectionMode,
    store = true,
    streamingEnabled = true,
    allowTools = true,
    permissionMode,
  } = params;
  const formattedMessages = serialiseMessagesForChatRequest(messages);

  if (formattedMessages.length === 0) {
    throw new Error("Missing required parameter: messages");
  }

  const { options: featureOptions, ...requestOptionFields } = requestOptions ?? {};
  const sandboxOptions =
    allowTools && featureOptions?.sandbox?.enabled ? featureOptions.sandbox : undefined;
  const selectedToolIds =
    allowTools && selectedTools
      ? normaliseToolIds(filterUnavailableModelToolSelections(selectedTools, modelConfig))
      : undefined;
  const requestEnabledTools = sandboxOptions
    ? normaliseToolIds([...(selectedToolIds ?? []), ...getSandboxTaskToolNames()])
    : selectedToolIds;
  const approvedToolIds = normaliseToolIds([
    ...(sandboxOptions ? getSandboxTaskToolNames() : []),
    ...(requestOptionFields.approved_tools ?? []),
  ]);
  const {
    enabledTools: settingsEnabledTools,
    generationSettings,
    hostedToolOptions,
  } = projectChatRequestSettings(chatSettings);
  const enabledTools = allowTools
    ? normaliseToolIds([
        ...(requestEnabledTools ?? settingsEnabledTools ?? []),
        ...(requestOptionFields.enabled_tools ?? []),
      ])
    : undefined;
  const tools = allowTools
    ? buildResponseTools({
        enabledTools,
        approvedTools: approvedToolIds,
        toolSelectionMode,
        hostedToolSettings: hostedToolOptions,
        functionTools: requestOptionFields.tools?.map((tool) => ({
          ...tool,
          function: { ...tool.function, parameters: tool.function.parameters ?? {} },
        })),
      })
    : undefined;
  const input: Item[] = [
    ...messagesToItems(formattedMessages),
    ...(featureOptions?.toolInteraction
      ? [
          {
            type: "interaction_response" as const,
            tool_name: featureOptions.toolInteraction.toolName,
            response: featureOptions.toolInteraction.response,
          },
        ]
      : []),
    ...(requestOptionFields.connector_approval_id
      ? [
          {
            type: "approval_response" as const,
            approval_id: requestOptionFields.connector_approval_id,
          },
        ]
      : []),
  ];
  const reasoning = generationSettings.reasoning ?? requestOptionFields.reasoning;
  const sampling = definedEntries({
    temperature: generationSettings.temperature ?? requestOptionFields.temperature,
    top_p: generationSettings.top_p ?? requestOptionFields.top_p,
    max_output_tokens: generationSettings.max_tokens ?? requestOptionFields.max_tokens,
    presence_penalty: generationSettings.presence_penalty,
    frequency_penalty: generationSettings.frequency_penalty,
  });
  const text = definedEntries({
    verbosity: generationSettings.verbosity ?? requestOptionFields.verbosity,
    format: requestOptionFields.response_format,
  });
  const maxSteps =
    sandboxOptions?.maxSteps ?? (sandboxOptions ? 2 : undefined) ?? requestOptionFields.max_steps;
  const options = definedEntries({
    source: featureOptions?.source,
    recipe: featureOptions?.recipe,
    connector: featureOptions?.connector,
    agent: featureOptions?.agent,
  });
  const projectId = requestOptionFields.metadata?.project_id;
  const uiContext = requestOptionFields.poly?.ui_context;

  return definedEntries({
    conversation: definedEntries({
      id: completionId,
      type: requestOptionFields.conversation_type,
      project_id: projectId,
    }),
    input,
    instructions: requestOptionFields.system_prompt,
    model: model ?? requestOptionFields.model,
    models: models?.length ? models : undefined,
    provider: provider ?? requestOptionFields.provider,
    model_tier: modelTier ?? requestOptionFields.model_tier,
    agent,
    environment: toEnvironment(computeSite ?? requestOptionFields.compute_site, sandboxOptions),
    tools,
    permission_mode: permissionMode ?? requestOptionFields.permission_mode,
    mode: mode ?? requestOptionFields.mode,
    compaction: generationSettings.compaction ?? requestOptionFields.compaction,
    reasoning,
    sampling: Object.keys(sampling).length > 0 ? sampling : undefined,
    text: Object.keys(text).length > 0 ? text : undefined,
    budget: maxSteps !== undefined ? { steps: maxSteps } : undefined,
    service_tier: generationSettings.service_tier,
    stream: streamingEnabled,
    store: requestOptionFields.store ?? store,
    idempotency_key: requestOptionFields.command_id ?? generateId(),
    response_id: requestOptionFields.run_id,
    client: definedEntries({ platform: "web", ui_context: uiContext }),
    metadata: requestOptionFields.metadata,
    options: Object.keys(options).length > 0 ? options : undefined,
  });
}

function toSnapshot(snapshot: unknown): AuthoritativeResponseSnapshot {
  const parsed = responseSnapshotSchema.parse(snapshot);
  const { output, ...rest } = parsed;

  return { ...rest, messages: normaliseConversationItems(output) };
}

export class ResponsesService {
  constructor(private getHeaders: () => Promise<Record<string, string>>) {}

  async create(params: CreateResponseParams): Promise<Message> {
    const body = buildCreateResponseBody(params);
    const response = await fetchApi("/responses", {
      method: "POST",
      headers: await this.getHeaders(),
      body,
      signal: params.signal,
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(response, "Failed to create response");
    }

    return this.consume(response, params.model, params.onProgress, params.onStateChange);
  }

  async get(responseId: string, signal?: AbortSignal): Promise<ResponseWithMessages> {
    const response = await fetchApiOrThrow(`/responses/${encodeURIComponent(responseId)}`, {
      method: "GET",
      headers: await this.getHeaders(),
      signal,
    });
    const parsed = responseSchema.parse(await returnFetchedData<unknown>(response));
    const { output, ...rest } = parsed;

    return { response: rest, messages: normaliseConversationItems(output ?? []) };
  }

  async getSnapshot(
    responseId: string,
    signal?: AbortSignal,
  ): Promise<AuthoritativeResponseSnapshot> {
    const response = await fetchApiOrThrow(`/responses/${encodeURIComponent(responseId)}`, {
      method: "GET",
      headers: await this.getHeaders(),
      signal,
    });
    const data = await returnFetchedData<unknown>(response);
    const cursor = await this.readCursor(responseId, signal);

    return toSnapshot({ ...(isRecord(data) ? data : {}), cursor });
  }

  private async readCursor(responseId: string, signal?: AbortSignal): Promise<number> {
    const replay = await this.getEvents(responseId, 0, 1, signal);

    return replay.snapshot?.cursor ?? replay.next_cursor;
  }

  async getEvents(
    responseId: string,
    after: number,
    limit = 100,
    signal?: AbortSignal,
  ): Promise<AppResponseReplayResponse> {
    const query = new URLSearchParams({ after: String(after), limit: String(limit) });
    const response = await fetchApiOrThrow(
      `/responses/${encodeURIComponent(responseId)}/events?${query.toString()}`,
      { method: "GET", headers: await this.getHeaders(), signal },
    );
    const parsed = responseReplayResponseSchema.parse(await returnFetchedData<unknown>(response));

    return {
      ...parsed,
      snapshot: parsed.snapshot ? toSnapshot(parsed.snapshot) : null,
    };
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<PlatformResponse> {
    const query = new URLSearchParams({ idempotency_key: idempotencyKey });
    const response = await fetchApiOrThrow(`/responses?${query.toString()}`, {
      method: "GET",
      headers: await this.getHeaders(),
    });

    return responseSchema.parse(await returnFetchedData<unknown>(response));
  }

  async cancel(
    responseId: string,
    expectedAttempt: number,
    idempotencyKey: string = generateId(),
  ): Promise<PlatformResponse> {
    const response = await fetchApiOrThrow(`/responses/${encodeURIComponent(responseId)}/cancel`, {
      method: "POST",
      headers: { ...(await this.getHeaders()), "X-Platform": "web" },
      body: { idempotency_key: idempotencyKey, expected_attempt: expectedAttempt },
    });

    return responseSchema.parse(await returnFetchedData<unknown>(response));
  }

  async submitInput(responseId: string, input: ResponseInputRequest): Promise<unknown> {
    const response = await fetchApiOrThrow(`/responses/${encodeURIComponent(responseId)}/input`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: input,
    });

    return returnFetchedData<unknown>(response);
  }

  private async consume(
    response: Response,
    model: string | undefined,
    onProgress: StreamProgressHandler,
    onStateChange: (state: string, data?: any) => void,
  ): Promise<Message> {
    const isStreamingResponse = response.headers.get("content-type")?.includes("text/event-stream");

    if (!isStreamingResponse) {
      const data = await returnFetchedData<unknown>(response);

      if (isRecord(data) && "error" in data) {
        const error = data.error;

        throw new Error(
          isRecord(error) && typeof error.message === "string" ? error.message : "Unknown error",
        );
      }

      const parsed = responseSchema.parse(data);
      const { assistant, toolResponses, compaction } = toResponseAppMessages(parsed, model);
      const compactionMessage = readCompactionStatusMessage(compaction);

      if (compactionMessage) {
        onStateChange("compaction", { message: compactionMessage });
      }

      onStateChange("response", parsed);

      if (toolResponses.length > 0) {
        onProgress("", "", toolResponses);
      }

      return assistant;
    }

    const decoder = new TextDecoder();
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("Response body is not readable as a stream");
    }

    let buffer = "";
    let lastAssistantMessage: Message | undefined;
    const assembler = createResponseStreamAssembler({ model });

    const handleUpdate = (update: ResponseStreamUpdate) => {
      switch (update.type) {
        case "response":
          onStateChange("response", update.response);

          return;
        case "assistant_metadata":
          onProgress(
            typeof update.message.content === "string" ? update.message.content : "",
            update.message.reasoning?.content,
            undefined,
            false,
            toAppMessage(update.message),
          );

          return;
        case "assistant_delta":
          onProgress(update.content, update.reasoning, undefined, false);

          return;
        case "assistant_final":
          lastAssistantMessage = toAppMessage(update.message);
          onProgress(
            getMessageTextContent(lastAssistantMessage),
            lastAssistantMessage.reasoning?.content,
            undefined,
            true,
            lastAssistantMessage,
          );

          return;
        case "tool_result":
          onProgress("", "", [toAppMessage(update.message)]);

          return;
        case "tool_call_started":
          onStateChange("tool_use_start", {
            tool_id: update.toolCallId,
            tool_name: update.toolName,
          });

          return;
        case "tool_call_finished":
          onStateChange("tool_use_stop", { tool_id: update.toolCallId });

          return;
        case "activity":
          onStateChange("turn_activity", update.activity);

          return;
        case "usage_limits":
          onStateChange("usage_limits", update.usageLimits);

          return;
        case "usage":
          onStateChange("usage", { usage: update.usage });

          return;
        case "error":
          throw createStreamingApiError(update.error, update.code);
        case "state":
          onStateChange(update.state, update.event);

          return;
        case "done":
          if (update.message) {
            lastAssistantMessage = toAppMessage(update.message);
          }

          return;
      }
    };

    const processBufferedEvents = async (flush = false) => {
      const parsed = parseResponseStreamSseBuffer(buffer, { flush });

      buffer = parsed.remainingBuffer;
      let progressEventsSinceYield = 0;

      for (const parsedData of parsed.events) {
        try {
          for (const update of assembler.ingest(parsedData)) {
            handleUpdate(update);
          }
        } catch (error) {
          if (error instanceof ApiError) {
            throw error;
          }

          console.error("Error handling response stream event:", error, parsedData);
        }

        if (!isResponseStreamProgressEvent(parsedData)) {
          progressEventsSinceYield = 0;
          continue;
        }

        progressEventsSinceYield += 1;

        if (progressEventsSinceYield >= RESPONSE_STREAM_PROGRESS_BATCH_EVENTS) {
          progressEventsSinceYield = 0;
          await yieldToMainThread();
        }
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        await processBufferedEvents();
      }

      if (buffer.trim()) {
        await processBufferedEvents(true);
      }

      if (!assembler.getFinalMessage()) {
        for (const update of assembler.ingest({ type: "done" })) {
          handleUpdate(update);
        }
      }
    } catch (error) {
      console.error("Error reading response stream:", error);
      if (error instanceof Error && error.name !== "AbortError") {
        throw error;
      }
    } finally {
      reader.releaseLock();
    }

    const finalStreamMessage = assembler.getFinalMessage();

    return (
      lastAssistantMessage ||
      (finalStreamMessage
        ? toAppMessage(finalStreamMessage)
        : toAppMessage({ role: "assistant", content: "", id: generateId(), model }))
    );
  }
}

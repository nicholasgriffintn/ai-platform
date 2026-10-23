import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  A2A_ERRORS,
  a2aSendMessageParamsSchema,
  a2aTaskIdParamsSchema,
  isTerminalResponseStatus,
  JSON_RPC_ERRORS,
  jsonRpcRequestSchema,
  type A2aMessage,
  type A2aPart,
  type A2aSendMessageParams,
  type JsonRpcResponse,
  type PlatformResponse,
} from "@ngriffin_uk/polychat-schemas";
import { encodeServerSentEvent, readServerSentEvents } from "@ngriffin_uk/polychat-utility-core";
import {
  dispatchJsonRpc,
  jsonRpcErrorResponse,
  JsonRpcError,
  type JsonRpcHandlers,
} from "@ngriffin_uk/polychat-utility-server/json-rpc";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { sseResponse } from "~/infrastructure/http/streaming";
import {
  cancelExternalTeammateResponse,
  followUpExternalTeammateResponse,
  readExternalTeammateResponse,
  startExternalTeammateResponse,
  teammateHomeConversationId,
} from "~/modules/teammates/application/external-runs";

import { createA2aStreamProjection, toA2aTask } from "./tasks";

const MAX_MESSAGE_CHARS = 8_000;
const A2A_PLATFORM = "a2a";
const MAX_IDEMPOTENCY_KEY_CHARS = 200;

export interface A2aRequestInput {
  context: ServiceContext;
  teammateId: string;
  payload: unknown;
  executionCtx?: ExecutionContext;
  signal?: AbortSignal;
}

function partText(part: A2aPart): string {
  if (part.kind === "text") {
    return part.text;
  }

  if (part.kind === "data") {
    return JSON.stringify(part.data);
  }

  throw new JsonRpcError(
    A2A_ERRORS.contentTypeNotSupported,
    "Polychat teammates accept text and data parts, not files",
  );
}

export function readA2aMessageText(message: A2aMessage): string {
  if (message.role !== "user") {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, "Send messages with the user role");
  }

  const text = message.parts.map(partText).join("\n\n").trim();

  if (!text) {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, "The message has no text");
  }

  if (text.length > MAX_MESSAGE_CHARS) {
    throw new JsonRpcError(
      JSON_RPC_ERRORS.invalidParams,
      `Keep messages under ${MAX_MESSAGE_CHARS} characters`,
    );
  }

  return text;
}

function readSendParams(params: unknown): A2aSendMessageParams {
  const parsed = a2aSendMessageParamsSchema.safeParse(params);

  if (!parsed.success) {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, "Send a message");
  }

  return parsed.data;
}

function readTaskId(params: unknown): string {
  const parsed = a2aTaskIdParamsSchema.safeParse(params);

  if (!parsed.success) {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, "Name the task by its id");
  }

  return parsed.data.id;
}

async function requireTask(input: A2aRequestInput, taskId: string): Promise<PlatformResponse> {
  const response = await readExternalTeammateResponse(input.context, input.teammateId, taskId);

  if (!response) {
    throw new JsonRpcError(A2A_ERRORS.taskNotFound, "No task with that id for this teammate");
  }

  return response;
}

async function requireContext(input: A2aRequestInput, contextId: string | undefined) {
  if (!contextId) {
    return;
  }

  if (contextId !== (await teammateHomeConversationId(input.context, input.teammateId))) {
    throw new JsonRpcError(
      JSON_RPC_ERRORS.invalidParams,
      "Each teammate keeps one context; leave contextId out or use the one it returned",
    );
  }
}

function taskIdempotencyKey(teammateId: string, messageId: string): string | undefined {
  const key = `a2a:${teammateId}:${messageId}`;

  return key.length <= MAX_IDEMPOTENCY_KEY_CHARS ? key : undefined;
}

async function startTask(input: A2aRequestInput, params: A2aSendMessageParams, stream: boolean) {
  await requireContext(input, params.message.contextId);

  return startExternalTeammateResponse(input.context, {
    teammateId: input.teammateId,
    text: readA2aMessageText(params.message),
    idempotencyKey: taskIdempotencyKey(input.teammateId, params.message.messageId),
    stream,
    background: !stream && params.configuration?.blocking === false,
    platform: A2A_PLATFORM,
    executionCtx: input.executionCtx,
    signal: input.signal,
  });
}

async function sendMessage(input: A2aRequestInput, rawParams: unknown) {
  const params = readSendParams(rawParams);

  if (params.message.taskId) {
    const task = await requireTask(input, params.message.taskId);

    await followUpExternalTeammateResponse(
      input.context,
      task,
      readA2aMessageText(params.message),
      A2A_PLATFORM,
    );

    return toA2aTask(await requireTask(input, task.id));
  }

  const result = await startTask(input, params, false);

  if (result instanceof Response) {
    throw new JsonRpcError(JSON_RPC_ERRORS.internal, "The teammate answered with a stream");
  }

  return toA2aTask(result);
}

async function cancelTask(input: A2aRequestInput, rawParams: unknown) {
  const task = await requireTask(input, readTaskId(rawParams));

  if (isTerminalResponseStatus(task.status)) {
    throw new JsonRpcError(A2A_ERRORS.taskNotCancelable, "That task has already finished");
  }

  return toA2aTask(await cancelExternalTeammateResponse(input.context, task, A2A_PLATFORM));
}

function unsupported(message: string) {
  return () => {
    throw new JsonRpcError(A2A_ERRORS.unsupportedOperation, message);
  };
}

function noPushNotifications() {
  throw new JsonRpcError(
    A2A_ERRORS.pushNotificationNotSupported,
    "Polychat teammates do not send push notifications; poll tasks/get or stream with message/stream",
  );
}

function a2aHandlers(input: A2aRequestInput): JsonRpcHandlers {
  return {
    "message/send": (params) => sendMessage(input, params),
    "tasks/get": async (params) => toA2aTask(await requireTask(input, readTaskId(params))),
    "tasks/cancel": (params) => cancelTask(input, params),
    "tasks/resubscribe": unsupported(
      "Polychat streams a task while it starts; poll tasks/get to follow one already running",
    ),
    "tasks/pushNotificationConfig/set": noPushNotifications,
    "tasks/pushNotificationConfig/get": noPushNotifications,
    "tasks/pushNotificationConfig/list": noPushNotifications,
    "tasks/pushNotificationConfig/delete": noPushNotifications,
  };
}

function streamTask(id: JsonRpcResponse["id"], source: Response): Response {
  const body = source.body;
  const projection = createA2aStreamProjection();
  const send = (controller: ReadableStreamDefaultController<Uint8Array>, result: unknown) =>
    controller.enqueue(encodeServerSentEvent({ jsonrpc: "2.0", id, result }));

  return sseResponse(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (body) {
            await readServerSentEvents(body, {
              onEvent: (event) => {
                for (const result of projection.project(event)) {
                  send(controller, result);
                }
              },
            });
          }
        } catch {
          controller.enqueue(
            encodeServerSentEvent({
              jsonrpc: "2.0",
              id,
              error: { code: JSON_RPC_ERRORS.internal, message: "The task stream stopped" },
            }),
          );
        } finally {
          controller.close();
        }
      },
    }),
  );
}

async function streamMessage(
  input: A2aRequestInput,
  id: JsonRpcResponse["id"],
  rawParams: unknown,
): Promise<JsonRpcResponse | Response> {
  try {
    const params = readSendParams(rawParams);

    if (params.message.taskId) {
      throw new JsonRpcError(
        JSON_RPC_ERRORS.invalidParams,
        "Follow up on a task with message/send",
      );
    }

    const result = await startTask(input, params, true);

    return result instanceof Response
      ? streamTask(id, result)
      : { jsonrpc: "2.0", id, result: toA2aTask(result) };
  } catch (error) {
    return jsonRpcErrorResponse(id, error);
  }
}

export async function handleA2aRequest(
  input: A2aRequestInput,
): Promise<JsonRpcResponse | Response | null> {
  const request = jsonRpcRequestSchema.safeParse(input.payload);

  if (request.success && request.data.method === "message/stream" && request.data.id != null) {
    return streamMessage(input, request.data.id, request.data.params);
  }

  return dispatchJsonRpc(input.payload, a2aHandlers(input));
}

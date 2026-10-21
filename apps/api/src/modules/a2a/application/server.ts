import {
  A2A_ERRORS,
  a2aSendMessageParamsSchema,
  jsonRpcRequestSchema,
  type A2aMessage,
  type A2aPart,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import {
  dispatchJsonRpc,
  JSON_RPC_ERRORS,
  JsonRpcError,
  type JsonRpcResponse,
} from "~/modules/mcp/application/protocol";
import type { ExternalTeammateReply } from "~/modules/teammates/application/external-message";

const MAX_MESSAGE_CHARS = 8_000;

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

function readSendParams(params: unknown) {
  const parsed = a2aSendMessageParamsSchema.safeParse(params);

  if (!parsed.success) {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, "message/send needs a message");
  }

  return parsed.data;
}

export async function handleA2aMessage(
  message: unknown,
  deliver: (text: string) => Promise<ExternalTeammateReply>,
): Promise<JsonRpcResponse | null> {
  const request = jsonRpcRequestSchema.safeParse(message);

  if (!request.success) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: JSON_RPC_ERRORS.invalidRequest, message: "Expected a JSON-RPC 2.0 request" },
    };
  }

  const unsupported = () => {
    throw new JsonRpcError(
      A2A_ERRORS.unsupportedOperation,
      "Polychat teammates answer message/send only; replies arrive in one message",
    );
  };

  const noTasks = () => {
    throw new JsonRpcError(A2A_ERRORS.taskNotFound, "Polychat teammates do not keep A2A tasks");
  };

  return dispatchJsonRpc(request.data, {
    "message/send": async (params) => {
      const send = readSendParams(params);
      const reply = await deliver(readA2aMessageText(send.message));

      return {
        kind: "message",
        messageId: generateId(),
        role: "agent",
        parts: [{ kind: "text", text: reply.text }],
        contextId: reply.conversationId,
      };
    },
    "message/stream": unsupported,
    "tasks/resubscribe": unsupported,
    "tasks/pushNotificationConfig/set": unsupported,
    "tasks/get": noTasks,
    "tasks/cancel": noTasks,
  });
}

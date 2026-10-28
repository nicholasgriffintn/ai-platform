import {
  CLAUDE_CODE_COMMAND_TOOLS,
  CLAUDE_CODE_FILE_TOOLS,
  CLAUDE_CODE_PERMISSION_MODES,
  claudeCodeInitializeResponseSchema,
  claudeCodeMessageSchema,
  REASONING_EFFORT_LEVELS,
  sessionAgentCapabilities,
  type AgentApproval,
  type AgentApprovalDecision,
  type AgentItem,
  type AgentModel,
  type AgentSessionEvent,
  type AgentTokenUsage,
  type ClaudeCodeInitializeResponse,
  type ClaudeCodeMessage,
  type PermissionMode,
  type ReasoningEffort,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, isOneOf, safeParseJson } from "@ngriffin_uk/polychat-utility-core";

import type { AgentSessionAdapter } from "./codex-adapter.js";
import type { JsonRpcTransport } from "./jsonrpc.js";

export interface ClaudeCodeAdapterOptions {
  transport: JsonRpcTransport;
  emit: (event: AgentSessionEvent) => void;
  sessionId: string;
  now?: () => string;
  requestTimeoutMs?: number;
}

type ControlRequest = Extract<ClaudeCodeMessage, { type: "control_request" }>;
type ContentBlocks = Extract<ClaudeCodeMessage, { type: "assistant" }>["message"]["content"];

interface PendingControl {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface PendingPermission {
  input: Record<string, unknown>;
  suggestions: unknown[];
}

const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
const DETAIL_LIMIT = 8000;
const OUTPUT_LIMIT = 20_000;

function toolResultText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === "object" && "text" in part && typeof part.text === "string"
          ? part.text
          : "",
      )
      .join("");
  }

  return "";
}

function describeToolInput(input: Record<string, unknown>): string | null {
  const text = JSON.stringify(input);

  return text === "{}" ? null : text.slice(0, DETAIL_LIMIT);
}

function itemFor(id: string, name: string, input: Record<string, unknown>): AgentItem {
  if (isOneOf(CLAUDE_CODE_COMMAND_TOOLS, name)) {
    return {
      id,
      status: "running",
      body: {
        kind: "command",
        command: typeof input.command === "string" ? input.command : "",
        output: "",
        exitCode: null,
      },
    };
  }

  if (isOneOf(CLAUDE_CODE_FILE_TOOLS, name)) {
    const path = input.file_path ?? input.notebook_path;

    return {
      id,
      status: "running",
      body: { kind: "file_change", paths: typeof path === "string" ? [path] : [], diff: null },
    };
  }

  return { id, status: "running", body: { kind: "tool", name, detail: describeToolInput(input) } };
}

function completedItem(item: AgentItem, output: string, failed: boolean): AgentItem {
  const status = failed ? "failed" : "completed";

  if (item.body.kind === "command") {
    return {
      ...item,
      status,
      body: { ...item.body, output: output.slice(0, OUTPUT_LIMIT), exitCode: failed ? 1 : 0 },
    };
  }

  return { ...item, status };
}

function readUsage(
  usage: Extract<ClaudeCodeMessage, { type: "result" }>["usage"],
): AgentTokenUsage | null {
  return usage
    ? {
        inputTokens: usage.input_tokens ?? 0,
        cachedInputTokens: usage.cache_read_input_tokens ?? 0,
        cacheWriteInputTokens: usage.cache_creation_input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        reasoningOutputTokens: 0,
      }
    : null;
}

function readModels(response: ClaudeCodeInitializeResponse): AgentModel[] {
  return response.models.map((model) => ({
    id: model.value,
    displayName: model.displayName,
    description: model.description?.slice(0, 400) ?? null,
    isDefault: model.value === "default",
    legacy: false,
    reasoningEfforts: (model.supportedEffortLevels ?? []).filter(
      (level): level is ReasoningEffort => isOneOf(REASONING_EFFORT_LEVELS, level),
    ),
    defaultReasoningEffort: null,
  }));
}

function approvalFor(
  request: ControlRequest,
  threadId: string,
  requestedAt: string,
): AgentApproval {
  const name = request.request.tool_name ?? "a tool";
  const input = request.request.input ?? {};
  const command = isOneOf(CLAUDE_CODE_COMMAND_TOOLS, name) && typeof input.command === "string";
  const suggestions = request.request.permission_suggestions ?? [];

  return {
    requestId: request.request_id,
    threadId,
    kind: command
      ? "command_execution"
      : isOneOf(CLAUDE_CODE_FILE_TOOLS, name)
        ? "file_change"
        : "permissions",
    title: (
      request.request.title ?? `Claude wants to use ${request.request.display_name ?? name}`
    ).slice(0, 200),
    detail:
      (
        request.request.description ??
        request.request.decision_reason ??
        describeToolInput(input)
      )?.slice(0, DETAIL_LIMIT) ?? null,
    command: command ? String(input.command).slice(0, 4000) : null,
    cwd: request.request.blocked_path?.slice(0, 1000) ?? null,
    decisions:
      suggestions.length > 0
        ? ["accept", "accept_for_session", "decline", "cancel"]
        : ["accept", "decline", "cancel"],
    requestedAt,
  };
}

function permissionResponse(decision: AgentApprovalDecision, pending: PendingPermission) {
  switch (decision) {
    case "accept":
      return { behavior: "allow", updatedInput: pending.input };
    case "accept_for_session":
      return {
        behavior: "allow",
        updatedInput: pending.input,
        updatedPermissions: pending.suggestions,
      };
    case "decline":
      return { behavior: "deny", message: "The person declined this." };
    case "cancel":
      return { behavior: "deny", message: "The person stopped this turn.", interrupt: true };
  }
}

export function createClaudeCodeAdapter(options: ClaudeCodeAdapterOptions): AgentSessionAdapter {
  const now = options.now ?? (() => new Date().toISOString());
  const timeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const controls = new Map<string, PendingControl>();
  const permissions = new Map<string, PendingPermission>();
  const items = new Map<string, AgentItem>();
  let initialised: Promise<ClaudeCodeInitializeResponse> | null = null;
  let turnId: string | null = null;
  let closed = false;

  const write = (message: unknown) => options.transport.send(JSON.stringify(message));

  const control = (request: Record<string, unknown>): Promise<unknown> => {
    if (closed) {
      return Promise.reject(new Error("Claude Code has stopped."));
    }

    const requestId = generateId();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        controls.delete(requestId);
        reject(new Error(`Claude Code did not answer ${String(request.subtype)}.`));
      }, timeoutMs);

      controls.set(requestId, { resolve, reject, timer });
      write({ type: "control_request", request_id: requestId, request }).catch((cause: unknown) => {
        clearTimeout(timer);
        controls.delete(requestId);
        reject(cause instanceof Error ? cause : new Error(String(cause)));
      });
    });
  };

  const initialise = (): Promise<ClaudeCodeInitializeResponse> => {
    initialised ??= control({ subtype: "initialize", hooks: null }).then((response) =>
      claudeCodeInitializeResponseSchema.parse(response ?? {}),
    );

    return initialised;
  };

  const configure = async (input: { permissionMode: PermissionMode; model: string | null }) => {
    await initialise();
    await control({
      subtype: "set_permission_mode",
      mode: CLAUDE_CODE_PERMISSION_MODES[input.permissionMode],
    });

    if (input.model) {
      await control({ subtype: "set_model", model: input.model });
    }
  };

  const finishItems = (blocks: ContentBlocks | string) => {
    if (typeof blocks === "string") {
      return;
    }

    for (const block of blocks) {
      if (block.type !== "tool_result" || !("tool_use_id" in block)) {
        continue;
      }

      const item = items.get(block.tool_use_id);

      if (item) {
        items.delete(block.tool_use_id);
        options.emit({
          type: "item.updated",
          item: completedItem(item, toolResultText(block.content), block.is_error === true),
        });
      }
    }
  };

  const startItems = (blocks: ContentBlocks) => {
    for (const block of blocks) {
      if (block.type === "tool_use" && "id" in block && "name" in block && "input" in block) {
        const item = itemFor(block.id, block.name, block.input);

        items.set(block.id, item);
        options.emit({ type: "item.updated", item });
      }
    }
  };

  const handle = (message: ClaudeCodeMessage) => {
    switch (message.type) {
      case "system":
        if (message.subtype === "init") {
          options.emit({
            type: "thread.started",
            threadId: message.session_id ?? options.sessionId,
            model: message.model ?? null,
          });
        }

        break;
      case "stream_event": {
        const delta = message.event.delta;

        if (message.parent_tool_use_id || message.event.type !== "content_block_delta" || !delta) {
          break;
        }

        if (delta.type === "text_delta" && delta.text) {
          options.emit({ type: "message.delta", delta: delta.text });
        } else if (delta.type === "thinking_delta" && delta.thinking) {
          options.emit({ type: "reasoning.delta", delta: delta.thinking });
        }

        break;
      }

      case "assistant":
        startItems(message.message.content);
        break;
      case "user":
        finishItems(message.message.content);
        break;
      case "result": {
        const usage = readUsage(message.usage);

        if (usage) {
          options.emit({ type: "usage.updated", usage });
        }

        if (message.is_error || message.subtype !== "success") {
          options.emit({
            type: "turn.failed",
            message: (message.result ?? "Claude Code stopped before finishing.").slice(0, 2000),
          });
        } else {
          options.emit({ type: "turn.completed", turnId: turnId ?? generateId(), usage });
        }

        turnId = null;
        break;
      }

      case "control_request":
        if (message.request.subtype !== "can_use_tool") {
          void write({
            type: "control_response",
            response: {
              subtype: "error",
              request_id: message.request_id,
              error: `Polychat cannot answer ${message.request.subtype}.`,
            },
          });
          break;
        }

        permissions.set(message.request_id, {
          input: message.request.input ?? {},
          suggestions: message.request.permission_suggestions ?? [],
        });
        options.emit({
          type: "approval.requested",
          approval: approvalFor(message, options.sessionId, now()),
        });
        break;
      case "control_response": {
        const pending = controls.get(message.response.request_id);

        if (!pending) {
          break;
        }

        clearTimeout(pending.timer);
        controls.delete(message.response.request_id);

        if (message.response.subtype === "success") {
          pending.resolve(message.response.response);
        } else {
          pending.reject(new Error(message.response.error ?? "Claude Code refused the request."));
        }

        break;
      }

      case "control_cancel_request":
        if (permissions.delete(message.request_id)) {
          options.emit({ type: "approval.resolved", requestId: message.request_id });
        }

        break;
    }
  };

  return {
    capabilities: {
      ...sessionAgentCapabilities(),
      reportsDiffs: false,
      rollsBack: false,
    },

    async listModels() {
      return readModels(await initialise());
    },

    async startThread(input) {
      await configure(input);

      return options.sessionId;
    },

    async resumeThread(threadId, input) {
      if (threadId !== options.sessionId) {
        throw new Error("Claude Code resumed a different session than this conversation owns.");
      }

      await configure(input);

      return threadId;
    },

    async sendTurn(_threadId, prompt) {
      await initialise();
      turnId = generateId();
      options.emit({ type: "turn.started", turnId });
      await write({ type: "user", message: { role: "user", content: prompt } });
    },

    async interrupt() {
      await control({ subtype: "interrupt" });
    },

    async answerApproval(requestId, decision) {
      const pending = permissions.get(requestId);

      if (!pending) {
        throw new Error("That approval is no longer waiting for an answer.");
      }

      permissions.delete(requestId);
      await write({
        type: "control_response",
        response: {
          subtype: "success",
          request_id: requestId,
          response: permissionResponse(decision, pending),
        },
      });
      options.emit({ type: "approval.resolved", requestId });
    },

    receive(line) {
      const parsed = claudeCodeMessageSchema.safeParse(safeParseJson(line));

      if (parsed.success) {
        handle(parsed.data);
      }
    },

    close(reason) {
      closed = true;
      for (const pending of controls.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error(reason));
      }

      controls.clear();
      permissions.clear();
      options.emit({ type: "session.exited", reason });
    },
  };
}

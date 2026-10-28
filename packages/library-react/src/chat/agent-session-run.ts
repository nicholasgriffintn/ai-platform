import type { DesktopBackend } from "@ngriffin_uk/polychat-library-chat";
import {
  agentRuntimeVendorSchema,
  type AgentApproval,
  type AgentApprovalDecision,
  type AgentItem,
  type AgentThreadBinding,
  type AgentTokenUsage,
  type AgentTurnChanges,
  type PermissionMode,
  type ReasoningEffort,
} from "@ngriffin_uk/polychat-schemas";
import { reverseCopy } from "@ngriffin_uk/polychat-utility-core";

export { AgentSessionUnavailableError } from "./agent-session-host.js";

import { toRunMessages } from "../lib/run-messages.js";
import { AgentSessionUnavailableError, agentSessions } from "./agent-session-host.js";
import type { DeviceModelRunOptions } from "./device-run.js";

export interface AgentSessionRunOptions extends Omit<DeviceModelRunOptions, "backend"> {
  backend: SessionBackend;
  permissionMode: PermissionMode;
  reasoningEffort: ReasoningEffort | null;
  selectedModel: string | null;
  sessionContinuation?: {
    mode: "resume" | "fresh";
    bindingConversationId: string;
    requireBinding: boolean;
  };
  defaultDirectoryId?: string | null;
  isolation?: { mcpConfig: string | null };
  clientVersion?: string;
  onStatus: (message: string) => void;
  onItem?: (item: AgentItem) => void;
  onReasoning?: (delta: string) => void;
  onPlan?: (text: string) => void;
  onDiff?: (diff: string) => void;
  onChanges?: (changes: AgentTurnChanges) => void;
  onUsage?: (usage: AgentTokenUsage) => void;
  onDiagnostic?: (message: string) => void;
  onApproval?: (
    approval: AgentApproval,
    answer: (decision: AgentApprovalDecision) => Promise<void>,
  ) => void;
  onApprovalResolved?: (requestId: string) => void;
}

export type SessionBackend = Pick<
  DesktopBackend,
  | "agentSupportsSessions"
  | "startAgentSession"
  | "readAgentThread"
  | "saveAgentThread"
  | "pickAgentDirectory"
  | "saveAgentDirectory"
  | "probeAgentTool"
  | "snapshotAgentWorkspace"
  | "agentTurnChanges"
>;

function sessionStartsWithProcess(driver: AgentThreadBinding["driver"]): boolean {
  return driver === "claude-code";
}

function turnPrompt(messages: DeviceModelRunOptions["messages"], resumed: boolean): string {
  const runMessages = toRunMessages(messages);
  const latest = reverseCopy(runMessages).find((message) => message.role === "user");

  return resumed && latest
    ? latest.content
    : runMessages.map((message) => message.content).join("\n\n");
}

function isAgentThreadBindingCompatible(
  binding: AgentThreadBinding | null,
  params: {
    conversationId: string;
    driver: AgentThreadBinding["driver"];
    model: string | null;
    permissionMode: PermissionMode;
  },
): binding is AgentThreadBinding {
  return Boolean(
    binding &&
    binding.conversationId === params.conversationId &&
    binding.driver === params.driver &&
    binding.model === params.model &&
    binding.permissionMode === params.permissionMode,
  );
}

async function resolveDirectoryId(
  backend: SessionBackend,
  binding: AgentThreadBinding | null,
  onStatus: (message: string) => void,
  modelName: string,
  defaultDirectoryId: string | null,
): Promise<string> {
  if (binding) {
    return binding.directoryId;
  }

  if (defaultDirectoryId) {
    return defaultDirectoryId;
  }

  onStatus(`Choose the project folder where ${modelName} should work with your files.`);
  const path = await backend.pickAgentDirectory();

  if (!path) {
    throw new Error("Choose a working folder to start the agent.");
  }

  return (await backend.saveAgentDirectory(path)).id;
}

function snapshotWorkspace(
  options: AgentSessionRunOptions,
  directoryId: string,
): Promise<string | null> {
  return options.onChanges
    ? options.backend.snapshotAgentWorkspace(directoryId, options.conversationId).catch(() => null)
    : Promise.resolve(null);
}

async function reportTurnChanges(
  options: AgentSessionRunOptions,
  directoryId: string,
  before: string | null,
): Promise<void> {
  const after = before ? await snapshotWorkspace(options, directoryId) : null;

  if (!before || !after || before === after) {
    return;
  }

  const changes = await options.backend
    .agentTurnChanges(directoryId, options.conversationId, before, after)
    .catch(() => null);

  if (changes && changes.files.length > 0) {
    options.onChanges?.(changes);
  }
}

export async function streamAgentSessionRun(options: AgentSessionRunOptions): Promise<string> {
  const driver = agentRuntimeVendorSchema.parse(options.model.matchingModel);
  const modelName = options.model.name ?? driver;
  const probe = await options.backend.probeAgentTool(driver);

  if (probe.state !== "ready") {
    throw new Error(`Configure and sign in to ${modelName} before sending.`);
  }

  if (!(await options.backend.agentSupportsSessions(driver))) {
    throw new AgentSessionUnavailableError(modelName);
  }

  options.signal.throwIfAborted();
  const bindingConversationId =
    options.sessionContinuation?.bindingConversationId ?? options.conversationId;
  const stored = await options.backend.readAgentThread(bindingConversationId);
  const directoryBinding = stored?.conversationId === bindingConversationId ? stored : null;
  const resumableBinding = isAgentThreadBindingCompatible(stored, {
    conversationId: bindingConversationId,
    driver,
    model: options.selectedModel,
    permissionMode: options.permissionMode,
  })
    ? stored
    : null;

  if (options.sessionContinuation?.requireBinding && !directoryBinding) {
    throw new Error("The native workspace binding is unavailable.");
  }

  if (
    options.sessionContinuation?.mode === "resume" &&
    options.sessionContinuation.requireBinding &&
    !resumableBinding
  ) {
    throw new Error("The native session binding is no longer compatible.");
  }

  const directoryId = await resolveDirectoryId(
    options.backend,
    directoryBinding,
    options.onStatus,
    modelName,
    options.defaultDirectoryId ?? null,
  );

  options.signal.throwIfAborted();
  let threadId =
    options.sessionContinuation?.mode === "fresh" ? null : (resumableBinding?.threadId ?? null);
  const resumed = threadId !== null;
  const host = await agentSessions.acquire(
    options.backend,
    {
      conversationId: options.conversationId,
      driver,
      directoryId,
      worktree: !options.isolation,
      ...(sessionStartsWithProcess(driver)
        ? {
            session: {
              sessionId: threadId ?? crypto.randomUUID(),
              resume: resumed,
              ...(options.isolation
                ? {
                    isolated: true,
                    sandboxed: options.permissionMode === "auto_accept_edits",
                    mcpConfig: options.isolation.mcpConfig,
                  }
                : {}),
            },
          }
        : {}),
    },
    options.clientVersion,
  );

  let text = "";
  let failure: string | null = null;
  let settled = false;
  let resolveTurn: (() => void) | undefined;
  const turnSettled = new Promise<void>((resolve) => {
    resolveTurn = resolve;
  });

  const settle = (reason?: string) => {
    if (settled) {
      return;
    }

    settled = true;
    failure = reason ?? failure;
    resolveTurn?.();
  };

  const stopListening = host.listen((event) => {
    switch (event.type) {
      case "thread.started":
        threadId = event.threadId;
        break;
      case "turn.started":
        break;
      case "message.delta":
        text += event.delta;
        options.onContent(text);
        break;
      case "reasoning.delta":
        options.onReasoning?.(event.delta);
        break;
      case "plan.updated":
        options.onPlan?.(event.text);
        break;
      case "item.updated":
        options.onItem?.(event.item);
        break;
      case "diff.updated":
        options.onDiff?.(event.diff);
        break;
      case "usage.updated":
        options.onUsage?.(event.usage);
        break;
      case "diagnostic":
        options.onDiagnostic?.(event.message);
        break;
      case "approval.resolved":
        options.onApprovalResolved?.(event.requestId);
        break;
      case "approval.requested":
        options.onApproval?.(event.approval, (decision) =>
          host.adapter.answerApproval(event.approval.requestId, decision),
        );
        break;
      case "turn.completed":
        settle();
        break;
      case "turn.failed":
        settle(event.message);
        break;
      case "session.exited":
        settle(event.reason);
        break;
      default:
        break;
    }
  });

  const abort = () => {
    if (threadId) {
      void host.adapter.interrupt(threadId).catch(() => undefined);
    }

    settle("The turn was cancelled.");
  };

  options.signal.addEventListener("abort", abort, { once: true });

  try {
    const startInput = {
      cwd: host.directoryPath,
      permissionMode: options.permissionMode,
      model: options.selectedModel,
      reasoningEffort: options.reasoningEffort,
    };

    threadId = threadId
      ? await host.adapter.resumeThread(threadId, startInput)
      : await host.adapter.startThread(startInput);

    await options.backend.saveAgentThread({
      conversationId: options.conversationId,
      driver,
      directoryId,
      threadId,
      model: options.selectedModel,
      reasoningEffort: options.reasoningEffort,
      permissionMode: options.permissionMode,
      updatedAt: new Date().toISOString(),
    });

    options.onStatus(`${modelName} is working in ${host.directoryPath}.`);
    const before = await snapshotWorkspace(options, directoryId);

    await host.adapter.sendTurn(
      threadId,
      turnPrompt(options.messages, resumed),
      options.reasoningEffort,
    );

    await turnSettled;
    await reportTurnChanges(options, directoryId, before);

    if (failure) {
      throw new Error(failure);
    }

    return text;
  } finally {
    options.signal.removeEventListener("abort", abort);
    stopListening();
  }
}

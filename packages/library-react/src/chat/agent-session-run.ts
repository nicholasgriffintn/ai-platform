import type { DesktopBackend } from "@ngriffin_uk/polychat-library-chat";
import {
  agentRuntimeVendorSchema,
  type AgentApproval,
  type AgentApprovalDecision,
  type AgentItem,
  type AgentThreadBinding,
  type AgentTokenUsage,
  type PermissionMode,
  type ReasoningEffort,
} from "@ngriffin_uk/polychat-schemas";

export { AgentSessionUnavailableError } from "./agent-session-host.js";

import { toRunMessages } from "../lib/run-messages.js";
import { AgentSessionUnavailableError, agentSessions } from "./agent-session-host.js";
import type { DeviceModelRunOptions } from "./device-run.js";

export interface AgentSessionRunOptions extends DeviceModelRunOptions {
  permissionMode: PermissionMode;
  reasoningEffort: ReasoningEffort | null;
  selectedModel: string | null;
  sessionContinuation?: {
    mode: "resume" | "fresh";
    bindingConversationId: string;
    requireBinding: boolean;
  };
  clientVersion?: string;
  onStatus: (message: string) => void;
  onItem?: (item: AgentItem) => void;
  onReasoning?: (delta: string) => void;
  onPlan?: (text: string) => void;
  onDiff?: (diff: string) => void;
  onUsage?: (usage: AgentTokenUsage) => void;
  onDiagnostic?: (message: string) => void;
  onApproval?: (
    approval: AgentApproval,
    answer: (decision: AgentApprovalDecision) => Promise<void>,
  ) => void;
  onApprovalResolved?: (requestId: string) => void;
}

type SessionBackend = Pick<
  DesktopBackend,
  | "agentSupportsSessions"
  | "startAgentSession"
  | "readAgentThread"
  | "saveAgentThread"
  | "pickAgentDirectory"
  | "saveAgentDirectory"
  | "probeAgentTool"
>;

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
): Promise<string> {
  if (binding) {
    return binding.directoryId;
  }

  onStatus(`Choose the project folder where ${modelName} should work with your files.`);
  const path = await backend.pickAgentDirectory();

  if (!path) {
    throw new Error("Choose a working folder to start the agent.");
  }

  return (await backend.saveAgentDirectory(path)).id;
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
  );

  options.signal.throwIfAborted();
  const host = await agentSessions.acquire(
    options.backend,
    { conversationId: options.conversationId, driver, directoryId },
    options.clientVersion,
  );

  let text = "";
  let threadId =
    options.sessionContinuation?.mode === "fresh" ? null : (resumableBinding?.threadId ?? null);
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
    await host.adapter.sendTurn(
      threadId,
      toRunMessages(options.messages)
        .map((message) => message.content)
        .join("\n\n"),
      options.reasoningEffort,
    );

    await turnSettled;

    if (failure) {
      throw new Error(failure);
    }

    return text;
  } finally {
    options.signal.removeEventListener("abort", abort);
    stopListening();
  }
}

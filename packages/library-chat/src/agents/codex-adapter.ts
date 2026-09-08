import {
  CODEX_APPROVAL_METHODS,
  codexApprovalDecision,
  codexThreadConfig,
  readCodexApproval,
  readCodexModels,
  readCodexNotification,
  sessionAgentCapabilities,
  type AgentApprovalDecision,
  type AgentModel,
  type AgentSessionCapabilities,
  type AgentSessionEvent,
  type PermissionMode,
  type ReasoningEffort,
} from "@ngriffin_uk/polychat-schemas";

import { JsonRpcClient, type JsonRpcTransport } from "./jsonrpc.js";

export interface AgentSessionAdapter {
  readonly capabilities: AgentSessionCapabilities;
  listModels(): Promise<AgentModel[]>;
  startThread(input: StartThreadInput): Promise<string>;
  resumeThread(threadId: string, input: StartThreadInput): Promise<string>;
  sendTurn(threadId: string, prompt: string, effort: ReasoningEffort | null): Promise<void>;
  interrupt(threadId: string): Promise<void>;
  answerApproval(requestId: string, decision: AgentApprovalDecision): Promise<void>;
  receive(line: string): void;
  close(reason: string): void;
}

export interface StartThreadInput {
  cwd: string;
  permissionMode: PermissionMode;
  model: string | null;
  reasoningEffort: ReasoningEffort | null;
}

export interface CodexAdapterOptions {
  transport: JsonRpcTransport;
  emit: (event: AgentSessionEvent) => void;
  clientVersion?: string;
  now?: () => string;
}

const CLIENT_NAME = "polychat";
const CLIENT_TITLE = "Polychat";
const THREAD_SOURCE = "polychat";
const THREAD_START_SOURCE = "startup";

interface PendingApproval {
  id: string | number;
  method: string;
}

export function createCodexAdapter(options: CodexAdapterOptions): AgentSessionAdapter {
  const now = options.now ?? (() => new Date().toISOString());
  const pending = new Map<string, PendingApproval>();
  let initialised: Promise<void> | null = null;

  const client = new JsonRpcClient({
    transport: options.transport,
    onNotification: ({ method, params }) => {
      const event = readCodexNotification(method, params);

      if (event) {
        options.emit(event);
      }
    },
    onServerRequest: ({ id, method, params }) => {
      if (!CODEX_APPROVAL_METHODS.includes(method as (typeof CODEX_APPROVAL_METHODS)[number])) {
        void client.respondWithError(id, -32601, `Polychat cannot answer ${method}.`);

        return;
      }

      const approval = readCodexApproval(id, method, params, now());

      if (!approval) {
        void client.respondWithError(id, -32602, "Polychat could not read that approval request.");

        return;
      }

      pending.set(approval.requestId, { id, method });
      options.emit({ type: "approval.requested", approval });
    },
  });

  const initialise = async (): Promise<void> => {
    initialised ??= (async () => {
      await client.request("initialize", {
        clientInfo: {
          name: CLIENT_NAME,
          title: CLIENT_TITLE,
          ...(options.clientVersion ? { version: options.clientVersion } : {}),
        },
      });
      await client.notify("initialized", {});
    })();

    await initialised;
  };

  const threadParams = (input: StartThreadInput) => {
    const config = codexThreadConfig(input.permissionMode);

    return {
      cwd: input.cwd,
      approvalPolicy: config.approvalPolicy,
      sandbox: config.sandbox,
      approvalsReviewer: config.approvalsReviewer,
      threadSource: THREAD_SOURCE,
      sessionStartSource: THREAD_START_SOURCE,
      ...(input.model ? { model: input.model } : {}),
    };
  };

  const readThreadId = (result: unknown): string => {
    const thread = (result as { thread?: { id?: unknown } } | null)?.thread;

    if (!thread || typeof thread.id !== "string" || !thread.id) {
      throw new Error("Codex started a thread without an identifier.");
    }

    return thread.id;
  };

  return {
    capabilities: sessionAgentCapabilities(),

    async listModels() {
      await initialise();

      return readCodexModels(await client.request("model/list", {}));
    },

    async startThread(input) {
      await initialise();

      return readThreadId(await client.request("thread/start", threadParams(input)));
    },

    async resumeThread(threadId, input) {
      await initialise();
      const resumed = readThreadId(
        await client.request("thread/resume", { threadId, ...threadParams(input) }),
      );

      if (resumed !== threadId) {
        throw new Error("Codex resumed a different thread than the one this conversation owns.");
      }

      return resumed;
    },

    async sendTurn(threadId, prompt, effort) {
      await initialise();
      await client.request("turn/start", {
        threadId,
        input: [{ type: "text", text: prompt, text_elements: [] }],
        turnTrigger: THREAD_SOURCE,
        ...(effort ? { effort } : {}),
      });
    },

    async interrupt(threadId) {
      await client.request("turn/interrupt", { threadId });
    },

    async answerApproval(requestId, decision) {
      const request = pending.get(requestId);

      if (!request) {
        throw new Error("That approval is no longer waiting for an answer.");
      }

      pending.delete(requestId);
      await client.respond(request.id, { decision: codexApprovalDecision(decision) });
    },

    receive(line) {
      client.receive(line);
    },

    close(reason) {
      pending.clear();
      client.close(reason);
      options.emit({ type: "session.exited", reason });
    },
  };
}

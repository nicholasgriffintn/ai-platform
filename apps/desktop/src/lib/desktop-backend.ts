import {
  parseAgentProcessOutput,
  setDesktopExecutionBackend,
  type DesktopAgentSession,
  type DesktopBackend,
  type DesktopRun,
} from "@ngriffin_uk/polychat-library-chat";
import {
  desktopEndpointSchema,
  desktopRuntimeReadinessSchema,
  desktopSessionTokenSchema,
  desktopStreamEventSchema,
  agentDirectorySchema,
  agentThreadBindingSchema,
  agentToolStateSchema,
  discoveredModelSchema,
  localConversationSchema,
  localMessageSchema,
  type DesktopModelRunRequest,
  type DesktopAgentProcessRunRequest,
  type AgentRuntimeVendor,
  type AgentSessionEvent,
  type AgentThreadBinding,
  type DesktopSessionToken,
  type DesktopStreamEvent,
  type ModelRuntimeFailure,
  type AgentRuntimeFailure,
} from "@ngriffin_uk/polychat-schemas";
import { createAsyncEventQueue } from "@ngriffin_uk/polychat-utility-core";
import { Channel, invoke } from "@tauri-apps/api/core";
import z from "zod/v4";

import type { DesktopAnnouncement } from "./inbox-announcements";
import { notifyMachineEndpointsChanged } from "./machine-heartbeat-events";
import { describeRunFailure } from "./run-failures";

export const desktopDiagnosticsSchema = z.object({
  appVersion: z.string(),
  machineId: z.string().min(1),
  platform: z.enum(["macos", "windows", "linux"]),
  target: z.string(),
  apiBaseUrl: z.string(),
  databasePath: z.string(),
  endpointCount: z.number().int().nonnegative(),
  collectedAt: z.string(),
});

export type DesktopDiagnostics = z.infer<typeof desktopDiagnosticsSchema>;

export interface ConnectedDesktopBackend extends DesktopBackend {
  collectDiagnostics: () => Promise<DesktopDiagnostics>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  announceAttention: (scope: string, items: DesktopAnnouncement[]) => Promise<number>;
  setAttentionBadge: (count: number) => Promise<void>;
  isSignedIn: () => Promise<boolean>;
  accessToken: () => Promise<DesktopSessionToken>;
}

const sessionDescriptorSchema = z.object({
  sessionKey: z.string().min(1),
  directoryPath: z.string().min(1),
  head: z.string().nullable(),
  adopted: z.boolean(),
});

const sessionEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready"), sessionKey: z.string(), at: z.string() }),
  z.object({ type: z.literal("message"), sessionKey: z.string(), data: z.string() }),
  z.object({ type: z.literal("diagnostic"), sessionKey: z.string(), message: z.string() }),
  z.object({
    type: z.literal("exited"),
    sessionKey: z.string(),
    code: z.number().nullable(),
    at: z.string(),
  }),
]);

async function startAgentSession(
  driver: AgentRuntimeVendor,
  directoryId: string,
  conversationId: string,
): Promise<DesktopAgentSession> {
  const queue = createAsyncEventQueue<AgentSessionEvent>();
  const lines = createAsyncEventQueue<string>();
  const channel = new Channel();

  channel.onmessage = (raw) => {
    const event = sessionEventSchema.safeParse(raw);

    if (!event.success) {
      queue.push({ type: "diagnostic", message: "The desktop bridge sent an unreadable event." });

      return;
    }

    if (event.data.type === "message") {
      lines.push(event.data.data);

      return;
    }

    if (event.data.type === "diagnostic") {
      queue.push({ type: "diagnostic", message: event.data.message });

      return;
    }

    if (event.data.type === "exited") {
      queue.push({ type: "session.exited", reason: "The agent process stopped." });
      lines.close();
      queue.close();
    }
  };

  const descriptor = sessionDescriptorSchema.parse(
    await invoke("start_agent_session", {
      request: { driver, directoryId, conversationId },
      onEvent: channel,
    }),
  );

  return {
    sessionKey: descriptor.sessionKey,
    directoryPath: descriptor.directoryPath,
    head: descriptor.head,
    adopted: descriptor.adopted,
    events: queue.events,
    transport: lines.events,
    send: async (payload: string) => {
      await invoke("send_agent_session", { sessionKey: descriptor.sessionKey, payload });
    },
    stop: async () => {
      await invoke("stop_agent_session", { sessionKey: descriptor.sessionKey });
      lines.close();
      queue.close();
    },
  };
}

export const tauriDesktopBackend: ConnectedDesktopBackend = {
  listEndpoints: async () => desktopEndpointSchema.array().parse(await invoke("list_endpoints")),
  saveEndpoint: async (endpoint, pairingSecret) => {
    await invoke("save_endpoint", { endpoint, pairingSecret: pairingSecret ?? null });
    notifyMachineEndpointsChanged();
  },
  forgetEndpoint: async (endpointId) => {
    await invoke("forget_endpoint", { endpointId });
    notifyMachineEndpointsChanged();
  },
  listConversations: async (accountId) =>
    localConversationSchema.array().parse(await invoke("list_conversations", { accountId })),
  saveConversation: async (conversation) => {
    await invoke("save_conversation", { conversation });
  },
  listMessages: async (conversationId) =>
    localMessageSchema.array().parse(await invoke("list_messages", { conversationId })),
  appendMessage: async (message) => {
    await invoke("append_message", { message });
  },
  collectDiagnostics: async () =>
    desktopDiagnosticsSchema.parse(await invoke("collect_diagnostics")),
  signIn: async () => {
    await invoke("sign_in");
  },
  signOut: async () => {
    await invoke("sign_out");
  },
  announceAttention: async (scope, items) =>
    z
      .number()
      .int()
      .nonnegative()
      .parse(await invoke("announce_attention", { scope, items })),
  setAttentionBadge: async (count) => {
    await invoke("set_attention_badge", { count });
  },
  isSignedIn: async () => z.boolean().parse(await invoke("is_signed_in")),
  accessToken: async () => desktopSessionTokenSchema.parse(await invoke("access_token")),
  probeEndpoint: async (endpoint, pairingSecret) =>
    desktopRuntimeReadinessSchema.parse(
      await invoke("probe_endpoint", {
        endpoint,
        pairingSecret: pairingSecret ?? null,
      }),
    ),
  discoverModels: async (endpointId) =>
    discoveredModelSchema.array().parse(await invoke("discover_models", { endpointId })),
  startAgentProcessRun: async (request: DesktopAgentProcessRunRequest) =>
    startRun(
      "start_agent_process_run",
      { request },
      "agent-error",
      "cancel_agent_process_run",
      parseAgentProcessOutput,
    ),
  probeAgentTool: async (driver: AgentRuntimeVendor) =>
    agentToolStateSchema.parse(await invoke("probe_agent_tool", { driver })),
  agentSupportsSessions: async (driver: AgentRuntimeVendor) =>
    z.boolean().parse(await invoke("agent_supports_sessions", { driver })),
  startAgentSession,
  readAgentThread: async (conversationId: string) =>
    agentThreadBindingSchema
      .nullable()
      .parse((await invoke("read_agent_thread", { conversationId })) ?? null),
  saveAgentThread: async (binding: AgentThreadBinding) => {
    await invoke("save_agent_thread", { binding });
  },
  forgetAgentThread: async (conversationId: string) => {
    await invoke("forget_agent_thread", { conversationId });
  },
  listAgentDirectories: async () =>
    agentDirectorySchema.array().parse(await invoke("list_agent_directories")),
  pickAgentDirectory: async () =>
    z
      .string()
      .nullable()
      .parse(await invoke("pick_agent_directory")),
  saveAgentDirectory: async (path) =>
    agentDirectorySchema.parse(await invoke("save_agent_directory", { path })),
  revokeAgentDirectory: async (directoryId) => {
    await invoke("revoke_agent_directory", { directoryId });
  },
  startModelRun: async (request: DesktopModelRunRequest): Promise<DesktopRun> =>
    startRun("start_model_run", { request }, "unknown"),
};

type RunFailure = ModelRuntimeFailure | AgentRuntimeFailure;

function startRun(
  command: string,
  args: Record<string, unknown>,
  refusalFailure: RunFailure,
  cancelCommand = "cancel_model_run",
  parseOutput?: (runId: string, line: string) => DesktopStreamEvent,
): Promise<DesktopRun> {
  const runId = globalThis.crypto.randomUUID();
  const queue = createAsyncEventQueue<DesktopStreamEvent>();
  const channel = new Channel();

  const fail = (failure: RunFailure, cause: unknown) => {
    queue.push({
      type: "failed",
      runId,
      failure,
      message: describeRunFailure(cause),
    });
    queue.close();
  };

  channel.onmessage = (raw) => {
    const event = desktopStreamEventSchema.safeParse(raw);

    if (!event.success) {
      fail("unknown", "The desktop bridge sent an event this version cannot read.");

      return;
    }

    if (event.data.type === "raw-output" && parseOutput) {
      for (const line of event.data.data.split("\n")) {
        if (line.trim()) {
          queue.push(parseOutput(runId, line));
        }
      }
    } else if (event.data.type !== "raw-output") {
      queue.push(event.data);
    }

    if (event.data.type === "finished" || event.data.type === "failed") {
      queue.close();
    }
  };

  void invoke(command, { runId, ...args, onEvent: channel }).catch((cause) =>
    fail(refusalFailure, cause),
  );

  return Promise.resolve({
    runId,
    cancel: () => {
      void invoke(cancelCommand, { runId });
    },
    events: queue.events,
  });
}

setDesktopExecutionBackend(tauriDesktopBackend);

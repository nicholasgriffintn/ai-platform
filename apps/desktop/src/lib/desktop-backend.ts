import {
  setDesktopExecutionBackend,
  type DesktopBackend,
  type DesktopRun,
} from "@ngriffin_uk/polychat-library-chat";
import {
  desktopEndpointSchema,
  desktopRuntimeReadinessSchema,
  agentRuntimeSessionSchema,
  desktopSessionTokenSchema,
  desktopStreamEventSchema,
  discoveredModelSchema,
  localConversationSchema,
  localMessageSchema,
  type DesktopModelRunRequest,
  type DesktopSessionToken,
  type DesktopStreamEvent,
  type ModelRuntimeFailure,
  type AgentRuntimeFailure,
} from "@ngriffin_uk/polychat-schemas";
import { createAsyncEventQueue } from "@ngriffin_uk/polychat-utility-core";
import { Channel, invoke } from "@tauri-apps/api/core";
import z from "zod/v4";

import { describeRunFailure } from "./run-failures";

export const desktopDiagnosticsSchema = z.object({
  appVersion: z.string(),
  target: z.string(),
  apiBaseUrl: z.string(),
  databasePath: z.string(),
  endpointCount: z.number().int().nonnegative(),
  keychainAvailable: z.boolean(),
  signedIn: z.boolean(),
  collectedAt: z.string(),
});

export type DesktopDiagnostics = z.infer<typeof desktopDiagnosticsSchema>;

export interface ConnectedDesktopBackend extends DesktopBackend {
  collectDiagnostics: () => Promise<DesktopDiagnostics>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isSignedIn: () => Promise<boolean>;
  accessToken: () => Promise<DesktopSessionToken>;
}

export const tauriDesktopBackend: ConnectedDesktopBackend = {
  listEndpoints: async () => desktopEndpointSchema.array().parse(await invoke("list_endpoints")),
  saveEndpoint: async (endpoint, pairingSecret) => {
    await invoke("save_endpoint", { endpoint, pairingSecret: pairingSecret ?? null });
  },
  forgetEndpoint: async (endpointId) => {
    await invoke("forget_endpoint", { endpointId });
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
  isSignedIn: async () => z.boolean().parse(await invoke("is_signed_in")),
  accessToken: async () => desktopSessionTokenSchema.parse(await invoke("access_token")),
  probeEndpoint: async (endpointId) =>
    desktopRuntimeReadinessSchema.parse(await invoke("probe_endpoint", { endpointId })),
  discoverModels: async (endpointId) =>
    discoveredModelSchema.array().parse(await invoke("discover_models", { endpointId })),
  listAgentSessions: async (endpointId) =>
    agentRuntimeSessionSchema.array().parse(await invoke("list_agent_sessions", { endpointId })),
  decideApproval: async (endpointId, decision) => {
    await invoke("decide_approval", {
      endpointId,
      requestId: decision.requestId,
      approved: decision.approved,
    });
  },
  startAgentRun: async (request) =>
    startRun(
      "start_agent_run",
      {
        endpointId: request.endpointId,
        sessionNativeId: request.sessionNativeId ?? "",
        prompt: request.prompt,
      },
      "agent-error",
    ),
  startModelRun: async (request: DesktopModelRunRequest): Promise<DesktopRun> =>
    startRun("start_model_run", { request }, "unknown"),
};

type RunFailure = ModelRuntimeFailure | AgentRuntimeFailure;

function startRun(
  command: string,
  args: Record<string, unknown>,
  refusalFailure: RunFailure,
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

    queue.push(event.data);

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
      void invoke("cancel_model_run", { runId });
    },
    events: queue.events,
  });
}

setDesktopExecutionBackend(tauriDesktopBackend);

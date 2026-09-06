import {
  setDesktopExecutionBackend,
  type DesktopBackend,
  type DesktopRun,
} from "@ngriffin_uk/polychat-library-chat";
import {
  desktopEndpointSchema,
  desktopRuntimeReadinessSchema,
  agentRuntimeSessionSchema,
  desktopStreamEventSchema,
  discoveredModelSchema,
  localConversationSchema,
  localMessageSchema,
  type DesktopModelRunRequest,
  type DesktopStreamEvent,
} from "@ngriffin_uk/polychat-schemas";
import { createAsyncEventQueue } from "@ngriffin_uk/polychat-utility-core";
import { Channel, invoke } from "@tauri-apps/api/core";
import z from "zod/v4";

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
  accessToken: () => Promise<string>;
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
  accessToken: async () =>
    z
      .string()
      .min(1)
      .parse(await invoke("access_token")),
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
    startRun("start_agent_run", {
      endpointId: request.endpointId,
      sessionNativeId: request.sessionNativeId ?? "",
      prompt: request.prompt,
    }),
  startModelRun: async (request: DesktopModelRunRequest): Promise<DesktopRun> =>
    startRun("start_model_run", { request }),
};

function startRun(command: string, args: Record<string, unknown>): Promise<DesktopRun> {
  const runId = globalThis.crypto.randomUUID();
  const queue = createAsyncEventQueue<DesktopStreamEvent>();
  const channel = new Channel();

  channel.onmessage = (raw) => {
    const event = desktopStreamEventSchema.parse(raw);

    queue.push(event);

    if (event.type === "finished" || event.type === "failed") {
      queue.close();
    }
  };

  void invoke(command, { runId, ...args, onEvent: channel }).catch(() => queue.close());

  return Promise.resolve({
    runId,
    cancel: () => {
      void invoke("cancel_model_run", { runId });
    },
    events: queue.events,
  });
}

setDesktopExecutionBackend(tauriDesktopBackend);

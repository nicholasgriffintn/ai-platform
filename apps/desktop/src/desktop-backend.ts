import type { DesktopBackend, DesktopRun } from "@ngriffin_uk/polychat-library-chat";
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
  type HostedRunRequest,
} from "@ngriffin_uk/polychat-schemas";
import { createAsyncEventQueue } from "@ngriffin_uk/polychat-utility-core";
import { Channel, invoke } from "@tauri-apps/api/core";
import z from "zod/v4";

export type ConnectedDesktopBackend = Pick<
  DesktopBackend,
  | "listEndpoints"
  | "saveEndpoint"
  | "forgetEndpoint"
  | "probeEndpoint"
  | "discoverModels"
  | "startModelRun"
  | "startHostedRun"
  | "startAgentRun"
  | "listAgentSessions"
  | "decideApproval"
  | "listConversations"
  | "saveConversation"
  | "listMessages"
  | "appendMessage"
> & {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isSignedIn: () => Promise<boolean>;
};

export const tauriDesktopBackend: ConnectedDesktopBackend = {
  listEndpoints: async () => desktopEndpointSchema.array().parse(await invoke("list_endpoints")),
  saveEndpoint: async (endpoint) => {
    await invoke("save_endpoint", { endpoint });
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
  signIn: async () => {
    await invoke("sign_in");
  },
  signOut: async () => {
    await invoke("sign_out");
  },
  isSignedIn: async () => z.boolean().parse(await invoke("is_signed_in")),
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
  startHostedRun: async (request: HostedRunRequest): Promise<DesktopRun> =>
    startRun("start_hosted_run", request),
  startModelRun: async (request: DesktopModelRunRequest): Promise<DesktopRun> =>
    startRun("start_model_run", request),
};

function startRun(command: string, request: unknown): Promise<DesktopRun> {
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

  const payload =
    typeof request === "object" && request !== null && "sessionNativeId" in request
      ? { runId, ...request, onEvent: channel }
      : { runId, request, onEvent: channel };

  void invoke(command, payload).catch(() => queue.close());

  return Promise.resolve({
    runId,
    cancel: () => {
      void invoke("cancel_model_run", { runId });
    },
    events: queue.events,
  });
}

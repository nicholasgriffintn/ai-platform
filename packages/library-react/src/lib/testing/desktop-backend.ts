import type {
  DesktopAgentSession,
  DesktopBackend,
  DesktopRun,
} from "@ngriffin_uk/polychat-library-chat";
import type {
  AgentDirectory,
  AgentThreadBinding,
  DesktopEndpoint,
  DesktopRuntimeReadiness,
  DesktopStreamEvent,
  DiscoveredModel,
  LocalConversation,
  LocalMessage,
} from "@ngriffin_uk/polychat-schemas";

export interface FakeDesktopBackendSeed {
  endpoints?: DesktopEndpoint[];
  readiness?: Record<string, DesktopRuntimeReadiness>;
  models?: DiscoveredModel[];
  agentDirectories?: AgentDirectory[];
  script?: DesktopStreamEvent[];
  conversations?: LocalConversation[];
  messages?: LocalMessage[];
  sessionDrivers?: string[];
  sessionTransport?: string[];
  agentThreads?: AgentThreadBinding[];
}

export interface FakeDesktopBackend extends DesktopBackend {
  cancelledRuns: string[];
  probedEndpoints: { endpointId: string; url: string }[];
  sentSessionPayloads: string[];
  stoppedSessions: string[];
}

const UNREACHABLE: DesktopRuntimeReadiness = {
  status: "unreachable",
  checkedAt: "1970-01-01T00:00:00.000Z",
  detail: null,
};

export function createFakeDesktopBackend(seed: FakeDesktopBackendSeed = {}): FakeDesktopBackend {
  const cancelledRuns: string[] = [];
  const probedEndpoints: { endpointId: string; url: string }[] = [];
  const sentSessionPayloads: string[] = [];
  const stoppedSessions: string[] = [];
  const agentThreads = new Map<string, AgentThreadBinding>(
    (seed.agentThreads ?? []).map((binding) => [binding.conversationId, binding]),
  );
  let runCounter = 0;

  function createRun(script: DesktopStreamEvent[]): DesktopRun {
    runCounter += 1;
    const runId = `fake-run-${runCounter}`;
    let cancelled = false;

    return {
      runId,
      cancel: () => {
        cancelled = true;
        cancelledRuns.push(runId);
      },
      events: {
        async *[Symbol.asyncIterator]() {
          for (const event of script) {
            if (cancelled) {
              yield { type: "finished", runId, reason: "cancelled", at: new Date(0).toISOString() };

              return;
            }

            yield { ...event, runId };
          }
        },
      },
    };
  }

  const saved: DesktopEndpoint[] = [...(seed.endpoints ?? [])];
  const conversations: LocalConversation[] = [...(seed.conversations ?? [])];
  const messages: LocalMessage[] = [...(seed.messages ?? [])];

  function createSession(
    driver: string,
    directoryId: string,
    conversationId: string,
  ): DesktopAgentSession {
    const sessionKey = `${driver}:${conversationId}`;
    let stopped = false;

    return {
      sessionKey,
      directoryPath: `/fake/${directoryId}`,
      head: null,
      adopted: false,
      events: {
        // eslint-disable-next-line require-yield
        async *[Symbol.asyncIterator]() {
          return;
        },
      },
      transport: {
        async *[Symbol.asyncIterator]() {
          for (const line of seed.sessionTransport ?? []) {
            if (stopped) {
              return;
            }

            yield line;
          }
        },
      },
      send: async (payload) => {
        sentSessionPayloads.push(payload);
      },
      stop: async () => {
        stopped = true;
        stoppedSessions.push(sessionKey);
      },
    };
  }

  return {
    cancelledRuns,
    probedEndpoints,
    sentSessionPayloads,
    stoppedSessions,
    agentSupportsSessions: async (driver) => (seed.sessionDrivers ?? ["codex"]).includes(driver),
    startAgentSession: async (driver, directoryId, conversationId) =>
      createSession(driver, directoryId, conversationId),
    readAgentThread: async (conversationId) => agentThreads.get(conversationId) ?? null,
    saveAgentThread: async (binding) => {
      agentThreads.set(binding.conversationId, binding);
    },
    forgetAgentThread: async (conversationId) => {
      agentThreads.delete(conversationId);
    },
    listEndpoints: async () => saved,
    saveEndpoint: async (endpoint) => {
      const existing = saved.findIndex((candidate) => candidate.id === endpoint.id);

      if (existing === -1) {
        saved.push(endpoint);

        return;
      }

      saved[existing] = endpoint;
    },
    forgetEndpoint: async (endpointId) => {
      const existing = saved.findIndex((candidate) => candidate.id === endpointId);

      if (existing !== -1) {
        saved.splice(existing, 1);
      }
    },
    probeEndpoint: async (endpoint) => {
      probedEndpoints.push({ endpointId: endpoint.id, url: endpoint.url });

      return seed.readiness?.[endpoint.id] ?? UNREACHABLE;
    },
    discoverModels: async (endpointId) =>
      (seed.models ?? []).filter((model) => model.endpointId === endpointId),
    startModelRun: async () => createRun(seed.script ?? []),
    startAgentProcessRun: async () => createRun(seed.script ?? []),
    probeAgentTool: async () => ({
      state: "missing",
      checkedAt: new Date(0).toISOString(),
    }),
    listAgentDirectories: async () => seed.agentDirectories ?? [],
    pickAgentDirectory: async () => null,
    saveAgentDirectory: async (path) => ({
      id: `fake-directory-${path}`,
      path,
      label: path,
      approvedAt: new Date(0).toISOString(),
      lastUsedAt: null,
      isGitRepo: false,
    }),
    revokeAgentDirectory: async () => {},

    listConversations: async (accountId) =>
      conversations.filter((conversation) => conversation.accountId === accountId),
    saveConversation: async (conversation) => {
      const existing = conversations.findIndex((candidate) => candidate.id === conversation.id);

      if (existing === -1) {
        conversations.push(conversation);

        return;
      }

      conversations[existing] = conversation;
    },
    listMessages: async (conversationId) =>
      messages.filter((message) => message.conversationId === conversationId),
    appendMessage: async (message) => {
      messages.push(message);
    },
  };
}

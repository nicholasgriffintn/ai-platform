import type {
  AgentApprovalDecision,
  AgentRuntimeSession,
  DesktopAgentRunRequest,
  DesktopEndpoint,
  DesktopExecutionLocation,
  DesktopModelRunRequest,
  DesktopRuntimeReadiness,
  DesktopStreamEvent,
  DiscoveredModel,
} from "@ngriffin_uk/polychat-schemas";

export interface DesktopRun {
  runId: string;
  events: AsyncIterable<DesktopStreamEvent>;
  cancel: () => void;
}

export interface DesktopBackend {
  listEndpoints: () => Promise<DesktopEndpoint[]>;
  probeEndpoint: (endpointId: string) => Promise<DesktopRuntimeReadiness>;
  discoverModels: (endpointId: string) => Promise<DiscoveredModel[]>;
  startModelRun: (request: DesktopModelRunRequest) => Promise<DesktopRun>;
  listAgentSessions: (endpointId: string) => Promise<AgentRuntimeSession[]>;
  startAgentRun: (request: DesktopAgentRunRequest) => Promise<DesktopRun>;
  decideApproval: (endpointId: string, decision: AgentApprovalDecision) => Promise<void>;
}

export interface FakeDesktopBackendSeed {
  endpoints?: DesktopEndpoint[];
  readiness?: Record<string, DesktopRuntimeReadiness>;
  models?: DiscoveredModel[];
  sessions?: AgentRuntimeSession[];
  script?: DesktopStreamEvent[];
}

export interface FakeDesktopBackend extends DesktopBackend {
  decisions: { endpointId: string; decision: AgentApprovalDecision }[];
  cancelledRuns: string[];
}

const UNREACHABLE: DesktopRuntimeReadiness = {
  status: "unreachable",
  checkedAt: "1970-01-01T00:00:00.000Z",
  detail: null,
};

export function createFakeDesktopBackend(seed: FakeDesktopBackendSeed = {}): FakeDesktopBackend {
  const decisions: { endpointId: string; decision: AgentApprovalDecision }[] = [];
  const cancelledRuns: string[] = [];
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

  return {
    decisions,
    cancelledRuns,
    listEndpoints: async () => seed.endpoints ?? [],
    probeEndpoint: async (endpointId) => seed.readiness?.[endpointId] ?? UNREACHABLE,
    discoverModels: async (endpointId) =>
      (seed.models ?? []).filter((model) => model.endpointId === endpointId),
    listAgentSessions: async (endpointId) =>
      (seed.sessions ?? []).filter((session) => session.endpointId === endpointId),
    startModelRun: async () => createRun(seed.script ?? []),
    startAgentRun: async () => createRun(seed.script ?? []),
    decideApproval: async (endpointId, decision) => {
      decisions.push({ endpointId, decision });
    },
  };
}

export interface ExecutionHandoff {
  requiresNewConversation: boolean;
  carriesHistory: boolean;
}

export function resolveExecutionHandoff(
  from: DesktopExecutionLocation,
  to: DesktopExecutionLocation,
): ExecutionHandoff {
  const crossesBoundary = from !== to;

  return { requiresNewConversation: crossesBoundary, carriesHistory: !crossesBoundary };
}

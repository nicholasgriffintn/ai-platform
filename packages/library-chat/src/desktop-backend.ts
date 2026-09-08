import type {
  AgentSessionEvent,
  AgentThreadBinding,
  DesktopAgentProcessRunRequest,
  AgentDirectory,
  AgentRuntimeVendor,
  AgentToolState,
  DesktopEndpoint,
  DesktopModelRunRequest,
  DesktopRuntimeReadiness,
  DesktopStreamEvent,
  DiscoveredModel,
  LocalConversation,
  LocalMessage,
} from "@ngriffin_uk/polychat-schemas";

export interface DesktopRun {
  runId: string;
  events: AsyncIterable<DesktopStreamEvent>;
  cancel: () => void;
}

export interface DesktopAgentSession {
  sessionKey: string;
  directoryPath: string;
  head: string | null;
  adopted: boolean;
  events: AsyncIterable<AgentSessionEvent>;
  transport: AsyncIterable<string>;
  send: (payload: string) => Promise<void>;
  stop: () => Promise<void>;
}

export interface DesktopBackend {
  listEndpoints: () => Promise<DesktopEndpoint[]>;
  saveEndpoint: (endpoint: DesktopEndpoint, pairingSecret?: string) => Promise<void>;
  forgetEndpoint: (endpointId: string) => Promise<void>;
  probeEndpoint: (
    endpoint: DesktopEndpoint,
    pairingSecret?: string,
  ) => Promise<DesktopRuntimeReadiness>;
  discoverModels: (endpointId: string) => Promise<DiscoveredModel[]>;
  startModelRun: (request: DesktopModelRunRequest) => Promise<DesktopRun>;
  startAgentProcessRun: (request: DesktopAgentProcessRunRequest) => Promise<DesktopRun>;
  probeAgentTool: (driver: AgentRuntimeVendor) => Promise<AgentToolState>;
  agentSupportsSessions: (driver: AgentRuntimeVendor) => Promise<boolean>;
  startAgentSession: (
    driver: AgentRuntimeVendor,
    directoryId: string,
    conversationId: string,
  ) => Promise<DesktopAgentSession>;
  readAgentThread: (conversationId: string) => Promise<AgentThreadBinding | null>;
  saveAgentThread: (binding: AgentThreadBinding) => Promise<void>;
  forgetAgentThread: (conversationId: string) => Promise<void>;
  listAgentDirectories: () => Promise<AgentDirectory[]>;
  pickAgentDirectory: () => Promise<string | null>;
  saveAgentDirectory: (path: string) => Promise<AgentDirectory>;
  revokeAgentDirectory: (directoryId: string) => Promise<void>;
  listConversations: (accountId: string) => Promise<LocalConversation[]>;
  saveConversation: (conversation: LocalConversation) => Promise<void>;
  listMessages: (conversationId: string) => Promise<LocalMessage[]>;
  appendMessage: (message: LocalMessage) => Promise<void>;
}

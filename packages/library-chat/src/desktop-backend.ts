import type {
  AgentBranchChanges,
  AgentSessionEvent,
  AgentTurnChanges,
  AgentWorktree,
  AgentThreadBinding,
  DesktopAgentProcessRunRequest,
  AgentDirectory,
  DesktopLocalToolRequest,
  DesktopToolResult,
  AgentRuntimeVendor,
  AgentToolState,
  DesktopEndpoint,
  DesktopModelRunRequest,
  DesktopRuntimeReadiness,
  DesktopStreamEvent,
  DesktopTerminal,
  DesktopTerminalEvent,
  DesktopTerminalOpenRequest,
  DiscoveredModel,
  LocalConversation,
  LocalMessage,
} from "@ngriffin_uk/polychat-schemas";

export interface DesktopRun {
  runId: string;
  events: AsyncIterable<DesktopStreamEvent>;
  cancel: () => void;
}

export interface AgentSessionSpec {
  sessionId: string;
  resume: boolean;
  isolated?: boolean;
  sandboxed?: boolean;
  mcpConfig?: string | null;
}

export interface AgentWorkspaceOptions {
  worktree: boolean;
}

export interface DesktopAgentSession {
  sessionKey: string;
  directoryPath: string;
  head: string | null;
  adopted: boolean;
  worktree: AgentWorktree | null;
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
    session?: AgentSessionSpec,
    workspace?: AgentWorkspaceOptions,
  ) => Promise<DesktopAgentSession>;
  agentWorktree: (directoryId: string, conversationId: string) => Promise<AgentWorktree | null>;
  snapshotAgentWorkspace: (directoryId: string, conversationId: string) => Promise<string | null>;
  agentTurnChanges: (
    directoryId: string,
    conversationId: string,
    from: string,
    to: string,
  ) => Promise<AgentTurnChanges>;
  commitAgentWorktree: (
    directoryId: string,
    conversationId: string,
    message: string,
  ) => Promise<string>;
  agentBranchChanges: (directoryId: string, conversationId: string) => Promise<AgentBranchChanges>;
  openTerminal: (
    request: DesktopTerminalOpenRequest,
    onEvent: (event: DesktopTerminalEvent) => void,
  ) => Promise<DesktopTerminal>;
  writeTerminal: (terminalId: string, data: string) => Promise<void>;
  resizeTerminal: (terminalId: string, cols: number, rows: number) => Promise<void>;
  closeTerminal: (terminalId: string) => Promise<void>;
  readAgentThread: (conversationId: string) => Promise<AgentThreadBinding | null>;
  saveAgentThread: (binding: AgentThreadBinding) => Promise<void>;
  forgetAgentThread: (conversationId: string) => Promise<void>;
  listAgentDirectories: () => Promise<AgentDirectory[]>;
  runLocalTool: (request: DesktopLocalToolRequest) => Promise<DesktopToolResult>;
  pickAgentDirectory: () => Promise<string | null>;
  ensureWorkDirectory: (name: string) => Promise<AgentDirectory>;
  saveAgentDirectory: (path: string) => Promise<AgentDirectory>;
  revokeAgentDirectory: (directoryId: string) => Promise<void>;
  listConversations: (accountId: string) => Promise<LocalConversation[]>;
  saveConversation: (conversation: LocalConversation) => Promise<void>;
  listMessages: (conversationId: string) => Promise<LocalMessage[]>;
  appendMessage: (message: LocalMessage) => Promise<void>;
}

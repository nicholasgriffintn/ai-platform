import type {
  BrowserProvider,
  BrowserSessionSnapshot,
  SubmitBrowserApproval,
  TeammateComputerInput,
  TeammateComputerTeachingRecording,
} from "@ngriffin_uk/polychat-schemas";

export const STALE_COMPUTER_LEASE_ERROR_CODE = "computer_lease_stale";

export interface ComputerResource {
  handle: string;
  checkpointReference?: string | null;
}

export interface ComputerSessionProvider {
  readonly name: BrowserProvider;
  create(input: {
    model: string;
    allowedDomains?: string[];
    referenceId: string;
    task: string;
  }): Promise<string>;
  recover(referenceId: string): Promise<string | null>;
  inspect(sessionId: string): Promise<BrowserSessionSnapshot>;
  respond(sessionId: string, input: SubmitBrowserApproval): Promise<void>;
  cancel(sessionId: string): Promise<void>;
  destroy(sessionId: string): Promise<void>;
}

export type ComputerUseProvider =
  | { id: "hosted"; mode: "interactive"; control: ComputerProvider }
  | { id: "openai"; mode: "managed"; sessions: ComputerSessionProvider };

export interface ComputerScreenConnection {
  screenUrl: string;
  expiresAt: string;
}

export interface ComputerProvider {
  provision(input: {
    resourceId: string;
    checkpointReference?: string | null;
  }): Promise<ComputerResource>;
  observe(input: {
    resourceId: string;
    handle: string;
    fence: number;
  }): Promise<Record<string, unknown>>;
  input(input: {
    resourceId: string;
    handle: string;
    fence: number;
    input: TeammateComputerInput;
  }): Promise<Record<string, unknown>>;
  connectScreen(input: {
    resourceId: string;
    handle: string;
    fence: number;
    recordingId?: string;
  }): Promise<ComputerScreenConnection>;
  connectViewScreen(input: {
    resourceId: string;
    handle: string;
  }): Promise<ComputerScreenConnection>;
  getTeachingRecording(input: {
    resourceId: string;
    handle: string;
    fence: number;
    recordingId: string;
  }): Promise<TeammateComputerTeachingRecording>;
  revokeControl(input: { resourceId: string; handle: string; fence: number }): Promise<void>;
  checkpoint(input: {
    resourceId: string;
    handle: string;
    fence: number;
  }): Promise<{ checkpointReference: string }>;
  restore(input: {
    resourceId: string;
    handle: string;
    checkpointReference: string;
    fence: number;
  }): Promise<void>;
  stop(input: { resourceId: string; handle: string; fence: number }): Promise<void>;
  destroy(input: { resourceId: string; handle: string; fence: number }): Promise<void>;
}

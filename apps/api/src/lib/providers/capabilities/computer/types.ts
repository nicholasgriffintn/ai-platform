import type {
  TeammateComputerInput,
  TeammateComputerTeachingRecording,
} from "@ngriffin_uk/polychat-schemas";

export interface ComputerResource {
  handle: string;
  checkpointReference?: string | null;
}

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

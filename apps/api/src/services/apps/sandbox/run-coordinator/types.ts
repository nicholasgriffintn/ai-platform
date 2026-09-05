import type {
  SandboxRunControl,
  SandboxRunEvent,
  SandboxRunInstruction,
  SandboxPreviewSessionRecord,
} from "@ngriffin_uk/polychat-schemas";

export type CoordinatorState = SandboxRunControl;

export interface CoordinatorEventEnvelope {
  index: number;
  event: SandboxRunEvent;
  recordedAt: string;
}

export type SandboxRunInstructionRecord = SandboxRunInstruction;

export interface CoordinatorInstructionEnvelope {
  index: number;
  instruction: SandboxRunInstructionRecord;
  recordedAt: string;
}

export type CoordinatorPreviewSession = SandboxPreviewSessionRecord;

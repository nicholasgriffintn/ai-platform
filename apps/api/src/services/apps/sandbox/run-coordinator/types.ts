import type {
	SandboxRunControl,
	SandboxRunEvent,
	SandboxRunInstruction,
} from "@assistant/schemas";

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

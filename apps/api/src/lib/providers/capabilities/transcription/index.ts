import type { IEnv, IUser } from "~/types";

export interface TranscriptionRequest {
	env: IEnv;
	audio: Blob | string;
	user: IUser;
	provider?: string;
	timestamps?: boolean;
}

export interface TranscriptionResult {
	text: string;
	data?: unknown;
	metadata?: Record<string, unknown>;
}

export interface TranscriptionProvider {
	name: string;
	transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}

export { BaseTranscriptionProvider } from "./base";

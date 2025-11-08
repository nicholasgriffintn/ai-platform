import type { StorageService } from "~/lib/storage";
import type { IEnv, IUser } from "~/types";

export interface AudioSynthesisRequest {
	input: string;
	env: IEnv;
	user: IUser;
	slug?: string;
	storage?: StorageService;
	voice?: string;
	locale?: string;
	metadata?: Record<string, unknown>;
}

export interface AudioSynthesisResult {
	key?: string;
	url?: string;
	response?: string;
	metadata?: Record<string, unknown>;
	raw?: unknown;
}

export interface AudioProvider {
	name: string;
	synthesize(request: AudioSynthesisRequest): Promise<AudioSynthesisResult>;
}

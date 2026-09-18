import type { CredentialAuthority } from "@ngriffin_uk/polychat-ai-models";
import type { RealtimeLiveProviderDescriptor } from "@ngriffin_uk/polychat-schemas";

import type { ProviderEnv, ProviderUser } from "../../env.js";
import type { RealtimeModality, RealtimeTransport } from "./modalities.js";

export type RealtimeSessionType = "realtime" | "translation" | "transcription";
export type RealtimeTranscriptionDelay = "minimal" | "low" | "medium" | "high" | "xhigh";

export function parseRealtimeTranscriptionDelay(
  delay?: string,
): RealtimeTranscriptionDelay | undefined {
  switch (delay) {
    case "minimal":
    case "low":
    case "medium":
    case "high":
    case "xhigh":
      return delay;
    default:
      return undefined;
  }
}

export interface RealtimeSessionRequest {
  env: ProviderEnv;
  user: ProviderUser;
  credentialAuthority?: CredentialAuthority;
  type: RealtimeSessionType;
  apiBaseUrl?: string;
  model?: string;
  language?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  voice?: string;
  instructions?: string;
  delay?: RealtimeTranscriptionDelay;
  transport?: RealtimeTransport;
  inputModalities?: RealtimeModality[];
  outputModalities?: RealtimeModality[];
}

export interface RealtimeProvider {
  name: string;
  readonly descriptor: RealtimeLiveProviderDescriptor;
  readonly configuration: {
    readonly acceptsUserApiKey: boolean;
    readonly environmentVariables: readonly string[];
  };
  models?: string[];
  getApiKey?: (request: RealtimeSessionRequest) => Promise<string>;
  getDefaultModel: (type: RealtimeSessionRequest["type"]) => string;
  getTranscriptionDelay?: (
    request: RealtimeSessionRequest,
  ) => RealtimeTranscriptionDelay | undefined;
  buildAudioFormat?: () => Record<string, unknown>;
  createSession(request: RealtimeSessionRequest): Promise<unknown>;
}

export {
  parseRealtimeModalities,
  parseRealtimeTransport,
  validateRealtimeModalities,
} from "./modalities.js";
export type { RealtimeModality, RealtimeTransport } from "./modalities.js";

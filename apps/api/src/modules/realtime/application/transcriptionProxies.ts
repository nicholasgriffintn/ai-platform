import type { RealtimeTranscriptionDelay } from "@ngriffin_uk/polychat-ai-providers";
import type { Context } from "hono";

import type { IEnv, IUser } from "~/types";

import { createCartesiaRealtimeProxyResponse } from "./cartesia";
import { createElevenLabsRealtimeProxyResponse } from "./elevenlabs";
import { createGreenPtRealtimeProxyResponse } from "./greenpt";
import { createMistralRealtimeProxyResponse } from "./mistral";
import type { RealtimeProxySessionEndHandler } from "./transcriptionProxy";
import { createWorkersAiRealtimeProxyResponse } from "./workersAi";

export const TRANSCRIPTION_PROXY_PROVIDERS = [
  "mistral",
  "elevenlabs",
  "cartesia",
  "greenpt",
  "workers-ai",
] as const;

export type TranscriptionProxyProvider = (typeof TRANSCRIPTION_PROXY_PROVIDERS)[number];

export interface TranscriptionProxyRequest {
  context: Context;
  env: IEnv;
  user: IUser;
  model: string;
  delay?: RealtimeTranscriptionDelay;
  language?: string;
  speakerLabels: boolean;
  waitUntil: (work: Promise<unknown>) => void;
  onSessionEnd: RealtimeProxySessionEndHandler;
}

const TRANSCRIPTION_PROXIES: Record<
  TranscriptionProxyProvider,
  (request: TranscriptionProxyRequest) => Promise<Response>
> = {
  mistral: (request) => createMistralRealtimeProxyResponse(request),
  elevenlabs: (request) => createElevenLabsRealtimeProxyResponse(request),
  cartesia: (request) => createCartesiaRealtimeProxyResponse(request),
  greenpt: (request) => createGreenPtRealtimeProxyResponse(request),
  "workers-ai": (request) => createWorkersAiRealtimeProxyResponse(request),
};

export function createTranscriptionProxyResponse(
  provider: TranscriptionProxyProvider,
  request: TranscriptionProxyRequest,
): Promise<Response> {
  return TRANSCRIPTION_PROXIES[provider](request);
}

import {
  parseRealtimeModalities,
  parseRealtimeTranscriptionDelay,
  parseRealtimeTransport,
} from "@ngriffin_uk/polychat-ai-providers";
import { generateId, isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { optionalRepositories, type ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  getRealtimeProvider,
  listRealtimeProviders,
} from "~/infrastructure/providers/capabilities/realtime";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type { IUser } from "~/types";

import {
  getAccessibleRealtimeModel,
  lacksRealtimeEntitlement,
  REALTIME_ENTITLEMENT_MESSAGE,
} from "./access";
import { resolveRealtimeMaxSessionSeconds } from "./sessionLimits";
import {
  admitRealtimeSession,
  priceRealtimeReservation,
  registerRealtimeSessionUsage,
} from "./sessionUsage";

export interface RealtimeSessionOptions {
  type: "realtime" | "translation" | "transcription";
  provider?: string;
  model?: string;
  language?: string;
  targetLanguage?: string;
  voice?: string;
  instructions?: string;
  delay?: string;
  speakerLabels?: boolean;
  transport?: string;
  inputModalities?: string;
  outputModalities?: string;
}

function rejected(message: string, status: 400 | 403 | 500): never {
  throw new AssistantError(
    message,
    status === 403
      ? ErrorType.FORBIDDEN
      : status === 500
        ? ErrorType.UNKNOWN_ERROR
        : ErrorType.PARAMS_ERROR,
    status,
  );
}

export async function createRealtimeSession(
  serviceContext: ServiceContext,
  user: IUser,
  options: RealtimeSessionOptions,
): Promise<unknown> {
  const env = serviceContext.env;
  const providerName = options.provider || "openai";

  if (!listRealtimeProviders().includes(providerName)) {
    rejected("Invalid provider specified", 400);
  }

  const provider = getRealtimeProvider(providerName, { env, user });
  const modelProvider = provider.configuration.modelProvider ?? providerName;

  if (options.model && provider.models && !provider.models.includes(options.model)) {
    rejected("Invalid model specified", 400);
  }

  let requestedModel = options.model;

  if (!requestedModel) {
    try {
      requestedModel = provider.getDefaultModel(options.type);
    } catch (error) {
      rejected(error instanceof Error ? error.message : "Invalid session type", 400);
    }
  }

  if (lacksRealtimeEntitlement(user)) {
    rejected(REALTIME_ENTITLEMENT_MESSAGE, 403);
  }

  const accessibleModel = await getAccessibleRealtimeModel({
    env,
    user,
    model: requestedModel,
    provider: modelProvider,
  });

  if (!accessibleModel) {
    rejected("Model not found or user does not have access", 403);
  }

  const pricing = priceRealtimeReservation(
    accessibleModel.config,
    providerName,
    accessibleModel.id,
  );
  const admitted = await admitRealtimeSession({
    repositories: optionalRepositories(serviceContext),
    userId: user.id,
    creditMicros: pricing.creditMicros,
  });

  if (!admitted) {
    rejected("Realtime session refused: usage allowance is exhausted", 403);
  }

  const maxSessionSeconds = resolveRealtimeMaxSessionSeconds(env);
  const userSettings = await optionalRepositories(serviceContext)
    ?.get(UserSettingsRepository)
    .getUserSettings(user.id);
  const session = await provider.createSession({
    env,
    user,
    credentialAuthority: accessibleModel.credentialAuthority,
    type: options.type,
    model: accessibleModel.id,
    language: options.language,
    targetLanguage: options.targetLanguage,
    voice: options.voice,
    instructions: options.instructions,
    delay: parseRealtimeTranscriptionDelay(options.delay),
    speakerLabels: options.speakerLabels,
    vocabulary: userSettings?.transcription_vocabulary,
    transport: parseRealtimeTransport(options.transport),
    inputModalities: parseRealtimeModalities(options.inputModalities),
    outputModalities: parseRealtimeModalities(options.outputModalities),
  });

  if (!session) {
    rejected("Failed to create realtime session", 500);
  }

  const sessionId =
    isRecord(session) && typeof session.id === "string" && session.id ? session.id : generateId();

  await registerRealtimeSessionUsage({
    env,
    repositories: optionalRepositories(serviceContext),
    userId: user.id,
    sessionId,
    model: accessibleModel.id,
    provider: providerName,
    byok: accessibleModel.credentialAuthority === "byok",
    pricing,
    maxSessionSeconds,
  });

  return isRecord(session) ? { ...session, max_session_seconds: maxSessionSeconds } : session;
}

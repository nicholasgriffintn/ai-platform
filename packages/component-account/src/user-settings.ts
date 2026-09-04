import {
  guardrailsProviderIds,
  type GuardrailsProviderId,
  type PetModelOverrides,
} from "@ngriffin_uk/polychat-schemas";

import { resolveSpeechSettings, resolveTranscriptionSettings } from "./transcription-settings";

export function resolveGuardrailsProviderId(value: string): GuardrailsProviderId {
  return guardrailsProviderIds.find((provider) => provider === value) ?? "llamaguard";
}

export interface UserSettings {
  id: string;
  nickname: string;
  job_role: string;
  traits: string;
  preferences: string;
  tracking_enabled?: boolean;
  guardrails_enabled?: boolean;
  guardrails_provider?: GuardrailsProviderId;
  bedrock_guardrail_id?: string;
  bedrock_guardrail_version?: string;
  embedding_provider?: string;
  bedrock_knowledge_base_id?: string;
  bedrock_knowledge_base_custom_data_source_id?: string;
  s3vectors_bucket_name?: string;
  s3vectors_index_name?: string;
  s3vectors_region?: string;
  memories_save_enabled?: boolean;
  memories_chat_history_enabled?: boolean;
  temporary_chats_default?: boolean;
  memory_provider?: string;
  transcription_provider?: string;
  transcription_model?: string;
  speech_provider?: string;
  speech_model?: string;
  search_provider?: string;
  sandbox_model?: string;
  pet_source?: "preset" | "custom";
  pet_id?: string;
  pet_travel_enabled?: boolean;
  pet_animation_enabled?: boolean;
  pet_model_overrides?: PetModelOverrides;
}

export function prepareUserSettingsPayload(settings: Partial<UserSettings>): Partial<UserSettings> {
  const payload = { ...settings };

  if (payload.embedding_provider !== "s3vectors") {
    delete payload.s3vectors_bucket_name;
    delete payload.s3vectors_index_name;
    delete payload.s3vectors_region;
  }

  return payload;
}

export function buildUserSettingsFormData(userSettings: UserSettings | null) {
  const transcriptionSettings = resolveTranscriptionSettings(
    userSettings?.transcription_provider,
    userSettings?.transcription_model,
  );
  const speechSettings = resolveSpeechSettings(
    userSettings?.speech_provider,
    userSettings?.speech_model,
  );

  return {
    nickname: userSettings?.nickname || "",
    job_role: userSettings?.job_role || "",
    traits: userSettings?.traits || "",
    preferences: userSettings?.preferences || "",
    guardrails_enabled: userSettings?.guardrails_enabled || false,
    guardrails_provider: userSettings?.guardrails_provider || "llamaguard",
    bedrock_guardrail_id: userSettings?.bedrock_guardrail_id || "",
    bedrock_guardrail_version: userSettings?.bedrock_guardrail_version || "1",
    embedding_provider:
      userSettings?.embedding_provider === "s3vectors" ? "s3vectors" : "vectorize",
    bedrock_knowledge_base_id: userSettings?.bedrock_knowledge_base_id || "",
    bedrock_knowledge_base_custom_data_source_id:
      userSettings?.bedrock_knowledge_base_custom_data_source_id || "",
    s3vectors_bucket_name: userSettings?.s3vectors_bucket_name || "",
    s3vectors_index_name: userSettings?.s3vectors_index_name || "",
    s3vectors_region: userSettings?.s3vectors_region || "us-east-1",
    memories_save_enabled: userSettings?.memories_save_enabled || false,
    memories_chat_history_enabled: userSettings?.memories_chat_history_enabled || false,
    temporary_chats_default: userSettings?.temporary_chats_default || false,
    memory_provider: userSettings?.memory_provider || "built-in",
    tracking_enabled: userSettings?.tracking_enabled ?? true,
    transcription_provider: transcriptionSettings.transcription_provider,
    transcription_model: transcriptionSettings.transcription_model,
    speech_provider: speechSettings.speech_provider,
    speech_model: speechSettings.speech_model,
    search_provider: userSettings?.search_provider || "",
    sandbox_model: userSettings?.sandbox_model || "",
  };
}

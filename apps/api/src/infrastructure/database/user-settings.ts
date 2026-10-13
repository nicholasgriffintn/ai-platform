import type { IUserSettings } from "~/types";

export type StoredUserSettings = {
  [Key in keyof IUserSettings]: IUserSettings[Key] extends boolean
    ? number | null
    : IUserSettings[Key];
};

export const USER_SETTINGS_DEFAULTS: Record<string, unknown> = {
  nickname: null,
  job_role: null,
  traits: null,
  preferences: null,
  guardrails_enabled: 0,
  guardrails_provider: "llamaguard",
  bedrock_guardrail_id: null,
  bedrock_guardrail_version: null,
  embedding_provider: "vectorize",
  bedrock_knowledge_base_id: null,
  bedrock_knowledge_base_custom_data_source_id: null,
  s3vectors_bucket_name: null,
  s3vectors_index_name: null,
  s3vectors_region: null,
  dynamodb_vectors_table_name: null,
  dynamodb_vectors_index_name: null,
  dynamodb_vectors_region: null,
  memories_save_enabled: 0,
  memories_chat_history_enabled: 0,
  temporary_chats_default: 0,
  memory_provider: "built-in",
  transcription_provider: "workers",
  transcription_model: "whisper",
  speech_provider: "melotts",
  speech_model: "@cf/myshell-ai/melotts",
  search_provider: null,
  sandbox_model: null,
  default_model_tier: null,
  default_model_id: null,
  default_compute_site: null,
  last_model_selection: null,
  pet_source: "preset",
  pet_id: "pip",
  pet_travel_enabled: 0,
  pet_animation_enabled: 0,
  pet_model_overrides: {
    families: {},
    providers: {},
  },
  onboarding_seen: [],
  tracking_enabled: 1,
  advertise_machines: 1,
};

export function prepareUserSettingsUpdates(
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    nickname: settings.nickname ?? null,
    job_role: settings.job_role ?? null,
    traits: settings.traits ?? null,
    preferences: settings.preferences ?? null,
    tracking_enabled:
      settings.tracking_enabled !== undefined ? (settings.tracking_enabled ? 1 : 0) : null,
    advertise_machines:
      settings.advertise_machines !== undefined ? (settings.advertise_machines ? 1 : 0) : null,
    guardrails_enabled:
      settings.guardrails_enabled !== undefined ? (settings.guardrails_enabled ? 1 : 0) : null,
    guardrails_provider: settings.guardrails_provider ?? null,
    bedrock_guardrail_id: settings.bedrock_guardrail_id ?? null,
    bedrock_guardrail_version: settings.bedrock_guardrail_version ?? null,
    embedding_provider: settings.embedding_provider ?? null,
    bedrock_knowledge_base_id: settings.bedrock_knowledge_base_id ?? null,
    bedrock_knowledge_base_custom_data_source_id:
      settings.bedrock_knowledge_base_custom_data_source_id ?? null,
    s3vectors_bucket_name: settings.s3vectors_bucket_name ?? null,
    s3vectors_index_name: settings.s3vectors_index_name ?? null,
    s3vectors_region: settings.s3vectors_region ?? null,
    dynamodb_vectors_table_name: settings.dynamodb_vectors_table_name ?? null,
    dynamodb_vectors_index_name: settings.dynamodb_vectors_index_name ?? null,
    dynamodb_vectors_region: settings.dynamodb_vectors_region ?? null,
    memories_save_enabled:
      settings.memories_save_enabled !== undefined
        ? settings.memories_save_enabled
          ? 1
          : 0
        : null,
    memories_chat_history_enabled:
      settings.memories_chat_history_enabled !== undefined
        ? settings.memories_chat_history_enabled
          ? 1
          : 0
        : null,
    temporary_chats_default:
      settings.temporary_chats_default !== undefined
        ? settings.temporary_chats_default
          ? 1
          : 0
        : null,
    memory_provider: settings.memory_provider ?? null,
    transcription_provider: settings.transcription_provider ?? null,
    transcription_model: settings.transcription_model ?? null,
    speech_provider: settings.speech_provider ?? null,
    speech_model: settings.speech_model ?? null,
    search_provider: settings.search_provider ?? null,
    sandbox_model: settings.sandbox_model ?? null,
    default_model_tier: settings.default_model_tier ?? null,
    default_model_id: settings.default_model_id ?? null,
    default_compute_site: settings.default_compute_site ?? null,
    last_model_selection: settings.last_model_selection ?? null,
    pet_source: settings.pet_source ?? null,
    pet_id: settings.pet_id ?? null,
    pet_travel_enabled:
      settings.pet_travel_enabled !== undefined ? (settings.pet_travel_enabled ? 1 : 0) : null,
    pet_animation_enabled:
      settings.pet_animation_enabled !== undefined
        ? settings.pet_animation_enabled
          ? 1
          : 0
        : null,
    pet_model_overrides: settings.pet_model_overrides ?? null,
    onboarding_seen: settings.onboarding_seen ?? null,
  };

  for (const field of Object.keys(updates)) {
    if (!Object.hasOwn(settings, field) || settings[field] === undefined) {
      delete updates[field];
    }
  }

  return updates;
}

export function userSettingsColumns(): string[] {
  return [
    "id",
    ...Object.entries(USER_SETTINGS_DEFAULTS).map(([field, value]) => {
      const fallback = JSON.stringify(value).replaceAll("'", "''");

      return `CASE WHEN json_type(payload, '$.${field}') IS NULL THEN json_extract('${fallback}', '$') ELSE json_extract(payload, '$.${field}') END AS ${field}`;
    }),
  ];
}

export function buildUserSettingsPatch(settings: Record<string, unknown>): {
  expression: string;
  values: string[];
} | null {
  const entries = Object.entries(prepareUserSettingsUpdates(settings));

  if (entries.length === 0) {
    return null;
  }

  return {
    expression: `json_set(payload, ${entries.map(() => "?, json(?)").join(", ")})`,
    values: entries.flatMap(([key, value]) => [`$.${key}`, JSON.stringify(value)]),
  };
}
